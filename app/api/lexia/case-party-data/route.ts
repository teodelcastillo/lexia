/**
 * GET /api/lexia/case-party-data?caseId=xxx
 *
 * Returns actor/demandado data from a case for the Redactor form autocomplete.
 */
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { getCasePartyData, mapPartyDataToFormDefaults } from '@/lib/lexia/case-party-data'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const caseId = searchParams.get('caseId')

  if (!caseId) {
    return Response.json({ error: 'caseId required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
  if (!canView) {
    return Response.json({ error: 'Forbidden: no access to this case' }, { status: 403 })
  }

  const partyData = await getCasePartyData(supabase, caseId)
  if (!partyData) {
    return Response.json({ error: 'Case not found' }, { status: 404 })
  }

  const docTypes = [
    'demanda',
    'contestacion',
    'apelacion',
    'casacion',
    'recurso_extraordinario',
    'contrato',
    'mediacion',
    'carta_documento',
    'oficio_judicial',
  ] as const

  return Response.json({
    partyData,
    formDefaultsByRole: {
      actor: Object.fromEntries(
        docTypes.map((t) => [t, mapPartyDataToFormDefaults(partyData, t, 'actor')])
      ),
      demandado: Object.fromEntries(
        docTypes.map((t) => [t, mapPartyDataToFormDefaults(partyData, t, 'demandado')])
      ),
    },
  })
}
