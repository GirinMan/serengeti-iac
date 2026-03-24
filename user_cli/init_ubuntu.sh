#!/usr/bin/env bash
set -e # 에러 발생 시 스크립트 실행 중단

echo "🚀 Starting Ubuntu 24.04 LTS Environment Setup (2026 Edition)..."

# 1. Basic Setting & System Packages
sudo apt-get update
sudo apt-get -y upgrade
# python3-pip 대신 uv와 npm을 활용하므로 python3-pip는 제외하거나 최소화
# unzip은 AWS CLI v2 설치 시 필요하며, nodejs와 npm을 시스템 패키지로 추가
sudo apt-get install -y vim curl wget git unzip tmux fonts-powerline git-lfs tree zsh nodejs npm gh
sudo apt-get -y autoremove

# 2. Install uv (초고속 Python 패키지 매니저 및 Conda 대체제)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 3. Install Python CLI tools using uv (pip3 대체)
# Ubuntu 24.04의 PEP 668 정책을 준수하며 격리된 환경(pipx와 유사)에 안전하게 글로벌 CLI 도구 설치
uv tool install nvitop

# 4. Install AWS CLI v2 (pip3 install awscli v1 대체)
# 최신 AWS CLI는 Python 패키지가 아닌 공식 v2 바이너리 설치가 표준입니다.
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws

# 5. Make zsh default
sudo chsh -s "$(which zsh)" "$USER"

# 6. Install oh-my-zsh
# 기존의 쉘 스크립트 실행 방식을 좀 더 안정적인 unattended 모드로 유지
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# 7. Install oh-my-zsh plugins
ZSH_CUSTOM=${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}
git clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"

# 8. Install starship theme
# 프롬프트 입력 대기 없이 바로 설치되도록 `-y` 플래그 추가
curl -sS https://starship.rs/install.sh | sh -s -- -y

# 9. Copy User Configs (zshrc, tmux)
# zshrc/ubuntu 파일이 현재 디렉토리에 있다고 가정
if [ -f ".zshrc" ]; then
    cp -rf .zshrc ~/.zshrc
fi

if [ -f ".tmux.conf.local" ]; then
    cp -rf .tmux.conf.local ~/.tmux.conf.local
fi

# 10. Tmux Setup (gpakosz)
cd "$HOME"
# 이미 존재할 경우를 대비해 처리
if [ ! -d "$HOME/.tmux" ]; then
    git clone https://github.com/gpakosz/.tmux.git
fi
ln -s -f .tmux/.tmux.conf ~/.tmux.conf

# 11. Github Profile & Config
git config --global user.email "lsjg9909@naver.com"
git config --global user.name "girinman"
git config --global credential.helper store
git config --global core.editor "code --wait"
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"

echo "✅ Setup Completed Successfully! Please log out and log back in, or run 'zsh' to apply changes."
