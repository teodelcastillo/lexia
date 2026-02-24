/**
 * SAC Sync Service
 *
 * Core logic for synchronizing a single case with the SAC extranet.
 * Used by both the manual sync API and the daily cron job.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from './crypto'
import { scrapeSacCase } from './scraper'
import { detectDeadline } from './deadline-detector'
import { notifySacNewMovements } from '@/lib/services/notifications'
import type { SacSyncResult, SacParsedMovement } from './types'

interface SyncCaseParams {
  caseId: string
  caseNumber: string
  caseTitle: string
  expedienteNumber: string
  anio: string
  fuero?: string
  lawyerId: string
  organizationId: string
  supabase: SupabaseClient
  triggeredBy?: string
}

/**
 * Synchronize a single case with the SAC extranet.
 *
 * 1. Read and decrypt lawyer credentials
 * 2. Scrape the SAC case page
 * 3. Insert new movements (UNIQUE constraint prevents duplicates)
 * 4. Update case metadata
 * 5. Log the sync
 * 6. Notify team if new movements found
 */
export async function syncSacCase(params: SyncCaseParams): Promise<SacSyncResult> {
  const start = Date.now()
  const {
    caseId,
    caseNumber,
    caseTitle,
    expedienteNumber,
    anio,
    fuero,
    lawyerId,
    organizationId,
    supabase,
    triggeredBy,
  } = params

  try {
    // 1. Get credentials
    const { data: creds } = await supabase
      .from('lawyer_sac_credentials')
      .select('encrypted_password, extranet_username, is_active, consecutive_failures')
      .eq('profile_id', lawyerId)
      .single()

    if (!creds || !creds.is_active) {
      const result: SacSyncResult = {
        status: 'skipped',
        movements_found: 0,
        new_movements_inserted: 0,
        error_message: 'Credenciales SAC no activas o no encontradas',
        duration_ms: Date.now() - start,
      }
      await logSync(supabase, caseId, organizationId, lawyerId, result)
      return result
    }

    if (creds.consecutive_failures >= 5) {
      const result: SacSyncResult = {
        status: 'skipped',
        movements_found: 0,
        new_movements_inserted: 0,
        error_message: 'Demasiados intentos fallidos consecutivos. Actualice las credenciales.',
        duration_ms: Date.now() - start,
      }
      await logSync(supabase, caseId, organizationId, lawyerId, result)
      return result
    }

    let password: string
    try {
      password = decrypt(creds.encrypted_password)
    } catch {
      const result: SacSyncResult = {
        status: 'error',
        movements_found: 0,
        new_movements_inserted: 0,
        error_message: 'No se pudo desencriptar la contraseña',
        duration_ms: Date.now() - start,
      }
      await logSync(supabase, caseId, organizationId, lawyerId, result)
      return result
    }

    // 2. Scrape
    const caseData = await scrapeSacCase(
      creds.extranet_username,
      password,
      expedienteNumber,
      anio,
      fuero
    )

    if (caseData.loginError) {
      // Update failed login tracking
      await supabase
        .from('lawyer_sac_credentials')
        .update({
          last_failed_login: new Date().toISOString(),
          consecutive_failures: (creds.consecutive_failures ?? 0) + 1,
        })
        .eq('profile_id', lawyerId)

      const result: SacSyncResult = {
        status: 'auth_failed',
        movements_found: 0,
        new_movements_inserted: 0,
        error_message: caseData.loginError,
        duration_ms: Date.now() - start,
      }
      await logSync(supabase, caseId, organizationId, lawyerId, result)
      return result
    }

    // Login succeeded — reset failure counter
    await supabase
      .from('lawyer_sac_credentials')
      .update({
        last_successful_login: new Date().toISOString(),
        consecutive_failures: 0,
      })
      .eq('profile_id', lawyerId)

    // 3. Insert movements
    const newCount = await insertMovements(
      supabase,
      caseId,
      organizationId,
      lawyerId,
      caseData.movements
    )

    // 4. Update case metadata
    await supabase
      .from('cases')
      .update({
        sac_estado_actual: caseData.estado_actual ?? null,
        sac_caratula: caseData.caratula ?? null,
        sac_juzgado: caseData.juzgado ?? null,
        sac_secretaria: caseData.secretaria ?? null,
        sac_last_sync: new Date().toISOString(),
      })
      .eq('id', caseId)

    const status = caseData.movements.length === 0
      ? 'no_changes' as const
      : 'success' as const

    const result: SacSyncResult = {
      status,
      movements_found: caseData.movements.length,
      new_movements_inserted: newCount,
      duration_ms: Date.now() - start,
      case_data: caseData,
    }

    // 5. Log
    await logSync(supabase, caseId, organizationId, lawyerId, result)

    // 6. Notify if new movements
    if (newCount > 0) {
      await notifySacNewMovements(
        caseId,
        caseNumber,
        caseTitle,
        newCount,
        triggeredBy,
        { supabase }
      )
    }

    return result
  } catch (err) {
    const result: SacSyncResult = {
      status: 'error',
      movements_found: 0,
      new_movements_inserted: 0,
      error_message: err instanceof Error ? err.message : 'Error desconocido',
      duration_ms: Date.now() - start,
    }
    await logSync(supabase, caseId, organizationId, lawyerId, result).catch(() => {})
    return result
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertMovements(
  supabase: SupabaseClient,
  caseId: string,
  organizationId: string,
  lawyerId: string,
  movements: SacParsedMovement[]
): Promise<number> {
  if (movements.length === 0) return 0

  let inserted = 0

  for (const mov of movements) {
    // Parse date — SAC dates may be dd/MM/yyyy
    let fechaIso = mov.fecha
    const ddMmYyyy = mov.fecha.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
    if (ddMmYyyy) {
      const [, d, m, y] = ddMmYyyy
      fechaIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    const { error } = await supabase.from('sac_movements').insert({
      case_id: caseId,
      organization_id: organizationId,
      fecha: fechaIso,
      tipo: mov.tipo,
      descripcion: mov.descripcion,
      folio: mov.folio || null,
      secretaria_mov: mov.secretaria_mov || null,
      synced_by_lawyer_id: lawyerId,
      is_new: true,
      raw_data: mov.raw_data || null,
    })

    if (!error) {
      inserted++

      // Run deadline detection on newly inserted movements
      const movDate = new Date(fechaIso)
      if (!isNaN(movDate.getTime())) {
        const suggestion = detectDeadline(mov.descripcion, mov.tipo, movDate)
        if (suggestion.detected) {
          // Store the suggestion in raw_data for the UI to pick up
          await supabase
            .from('sac_movements')
            .update({
              raw_data: {
                ...(mov.raw_data || {}),
                deadline_suggestion: suggestion,
              },
            })
            .eq('case_id', caseId)
            .eq('fecha', fechaIso)
            .eq('tipo', mov.tipo)
            .eq('descripcion', mov.descripcion)
        }
      }
    }
    // UNIQUE constraint violation → movement already exists, skip silently
  }

  return inserted
}

async function logSync(
  supabase: SupabaseClient,
  caseId: string,
  organizationId: string,
  lawyerId: string,
  result: SacSyncResult
): Promise<void> {
  await supabase.from('sac_sync_log').insert({
    case_id: caseId,
    organization_id: organizationId,
    lawyer_id: lawyerId,
    status: result.status,
    movements_found: result.movements_found,
    error_message: result.error_message || null,
    duration_ms: result.duration_ms,
  })
}
