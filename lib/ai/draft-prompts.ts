/**
 * Lexia Document Drafting - System Prompts
 *
 * Builds specialized system prompts for the Redactor Jurídico module.
 * Reuses base DOCUMENT_DRAFTING_PROMPT and adds type-specific structure.
 */

import type { DocumentType } from './draft-schemas'

// ============================================
// Base (reuse from prompts.ts)
// ============================================

const DRAFT_BASE = `Eres LEXIA, un asistente legal de inteligencia artificial para un estudio juridico profesional en Cordoba, Argentina.

ROL: REDACCION JURIDICA
- Generas borradores de documentos legales profesionales
- Usas el lenguaje y formalidades del derecho argentino
- Incluyes todas las secciones y requisitos formales
- Citas correctamente articulos del CPCC Cordoba (Ley 8465)
- Formato del Poder Judicial de Cordoba

JURISDICCION: Cordoba, Argentina
FORMATO: Espanol formal, estructura procesal argentina

Al final incluye: "Esta informacion es orientativa. Verifique con la normativa vigente y el tribunal correspondiente."`

// ============================================
// Type-Specific Structure Fragments
// ============================================

const TYPE_STRUCTURE: Record<DocumentType, string> = {
  demanda: `DEMANDA - ESTRUCTURA REQUERIDA:
- Encabezado: Tribunal, expediente (si aplica), tipo de escrito
- PARTE ACTORA: datos completos (nombre, domicilio, CUIT/DNI)
- PARTE DEMANDADA: datos completos
- HECHOS: numerados, orden cronologico
- FUNDAMENTOS: citar articulos y normativa aplicable
- PETITORIO: pretensiones claras
- FIRMA Y ACREDITACION`,

  contestacion: `CONTESTACION DE DEMANDA - ESTRUCTURA:
- Encabezado
- PARTE DEMANDANTE y PARTE DEMANDADA
- HECHOS ADMITIDOS (numerados)
- HECHOS NEGADOS (numerados)
- DEFENSAS DE FONDO
- EXCEPCIONES (si corresponde)
- PETITORIO`,

  apelacion: `RECURSO DE APELACION - ESTRUCTURA:
- Encabezado
- PARTE RECURRENTE y RECURRIDA
- RESOLUCION IMPUGNADA (fecha, contenido, fundamentos)
- AGRAVIOS (motivos especificos)
- FUNDAMENTOS LEGALES
- PETITORIO (solicitar revocacion o reforma)`,

  casacion: `RECURSO DE CASACION - ESTRUCTURA:
- Encabezado
- PARTE RECURRENTE y RECURRIDA
- Fundamentacion de la infringencia (jurisprudencia arbitraria)
- AGRAVIOS especificos
- PETITORIO`,

  recurso_extraordinario: `RECURSO EXTRAORDINARIO - ESTRUCTURA:
- Encabezado
- Cuestión federal o gravedad institucional
- AGRAVIOS
- PETITORIO`,

  contrato: `CONTRATO - ESTRUCTURA:
- ANTECEDENTES
- PARTES CONTRATANTES (datos completos)
- OBJETO
- OBLIGACIONES DE CADA PARTE
- PLAZO (si aplica)
- CLAUSULAS ESPECIALES
- FIRMAS`,

  carta_documento: `CARTA DOCUMENTO - ESTRUCTURA:
- Datos del remitente y destinatario
- TIPO DE NOTIFICACION
- CONTENIDO del comunicado
- Fecha y firma`,

  mediacion: `ESCRITO DE MEDIACION - ESTRUCTURA:
- PARTES (datos completos)
- OBJETO de la mediacion
- PROPUESTA o solicitud
- PETITORIO`,

  oficio_judicial: `OFICIO JUDICIAL - ESTRUCTURA:
- Encabezado (Tribunal, expediente)
- DESTINATARIO
- OBJETO del oficio
- FUNDAMENTO
- PETITORIO
- Firma y sellos`,
}

// ============================================
// Build Draft Prompt
// ============================================

/**
 * Replaces {{key}} placeholders in template_content with formData values.
 */
export function resolveTemplateContent(
  templateContent: string | null | undefined,
  formData: Record<string, string>
): string {
  if (!templateContent?.trim()) return ''
  return templateContent.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return formData[key] ?? ''
  })
}

export interface BuildDraftPromptParams {
  documentType: DocumentType
  formData: Record<string, string>
  templateFragment?: string | null
  /** Resolved template_content with placeholders replaced by formData */
  baseContent?: string | null
  caseContext?: {
    caseNumber: string
    title: string
    type?: string
  } | null
  previousDraft?: string | null
  iterationInstruction?: string | null
}

/**
 * Builds the full system prompt for document drafting.
 */
export function buildDraftPrompt(params: BuildDraftPromptParams): string {
  const {
    documentType,
    formData,
    templateFragment,
    baseContent,
    caseContext,
    previousDraft,
    iterationInstruction,
  } = params

  let prompt = `${DRAFT_BASE}\n\n`
  prompt += `--- ESTRUCTURA DEL DOCUMENTO ---\n${TYPE_STRUCTURE[documentType]}\n\n`

  if (templateFragment) {
    prompt += `--- INSTRUCCIONES ESPECIFICAS ---\n${templateFragment}\n\n`
  }

  if (baseContent?.trim()) {
    prompt += `--- CONTENIDO BASE DEL DOCUMENTO ---\n${baseContent.trim()}\n\n`
  }

  prompt += `--- DATOS PROPORCIONADOS POR EL USUARIO ---\n`
  for (const [key, value] of Object.entries(formData)) {
    if (value?.trim()) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      prompt += `${label}: ${value}\n\n`
    }
  }

  if (caseContext) {
    prompt += `\n--- CONTEXTO DEL CASO ---\n`
    prompt += `Expediente: ${caseContext.caseNumber}\n`
    prompt += `Titulo: ${caseContext.title}\n`
    if (caseContext.type) {
      prompt += `Tipo: ${caseContext.type}\n`
    }
    prompt += `\nUsa este contexto para referencias al expediente en el documento.\n\n`
  }

  if (previousDraft && iterationInstruction) {
    prompt += `--- BORRADOR ANTERIOR (para modificar) ---\n${previousDraft}\n\n`
    prompt += `--- INSTRUCCION DE MODIFICACION ---\n"${iterationInstruction}"\n\n`
    prompt += `Genera el documento completo modificado segun la instruccion del usuario. Manten la estructura y formalidad, aplicando los cambios solicitados.\n`
  } else {
    prompt += `Genera el documento legal completo basandote en los datos proporcionados. Usa la estructura indicada. Incluye todos los elementos formales.\n`
  }

  return prompt
}

/**
 * Builds the user message for the draft request.
 * For initial generation, this is a simple instruction.
 * For iteration, it includes the instruction.
 */
export function buildDraftUserMessage(
  documentType: DocumentType,
  iterationInstruction?: string | null
): string {
  if (iterationInstruction) {
    return `Por favor modifica el borrador anterior segun la siguiente instruccion: "${iterationInstruction}"`
  }
  const typeNames: Record<DocumentType, string> = {
    demanda: 'Demanda',
    contestacion: 'Contestación de demanda',
    apelacion: 'Recurso de apelación',
    casacion: 'Recurso de casación',
    recurso_extraordinario: 'Recurso extraordinario',
    contrato: 'Contrato',
    carta_documento: 'Carta documento',
    mediacion: 'Escrito de mediación',
    oficio_judicial: 'Oficio judicial',
  }
  return `Genera el borrador completo del documento: ${typeNames[documentType]}.`
}
