FROM alpine:3.19

RUN apk add --no-cache \
    bash \
    borgbackup \
    curl \
    docker-cli \
    gzip \
    postgresql-client \
    tzdata

COPY scripts /scripts
RUN chmod +x /scripts/*.sh

COPY crontab /etc/crontabs/root

CMD ["busybox", "crond", "-f", "-l", "2", "-L", "/dev/stdout", "-c", "/etc/crontabs"]
