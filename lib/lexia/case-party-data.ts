/**
 * Case Party Data - Extracts party data from a case for document drafting
 *
 * Uses neutral naming: our_client (quien representamos) vs opposing_party (contraparte).
 * El mapeo a actor/demandado depende de si representamos al demandante o al demandado.
 */

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

/** Structured party data for form autocomplete */
export interface PartyStructuredData {
  tipo: 'persona_fisica' | 'persona_juridica'
  nombre?: string
  apellido?: string
  edad?: string
  razon_social?: string
  documento_tipo?: string
  documento?: string
  domicilio_real?: string
  domicilio_legal?: string
}

export interface CasePartyData {
  /** Nuestro cliente (empresa/persona que representamos) */
  our_client: string
  /** Contraparte (la otra parte en el litigio) */
  opposing_party: string
  /** Combinado para contratos/mediaciones */
  partes: string
  /** Structured data for form autocomplete */
  our_client_structured?: PartyStructuredData
  opposing_party_structured?: PartyStructuredData
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
  const name = p.name ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sin nombre')
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
  let ourClientStructured: PartyStructuredData | undefined
  if (company) {
    ourClient = formatCompany(company)
    ourClientStructured = companyToStructured(company)
    const rep = clientReps[0]?.people
    if (rep) {
      const repStr = formatPerson(rep)
      ourClient = `${ourClient}. Representante: ${repStr}`
    }
  } else if (clientReps[0]?.people) {
    ourClient = formatPerson(clientReps[0].people)
    ourClientStructured = personToStructured(clientReps[0].people)
  }

  const opposingParts = opposing
    .filter((p) => p.people)
    .map((p) => formatPerson(p.people!))
  const opposingParty = opposingParts.length > 0 ? opposingParts.join('\n\n') : ''
  const opposingStructured = opposing[0]?.people
    ? personToStructured(opposing[0].people)
    : undefined

  const partes: string[] = []
  if (ourClient) partes.push(`NUESTRO CLIENTE: ${ourClient}`)
  if (opposingParty) partes.push(`CONTRAPARTE: ${opposingParty}`)
  const partesStr = partes.length > 0 ? partes.join('\n\n') : ''

  return {
    our_client: ourClient,
    opposing_party: opposingParty,
    partes: partesStr,
    our_client_structured: ourClientStructured,
    opposing_party_structured: opposingStructured,
  }
}

function personToStructured(p: {
  first_name?: string | null
  last_name?: string | null
  dni?: string | null
  cuit?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  company_name?: string | null
}): PartyStructuredData {
  const hasCompany = !!(p.company_name?.trim())
  const domicilio = [p.address, p.city, p.province].filter(Boolean).join(', ')
  if (hasCompany) {
    return {
      tipo: 'persona_juridica',
      razon_social: p.company_name ?? '',
      documento_tipo: p.cuit ? 'CUIT' : '',
      documento: p.cuit ?? '',
      domicilio_real: domicilio || undefined,
    }
  }
  return {
    tipo: 'persona_fisica',
    nombre: p.first_name ?? '',
    apellido: p.last_name ?? '',
    documento_tipo: p.dni ? 'DNI' : p.cuit ? 'CUIT' : '',
    documento: p.dni ?? p.cuit ?? '',
    domicilio_real: domicilio || undefined,
  }
}

function companyToStructured(c: {
  company_name?: string | null
  legal_name?: string | null
  cuit?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
}): PartyStructuredData {
  const domicilio = [c.address, c.city, c.province].filter(Boolean).join(', ')
  return {
    tipo: 'persona_juridica',
    razon_social: c.legal_name ?? c.company_name ?? '',
    documento_tipo: c.cuit ? 'CUIT' : '',
    documento: c.cuit ?? '',
    domicilio_real: domicilio || undefined,
  }
}

function structuredToFormDefaults(prefix: string, s: PartyStructuredData): Record<string, string> {
  const out: Record<string, string> = {}
  out[`${prefix}_tipo`] = s.tipo
  if (s.nombre) out[`${prefix}_nombre`] = s.nombre
  if (s.apellido) out[`${prefix}_apellido`] = s.apellido
  if (s.edad) out[`${prefix}_edad`] = s.edad
  if (s.razon_social) out[`${prefix}_razon_social`] = s.razon_social
  if (s.documento_tipo) out[`${prefix}_documento_tipo`] = s.documento_tipo
  if (s.documento) out[`${prefix}_documento`] = s.documento
  if (s.domicilio_real) out[`${prefix}_domicilio_real`] = s.domicilio_real
  if (s.domicilio_legal) out[`${prefix}_domicilio_legal`] = s.domicilio_legal
  return out
}

/** Mapea datos de parte al formato CD (Carta Documento oficial Correo Argentino) */
function partyToCartaDocumentoFormat(prefix: string, s: PartyStructuredData): Record<string, string> {
  const linea1 =
    s.tipo === 'persona_juridica'
      ? (s.razon_social ?? '').trim()
      : [s.apellido, s.nombre].filter(Boolean).join(', ').trim()
  return {
    [`${prefix}_linea1`]: linea1,
    [`${prefix}_domicilio`]: s.domicilio_real ?? '',
  }
}

/**
 * Maps CasePartyData to form field defaults by document type.
 * clientRole: si nuestro cliente es actor (demandante) o demandado.
 * Returns structured party fields for the new form (actor_nombre, actor_apellido, etc.).
 */
export function mapPartyDataToFormDefaults(
  partyData: CasePartyData,
  documentType: string,
  clientRole: ClientRole = 'actor'
): Record<string, string> {
  const { our_client, opposing_party, partes, our_client_structured, opposing_party_structured } = partyData
  const actorStruct = clientRole === 'actor' ? our_client_structured : opposing_party_structured
  const demandadoStruct = clientRole === 'actor' ? opposing_party_structured : our_client_structured
  const defaults: Record<string, string> = {}

  const applyStructured = (prefix: string, s: PartyStructuredData | undefined) => {
    if (s) Object.assign(defaults, structuredToFormDefaults(prefix, s))
  }

  switch (documentType) {
    case 'demanda':
      applyStructured('actor', actorStruct)
      applyStructured('demandado', demandadoStruct)
      break
    case 'contestacion':
      applyStructured('demandante', actorStruct)
      applyStructured('demandado', demandadoStruct)
      break
    case 'apelacion':
    case 'casacion':
    case 'recurso_extraordinario':
      applyStructured('recurrente', actorStruct)
      applyStructured('recurrido', demandadoStruct)
      break
    case 'contrato':
    case 'mediacion':
      defaults.partes = partes
      break
    case 'carta_documento': {
      applyStructured('remitente', actorStruct)
      applyStructured('destinatario', demandadoStruct)
      // Formato CD oficial: mapear a campos remitente/destinatario + firmante
      if (actorStruct) {
        Object.assign(defaults, partyToCartaDocumentoFormat('remitente', actorStruct))
        const apellidoNombres =
          actorStruct.tipo === 'persona_juridica'
            ? actorStruct.razon_social ?? ''
            : [actorStruct.apellido, actorStruct.nombre].filter(Boolean).join(' ')
        defaults.apellido_nombres = apellidoNombres.trim()
        defaults.documento_tipo = actorStruct.documento_tipo ?? ''
        defaults.documento_numero = actorStruct.documento ?? ''
      }
      if (demandadoStruct) {
        Object.assign(defaults, partyToCartaDocumentoFormat('destinatario', demandadoStruct))
      }
      break
    }
    case 'oficio_judicial':
      applyStructured('destinatario', demandadoStruct)
      break
    default:
      break
  }

  return defaults
}
