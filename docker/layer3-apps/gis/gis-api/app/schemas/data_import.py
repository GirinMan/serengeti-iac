from datetime import datetime

from pydantic import BaseModel


class DataImportOut(BaseModel):
    id: int
    region_id: int | None
    filename: str
    file_type: str
    target_table: str
    record_count: int | None
    status: str
    error_msg: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UploadResponse(BaseModel):
    import_id: int
    minio_path: str
    status: str
    message: str
