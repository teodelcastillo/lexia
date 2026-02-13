/**
 * Lexia Document Drafting - Form Schemas & Validation
 *
 * Defines DOCUMENT_TYPE_SCHEMAS for the Redactor Jurídico module.
 * Each document type maps to form fields and a zod validation schema.
 */

import { z } from 'zod'
import { getPartyFieldKeys } from '@/lib/lexia/party-fields'

// ============================================
// Document Types
// ============================================

export const DOCUMENT_TYPES = [
  'demanda',
  'contestacion',
  'apelacion',
  'casacion',
  'recurso_extraordinario',
  'contrato',
  'carta_documento',
  'mediacion',
  'oficio_judicial',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

// ============================================
// Field Definition
// ============================================

export interface FormFieldDefinition {
  key: string
  label: string
  type: 'text' | 'textarea' | 'party' | 'checkbox'
  required?: boolean
  placeholder?: string
  /** For type 'party': prefix (actor, demandado, etc.) and label for the group */
  partyPrefix?: string
  partyLabel?: string
}

// ============================================
// Party Schema Builder
// ============================================

function buildPartySchema(
  prefixes: string[],
  otherFields: Record<string, boolean>
): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {}
  for (const prefix of prefixes) {
    for (const key of getPartyFieldKeys(prefix)) {
      shape[key] = z.string().optional()
    }
  }
  for (const [key, required] of Object.entries(otherFields)) {
    shape[key] = required ? z.string().min(1, 'Requerido') : z.string().optional()
  }
  return z.object(shape).superRefine((data, ctx) => {
    for (const prefix of prefixes) {
      const tipo = (data[`${prefix}_tipo`] ?? '').trim()
      const nombre = (data[`${prefix}_nombre`] ?? '').trim()
      const apellido = (data[`${prefix}_apellido`] ?? '').trim()
      const razon = (data[`${prefix}_razon_social`] ?? '').trim()
      const documento = (data[`${prefix}_documento`] ?? '').trim()
      const domicilio = (data[`${prefix}_domicilio_real`] ?? '').trim()

      if (tipo === 'persona_fisica') {
        if (!nombre || !apellido) {
          ctx.addIssue({ code: 'custom', path: [`${prefix}_nombre`], message: 'Nombre y apellido requeridos para persona física' })
        }
      } else if (tipo === 'persona_juridica') {
        if (!razon) {
          ctx.addIssue({ code: 'custom', path: [`${prefix}_razon_social`], message: 'Razón social requerida para persona jurídica' })
        }
      }
      if (tipo && (!documento || !domicilio)) {
        if (!documento) ctx.addIssue({ code: 'custom', path: [`${prefix}_documento`], message: 'Documento requerido' })
        if (!domicilio) ctx.addIssue({ code: 'custom', path: [`${prefix}_domicilio_real`], message: 'Domicilio real requerido' })
      }
    }
  })
}

// ============================================
// Document Type Schemas (fields + zod)
// ============================================

export const DOCUMENT_TYPE_SCHEMAS: Record<
  DocumentType,
  { fields: FormFieldDefinition[]; schema: z.ZodObject<z.ZodRawShape> }
