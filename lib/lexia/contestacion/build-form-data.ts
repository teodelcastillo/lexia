/**
 * Contestación de Demanda - Build Form Data from Session
 *
 * Builds Record<string, string> compatible with draft API from session state.
 * Merges form_data_consolidado with case party data (demandante/demandado).
 */

import type { ContestacionSessionState, FormDataConsolidado } from './types'
import { getCasePartyData, mapPartyDataToFormDefaults } from '@/lib/lexia/case-party-data'
import type { SupabaseClient } from '@supabase/supabase-js'

function consolidadoToRecord(fc: FormDataConsolidado): Record<string, string> {
  return {
    hechos_admitidos: fc.hechos_admitidos ?? '',
    hechos_negados: fc.hechos_negados ?? '',
    defensas: fc.defensas ?? '',
    excepciones: fc.excepciones ?? '',
  }
}

/**
 * Builds formData for contestación draft from session state.
 * Merges form_data_consolidado with party data from case (demandante = actor, demandado = our client).
 */
export async function buildFormDataFromSession(
  state: ContestacionSessionState,
  supabase: SupabaseClient,
  caseId: string | null
): Promise<Record<string, string>> {
  const fc = state.form_data_consolidado
  const base: Record<string, string> = fc ? consolidadoToRecord(fc) : {}

  if (caseId) {
    const partyData = await getCasePartyData(supabase, caseId)
    if (partyData) {
      const partyDefaults = mapPartyDataToFormDefaults(
        partyData,
        'contestacion',
        'demandado'
      )
      Object.assign(base, partyDefaults)
    }
  }

  return base
}
