/**
 * Build a granular, LLM-ready context block for a Lexia Workspace request.
 *
 * Given a caseId + user-picked documents + people, returns:
 *   - a formatted prompt block with actual document passages (not just names)
 *   - a summary of people (with their case-participant role when available)
 *
 * The output has a hard character budget so it never blows up the prompt.
 * When budget is exceeded we truncate the *last* passage and indicate it.
 */

import type { createClient } from '@/lib/supabase/server'
import {
  extractDocumentsForCase,
  type ExtractedDocument,
} from './document-extract'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export interface CaseContextResult {
  /** Final prompt block ready to be concatenated to the user message. */
  text: string
  /** Individual documents actually included (for UI transparency / audit). */
  documents: Array<{
    id: string
    name: string
    included: boolean
    chars: number
    truncated: boolean
    error?: string
  }>
  /** People actually included (for audit). */
  people: Array<{ id: string; name: string; role: string | null }>
}

interface BuildCaseContextOpts {
  caseId: string
  documentIds: string[]
  personIds: string[]
  /** Maximum total characters across all document passages. */
  totalDocsBudget?: number
  /** Characters per individual doc (before the total budget kicks in). */
  perDocBudget?: number
}

function personDisplayName(p: {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  name?: string | null
}): string {
  if (p.name && p.name.trim()) return p.name.trim()
  const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  if (full) return full
  return p.company_name?.trim() || '(sin nombre)'
}

function personIdentifier(p: {
  dni?: string | null
  cuit?: string | null
  email?: string | null
}): string | null {
  if (p.dni) return `DNI ${p.dni}`
  if (p.cuit) return `CUIT ${p.cuit}`
  if (p.email) return p.email
  return null
}

export async function buildCaseContext(
  supabase: SupabaseServer,
  opts: BuildCaseContextOpts
): Promise<CaseContextResult> {
  const totalBudget = opts.totalDocsBudget ?? 30000
  const perDocBudget = opts.perDocBudget ?? 8000

  const result: CaseContextResult = {
    text: '',
    documents: [],
    people: [],
  }

  const lines: string[] = []

  // ---------------------------------------------------------------------------
  // People (with case participant role when available)
  // ---------------------------------------------------------------------------
  if (opts.personIds.length > 0) {
    const { data: people } = await supabase
      .from('people')
      .select(
        'id, name, first_name, last_name, company_name, person_type, dni, cuit, email, phone, address'
      )
      .in('id', opts.personIds)
      .limit(30)

    const { data: participants } = await supabase
      .from('case_participants')
      .select('person_id, role')
      .eq('case_id', opts.caseId)
      .in('person_id', opts.personIds)

    const roleByPerson = new Map<string, string>()
    for (const row of (participants ?? []) as Array<{
      person_id: string
      role: string
    }>) {
      roleByPerson.set(row.person_id, row.role)
    }

    if (Array.isArray(people) && people.length > 0) {
      lines.push('--- PERSONAS VINCULADAS AL CASO ---')
      for (const raw of people as Array<{
        id: string
        name?: string | null
        first_name?: string | null
        last_name?: string | null
        company_name?: string | null
        person_type?: string | null
        dni?: string | null
        cuit?: string | null
        email?: string | null
        phone?: string | null
        address?: string | null
      }>) {
        const name = personDisplayName(raw)
        const role = roleByPerson.get(raw.id) ?? null
        const roleLabel = role ? ` — rol en el caso: ${role}` : ''
        const id = personIdentifier(raw)
        const idLabel = id ? ` (${id})` : ''
        const type = raw.person_type ? ` [${raw.person_type}]` : ''
        lines.push(`- ${name}${type}${roleLabel}${idLabel}`)
        if (raw.address) lines.push(`    domicilio: ${raw.address}`)

        result.people.push({ id: raw.id, name, role })
      }
      lines.push('')
    }
  }

  // ---------------------------------------------------------------------------
  // Documents (extract actual text)
  // ---------------------------------------------------------------------------
  if (opts.documentIds.length > 0) {
    const extracted: ExtractedDocument[] = await extractDocumentsForCase(
      supabase,
      opts.caseId,
      opts.documentIds,
      { maxCharsPerDoc: perDocBudget, maxDocs: 8 }
    )

    if (extracted.length > 0) {
      lines.push('--- DOCUMENTOS DEL CASO (seleccionados por el abogado) ---')
      lines.push(
        'Citá estos documentos cuando apoyen una afirmación. No inventes contenido que no aparezca aquí.'
      )
      lines.push('')

      let used = 0
      for (const doc of extracted) {
        if (doc.error) {
          lines.push(`[${doc.name}] NO DISPONIBLE — ${doc.error}`)
          lines.push('')
          result.documents.push({
            id: doc.id,
            name: doc.name,
            included: false,
            chars: 0,
            truncated: false,
            error: doc.error,
          })
          continue
        }

        const remaining = totalBudget - used
        if (remaining <= 200) {
          result.documents.push({
            id: doc.id,
            name: doc.name,
            included: false,
            chars: 0,
            truncated: false,
            error: 'Presupuesto de contexto agotado',
          })
          continue
        }

        let slice = doc.text
        let truncated = doc.truncated
        if (slice.length > remaining) {
          slice = slice.slice(0, remaining)
          truncated = true
        }

        lines.push(`[${doc.name}]`)
        lines.push(slice)
        if (truncated) lines.push('[... truncado por límite de contexto ...]')
        lines.push('')

        used += slice.length
        result.documents.push({
          id: doc.id,
          name: doc.name,
          included: true,
          chars: slice.length,
          truncated,
        })
      }
    }
  }

  result.text = lines.join('\n').trim()
  return result
}
