import {
  GENERIC_PIM_CHANNEL,
  resolveChannelsOption,
  resolveDefaultChannelOption,
  resolveTranslationChannelsOption,
} from './config'

export { GENERIC_PIM_CHANNEL }

export function resolveDefaultPimChannel(): string {
  return resolveDefaultChannelOption()
}

export function resolvePimChannels(): string[] {
  return Array.from(new Set([resolveDefaultPimChannel(), ...resolveChannelsOption()]))
}

export function resolveTranslationMirrorChannels(): string[] {
  return resolveTranslationChannelsOption()
}
