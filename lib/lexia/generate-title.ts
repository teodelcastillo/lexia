/**
 * Lexia - Generate conversation title from first user message
 *
 * Uses a lightweight model (gpt-4o-mini) to produce a short, relevant title
 * for the conversation history.
 */

import { generateText } from 'ai'
import type { UIMessage } from 'ai'
import { resolveModel } from '@/lib/ai'

const TITLE_MODEL = 'openai/gpt-4o-mini'
const DEFAULT_TITLE = 'Nueva conversación'

/** Extracts text from the first user message in the array. */
export function getFirstUserMessageText(messages: UIMessage[]): string {
  const userMsg = messages.find((m) => m.role === 'user')
  if (!userMsg?.parts) return ''
  return (userMsg.parts as Array<{ type?: string; text?: string }>)
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
}
const MAX_TITLE_LENGTH = 50

/**
 * Generates a short, descriptive title from the user's first message/instruction.
 * Only called when userMessageCount === 1 (first message).
 * Returns a trimmed string (max ~50 chars) or null if generation fails.
 */
export async function generateConversationTitle(
  userMessage: string
): Promise<string | null> {
  if (!userMessage?.trim()) return null

  const truncated = userMessage.trim().slice(0, 400)

  try {
    const { text } = await generateText({
      model: resolveModel(TITLE_MODEL),
      prompt: `Genera un título muy corto (4-6 palabras) que describa la instrucción o consulta del usuario. Sin comillas ni puntuación final. Solo el título.

Instrucción del usuario:
"${truncated}"

Título:`,
      maxTokens: 30,
      temperature: 0.2,
    } as Parameters<typeof generateText>[0] & { maxTokens?: number })

    const title = text.trim().replace(/^["']|["']$/g, '').slice(0, MAX_TITLE_LENGTH)
    return title || null
  } catch (err) {
    console.error('[Lexia] generateConversationTitle error:', err)
    return null
  }
}

export { DEFAULT_TITLE }
