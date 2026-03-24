from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.models.region import Base


class UserRegion(Base):
    __tablename__ = "user_regions"
    __table_args__ = {"schema": "auth"}

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    region_code = Column(String(10), ForeignKey("gis.regions.code", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
