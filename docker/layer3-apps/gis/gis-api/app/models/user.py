from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.models.region import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(100), nullable=False)
    name = Column(String(100))
    role = Column(String(20), default="viewer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approval_status = Column(String(20), default="pending")
    tenant_id = Column(Integer, ForeignKey("auth.tenants.id"))
    upload_permission = Column(Boolean, default=False)
    phone = Column(String(20))
    department = Column(String(100))
    position = Column(String(100))
