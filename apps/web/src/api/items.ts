import type { Category, Item } from '@/domain/types'
import { normalizeImage } from '@/domain/normalizeImage'
import { jsonBody, readJson, requireOk } from './http'

export interface ListItemsOptions {
  category?: Category
  /** 默认 false，已移出衣橱的单品不出现在衣橱和创建页 */
  includeArchived?: boolean
}

export async function listItems({ category, includeArchived = false }: ListItemsOptions = {}): Promise<Item[]> {
  const query = new URLSearchParams()
  if (category) query.set('category', category)
  if (includeArchived) query.set('includeArchived', 'true')
  const search = query.size ? `?${query}` : ''
  return readJson<Item[]>(await fetch(`/api/items${search}`))
}

function itemPath(id: string) {
  return `/api/items/${encodeURIComponent(id)}`
}

export async function getItem(id: string): Promise<Item | null> {
  const response = await fetch(itemPath(id))
  return response.status === 404 ? null : readJson<Item>(response)
}

export async function previewItemCutout(jpeg: Blob, signal: AbortSignal): Promise<Blob> {
  const form = new FormData()
  form.set('photo', jpeg, 'garment.jpg')
  const response = await fetch('/api/cutout-preview', { method: 'POST', body: form, signal })
  requireOk(response)
  return response.blob()
}

export async function createItem(input: { jpeg: Blob; category: Category }): Promise<Item> {
  const form = new FormData()
  form.set('category', input.category)
  form.set('photo', input.jpeg, 'garment.jpg')
  return readJson<Item>(await fetch('/api/items', { method: 'POST', body: form }))
}

export type ItemPatch = Partial<Pick<Item, 'category' | 'archived'>>

export async function updateItem(id: string, patch: ItemPatch): Promise<Item> {
  return readJson<Item>(await fetch(itemPath(id), jsonBody('PATCH', patch)))
}

export async function replaceItemPhoto(id: string, blob: Blob): Promise<Item> {
  const form = new FormData()
  form.set('photo', await normalizeImage(blob), 'garment.jpg')
  return readJson<Item>(await fetch(`${itemPath(id)}/photo`, { method: 'PUT', body: form }))
}

export async function retryItemCutout(id: string): Promise<Item> {
  return readJson<Item>(await fetch(`${itemPath(id)}/cutout`, { method: 'POST' }))
}
