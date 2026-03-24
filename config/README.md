# Configuration Directory

이 디렉토리는 배포별 설정을 관리합니다. **실제 배포 정보는 별도 private 리포지토리에 보관**하고, 이 리포지토리는 템플릿과 인프라 코드만 포함합니다.

## 파일 구조

```
config/
├── README.md                    # 이 파일
├── services.example.yml         # 서비스 설정 예시 (템플릿)
├── services.yml                 # 실제 서비스 설정 (gitignored)
├── npm-hosts.example.yml        # NPM 호스트 설정 예시
├── npm-hosts.yml                # 실제 NPM 호스트 설정 (gitignored)
└── templates/                   # 서비스 템플릿
    ├── static-site.yml
    ├── webapp.yml
    └── database.yml
```

## 사용 패턴

### 1. 개발 환경 (로컬)

```bash
# 템플릿 복사
cp config/services.example.yml config/services.yml
cp config/npm-hosts.example.yml config/npm-hosts.yml

# 실제 값으로 수정
vim config/services.yml
vim config/npm-hosts.yml
```

### 2. 프로덕션 환경 (별도 secret repo)

별도의 private GitHub 리포지토리 구조:

```
my-homelab-secrets/
├── .env                        # 실제 환경 변수
├── services.yml                # 실제 서비스 설정
├── npm-hosts.yml               # 실제 NPM 호스트 매핑
└── cloudflare-tunnel-config.yml
```

**배포 시 워크플로우**:

```bash
# 1. IaC 리포지토리 클론
git clone https://github.com/user/serengeti-iac.git
cd serengeti-iac

# 2. Secret 리포지토리 클론 (별도 디렉토리)
git clone https://github.com/user/my-homelab-secrets.git ../secrets

# 3. 설정 파일 링크 또는 복사
ln -s ../secrets/.env .env
ln -s ../secrets/services.yml config/services.yml
ln -s ../secrets/npm-hosts.yml config/npm-hosts.yml

# 4. 배포 실행
make bootstrap
```

## NPM 자동 설정 (향후 구현)

```bash
# config/npm-hosts.yml을 읽어 NPM API로 자동 설정
./scripts/sync-npm-hosts.sh
```

이 스크립트는:
- `config/npm-hosts.yml` 파일을 읽는다
- NPM API를 통해 Proxy Host를 자동 생성/업데이트한다
- 변경 사항을 로그로 남긴다

## 새 서비스 추가 방법

### 단계 1: Compose 파일 작성
```bash
mkdir -p docker/layer3-apps/myapp
# docker-compose.yml 작성
```

### 단계 2: services.yml에 등록
```yaml
services:
  myapp:
    type: app-single
    compose_path: docker/layer3-apps/myapp/docker-compose.yml
    health_endpoint: "/health"
    dependencies:
      - npm
      - postgres
```

### 단계 3: NPM 호스트 매핑 추가
```yaml
npm_hosts:
  myapp:
    domain: "${CF_MYAPP_HOST}"
    forward_to: "myapp:8080"
    ssl: true
```

### 단계 4: .env에 도메인 추가
```bash
CF_MYAPP_HOST=myapp.yourdomain.com
```

### 단계 5: 배포
```bash
docker compose -f docker/layer3-apps/myapp/docker-compose.yml up -d
./scripts/sync-npm-hosts.sh  # NPM에 자동 등록
```

## 보안 원칙

1. **절대 커밋하지 말 것**:
   - `config/services.yml` (실제 설정)
   - `config/npm-hosts.yml` (실제 호스트 매핑)
   - `.env` (실제 환경 변수)

2. **커밋 가능**:
   - `config/*.example.yml` (템플릿)
   - `config/templates/*` (재사용 템플릿)
   - `config/README.md` (문서)

3. **Secret 리포지토리 관리**:
   - Private으로 설정
   - 2FA 활성화
   - 접근 권한 최소화
   - 정기 백업

## 예시: 새 서비스 추가 (Grafana)

1. Compose 파일 작성:
```yaml
# docker/layer3-apps/grafana/docker-compose.yml
services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    volumes:
      - /mnt/primary/grafana:/var/lib/grafana
    networks:
      - proxy-tier
      - data-tier
```

2. Secret repo의 `services.yml`에 추가:
```yaml
services:
  grafana:
    type: app-single
    compose_path: docker/layer3-apps/grafana/docker-compose.yml
    health_endpoint: "/api/health"
    dependencies:
      - npm
```

3. Secret repo의 `npm-hosts.yml`에 추가:
```yaml
npm_hosts:
  grafana:
    domain: "grafana.yourdomain.com"
    forward_to: "grafana:3000"
    ssl: true
```

4. Secret repo의 `.env`에 추가:
```bash
CF_GRAFANA_HOST=grafana.yourdomain.com
```

5. 배포:
```bash
docker compose -f docker/layer3-apps/grafana/docker-compose.yml up -d
./scripts/sync-npm-hosts.sh
```

**IaC 리포지토리에는 어떤 변경도 필요 없음!** 모든 배포 정보는 secret repo에만 존재합니다.
