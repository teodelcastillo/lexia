/**
 * Contestación de Demanda - Types
 *
 * Types for the guided contestación flow (Etapa 1+).
 * State is serialized in lexia_contestacion_sessions.state (JSONB).
 */

// Bloque parseado de la demanda
export interface DemandBlock {
  id: string
  titulo: string
  contenido: string
  tipo?: 'objeto' | 'hechos' | 'rubros' | 'prueba' | 'petitorio' | 'otro'
  orden: number
}

// Análisis de un bloque (Etapa 2)
export interface BlockAnalysis {
  bloque_id: string
  argumentos_clave: string[]
  puntos_debiles: string[]
  prueba_implicita: string[]
  sugerencias_defensa: string[]
}

// Pregunta/propuesta para un bloque
export interface BlockQuestion {
  bloque_id: string
  pregunta: string
  tipo: 'postura' | 'prueba' | 'fundamentacion' | 'otro'
  opciones_sugeridas?: string[]
}

// Respuesta del usuario por bloque
export interface BlockResponse {
  bloque_id: string
  postura: 'admitir' | 'negar' | 'admitir_parcial' | 'negar_con_matices'
  fundamentacion?: string
  prueba_ofrecida?: string[]
}

// FormData consolidado para contestación (salida de consolidate)
export interface FormDataConsolidado {
  hechos_admitidos: string
  hechos_negados: string
  defensas: string
  excepciones?: string
}

// Estado de la sesión (Etapa 1: solo bloques; Etapa 2+ amplía)
export interface ContestacionSessionState {
  bloques: DemandBlock[]
  tipo_demanda_detectado?: string
  pretensiones_principales?: string[]
  analisis_por_bloque?: Record<string, BlockAnalysis>
  preguntas_generadas?: BlockQuestion[]
  respuestas_usuario?: Record<string, BlockResponse>
  bloques_sin_respuesta?: string[]
  form_data_consolidado?: FormDataConsolidado
  listo_para_redaccion?: boolean
  ultima_accion?: string
  ultima_accion_at?: string
}

// Acciones que el orquestador puede decidir (Etapa 1 + Etapa 2)
export type OrchestratorAction =
  | { type: 'parse'; payload?: never }
  | { type: 'analyze'; payload?: { bloque_ids?: string[] } }
  | { type: 'generate_questions'; payload?: { bloque_ids?: string[] } }
  | { type: 'wait_user'; payload?: { reason: string; preguntas?: BlockQuestion[] } }
  | { type: 'need_more_info'; payload: { bloque_ids: string[]; reason: string } }
  | { type: 'ready_for_redaction'; payload?: never }
  | { type: 'complete'; payload?: never }
  | { type: 'error'; payload: { message: string } }
