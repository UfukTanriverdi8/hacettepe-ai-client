import type { AppConfig } from './types'

export async function loadConfig(): Promise<AppConfig> {
  const response = await fetch('/config.json', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load config.json: ${response.status}`)
  }
  return response.json()
}
