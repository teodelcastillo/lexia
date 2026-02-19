/**
 * Contestación de Demanda - Select Structure/Variant
 *
 * Maps tipo_demanda_detectado to a contestación template variant.
 * Returns '' if no specific variant exists (use standard template).
 */

import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { DemandBlock } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const SELECT_MODEL = 'openai/gpt-4o-mini'

const SelectStructureSchema = z.object({
  variant: z.string().describe('Variant key: empty string for standard, or e.g. incumplimiento_locacion if demand type matches'),
})

const DEMANDA_TO_CONTESTACION_VARIANT: Record<string, string> = {
  incumplimiento_locacion: 'incumplimiento_locacion',
  incumplimiento_compraventa: 'incumplimiento_compraventa',
  incumplimiento_suministro: 'incumplimiento_suministro',
  incumplimiento_servicios: 'incumplimiento_servicios',
}

async function getContestacionVariants(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('lexia_document_templates')
    .select('variant')
    .eq('document_type', 'contestacion')
    .eq('is_active', true)
    .or('organization_id.is.null,organization_id.not.is.null')

  const variants = [...new Set((data ?? []).map((r) => (r.variant ?? '').trim()).filter(Boolean))]
  return variants
}

/**
 * Selects contestación template variant based on demand type.
 * Queries lexia_document_templates for available contestacion variants.
 * Returns '' for standard template if no matching variant exists.
 */
export async function selectContestacionStructure(
  tipoDemandaDetectado: string | undefined,
  bloques: DemandBlock[],
  supabase: SupabaseClient
): Promise<string> {
  const templatesDisponibles = await getContestacionVariants(supabase)
  const tipo = (tipoDemandaDetectado ?? '').toLowerCase().replace(/\s+/g, '_')
  const directMatch = DEMANDA_TO_CONTESTACION_VARIANT[tipo]
  if (directMatch && templatesDisponibles.includes(directMatch)) {
    return directMatch
  }

  if (templatesDisponibles.length === 0) {
    return ''
  }

  try {
    const { object: raw } = await generateObject({
      model: resolveModel(SELECT_MODEL),
      schema: zodSchema(SelectStructureSchema),
      prompt: `Tipo de demanda detectado: "${tipoDemandaDetectado ?? 'desconocido'}"
Bloques: ${bloques.map((b) => b.titulo).join(', ')}
Variantes disponibles: ${templatesDisponibles.join(', ') || '(ninguna)'}

Elegí la variante de contestación que mejor coincida. Si no hay coincidencia clara, retorná variant vacío "".`,
      system: 'Eres un asistente que selecciona la plantilla de contestación adecuada según el tipo de demanda.',
      maxTokens: 64,
      temperature: 0.1,
    } as Parameters<typeof generateObject>[0] & { maxTokens?: number })
    const object = raw as z.infer<typeof SelectStructureSchema>

    const v = (object.variant ?? '').trim()
    return templatesDisponibles.includes(v) ? v : ''
  } catch (err) {
    console.error('[Contestacion] selectContestacionStructure error:', err)
    return ''
  }
}
