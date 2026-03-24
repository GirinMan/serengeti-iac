FROM postgis/postgis:16-3.4-alpine AS base

# PostGIS base image: shp2pgsql, ogr2ogr available
RUN apk add --no-cache python3 py3-pip gdal-tools libintl && \
    apk add --no-cache --virtual .build-deps \
        python3-dev gcc musl-dev libffi-dev zlib-dev && \
    python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY requirements.txt .
RUN uv pip install --python /opt/venv/bin/python -r requirements.txt && \
    apk del .build-deps

COPY worker/ ./worker/

CMD ["python", "-m", "worker.main"]