> = {
  demanda: {
    fields: [
      { key: 'actor', label: 'Actor (demandante)', type: 'party', partyPrefix: 'actor', partyLabel: 'Actor' },
      { key: 'demandado', label: 'Demandado', type: 'party', partyPrefix: 'demandado', partyLabel: 'Demandado' },
      { key: 'hechos', label: 'Hechos', type: 'textarea', required: true, placeholder: 'Narración cronológica de los hechos' },
      { key: 'pretension', label: 'Pretensión', type: 'textarea', required: true, placeholder: 'Lo que se solicita al tribunal' },
      { key: 'fundamento_legal', label: 'Fundamento legal', type: 'textarea', required: true, placeholder: 'Normativa y artículos aplicables' },
    ],
    schema: buildPartySchema(['actor', 'demandado'], {
      hechos: true,
      pretension: true,
      fundamento_legal: true,
    }),
  },
  contestacion: {
    fields: [
      { key: 'demandante', label: 'Demandante', type: 'party', partyPrefix: 'demandante', partyLabel: 'Demandante' },
      { key: 'demandado', label: 'Demandado', type: 'party', partyPrefix: 'demandado', partyLabel: 'Demandado' },
      { key: 'hechos_admitidos', label: 'Hechos admitidos', type: 'textarea', required: false },
      { key: 'hechos_negados', label: 'Hechos negados', type: 'textarea', required: false },
      { key: 'defensas', label: 'Defensas de fondo', type: 'textarea', required: true },
      { key: 'excepciones', label: 'Excepciones (si corresponde)', type: 'textarea', required: false },
    ],
    schema: buildPartySchema(['demandante', 'demandado'], {
      hechos_admitidos: false,
      hechos_negados: false,
      defensas: true,
      excepciones: false,
    }),
  },
  apelacion: {
    fields: [
      { key: 'recurrente', label: 'Recurrente', type: 'party', partyPrefix: 'recurrente', partyLabel: 'Recurrente' },
      { key: 'recurrido', label: 'Recurrido', type: 'party', partyPrefix: 'recurrido', partyLabel: 'Recurrido' },
      { key: 'resolucion_impugnada', label: 'Resolución impugnada', type: 'textarea', required: true, placeholder: 'Fecha, contenido y fundamentos' },
      { key: 'agravios', label: 'Agravios', type: 'textarea', required: true, placeholder: 'Motivos específicos de la impugnación' },
      { key: 'fundamento', label: 'Fundamento legal', type: 'textarea', required: true },
    ],
    schema: buildPartySchema(['recurrente', 'recurrido'], {
      resolucion_impugnada: true,
      agravios: true,
      fundamento: true,
    }),
  },
  casacion: {
    fields: [
      { key: 'recurrente', label: 'Recurrente', type: 'party', partyPrefix: 'recurrente', partyLabel: 'Recurrente' },
      { key: 'recurrido', label: 'Recurrido', type: 'party', partyPrefix: 'recurrido', partyLabel: 'Recurrido' },
      { key: 'jurisprudencia_arbitraria', label: 'Jurisprudencia arbitraria', type: 'textarea', required: true, placeholder: 'Fundamentación de la infringencia' },
      { key: 'agravios', label: 'Agravios', type: 'textarea', required: true },
    ],
    schema: buildPartySchema(['recurrente', 'recurrido'], {
      jurisprudencia_arbitraria: true,
      agravios: true,
    }),
  },
  recurso_extraordinario: {
    fields: [
      { key: 'recurrente', label: 'Recurrente', type: 'party', partyPrefix: 'recurrente', partyLabel: 'Recurrente' },
      { key: 'recurrido', label: 'Recurrido', type: 'party', partyPrefix: 'recurrido', partyLabel: 'Recurrido' },
      { key: 'federalidad', label: 'Cuestión federal', type: 'textarea', required: true },
      { key: 'gravedad_institucional', label: 'Gravedad institucional', type: 'textarea', required: true },
    ],
    schema: buildPartySchema(['recurrente', 'recurrido'], {
      federalidad: true,
      gravedad_institucional: true,
    }),
  },
  contrato: {
    fields: [
      { key: 'partes', label: 'Partes contratantes', type: 'textarea', required: true, placeholder: 'Datos de cada parte' },
      { key: 'objeto', label: 'Objeto del contrato', type: 'textarea', required: true },
      { key: 'obligaciones', label: 'Obligaciones de cada parte', type: 'textarea', required: true },
      { key: 'plazo', label: 'Plazo o duración', type: 'text', required: false },
      { key: 'clausulas_especiales', label: 'Cláusulas especiales', type: 'textarea', required: false },
    ],
    schema: z.object({
      partes: z.string().min(1, 'Requerido'),
      objeto: z.string().min(1, 'Requerido'),
      obligaciones: z.string().min(1, 'Requerido'),
      plazo: z.string().optional(),
      clausulas_especiales: z.string().optional(),
    }),
  },
  carta_documento: {
    fields: [
      { key: 'remitente', label: 'Remitente', type: 'party', partyPrefix: 'remitente', partyLabel: 'Remitente' },
      { key: 'destinatario', label: 'Destinatario', type: 'party', partyPrefix: 'destinatario', partyLabel: 'Destinatario' },
      { key: 'tipo_notificacion', label: 'Tipo de notificación', type: 'text', required: true, placeholder: 'Ej: intimo, notificación, etc.' },
      { key: 'contenido', label: 'Contenido', type: 'textarea', required: true, placeholder: 'Texto del comunicado' },
    ],
    schema: buildPartySchema(['remitente', 'destinatario'], {
      tipo_notificacion: true,
      contenido: true,
    }),
  },
  mediacion: {
    fields: [
      { key: 'partes', label: 'Partes', type: 'textarea', required: true, placeholder: 'Datos de las partes en conflicto' },
      { key: 'objeto_mediacion', label: 'Objeto de la mediación', type: 'textarea', required: true },
      { key: 'propuesta', label: 'Propuesta o solicitud', type: 'textarea', required: true },
    ],
    schema: z.object({
      partes: z.string().min(1, 'Requerido'),
      objeto_mediacion: z.string().min(1, 'Requerido'),
      propuesta: z.string().min(1, 'Requerido'),
    }),
  },
  oficio_judicial: {
    fields: [
      { key: 'tribunal', label: 'Tribunal', type: 'text', required: true, placeholder: 'Datos del tribunal' },
      { key: 'destinatario', label: 'Destinatario', type: 'party', partyPrefix: 'destinatario', partyLabel: 'Destinatario' },
      { key: 'objeto', label: 'Objeto del oficio', type: 'textarea', required: true },
      { key: 'fundamento', label: 'Fundamento', type: 'textarea', required: true },
    ],
    schema: buildPartySchema(['destinatario'], {
      tribunal: true,
      objeto: true,
      fundamento: true,
    }),
  },
}

