/** 将浏览器可解码的照片压缩为长边不超过 1024px 的 JPEG。 */
const MAX_EDGE = 1024
const QUALITY = 0.8

export async function normalizeImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas 上下文')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((image) => image ? resolve(image) : reject(new Error('照片压缩失败')), 'image/jpeg', QUALITY)
  })
}
