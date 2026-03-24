from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.region import Base


class Parcel(Base):
    __tablename__ = "parcels"
    __table_args__ = {"schema": "gis"}

    id = Column(BigInteger, primary_key=True)
    region_id = Column(Integer, ForeignKey("gis.regions.id"))
    pnu = Column(String(19))
    jibun = Column(String(100))
    jimok = Column(String(10))
    area_m2 = Column(Numeric(12, 2))
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    properties = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    region = relationship("Region", back_populates="parcels", foreign_keys=[region_id])
