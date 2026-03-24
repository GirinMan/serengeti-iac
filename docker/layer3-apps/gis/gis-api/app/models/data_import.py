from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text, func

from app.models.region import Base


class DataImport(Base):
    __tablename__ = "data_imports"
    __table_args__ = {"schema": "audit"}

    id = Column(BigInteger, primary_key=True)
    region_id = Column(Integer)
    filename = Column(String(300), nullable=False)
    file_type = Column(String(10), nullable=False)
    target_table = Column(String(100), nullable=False)
    record_count = Column(Integer)
    status = Column(String(20), default="pending")
    error_msg = Column(Text)
    minio_path = Column(String(500))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
