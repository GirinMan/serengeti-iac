from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from app.models.region import Base


class DataSource(Base):
    __tablename__ = "data_sources"
    __table_args__ = {"schema": "audit"}

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    source_type = Column(String(20), nullable=False)  # API, FILE
    url = Column(Text, nullable=False)
    api_key = Column(String(500))
    parameters = Column(JSONB, default={})
    schedule_cron = Column(String(100))  # e.g., "0 3 * * 1" (매주 월 3시)
    target_table = Column(String(100), nullable=False)
    region_code = Column(String(10), nullable=False)
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True))
    last_sync_status = Column(String(20))  # success, failed, running
    last_sync_message = Column(Text)
    last_sync_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
