### 修复

- **本地启动脚本切 Node 22**：`local_test.sh` 启动前先用 nvm 切到 Node 22。此前终端默认的 Node 24 是 x64 版，执行脚本会报「Cannot find native binding」起不来；现在不用手动切版本，直接 `bash local_test.sh` 即可。
