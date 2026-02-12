/**
 * Generates default draft title from document type and form data
 * Format: "Borrador {TIPO} - {ACTOR} C/ {DEMANDADO}" (or variant per type)
 */

import type { DocumentType } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'

export function getDefaultDraftTitle(
  documentType: DocumentType,
  formData: Record<string, string>
): string {
  const typeName = DOCUMENT_TYPE_CONFIG[documentType].label

  const get = (key: string) => (formData[key] ?? '').trim()
  const firstLine = (s: string) => s.split('\n')[0]?.trim().slice(0, 80) ?? s.slice(0, 80)

  switch (documentType) {
    case 'demanda':
    case 'contestacion': {
      const actor = documentType === 'demanda' ? get('actor') : get('demandante')
      const demandado = get('demandado')
      if (actor && demandado) return `Borrador ${typeName} - ${firstLine(actor)} C/ ${firstLine(demandado)}`
      if (actor) return `Borrador ${typeName} - ${firstLine(actor)}`
      if (demandado) return `Borrador ${typeName} - C/ ${firstLine(demandado)}`
      break
    }
    case 'apelacion':
    case 'casacion':
    case 'recurso_extraordinario': {
      const recurrente = get('recurrente')
      const recurrido = get('recurrido')
      if (recurrente && recurrido) return `Borrador ${typeName} - ${firstLine(recurrente)} C/ ${firstLine(recurrido)}`
      if (recurrente) return `Borrador ${typeName} - ${firstLine(recurrente)}`
      if (recurrido) return `Borrador ${typeName} - C/ ${firstLine(recurrido)}`
      break
    }
    case 'carta_documento': {
      const remitente = get('remitente')
      const destinatario = get('destinatario')
      if (remitente && destinatario) return `Borrador ${typeName} - ${firstLine(remitente)} a ${firstLine(destinatario)}`
      if (remitente) return `Borrador ${typeName} - ${firstLine(remitente)}`
      if (destinatario) return `Borrador ${typeName} - A ${firstLine(destinatario)}`
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
      const destinatario = get('destinatario')
      if (tribunal && destinatario) return `Borrador ${typeName} - ${firstLine(tribunal)}`
      if (tribunal) return `Borrador ${typeName} - ${firstLine(tribunal)}`
      if (destinatario) return `Borrador ${typeName} - A ${firstLine(destinatario)}`
      break
    }
  }

  const firstNonEmpty = Object.values(formData).find((v) => v?.trim())
  if (firstNonEmpty) return `Borrador ${typeName} - ${firstLine(firstNonEmpty)}`

  return `Borrador ${typeName} - ${new Date().toLocaleDateString('es-AR')}`
}