// ============================================
// Structure Schema (from DB templates)
// ============================================

/** Simple: field keys only - filter/order from DOCUMENT_TYPE_SCHEMAS */
export interface StructureSchemaSimple {
  fields: string[]
}

/** Full: complete form definitions - override DOCUMENT_TYPE_SCHEMAS */
export interface StructureSchemaFull {
  fields: FormFieldDefinition[]
}

export type StructureSchema =
  | StructureSchemaSimple
  | StructureSchemaFull
  | null
  | undefined

function isFullStructureSchema(
  s: StructureSchema
): s is StructureSchemaFull {
  if (!s?.fields?.length) return false
  const first = s.fields[0]
  return typeof first === 'object' && first !== null && 'key' in first
}

// ============================================
// Validation Helpers
// ============================================

export function getSchemaForDocumentType(type: DocumentType): z.ZodObject<z.ZodRawShape> {
  return DOCUMENT_TYPE_SCHEMAS[type].schema
}

/**
 * Returns form fields for a document type.
 * If structureSchema is provided:
 * - Simple (fields: string[]): filter and order from DOCUMENT_TYPE_SCHEMAS
 * - Full (fields: FormFieldDefinition[]): use directly
 */
export function getFieldsForDocumentType(
  type: DocumentType,
  structureSchema?: StructureSchema | null
): FormFieldDefinition[] {
  const defaultFields = DOCUMENT_TYPE_SCHEMAS[type].fields

  if (!structureSchema?.fields?.length) {
    return defaultFields
  }

  if (isFullStructureSchema(structureSchema)) {
    return structureSchema.fields.map((f) => ({
      key: String(f.key),
      label: f.label ?? f.key,
      type: (f.type === 'textarea' ? 'textarea' : f.type === 'party' ? 'party' : f.type === 'checkbox' ? 'checkbox' : 'text') as FormFieldDefinition['type'],
      required: Boolean(f.required),
      placeholder: f.placeholder,
      partyPrefix: f.partyPrefix,
      partyLabel: f.partyLabel,
    }))
  }

  const keys = structureSchema.fields.filter((k): k is string => typeof k === 'string')
  const keySet = new Set(keys)
  const ordered = keys
    .map((k) => defaultFields.find((f) => f.key === k))
    .filter((f): f is FormFieldDefinition => f != null)
  const remaining = defaultFields.filter((f) => !keySet.has(f.key))
  return [...ordered, ...remaining]
}

/** Build a Zod schema from form field definitions (exported for RedactorForm) */
export function buildSchemaFromFields(fields: FormFieldDefinition[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {}
  for (const f of fields) {
    if (f.type === 'party' && f.partyPrefix) {
      for (const key of getPartyFieldKeys(f.partyPrefix)) {
        shape[key] = z.string().optional()
      }
    } else if (f.type === 'checkbox') {
      shape[f.key] = z.string().optional()
    } else {
      const base = z.string()
      shape[f.key] = (f.required ?? false) ? base.min(1, 'Requerido') : base.optional()
    }
  }
  return z.object(shape)
}

/**
 * Validates form data against the document type schema.
 * If structureSchema is provided, builds schema from resolved fields.
 */
export function validateFormData(
  documentType: DocumentType,
  formData: Record<string, string>,
  structureSchema?: StructureSchema | null
): { success: true; data: Record<string, string> } | { success: false; errors: Record<string, string> } {
  const fields = getFieldsForDocumentType(documentType, structureSchema)
  const schema =
    structureSchema?.fields?.length
      ? buildSchemaFromFields(fields)
      : getSchemaForDocumentType(documentType)

  const result = schema.safeParse(formData)

  if (result.success) {
    return { success: true, data: result.data as Record<string, string> }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    if (path && !errors[path]) {
      errors[path] = issue.message
    }
  }
  return { success: false, errors }
}

export function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPES.includes(value as DocumentType)
}
