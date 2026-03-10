# Ubuntu 24.04 LTS 홈랩 인프라 IaC 청사진 (최종 설계 문서)

**작성일**: 2026-03-10  
**대상 환경**: 우영하우스 403호, Ubuntu Server 24.04 LTS (<server_private_ip>)  
**목적**: 오프라인 코딩 에이전트가 검색 없이 바로 구현 가능한 수준의 상세 기술 문서

**2026-03-10 런타임 설계 갱신 메모**:
- 기본 블로그 서비스는 `Ghost` 가 아니라 `WordPress` 로 운영한다.
- task 관리 애플리케이션으로 `Plane` 을 추가한다.
- 위 변경에 따라 인프라 레이어에는 `MariaDB` 와 `RabbitMQ` 가 추가된다.
- 하단의 일부 상세 예시는 아직 이전 설계를 포함할 수 있으므로, 실제 적용 우선순위는 현재 compose 파일과 진행 로그를 따른다.

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
  - 요청 배경
  - 실제 쿼리 문자열
  - 실행 시각
  - 결과 요약
  - 최종 판단에 사용한 URL

## 현재 우선 아키텍처

- Layer 3 기본 앱:
  - `WordPress` 블로그
  - `Nextcloud` NAS
  - `Plane` task 관리
- Layer 2 추가 인프라:
  - `MariaDB` 는 `WordPress` 용
  - `RabbitMQ` 는 `Plane` 용

**저장장치 구성 (실제 시스템 기준)**:
- **1TB SSD** = 메인 OS 드라이브 (루트 `/`, Ubuntu·Docker·NPM 등)
- **500GB SSD** = 보조 저장소 (`/mnt/primary`, DB·캐시·덤프 등)
- OS 설치 드라이브 변경이 어렵기 때문에 위 구성을 문서 전반에 반영하였다.

**리포지토리 범위 보충**:
- `system/`, `docker/`는 홈랩 서버 자체를 구성하는 IaC 자산이다.
- `user_cli/`는 서버 런타임이 아니라 운영자 개인 Ubuntu 24.04 CLI 환경을 부트스트랩하는 보조 자산이다.

**보안 마스킹 원칙**:
- 실제 서버 IP, 포트, 도메인, 토큰, 키 이름, 비밀번호 등 운영값은 문서에 직접 적지 않고 모두 `<...>` 형태의 플레이스홀더로 표기한다.

> 주의: IP 주소, secret key 등 민감한 정보는 절대 git에 직접 업로드하지 말고 .env 등에 저장하여 gitignore하세요.

---

## 목차

