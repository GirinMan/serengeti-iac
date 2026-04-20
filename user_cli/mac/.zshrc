# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation. macOS 표준 홈 디렉토리.
export ZSH="$HOME/.oh-my-zsh"

# Theme (ubuntu 는 starship prompt 를 쓰지만 mac 은 oh-my-zsh 테마를 기본으로 둔다)
ZSH_THEME="spaceship"

plugins=(
    git
    tmux
    python
    zsh-syntax-highlighting
    zsh-autosuggestions
    docker
    docker-compose
    kubectl
    poetry
)

source $ZSH/oh-my-zsh.sh

# Locale
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export PYTHONIOENCODING=UTF-8

# Prefer Homebrew-managed Python and tools over Conda/system defaults. (Apple Silicon)
if [ -d /opt/homebrew/bin ]; then
    export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
fi
if [ -d /opt/homebrew/opt/python@3.13/libexec/bin ]; then
    export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"
fi

# uv (python package manager)
[ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"

# Google Cloud SDK — 로컬 설치 경로에 따라 아래 경로를 조정한다.
# 설치 위치가 없으면 조용히 건너뛴다.
if [ -f "$HOME/Downloads/google-cloud-sdk/path.zsh.inc" ]; then
    . "$HOME/Downloads/google-cloud-sdk/path.zsh.inc"
fi
if [ -f "$HOME/Downloads/google-cloud-sdk/completion.zsh.inc" ]; then
    . "$HOME/Downloads/google-cloud-sdk/completion.zsh.inc"
fi

# Conda (Anaconda) — 설치되어 있을 때만 활성화
if [ -d "$HOME/anaconda3" ]; then
    __conda_setup="$("$HOME/anaconda3/bin/conda" 'shell.zsh' 'hook' 2> /dev/null)"
    if [ $? -eq 0 ]; then
        eval "$__conda_setup"
    else
        if [ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
            . "$HOME/anaconda3/etc/profile.d/conda.sh"
        else
            export PATH="$HOME/anaconda3/bin:$PATH"
        fi
    fi
    unset __conda_setup
fi

# starship prompt (설치되어 있을 때만)
if command -v starship >/dev/null 2>&1; then
    eval "$(starship init zsh)"
fi

# --- CLI 에이전트 기본 옵션 ---------------------------------------------------
alias codex='codex --yolo'

# cmux 워크스페이스 내부에서는 claude-teams 진입점을 사용, 그 외에는 기본 claude.
# cmux 가 설치돼 있지 않은 환경에서는 두 번째 분기만 적용된다.
if [[ -n "$CMUX_WORKSPACE_ID" ]]; then
    alias claude='cmux claude-teams --dangerously-skip-permissions'
else
    alias claude='claude --dangerously-skip-permissions'
fi

# --- 개인 alias (IP/도메인은 .ssh/config 로 빼서 관리, 예시는 placeholder) ---
# alias ssh-homelab="ssh -o ProxyCommand=none -o HostName=<HOMELAB-LAN-IP> homelab"
# alias ssh-local="$HOME/bin/homelab-direct.sh"

# 로컬 전용 override 가 필요하면 아래 파일을 작성해두면 자동 로드 (git 추적 X).
[ -f "$HOME/.zshrc.local" ] && source "$HOME/.zshrc.local"
