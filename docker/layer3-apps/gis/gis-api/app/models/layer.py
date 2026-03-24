from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.region import Base


class Layer(Base):
    __tablename__ = "layers"
    __table_args__ = {"schema": "gis"}

    id = Column(Integer, primary_key=True)
    region_id = Column(Integer, ForeignKey("gis.regions.id"), nullable=True)
    code = Column(String(30), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(20), nullable=False)
    source_table = Column(String(100))
    tile_url = Column(String(300))
    min_zoom = Column(SmallInteger, default=0)
    max_zoom = Column(SmallInteger, default=22)
    visible = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    style = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    region = relationship("Region", back_populates="layers", foreign_keys=[region_id])

    __mapper_args__ = {
        "eager_defaults": True,
    }
