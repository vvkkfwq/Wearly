export function requireOk(response: Response) {
  if (!response.ok) throw new Error(`请求失败：${response.status}`)
}

export async function readJson<T>(response: Response): Promise<T> {
  requireOk(response)
  return response.json()
}

export function jsonBody(method: 'POST' | 'PATCH', body: object): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
