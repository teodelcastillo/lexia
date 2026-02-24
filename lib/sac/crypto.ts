/**
 * AES-256-GCM encryption for SAC credentials.
 *
 * Passwords are encrypted before storage and decrypted only on the server
 * (in API routes, cron jobs, and the scraper). The encryption key lives
 * in the environment variable SAC_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 *
 * Ciphertext format: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.SAC_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SAC_ENCRYPTION_KEY is missing or invalid. ' +
        'It must be a 64-character hex string (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string. Returns `iv:authTag:ciphertext` in hex.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a ciphertext string previously produced by `encrypt`.
 * Returns the original plaintext, or throws on tampered/invalid data.
 */
export function decrypt(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format — expected iv:authTag:ciphertext')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
