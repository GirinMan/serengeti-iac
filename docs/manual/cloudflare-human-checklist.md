# Cloudflare Human Checklist

사람이 직접 해야 하는 작업만 모아둔 체크리스트다.

## 1. Domain

- Cloudflare에 `<public_domain>` 등록
- 네임서버 위임 완료 확인

## 2. Zero Trust Tunnel

- Cloudflare Zero Trust에서 새 Tunnel 생성
- 발급된 토큰을 로컬 `.env`의 `CF_TUNNEL_TOKEN`에 입력
- 서버에서 `bash system/cloudflared_install.sh` 또는 동등 절차로 서비스 등록

## 3. Public Hostnames

- `<ssh_subdomain>` -> `tcp://localhost:${SSH_PORT}`
- `<public_domain>` -> `http://localhost:${NPM_HTTP_PORT}`
- `*.${CF_DOMAIN}` -> `http://localhost:${NPM_HTTP_PORT}`

## 4. Access Policy

- SSH용 Access 정책 생성
- 관리자 이메일 또는 IdP 그룹만 허용

## 5. DNS / Validation

- Cloudflare 대시보드에서 hostname 상태가 Healthy인지 확인
- 외부 네트워크에서 SSH Access와 웹 라우팅이 기대대로 동작하는지 확인
