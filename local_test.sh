# nvm 默认的 Node 24 是 x64 版，找不到 arm64 的原生包，vite 起不来，所以先切到 Node 22
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use 22 || exit 1

cd ~/jianghu-idle/code && npm run dev
