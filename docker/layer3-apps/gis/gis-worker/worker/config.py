from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@postgres:5432/gisdb"

    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "gis-imports"
    minio_secure: bool = False

    kafka_bootstrap: str = "kafka:9092"
    kafka_import_topic: str = "gum.import.request"
    kafka_group_id: str = "gum-worker"

    work_dir: str = "/tmp/gis-worker"

    model_config = {"env_prefix": "GIS_"}


settings = Settings()
