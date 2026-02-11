/**
 * Lexia AI - Tool Definitions & Registry
 * 
 * Tools are split into two categories:
 * 
 * DETERMINISTIC: Pure code, no AI. The controller can execute these
 * directly without routing to any AI service.
 *   - calculateDeadline
 *   - queryCaseInfo
 * 
 * SEMANTIC: Require AI to generate meaningful output. The tool yields
 * intermediate states, and the AI continues generating the response.
 *   - summarizeDocument
 *   - generateDraft
 *   - getProceduralChecklist
 * 
 * The tool definitions here are shared between the Lexia route and
 * the legacy AI assistant route, ensuring consistency.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { ToolRegistryEntry, LexiaIntent } from './types'

// ============================================
// Tool Registry (metadata for controller)
// ============================================

export const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  summarizeDocument: {
    name: 'summarizeDocument',
    category: 'semantic',
    description: 'Summarize a legal document with structured output',
    preferredProvider: 'gateway',
    preferredModel: 'openai/gpt-4o',
    allowedIntents: ['document_summary', 'legal_analysis', 'general_chat'],
  },
  generateDraft: {
    name: 'generateDraft',
    category: 'semantic',
    description: 'Generate legal document drafts from templates',
    preferredProvider: 'gateway',
    preferredModel: 'anthropic/claude-sonnet-4-20250514',
    allowedIntents: ['document_drafting', 'general_chat'],
  },
  getProceduralChecklist: {
    name: 'getProceduralChecklist',
    category: 'semantic',
    description: 'Get step-by-step procedural checklists',
    preferredProvider: 'gateway',
    preferredModel: 'openai/gpt-4-turbo',
    allowedIntents: ['procedural_query', 'legal_analysis', 'general_chat'],
  },
  calculateDeadline: {
    name: 'calculateDeadline',
    category: 'deterministic',
    description: 'Calculate legal deadlines based on business days',
    allowedIntents: ['procedural_query', 'case_query', 'general_chat'] as LexiaIntent[],
  },
  queryCaseInfo: {
    name: 'queryCaseInfo',
    category: 'deterministic',
    description: 'Query case information from the database',
    allowedIntents: ['case_query', 'legal_analysis', 'general_chat'] as LexiaIntent[],
  },
}

// ============================================
// Deterministic Tool Definitions
// ============================================

export const calculateDeadlineTool = tool({
  description: 'Calculate legal deadlines based on Argentine procedural law, considering business days and holidays.',
  inputSchema: z.object({
    startDate: z.string().describe('Starting date (YYYY-MM-DD)'),
    deadlineType: z.enum([
      'apelacion_5dias', 'apelacion_10dias', 'contestacion_15dias',
      'ofrecimiento_prueba', 'alegatos', 'recurso_extraordinario', 'custom',
    ]),
    customDays: z.number().nullable().describe('Days for custom deadline'),
    jurisdiction: z.enum(['federal', 'cordoba', 'buenos_aires', 'otro']).default('cordoba'),
  }),
  async *execute({ startDate, deadlineType, customDays }) {
    yield { state: 'calculating' as const, message: 'Calculando plazo...' }

    const days: Record<string, number> = {
      apelacion_5dias: 5,
      apelacion_10dias: 10,
      contestacion_15dias: 15,
      ofrecimiento_prueba: 10,
      alegatos: 6,
      recurso_extraordinario: 10,
      custom: customDays || 0,
    }

    yield {
      state: 'ready' as const,
      startDate,
      businessDays: days[deadlineType],
      message: `Plazo de ${days[deadlineType]} dias habiles desde ${startDate}.`,
    }
  },
})

export const queryCaseInfoTool = tool({
  description: 'Query information about the current case including documents, notes, deadlines, and tasks. Only available when a case context is active.',
  inputSchema: z.object({
    queryType: z.enum(['documents', 'notes', 'deadlines', 'tasks', 'summary']).describe('What to query'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    count: z.number().nullable(),
    message: z.string(),
  }),
})

// ============================================
// Semantic Tool Definitions
// ============================================

export const summarizeDocumentTool = tool({
  description: 'Summarize a legal document or text. Returns a structured summary with key points, parties, obligations, and dates.',
  inputSchema: z.object({
    documentText: z.string().describe('The legal document text to summarize'),
    summaryType: z.enum(['brief', 'detailed', 'key_points']).describe('Type of summary'),
  }),
  async *execute({ summaryType }) {
    yield { state: 'analyzing' as const, message: 'Analizando documento...' }
    yield { state: 'ready' as const, summaryType, message: 'Documento analizado. Generando resumen...' }
  },
})

export const generateDraftTool = tool({
  description: 'Generate a draft legal document. Templates: demanda, contestacion, apelacion, contrato, poder, carta_documento, escrito_judicial, recurso, ofrecimiento_prueba.',
  inputSchema: z.object({
    templateType: z.enum([
      'demanda', 'contestacion', 'apelacion', 'contrato', 'poder',
      'carta_documento', 'escrito_judicial', 'recurso', 'ofrecimiento_prueba',
    ]).describe('Type of document'),
    context: z.string().nullable().describe('Additional context for the document'),
    jurisdiction: z.enum(['federal', 'cordoba', 'buenos_aires', 'otro']).default('cordoba'),
  }),
  async *execute({ templateType, jurisdiction }) {
    yield { state: 'preparing' as const, message: 'Preparando plantilla...' }

    const templates: Record<string, string> = {
      demanda: 'Escrito de Demanda',
      contestacion: 'Contestacion de Demanda',
      apelacion: 'Recurso de Apelacion',
      contrato: 'Contrato',
      poder: 'Poder',
      carta_documento: 'Carta Documento',
      escrito_judicial: 'Escrito Judicial',
      recurso: 'Recurso',
      ofrecimiento_prueba: 'Ofrecimiento de Prueba',
    }

    yield {
      state: 'ready' as const,
      templateName: templates[templateType],
      jurisdiction,
      message: `Plantilla "${templates[templateType]}" lista.`,
    }
  },
})

export const getProceduralChecklistTool = tool({
  description: 'Get a procedural checklist for a specific type of legal case in Argentine law.',
  inputSchema: z.object({
    caseType: z.enum([
      'civil_ordinario', 'civil_ejecutivo', 'laboral', 'familia_divorcio',
      'familia_alimentos', 'sucesion', 'penal', 'amparo', 'desalojo',
    ]).describe('Type of case'),
    stage: z.enum(['inicial', 'prueba', 'alegatos', 'sentencia', 'ejecucion', 'completo']).default('completo'),
  }),
  async *execute({ caseType }) {
    yield { state: 'loading' as const, message: 'Cargando checklist...' }

    const names: Record<string, string> = {
      civil_ordinario: 'Juicio Civil Ordinario',
      civil_ejecutivo: 'Juicio Ejecutivo',
      laboral: 'Juicio Laboral',
      familia_divorcio: 'Divorcio',
      familia_alimentos: 'Alimentos',
      sucesion: 'Sucesion',
      penal: 'Proceso Penal',
      amparo: 'Accion de Amparo',
      desalojo: 'Desalojo',
    }

    yield { state: 'ready' as const, caseTypeName: names[caseType], message: `Checklist para "${names[caseType]}" disponible.` }
  },
})

// ============================================
// Combined tools export (for the API route)
// ============================================

export const lexiaTools = {
  summarizeDocument: summarizeDocumentTool,
  generateDraft: generateDraftTool,
  getProceduralChecklist: getProceduralChecklistTool,
  calculateDeadline: calculateDeadlineTool,
  queryCaseInfo: queryCaseInfoTool,
} as const

/**
 * Returns a filtered subset of tools based on allowed tool names.
 * Used by the controller to restrict which tools are available
 * for a given intent classification.
 */
export function getToolsForIntent(allowedToolNames: string[]): typeof lexiaTools {
  if (allowedToolNames.length === 0) return lexiaTools

  const filtered: Record<string, unknown> = {}
  for (const name of allowedToolNames) {
    if (name in lexiaTools) {
      filtered[name] = lexiaTools[name as keyof typeof lexiaTools]
    }
  }

  // Always include deterministic tools
  filtered.calculateDeadline = lexiaTools.calculateDeadline
  filtered.queryCaseInfo = lexiaTools.queryCaseInfo

  return filtered as typeof lexiaTools
}
