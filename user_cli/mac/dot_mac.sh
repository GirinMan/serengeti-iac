#!/usr/bin/env bash
set -euo pipefail

# macOS (Apple Silicon 기준) CLI 환경 부트스트랩.
# - Homebrew, CLI 툴 설치 (이미 있으면 skip)
# - oh-my-zsh + 플러그인 + starship
# - gpakosz/.tmux
# - user_cli/mac/.zshrc 와 user_cli/.tmux.conf.local 를 $HOME 에 배포
# - Claude Code experimental agent teams (cmux) 활성 설정
#
# 이 스크립트는 user_cli/mac/ 아래에 위치한다고 가정한다.

echo "🍎 macOS CLI bootstrap 시작"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_CLI_DIR="$(dirname "$SCRIPT_DIR")"

# ---- 0. Xcode Command Line Tools ------------------------------------------
if ! xcode-select -p >/dev/null 2>&1; then
    echo "▶ Xcode CLT 설치 (GUI 팝업 뜨면 수락)"
    xcode-select --install || true
else
    echo "✓ Xcode CLT already present"
fi

# ---- 1. Homebrew -----------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
    echo "▶ Homebrew 설치"
    NONINTERACTIVE=1 /bin/bash -c \
        "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✓ brew 이미 설치됨 ($(brew --version | head -n1))"
fi

# PATH 주입 (Apple Silicon 기본 경로)
if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

# ---- 2. Homebrew 패키지 (이미 있으면 brew install 은 no-op 에 가깝다) -----
BREW_PACKAGES=(
    git
    git-lfs
    gh
    tmux
    zsh
    tree
    wget
    jq
    starship
    uv
    awscli
    cloudflared
    nvm
)

echo "▶ brew packages ensure: ${BREW_PACKAGES[*]}"
for pkg in "${BREW_PACKAGES[@]}"; do
    if brew list --formula "$pkg" >/dev/null 2>&1; then
        echo "  ✓ $pkg"
    else
        echo "  + installing $pkg"
        brew install "$pkg"
    fi
done

# bun 은 oven-sh/bun tap 에 있다 (공식 Homebrew 에는 없음).
if ! command -v bun >/dev/null 2>&1; then
    echo "  + installing bun (via oven-sh/bun tap)"
    brew tap oven-sh/bun 2>/dev/null || true
    brew install oven-sh/bun/bun
else
    echo "  ✓ bun"
fi

# Powerline 폰트 (tmux / starship 에서 글리프 깨짐 방지)
if ! brew list --cask font-meslo-lg-nerd-font >/dev/null 2>&1; then
    brew tap homebrew/cask-fonts 2>/dev/null || true
    brew install --cask font-meslo-lg-nerd-font || true
fi

# ---- 3. zsh 기본 쉘 --------------------------------------------------------
# 이미 /bin/zsh 등 시스템 zsh 를 쓰고 있으면 굳이 brew zsh 로 바꾸지 않는다
# (sudo 가 필요해서 비대화형 환경에서 실패할 수 있음).
ZSH_BIN="$(command -v zsh)"
if [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "$ZSH_BIN" ]; then
    echo "✓ 기본 쉘이 이미 zsh ($SHELL)"
else
    if ! grep -qx "$ZSH_BIN" /etc/shells 2>/dev/null; then
        echo "▶ $ZSH_BIN 를 /etc/shells 에 등록 (sudo 필요)"
        if ! echo "$ZSH_BIN" | sudo -n tee -a /etc/shells >/dev/null 2>&1; then
            echo "⚠ sudo 비대화형 실패 — 수동으로 실행해 주세요:"
            echo "    echo \"$ZSH_BIN\" | sudo tee -a /etc/shells"
        fi
    fi
    echo "▶ 기본 쉘을 zsh 로 변경"
    chsh -s "$ZSH_BIN" || echo "⚠ chsh 실패 (수동 실행: chsh -s $ZSH_BIN)"
fi

# ---- 4. oh-my-zsh ----------------------------------------------------------
if [ ! -d "$HOME/.oh-my-zsh" ]; then
    echo "▶ oh-my-zsh 설치"
    RUNZSH=no CHSH=no KEEP_ZSHRC=yes \
        sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
else
    echo "✓ oh-my-zsh 이미 설치됨"
fi

ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

