import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_role
from app.models.data_import import DataImport
from app.models.region import Region
from app.models.user import User
from app.models.user_region import UserRegion
from app.schemas.data_import import DataImportOut, UploadResponse
from app.services.kafka import publish_import_request
from app.services.storage import upload_file

router = APIRouter(prefix="/import", tags=["import"])

ALLOWED_EXTENSIONS = {"shp", "geojson", "json", "zip", "gpkg", "csv"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


@router.post("/upload", response_model=UploadResponse)
async def upload_import_file(
    file: UploadFile,
    region_code: str = Query(..., description="Region code (e.g. '11350')"),
    target_table: str = Query(..., description="Target table: parcels, buildings, or facilities"),
    facility_type: str = Query(
        "", description="Facility type code (e.g. 'MH', 'PL') - required when target_table=facilities"
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "editor")),
):
    if target_table not in ("parcels", "buildings", "facilities"):
        raise HTTPException(status_code=400, detail="target_table must be parcels, buildings, or facilities")

    if target_table == "facilities" and not facility_type:
        raise HTTPException(status_code=400, detail="facility_type is required when target_table=facilities")

    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}. Allowed: {ALLOWED_EXTENSIONS}")

    # Resolve region
    result = await db.execute(select(Region).where(Region.code == region_code))
    region = result.scalar_one_or_none()
    if not region:
        raise HTTPException(status_code=404, detail=f"Region not found: {region_code}")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE // (1024 * 1024)}MB")

    # Upload to MinIO
    object_name = f"imports/{region_code}/{uuid.uuid4().hex}/{filename}"
    minio_path = upload_file(object_name, content, file.content_type or "application/octet-stream")

    # Create import record
    di = DataImport(
        region_id=region.id,
        filename=filename,
        file_type=ext,
        target_table=f"gis.{target_table}",
        status="queued",
        minio_path=minio_path,
        started_at=datetime.now(UTC),
    )
    db.add(di)
    await db.flush()

    # Publish Kafka event
    await publish_import_request(
        import_id=di.id,
        minio_path=minio_path,
        file_type=ext,
        target_table=target_table,
        region_code=region_code,
        facility_type=facility_type,
    )

    di.status = "published"
    await db.commit()
    await db.refresh(di)

    return UploadResponse(
        import_id=di.id,
        minio_path=minio_path,
        status=di.status,
        message=f"File uploaded and import job queued for {target_table}",
    )


@router.get("/history", response_model=list[DataImportOut])
async def import_history(
    region: str | None = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "editor")),
):
    stmt = select(DataImport)
    if region:
        stmt = stmt.join(Region, DataImport.region_id == Region.id).where(Region.code == region)
    elif user.role != "admin":
        # Non-admin users only see imports for their assigned regions
        ur_result = await db.execute(
            select(UserRegion.region_code).where(UserRegion.user_id == user.id)
        )
        user_codes = [r[0] for r in ur_result.all()]
        if user_codes:
            region_ids = await db.execute(
                select(Region.id).where(Region.code.in_(user_codes))
            )
            allowed_ids = [r[0] for r in region_ids.all()]
            stmt = stmt.where(DataImport.region_id.in_(allowed_ids))
        else:
            stmt = stmt.where(DataImport.region_id == -1)  # No access
    stmt = stmt.order_by(DataImport.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return [DataImportOut.model_validate(di) for di in result.scalars().all()]


@router.get("/status/{import_id}", response_model=DataImportOut)
async def import_status(
    import_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "editor")),
):
    result = await db.execute(select(DataImport).where(DataImport.id == import_id))
    di = result.scalar_one_or_none()
    if not di:
        raise HTTPException(status_code=404, detail="Import not found")
    return DataImportOut.model_validate(di)


ROLLBACK_ALLOWED_TABLES = {"gis.parcels", "gis.buildings", "gis.facilities"}


@router.delete("/rollback/{import_id}")
async def rollback_import(
    import_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(DataImport).where(DataImport.id == import_id))
    di = result.scalar_one_or_none()
    if not di:
        raise HTTPException(status_code=404, detail="Import not found")

    if di.status not in ("completed", "failed"):
        raise HTTPException(status_code=400, detail=f"Cannot rollback import with status '{di.status}'")

    if di.target_table not in ROLLBACK_ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Unsupported target table: {di.target_table}")

    if not di.started_at or not di.completed_at:
        raise HTTPException(status_code=400, detail="Import missing timestamp info for rollback")

    end_time = di.completed_at + timedelta(seconds=5)

    # Delete records created during the import's time window for the same region
    result = await db.execute(
        text(f"""
            DELETE FROM {di.target_table}
            WHERE created_at >= :started_at
              AND created_at <= :end_time
              AND region_id = :region_id
            RETURNING id
        """),
        {
            "started_at": di.started_at,
            "end_time": end_time,
            "region_id": di.region_id,
        },
    )
    deleted_ids = result.fetchall()
    deleted_count = len(deleted_ids)

    # Update import status
    di.status = "rolled_back"
    await db.commit()

    return {
        "import_id": import_id,
        "status": "rolled_back",
        "deleted_count": deleted_count,
        "target_table": di.target_table,
    }
