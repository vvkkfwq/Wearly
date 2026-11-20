# Wearly 抠图服务

这是 Wearly 的内部抠图服务。它接收符合 Wearly 上传规格的 JPEG，在 CPU 上用 `u2netp` 抠图。服务在内存里处理照片，Wearly API 负责保存成图和任务状态。

生产环境由 [Docker Compose](../../deploy/README.md) 启动，衣橱 API 通过私有网络调用抠图服务。

服务用 alpha ≥ 16 的像素寻找裁剪框，框内保留半透明边缘。裁剪后四边各留约衣物长边的 5%，等比缩到长边最多 320 px，输出无损透明 WebP。长边不足 320 px 时维持现有尺寸。

## 本地安装并下载模型

先安装 [uv](https://docs.astral.sh/uv/getting-started/installation/)。以下命令从 Wearly 仓库根目录开始执行。

```sh
cd apps/cutout
uv python install 3.12
uv sync --locked --python 3.12

export U2NET_HOME="$PWD/.models"
export OMP_NUM_THREADS=2
uv run --locked python -c 'from cutout import load_model; load_model()'
```

`uv sync` 按 `uv.lock` 安装 `rembg[cpu]==2.0.87`、ONNX Runtime、Pillow、FastAPI 和 Uvicorn。最后一条命令通过 rembg 从官方发布地址下载并校验 [u2netp.onnx](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx)，约 4.6 MB，放在 `.models/` 下。后续启动会复用这个文件。新终端启动服务时也要设置 `U2NET_HOME`。

## 启动并验证

在同一个终端运行：

```sh
uv run --locked uvicorn app:app --host 127.0.0.1 --port 7000
```

另开终端。将 `/path/to/photo.jpg` 换成一张最长边不超过 1024 px 的 JPEG。

```sh
curl --fail-with-body http://127.0.0.1:7000/health
curl --fail-with-body \
  -H 'Content-Type: image/jpeg' \
  --data-binary '@/path/to/photo.jpg' \
  http://127.0.0.1:7000/cutout \
  -o cutout.webp
```

`/health` 返回 `{"status":"ready"}` 时模型已加载。上面的命令把响应写入当前目录的 `cutout.webp`，可用图片查看器打开。

## HTTP 接口

`POST /cutout` 的请求体是 JPEG 文件字节，头部为 `Content-Type: image/jpeg`。上限为 2 MiB，解码后长边最多 1024 px。

| 状态码 | 含义 |
| --- | --- |
| `200` | 响应体为 `image/webp` 字节。 |
| `400` | JPEG 无法解码，或图片尺寸超限。 |
| `408` | 5 秒内未读完请求体，服务释放处理名额。 |
| `413` | 请求体超过 2 MiB。 |
| `415` | 请求的 `Content-Type` 不是 `image/jpeg`。 |
| `422` | 模型遮罩中没有可用于裁剪的前景像素。 |
| `503` | 当前进程正在读取或处理另一张图。响应带 `Retry-After: 1`。 |

当前以单个 Uvicorn worker 运行。每个进程各自加载模型并限制一次处理一张图。5 秒是读取整个请求体的时限，模型推理从读完后开始。调用方应串行发送已经保存在本地的图片，设置覆盖上传和推理的请求超时，收到 `503` 时稍后重试。`200` 只表示成功生成了图片，床单残留或袖口丢失等效果问题需要查看成图。

## 构建 CPU 镜像

在装了 Docker 的机器上，从仓库根目录执行。构建时会根据锁文件安装依赖并下载模型，容器启动时直接读取镜像内的模型。

```sh
docker build -t wearly-cutout:0.1.0 apps/cutout
docker run --rm --name wearly-cutout -p 127.0.0.1:7000:7000 wearly-cutout:0.1.0
```

用上面的 `curl` 命令验收容器。抠图服务只供 Wearly API 调用。同机运行时走回环地址。若两者都在容器里，接到同一个私有网络，由 API 使用容器名访问。

## 接入 Wearly

本地联调或直接运行 API 时，确认 `/health` 就绪后，在 [Wearly API 配置](../api/DATA.md#开发配置) 中把 `WEARLY_CUTOUT_URL` 指向完整的 `/cutout` 地址并启动 API。Compose 部署会设置内部地址 `http://cutout:7000/cutout`。

录入时选一张照片，确认选品类前就出现动效，保存后只新增 WebP。停掉服务再用一张新照片录入，确认衣橱不新增单品。服务恢复后可从录入页重试。换照失败时旧成图仍可查看。
