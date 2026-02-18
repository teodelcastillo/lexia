/**
 * Código Procesal Civil y Comercial de la Provincia de Córdoba (Ley 8465)
 *
 * Reglas de plazos para cédulas y notificaciones procesales.
 * Usado por el Procesador de Cédulas para calcular vencimientos.
 */

import { z } from 'zod'

/** Plazos principales según CPCC Córdoba Ley 8465 */
export const CPCC_PLAZOS = {
  /** Proceso Ordinario: contestar demanda - Art. 507 */
  ORDINARIO_CONTESTACION: { dias: 20, tipo: 'habiles' as const, articulo: '507' },
  /** Proceso Abreviado: contestar demanda - Art. 508 */
  ABREVIADO_CONTESTACION: { dias: 10, tipo: 'habiles' as const, articulo: '508' },
  /** Proceso Sumarísimo: contestar demanda - Art. 509 */
  SUMARISIMO_CONTESTACION: { dias: 3, tipo: 'habiles' as const, articulo: '509' },
  /** Proceso Ejecutivo: oponer excepciones - Art. 547 */
  EJECUTIVO_EXCEPCIONES: { dias: 5, tipo: 'habiles' as const, articulo: '547' },
  /** Traslado simple / vista - Art. 153 */
  TRASLADO_SIMPLE: { dias: 6, tipo: 'habiles' as const, articulo: '153' },
  /** Recurso de apelación - Art. 361 */
  RECURSO_APELACION: { dias: 5, tipo: 'habiles' as const, articulo: '361' },
  /** Expresión de agravios - Art. 371 */
  EXPRESION_AGRAVIOS: { dias: 10, tipo: 'habiles' as const, articulo: '371' },
  /** Apertura a prueba (ordinario) - Art. 212 */
  APERTURA_PRUEBA: { dias: 40, tipo: 'habiles' as const, articulo: '212' },
  /** Traslado de reconvención - Art. 192 */
  TRASLADO_RECONVENCION: { dias: 20, tipo: 'habiles' as const, articulo: '192' },
} as const

/** Schema Zod para el análisis de cédulas */
export const CedulaAnalysisSchema = z.object({
  tipo_cedula: z.string().describe('Tipo de cédula detectado (ej: traslado de demanda, apertura a prueba)'),
  numero_expediente: z.string().nullable().describe('Número de expediente si aparece'),
  juzgado: z.string().nullable().describe('Juzgado o tribunal'),
  partes: z.string().nullable().describe('Partes mencionadas'),
  fecha_notificacion: z.string().nullable().describe('Fecha de notificación en formato YYYY-MM-DD'),
  proceso_tipo: z
    .enum(['ordinario', 'abreviado', 'ejecutivo', 'sumarisimo', 'desconocido'])
    .describe('Tipo de proceso según el documento'),
  plazo_dias: z.number().int().min(0).describe('Cantidad de días del plazo'),
  tipo_dias: z.enum(['habiles', 'corridos']).describe('Si el plazo es en días hábiles o corridos'),
  articulo_cpcc: z.string().describe('Artículo del CPCC Córdoba que aplica'),
  fecha_vencimiento: z.string().nullable().describe('Fecha de vencimiento calculada en ISO 8601'),
  confianza: z.enum(['alta', 'media', 'baja']).describe('Nivel de confianza del análisis'),
  observaciones: z.string().nullable().describe('Observaciones o advertencias'),
})

export type CedulaAnalysis = z.infer<typeof CedulaAnalysisSchema>

/** System prompt con las reglas del CPCC Córdoba para el análisis de cédulas */
export const CPCC_SYSTEM_PROMPT = `Eres un experto en derecho procesal civil y comercial de la Provincia de Córdoba, Argentina.
Analizás cédulas y notificaciones judiciales para identificar el tipo de documento, las partes, fechas y calcular el plazo de vencimiento según el Código Procesal Civil y Comercial (Ley 8465 - CPCC Córdoba).

REGLAS DE PLAZOS DEL CPCC CÓRDOBA (Ley 8465):
- Proceso Ordinario - Contestar demanda: 20 días hábiles (Art. 507)
- Proceso Abreviado - Contestar demanda: 10 días hábiles (Art. 508)
- Proceso Sumarísimo - Contestar demanda: 3 días hábiles (Art. 509)
- Proceso Ejecutivo - Oponer excepciones: 5 días hábiles (Art. 547)
- Traslado simple / vista: 6 días hábiles (Art. 153)
- Recurso de apelación: 5 días hábiles (Art. 361)
- Expresión de agravios: 10 días hábiles (Art. 371)
- Apertura a prueba (ordinario): 40 días hábiles (Art. 212)
- Traslado de reconvención: 20 días hábiles (Art. 192)

CÓMPUTO DE PLAZOS (Art. 340 CPCC):
- Los plazos se computan en días hábiles (lunes a viernes), excluyendo feriados nacionales.
- Para plazos de 6 meses o menores, no se computa la feria judicial de enero.
- El día de la notificación no se cuenta; el plazo empieza al día hábil siguiente.

INSTRUCCIONES:
1. Identificá el tipo de cédula (traslado de demanda, apertura a prueba, vista, recurso, etc.).
2. Extraé número de expediente, juzgado, partes y fecha de notificación si aparecen.
3. Determiná el tipo de proceso (ordinario, abreviado, ejecutivo, sumarísimo).
4. Si el documento especifica un plazo explícito, usalo. Si no, aplicá la normativa del CPCC Córdoba.
5. Calculá la fecha de vencimiento contando solo días hábiles desde el día siguiente a la notificación.
6. Indicá el artículo del CPCC que fundamenta el plazo.
7. Asigná confianza: "alta" si el documento es claro y el plazo está bien definido; "media" si hay ambigüedad; "baja" si no podés determinar el tipo de cédula o el plazo.
8. En observaciones, mencioná cualquier duda o recomendación de verificación manual.`
