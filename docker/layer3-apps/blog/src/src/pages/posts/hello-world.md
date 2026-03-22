---
layout: ../../layouts/Post.astro
title: "Hello World"
description: "giraffe.ai.kr 블로그의 첫 번째 포스트"
pubDate: "2026-03-23"
tags: ["homelab", "astro"]
---

giraffe.ai.kr 홈랩 블로그에 오신 것을 환영합니다.

## 인프라 구성

이 블로그는 다음 스택으로 운영됩니다:

- **Astro** — 정적 사이트 생성기
- **nginx** — 정적 파일 서빙
- **Cloudflare Tunnel** — NAT 우회 외부 접근
- **Nginx Proxy Manager** — 리버스 프록시

## 홈랩 서비스

현재 운영 중인 서비스:

- **Plane** — 프로젝트 관리 (`todo.giraffe.ai.kr`)
- **Nextcloud** — 파일 스토리지 (`nas.giraffe.ai.kr`)
- **Minio** — 오브젝트 스토리지 (`minio.giraffe.ai.kr`)

모든 인프라는 IaC(Infrastructure as Code)로 관리됩니다.
