/**
 * Case Party Data - Extracts party data from a case for document drafting
 *
 * Uses neutral naming: our_client (quien representamos) vs opposing_party (contraparte).
 * El mapeo a actor/demandado depende de si representamos al demandante o al demandado.
 */

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

export interface CasePartyData {
  /** Nuestro cliente (empresa/persona que representamos) */
  our_client: string
  /** Contraparte (la otra parte en el litigio) */
  opposing_party: string
  /** Combinado para contratos/mediaciones */
  partes: string
}

/** Rol de nuestro cliente en el documento: actor (demandante) o demandado */
export type ClientRole = 'actor' | 'demandado'

function formatPerson(p: {
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  dni?: string | null
  cuit?: string | null
  company_name?: string | null
}): string {
  const name = p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sin nombre'
  const parts: string[] = [name]
  if (p.dni) parts.push(`DNI: ${p.dni}`)
  if (p.cuit) parts.push(`CUIT: ${p.cuit}`)
  if (p.email) parts.push(`Email: ${p.email}`)
  if (p.phone) parts.push(`Tel: ${p.phone}`)
  const domicilio = [p.address, p.city, p.province].filter(Boolean).join(', ')
  if (domicilio) parts.push(`Domicilio: ${domicilio}`)
  if (p.company_name) parts.push(`Razón social: ${p.company_name}`)
  return parts.join('. ')
}

function formatCompany(c: {
  company_name?: string | null
  legal_name?: string | null
  cuit?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  email?: string | null
  phone?: string | null
}): string {
  const name = c.legal_name ?? c.company_name ?? 'Sin nombre'
  const parts: string[] = [name]
  if (c.cuit) parts.push(`CUIT: ${c.cuit}`)
  if (c.address || c.city) {
    const domicilio = [c.address, c.city, c.province].filter(Boolean).join(', ')
    parts.push(`Domicilio: ${domicilio}`)
  }
  if (c.email) parts.push(`Email: ${c.email}`)
  if (c.phone) parts.push(`Tel: ${c.phone}`)
  return parts.join('. ')
}

/**
 * Fetches case party data (actor = client, demandado = opposing party)
 * for use in document drafting forms.
 */
export async function getCasePartyData(
  supabase: SupabaseClient,
  caseId: string
): Promise<CasePartyData | null> {
  const { data: caseRow, error } = await supabase
    .from('cases')
    .select(`
      id,
      company_id,
      companies (
        id,
        company_name,
        legal_name,
        cuit,
        address,
        city,
        province,
        email,
        phone
      ),
      case_participants (
        id,
        role,
        people (
          id,
          name,
          first_name,
          last_name,
          email,
          phone,
          address,
          city,
          province,
          dni,
          cuit,
          company_name
        )
      )
    `)
    .eq('id', caseId)
    .single()

  if (error || !caseRow) return null

  const company = caseRow.companies as {
    company_name?: string
    legal_name?: string
    cuit?: string
    address?: string
    city?: string
    province?: string
    email?: string
    phone?: string
  } | null

  const participants = (caseRow.case_participants ?? []) as Array<{
    role: string
    people: {
      name?: string
      first_name?: string
      last_name?: string
      email?: string
      phone?: string
      address?: string
      city?: string
      province?: string
      dni?: string
      cuit?: string
      company_name?: string
    } | null
  }>

  const clientReps = participants.filter((p) => p.role === 'client_representative')
  const opposing = participants.filter((p) => p.role === 'opposing_party')

  let ourClient = ''
  if (company) {
    ourClient = formatCompany(company)
    const rep = clientReps[0]?.people
    if (rep) {
      const repStr = formatPerson(rep)
      ourClient = `${ourClient}. Representante: ${repStr}`
    }
  } else if (clientReps[0]?.people) {
    ourClient = formatPerson(clientReps[0].people)
  }

  const opposingParts = opposing
    .filter((p) => p.people)
    .map((p) => formatPerson(p.people!))
  const opposingParty = opposingParts.length > 0 ? opposingParts.join('\n\n') : ''

  const partes: string[] = []
  if (ourClient) partes.push(`NUESTRO CLIENTE: ${ourClient}`)
  if (opposingParty) partes.push(`CONTRAPARTE: ${opposingParty}`)
  const partesStr = partes.length > 0 ? partes.join('\n\n') : ''

  return { our_client: ourClient, opposing_party: opposingParty, partes: partesStr }
}

/**
 * Maps CasePartyData to form field defaults by document type.
 * clientRole: si nuestro cliente es actor (demandante) o demandado.
 */
export function mapPartyDataToFormDefaults(
  partyData: CasePartyData,
  documentType: string,
  clientRole: ClientRole = 'actor'
): Record<string, string> {
  const { our_client, opposing_party, partes } = partyData
  const actor = clientRole === 'actor' ? our_client : opposing_party
  const demandado = clientRole === 'actor' ? opposing_party : our_client
  const defaults: Record<string, string> = {}

  switch (documentType) {
    case 'demanda':
      defaults.actor = actor
      defaults.demandado = demandado
      break
    case 'contestacion':
      defaults.demandante = actor
      defaults.demandado = demandado
      break
    case 'apelacion':
    case 'casacion':
    case 'recurso_extraordinario':
      defaults.recurrente = actor
      defaults.recurrido = demandado
      break
    case 'contrato':
    case 'mediacion':
      defaults.partes = partes
      break
    case 'carta_documento':
      defaults.remitente = actor
      defaults.destinatario = demandado
      break
    case 'oficio_judicial':
      defaults.destinatario = demandado || ''
      break
    default:
      break
  }

  return defaults
}
