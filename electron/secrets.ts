import { safeStorage } from 'electron'
import { getSecretBlob, saveSecretBlob } from './db/store'

const KEYS = ['ollama', 'openai', 'anthropic'] as const
export type SecretName = (typeof KEYS)[number]

export function saveSecret(name: SecretName, plaintext: string): void {
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plaintext)
    : Buffer.from(plaintext, 'utf8')
  saveSecretBlob(name, buf)
}

export function getSecret(name: SecretName): string {
  const raw = getSecretBlob(name)
  if (!raw?.length) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(raw)
    }
    return raw.toString('utf8')
  } catch {
    return ''
  }
}

export function hasSecret(name: SecretName): boolean {
  return getSecret(name).length > 0
}

export function secretStatus(): Record<SecretName, boolean> {
  return {
    ollama: hasSecret('ollama'),
    openai: hasSecret('openai'),
    anthropic: hasSecret('anthropic')
  }
}
