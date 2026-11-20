# Wearly 上线手册

本手册适用于单台 Linux 服务器。Docker Compose 运行三个服务，Caddy 提供 H5、HTTPS 和共享账号登录，衣橱 API 保存 SQLite 和照片，抠图服务使用镜像内的 CPU 模型。公网只需要访问 Caddy 的 TCP 80 和 443 端口。

## 首次上线

1. 在服务器安装 Docker Engine 和 Compose 插件，用 `sudo docker compose version` 确认插件可用。检出代码，将域名的 DNS 记录指向服务器，并开放 TCP 80 和 443。以下命令从仓库根目录执行。已有 Docker 操作权限时可省略 Docker 命令前的 `sudo`。
2. 将根目录 `.env.example` 复制为 `.env`，在 `WEARLY_DOMAIN` 填写主机名，例如 `wearly.example.com`。`WEARLY_STATE_DIR` 默认是 `/srv/wearly`，请使用仓库外的持久磁盘。按配置的路径提前创建目录，API 容器以 UID/GID `1000` 运行。

   ```sh
   cp .env.example .env
   sudo install -d -m 0700 -o 1000 -g 1000 /srv/wearly /srv/wearly/data /srv/wearly/backups
   ```

3. 为共享账号生成密码哈希。下面的命令会交互式读取密码，运行一次即可。

   ```sh
   sudo docker run --rm -it caddy:2-alpine caddy hash-password
   ```

   用 `umask 077` 后创建 `deploy/users.caddy`，写一行 `wearly <密码哈希>`，用户名和哈希之间空一格。各设备使用同一个用户名和原密码登录。实际 `.env` 和账号文件由 Git 忽略。

4. 构建并启动三个服务。

   ```sh
   sudo docker compose config --quiet
   sudo docker compose up -d --build --wait
   sudo docker compose ps
   ```

   前端构建和抠图模型下载需要出网。抠图模型加载完成后，API 才启动。API 会应用数据库迁移并创建共享衣橱，首次启动得到空衣橱。Caddy 的证书和配置数据保存在 Docker 卷里。`ps` 中 `api` 和 `cutout` 应显示 `healthy`，`web` 应在运行。

## 上线验收

| 服务 | 验收 |
| --- | --- |
| H5 / Caddy | 在无痕窗口访问首页、`/api/items` 和上传后的照片直链，均应要求登录。两台手机使用共享账号登录，应看到同一个衣橱。 |
| 衣橱 API | 第一次登录的衣橱为空。用一台手机完成录入，另一台能看到单品和照片。`docker compose restart api` 后再打开照片，内容仍应可读。 |
| 抠图服务 | `docker compose ps` 中 `cutout` 应显示 `healthy`。录入时看到照片预览自动变为透明成图。停掉 `cutout` 后用一张新的照片试录，失败时应保留原有数据且不新增单品。运行 `docker compose start cutout` 恢复服务后，在原页面重试。 |

遇到启动问题，用 `sudo docker compose logs --tail=100 web api cutout` 查看日志。容器启动后，用手机访问公网域名，确认 DNS、HTTPS 证书和登录都正常。

## 更新、备份和恢复

上线验收后，按 [运维手册](OPERATIONS.md) 巡检、更新代码、备份和恢复生产数据，以及更换共享密码。
