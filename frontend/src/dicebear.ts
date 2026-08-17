import { createAvatar } from '@dicebear/core'
import { avataaars, bottts, identicon } from '@dicebear/collection'

const STYLES = { avataaars, bottts, identicon } as const

export function dicebearAvatar(seed: string, style?: string | null): string {
  const collection = STYLES[(style ?? 'bottts') as keyof typeof STYLES] ?? bottts
  return createAvatar(collection as any, { seed }).toDataUri()
}
