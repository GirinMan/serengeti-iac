# Astro Blog Service

정적 사이트 생성기 Astro로 생성된 블로그를 nginx로 서빙합니다.

## 디렉토리 구조

```
blog/
├── docker-compose.yml    # Nginx 컨테이너 정의
├── nginx.conf            # Nginx 설정 (캐싱, 라우팅)
├── build.sh              # Astro 빌드 스크립트
└── src/                  # Astro 소스 코드 (별도 관리)
```

## 빌드 및 배포 워크플로우

### 1. Astro 프로젝트 초기화 (최초 1회)

```bash
# blog/src 디렉토리에서
npm create astro@latest .
npm install
```

### 2. 로컬 개발

```bash
cd docker/layer3-apps/blog/src
npm run dev
# http://localhost:4321 접속
```

### 3. 빌드 및 배포

```bash
cd docker/layer3-apps/blog
bash build.sh
```

빌드 스크립트는 다음을 수행합니다:
1. `npm run build` → `dist/` 생성
2. `dist/`를 `/mnt/archive/astro-blog/dist`로 복사
3. nginx 컨테이너 재시작

### 4. Docker 컨테이너 실행

```bash
# 루트 디렉토리에서
make apps
# 또는 개별 실행
docker compose -f docker/layer3-apps/blog/docker-compose.yml up -d
```

## NPM 프록시 설정

Nginx Proxy Manager에서:
- **Domain**: `<blog_subdomain>`
- **Forward to**: `astro-blog:80`
- **SSL**: Let's Encrypt 자동 발급
- **Cache Assets**: ✓
- **Block Common Exploits**: ✓

## 자동 배포 (CI/CD)

GitHub Actions 예시:

```yaml
name: Deploy Astro Blog

on:
  push:
    branches: [main]
    paths:
      - 'docker/layer3-apps/blog/src/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build Astro
        run: |
          cd docker/layer3-apps/blog/src
          npm ci
          npm run build

      - name: Deploy to server
        run: |
          rsync -avz --delete docker/layer3-apps/blog/src/dist/ \
            user@server:/mnt/archive/astro-blog/dist/

      - name: Restart container
        run: |
          ssh user@server 'docker restart astro-blog'
```

## 장점

- **Zero Database**: DB 없이 정적 파일만으로 동작
- **빠른 성능**: CDN 수준의 정적 HTML 서빙
- **간단한 백업**: `/mnt/archive/astro-blog/dist` 디렉토리만 백업
- **보안**: 서버 사이드 공격 벡터 없음
- **낮은 자원 사용**: nginx 컨테이너 하나로 충분

## 콘텐츠 작성

```bash
cd docker/layer3-apps/blog/src/src/content/posts
# Markdown 파일 생성
vim my-first-post.md
```

Frontmatter 예시:
```yaml
---
title: "첫 포스트"
description: "Astro로 만든 블로그의 첫 글"
pubDate: 2026-03-22
author: "Your Name"
tags: ["astro", "blog"]
---

여기에 본문 작성...
```

빌드 후 배포:
```bash
bash build.sh
```
