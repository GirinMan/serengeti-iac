from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    name: str | None
    role: str
    is_active: bool
    region_codes: list[str] = []

    model_config = {"from_attributes": True}
