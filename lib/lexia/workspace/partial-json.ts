/**
 * Parse a partial JSON string produced by streamObject into a best-effort
 * JavaScript value. Safe: catches errors and returns undefined on failure.
 *
 * Strategy:
 *  1. Try JSON.parse directly.
 *  2. If that fails, "repair" the input by balancing quotes and brackets
 *     and try again.
 *
 * Only handles the shapes we care about (objects, arrays, strings).
 */

export function parsePartialJson<T = unknown>(text: string): T | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Fall through to repair.
  }
  const repaired = repair(trimmed)
  if (!repaired) return undefined
  try {
    return JSON.parse(repaired) as T
  } catch {
    return undefined
  }
}

function repair(s: string): string | null {
  let inString = false
  let escape = false
  const stack: string[] = []
  let i = 0
  for (; i < s.length; i++) {
    const ch = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' && stack[stack.length - 1] === '{') stack.pop()
    else if (ch === ']' && stack[stack.length - 1] === '[') stack.pop()
  }

  let out = s
  // Close open string
  if (inString) out += '"'
  // Drop trailing "key:" or partial key/value
  out = out.replace(/,\s*$/, '')
  out = out.replace(/:\s*$/, ': null')
  // Close brackets
  while (stack.length) {
    const open = stack.pop()!
    out += open === '{' ? '}' : ']'
  }
  return out
}
