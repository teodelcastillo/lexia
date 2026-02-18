/**
 * API: Generar descripción de caso desde información contextual
 *
 * Recibe los datos del formulario de creación y genera una descripción
 * coherente y relevante usando IA.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'

const DescriptionSchema = z.object({
  description: z.string().describe('Descripción del caso legal en 2-4 párrafos'),
})

const SYSTEM_PROMPT = `Eres un abogado argentino que redacta descripciones de expedientes judiciales.

Tu tarea es generar una descripción clara y profesional del caso legal, en español, basándote en la información contextual proporcionada.

La descripción debe:
1. Ser concisa pero informativa (2-4 párrafos)
2. Incluir: tipo de caso, partes involucradas, objeto/resumen del conflicto
3. Mencionar jurisdicción, tribunal y fechas si están disponibles
4. Usar lenguaje jurídico apropiado pero accesible
5. No inventar datos que no se hayan proporcionado`

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const {
      case_number,
      title,
      case_type,
      company_name,
      court_number,
      jurisdiction,
      court_name,
      opposing_party,
      opposing_counsel,
      filing_date,
      brief_context,
    } = body as Record<string, string | undefined>

    const parts: string[] = []
    if (case_number?.trim()) parts.push(`Número de caso: ${case_number.trim()}`)
    if (title?.trim()) parts.push(`Título: ${title.trim()}`)
    if (case_type?.trim()) parts.push(`Tipo: ${case_type.trim()}`)
    if (company_name?.trim()) parts.push(`Cliente: ${company_name.trim()}`)
    if (court_number?.trim()) parts.push(`Expediente judicial: ${court_number.trim()}`)
    if (jurisdiction?.trim()) parts.push(`Jurisdicción: ${jurisdiction.trim()}`)
    if (court_name?.trim()) parts.push(`Tribunal: ${court_name.trim()}`)
    if (opposing_party?.trim()) parts.push(`Contraparte: ${opposing_party.trim()}`)
    if (opposing_counsel?.trim()) parts.push(`Abogado de la contraparte: ${opposing_counsel.trim()}`)
    if (filing_date?.trim()) parts.push(`Fecha de presentación: ${filing_date.trim()}`)
    if (brief_context?.trim()) parts.push(`Contexto adicional:\n${brief_context.trim()}`)

    if (parts.length === 0) {
      return NextResponse.json(
        { error: 'Proporcione al menos un dato (título, tipo, cliente, etc.) para generar la descripción' },
        { status: 400 }
      )
    }

    const contextText = parts.join('\n')

    const { object } = await generateObject({
      model: resolveModel('anthropic/claude-sonnet-4-20250514'),
      schema: DescriptionSchema,
      prompt: `Genera la descripción del caso legal con la siguiente información:

${contextText}`,
      system: SYSTEM_PROMPT,
      temperature: 0.4,
    })

    return NextResponse.json({ description: object.description })
  } catch (err) {
    console.error('[generate-description] Error:', err)
    return NextResponse.json(
      { error: 'Error al generar la descripción' },
      { status: 500 }
    )
  }
}
