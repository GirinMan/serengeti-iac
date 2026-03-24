from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL + PostGIS
    database_url: str = "postgresql+asyncpg://postgres:password@postgres:5432/gisdb"

    # Redis
    redis_url: str = "redis://:password@redis:6379/0"
    cache_ttl: int = 3600  # 1 hour

    # Elasticsearch
    elasticsearch_url: str = "http://elasticsearch:9200"
    elasticsearch_password: str = ""

    # JWT
    jwt_secret: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hours

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "gis-imports"
    minio_secure: bool = False

    # Kafka
    kafka_bootstrap: str = "kafka:9092"
    kafka_import_topic: str = "gum.import.request"

    # CORS
    cors_origins: list[str] = ["*"]

    model_config = {"env_prefix": "GIS_"}


settings = Settings()
