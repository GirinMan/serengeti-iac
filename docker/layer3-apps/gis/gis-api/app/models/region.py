from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Integer, SmallInteger, String, func
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Region(Base):
    __tablename__ = "regions"
    __table_args__ = {"schema": "gis"}

    id = Column(Integer, primary_key=True)
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    bbox = Column(Geometry("POLYGON", srid=4326))
    center = Column(Geometry("POINT", srid=4326))
    zoom_min = Column(SmallInteger, default=10)
    zoom_max = Column(SmallInteger, default=19)
    srid_source = Column(Integer, default=5181)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    layers = relationship("Layer", back_populates="region")
    parcels = relationship("Parcel", back_populates="region")
    buildings = relationship("Building", back_populates="region")
    facilities = relationship("Facility", back_populates="region")
