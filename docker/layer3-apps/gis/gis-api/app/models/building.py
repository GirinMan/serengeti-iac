from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.region import Base


class Building(Base):
    __tablename__ = "buildings"
    __table_args__ = {"schema": "gis"}

    id = Column(BigInteger, primary_key=True)
    region_id = Column(Integer, ForeignKey("gis.regions.id"))
    bld_name = Column(String(200))
    bld_use = Column(String(50))
    address = Column(String(300))
    floors = Column(SmallInteger)
    geom = Column(Geometry("GEOMETRY", srid=4326), nullable=False)
    properties = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    region = relationship("Region", back_populates="buildings", foreign_keys=[region_id])
