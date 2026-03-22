# Ubuntu 24.04 LTS 홈랩 인프라 IaC - Agent Guidelines

**최종 갱신**: 2026-03-22
**대상 환경**: Ubuntu Server 24.04 LTS 홈랩

## 운영 규칙

- 에이전트는 가능한 범위에서 사람 입력 없이 계속 작업을 진행한다.
- 사람 입력이 꼭 필요한 항목은 `docs/operator-memo.md` 등에 임시 메모를 남기고, 그 작업은 이번 라운드에서 건너뛴다.
- 긴 작업은 가능한 범위에서 멀티 에이전트/병렬 작업으로 진행하고, 진행 로그를 남긴다.
- 작업 중간중간 git 부분 커밋을 남긴다. 한 번에 거대한 단일 커밋으로 몰지 않는다.
- 현재 상태 확인용 문서와 raw 로그를 계속 갱신한다. 필요 시 `make runtime-snapshot` 으로 최신 런타임 상태를 남긴다.

## 보호 규칙

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 이 경로 아래의 파일은 삭제, 이동, 정리, 마이그레이션, 덮어쓰기 대상에서 항상 제외한다.

## 이미지 태그 규칙

- `docker` 이미지 태그에 `latest` 를 새로 도입하지 않는다.
- 현재 런타임에 `latest` 로 떠 있는 서비스가 보이면, 가능하면 고정 버전 태그로 정리한다.

## Perplexity 사용 규칙

- 인터넷 검색이 꼭 필요할 때만 `docs/perplexity/` 의 도구를 사용한다.
- 비용이 큰 도구이므로 먼저 좁은 범위의 쿼리 1회로 판단하고, 부족할 때만 추가 검색한다.
- Perplexity를 실행했다면 반드시 아래를 `docs/perplexity/` 아래 기록한다.
  - 요청 배경, 실제 쿼리 문자열, 실행 시각, 결과 요약, 최종 판단에 사용한 URL

## 현재 우선 아키텍처

### Layer 3 기본 앱
- **Astro 블로그**: 정적 사이트, nginx로 서빙 (DB 불필요)
- **Nextcloud**: NAS, PostgreSQL + Redis 사용
- **Plane**: Task 관리, PostgreSQL + RabbitMQ 사용

### Layer 2 인프라
- **PostgreSQL**: Nextcloud + Plane 공유
- **Redis**: Nextcloud + Plane 공유
- **RabbitMQ**: Plane 전용
- **Neo4j, Elasticsearch, Kafka, Minio**: 미래 서비스용 대기

### Layer 1 Ops
- **Nginx Proxy Manager**: 내부 라우팅
- **Cloudflare Tunnel**: 외부 접근 (NAT 우회)

## 핵심 아키텍처 결정

### 저장장치 구성 (실제 시스템 기준)
- **1TB SSD**: 메인 OS 드라이브 (`/` 루트) - Ubuntu, Docker, 시스템 로그
- **500GB SSD**: 보조 저장소 (`/mnt/primary`) - PostgreSQL, Neo4j, Elasticsearch, Kafka, Redis 데이터
- **8TB HDD x2**: Archive Storage (`/mnt/archive`, ZFS Mirror) - Minio, Nextcloud 파일, Borg 백업

**중요**: OS 설치 드라이브 변경이 어렵기 때문에 1TB SSD를 메인 OS로 사용한다.

### 리포지토리 범위
- `system/`, `docker/`: 홈랩 서버 자체를 구성하는 IaC 자산
- `user_cli/`: 운영자 개인 Ubuntu 24.04 CLI 환경 부트스트랩 (서버 프로비저닝과 별개)

### 보안 마스킹 원칙
- 실제 서버 IP, 포트, 도메인, 토큰, 키 이름, 비밀번호 등 운영값은 문서에 직접 적지 않고 모두 `<...>` 형태의 플레이스홀더로 표기한다.

## 유연한 서비스 구성 철학

**핵심 원칙**: IaC 리포지토리는 인프라 코드와 템플릿만 포함하고, 실제 배포 정보(도메인 매핑, 민감한 설정)는 별도의 private 리포지토리로 분리한다.

### Public IaC Repo vs Private Secret Repo

**Public IaC Repository** (이 리포지토리):
- Docker Compose 템플릿, 시스템 스크립트, 서비스 템플릿, 예시 설정 파일, 문서

**Private Secret Repository** (별도 관리):
- `.env`, `config/services.yml`, `config/npm-hosts.yml`, Cloudflare Tunnel 설정

**장점**:
- IaC 리포지토리 public 공개 가능 (도메인 정보 노출 없음)
- 새 서비스 추가 시 IaC 코드 변경 최소화
- NPM 설정을 선언적으로 관리 (YAML)
- 배포 환경별 설정 분리 (dev/staging/prod)

자세한 가이드: `config/README.md`, `docs/SECRET-REPO-SETUP.md`

## 디렉토리 구조 (High-Level)

