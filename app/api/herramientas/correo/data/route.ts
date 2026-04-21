/**
 * API: Data for Quick Email tool
 * Returns people (contacts with email), cases, and companies for the current user.
 * Used for autocomplete and template context (case status, client report).
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export type ContactItem = {
  id: string
  name: string | null
  email: string
  company_name: string | null
  person_type: string | null
}

export type CaseItem = {
  id: string
  case_number: string
  title: string
  status: string
  company_id: string | null
  companies?: { id: string; company_name: string; name: string | null } | null
}

export type CompanyItem = {
  id: string
  company_name: string
  name: string | null
  email: string | null
}

/** GET: contacts (people with email), cases, companies */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') // 'contacts' | 'cases' | 'companies' | 'case-detail' | 'client-cases'
    const caseId = searchParams.get('caseId')
    const companyId = searchParams.get('companyId')
    const search = searchParams.get('search') ?? ''

    if (mode === 'case-detail' && caseId) {
      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          status,
          company_id,
          companies ( id, company_name, name )
        `)
        .eq('id', caseId)
        .single()

      if (caseErr || !caseRow) {
        return NextResponse.json({ case: null, deadlines: [] })
      }

      const { data: deadlines } = await supabase
        .from('deadlines')
        .select('id, title, due_date, deadline_type, status, is_completed')
        .eq('case_id', caseId)
        .eq('is_completed', false)
        .gte('due_date', new Date().toISOString().slice(0, 10))
        .order('due_date', { ascending: true })
        .limit(10)

      return NextResponse.json({
        case: caseRow,
        deadlines: deadlines ?? [],
      })
    }

    if (mode === 'client-cases' && companyId) {
      const { data: cases, error: casesErr } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          status,
          company_id
        `)
        .eq('company_id', companyId)
        .in('status', ['active', 'pending', 'on_hold'])
        .order('updated_at', { ascending: false })

      if (casesErr) {
        return NextResponse.json({ cases: [] })
      }

      const caseIds = (cases ?? []).map((c) => c.id)
      if (caseIds.length === 0) {
        return NextResponse.json({ cases: cases ?? [], deadlinesByCase: {} })
      }

      const { data: deadlines } = await supabase
        .from('deadlines')
        .select('id, case_id, title, due_date, deadline_type')
        .in('case_id', caseIds)
        .eq('is_completed', false)
        .gte('due_date', new Date().toISOString().slice(0, 10))
        .order('due_date', { ascending: true })

      const deadlinesByCase: Record<string, Array<{ title: string; due_date: string; deadline_type: string | null }>> = {}
      for (const d of deadlines ?? []) {
        if (!deadlinesByCase[d.case_id]) deadlinesByCase[d.case_id] = []
        deadlinesByCase[d.case_id].push({
          title: d.title,
          due_date: d.due_date,
          deadline_type: d.deadline_type,
        })
      }

      return NextResponse.json({
        cases: cases ?? [],
        deadlinesByCase,
      })
    }

    const [peopleRes, casesRes, companiesRes] = await Promise.all([
      supabase
        .from('people')
        .select('id, name, email, company_name, person_type')
        .eq('is_active', true)
        .not('email', 'is', null)
        .order('name', { ascending: true }),
      mode !== 'companies'
        ? supabase
            .from('cases')
            .select(`
              id,
              case_number,
              title,
              status,
              company_id,
              companies ( id, company_name, name )
            `)
            .in('status', ['active', 'pending', 'on_hold'])
            .order('updated_at', { ascending: false })
            .limit(200)
        : { data: [] as CaseItem[] },
      supabase
        .from('companies')
        .select('id, company_name, name, email')
        .eq('is_active', true)
        .eq('company_type', 'client')
        .order('company_name', { ascending: true }),
    ])

    let contacts: ContactItem[] = (peopleRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? null,
      email: p.email,
      company_name: p.company_name ?? null,
      person_type: p.person_type ?? null,
    }))

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      contacts = contacts.filter(
        (c) =>
          (c.name?.toLowerCase().includes(q) ?? false) ||
          c.email.toLowerCase().includes(q) ||
          (c.company_name?.toLowerCase().includes(q) ?? false)
      )
    }

    const cases = (casesRes.data ?? []) as CaseItem[]
    const companies: CompanyItem[] = (companiesRes.data ?? []).map((c) => ({
      id: c.id,
      company_name: c.company_name,
      name: c.name ?? null,
      email: c.email ?? null,
    }))

    return NextResponse.json({
      contacts,
      cases,
      companies,
    })
  } catch (e) {
    console.error('[correo/data]', e)
    return NextResponse.json(
      { error: 'Error al cargar datos' },
      { status: 500 }
    )
  }
}
