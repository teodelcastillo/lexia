/**
 * SAC Team Credentials API
 *
 * GET /api/sac/cases/[caseId]/team-credentials
 *
 * Returns the case's team members with their SAC credentials status.
 * Used by the link form to show which lawyers can be selected.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
    if (!canView) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: assignments } = await supabase
      .from('case_assignments')
      .select(`
        user_id,
        case_role,
        profiles!case_assignments_user_id_fkey (
          id,
          first_name,
          last_name,
          system_role
        )
      `)
      .eq('case_id', caseId)

    if (!assignments) {
      return NextResponse.json({ members: [] })
    }

    const lawyerIds = assignments
      .filter((a) => {
        const profile = a.profiles as { system_role: string } | null
        return profile && ['case_leader', 'lawyer_executive', 'admin_general'].includes(profile.system_role)
      })
      .map((a) => a.user_id)

    // Check SAC credentials for each lawyer
    const { data: credentials } = await supabase
      .from('lawyer_sac_credentials')
      .select('profile_id, is_active')
      .in('profile_id', lawyerIds.length > 0 ? lawyerIds : ['__none__'])

    const credMap = new Map(
      (credentials || []).map((c) => [c.profile_id, c.is_active])
    )

    const members = assignments
      .filter((a) => {
        const profile = a.profiles as { system_role: string } | null
        return profile && profile.system_role !== 'client'
      })
      .map((a) => {
        const profile = a.profiles as {
          id: string
          first_name: string
          last_name: string
          system_role: string
        }
        return {
          user_id: a.user_id,
          case_role: a.case_role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          system_role: profile.system_role,
          has_sac_credentials: credMap.has(a.user_id),
          sac_credentials_active: credMap.get(a.user_id) ?? false,
        }
      })

    return NextResponse.json({ members })
  } catch (err) {
    console.error('[SAC team-credentials]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
