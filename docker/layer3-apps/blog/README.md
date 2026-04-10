# Portfolio Website Service

개인 포트폴리오 웹사이트를 Astro로 빌드하고 nginx로 서빙합니다.

- **URL**: `https://blog.giraffe.ai.kr`
- **소스**: `girinman-career/website` 에서 복사
- **프레임워크**: Astro 6.x + Tailwind CSS v4
- **Node 요구사항**: >= 22.12.0

## 디렉토리 구조

```
blog/
├── docker-compose.yml    # Nginx 컨테이너 정의
├── nginx.conf            # Nginx 설정 (캐싱, 라우팅)
├── build.sh              # 빌드 및 배포 스크립트
└── src/                  # Astro 소스 코드
    ├── astro.config.mjs
    ├── package.json
    └── src/              # 컴포넌트, 페이지, 콘텐츠
```

## 빌드 및 배포

```bash
cd docker/layer3-apps/blog
bash build.sh
```

빌드 스크립트는 다음을 수행합니다:
1. `npm install` (필요시) → `npm run build` → `dist/` 생성
2. `dist/`를 `/mnt/archive/astro-blog/dist`로 복사
3. `astro-blog` 컨테이너 재시작

## 로컬 개발

```bash
cd docker/layer3-apps/blog/src
npm install
npm run dev
# http://localhost:4321 접속
```

## Docker 컨테이너 실행

```bash
make apps
# 또는 개별 실행
docker compose -f docker/layer3-apps/blog/docker-compose.yml up -d
```

## NPM 프록시 설정

Nginx Proxy Manager에서:
- **Domain**: `blog.giraffe.ai.kr`
- **Forward to**: `astro-blog:80`
- **SSL**: Let's Encrypt 자동 발급
- **Cache Assets**: enabled

## 장점

- **Zero Database**: DB 없이 정적 파일만으로 동작
- **빠른 성능**: CDN 수준의 정적 HTML 서빙
- **간단한 백업**: `/mnt/archive/astro-blog/dist` 디렉토리만 백업
- **낮은 자원 사용**: nginx 컨테이너 하나로 충분
