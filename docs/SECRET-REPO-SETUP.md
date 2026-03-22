# Secret Repository Setup Guide

Private 리포지토리에서 배포 설정을 관리하는 완전한 가이드입니다.

## 1. Secret Repository 생성

### GitHub에서 Private Repo 생성
```bash
# GitHub에서:
# 1. New Repository 클릭
# 2. Name: my-homelab-secrets (또는 원하는 이름)
# 3. Private 선택
# 4. Initialize with README 체크
# 5. Create repository

# 로컬에 클론
cd ~
git clone https://github.com/<username>/my-homelab-secrets.git
cd my-homelab-secrets
```

## 2. 초기 구조 생성

```bash
# 디렉토리 구조 생성
mkdir -p config
mkdir -p cloudflare
mkdir -p backups

# IaC repo의 예시 파일 복사
cd ~/serengeti-iac
cp .env.example ~/my-homelab-secrets/.env
cp config/services.example.yml ~/my-homelab-secrets/config/services.yml
cp config/npm-hosts.example.yml ~/my-homelab-secrets/config/npm-hosts.yml

cd ~/my-homelab-secrets
```

## 3. 환경 변수 설정 (.env)

```bash
vim .env
```

실제 값으로 치환:
```bash
# Network & Domain
CF_TUNNEL_TOKEN=your-actual-tunnel-token-here
CF_DOMAIN=yourdomain.com
CF_BLOG_HOST=blog.yourdomain.com
CF_NAS_HOST=nas.yourdomain.com
CF_PLANE_HOST=tasks.yourdomain.com
CF_S3_HOST=s3.yourdomain.com

# Server Info
SERVER_IP=192.168.x.x
LOCAL_GW=192.168.x.1
SSH_PORT=22222

# PostgreSQL
POSTGRES_PASSWORD=your-strong-password-here

# Redis
REDIS_PASSWORD=another-strong-password

# ... 나머지 비밀번호들
```

## 4. 서비스 설정 (config/services.yml)

```bash
vim config/services.yml
```

실제 배포 정보 입력:
```yaml
version: "1.0"

services:
  astro-blog:
    type: static-site
    compose_path: docker/layer3-apps/blog/docker-compose.yml
    health_endpoint: "/"
    description: "Personal blog"
    dependencies:
      - npm

  plane:
    type: app-stack
    compose_path: docker/layer3-apps/plane/docker-compose.yml
    health_endpoint: "/"
    description: "Task management"
    dependencies:
      - npm
      - postgres
      - redis
      - rabbitmq
      - minio

  nextcloud:
    type: app-single
    compose_path: docker/layer3-apps/nextcloud/docker-compose.yml
    health_endpoint: "/status.php"
    description: "Cloud storage"
    dependencies:
      - npm
      - postgres
      - redis
```

## 5. NPM 호스트 매핑 (config/npm-hosts.yml)

```bash
vim config/npm-hosts.yml
```

실제 도메인으로 설정:
```yaml
version: "1.0"

npm:
  url: "http://127.0.0.1:81"

hosts:
  - name: "Blog"
    domain_names:
      - "blog.yourdomain.com"
    forward_scheme: "http"
    forward_host: "astro-blog"
    forward_port: 80
    certificate_id: "new"
    ssl_forced: true
    http2_support: true
    block_exploits: true
    cache_assets: true

  - name: "Plane Tasks"
    domain_names:
      - "tasks.yourdomain.com"
    forward_scheme: "http"
    forward_host: "plane-proxy"
    forward_port: 80
    certificate_id: "new"
    ssl_forced: true
    http2_support: true
    block_exploits: true
    websocket_support: true

  - name: "Nextcloud"
    domain_names:
      - "nas.yourdomain.com"
    forward_scheme: "http"
    forward_host: "nextcloud"
    forward_port: 80
    certificate_id: "new"
    ssl_forced: true
    http2_support: true
    advanced_config: |
      client_max_body_size 512M;
      proxy_read_timeout 3600s;
```

## 6. Git 커밋 및 보안

```bash
# .gitignore 생성
cat > .gitignore <<'EOF'
# Temporary files
*.tmp
*.bak
*~

# Local overrides
.env.local
config/*.local.yml

# Backup files
backups/*.tar.gz
backups/*.sql

# Runtime data
logs/
.cache/
EOF

# 커밋
git add .
git commit -m "Initial secret configuration"
git push origin main
```

