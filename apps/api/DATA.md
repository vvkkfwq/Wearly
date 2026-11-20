# Wearly 数据管理

以下命令从仓库根目录运行。备份和恢复的路径相对于运行命令的目录，命令也接受绝对路径。

## 数据环境

| 用途 | 存放位置 | 初始化 |
| --- | --- | --- |
| 本地演示和手测 | `apps/api/data/demo/wearly.sqlite` 和同目录的 `photos/` | `npm --prefix apps/api run seed` 导入初始演示。日常启动使用 `npm --prefix apps/api run dev`。 |
| 自动化测试 | 由测试新建并清理的临时数据库和照片目录 | `npm --prefix apps/api test`。 |
| 生产 | Compose 将主机的 `WEARLY_STATE_DIR/data` 挂载为容器内的 `/var/lib/wearly/data`。直接运行 Node 时由 `WEARLY_DATA_DIR` 指定。 | API 启动时应用迁移并初始化共享衣橱。 |

库内记录所属环境，演示和生产命令会拒绝打开对方的库。首轮联调留下的 `apps/api/data/wearly.sqlite` 和 `apps/api/data/photos/` 是旧目录，当前默认库在 `apps/api/data/demo/`。

本地开发的 Express 只监听回环地址，H5 开发服务通过 `/api` 代理支持手机联调。当前演示 API 无登录，能访问开发服务的局域网设备都可以读写演示衣橱，请在可信局域网内使用。

## 开发配置

API 开发命令读取 `apps/api/.env.development`，H5 开发服务读取 `apps/web/.env.development`。API 的 `PORT` 默认是 `3000`，H5 的 `WEARLY_DEV_API_TARGET` 默认是 `http://127.0.0.1:3000`。更换 API 端口时同步更新 H5 的代理地址。

录入和换照需要抠图服务。先启动 [抠图服务](../cutout/README.md)，再在 `apps/api/.env.development` 中配置 `WEARLY_CUTOUT_URL=http://127.0.0.1:7000/cutout` 并重启 API。

## 生产配置

使用 Docker Compose 部署时，从仓库根目录的 `.env.example` 创建 `.env`，由 Compose 向 API 注入配置。生产备份和恢复也在容器中执行。 [上线手册](../../deploy/README.md) · [运维手册](../../deploy/OPERATIONS.md)

### 直接在主机上运行 Node

在 `apps/api/.env.production` 填写实际路径和域名，新检出可从 `apps/api/.env.example` 复制。`start` 和 `migrate` 都会读取该文件，也可以由部署平台注入同名变量。平台注入的变量优先。H5 生产构建可读取 `apps/web/.env.production`，浏览器使用当前站点的 `/api`。各环境实际配置文件由 Git 忽略。

| 变量 | 值 |
| --- | --- |
| `NODE_ENV` | `production`，生产 API 启动必填。 |
| `WEARLY_DATA_DIR` | 仓库外、已存在的持久化目录绝对路径，启动和迁移必填。 |
| `WEARLY_PUBLIC_ORIGIN` | H5 的外部 HTTPS 来源，例如 `https://wearly.example.com`，启动必填。只填写协议、域名和非默认端口。 |
| `PORT` | API 的本机端口，可选，默认 `3000`。 |
| `WEARLY_BIND_HOST` | 默认 `127.0.0.1`。容器中的私有生产网络使用 `0.0.0.0`。 |
| `WEARLY_CUTOUT_URL` | 录入或换照必需，填写抠图服务的完整内部地址，例如 `http://127.0.0.1:7000/cutout`。留空仍可查看已有单品。 |

```sh
npm --prefix apps/api ci --omit=dev
npm --prefix apps/api run migrate
npm --prefix apps/api start
```

迁移创建生产库和表。API 首次启动会初始化共享衣橱。反向代理通过 HTTPS 提供 H5 并将 `/api` 转发至 `127.0.0.1:$PORT`，保留外部 `Host` 和浏览器发送的 `Origin`。入口需要限制为获准用户访问，覆盖 H5、API 和照片。来源校验只用于约束浏览器请求。

## 导入演示数据

```sh
npm --prefix apps/api run seed
```

初次导入 28 件单品、28 张原始 WebP 和 6 套搭配，保留收藏、抠图展示和搭配内单品顺序。遇到已有记录时保留它。导入成功后，重复运行会保留编辑和删除结果。导入和日常测试使用各自的数据目录。

## 备份当前状态

```sh
npm --prefix apps/api run backup -- apps/api/data/demo apps/api/data/backups/demo-2026-11-18
```

使用一个尚不存在的快照目录。命令可在 API 运行时执行。它先用 SQLite `VACUUM INTO` 取得一致的数据库视图，再复制该视图引用的原图与抠图，并记录文件校验和。换照片使用新文件键，旧文件保留供尚在进行的快照读取。快照只包含数据库仍引用的照片。 [SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html#vacuuminto)

## 恢复路径 A：重建初始演示

```sh
npm --prefix apps/api run seed -- apps/api/data/recovered-initial
```

使用一个全新目录，得到原始的 28 件单品和 6 套搭配。先检查生成的库和照片。已有演示库和编辑记录保留在原目录。

## 恢复路径 B：恢复某次编辑后的状态

```sh
npm --prefix apps/api run restore -- apps/api/data/backups/demo-2026-11-18 apps/api/data/recovered-snapshot
```

使用一个尚不存在的恢复目录。命令检查数据库、外键及所引用照片的校验和，验证全部通过后发布恢复目录。确认恢复内容后停掉 API，把现有 `apps/api/data/demo/` 改名保留，再把选定的恢复目录改名为 `apps/api/data/demo/`，最后重启 API。切换后可以通过还原原目录来回退。