# plugins
clone_if_missing() {
    local url="$1"
    local dest="$2"
    if [ ! -d "$dest" ]; then
        git clone --depth 1 "$url" "$dest"
    else
        echo "✓ $(basename "$dest") 이미 있음"
    fi
}
clone_if_missing https://github.com/zsh-users/zsh-autosuggestions \
    "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
clone_if_missing https://github.com/zsh-users/zsh-syntax-highlighting.git \
    "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"

# spaceship theme (mac .zshrc 가 기본으로 ZSH_THEME=spaceship 사용)
if [ ! -d "$ZSH_CUSTOM/themes/spaceship-prompt" ]; then
    git clone https://github.com/spaceship-prompt/spaceship-prompt.git \
        "$ZSH_CUSTOM/themes/spaceship-prompt" --depth=1
    ln -sf "$ZSH_CUSTOM/themes/spaceship-prompt/spaceship.zsh-theme" \
        "$ZSH_CUSTOM/themes/spaceship.zsh-theme"
fi

# ---- 5. 기존 dotfile backup ------------------------------------------------
backup_if_exists() {
    local f="$1"
    if [ -e "$f" ] && [ ! -L "$f" ]; then
        cp -a "$f" "${f}.bak.$(date +%Y%m%d%H%M%S)"
        echo "  ↳ backup: ${f}.bak.*"
    fi
}
backup_if_exists "$HOME/.zshrc"
backup_if_exists "$HOME/.tmux.conf.local"

# ---- 6. dotfiles 배포 ------------------------------------------------------
echo "▶ .zshrc / .tmux.conf.local 배포"
cp -f "$SCRIPT_DIR/.zshrc" "$HOME/.zshrc"
cp -f "$USER_CLI_DIR/.tmux.conf.local" "$HOME/.tmux.conf.local"

# macOS tmux 는 default-shell 을 zsh 로 고정해야 새 창에서 zsh 가 뜬다.
if ! grep -q 'default-shell /bin/zsh' "$HOME/.tmux.conf.local"; then
    printf '\nset-option -g default-shell /bin/zsh\n' >> "$HOME/.tmux.conf.local"
fi

# ---- 7. gpakosz/.tmux ------------------------------------------------------
if [ ! -d "$HOME/.tmux" ]; then
    git clone --depth 1 https://github.com/gpakosz/.tmux.git "$HOME/.tmux"
fi
ln -sf "$HOME/.tmux/.tmux.conf" "$HOME/.tmux.conf"

# ---- 8. Claude Code — experimental agent teams (cmux) ----------------------
# 한 줄 요약: ~/.claude/settings.json 의 env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
# 및 skipDangerousModePermissionPrompt=true 를 보장.
# cmux 자체는 https://cmux.sh (또는 배포 DMG) 에서 수동 설치 — 여기서는 설정만 보강.
CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"
mkdir -p "$CLAUDE_DIR"
if command -v jq >/dev/null 2>&1; then
    if [ ! -f "$SETTINGS" ]; then
        echo '{}' > "$SETTINGS"
    fi
    tmp="$(mktemp)"
    jq '.env = (.env // {})
        | .env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
        | .skipDangerousModePermissionPrompt = true
        | .language = (.language // "English")' \
        "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
    echo "✓ ~/.claude/settings.json 에 cmux team 플래그 적용"
else
    echo "⚠ jq 가 없어 settings.json 갱신을 건너뜀"
fi

if [ ! -d "/Applications/cmux.app" ]; then
    cat <<'EOF'
ℹ cmux.app 이 /Applications 에 없습니다.
  https://cmux.sh 에서 DMG 를 받아 설치하거나, 이미 npm 패키지로 쓰고 있다면 무시하세요.
EOF
fi

# ---- 9. git 전역 설정 (Ubuntu 스크립트와 동일 정책) ------------------------
git config --global user.email "lsjg9909@naver.com"
git config --global user.name "girinman"
git config --global credential.helper osxkeychain
git config --global core.editor "vim"
git config --global alias.lg \
    "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"

# ---- 10. uv tool: nvitop (GPU 가 있는 Mac 은 드물지만 Ubuntu 와 대칭 유지) -
uv tool install nvitop >/dev/null 2>&1 || true

echo "✅ macOS bootstrap 완료 — 새 터미널을 띄우거나 'exec zsh' 로 반영하세요."
