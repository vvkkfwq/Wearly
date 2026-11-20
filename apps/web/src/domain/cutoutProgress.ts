const MINIMUM_PROGRESS_MS = 1000

export async function waitForMinimumCutoutProgress(startedAt: number) {
  const remaining = MINIMUM_PROGRESS_MS - (performance.now() - startedAt)
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining))
  }
}
