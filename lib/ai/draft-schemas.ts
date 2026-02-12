/**
 * Lexia Document Drafting - Form Schemas & Validation
 *
 * Defines DOCUMENT_TYPE_SCHEMAS for the Redactor Jurídico module.
 * Each document type maps to form fields and a zod validation schema.
 */

import { z } from 'zod'

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
  type: 'text' | 'textarea'
  required: boolean
  placeholder?: string
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
      { key: 'actor', label: 'Actor (demandante)', type: 'text', required: true, placeholder: 'Datos completos del actor' },
      { key: 'demandado', label: 'Demandado', type: 'text', required: true, placeholder: 'Datos completos del demandado' },
      { key: 'hechos', label: 'Hechos', type: 'textarea', required: true, placeholder: 'Narración cronológica de los hechos' },
      { key: 'pretension', label: 'Pretensión', type: 'textarea', required: true, placeholder: 'Lo que se solicita al tribunal' },
      { key: 'fundamento_legal', label: 'Fundamento legal', type: 'textarea', required: true, placeholder: 'Normativa y artículos aplicables' },
    ],
    schema: z.object({
      actor: z.string().min(1, 'Requerido'),
      demandado: z.string().min(1, 'Requerido'),
      hechos: z.string().min(1, 'Requerido'),
      pretension: z.string().min(1, 'Requerido'),
      fundamento_legal: z.string().min(1, 'Requerido'),
    }),
  },
  contestacion: {
    fields: [
      { key: 'demandante', label: 'Demandante', type: 'text', required: true },
      { key: 'demandado', label: 'Demandado', type: 'text', required: true },
      { key: 'hechos_admitidos', label: 'Hechos admitidos', type: 'textarea', required: false },
      { key: 'hechos_negados', label: 'Hechos negados', type: 'textarea', required: false },
      { key: 'defensas', label: 'Defensas de fondo', type: 'textarea', required: true },
      { key: 'excepciones', label: 'Excepciones (si corresponde)', type: 'textarea', required: false },
    ],
    schema: z.object({
      demandante: z.string().min(1, 'Requerido'),
      demandado: z.string().min(1, 'Requerido'),
      hechos_admitidos: z.string().optional(),
      hechos_negados: z.string().optional(),
      defensas: z.string().min(1, 'Requerido'),
      excepciones: z.string().optional(),
    }),
  },
  apelacion: {
    fields: [
      { key: 'recurrente', label: 'Recurrente', type: 'text', required: true },
      { key: 'recurrido', label: 'Recurrido', type: 'text', required: true },
      { key: 'resolucion_impugnada', label: 'Resolución impugnada', type: 'textarea', required: true, placeholder: 'Fecha, contenido y fundamentos' },
      { key: 'agravios', label: 'Agravios', type: 'textarea', required: true, placeholder: 'Motivos específicos de la impugnación' },
      { key: 'fundamento', label: 'Fundamento legal', type: 'textarea', required: true },
    ],
    schema: z.object({
      recurrente: z.string().min(1, 'Requerido'),
      recurrido: z.string().min(1, 'Requerido'),
      resolucion_impugnada: z.string().min(1, 'Requerido'),
      agravios: z.string().min(1, 'Requerido'),
      fundamento: z.string().min(1, 'Requerido'),
    }),
  },
  casacion: {
    fields: [
      { key: 'recurrente', label: 'Recurrente', type: 'text', required: true },
      { key: 'recurrido', label: 'Recurrido', type: 'text', required: true },
      { key: 'jurisprudencia_arbitraria', label: 'Jurisprudencia arbitraria', type: 'textarea', required: true, placeholder: 'Fundamentación de la infringencia' },
      { key: 'agravios', label: 'Agravios', type: 'textarea', required: true },
    ],
    schema: z.object({
      recurrente: z.string().min(1, 'Requerido'),
      recurrido: z.string().min(1, 'Requerido'),
      jurisprudencia_arbitraria: z.string().min(1, 'Requerido'),
      agravios: z.string().min(1, 'Requerido'),
    }),
  },
  recurso_extraordinario: {
    fields: [
      { key: 'recurrente', label: 'Recurrente', type: 'text', required: true },
      { key: 'recurrido', label: 'Recurrido', type: 'text', required: true },
      { key: 'federalidad', label: 'Cuestión federal', type: 'textarea', required: true },
      { key: 'gravedad_institucional', label: 'Gravedad institucional', type: 'textarea', required: true },
    ],
    schema: z.object({
      recurrente: z.string().min(1, 'Requerido'),
      recurrido: z.string().min(1, 'Requerido'),
      federalidad: z.string().min(1, 'Requerido'),
      gravedad_institucional: z.string().min(1, 'Requerido'),
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
      { key: 'remitente', label: 'Remitente', type: 'text', required: true },
      { key: 'destinatario', label: 'Destinatario', type: 'text', required: true },
      { key: 'tipo_notificacion', label: 'Tipo de notificación', type: 'text', required: true, placeholder: 'Ej: intimo, notificación, etc.' },
      { key: 'contenido', label: 'Contenido', type: 'textarea', required: true, placeholder: 'Texto del comunicado' },
    ],
    schema: z.object({
      remitente: z.string().min(1, 'Requerido'),
      destinatario: z.string().min(1, 'Requerido'),
      tipo_notificacion: z.string().min(1, 'Requerido'),
      contenido: z.string().min(1, 'Requerido'),
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
      { key: 'destinatario', label: 'Destinatario', type: 'text', required: true },
      { key: 'objeto', label: 'Objeto del oficio', type: 'textarea', required: true },
      { key: 'fundamento', label: 'Fundamento', type: 'textarea', required: true },
    ],
    schema: z.object({
      tribunal: z.string().min(1, 'Requerido'),
      destinatario: z.string().min(1, 'Requerido'),
      objeto: z.string().min(1, 'Requerido'),
      fundamento: z.string().min(1, 'Requerido'),
    }),
  },
}

// ============================================
// Validation Helpers
// ============================================

export function getSchemaForDocumentType(type: DocumentType): z.ZodObject<z.ZodRawShape> {
  return DOCUMENT_TYPE_SCHEMAS[type].schema
}

export function getFieldsForDocumentType(type: DocumentType): FormFieldDefinition[] {
  return DOCUMENT_TYPE_SCHEMAS[type].fields
}

export function validateFormData(
  documentType: DocumentType,
  formData: Record<string, string>
): { success: true; data: Record<string, string> } | { success: false; errors: Record<string, string> } {
  const schema = getSchemaForDocumentType(documentType)
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
