FROM alpine:3.19

RUN apk add --no-cache \
    bash \
    borgbackup \
    curl \
    docker-cli \
    dcron \
    gzip \
    postgresql-client

COPY scripts /scripts
RUN chmod +x /scripts/*.sh

COPY crontab /etc/crontabs/root

CMD ["crond", "-f", "-l", "2"]
