/**
 * Party (actor/demandado) utilities for Lexia Redactor.
 * Builds display names and combined text from structured party form data.
 */

import type { DocumentType } from '@/lib/ai/draft-schemas'

export type PartyType = 'persona_fisica' | 'persona_juridica'
export type DocumentoTipo = 'DNI' | 'PASAPORTE' | 'CUIT'

const PARTY_PAIRS: Record<DocumentType, [string, string] | [string] | []> = {
  demanda: ['actor', 'demandado'],
  contestacion: ['demandante', 'demandado'],
  apelacion: ['recurrente', 'recurrido'],
  casacion: ['recurrente', 'recurrido'],
  recurso_extraordinario: ['recurrente', 'recurrido'],
  contrato: [], // usa "partes"
  carta_documento: ['remitente', 'destinatario'],
  mediacion: [], // usa "partes"
  oficio_judicial: ['destinatario'],
}

function get(
  formData: Record<string, string>,
  key: string
): string {
  return (formData[key] ?? '').trim()
}

function buildPartyDisplay(formData: Record<string, string>, prefix: string): string {
  const tipo = get(formData, `${prefix}_tipo`) as PartyType | ''
  if (!tipo) return ''

  if (tipo === 'persona_juridica') {
    const razon = get(formData, `${prefix}_razon_social`)
    if (razon) return razon
  }

  const nombre = get(formData, `${prefix}_nombre`)
  const apellido = get(formData, `${prefix}_apellido`)
  if (nombre || apellido) {
    return [nombre, apellido].filter(Boolean).join(' ')
  }

  return get(formData, `${prefix}_razon_social`)
}

/**
 * Builds display name for draft title (e.g. "Juan Pérez" or "Empresa SA")
 */
export function buildPartyDisplayName(
  formData: Record<string, string>,
  prefix: string
): string {
  return buildPartyDisplay(formData, prefix)
}

/**
 * Builds full party text for AI prompt (complete legal description)
 */
export function buildPartyForPrompt(
  formData: Record<string, string>,
  prefix: string
): string {
  const tipo = get(formData, `${prefix}_tipo`) as PartyType | ''
  if (!tipo) return ''

  const parts: string[] = []

  if (tipo === 'persona_fisica') {
    const nombre = get(formData, `${prefix}_nombre`)
    const apellido = get(formData, `${prefix}_apellido`)
    if (nombre || apellido) {
      parts.push([nombre, apellido].filter(Boolean).join(' '))
    }
    const edad = get(formData, `${prefix}_edad`)
    if (edad) parts.push(`Edad: ${edad} años`)
  } else {
    const razon = get(formData, `${prefix}_razon_social`)
    if (razon) parts.push(`Razón social: ${razon}`)
  }

  const docTipo = get(formData, `${prefix}_documento_tipo`)
  const doc = get(formData, `${prefix}_documento`)
  if (docTipo && doc) {
    parts.push(`${docTipo}: ${doc}`)
  } else if (doc) {
    parts.push(`Documento: ${doc}`)
  }

  const domReal = get(formData, `${prefix}_domicilio_real`)
  if (domReal) parts.push(`Domicilio real: ${domReal}`)

  const domLegal = get(formData, `${prefix}_domicilio_legal`)
  if (domLegal) parts.push(`Domicilio legal: ${domLegal}`)

  return parts.join('. ')
}

/**
 * Builds formData with combined actor/demandado etc. from structured fields.
 * Used before sending to AI prompt. Replaces structured fields with legacy keys.
 */
export function normalizeFormDataForPrompt(
  formData: Record<string, string>,
  documentType: DocumentType
): Record<string, string> {
  const result: Record<string, string> = {}
  const prefixes = getPartyPrefixes(documentType)

  for (const [key, value] of Object.entries(formData)) {
    const isPartyField = prefixes.some((p) => key.startsWith(p + '_'))
    if (isPartyField) continue
    result[key] = value
  }

  for (const prefix of prefixes) {
    const combined = buildPartyForPrompt(formData, prefix)
    if (combined) {
      result[prefix] = combined
    }
  }

  return result
}

export function getPartyPrefixes(documentType: DocumentType): string[] {
  const pairs = PARTY_PAIRS[documentType]
  return pairs ? [...pairs] : []
}
