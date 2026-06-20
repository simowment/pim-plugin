const FALLBACK_PIM_CHANNEL = 'storefront'
const DEFAULT_PIM_CHANNELS = ['storefront', 'default', 'google', 'meta']

export function resolveDefaultPimChannel(): string {
  const configuredChannel = process.env.PIM_DEFAULT_CHANNEL?.trim()
  return configuredChannel || FALLBACK_PIM_CHANNEL
}

export function resolvePimChannels(): string[] {
  return Array.from(new Set([resolveDefaultPimChannel(), ...DEFAULT_PIM_CHANNELS]))
}
