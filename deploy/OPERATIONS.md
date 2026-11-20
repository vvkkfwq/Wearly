# Wearly 运维手册

适用于已经上线的单台 Linux + Docker Compose 部署。首次配置域名、共享账号和容器见 [上线手册](README.md)。命令以 `ubuntu` 用户、`~/wearly` 代码目录和 `/srv/wearly` 主机数据目录为例。请按实际登录用户和 `.env` 中的 `WEARLY_STATE_DIR` 调整示例。容器内数据路径统一为 `/var/lib/wearly`。

## 日常巡检

通过 SSH 登录服务器，进入部署目录。标有「本机」的步骤在你的电脑上运行，其他命令在服务器上运行。

```sh
cd "$HOME/wearly"
sudo docker compose ps
sudo docker compose logs --tail=80 web api cutout
df -h /srv/wearly
```

- `web` 应处于运行状态。`api` 和 `cutout` 应显示 `healthy`。
- 用手机无痕窗口打开站点，应出现登录弹窗。登录后能看到衣橱和已有照片。需要检查抠图时，选一张照片进入预览，看到成图后返回，衣橱数据会保持原样。
- `df` 显示数据盘的剩余空间。空间偏紧时，先用 `sudo docker system df` 和 `du -sh /srv/wearly/data /srv/wearly/backups` 找出占用来源。保留生产数据和仍需使用的备份。

需要跟踪实时日志时，用 `sudo docker compose logs -f --tail=80 api`，按 `Ctrl+C` 退出日志查看。需要重启单个服务时，用 `sudo docker compose restart api`，再查 `ps` 等它恢复健康。

## 备份并下载到本机

重要更新前和日常使用中定期做备份。API 可以继续运行。备份命令会把 SQLite 和数据库引用的照片一起写入新目录，并生成校验清单。先在服务器运行：

```sh
cd "$HOME/wearly"
snapshot="wearly-$(date -u +%Y%m%dT%H%M%SZ)"
sudo docker compose exec -T api node src/data.ts backup \
  /var/lib/wearly/data "/var/lib/wearly/backups/$snapshot"
```

命令成功后，记下输出里的快照目录名。在 **本机** 将示例值换成真实服务器地址和快照目录名，再下载一份离机备份。

```sh
deploy_host=ubuntu@YOUR_SERVER_IP
snapshot=YOUR_SNAPSHOT_NAME
install -d -m 0700 "$HOME/wearly-backups"
scp -r "$deploy_host:/srv/wearly/backups/$snapshot" "$HOME/wearly-backups/"
```

备份目录包含衣物照片，请放在私人位置。下载成功后应能看到 `snapshot.json`、`wearly.sqlite` 和 `photos/`。定期在临时目录执行一次恢复验证，确认照片和 SQLite 都能通过校验。服务器的 `.env` 和 `deploy/users.caddy` 单独保管，共享账号的原密码留在密码管理器或本机。

## 更新代码

先完成上面的生产备份，在服务器上为当前运行的镜像保留回退标签。每次更新会刷新这一组标签。

```sh
(
  set -eu
  cd "$HOME/wearly"
  for service in web api cutout; do
    image=$(sudo docker compose images -q "$service")
    sudo docker tag "$image" "wearly-$service:previous"
  done
)
```

若服务器有 Git 工作区，在 `~/wearly` 用 `git rev-parse HEAD` 记下当前提交，再执行 `git pull --ff-only && sudo docker compose up -d --build --force-recreate --wait`。`--force-recreate` 会重新挂载随仓库更新的 Caddy 配置。若服务器上是通过 `git archive` 上传的代码，按下面步骤分阶段更新。

先在 **本机的 Wearly 仓库** 确认要部署的提交。`git archive HEAD` 只打包当前已提交的内容。将归档解包到全新的 `~/wearly.next`，可避免沿用已经删除的源码文件。`tar -xpf` 保留归档中的文件权限，供容器运行用户读取。

```sh
deploy_host=ubuntu@YOUR_SERVER_IP
git status --short
git rev-parse --short HEAD
(
  set -o pipefail
  ssh "$deploy_host" 'test ! -e "$HOME/wearly.next" && mkdir -m 700 "$HOME/wearly.next"' &&
    git archive HEAD | ssh "$deploy_host" 'tar -xpf - -C "$HOME/wearly.next"'
)
```

然后在服务器上将部署配置复制到新目录。下面的命令构建前端和 API，沿用已运行的抠图镜像。如果改了抠图的运行代码、镜像或依赖，将 `cutout` 一起加到 `build` 命令。

```sh
cd "$HOME/wearly" &&
  install -m 0600 .env "$HOME/wearly.next/.env" &&
  install -m 0600 deploy/users.caddy "$HOME/wearly.next/deploy/users.caddy" &&
  cd "$HOME/wearly.next" &&
  sudo docker compose config --quiet &&
  sudo docker compose build web api
```

