# SSH Client Setup (via Cloudflare Tunnel)

서버에 직접 포트포워딩이 불가하므로 Cloudflare Tunnel을 통해 SSH 접속한다.
클라이언트에 `cloudflared`가 필요하다.

## 1. 클라이언트에 cloudflared 설치

```bash
# macOS
brew install cloudflared

# Ubuntu / Debian
curl -fsSL https://pkg.cloudflare.com/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# Windows (scoop)
scoop install cloudflared
```

데몬 등록이나 로그인은 필요 없다. 바이너리만 있으면 된다.

## 2. SSH config 설정

`~/.ssh/config`에 추가:

```
Host homelab
    HostName <ssh_subdomain>
    User <ssh_user>
    Port <ssh_port>
    IdentityFile ~/.ssh/<key_file>
    ProxyCommand cloudflared access ssh --hostname %h
```

## 3. 접속

```bash
ssh homelab
```

## 4. 사전 조건 (서버 측)

- `cloudflared` 서비스 실행 중 (`systemctl status cloudflared`)
- Cloudflare Dashboard에서 SSH Public Hostname 등록 완료
  - Subdomain: `<ssh_subdomain>`
  - Type: `SSH`
  - URL: `ssh://localhost:<ssh_port>`
- `sshd` 실행 중, PEM 키 인증만 허용 (PasswordAuthentication no)
- 클라이언트 공개키가 서버 `~/.ssh/authorized_keys`에 등록됨

## 5. 트러블슈팅

- `connection refused`: cloudflared 서비스 또는 sshd가 중지됨
- `permission denied`: SSH 키가 서버에 등록되지 않음
- `timeout`: Cloudflare Dashboard에서 SSH hostname이 설정되지 않음
- `cloudflared: command not found`: 클라이언트에 cloudflared 미설치
