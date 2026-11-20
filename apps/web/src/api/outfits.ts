import type { Outfit } from '@/domain/types'
import { jsonBody, readJson, requireOk } from './http'

function outfitPath(id: string) {
  return `/api/outfits/${encodeURIComponent(id)}`
}

export async function listOutfits(): Promise<Outfit[]> {
  return readJson<Outfit[]>(await fetch('/api/outfits'))
}

export async function getOutfit(id: string): Promise<Outfit | null> {
  const response = await fetch(outfitPath(id))
  return response.status === 404 ? null : readJson<Outfit>(response)
}

export async function createOutfit(itemIds: string[]): Promise<Outfit> {
  return readJson<Outfit>(await fetch('/api/outfits', jsonBody('POST', { itemIds })))
}

export type OutfitPatch = Partial<Pick<Outfit, 'itemIds' | 'favorite'>>

export async function updateOutfit(id: string, patch: OutfitPatch): Promise<Outfit> {
  return readJson<Outfit>(await fetch(outfitPath(id), jsonBody('PATCH', patch)))
}

export async function deleteOutfit(id: string): Promise<void> {
  requireOk(await fetch(outfitPath(id), { method: 'DELETE' }))
}
