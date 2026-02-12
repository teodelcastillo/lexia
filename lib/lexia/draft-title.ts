/**
 * Generates default draft title from document type and form data
 * Format: "Borrador {TIPO} - {ACTOR} C/ {DEMANDADO}" (or variant per type)
 * Supports both structured (actor_nombre, actor_apellido) and legacy (actor) form data.
 */

import type { DocumentType } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import { buildPartyDisplayName } from '@/lib/lexia/party-utils'

export function getDefaultDraftTitle(
  documentType: DocumentType,
  formData: Record<string, string>
): string {
  const typeName = DOCUMENT_TYPE_CONFIG[documentType].label

  const get = (key: string) => (formData[key] ?? '').trim()
  const firstLine = (s: string) => s.split('\n')[0]?.trim().slice(0, 80) ?? s.slice(0, 80)
  const getPartyDisplay = (prefix: string) => {
    const d = buildPartyDisplayName(formData, prefix)
    return d ? firstLine(d) : ''
  }

  switch (documentType) {
    case 'demanda':
    case 'contestacion': {
      const actorPrefix = documentType === 'demanda' ? 'actor' : 'demandante'
      const actor = getPartyDisplay(actorPrefix) || get(actorPrefix) || (documentType === 'demanda' ? get('actor') : get('demandante'))
      const demandado = getPartyDisplay('demandado') || get('demandado')
      if (actor && demandado) return `Borrador ${typeName} - ${actor} C/ ${demandado}`
      if (actor) return `Borrador ${typeName} - ${actor}`
      if (demandado) return `Borrador ${typeName} - C/ ${demandado}`
      break
    }
    case 'apelacion':
    case 'casacion':
    case 'recurso_extraordinario': {
      const recurrente = getPartyDisplay('recurrente') || get('recurrente')
      const recurrido = getPartyDisplay('recurrido') || get('recurrido')
      if (recurrente && recurrido) return `Borrador ${typeName} - ${recurrente} C/ ${recurrido}`
      if (recurrente) return `Borrador ${typeName} - ${recurrente}`
      if (recurrido) return `Borrador ${typeName} - C/ ${recurrido}`
      break
    }
    case 'carta_documento': {
      const remitente = getPartyDisplay('remitente') || get('remitente')
      const destinatario = getPartyDisplay('destinatario') || get('destinatario')
      if (remitente && destinatario) return `Borrador ${typeName} - ${remitente} a ${destinatario}`
      if (remitente) return `Borrador ${typeName} - ${remitente}`
      if (destinatario) return `Borrador ${typeName} - A ${destinatario}`
      break
    }
    case 'contrato':
    case 'mediacion': {
      const partes = get('partes')
      if (partes) return `Borrador ${typeName} - ${firstLine(partes)}`
      break
    }
    case 'oficio_judicial': {
      const tribunal = get('tribunal')
      const destinatario = getPartyDisplay('destinatario') || get('destinatario')
      if (tribunal && destinatario) return `Borrador ${typeName} - ${firstLine(tribunal)}`
      if (tribunal) return `Borrador ${typeName} - ${firstLine(tribunal)}`
      if (destinatario) return `Borrador ${typeName} - A ${destinatario}`
      break
    }
  }

  const firstNonEmpty = Object.values(formData).find((v) => v?.trim())
  if (firstNonEmpty) return `Borrador ${typeName} - ${firstLine(firstNonEmpty)}`

  return `Borrador ${typeName} - ${new Date().toLocaleDateString('es-AR')}`
}
