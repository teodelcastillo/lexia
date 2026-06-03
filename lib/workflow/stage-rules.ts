/**
 * Reglas de etapas procesales — CPCC Córdoba (Ley 8465) y Ley 7987
 *
 * Cada etapa define:
 *  - label: nombre visible para el abogado
 *  - tasks: tareas que se crean automáticamente al entrar en la etapa
 *  - lexiaDoc: tipo de documento sugerido para redactar en Lexia
 *  - clientMessage: plantilla de actualización al cliente
 *
 * Plazos en días hábiles salvo que se indique "corridos".
 */

export type ProcesoPipo =
  | 'ordinario'
  | 'abreviado'
  | 'ejecutivo'
  | 'laboral'
  | 'familia'
  | 'otro'

export interface AutoTask {
  title: string
  description?: string
  /** Días hábiles desde hoy para el vencimiento. undefined = sin fecha */
  deadline_days?: number
  /** 'habiles' (default) | 'corridos' */
  deadline_type?: 'habiles' | 'corridos'
  /** Artículo CPCC / Ley que fundamenta el plazo */
  articulo?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

export interface StageRule {
  /** Slug único de la etapa */
  slug: string
  /** Nombre visible */
  label: string
  /** Orden de presentación */
  order: number
  /** Descripción breve para el abogado */
  description?: string
  /** Tareas que se crean automáticamente al avanzar a esta etapa */
  autoTasks: AutoTask[]
  /** Tipo de documento Lexia sugerido para esta etapa */
  lexiaDocType?: string
  /** Plantilla de actualización al cliente (texto plano) */
  clientMessageTemplate?: string
}

// =============================================================================
// PROCESO ORDINARIO — CPCC Córdoba Ley 8465
// =============================================================================

const ORDINARIO: StageRule[] = [
  {
    slug: 'consulta',
    label: 'Consulta inicial',
    order: 1,
    description: 'Primera reunión con el cliente, análisis del caso',
    autoTasks: [
      {
        title: 'Solicitar documentación al cliente',
        description: 'Reunir toda la prueba documental disponible antes de presentar demanda',
        priority: 'high',
      },
      {
        title: 'Preparar presupuesto de honorarios',
        priority: 'medium',
      },
    ],
    clientMessageTemplate:
      'Hemos analizado su caso. Nos comunicaremos a la brevedad para informarle los pasos a seguir.',
  },
  {
    slug: 'mediacion_previa',
    label: 'Mediación previa obligatoria',
    order: 2,
    description: 'Instancia de mediación prejudicial obligatoria (Ley 8858)',
    autoTasks: [
      {
        title: 'Presentar solicitud de mediación',
        priority: 'urgent',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
      {
        title: 'Preparar propuesta de acuerdo',
        priority: 'medium',
        deadline_days: 10,
        deadline_type: 'habiles',
      },
    ],
    lexiaDocType: 'mediacion',
    clientMessageTemplate:
      'Su caso ingresó a la instancia de mediación previa obligatoria. Le informaremos la fecha y lugar de la audiencia.',
  },
  {
    slug: 'demanda_preparada',
    label: 'Demanda en preparación',
    order: 3,
    description: 'Redacción y revisión interna de la demanda',
    autoTasks: [
      {
        title: 'Redactar escrito de demanda',
        priority: 'high',
      },
      {
        title: 'Reunir toda la prueba documental a acompañar',
        priority: 'high',
      },
      {
        title: 'Preparar ofrecimiento de prueba',
        priority: 'medium',
      },
    ],
    lexiaDocType: 'demanda',
    clientMessageTemplate:
      'Estamos preparando la demanda judicial. Le avisaremos cuando esté lista para presentar.',
  },
  {
    slug: 'demanda_presentada',
    label: 'Demanda presentada',
    order: 4,
    description: 'Escrito ingresado al tribunal, pendiente de admisión',
    autoTasks: [
      {
        title: 'Verificar admisión de la demanda',
        description: 'Revisar que el juzgado haya admitido el escrito y asignado número de expediente',
        priority: 'high',
        deadline_days: 10,
        deadline_type: 'habiles',
      },
      {
        title: 'Registrar número de expediente asignado',
        priority: 'medium',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate:
      'Su demanda fue presentada ante el tribunal. Estamos esperando la admisión y la notificación a la parte contraria.',
  },
  {
    slug: 'traslado',
    label: 'Traslado de demanda',
    order: 5,
    description: 'La parte demandada tiene 20 días hábiles para contestar — Art. 507 CPCC',
    autoTasks: [
      {
        title: 'Vencimiento para contestación de demanda (parte contraria)',
        description: 'Controlar si la parte demandada contesta en término — Art. 507 CPCC',
        deadline_days: 20,
        deadline_type: 'habiles',
        articulo: 'Art. 507 CPCC',
        priority: 'urgent',
      },
      {
        title: 'Controlar notificación de traslado',
        description: 'Verificar que la cédula de notificación fue diligenciada correctamente',
        priority: 'high',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate:
      'La demanda fue notificada a la parte contraria, que tiene 20 días hábiles para contestar. Le avisaremos cuando lo haga.',
  },
  {
    slug: 'contestacion',
    label: 'Contestación presentada',
    order: 6,
    description: 'La parte contraria contestó la demanda',
    autoTasks: [
      {
        title: 'Analizar contestación de demanda',
        description: 'Revisar los argumentos y defensas planteados por la parte demandada',
        priority: 'urgent',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
      {
        title: 'Evaluar excepciones planteadas',
        priority: 'high',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    lexiaDocType: 'contestacion',
    clientMessageTemplate:
      'La parte contraria contestó la demanda. Estamos analizando los argumentos presentados.',
  },
  {
    slug: 'apertura_prueba',
    label: 'Apertura a prueba',
    order: 7,
    description: 'Período probatorio de 40 días hábiles — Art. 212 CPCC',
    autoTasks: [
      {
        title: 'Presentar lista de testigos',
        description: 'Ofrecer prueba testimonial con datos de los testigos',
        deadline_days: 10,
        deadline_type: 'habiles',
        articulo: 'Art. 284 CPCC',
        priority: 'urgent',
      },
      {
        title: 'Ofrecer prueba pericial (si corresponde)',
        deadline_days: 10,
        deadline_type: 'habiles',
        priority: 'high',
      },
      {
        title: 'Controlar vencimiento del período probatorio',
        deadline_days: 40,
        deadline_type: 'habiles',
        articulo: 'Art. 212 CPCC',
        priority: 'medium',
      },
      {
        title: 'Solicitar audiencia de testimonial',
        deadline_days: 15,
        deadline_type: 'habiles',
        priority: 'high',
      },
    ],
    clientMessageTemplate:
      'El juez abrió la etapa de prueba. Tenemos 40 días hábiles para producir toda la evidencia del caso.',
  },
  {
    slug: 'prueba_producida',
    label: 'Prueba producida',
    order: 8,
    description: 'Toda la prueba fue producida, pendiente de alegatos',
    autoTasks: [
      {
        title: 'Preparar alegatos',
        description: 'Analizar toda la prueba producida y redactar alegatos',
        deadline_days: 10,
        deadline_type: 'habiles',
        priority: 'high',
      },
      {
        title: 'Revisar transcripción de testimoniales',
        priority: 'medium',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate:
      'La etapa probatoria concluyó. Estamos preparando los alegatos para presentar ante el juez.',
  },
  {
    slug: 'alegatos',
    label: 'Alegatos presentados',
    order: 9,
    description: 'Alegatos presentados, a espera de sentencia',
    autoTasks: [
      {
        title: 'Monitorear dictado de sentencia',
        description: 'Controlar en el tribunal el estado de la causa para sentencia',
        priority: 'medium',
        deadline_days: 30,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate:
      'Presentamos nuestros alegatos ante el juez. El expediente quedó en condiciones de dictar sentencia.',
  },
  {
    slug: 'sentencia_primera',
    label: 'Sentencia de 1ª instancia',
    order: 10,
    description: 'El juez dictó sentencia — evaluar si apelar',
    autoTasks: [
      {
        title: 'Analizar sentencia y evaluar apelación',
        description: 'Plazo de 5 días hábiles para apelar — Art. 361 CPCC',
        deadline_days: 5,
        deadline_type: 'habiles',
        articulo: 'Art. 361 CPCC',
        priority: 'urgent',
      },
      {
        title: 'Notificar sentencia al cliente',
        priority: 'urgent',
        deadline_days: 2,
        deadline_type: 'habiles',
      },
    ],
    lexiaDocType: 'apelacion',
    clientMessageTemplate:
      'El juez dictó sentencia. Nos comunicaremos a la brevedad para explicarle el resultado y las opciones disponibles.',
  },
  {
    slug: 'apelacion',
    label: 'Recurso de apelación',
    order: 11,
    description: 'Causa elevada a la Cámara de Apelaciones',
    autoTasks: [
      {
        title: 'Presentar expresión de agravios',
        deadline_days: 10,
        deadline_type: 'habiles',
        articulo: 'Art. 371 CPCC',
        priority: 'urgent',
      },
      {
        title: 'Controlar contestación de agravios de la contraria',
        deadline_days: 20,
        deadline_type: 'habiles',
        priority: 'high',
      },
    ],
    lexiaDocType: 'apelacion',
    clientMessageTemplate:
      'Presentamos el recurso de apelación. La causa será revisada por la Cámara de Apelaciones.',
  },
  {
    slug: 'sentencia_camara',
    label: 'Sentencia de Cámara',
    order: 12,
    description: 'La Cámara resolvió el recurso de apelación',
    autoTasks: [
      {
        title: 'Analizar sentencia de Cámara — evaluar casación',
        deadline_days: 5,
        deadline_type: 'habiles',
        articulo: 'Art. 384 CPCC',
        priority: 'urgent',
      },
      {
        title: 'Notificar resultado al cliente',
        priority: 'urgent',
        deadline_days: 1,
        deadline_type: 'habiles',
      },
    ],
    lexiaDocType: 'casacion',
    clientMessageTemplate:
      'La Cámara de Apelaciones dictó resolución. Le explicaremos el resultado y los próximos pasos.',
  },
  {
    slug: 'ejecucion',
    label: 'Ejecución de sentencia',
    order: 13,
    description: 'Sentencia firme — etapa de cobro y cumplimiento',
    autoTasks: [
      {
        title: 'Iniciar ejecución de sentencia',
        description: 'Presentar escrito de ejecución forzada si el condenado no cumple voluntariamente',
        deadline_days: 10,
        deadline_type: 'habiles',
        priority: 'high',
      },
      {
        title: 'Solicitar embargo / inhibición si corresponde',
        priority: 'medium',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate:
      'La sentencia quedó firme. Iniciamos el proceso de cobro / ejecución para hacer efectivo el resultado.',
  },
  {
    slug: 'cerrado',
    label: 'Cerrado / Archivado',
    order: 14,
    description: 'El expediente finalizó',
    autoTasks: [
      {
        title: 'Archivar documentación del expediente',
        priority: 'low',
        deadline_days: 10,
        deadline_type: 'habiles',
      },
      {
        title: 'Emitir liquidación final de honorarios',
        priority: 'medium',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate:
      'El expediente fue cerrado. Quedamos a disposición para cualquier consulta futura.',
  },
]

// =============================================================================
// PROCESO ABREVIADO — CPCC Córdoba
// =============================================================================

const ABREVIADO: StageRule[] = [
  {
    slug: 'consulta',
    label: 'Consulta inicial',
    order: 1,
    autoTasks: ORDINARIO[0].autoTasks,
    clientMessageTemplate: ORDINARIO[0].clientMessageTemplate,
  },
  {
    slug: 'demanda_preparada',
    label: 'Demanda en preparación',
    order: 2,
    autoTasks: ORDINARIO[2].autoTasks,
    lexiaDocType: 'demanda',
  },
  {
    slug: 'demanda_presentada',
    label: 'Demanda presentada',
    order: 3,
    autoTasks: ORDINARIO[3].autoTasks,
    clientMessageTemplate: ORDINARIO[3].clientMessageTemplate,
  },
  {
    slug: 'traslado',
    label: 'Traslado de demanda',
    order: 4,
    description: 'La parte demandada tiene 10 días hábiles para contestar — Art. 508 CPCC',
    autoTasks: [
      {
        title: 'Vencimiento para contestación de demanda (parte contraria)',
        deadline_days: 10,
        deadline_type: 'habiles',
        articulo: 'Art. 508 CPCC',
        priority: 'urgent',
      },
    ],
    clientMessageTemplate:
      'La demanda fue notificada a la parte contraria, que tiene 10 días hábiles para contestar.',
  },
  {
    slug: 'contestacion',
    label: 'Contestación presentada',
    order: 5,
    autoTasks: ORDINARIO[5].autoTasks,
    lexiaDocType: 'contestacion',
  },
  {
    slug: 'apertura_prueba',
    label: 'Apertura a prueba',
    order: 6,
    description: 'Período probatorio — Art. 507 CPCC (proceso abreviado)',
    autoTasks: [
      {
        title: 'Presentar lista de testigos',
        deadline_days: 5,
        deadline_type: 'habiles',
        articulo: 'Art. 507 CPCC',
        priority: 'urgent',
      },
      {
        title: 'Controlar vencimiento del período probatorio',
        deadline_days: 20,
        deadline_type: 'habiles',
        priority: 'medium',
      },
    ],
    clientMessageTemplate: 'El juez abrió la etapa de prueba en el proceso abreviado.',
  },
  {
    slug: 'sentencia_primera',
    label: 'Sentencia de 1ª instancia',
    order: 7,
    autoTasks: ORDINARIO[9].autoTasks,
    lexiaDocType: 'apelacion',
    clientMessageTemplate: ORDINARIO[9].clientMessageTemplate,
  },
  {
    slug: 'apelacion',
    label: 'Recurso de apelación',
    order: 8,
    autoTasks: ORDINARIO[10].autoTasks,
    lexiaDocType: 'apelacion',
    clientMessageTemplate: ORDINARIO[10].clientMessageTemplate,
  },
  {
    slug: 'ejecucion',
    label: 'Ejecución de sentencia',
    order: 9,
    autoTasks: ORDINARIO[12].autoTasks,
    clientMessageTemplate: ORDINARIO[12].clientMessageTemplate,
  },
  {
    slug: 'cerrado',
    label: 'Cerrado / Archivado',
    order: 10,
    autoTasks: ORDINARIO[13].autoTasks,
    clientMessageTemplate: ORDINARIO[13].clientMessageTemplate,
  },
]

// =============================================================================
// PROCESO EJECUTIVO — CPCC Córdoba
// =============================================================================

const EJECUTIVO: StageRule[] = [
  {
    slug: 'consulta',
    label: 'Consulta inicial',
    order: 1,
    autoTasks: ORDINARIO[0].autoTasks,
  },
  {
    slug: 'demanda_preparada',
    label: 'Demanda ejecutiva en preparación',
    order: 2,
    autoTasks: [
      { title: 'Redactar demanda ejecutiva', priority: 'high' },
      { title: 'Acompañar título ejecutivo (pagaré, cheque, etc.)', priority: 'high' },
      { title: 'Solicitar embargo preventivo', priority: 'high' },
    ],
    lexiaDocType: 'demanda',
  },
  {
    slug: 'demanda_presentada',
    label: 'Demanda presentada',
    order: 3,
    autoTasks: [
      {
        title: 'Verificar decreto de embargo',
        priority: 'urgent',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
      {
        title: 'Diligenciar mandamiento de embargo',
        priority: 'urgent',
        deadline_days: 10,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate: 'Presentamos la demanda ejecutiva. El juez debe ordenar el embargo.',
  },
  {
    slug: 'intimacion_pago',
    label: 'Intimación de pago',
    order: 4,
    description: 'El ejecutado fue notificado e intimado a pagar — tiene 5 días para oponer excepciones (Art. 547 CPCC)',
    autoTasks: [
      {
        title: 'Controlar vencimiento para oponer excepciones (parte contraria)',
        deadline_days: 5,
        deadline_type: 'habiles',
        articulo: 'Art. 547 CPCC',
        priority: 'urgent',
      },
    ],
    clientMessageTemplate:
      'La parte contraria fue intimada a pagar. Tiene 5 días hábiles para oponer excepciones.',
  },
  {
    slug: 'excepciones',
    label: 'Excepciones planteadas',
    order: 5,
    autoTasks: [
      {
        title: 'Analizar y contestar excepciones',
        deadline_days: 6,
        deadline_type: 'habiles',
        articulo: 'Art. 153 CPCC',
        priority: 'urgent',
      },
    ],
    lexiaDocType: 'contestacion',
  },
  {
    slug: 'sentencia_primera',
    label: 'Sentencia de remate',
    order: 6,
    autoTasks: ORDINARIO[9].autoTasks,
    lexiaDocType: 'apelacion',
    clientMessageTemplate:
      'El juez dictó sentencia de remate. Procedemos a la etapa de subasta si el deudor no paga.',
  },
  {
    slug: 'ejecucion',
    label: 'Ejecución / Subasta',
    order: 7,
    autoTasks: [
      { title: 'Solicitar liquidación de deuda', priority: 'high', deadline_days: 5 },
      { title: 'Impulsar subasta si hay bienes embargados', priority: 'high', deadline_days: 10 },
    ],
    clientMessageTemplate:
      'Iniciamos la ejecución forzada para el cobro efectivo de la deuda.',
  },
  {
    slug: 'cerrado',
    label: 'Cerrado / Archivado',
    order: 8,
    autoTasks: ORDINARIO[13].autoTasks,
  },
]

// =============================================================================
// PROCESO LABORAL — Ley 7987 Córdoba
// =============================================================================

const LABORAL: StageRule[] = [
  {
    slug: 'consulta',
    label: 'Consulta inicial',
    order: 1,
    autoTasks: [
      { title: 'Solicitar documentación laboral al cliente', priority: 'high', description: 'Recibos de sueldo, telegrama de despido, contrato de trabajo, ART' },
      { title: 'Calcular indemnizaciones correspondientes', priority: 'high' },
      { title: 'Preparar presupuesto de honorarios', priority: 'medium' },
    ],
    clientMessageTemplate: 'Analizamos su situación laboral. Le informaremos los montos y opciones disponibles.',
  },
  {
    slug: 'conciliacion_previa',
    label: 'Conciliación previa (CONA)',
    order: 2,
    description: 'Instancia obligatoria de conciliación ante el CONA (Centro de Conciliación Laboral)',
    autoTasks: [
      {
        title: 'Presentar solicitud de conciliación ante el CONA',
        priority: 'urgent',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
      {
        title: 'Preparar propuesta de acuerdo conciliatorio',
        priority: 'high',
        deadline_days: 10,
      },
    ],
    clientMessageTemplate:
      'Su caso ingresó a la instancia de conciliación laboral obligatoria. Le avisaremos la fecha de audiencia.',
  },
  {
    slug: 'demanda_preparada',
    label: 'Demanda laboral en preparación',
    order: 3,
    autoTasks: [
      { title: 'Redactar demanda laboral', priority: 'high' },
      { title: 'Adjuntar documentación laboral', priority: 'high' },
      { title: 'Calcular montos actualizados', priority: 'high' },
    ],
    lexiaDocType: 'demanda',
  },
  {
    slug: 'demanda_presentada',
    label: 'Demanda presentada',
    order: 4,
    autoTasks: [
      {
        title: 'Verificar admisión y asignación de juzgado',
        priority: 'high',
        deadline_days: 10,
        deadline_type: 'habiles',
      },
    ],
    clientMessageTemplate: 'Presentamos la demanda laboral ante el tribunal.',
  },
  {
    slug: 'traslado',
    label: 'Traslado de demanda',
    order: 5,
    description: 'El empleador tiene 10 días hábiles para contestar',
    autoTasks: [
      {
        title: 'Controlar contestación de demanda del empleador',
        deadline_days: 10,
        deadline_type: 'habiles',
        articulo: 'Art. 47 Ley 7987',
        priority: 'urgent',
      },
    ],
    clientMessageTemplate:
      'La demanda fue notificada al empleador, que tiene 10 días hábiles para contestar.',
  },
  {
    slug: 'contestacion',
    label: 'Contestación del empleador',
    order: 6,
    autoTasks: [
      {
        title: 'Analizar contestación del empleador',
        priority: 'urgent',
        deadline_days: 5,
        deadline_type: 'habiles',
      },
    ],
    lexiaDocType: 'contestacion',
  },
  {
    slug: 'audiencia_inicial',
    label: 'Audiencia inicial',
    order: 7,
    description: 'Audiencia obligatoria — intento de conciliación + fijación de hechos controvertidos',
    autoTasks: [
      { title: 'Preparar estrategia para audiencia inicial', priority: 'urgent', deadline_days: 3 },
      { title: 'Confirmar asistencia del cliente a la audiencia', priority: 'high', deadline_days: 2 },
    ],
    clientMessageTemplate:
      'Se fijó la audiencia inicial. Es imprescindible su presencia. Le confirmaremos fecha y lugar.',
  },
  {
    slug: 'prueba',
    label: 'Período de prueba',
    order: 8,
    autoTasks: [
      { title: 'Ofrecer prueba testimonial', deadline_days: 5, priority: 'urgent' },
      { title: 'Ofrecer prueba pericial contable (si corresponde)', deadline_days: 5, priority: 'high' },
      { title: 'Controlar producción de pericial', deadline_days: 20, priority: 'medium' },
    ],
  },
  {
    slug: 'audiencia_vista_causa',
    label: 'Audiencia vista de causa',
    order: 9,
    autoTasks: [
      { title: 'Preparar alegato oral', priority: 'urgent', deadline_days: 5 },
      { title: 'Confirmar asistencia de testigos', priority: 'high', deadline_days: 3 },
    ],
    clientMessageTemplate:
      'Se fijó la audiencia de vista de causa. Su presencia es requerida. Le confirmaremos fecha.',
  },
  {
    slug: 'sentencia_primera',
    label: 'Sentencia de 1ª instancia',
    order: 10,
    autoTasks: [
      {
        title: 'Analizar sentencia — evaluar recurso de apelación',
        deadline_days: 5,
        deadline_type: 'habiles',
        articulo: 'Art. 107 Ley 7987',
        priority: 'urgent',
      },
      { title: 'Notificar resultado al cliente', priority: 'urgent', deadline_days: 1 },
    ],
    lexiaDocType: 'apelacion',
    clientMessageTemplate:
      'El tribunal dictó sentencia en su caso laboral. Nos comunicamos a la brevedad para explicarle el resultado.',
  },
  {
    slug: 'apelacion',
    label: 'Recurso de apelación',
    order: 11,
    autoTasks: [
      {
        title: 'Presentar expresión de agravios',
        deadline_days: 5,
        deadline_type: 'habiles',
        priority: 'urgent',
      },
    ],
    lexiaDocType: 'apelacion',
  },
  {
    slug: 'ejecucion',
    label: 'Ejecución de sentencia',
    order: 12,
    autoTasks: [
      { title: 'Presentar liquidación definitiva', priority: 'high', deadline_days: 10 },
      { title: 'Solicitar embargo de haberes si no pagan', priority: 'high', deadline_days: 5 },
    ],
    clientMessageTemplate:
      'La sentencia quedó firme. Iniciamos la ejecución para el cobro efectivo.',
  },
  {
    slug: 'cerrado',
    label: 'Cerrado / Archivado',
    order: 13,
    autoTasks: ORDINARIO[13].autoTasks,
  },
]

// =============================================================================
// Índice general
// =============================================================================

export const STAGE_RULES: Record<ProcesoPipo, StageRule[]> = {
  ordinario: ORDINARIO,
  abreviado: ABREVIADO,
  ejecutivo: EJECUTIVO,
  laboral: LABORAL,
  familia: ORDINARIO, // mismo flujo base por ahora
  otro: [
    {
      slug: 'activo',
      label: 'Activo',
      order: 1,
      autoTasks: [],
    },
    {
      slug: 'cerrado',
      label: 'Cerrado',
      order: 2,
      autoTasks: ORDINARIO[13].autoTasks,
    },
  ],
}

export function getStageRules(procesoPipo: ProcesoPipo): StageRule[] {
  return STAGE_RULES[procesoPipo] ?? STAGE_RULES.otro
}

export function getStageRule(procesoPipo: ProcesoPipo, slug: string): StageRule | undefined {
  return getStageRules(procesoPipo).find((s) => s.slug === slug)
}

/** Devuelve la etapa siguiente a la actual, o undefined si ya es la última */
export function getNextStage(procesoPipo: ProcesoPipo, currentSlug: string): StageRule | undefined {
  const stages = getStageRules(procesoPipo)
  const current = stages.findIndex((s) => s.slug === currentSlug)
  if (current === -1 || current === stages.length - 1) return undefined
  return stages[current + 1]
}