## 7. IaC Repo와 연결

### 방법 A: Symbolic Link (개발 환경)

```bash
cd ~/serengeti-iac

# .env 링크
ln -sf ~/my-homelab-secrets/.env .env

# config 디렉토리 링크
ln -sf ~/my-homelab-secrets/config/services.yml config/services.yml
ln -sf ~/my-homelab-secrets/config/npm-hosts.yml config/npm-hosts.yml

# 확인
ls -la .env config/services.yml config/npm-hosts.yml
```

### 방법 B: 복사 (프로덕션 환경)

```bash
cd ~/serengeti-iac

# 복사
cp ~/my-homelab-secrets/.env .env
cp ~/my-homelab-secrets/config/services.yml config/services.yml
cp ~/my-homelab-secrets/config/npm-hosts.yml config/npm-hosts.yml

# 권한 설정
chmod 600 .env
```

## 8. 배포

```bash
cd ~/serengeti-iac

# 환경 확인
make check-env

# 전체 스택 배포
make bootstrap

# 또는 개별 레이어 배포
make ops
make data
make apps
```

## 9. NPM 설정 동기화

### 수동 방법 (현재)
```bash
# NPM 설정 출력
./scripts/sync-npm-hosts.sh

# NPM Admin UI 열기
# http://127.0.0.1:81
# 출력된 설정대로 수동 입력
```

### 자동 방법 (미래)
```bash
# NPM API를 통해 자동 설정 (향후 구현)
./scripts/sync-npm-hosts.sh --apply
```

## 10. 보안 체크리스트

- [ ] Secret repo를 Private으로 설정
- [ ] 2FA 활성화
- [ ] .env 파일에 강력한 비밀번호 사용
- [ ] SSH 키는 별도 보관 (secret repo에 커밋 금지)
- [ ] 정기 백업 설정 (암호화)
- [ ] 접근 권한 최소화
- [ ] Git history에 민감 정보 없는지 확인

## 11. 백업

### Secret Repo 백업
```bash
cd ~/my-homelab-secrets

# 암호화 백업
tar czf - . | gpg -c > ~/backups/secrets-$(date +%Y%m%d).tar.gz.gpg

# 복원
gpg -d ~/backups/secrets-20260322.tar.gz.gpg | tar xz
```

### 자동 백업 (cron)
```bash
# crontab 추가
crontab -e

# 매주 일요일 새벽 2시
0 2 * * 0 cd ~/my-homelab-secrets && tar czf - . | gpg -c --passphrase-file ~/.gpg-pass > ~/backups/secrets-$(date +\%Y\%m\%d).tar.gz.gpg
```

## 12. 다중 환경 관리

### 구조
```
my-homelab-secrets/
├── dev/
│   ├── .env
│   └── config/
├── staging/
│   ├── .env
│   └── config/
└── prod/
    ├── .env
    └── config/
```

### 배포 시 환경 선택
```bash
# Development
cd ~/serengeti-iac
ln -sf ~/my-homelab-secrets/dev/.env .env
ln -sf ~/my-homelab-secrets/dev/config config
make bootstrap

# Production
ln -sf ~/my-homelab-secrets/prod/.env .env
ln -sf ~/my-homelab-secrets/prod/config config
make bootstrap
```

## 13. 문제 해결

### Secret repo clone 실패
```bash
# SSH 키 확인
ssh -T git@github.com

# HTTPS 사용 시 PAT 필요
git clone https://<token>@github.com/<username>/my-homelab-secrets.git
```

### 심볼릭 링크 오류
```bash
# 절대 경로 사용
ln -sf /home/girinman/my-homelab-secrets/.env /home/girinman/serengeti-iac/.env

# 또는 상대 경로 확인
cd ~/serengeti-iac
ln -sf ../my-homelab-secrets/.env .env
```

### .env 변수 인식 안 됨
```bash
# 변수 내보내기 확인
source .env
echo $CF_DOMAIN

# Docker Compose에서 인식 확인
docker compose --env-file .env config
```

## 14. 추가 리소스

- [IaC Repo Config 가이드](../config/README.md)
- [NPM 호스트 템플릿](../config/npm-hosts.example.yml)
- [서비스 템플릿](../config/services.example.yml)