```
~/infra/
├── Makefile                 # 통합 배포 진입점 (make help 참조)
├── .env                     # 환경 변수 (git 제외)
├── .env.example             # 템플릿
├── system/                  # Layer 0: System Foundation
│   ├── 01_setup.sh          # 기본 패키지 설치
│   ├── 02_zfs_archive.sh    # ZFS Mirror 구성
│   ├── 03_mount_primary.sh  # 500GB SSD 마운트
│   ├── sshd_config, ufw.sh, cloudflared_install.sh
├── user_cli/                # 운영자 로컬 CLI 부트스트랩
│   └── init_ubuntu.sh
├── config/                  # 서비스 설정 템플릿 (example files)
│   ├── README.md, services.example.yml, npm-hosts.example.yml
│   └── templates/
├── scripts/                 # 유틸리티 스크립트
└── docker/
    ├── networks.sh
    ├── layer1-ops/npm/
    ├── layer2-data/{postgres,neo4j,elasticsearch,redis,kafka,rabbitmq,minio}/
    └── layer3-apps/{blog,plane,nextcloud,backup}/
```

**참조**: 실제 스크립트와 Compose 파일은 해당 디렉토리에 존재. 문서에 전체 내용을 복사하지 않는다.

## 네트워크 토폴로지

```
Internet → 건물 Main Router (접근 불가)
  ↓
Ubuntu Server (단일 NAT) ← Cloudflare Tunnel (아웃바운드)
  ↓
Docker Networks:
  - proxy-tier: NPM ↔ Astro, Nextcloud, Plane, Minio (80/443 호스트 노출)
  - data-tier: PostgreSQL, Redis, Neo4j, Elasticsearch, Kafka, RabbitMQ, Minio (비노출)
```

**핵심 제약**: 건물 라우터 포트포워딩 불가 → Cloudflare Tunnel로 NAT 우회

## 배포 순서 (요약)

1. `make system` → 기본 패키지 설치
2. `make storage` → ZFS + Primary SSD 마운트
3. `make ssh` → SSH 포트 변경 (사전에 PEM 키 등록 필요)
4. `make ufw` → 방화벽 설정
5. `make cloudflared` → Cloudflare Tunnel (`.env`에 토큰 설정 필요)
6. `make network` → Docker 네트워크 생성
7. `make ops` → NPM 실행
8. `make data` → Layer 2 데이터 플랫폼 전체 실행
9. DB 초기화 (postgres에서 plane, nextcloud DB 생성)
10. `make apps` → Layer 3 애플리케이션 실행
11. `make backup` → 백업 파이프라인 실행

**참조**: `Makefile` 에서 각 타겟의 실제 명령어 확인

## 주요 명령어 참조

- **Docker**: `docker ps -a`, `docker logs -f <name>`, `docker exec -it <name> bash`
- **ZFS**: `sudo zpool status`, `sudo zfs list -t snapshot`
- **Borg**: `borg list /mnt/archive/borg-repo`
- **Service 재시작**: `docker compose -f docker/layer3-apps/<service>/docker-compose.yml restart`

## 문서 참조

- **Secret Repo 설정**: `docs/SECRET-REPO-SETUP.md`
- **유연한 서비스 구성**: `config/README.md`
- **외부 설정 템플릿**: `docs/manual/external-setup-template.md`
- **Astro 블로그 가이드**: `docker/layer3-apps/blog/README.md`
- **Operator Memo**: `docs/operator-memo.md` (사람 입력 필요한 항목 기록)

---

<!-- ooo:START -->
<!-- ooo:VERSION:0.25.0 -->
# Ouroboros — Specification-First AI Development

> Before telling AI what to build, define what should be built.
> As Socrates asked 2,500 years ago — "What do you truly know?"
> Ouroboros turns that question into an evolutionary AI workflow engine.

Most AI coding fails at the input, not the output. Ouroboros fixes this by
**exposing hidden assumptions before any code is written**.

1. **Socratic Clarity** — Question until ambiguity ≤ 0.2
2. **Ontological Precision** — Solve the root problem, not symptoms
3. **Evolutionary Loops** — Each evaluation cycle feeds back into better specs

```
Interview → Seed → Execute → Evaluate
    ↑                           ↓
    └─── Evolutionary Loop ─────┘
```

## ooo Commands

Each command loads its agent/MCP on-demand. Details in each skill file.

| Command | Loads |
|---------|-------|
| `ooo` | — |
| `ooo interview` | `ouroboros:socratic-interviewer` |
| `ooo seed` | `ouroboros:seed-architect` |
| `ooo run` | MCP required |
| `ooo evolve` | MCP: `evolve_step` |
| `ooo evaluate` | `ouroboros:evaluator` |
| `ooo unstuck` | `ouroboros:{persona}` |
| `ooo status` | MCP: `session_status` |
| `ooo setup` | — |
| `ooo help` | — |

## Agents

Loaded on-demand — not preloaded.

**Core**: socratic-interviewer, ontologist, seed-architect, evaluator,
wonder, reflect, advocate, contrarian, judge
**Support**: hacker, simplifier, researcher, architect
<!-- ooo:END -->
