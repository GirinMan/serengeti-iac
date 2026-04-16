# Portfolio Website Service

개인 포트폴리오 웹사이트를 Astro로 빌드하고 nginx로 서빙한다.
소스와 Dockerfile 은 별도 리포로 분리되어 있고, IaC 는 Harbor 에 푸시된
컨테이너 이미지를 끌어다 띄우기만 한다.

- **URL**: `https://blog.giraffe.ai.kr`
- **소스 리포**: `github.com/GirinMan/girinman-career` 의 `website/`
- **이미지**: `harbor.giraffe.ai.kr/girinman/astro-blog:<git-sha>`
- **프레임워크**: Astro 6.x + Tailwind CSS v4 (빌드 시점 결정)

## 배포 흐름 (end-to-end)

1. `girinman-career` `website/**` 변경 → `.github/workflows/build-blog.yml` 가
   Harbor 에 `:<sha>` 태그로 push.
2. 빌드 성공 직후 `peter-evans/repository-dispatch@v3` 가
   `serengeti-iac` 로 `deploy-blog` 이벤트를 쏜다 (`client-payload.tag` 포함).
3. `serengeti-iac/.github/workflows/deploy-apps.yml` 이 self-hosted runner
   (`gha-runner-iac`) 에서 실행 → `.env` 의 `BLOG_IMAGE_TAG` 을 새 sha 로
   `sed -i` 하고 `make blog` 실행.
4. `make blog` → `harbor-login` → `docker compose pull && up -d` 로
   `astro-blog` 컨테이너가 새 이미지로 재기동된다.

## 수동 배포

특정 sha 를 먼저 배포하고 싶다면:

```bash
# .env 의 BLOG_IMAGE_TAG 를 원하는 sha 로 직접 편집 후
make blog
```

혹은 GitHub Actions 에서 `Deploy Apps` workflow 를 `workflow_dispatch`
로 돌리고 `app=blog`, `tag=<sha>` 입력.

## NPM 프록시 설정

Nginx Proxy Manager 에서 관리:
- **Domain**: `blog.giraffe.ai.kr`
- **Forward to**: `astro-blog:80`
- **SSL**: Let's Encrypt 자동 발급
- **Cache Assets**: enabled

## Healthcheck 주의사항

컨테이너 내부 `wget` 이 `localhost` 를 IPv6(::1) 로 먼저 해석해
`connection refused` 로 실패하는 이슈가 있어 healthcheck 는
`http://127.0.0.1/` 로 고정한다. compose 파일 수정 시 주의.
