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
const MAX_TITLE_LENGTH = 60

/**
 * Generates a short, relevant title for a conversation based on the user's first message.
 * Returns a trimmed string (max ~60 chars) or null if generation fails.
 */
export async function generateConversationTitle(
  userMessage: string
): Promise<string | null> {
  if (!userMessage?.trim()) return null

  const truncated = userMessage.trim().slice(0, 500)

  try {
    const { text } = await generateText({
      model: resolveModel(TITLE_MODEL),
      prompt: `Eres un asistente. Genera un título corto y descriptivo (máximo 6-8 palabras) para una conversación legal que comienza con este mensaje del usuario. Responde SOLO con el título, sin comillas ni explicaciones.

Mensaje del usuario:
"${truncated}"

Título:`,
      maxTokens: 50,
      temperature: 0.3,
    })

    const title = text.trim().slice(0, MAX_TITLE_LENGTH)
    return title || null
  } catch (err) {
    console.error('[Lexia] generateConversationTitle error:', err)
    return null
  }
}

export { DEFAULT_TITLE }