确认备份、镜像标签和构建都成功后再切换。旧代码目录会保留在 `wearly.previous.*`。容器重建时访问可能短暂中断。`--force-recreate` 同时刷新 Caddy 的配置文件挂载，`--no-build` 使用已经确认构建成功的镜像。

```sh
previous="$HOME/wearly.previous.$(date -u +%Y%m%dT%H%M%SZ)"
cd "$HOME" && test ! -e "$previous" &&
  mv -T "$HOME/wearly" "$previous" &&
  mv -T "$HOME/wearly.next" "$HOME/wearly" &&
  cd "$HOME/wearly" &&
  sudo docker compose up -d --no-build --force-recreate --wait &&
  sudo docker compose ps
```

更新后检查登录、已有照片和容器状态。涉及录入或抠图的改动，再做一次照片预览。

### 回退版本

先确认旧版能读当前数据库。如需恢复更新前的快照，按下节操作。归档部署时切回上一份 `wearly.previous.*` 目录，Git 部署时切回之前记下的提交。保留当前生效的账号文件，再把回退镜像重新标为 `latest`。切回代码后在 `~/wearly` 执行：

```sh
(
  set -eu
  for service in web api cutout; do
    sudo docker image inspect "wearly-$service:previous" >/dev/null
  done
  for service in web api cutout; do
    sudo docker tag "wearly-$service:previous" "wearly-$service:latest"
  done
  sudo docker compose up -d --no-build --force-recreate --wait
)
```

## 恢复数据

如果快照只保存在本机，先将它复制回服务器。设置备份下载步骤中的 `deploy_host` 和 `snapshot`，再执行以下命令。

```sh
scp -r "$HOME/wearly-backups/$snapshot" "$deploy_host:/srv/wearly/backups/"
```

恢复有两个阶段。先在 API 继续运行时，从快照恢复到**新目录**，确认校验通过。只做演练时，到此即可。

```sh
cd "$HOME/wearly"
snapshot=YOUR_SNAPSHOT_NAME
restored="restored-$(date -u +%Y%m%dT%H%M%SZ)"
sudo docker compose run --rm --no-deps api node src/data.ts restore \
  "/var/lib/wearly/backups/$snapshot" "/var/lib/wearly/$restored"
```

确实要用该快照接替生产数据时，在同一终端继续。先停止写入，再保留当前目录并切入恢复目录。快照创建后新增的数据仍在切换前保留的目录中。

```sh
previous="data-before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
test -d "/srv/wearly/$restored" && test ! -e "/srv/wearly/$previous" &&
  sudo docker compose stop api &&
  sudo mv -T /srv/wearly/data "/srv/wearly/$previous" &&
  sudo mv -T "/srv/wearly/$restored" /srv/wearly/data &&
  sudo docker compose up -d --no-build --wait
```

恢复后检查已有单品、照片和搭配。若切换中的移动失败，先检查两个目录的位置，把保留的生产目录移回 `/srv/wearly/data` 后再启动 API。

## 更换共享密码

在 `~/wearly` 运行 `sudo docker run --rm -it caddy:2-alpine caddy hash-password`，输入新密码并复制输出的哈希。把 `deploy/users.caddy` 中 `wearly` 后面的哈希换成新值，保持文件权限为 `0600`。建议先将旧文件留在仓库外的私人目录，方便配置出错时恢复。

```sh
sudo chmod 0600 deploy/users.caddy
sudo docker compose run --rm --no-deps --entrypoint caddy web validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile &&
  sudo docker compose up -d --no-build --no-deps --force-recreate web
```

用无痕窗口验证新密码，再更新本机保存的原密码。普通浏览器窗口可能暂时复用旧的登录凭据。

## 故障排查

| 现象 | 先查什么 |
| --- | --- |
| 构建镜像时卡在下载 | 看 `docker compose build` 的输出，区分是容器基础镜像、npm 包、PyPI 包还是抠图模型下载失败。 |
| 网页打不开或报证书错误 | 核对 DNS 和云服务器入站 TCP 80、443。用 `sudo docker compose logs --tail=100 web` 查看 Caddy 是否已签发证书。 |
| 请求首页收到 `401` | 未登录时这是正常的。登录仍返回 `401` 时，用无痕窗口重试，再检查 `deploy/users.caddy`。 |
| 页面能打开，衣橱加载失败 | 看 `sudo docker compose ps` 和 `sudo docker compose logs --tail=100 api`，确认 API 健康、数据盘可写。 |
| 衣橱可看，照片预览失败 | 看 `sudo docker compose logs --tail=100 cutout api`。确认模型就绪后重新选图或点重试。 |
| 容器处于 `exited` 或 `unhealthy` | 先看对应服务的日志。修复原因后，用 `sudo docker compose up -d --no-build --wait` 启动已有镜像。 |

保留 Caddy 的证书卷和 `/srv/wearly` 数据目录。日常看日志、重启服务和更新镜像都可以沿用现有存储。
