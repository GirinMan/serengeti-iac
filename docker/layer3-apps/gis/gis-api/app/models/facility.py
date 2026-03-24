from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.region import Base


class FacilityType(Base):
    __tablename__ = "facility_types"
    __table_args__ = {"schema": "gis"}

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(20), nullable=False)
    geom_type = Column(String(20), nullable=False)
    symbol_key = Column(String(50))
    style = Column(JSONB, default={})

    facilities = relationship("Facility", back_populates="facility_type")


class Facility(Base):
    __tablename__ = "facilities"
    __table_args__ = {"schema": "gis"}

    id = Column(BigInteger, primary_key=True)
    region_id = Column(Integer, ForeignKey("gis.regions.id"))
    type_id = Column(Integer, ForeignKey("gis.facility_types.id"))
    fac_id = Column(String(50))
    geom = Column(Geometry("GEOMETRY", srid=4326), nullable=False)
    properties = Column(JSONB, default={})
    year = Column(SmallInteger)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    region = relationship("Region", back_populates="facilities", foreign_keys=[region_id])
    facility_type = relationship("FacilityType", back_populates="facilities", foreign_keys=[type_id])