1. [프로젝트 개요 및 네트워크 환경](#1-프로젝트-개요-및-네트워크-환경)
2. [하드웨어 및 스토리지 전략](#2-하드웨어-및-스토리지-전략)
3. [아키텍처 3계층 설계](#3-아키텍처-3계층-설계)
4. [전체 디렉토리 구조](#4-전체-디렉토리-구조)
5. [환경 변수 및 보안 설정](#5-환경-변수-및-보안-설정)
6. [Layer 0: 시스템 기초 설정](#6-layer-0-시스템-기초-설정)
7. [Layer 1: Network & Security](#7-layer-1-network--security)
8. [Layer 2: Data Platform](#8-layer-2-data-platform)
9. [Layer 3: Application](#9-layer-3-application)
10. [백업 파이프라인](#10-백업-파이프라인)
11. [Makefile 통합 관리](#11-makefile-통합-관리)
12. [배포 실행 순서](#12-배포-실행-순서)

---

## 1. 프로젝트 개요 및 네트워크 환경

### 1.1 네트워크 토폴로지

```
External Network (Internet)
    ↓
건물 Main Router (<public_wan_ip> → <building_router_ip>)
    ├─ 403호 IDF (Layer 2 Switch)
    │   ├─ Ubuntu Server (<server_private_ip>) ← 건물 라우터 직결
    │   └─ H724G Router (WAN: <room_router_wan_ip>, LAN: <room_router_lan_ip>)
    │       └─ WiFi 기기들 (<wifi_subnet>)
```

**핵심 제약**:
- 건물 메인 라우터 접근 불가 (포트포워딩 설정 불가)
- 이중 NAT 구조 (건물 → 403호 공유기)
- 서버는 건물 라우터 바로 아래(단일 NAT), WiFi 기기들은 이중 NAT

**해결 방안**:
- **Cloudflare Tunnel** (아웃바운드 전용, NAT 우회)
- 외부에서 서버로 인바운드 포트를 열지 않음

### 1.2 도메인 및 DNS 설정

- **도메인**: `<public_domain>`
- **네임서버**: Cloudflare로 위임
- **서브도메인 라우팅**:
  - `<blog_subdomain>` → WordPress 블로그
  - `<nas_subdomain>` → Nextcloud
  - `<api_subdomain>` → Custom API
  - `<tasks_subdomain>` → Plane
  - `<ssh_subdomain>` → SSH 접속용 (Cloudflare Access)

---

## 2. 하드웨어 및 스토리지 전략

### 2.1 물리 디스크 구성

| 디스크 | 용량 | 모델 | 내구성 | 용도 |
|--------|------|------|--------|------|
| SSD #1 | 1TB | SK Hynix Gold P31 | 750TBW | OS Root (메인 OS 저장소) |
| SSD #2 | 500GB | Samsung 970 EVO Plus | 300TBW | Primary Storage (보조 저장소, Write Heavy) |
| HDD #1 | 8TB | 범용 HDD | N/A | Archive Storage (ZFS Mirror) |
| HDD #2 | 8TB | 범용 HDD | N/A | Archive Storage (ZFS Mirror) |

### 2.2 스토리지 티어링 전략

#### Root Storage (1TB SSD)
- **마운트**: `/` (기본 시스템 루트)
- **용도**:
  - Ubuntu 24.04 LTS OS (메인 OS 드라이브)
  - Docker 엔진 및 이미지 캐시
  - 시스템 로그 (`/var/log`)
  - NPM, Cloudflared 등 Ops 레이어 컨테이너 볼륨
- **파일시스템**: ext4 (기본)

#### Primary Storage (500GB SSD, 보조 저장소)
- **마운트**: `/mnt/primary`
- **용도**:
  - PostgreSQL 데이터 (`/mnt/primary/postgres`)
  - Neo4j 데이터 (`/mnt/primary/neo4j`)
  - Elasticsearch 인덱스 (`/mnt/primary/elasticsearch`)
  - Kafka 로그 세그먼트 (`/mnt/primary/kafka`)
  - Redis AOF/RDB 백업 (`/mnt/primary/redis`)
  - DB 임시 덤프 파일 (`/mnt/primary/dumps`)
- **파일시스템**: ext4 또는 xfs (선택)
- **특징**: 고속 랜덤 I/O, 빈번한 쓰기 작업 (약 450GB 가용)

#### Archive Storage (8TB HDD x2 ZFS Mirror)
- **마운트**: `/mnt/archive`
- **용도**:
  - Minio S3 백엔드 스토리지 (`/mnt/archive/minio`)
  - Nextcloud 파일 스토리지 (`/mnt/archive/nextcloud`)
  - BorgBackup Repository (`/mnt/archive/borg-repo`)
  - DB 스냅샷 아카이브 (`/mnt/archive/backup`)
- **파일시스템**: ZFS (mirror 구성)
- **가용 용량**: 약 7.2TB (실질 운영 권장: 6~6.5TB)
- **특징**: 
  - Copy-On-Write 기반 스냅샷 (즉시 생성, 랜섬웨어 방어)
  - Self-healing (비트 손상 자동 복구)
  - 압축 (LZ4/ZSTD) 지원
  - `zfs-auto-snapshot` 연동 (시간/일/주/월 자동 스냅샷)

---

## 3. 아키텍처 3계층 설계

### Layer 0: System Foundation
- OS 설정, 스토리지 마운트, 보안 기초 (SSH, UFW)

### Layer 1: Network & Security (Ops)
- Cloudflare Tunnel (외부 접근 관문)
- Nginx Proxy Manager (내부 라우팅)
- UFW (방화벽)
- SSH (PEM 인증, Custom Port)

### Layer 2: Data Platform (Infrastructure)
- PostgreSQL (RDBMS)
- Neo4j (Graph DB)
- Elasticsearch (Search Engine)
- Redis (Cache & Pub/Sub)
- Kafka KRaft (Event Stream)
- Minio (S3-compatible Object Storage)

### Layer 3: Application
- WordPress (블로그)
- Nextcloud (NAS)
- Plane (Task Management)
- Custom API 서비스
- Backup Pipeline (Cron + BorgBackup)

### Docker 네트워크 설계

```
proxy-tier (bridge):
  - NPM (<npm_http_port>, <npm_https_port> 포트 호스트에 노출)
  - WordPress, Nextcloud, Plane, Custom API (포트 비노출, 컨테이너명으로 NPM에 연결)

data-tier (bridge):
  - PostgreSQL, Neo4j, Elasticsearch, Redis, Kafka, Minio
  - 애플리케이션 컨테이너들이 서비스명으로 접근
  - NPM과 직접 연결 안 됨 (외부 노출 차단)
```

---

## 4. 전체 디렉토리 구조

```
~/infra/
├── Makefile                          # 통합 빌드 및 배포 진입점
├── .env                              # 환경 변수 (git 제외)
├── .env.example                      # 템플릿
├── .gitignore
├── README.md
│
├── system/                           # Layer 0: System Foundation
│   ├── 01_setup.sh                   # 기본 패키지 설치
│   ├── 02_zfs_archive.sh             # ZFS Pool 생성 및 마운트
│   ├── 03_mount_primary.sh           # 500GB SSD(보조) 마운트
│   ├── sshd_config                   # SSH 설정 파일
│   ├── ufw.sh                        # 방화벽 규칙
│   └── cloudflared_install.sh        # Cloudflare Tunnel 설치
│
├── user_cli/                         # 운영자 로컬 Ubuntu CLI 부트스트랩
│   ├── init_ubuntu.sh                # 로컬 CLI/쉘 환경 초기화 스크립트
│   ├── .zshrc                        # oh-my-zsh + starship 설정
│   └── .tmux.conf.local              # gpakosz tmux 로컬 오버라이드
│
└── docker/
    ├── networks.sh                   # Docker 네트워크 생성
    │
    ├── layer1-ops/                   # Layer 1: Network & Security
    │   └── npm/
    │       └── docker-compose.yml
    │
    ├── layer2-data/                  # Layer 2: Data Platform
    │   ├── postgres/
    │   │   └── docker-compose.yml
    │   ├── mariadb/
    │   │   └── docker-compose.yml
    │   ├── neo4j/
    │   │   └── docker-compose.yml
    │   ├── elasticsearch/
    │   │   └── docker-compose.yml
    │   ├── redis/
    │   │   └── docker-compose.yml
    │   ├── kafka/
    │   │   └── docker-compose.yml
    │   ├── rabbitmq/
    │   │   └── docker-compose.yml
    │   └── minio/
    │       └── docker-compose.yml
    │
    └── layer3-apps/                  # Layer 3: Application
        ├── blog/
        │   └── docker-compose.yml
        ├── plane/
        │   └── docker-compose.yml
        ├── nextcloud/
        │   └── docker-compose.yml
        └── backup/
            ├── docker-compose.yml
            ├── scripts/
            │   ├── dump_postgres.sh
            │   ├── dump_neo4j.sh
            │   └── run_borg.sh
            └── backup.env
```

### 4.1 `user_cli/` 운영 원칙

- 대상은 홈랩 서버가 아니라 운영자의 Ubuntu 24.04 워크스테이션 또는 노트북이다.
- 핵심 진입점은 `user_cli/init_ubuntu.sh` 이다.
- 이 스크립트는 현재 작업 디렉토리의 `.zshrc`, `.tmux.conf.local`을 홈 디렉토리로 복사하므로 반드시 `user_cli/` 디렉토리 안에서 실행한다.

```bash
cd ~/infra/user_cli
bash ./init_ubuntu.sh
```

- 설치 범위:
  - 기본 CLI 패키지 (`git`, `tmux`, `zsh`, `nodejs`, `npm`, `gh` 등)
  - `uv` 기반 Python CLI 도구 설치
  - AWS CLI v2 공식 바이너리 설치
  - `oh-my-zsh`, `zsh-autosuggestions`, `zsh-syntax-highlighting`, `starship`
  - tmux 설정 및 전역 git 사용자 설정

- 에이전트 작업 규칙:
  - 사용자가 로컬 CLI 환경 초기화, zsh/tmux 설정, 개발용 유틸리티 설치를 요청하면 `user_cli/`를 우선 확인한다.
  - 서버 프로비저닝 변경과 사용자 로컬 CLI 변경을 혼동하지 않는다.

---

## 5. 환경 변수 및 보안 설정

### 5.1 `.env.example` (템플릿)

```bash
# ===========================
# Network & Domain
# ===========================
CF_TUNNEL_TOKEN=<masked_tunnel_token>
CF_DOMAIN=<public_domain>

# ===========================
# Server Info
# ===========================
SERVER_IP=<server_private_ip>
LOCAL_GW=<room_router_wan_ip>      # H724G 공유기 IP (로컬 무제한 접근)

# ===========================
# SSH
# ===========================
SSH_PORT=<ssh_port>
SSH_USER=ubuntu

# ===========================
# PostgreSQL
# ===========================
POSTGRES_VERSION=16-alpine
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<masked_secret>
POSTGRES_DB=maindb

# ===========================
# Neo4j
# ===========================
NEO4J_VERSION=5.15-community
NEO4J_AUTH=neo4j/<masked_secret>

# ===========================
# Elasticsearch
# ===========================
ES_VERSION=8.12.0
ES_JAVA_OPTS=-Xms512m -Xmx512m
ELASTIC_PASSWORD=<masked_secret>

# ===========================
# Redis
# ===========================
REDIS_VERSION=7-alpine
REDIS_PASSWORD=<masked_secret>

# ===========================
# Kafka KRaft
# ===========================
KAFKA_VERSION=3.9.2
KAFKA_CLUSTER_ID=kafka-homelab-cluster

# ===========================
# Minio
# ===========================
MINIO_VERSION=RELEASE.2025-09-07T16-13-09Z
MINIO_ROOT_USER=<masked_access_key>
MINIO_ROOT_PASSWORD=<masked_secret>

# ===========================
# Nextcloud
# ===========================
NEXTCLOUD_VERSION=28-apache
NEXTCLOUD_ADMIN_USER=<admin_user>
NEXTCLOUD_ADMIN_PASSWORD=<masked_secret>

# ===========================
# Backup
# ===========================
BORG_PASSPHRASE=<masked_secret>
BORG_REPO=/mnt/archive/borg-repo
```

### 5.2 `.gitignore`

```gitignore
.env
*.pem
*.key
docker/layer1-ops/npm/data/
docker/layer2-data/*/data/
docker/layer3-apps/*/data/
system/authorized_keys
```

---

## 6. Layer 0: 시스템 기초 설정

### 6.1 `system/01_setup.sh` (기본 패키지 설치)

```bash
#!/bin/bash
set -euo pipefail

echo "[Layer 0] 시스템 기초 설정 시작"

# 패키지 업데이트
echo ">> apt 업데이트 및 업그레이드"
sudo apt update && sudo apt full-upgrade -y

# 필수 패키지 설치
echo ">> 필수 패키지 설치"
sudo apt install -y \
  curl wget git vim htop tmux \
  ufw fail2ban \
  ca-certificates gnupg lsb-release \
  zfsutils-linux \
  borgbackup

# Docker 설치
echo ">> Docker 설치"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker 설치 완료. 재로그인 필요."
else
  echo "Docker 이미 설치됨"
fi

# Docker Compose 설치 (v2 플러그인 방식)
echo ">> Docker Compose 설치"
sudo apt install -y docker-compose-plugin

# Nvidia Docker (선택 사항 - GPU 사용 시)
read -p "Nvidia GPU를 사용하시겠습니까? (y/n): " nvidia_choice
if [[ "$nvidia_choice" == "y" ]]; then
  echo ">> Nvidia Container Toolkit 설치"
  distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
    sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
  sudo apt update && sudo apt install -y nvidia-container-toolkit
  sudo systemctl restart docker
fi

# 자동 보안 업데이트
echo ">> Unattended Upgrades 설정"
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

# 타임존 설정
echo ">> 타임존 설정 (Asia/Seoul)"
sudo timedatectl set-timezone Asia/Seoul

echo "[Layer 0] 시스템 기초 설정 완료"
```

### 6.2 `system/02_zfs_archive.sh` (8TB HDD ZFS Mirror 구성)

```bash
#!/bin/bash
set -euo pipefail

echo "[Layer 0] ZFS Archive Storage 구성 시작"

# 디스크 ID 확인 (실제 환경에 맞게 수정 필요)
DISK1="/dev/disk/by-id/ata-HDD1_SERIAL"
DISK2="/dev/disk/by-id/ata-HDD2_SERIAL"

# 실제 디스크 경로 확인 메시지
echo "주의: 아래 명령어로 실제 디스크 ID를 확인하세요."
echo "  ls -l /dev/disk/by-id/"
echo ""
read -p "위 경로를 확인했습니까? 계속하려면 'yes'를 입력: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "중단됨. 디스크 ID를 확인 후 스크립트 내 DISK1, DISK2를 수정하세요."
  exit 1
fi

# ZFS Pool 생성 (mirror 구성)
echo ">> ZFS Pool 'archive' 생성 (mirror)"
sudo zpool create -f archive mirror "$DISK1" "$DISK2"

# 압축 활성화 (LZ4 - 빠른 압축)
echo ">> ZFS 압축 활성화 (lz4)"
sudo zfs set compression=lz4 archive

# 마운트 포인트 설정
echo ">> ZFS 마운트 포인트 설정"
sudo zfs set mountpoint=/mnt/archive archive

# 권한 설정
sudo chown -R "$USER:$USER" /mnt/archive

# 자동 스냅샷 설정 (zfs-auto-snapshot 설치)
echo ">> zfs-auto-snapshot 설치"
sudo apt install -y zfs-auto-snapshot

# 스냅샷 정책 설정 (빈번한=시간/일, 보관기간=주/월)
sudo zfs set com.sun:auto-snapshot=true archive
sudo zfs set com.sun:auto-snapshot:frequent=false archive  # 15분마다는 비활성
sudo zfs set com.sun:auto-snapshot:hourly=true archive     # 시간별 (24개 보관)
sudo zfs set com.sun:auto-snapshot:daily=true archive      # 일별 (7개 보관)
sudo zfs set com.sun:auto-snapshot:weekly=true archive     # 주별 (4개 보관)
sudo zfs set com.sun:auto-snapshot:monthly=true archive    # 월별 (12개 보관)

# ZFS 상태 확인
echo ">> ZFS Pool 상태"
sudo zpool status archive
sudo zfs list archive

echo "[Layer 0] ZFS Archive Storage 구성 완료"
echo "마운트: /mnt/archive (약 7.2TB 가용)"
```

### 6.3 `system/03_mount_primary.sh` (500GB SSD 보조 저장소 마운트)

```bash
#!/bin/bash
set -euo pipefail

echo "[Layer 0] Primary Storage (500GB SSD 보조 저장소) 마운트 시작"

# 디스크 확인 (실제 환경에 맞게 수정 - 500GB 보조 SSD)
DISK="/dev/disk/by-id/ata-Samsung_970_EVO_Plus_SERIAL"

echo "주의: 아래 명령어로 실제 500GB SSD 디스크 ID를 확인하세요."
echo "  ls -l /dev/disk/by-id/ | grep -i samsung"
echo ""
read -p "디스크 경로를 확인했습니까? 계속하려면 'yes' 입력: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "중단됨."
  exit 1
fi

# 파티션 생성 (전체 디스크 사용)
echo ">> 파티션 생성"
sudo parted -s "$DISK" mklabel gpt
sudo parted -s "$DISK" mkpart primary ext4 0% 100%

# 파티션 경로
PARTITION="${DISK}-part1"

# 파일시스템 포맷 (ext4)
echo ">> ext4 파일시스템 포맷"
sudo mkfs.ext4 -F "$PARTITION"

# 마운트 포인트 생성
sudo mkdir -p /mnt/primary

# UUID 확인
UUID=$(sudo blkid -s UUID -o value "$PARTITION")
echo ">> UUID: $UUID"

# /etc/fstab에 자동 마운트 추가
echo ">> /etc/fstab 업데이트"
echo "UUID=$UUID /mnt/primary ext4 defaults,noatime 0 2" | sudo tee -a /etc/fstab

# 마운트
sudo mount -a

# 권한 설정
sudo chown -R "$USER:$USER" /mnt/primary

# 디렉토리 구조 생성
mkdir -p /mnt/primary/{postgres,neo4j,elasticsearch,kafka,redis,dumps}

echo "[Layer 0] Primary Storage 마운트 완료"
echo "마운트: /mnt/primary (약 450GB 가용)"
df -h /mnt/primary
```

### 6.4 `system/sshd_config` (SSH 보안 설정)

```sshd_config
# SSH 포트 변경 (기본 <initial_ssh_port> → <ssh_port>)
Port <ssh_port>

# IPv4만 사용
AddressFamily inet
Protocol 2

# 인증 설정
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
ChallengeResponseAuthentication no

# 보안 강화
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2

# 로깅
SyslogFacility AUTH
LogLevel VERBOSE

# 특정 사용자만 허용 (선택 사항)
# AllowUsers ubuntu
```

**적용 방법**:
```bash
sudo cp system/sshd_config /etc/ssh/sshd_config
sudo systemctl restart ssh
```

**주의**: SSH 설정 적용 전에 반드시 PEM 키를 서버에 등록하세요.

```bash
# 클라이언트 PC에서 키 생성
ssh-keygen -t ed25519 -C "<ssh_key_comment>" -f ~/.ssh/<ssh_key_name>

# 서버에 공개키 복사 (초기에는 포트 <initial_ssh_port> 사용)
ssh-copy-id -p <initial_ssh_port> ubuntu@<server_private_ip>

# 설정 변경 후 새 포트로 접속 테스트
ssh -i ~/.ssh/<ssh_key_name> -p <ssh_port> ubuntu@<server_private_ip>
```

### 6.5 `system/ufw.sh` (방화벽 설정)

```bash
#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../.env"

echo "[Layer 0] UFW 방화벽 설정 시작"

# UFW 초기화
sudo ufw --force reset

# 기본 정책
sudo ufw default deny incoming
sudo ufw default allow outgoing

# H724G 공유기에서 오는 모든 트래픽 허용 (로컬망 기기 접근)
sudo ufw allow from "$LOCAL_GW" to any comment "H724G Router - Full Access"

# SSH 포트 허용 (로컬 서브넷에서만)
sudo ufw allow from <admin_subnet> to any port "$SSH_PORT" proto tcp comment "SSH from Local Subnet"

# Loopback 허용 (Docker 내부 통신)
sudo ufw allow in on lo comment "Loopback"

# UFW 활성화
sudo ufw --force enable

# 상태 확인
sudo ufw status verbose

echo "[Layer 0] UFW 방화벽 설정 완료"
```

### 6.6 `system/cloudflared_install.sh` (Cloudflare Tunnel 설치)

```bash
#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../.env"

echo "[Layer 1] Cloudflare Tunnel 설치 시작"

# cloudflared 설치
if ! command -v cloudflared &>/dev/null; then
  echo ">> cloudflared 설치"
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
    sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
    https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | \
    sudo tee /etc/apt/sources.list.d/cloudflared.list
  sudo apt update && sudo apt install -y cloudflared
else
  echo "cloudflared 이미 설치됨"
fi

# Tunnel 서비스 등록
echo ">> Cloudflare Tunnel 서비스 등록"
echo "주의: CF_TUNNEL_TOKEN을 .env 파일에 설정해야 합니다."
echo "토큰 발급: Cloudflare Zero Trust > Networks > Tunnels > Create Tunnel"

if [[ -z "$CF_TUNNEL_TOKEN" || "$CF_TUNNEL_TOKEN" == "<masked_tunnel_token>" ]]; then
  echo "오류: CF_TUNNEL_TOKEN이 설정되지 않았습니다."
  exit 1
fi

sudo cloudflared service install "$CF_TUNNEL_TOKEN"

# 서비스 시작
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# 상태 확인
sudo systemctl status cloudflared --no-pager

echo "[Layer 1] Cloudflare Tunnel 설치 완료"
```

**Cloudflare Tunnel 라우팅 설정 (대시보드에서)**:
1. Cloudflare Zero Trust > Networks > Tunnels > (생성한 터널 선택)
2. Public Hostname 추가:
   - `<ssh_subdomain>` → `tcp://localhost:<ssh_port>`
   - `*.<public_domain>` → `http://localhost:<npm_http_port>`
   - `<public_domain>` → `http://localhost:<npm_http_port>`

---

## 7. Layer 1: Network & Security

### 7.1 `docker/networks.sh` (Docker 네트워크 생성)

```bash
#!/bin/bash
set -euo pipefail

echo "[Docker] 네트워크 생성"

docker network create proxy-tier 2>/dev/null || echo "proxy-tier 이미 존재"
docker network create data-tier 2>/dev/null || echo "data-tier 이미 존재"

docker network ls | grep -E "proxy-tier|data-tier"

echo "[Docker] 네트워크 생성 완료"
```

### 7.2 `docker/layer1-ops/npm/docker-compose.yml` (Nginx Proxy Manager)

```yaml
services:
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:2.11.1
    container_name: npm
    restart: unless-stopped
    ports:
      - "<npm_http_port>:<npm_http_port>"        # HTTP (Cloudflare Tunnel 연결점)
      - "<npm_https_port>:<npm_https_port>"      # HTTPS
      - "<loopback_ip>:<npm_admin_port>:<npm_admin_port>"  # Admin UI (Loopback만 노출)
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    environment:
      DB_SQLITE_FILE: /data/database.sqlite
    networks:
      - proxy-tier
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:<npm_http_port>"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  proxy-tier:
    external: true
```

**NPM Admin 접속**:
- 로컬: `http://<server_private_ip>:<npm_admin_port>`
- 기본 계정: `<masked_default_admin_id>` / `<masked_default_admin_password>`
- 첫 로그인 후 비밀번호 변경 필수

---

## 8. Layer 2: Data Platform

### 8.1 `docker/layer2-data/postgres/docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /mnt/primary/postgres:/var/lib/postgresql/data
    networks:
      - data-tier
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    shm_size: 256mb

networks:
  data-tier:
    external: true
```

### 8.2 `docker/layer2-data/neo4j/docker-compose.yml`

```yaml
services:
  neo4j:
    image: neo4j:5.15-community
    container_name: neo4j
    restart: unless-stopped
    environment:
      NEO4J_AUTH: ${NEO4J_AUTH}
      NEO4J_server_memory_heap_initial__size: 512m
      NEO4J_server_memory_heap_max__size: 1G
      NEO4J_server_memory_pagecache_size: 512m
    volumes:
      - /mnt/primary/neo4j/data:/data
      - /mnt/primary/neo4j/logs:/logs
    networks:
      - data-tier
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "${NEO4J_AUTH#neo4j/}", "RETURN 1"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  data-tier:
    external: true
```

### 8.3 `docker/layer2-data/elasticsearch/docker-compose.yml`

```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    container_name: elasticsearch
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=${ES_JAVA_OPTS}
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
    volumes:
      - /mnt/primary/elasticsearch:/usr/share/elasticsearch/data
    networks:
      - data-tier
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536
    healthcheck:
      test: ["CMD-SHELL", "curl -s -u elastic:${ELASTIC_PASSWORD} http://localhost:<elasticsearch_port>/_cluster/health | grep -q '\"status\":\"green\\|yellow\"'"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  data-tier:
    external: true
```

### 8.4 `docker/layer2-data/redis/docker-compose.yml`

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - /mnt/primary/redis:/data
    networks:
      - data-tier
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  data-tier:
    external: true
```

### 8.5 `docker/layer2-data/kafka/docker-compose.yml` (KRaft 모드)

```yaml
services:
  kafka:
    image: apache/kafka:${KAFKA_VERSION}
    container_name: kafka
    restart: unless-stopped
    environment:
      CLUSTER_ID: ${KAFKA_CLUSTER_ID}
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:<kafka_controller_port>
      KAFKA_LISTENERS: PLAINTEXT://:<kafka_broker_port>,CONTROLLER://:<kafka_controller_port>
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:<kafka_broker_port>
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_LOG_DIRS: /var/lib/kafka/data
      KAFKA_HEAP_OPTS: "-Xms512m -Xmx1g"
    volumes:
      - /mnt/primary/kafka:/var/lib/kafka/data
    networks:
      - data-tier
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server 127.0.0.1:<kafka_broker_port> >/dev/null 2>&1"]
      interval: 30s
      timeout: 10s
      retries: 5

networks:
  data-tier:
    external: true
```

**Kafka 토픽 생성 예시**:
```bash
docker exec -it kafka kafka-topics.sh \
  --bootstrap-server localhost:<kafka_broker_port> \
  --create --topic events \
  --partitions 3 --replication-factor 1
```

### 8.6 `docker/layer2-data/minio/docker-compose.yml`

```yaml
services:
  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    container_name: minio
    restart: unless-stopped
    command: server /data --console-address ":<minio_console_port>"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - /mnt/archive/minio:/data
    networks:
      - data-tier
      - proxy-tier  # NPM을 통해 웹 콘솔 접근 가능
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:<minio_api_port>/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  data-tier:
    external: true
  proxy-tier:
    external: true
```

**NPM에서 Minio Console 연결**:
- Hostname: `<object_storage_subdomain>`
- Forward to: `minio:<minio_console_port>`

---

## 9. Layer 3: Application

### 9.1 `docker/layer3-apps/blog/docker-compose.yml` (WordPress)

```yaml
services:
  wordpress:
    image: wordpress:${WORDPRESS_VERSION}
    container_name: wordpress-blog
    restart: unless-stopped
    environment:
      WORDPRESS_DB_HOST: mariadb:3306
      WORDPRESS_DB_NAME: ${WORDPRESS_DB_NAME}
      WORDPRESS_DB_USER: ${WORDPRESS_DB_USER}
      WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD}
    volumes:
      - /mnt/archive/wordpress/html:/var/www/html
    networks:
      - proxy-tier
      - data-tier
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1/wp-json/"]
      interval: 30s
      timeout: 10s
      retries: 5

networks:
  proxy-tier:
    external: true
  data-tier:
    external: true
```

**NPM 프록시 설정**:
- Domain: `<blog_subdomain>`
- Forward to: `wordpress-blog:80`
- SSL: Let's Encrypt 자동 발급

### 9.2 `docker/layer3-apps/nextcloud/docker-compose.yml`

```yaml
services:
  nextcloud:
    image: nextcloud:28-apache
    container_name: nextcloud
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: nextcloud
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_HOST: redis
      REDIS_HOST_PASSWORD: ${REDIS_PASSWORD}
      NEXTCLOUD_ADMIN_USER: ${NEXTCLOUD_ADMIN_USER}
      NEXTCLOUD_ADMIN_PASSWORD: ${NEXTCLOUD_ADMIN_PASSWORD}
      NEXTCLOUD_TRUSTED_DOMAINS: <nas_subdomain> <server_private_ip>
      OVERWRITEPROTOCOL: https
    volumes:
      - ./html:/var/www/html
      - /mnt/archive/nextcloud:/var/www/html/data
    networks:
      - proxy-tier
      - data-tier
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:<nextcloud_http_port>/status.php"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  proxy-tier:
    external: true
  data-tier:
    external: true
```

**NPM 프록시 설정**:
- Domain: `<nas_subdomain>`
- Forward to: `nextcloud:<nextcloud_http_port>`
- SSL: Let's Encrypt

**DB 초기화**:
```bash
docker exec -it postgres psql -U postgres -c "CREATE DATABASE nextcloud;"
```

**Minio S3 Primary Storage 설정** (선택 사항):
Nextcloud Admin → Settings → External Storage → Add Storage (Amazon S3)
- Bucket: `nextcloud`
- Host: `minio:<minio_api_port>`
- Access Key: `<masked_access_key>`
- Secret Key: `<masked_secret>`

---

## 10. 백업 파이프라인

### 10.1 `docker/layer3-apps/backup/docker-compose.yml`

```yaml
services:
  backup:
    image: alpine:3.19
    container_name: backup-pipeline
    restart: unless-stopped
    entrypoint: crond -f -l 2
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      NEO4J_HOST: neo4j
      NEO4J_AUTH: ${NEO4J_AUTH}
      BORG_PASSPHRASE: ${BORG_PASSPHRASE}
      BORG_REPO: ${BORG_REPO}
    volumes:
      - ./scripts:/scripts:ro
      - ./crontab:/etc/crontabs/root:ro
      - /mnt/primary/dumps:/dumps
      - /mnt/archive/borg-repo:/borg-repo
    networks:
      - data-tier
    depends_on:
      - postgres
      - neo4j

networks:
  data-tier:
    external: true
```

### 10.2 `docker/layer3-apps/backup/crontab`

```cron
# 매일 새벽 3시: PostgreSQL 덤프
0 3 * * * /scripts/dump_postgres.sh >> /dumps/cron.log 2>&1

# 매일 새벽 3시 10분: Neo4j 덤프
10 3 * * * /scripts/dump_neo4j.sh >> /dumps/cron.log 2>&1

# 매일 새벽 3시 30분: BorgBackup 실행
30 3 * * * /scripts/run_borg.sh >> /dumps/cron.log 2>&1

# 매주 일요일 새벽 4시: 오래된 덤프 파일 삭제 (30일 이상)
0 4 * * 0 find /dumps -name "*.sql" -mtime +30 -delete
```

### 10.3 `docker/layer3-apps/backup/scripts/dump_postgres.sh`

```bash
#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/dumps/postgres_${TIMESTAMP}.sql"

echo "[$(date)] PostgreSQL 덤프 시작"

# pg_dumpall 사용 (모든 데이터베이스 덤프)
PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  > "$DUMP_FILE"

# 압축
gzip "$DUMP_FILE"

echo "[$(date)] PostgreSQL 덤프 완료: ${DUMP_FILE}.gz"
```

### 10.4 `docker/layer3-apps/backup/scripts/dump_neo4j.sh`

```bash
#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/dumps/neo4j_${TIMESTAMP}.dump"

echo "[$(date)] Neo4j 덤프 시작"

# Neo4j Admin Dump (컨테이너 내부 실행 필요)
docker exec neo4j neo4j-admin database dump neo4j \
  --to-path=/dumps \
  --overwrite-destination=true

# 파일명 변경
mv /dumps/neo4j.dump "$DUMP_FILE"

# 압축
gzip "$DUMP_FILE"

echo "[$(date)] Neo4j 덤프 완료: ${DUMP_FILE}.gz"
```

### 10.5 `docker/layer3-apps/backup/scripts/run_borg.sh`

```bash
#!/bin/sh
set -e

REPO="$BORG_REPO"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)

echo "[$(date)] BorgBackup 시작"

# Borg Repository 초기화 (최초 1회만 필요)
if [ ! -d "$REPO" ]; then
  echo "Borg Repository 초기화"
  borg init --encryption=repokey "$REPO"
fi

# 백업 실행 (DB 덤프 파일들)
borg create \
  --stats \
  --compression lz4 \
  "$REPO::backup-${TIMESTAMP}" \
  /dumps

# 오래된 백업 정리 (30일 이상 보관, 최근 7일 전체 보관)
borg prune \
  --keep-daily=7 \
  --keep-weekly=4 \
  --keep-monthly=6 \
  "$REPO"

echo "[$(date)] BorgBackup 완료"
```

### 10.6 Dockerfile (Backup 컨테이너용)

`docker/layer3-apps/backup/Dockerfile`:

```dockerfile
FROM alpine:3.19

# PostgreSQL 클라이언트, BorgBackup, 기타 유틸리티 설치
RUN apk add --no-cache \
    postgresql-client \
    borgbackup \
    gzip \
    curl \
    dcron

# 스크립트 실행 권한
COPY scripts /scripts
RUN chmod +x /scripts/*.sh

# Crontab 설정
COPY crontab /etc/crontabs/root

CMD ["crond", "-f", "-l", "2"]
```

빌드 및 실행:
```bash
cd docker/layer3-apps/backup
docker build -t backup-alpine .
# docker-compose.yml의 image를 backup-alpine로 변경
```

---

## 11. Makefile 통합 관리

### `Makefile` (루트 디렉토리)

```makefile
include .env
export

.PHONY: help system storage network ops data apps backup status logs clean

help:
	@echo "===== Homelab Infra Management ====="
	@echo "make system    - Layer 0: 시스템 기초 설정"
	@echo "make storage   - Layer 0: 스토리지 마운트 (ZFS + Primary)"
	@echo "make network   - Docker 네트워크 생성"
	@echo "make ops       - Layer 1: Nginx Proxy Manager"
	@echo "make data      - Layer 2: 데이터 플랫폼 전체 실행"
	@echo "make apps      - Layer 3: 애플리케이션 전체 실행"
	@echo "make backup    - Layer 3: 백업 파이프라인 실행"
	@echo "make status    - 전체 서비스 상태 확인"
	@echo "make logs name=<service> - 특정 서비스 로그"
	@echo "make clean     - 모든 컨테이너 중단"

# Layer 0: System
system:
	@echo "==> [Layer 0] 시스템 기초 설정"
	bash system/01_setup.sh

storage:
	@echo "==> [Layer 0] 스토리지 마운트"
	bash system/02_zfs_archive.sh
	bash system/03_mount_primary.sh

ssh:
	@echo "==> [Layer 0] SSH 설정 적용"
	sudo cp system/sshd_config /etc/ssh/sshd_config
	sudo systemctl restart ssh
	@echo "SSH Port: $(SSH_PORT)"

ufw:
	@echo "==> [Layer 0] UFW 방화벽 설정"
	sudo bash system/ufw.sh

cloudflared:
	@echo "==> [Layer 1] Cloudflare Tunnel 설치"
	bash system/cloudflared_install.sh

# Docker Networks
network:
	@echo "==> Docker 네트워크 생성"
	bash docker/networks.sh

# Layer 1: Ops
ops: network
	@echo "==> [Layer 1] Nginx Proxy Manager 실행"
	docker compose -f docker/layer1-ops/npm/docker-compose.yml --env-file .env up -d

# Layer 2: Data Platform
data: network
	@echo "==> [Layer 2] 데이터 플랫폼 실행"
	docker compose -f docker/layer2-data/postgres/docker-compose.yml --env-file .env up -d
	docker compose -f docker/layer2-data/neo4j/docker-compose.yml --env-file .env up -d
	docker compose -f docker/layer2-data/elasticsearch/docker-compose.yml --env-file .env up -d
	docker compose -f docker/layer2-data/redis/docker-compose.yml --env-file .env up -d
	docker compose -f docker/layer2-data/kafka/docker-compose.yml --env-file .env up -d
	docker compose -f docker/layer2-data/minio/docker-compose.yml --env-file .env up -d

# Layer 3: Application
apps: network
	@echo "==> [Layer 3] 애플리케이션 실행"
	docker compose -f docker/layer3-apps/content/docker-compose.yml --env-file .env up -d
	docker compose -f docker/layer3-apps/nextcloud/docker-compose.yml --env-file .env up -d

backup: network
	@echo "==> [Layer 3] 백업 파이프라인 실행"
	docker compose -f docker/layer3-apps/backup/docker-compose.yml --env-file .env up -d

# Status & Logs
status:
	@echo "=== UFW Status ==="
	sudo ufw status verbose
	@echo "\n=== Docker Networks ==="
	docker network ls | grep -E "proxy-tier|data-tier"
	@echo "\n=== Running Containers ==="
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo "\n=== ZFS Pool Status ==="
	sudo zpool status archive
	@echo "\n=== Storage Usage ==="
	df -h /mnt/primary /mnt/archive

logs:
	@if [ -z "$(name)" ]; then \
		echo "사용법: make logs name=<container_name>"; \
		exit 1; \
	fi
	docker logs -f $(name)

# Cleanup
clean:
	@echo "==> 모든 컨테이너 중단"
	docker compose -f docker/layer3-apps/backup/docker-compose.yml down
	docker compose -f docker/layer3-apps/nextcloud/docker-compose.yml down
	docker compose -f docker/layer3-apps/content/docker-compose.yml down
	docker compose -f docker/layer2-data/minio/docker-compose.yml down
	docker compose -f docker/layer2-data/kafka/docker-compose.yml down
	docker compose -f docker/layer2-data/redis/docker-compose.yml down
	docker compose -f docker/layer2-data/elasticsearch/docker-compose.yml down
	docker compose -f docker/layer2-data/neo4j/docker-compose.yml down
	docker compose -f docker/layer2-data/postgres/docker-compose.yml down
	docker compose -f docker/layer1-ops/npm/docker-compose.yml down
```

---

## 12. 배포 실행 순서

### 12.1 최초 구축 시 (순차 실행)

```bash
# 1. 환경 변수 설정
cd ~/infra
cp .env.example .env
vim .env  # 실제 값으로 변경 (비밀번호, 토큰 등)

# 2. Layer 0: 시스템 기초
make system
# 재로그인 (Docker 그룹 적용)
newgrp docker

# 3. Layer 0: 스토리지 마운트
make storage
# 주의: 디스크 ID를 실제 환경에 맞게 스크립트 수정 필요

# 4. Layer 0: SSH 키 등록 (클라이언트에서)
ssh-keygen -t ed25519 -C "<ssh_key_comment>" -f ~/.ssh/<ssh_key_name>
ssh-copy-id -p <initial_ssh_port> ubuntu@<server_private_ip>

# 5. Layer 0: SSH 설정 적용 (서버에서)
make ssh

# 6. Layer 0: 방화벽 설정
make ufw

# 7. Layer 1: Cloudflare Tunnel 설치
# .env에 CF_TUNNEL_TOKEN 설정 후
make cloudflared

# 8. Docker 네트워크 생성
make network

# 9. Layer 1: Nginx Proxy Manager
make ops

# 10. Layer 2: 데이터 플랫폼
make data

# 11. DB 초기화
docker exec -it postgres psql -U postgres -c "CREATE DATABASE plane;"
docker exec -it postgres psql -U postgres -c "CREATE DATABASE nextcloud;"

# 12. Layer 3: 애플리케이션
make apps

# 13. Layer 3: 백업 파이프라인
make backup

# 14. 상태 확인
make status
```

### 12.2 서비스별 개별 배포

특정 앱만 재시작:
```bash
# 블로그 재배포
docker compose -f docker/layer3-apps/blog/docker-compose.yml down
docker compose -f docker/layer3-apps/blog/docker-compose.yml --env-file .env up -d

# 또는 Makefile 사용
make app name=blog
```

### 12.3 NPM 프록시 호스트 설정

1. NPM Admin UI 접속: `http://<server_private_ip>:<npm_admin_port>`
2. Proxy Hosts → Add Proxy Host
3. 예시 (WordPress 블로그):
   - **Domain Names**: `<blog_subdomain>`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `wordpress-blog`
   - **Forward Port**: `80`
   - **Cache Assets**: ✓
   - **Block Common Exploits**: ✓
   - **SSL 탭**: Request a new SSL Certificate (Let's Encrypt)

4. Nextcloud도 동일하게:
   - Domain: `<nas_subdomain>`
   - Forward to: `nextcloud:<nextcloud_http_port>`

---

## 부록 A: 자주 사용하는 명령어

### Docker 관리
```bash
# 전체 컨테이너 상태
docker ps -a

# 특정 컨테이너 로그
docker logs -f <container_name>

# 컨테이너 내부 접속
docker exec -it <container_name> /bin/bash

# PostgreSQL 접속
docker exec -it postgres psql -U postgres

# Redis 접속
docker exec -it redis redis-cli -a <password>

# Kafka 토픽 리스트
docker exec -it kafka kafka-topics.sh --bootstrap-server localhost:<kafka_broker_port> --list
```

### ZFS 관리
```bash
# Pool 상태
sudo zpool status

# 스냅샷 목록
sudo zfs list -t snapshot

# 수동 스냅샷 생성
sudo zfs snapshot archive@manual-$(date +%Y%m%d-%H%M)

# 스냅샷 롤백
sudo zfs rollback archive@<snapshot_name>

# 스냅샷 삭제
sudo zfs destroy archive@<snapshot_name>
```

### BorgBackup 관리
```bash
# Borg Repo 목록
borg list /mnt/archive/borg-repo

# 특정 백업 내용 확인
borg list /mnt/archive/borg-repo::backup-2026-03-10_03-30

# 파일 복원
borg extract /mnt/archive/borg-repo::backup-2026-03-10_03-30 /dumps/postgres_20260310.sql.gz
```

---

## 부록 B: 보안 체크리스트

- [ ] `.env` 파일의 모든 기본 비밀번호 변경
- [ ] SSH 포트 <ssh_port>로 변경 및 PEM 키 인증 설정
- [ ] UFW 방화벽 활성화 (H724G 허용 규칙 확인)
- [ ] NPM Admin 계정 비밀번호 변경
- [ ] PostgreSQL, Redis, Elasticsearch 등 모든 DB 비밀번호 강력하게 설정
- [ ] Cloudflare Access 정책 설정 (<ssh_subdomain> 접근 제한)
- [ ] fail2ban 설정 확인 (`sudo systemctl status fail2ban`)
- [ ] 자동 보안 업데이트 활성화 확인
- [ ] ZFS 스냅샷 정책 확인 (`sudo zfs get com.sun:auto-snapshot archive`)
- [ ] BorgBackup Repository 암호화 확인

---

## 부록 C: 트러블슈팅

### 문제: Docker 컨테이너가 시작되지 않음
```bash
# 로그 확인
docker logs <container_name>

# 네트워크 확인
docker network ls
docker network inspect data-tier
```

### 문제: NPM이 백엔드 컨테이너를 찾지 못함
- 컨테이너가 `proxy-tier` 네트워크에 연결되어 있는지 확인
- `docker-compose.yml`에서 `networks` 섹션 확인
- NPM 재시작: `docker restart npm`

### 문제: ZFS Pool을 찾을 수 없음
```bash
# ZFS 모듈 로드 확인
lsmod | grep zfs

# Pool 임포트
sudo zpool import archive
```

### 문제: Cloudflare Tunnel 연결 실패
```bash
# 서비스 상태 확인
sudo systemctl status cloudflared

# 토큰 재등록
sudo cloudflared service uninstall
sudo cloudflared service install <NEW_TOKEN>
```

---

**이 문서는 오프라인 환경에서 코딩 에이전트가 검색 없이 바로 구현 가능하도록 작성된 최종 청사진입니다.**
