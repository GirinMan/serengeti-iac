from datetime import datetime

from pydantic import BaseModel, Field


class DataSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    source_type: str = Field(..., pattern="^(API|FILE)$")
    url: str = Field(..., min_length=1)
    api_key: str | None = None
    parameters: dict = Field(default_factory=dict)
    schedule_cron: str | None = None
    target_table: str = Field(..., pattern="^(parcels|buildings|facilities|address)$")
    region_code: str = Field(..., min_length=1, max_length=10)
    is_active: bool = True


class DataSourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    api_key: str | None = None
    parameters: dict | None = None
    schedule_cron: str | None = None
    target_table: str | None = None
    is_active: bool | None = None


class DataSourceOut(BaseModel):
    id: int
    name: str
    source_type: str
    url: str
    api_key: str | None
    parameters: dict
    schedule_cron: str | None
    target_table: str
    region_code: str
    is_active: bool
    last_synced_at: datetime | None
    last_sync_status: str | None
    last_sync_message: str | None
    last_sync_count: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SyncTriggerResponse(BaseModel):
    data_source_id: int
    status: str
    message: str
