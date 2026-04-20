# user_cli — 운영자 개인 CLI 부트스트랩

이 디렉토리는 홈랩 서버 IaC(`system/`, `docker/`) 와 별개로, 운영자 개인 워크스테이션의
쉘/터미널 환경을 맞추기 위한 스크립트만 모아둔다.

## 구조

```
user_cli/
├── README.md
├── .tmux.conf.local        # 공용 (gpakosz/.tmux 의 local override)
├── ubuntu/
│   ├── .zshrc              # oh-my-zsh + starship prompt
│   └── init_ubuntu.sh      # Ubuntu 24.04 LTS 기준 부트스트랩
└── mac/
    ├── .zshrc              # macOS 기준: Homebrew/uv/bun/cmux 연동
    └── dot_mac.sh          # macOS (Apple Silicon) 부트스트랩
```

## 사용법

Ubuntu 24.04 LTS

```bash
cd user_cli/ubuntu
./init_ubuntu.sh
```

macOS (Apple Silicon)

```bash
cd user_cli/mac
./dot_mac.sh
```

두 스크립트 모두 멱등적으로 동작한다 — brew/oh-my-zsh/tmux plugin 등은 이미 있으면 스킵한다.

## secret 자산은 git 에 올리지 않는다

`~/.ssh/config`, `id_rsa`, 각 repo 의 `.env` 등은 public IaC 저장소에 포함하지 않고
별도의 암호화된 zip(또는 private secret repo)로 관리한다. 상세: `docs/SECRET-REPO-SETUP.md`.
