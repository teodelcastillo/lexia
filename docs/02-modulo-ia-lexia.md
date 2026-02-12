# LEXIA IA - Documentación Técnica del Módulo de Inteligencia Artificial

**Versión:** 3.0.0  
**Última actualización:** Febrero 2026  
**Stack IA:** Vercel AI SDK 6 + GPT-4 Turbo/o + Claude Sonnet 4 + proveedores directos (OpenAI, Anthropic). No se utiliza Vercel AI Gateway; la resolución de modelo y el fallback viven en el controlador y orquestador (`lib/ai/resolver.ts`, `lib/ai/orchestrator.ts`).

---

## Tabla de Contenidos

1. [Arquitectura del Módulo de IA](#1-arquitectura-del-módulo-de-ia)
2. [Capa 1: Tipos y Contratos](#2-capa-1-tipos-y-contratos)
3. [Capa 2: Proveedores y Configuración](#3-capa-2-proveedores-y-configuración)
4. [Capa 3: Orquestación (Controller)](#4-capa-3-orquestación-controller)
5. [Sistema de Tools (Herramientas)](#5-sistema-de-tools-herramientas)
6. [Sistema de Prompts](#6-sistema-de-prompts)
7. [Rutas de API (Capa HTTP)](#7-rutas-de-api-capa-http)
8. [Interfaz de Usuario](#8-interfaz-de-usuario)
9. [Historial de Conversaciones (Fase 1)](#9-historial-de-conversaciones-fase-1)
10. [Redactor Jurídico (Drafting)](#10-redactor-jurídico-drafting)
11. [Plantillas de Documentos Personalizables](#11-plantillas-de-documentos-personalizables)
12. [Flujo de Datos Completo](#12-flujo-de-datos-completo)
13. [Logging y Auditoría](#13-logging-y-auditoría)
14. [Seguridad](#14-seguridad)
15. [Guía de Extensión](#15-guía-de-extensión)
16. [Roadmap de Funcionalidades Futuras](#16-roadmap-de-funcionalidades-futuras)

---

## 1. Arquitectura del Módulo de IA

### 1.1 Diagrama de Arquitectura (3 Capas)

```
┌─────────────────────────────────────────────────────────────┐
│                   INTERFAZ DE USUARIO                       │
│                                                             │
│   ┌──────────────────┐  ┌─────────────────────┐            │
│   │ lexia/page.tsx   │  │ case-lexia-btn      │ (Client)   │
│   │ (Chat UI)        │  │ (Botón en caso)     │            │
│   └────────┬─────────┘  └────────┬────────────┘            │
│            │                      │                          │
│            │    useChat() hook    │                          │
│            └──────────┬───────────┘                          │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │  HTTP POST (streaming)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE API (HTTP)                       │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ /api/lexia/route.ts         (API principal)         │  │
│   │                                                     │  │
│   │  1. Autenticación (Supabase Auth)                  │  │
│   │  2. Validación de mensajes                         │  │
│   │  3. Extracción del último mensaje de usuario       │  │
│   │  4. Llamada al Controller con mensaje y contexto  │  │
│   │  5. runStreamWithFallback() (orquestador)         │  │
│   │  6. Streaming response via SSE                     │  │
│   │  7. Logging de auditoría                           │  │
│   └─────────────────────────────────────────────────────┘  │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE ORQUESTACIÓN (Controller)              │
│                  lib/ai/lexia-controller.ts                 │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ processRequest()                                    │  │
│   │   1. Clasifica intent (rule-based, no AI)          │  │
│   │   2. Resuelve routing (provider + modelo)          │  │
│   │   3. Decide si enriquecer contexto de caso         │  │
│   │   4. Construye AIServiceConfig                     │  │
│   │   5. Retorna ControllerDecision                    │  │
│   └─────────────────────────────────────────────────────┘  │
│                       │                                      │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ enrichCaseContext() (si es necesario)              │  │
│   │   → Supabase: cases + companies + deadlines        │  │
│   │              + tasks + case_notes                  │  │
│   └─────────────────────────────────────────────────────┘  │
│                       │                                      │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ finalizeDecision()                                 │  │
│   │   → buildSystemPrompt(intent, caseContext)         │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└───────────────────────┼─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            CAPA DE CONFIGURACIÓN (Providers)                │
│                  lib/ai/providers.ts                        │
│                                                             │
│   MODEL_REGISTRY                                            │
│   ┌──────────────────┬────────────────────────────────┐    │
│   │ gpt4-turbo       │ GPT-4 Turbo (legal_analysis)   │    │
│   │ gpt4o            │ GPT-4o (document_summary)      │    │
│   │ gpt4o-mini       │ GPT-4o Mini (case_query)       │    │
│   │ claude-sonnet    │ Claude Sonnet 4 (drafting)     │    │
│   │ claude-haiku     │ Claude 3.5 Haiku (summary)     │    │
│   └──────────────────┴────────────────────────────────┘    │
│                                                             │
│   ROUTING_RULES                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │ legal_analysis    → gpt4-turbo (temp:0.4)          │   │
│   │ document_drafting → claude-sonnet (temp:0.6)       │   │
│   │ document_summary  → gpt4o (temp:0.3)               │   │
│   │ procedural_query  → gpt4-turbo (temp:0.3)          │   │
│   │ case_query        → gpt4o-mini (temp:0.2)          │   │
│   │ general_chat      → gpt4o-mini (temp:0.7)          │   │
│   └────────────────────────────────────────────────────┘   │
│                                                             │
└───────────────────────┼─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│   lib/ai/orchestrator.ts + lib/ai/resolver.ts               │
│                                                             │
│   resolveModel(modelString) → LanguageModel (OpenAI/Anthropic)│
│   runStreamWithFallback() → streamText con fallback        │
│   Variables de entorno: OPENAI_API_KEY, ANTHROPIC_API_KEY  │
│                                                             │
└───────────────────────┼─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  MODELOS IA (proveedores directos)          │
│                                                             │
│   OpenAI GPT-4 Turbo / GPT-4o / GPT-4o Mini                │
│   Anthropic Claude Sonnet 4 / Claude 3.5 Haiku             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Principios de Diseño

#### Separación de Responsabilidades (3 Capas)

1. **HTTP Layer (`/api/lexia/route.ts`)**: Maneja autenticación, validación de mensajes, streaming HTTP. No decide qué modelo usar.

2. **Orchestration Layer (`lib/ai/lexia-controller.ts`)**: Clasifica intents, decide provider/modelo, enriquece contexto. No hace llamadas HTTP ni streaming.

3. **Configuration Layer (`lib/ai/providers.ts`, `prompts.ts`, `tools.ts`)**: Define todos los modelos, reglas de routing, prompts, y tools. No ejecuta lógica de negocio.

#### Ventajas de Esta Arquitectura

- **Testeable**: Cada capa se puede testear de forma aislada.
- **Extensible**: Agregar un nuevo modelo solo requiere actualizar `providers.ts`.
- **Trazable**: Cada request genera un `traceId` que se propaga por todas las capas.
- **Predecible**: La clasificación de intent es determinística (basada en reglas regex).
- **Eficiente**: Routing automático a modelos más baratos para queries simples.

### 1.3 Dependencias

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/react": "^3.0.0",
  "@ai-sdk/openai": "^3.0.0",
  "@ai-sdk/anthropic": "^3.0.0",
  "zod": "^3.x"
}
```

Se usan los proveedores directos de OpenAI y Anthropic; no se utiliza Vercel AI Gateway. Las variables de entorno requeridas son: **OPENAI_API_KEY**, **ANTHROPIC_API_KEY**.

---

## 2. Capa 1: Tipos y Contratos

Ubicación: `/lib/ai/types.ts`

Esta capa define los **contratos compartidos** entre todas las capas. Cada tipo asegura que el Controller, los Providers, y las Routes hablen el mismo lenguaje.

### 2.1 LexiaIntent

```typescript
export type LexiaIntent =
  | 'legal_analysis'       // Análisis legal complejo, jurisprudencia
  | 'document_drafting'    // Redacción de documentos legales
  | 'procedural_query'     // Checklists, plazos, requisitos procesales
  | 'document_summary'     // Resumir documentos legales
  | 'case_query'           // Consultas sobre un caso específico
  | 'general_chat'         // Consultas generales
  | 'unknown'              // Intent no reconocido
```

**Cada intent:**
- Mapea a un modelo preferido (y fallback).
- Tiene temperatura y max_tokens específicos.
- Habilita un conjunto específico de tools.

### 2.2 IntentClassification

Resultado de la clasificación de intent realizada por el Controller:

```typescript
export interface IntentClassification {
  intent: LexiaIntent
  confidence: number         // 0-1 (clasificador basado en reglas)
  provider: AIProvider       // 'gateway' | 'openai_direct' | 'anthropic_direct'
  model: string              // e.g. 'openai/gpt-4-turbo'
  requiresContext: boolean   // Si necesita enriquecer contexto de caso
  toolsAllowed: string[]     // ['summarizeDocument', 'calculateDeadline', ...]
}
```

### 2.3 AIServiceConfig

Configuración final para `streamText()`:

```typescript
export interface AIServiceConfig {
  provider: AIProvider
  model: string              // Modelo completo (e.g. 'openai/gpt-4o')
  temperature: number        // 0.2 - 0.7 según intent
  maxTokens: number          // 1024 - 4096 según intent
  systemPrompt: string       // Construido por buildSystemPrompt()
}
```

### 2.4 CaseContextInput vs CaseContextData

**CaseContextInput** (del UI):
```typescript
{
  caseId: string
  caseNumber: string
  title: string
  type: string
}
```

**CaseContextData** (enriquecido por Controller):
```typescript
{
  ...CaseContextInput,
  status: string
  description: string | null
  companyName: string | null
  deadlines: Array<{ title, dueDate, status }>  // Top 5
  tasks: Array<{ title, status, priority }>     // Top 5 no completadas
  recentNotes: Array<{ content, createdAt }>    // Top 3
}
```

### 2.5 ControllerDecision

El resultado principal del Controller:

```typescript
export interface ControllerDecision {
  classification: IntentClassification
  serviceConfig: AIServiceConfig
  enrichContext: boolean     // Si debe hacer fetch del caso
  traceId: string            // UUID para auditoría
}
```

### 2.6 ToolRegistryEntry

Metadatos de cada tool para el Controller:

```typescript
export interface ToolRegistryEntry {
  name: string
  category: 'deterministic' | 'semantic'
  description: string
  preferredProvider?: AIProvider      // Para tools semánticas
  preferredModel?: string
  allowedIntents: LexiaIntent[]       // Qué intents pueden usar este tool
}
```

**Deterministic tools**: Ejecución pura (calculateDeadline, queryCaseInfo).  
**Semantic tools**: Requieren AI para generar output (summarizeDocument, generateDraft, getProceduralChecklist).

### 2.7 LexiaAuditEntry

Registro de auditoría para cumplimiento:

```typescript
export interface LexiaAuditEntry {
  traceId: string
  userId: string
  timestamp: string
  intent: LexiaIntent
  provider: AIProvider
  model: string
  caseId: string | null
  messageCount: number
  tokensUsed: number
  durationMs: number
  toolsInvoked: string[]
}
```

---

## 3. Capa 2: Proveedores y Configuración

Ubicación: `/lib/ai/providers.ts`

Esta capa centraliza toda la configuración de modelos y routing. Si necesitas agregar un nuevo modelo o cambiar qué modelo maneja un intent, **solo modificas este archivo**.

### 3.1 MODEL_REGISTRY

```typescript
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  'gpt4-turbo': {
    provider: 'gateway',
    model: 'openai/gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    maxTokens: 4096,
    defaultTemperature: 0.7,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
    strengths: ['legal_analysis', 'procedural_query', 'general_chat'],
  },
  'gpt4o': {
    provider: 'gateway',
    model: 'openai/gpt-4o',
    maxTokens: 4096,
    defaultTemperature: 0.5,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    strengths: ['document_summary', 'case_query', 'general_chat'],
  },
  'gpt4o-mini': {
    provider: 'gateway',
    model: 'openai/gpt-4o-mini',
    maxTokens: 2048,
    defaultTemperature: 0.5,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    strengths: ['case_query', 'general_chat'],
  },
  'claude-sonnet': {
    provider: 'gateway',
    model: 'anthropic/claude-sonnet-4-20250514',
    maxTokens: 4096,
    defaultTemperature: 0.7,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    strengths: ['document_drafting', 'document_summary', 'legal_analysis'],
  },
  'claude-haiku': {
    provider: 'gateway',
    model: 'anthropic/claude-3-5-haiku-20241022',
    maxTokens: 2048,
    defaultTemperature: 0.5,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    strengths: ['document_summary', 'general_chat'],
  },
}
```

### 3.2 ROUTING_RULES

Mapea cada intent a un modelo primario, fallback, y configuración:

```typescript
export const ROUTING_RULES: RoutingRule[] = [
  {
    intent: 'legal_analysis',
    primaryModel: 'gpt4-turbo',
    fallbackModel: 'claude-sonnet',
    temperature: 0.4,          // Bajo para precisión legal
    maxTokens: 3000,
    toolsAllowed: ['getProceduralChecklist', 'queryCaseInfo', 'calculateDeadline'],
  },
  {
    intent: 'document_drafting',
    primaryModel: 'claude-sonnet',  // Claude excele en redacción
    fallbackModel: 'gpt4-turbo',
    temperature: 0.6,          // Moderado para creatividad
    maxTokens: 4096,
    toolsAllowed: ['generateDraft', 'queryCaseInfo'],
  },
  {
    intent: 'document_summary',
    primaryModel: 'gpt4o',
    fallbackModel: 'claude-haiku',
    temperature: 0.3,          // Bajo para consistencia
    maxTokens: 2048,
    toolsAllowed: ['summarizeDocument'],
  },
  {
    intent: 'procedural_query',
    primaryModel: 'gpt4-turbo',
    fallbackModel: 'gpt4o',
    temperature: 0.3,          // Precisión procesal crítica
    maxTokens: 2048,
    toolsAllowed: ['getProceduralChecklist', 'calculateDeadline'],
  },
  {
    intent: 'case_query',
    primaryModel: 'gpt4o-mini',    // Más barato para queries simples
    fallbackModel: 'gpt4o',
    temperature: 0.2,
    maxTokens: 1024,
    toolsAllowed: ['queryCaseInfo', 'calculateDeadline'],
  },
  {
    intent: 'general_chat',
    primaryModel: 'gpt4o-mini',    // Más barato para conversación
    fallbackModel: 'gpt4o',
    temperature: 0.7,              // Conversacional
    maxTokens: 1024,
    toolsAllowed: [],              // Sin tools (solo chat)
  },
]
```

### 3.3 Funciones de Routing

```typescript
// Resuelve el routing para un intent dado
export function resolveIntentRouting(
  intent: LexiaIntent,
  confidence: number,
  hasCaseContext: boolean
): IntentClassification

// Obtiene la regla de routing para un intent
export function getRoutingRule(intent: LexiaIntent): RoutingRule

// Obtiene la configuración de un modelo por su key
export function getModelConfig(key: string): ModelConfig | undefined
```

---

## 4. Capa 3: Orquestación (Controller)

Ubicación: `/lib/ai/lexia-controller.ts`

El **cerebro** del sistema. El Controller es una capa de lógica pura (no hace HTTP ni streaming) que toma decisiones sobre cómo manejar cada request.

### 4.1 Clasificación de Intent (Rule-Based)

```typescript
const INTENT_PATTERNS: Record<LexiaIntent, RegExp[]> = {
  document_drafting: [
    /\b(redact|escrib|borrador|draft|generar?\s+(un|el|la)?\s*(escrito|demanda|contestaci|contrato|poder|carta|recurso))/i,
    /\b(plantilla|modelo\s+de|template)\b/i,
    /\b(redacci[oó]n|mejorar?\s+texto|reescrib)/i,
  ],
  document_summary: [
    /\b(resum|sintetiz|analiz[ae]\s+(este|el|la|un)\s*(documento|texto|escrito|contrato))/i,
    /\b(resumen|s[ií]ntesis|puntos?\s+clave|extracto)\b/i,
  ],
  legal_analysis: [
    /\b(anali[zs]|evalua|dictam[ei]n|jurisprudencia|doctrina|fundament)/i,
    /\b(estrategia\s+legal|viabilidad|posibilidad|chances)\b/i,
  ],
  procedural_query: [
    /\b(checklist|lista\s+de\s+(pasos|verificaci)|paso\s+a\s+paso)\b/i,
    /\b(plazo|vencimiento|t[eé]rmino|d[ií]as?\s+h[aá]biles|calcul[ae]\s+(el\s+)?plazo)\b/i,
  ],
  case_query: [
    /\b(este\s+caso|el\s+caso|mi\s+caso|estado\s+del\s+caso)\b/i,
    /\b(tareas?\s+pendientes?|documentos?\s+del\s+caso|notas?\s+del\s+caso)\b/i,
  ],
  general_chat: [
    /\b(hola|buenas?|gracias|adi[oó]s|chau)\b/i,
    /\b(qu[eé]\s+puedes?\s+hacer|ayuda|c[oó]mo\s+funciona)\b/i,
  ],
}
```

**Algoritmo:**
1. Para cada intent, cuenta cuántos patrones coinciden con el mensaje del usuario.
2. Normaliza por el número total de patrones de ese intent.
3. Si hay contexto de caso y el mensaje menciona "caso/expediente", boost `case_query` +0.3.
4. Retorna el intent con mayor score (o `general_chat` si ninguno supera 0.1).

**Por qué rule-based y no ML?**
- Predecible: Siempre puedes rastrear por qué se clasificó un intent.
- Rápido: Sin latencia de llamada a modelo.
- Fácil de extender: Agregar un patrón es un regex.

**Futuro:** Reemplazar con embeddings + k-NN o un clasificador ligero.

### 4.2 Enriquecimiento de Contexto

```typescript
export async function enrichCaseContext(
  supabase: SupabaseClient,
  caseInput: CaseContextInput
): Promise<CaseContextData | null>
```

Hace un **único query Supabase** que trae:
- Datos del caso (status, descripción)
- Empresa/cliente asociado
- Top 5 vencimientos
- Top 5 tareas no completadas
- Top 3 notas (truncadas a 200 caracteres cada una)

**Límites de contexto:**
- Máximo 5 vencimientos
- Máximo 5 tareas (sin completadas)
- Máximo 3 notas (200 chars cada una)
- Total: ~1500 caracteres de contexto

### 4.3 Función Principal: processRequest()

```typescript
export function processRequest(
  userMessage: string,
  caseInput: CaseContextInput | null,
  userId: string,
): ControllerDecision
```

**Pasos:**
1. Clasifica intent del mensaje del usuario.
2. Resuelve routing (provider, modelo, tools).
3. Obtiene la regla de routing (temperatura, max_tokens).
4. Construye `AIServiceConfig` parcial (sin systemPrompt aún).
5. Genera un `traceId` para auditoría.
6. Retorna `ControllerDecision`.

**Nota:** El `systemPrompt` se construye **después** en `finalizeDecision()` porque necesita el contexto enriquecido.

### 4.4 Finalización: finalizeDecision()

```typescript
export function finalizeDecision(
  decision: ControllerDecision,
  caseContext: CaseContextData | null,
): ControllerDecision
```

Llama a `buildSystemPrompt(intent, caseContext)` y actualiza la decisión con el prompt final.

### 4.5 Auditoría: createAuditEntry()

```typescript
export function createAuditEntry(
  decision: ControllerDecision,
  userId: string,
  messageCount: number,
  tokensUsed: number,
  durationMs: number,
  toolsInvoked: string[],
): LexiaAuditEntry
```

Genera un registro completo de la interacción para cumplimiento y análisis.

---

## 5. Sistema de Tools (Herramientas)

Ubicación: `/lib/ai/tools.ts`

### 5.1 TOOL_REGISTRY

Metadatos para que el Controller decida qué tools habilitar:

```typescript
export const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  summarizeDocument: {
    name: 'summarizeDocument',
    category: 'semantic',
    preferredModel: 'openai/gpt-4o',
    allowedIntents: ['document_summary', 'legal_analysis', 'general_chat'],
  },
  generateDraft: {
    name: 'generateDraft',
    category: 'semantic',
    preferredModel: 'anthropic/claude-sonnet-4-20250514',
    allowedIntents: ['document_drafting', 'general_chat'],
  },
  getProceduralChecklist: {
    name: 'getProceduralChecklist',
    category: 'semantic',
    preferredModel: 'openai/gpt-4-turbo',
    allowedIntents: ['procedural_query', 'legal_analysis', 'general_chat'],
  },
  calculateDeadline: {
    name: 'calculateDeadline',
    category: 'deterministic',
    allowedIntents: ['procedural_query', 'case_query', 'general_chat'],
  },
  queryCaseInfo: {
    name: 'queryCaseInfo',
    category: 'deterministic',
    allowedIntents: ['case_query', 'legal_analysis', 'general_chat'],
  },
}
```

### 5.2 Herramientas Determinísticas

#### calculateDeadline

```typescript
inputSchema: {
  startDate: string              // YYYY-MM-DD
  deadlineType: 'apelacion_5dias' | 'apelacion_10dias' | ...
  customDays: number | null      // Para plazos personalizados
  jurisdiction: 'federal' | 'cordoba' | 'buenos_aires' | 'otro'
}
```

**Plazos precargados:**
- `apelacion_5dias`: 5 días hábiles
- `apelacion_10dias`: 10 días hábiles
- `contestacion_15dias`: 15 días hábiles
- `ofrecimiento_prueba`: 10 días hábiles
- `alegatos`: 6 días hábiles
- `recurso_extraordinario`: 10 días hábiles

#### queryCaseInfo

```typescript
inputSchema: {
  queryType: 'documents' | 'notes' | 'deadlines' | 'tasks' | 'summary'
}

outputSchema: {
  found: boolean
  count: number | null
  message: string
}
```

Esta tool tiene un `outputSchema` explícito (validado por Zod), lo que garantiza que el modelo retorne datos estructurados.

### 5.3 Herramientas Semánticas

Usan el patrón **generator function** para emitir estados progresivos:

#### summarizeDocument

```typescript
inputSchema: {
  documentText: string
  summaryType: 'brief' | 'detailed' | 'key_points'
}

async *execute({ summaryType }) {
  yield { state: 'analyzing', message: 'Analizando documento...' }
  yield { state: 'ready', summaryType, message: 'Documento analizado.' }
}
```

#### generateDraft

```typescript
inputSchema: {
  templateType: 'demanda' | 'contestacion' | 'apelacion' | ...
  context: string | null
  jurisdiction: 'federal' | 'cordoba' | 'buenos_aires' | 'otro'
}

// 9 plantillas disponibles
```

#### getProceduralChecklist

```typescript
inputSchema: {
  caseType: 'civil_ordinario' | 'civil_ejecutivo' | 'laboral' | ...
  stage: 'inicial' | 'prueba' | 'alegatos' | 'sentencia' | 'ejecucion' | 'completo'
}

// 9 tipos de procedimiento soportados
```

### 5.4 Filtrado de Tools por Intent

```typescript
export function getToolsForIntent(allowedToolNames: string[]): typeof lexiaTools
```

El Controller llama a esta función para generar un subset de tools basado en la clasificación de intent. Por ejemplo:

- `document_summary` → Solo `summarizeDocument` + determinísticas
- `procedural_query` → Solo `getProceduralChecklist`, `calculateDeadline`
- `general_chat` → Sin tools (solo determinísticas)

**Siempre se incluyen:** `calculateDeadline` y `queryCaseInfo` (son baratas y útiles).

---

## 6. Sistema de Prompts

Ubicación: `/lib/ai/prompts.ts`

### 6.1 Fragmentos Base

```typescript
const IDENTITY = `Eres LEXIA, un asistente legal de inteligencia artificial...`
const JURISDICTION = `JURISDICCION PRINCIPAL: Córdoba, Argentina...`
const FORMAT = `FORMATO DE RESPUESTAS: Español formal pero accesible...`
const DISCLAIMER = `DISCLAIMER: Incluye al final...`
```

### 6.2 Prompts Especializados por Intent

```typescript
const INTENT_PROMPTS: Record<LexiaIntent, string> = {
  legal_analysis: LEGAL_ANALYSIS_PROMPT,
  document_drafting: DOCUMENT_DRAFTING_PROMPT,
  procedural_query: PROCEDURAL_QUERY_PROMPT,
  document_summary: DOCUMENT_SUMMARY_PROMPT,
  case_query: GENERAL_CHAT_PROMPT,
  general_chat: GENERAL_CHAT_PROMPT,
  unknown: GENERAL_CHAT_PROMPT,
}
```

Cada prompt especializado incluye:
- **ROL ESPECIALIZADO**: Define el comportamiento específico (analista, redactor, especialista procesal, etc.)
- **METODOLOGÍA**: Pasos que debe seguir el modelo
- **ESTILO**: Formalidades específicas del tipo de tarea

### 6.3 Construcción Dinámica con Contexto

```typescript
export function buildSystemPrompt(
  intent: LexiaIntent,
  caseContext: CaseContextData | null
): string
```

Si hay `caseContext`, agrega:
```
--- CONTEXTO DE CASO ACTIVO ---
Número: [case_number]
Título: [title]
Tipo: [case_type]
Estado: [status]

Vencimientos próximos:
- [deadline_title] ([due_date]) - [status]

Tareas pendientes:
- [task_title] [[priority]]

Notas recientes:
- [note_content_truncated]
```

---

## 7. Rutas de API (Capa HTTP)

### 7.1 `/api/lexia/route.ts` - API Principal

**Responsabilidades:**
1. Autenticación via Supabase Auth
2. Validación de mensajes (`validateUIMessages`)
3. Extracción del último mensaje de usuario
4. Llamada al Controller: `processRequest()`
5. Validación de acceso al caso (`checkCasePermission`) si hay contexto de caso
6. Enriquecimiento de contexto si es necesario: `enrichCaseContext()`
7. Finalización de la decisión: `finalizeDecision()`
8. Resolución de tools: `getToolsForIntent()`
9. Orquestador: `runStreamWithFallback()` (resuelve modelo con `resolveModel`, ejecuta `streamText` con fallback)
10. Logging de auditoría en `onFinish` (incluye `toolsInvoked` extraídos del response)

```typescript
export async function POST(req: Request) {
  // 1. Auth
  const { data: { user } } = await supabase.auth.getUser()
  
  // 2. Parse body
  const { messages, caseContext } = await req.json()
  
  // 3. Validate messages
  const validatedMessages = await validateUIMessages({ messages, tools: lexiaTools })
  
  // 4. Extract user message
  const userMessage = getLatestUserMessage(validatedMessages)
  
  // 5. Get controller decision
  let decision = processRequest(userMessage, caseContext, user.id)
  
  // 6. Enrich context if needed
  let enrichedContext = null
  if (decision.enrichContext && caseContext) {
    enrichedContext = await enrichCaseContext(supabase, caseContext)
  }
  
  // 7. Finalize decision (builds system prompt)
  decision = finalizeDecision(decision, enrichedContext)
  
  // 8. Get filtered tools
  const activeTools = getToolsForIntent(decision.classification.toolsAllowed)
  const modelMessages = await convertToModelMessages(validatedMessages)
  
  // 9. Orchestrator: resolve provider, stream with fallback
  const { result, decision: finalDecision } = await runStreamWithFallback({
    messages: modelMessages,
    decision,
    tools: activeTools,
  })
  
  return result.toUIMessageStreamResponse({ onFinish: ... })
}
```

### 7.2 Ruta legacy `/api/ai-assistant` (eliminada)

La ruta `/api/ai-assistant` fue eliminada. Toda la funcionalidad de chat con IA se concentra en `/api/lexia`. La página `/asistente-ia` redirige a `/lexia`.

---

## 8. Interfaz de Usuario

### 8.1 Layout

Desde la v3.0 el layout es de dos columnas: sidebar de conversaciones + área de chat.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER (Logo Lexia | Selector de caso | Acciones)                           │
├──────────────────────┬──────────────────────────────────────────────────────┤
│  SIDEBAR             │  ÁREA DE CHAT                                        │
│                      │                                                       │
│  Selector de caso    │  ┌────────────────────────────────────────────────┐ │
│  [Nueva conversación]│  │ Mensajes del chat (scroll vertical)            │ │
│  ───────────────────│  │ [Usuario mensaje]                               │ │
│  Historial:          │  │ [Lexia respuesta con tools]                    │ │
│  • Conv 1 (hoy)      │  └────────────────────────────────────────────────┘ │
│  • Conv 2 (ayer)     │                                                      │
│  • Conv 3 (caso X)   │  ┌────────────────────┬─────────────────────────┐  │
│  ...                 │  │ Context Panel      │ Tools Panel (herramientas │  │
│                      │  │ (cuando hay caso)  │ rápidas)                 │  │
│                      │  └────────────────────┴─────────────────────────┘  │
│                      │  Input de mensaje + botón enviar                    │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

### 8.2 Componentes

#### Rutas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/lexia` | `app/(dashboard)/lexia/page.tsx` | Redirige a `/lexia/chat` (mantiene `?caso=` si existe) |
| `/lexia/chat` | `app/(dashboard)/lexia/chat/page.tsx` | Crea conversación y redirige a `/lexia/chat/[id]` |
| `/lexia/chat/[id]` | `app/(dashboard)/lexia/chat/[id]/page.tsx` | Chat con historial persistido |
| `/lexia/redactor` | `app/(dashboard)/lexia/redactor/page.tsx` | Redactor Jurídico (formularios guiados, borradores) |
| `/lexia/plantillas` | `app/(dashboard)/lexia/plantillas/page.tsx` | Lista de plantillas por tipo (solo si tiene org) |
| `/lexia/plantillas/[documentType]` | `app/(dashboard)/lexia/plantillas/[documentType]/page.tsx` | Editor de plantilla |

#### `components/lexia/lexia-layout-client.tsx`

Layout cliente que coordina sidebar y contenido. Renderiza `LexiaSidebar` + `LexiaChat`.

#### `components/lexia/lexia-sidebar.tsx`

Sidebar con:
- Pestañas Chat / Redactor
- Enlace **Plantillas** (visible solo si el usuario tiene `organization_id`)
- Selector de caso (opcional)
- Botón "Nueva conversación"
- `LexiaConversationList` (historial de conversaciones con fechas relativas)

#### `components/lexia/lexia-conversation-list.tsx`

Lista de conversaciones, filtrable por caso. Navegación a `/lexia/chat/[id]`.

#### `components/lexia/lexia-chat.tsx`

Componente de chat con:
- `useChat` y `DefaultChatTransport` hacia `/api/lexia`
- Body: `messages`, `caseContext`, `conversationId`
- Quick tools (tarjetas de herramientas rápidas)
- Persistencia: envia `conversationId` para cargar/guardar historial

#### `components/lexia/lexia-chat-message.tsx`

Renderiza cada mensaje con:
- Diferenciación usuario (derecha, azul) vs Lexia (izquierda, gris)
- Soporte para partes de tipo `text`
- Soporte para tool invocations con estados:
  - `input-available` / `input-streaming`: Spinner (tool ejecutándose)
  - `output-available`: Ícono + mensaje (tool completada)

#### `components/lexia/lexia-context-panel.tsx`

Muestra cuando hay caso activo:
- Número y título del caso
- Estado y tipo
- Empresa/cliente
- Conteo de documentos y notas
- Botón "Ver caso"
- Botón "Limpiar contexto"

#### `components/lexia/lexia-tool-card.tsx`

Tarjetas de herramientas rápidas que insertan prompts predefinidos en el input:
- "Resumir Documento" → "Resume el siguiente documento: [el usuario pega el texto]"
- "Generar Demanda" → "Genera un borrador de demanda con los siguientes datos..."
- "Calcular Plazo" → "Calcula el plazo de apelación desde hoy..."

---

## 9. Historial de Conversaciones (Fase 1)

Desde la versión 3.0, Lexia persiste las conversaciones en base de datos. Permite historial de chats, historial por caso, y memoria contextual (todos los mensajes cargados como contexto).

### 9.1 Script de Migración

**Archivo:** `scripts/022_lexia_conversations.sql`

- **Tabla `lexia_conversations`:** `id`, `user_id`, `case_id`, `organization_id`, `title`, `summary`, `intent`, `model_used`, `message_count`, `is_archived`, `is_pinned`, `last_message_at`, `created_at`, `updated_at`
- **Tabla `lexia_messages`:** `id`, `conversation_id`, `role`, `content` (JSONB con UIMessage completo), `metadata`, `tokens_used`, `organization_id`, `created_at`
- **Clave primaria de mensajes:** `(conversation_id, id)` — el `id` es el ID del mensaje del AI SDK
- **Triggers:** `auto_assign_organization_id` para ambas tablas
- **RLS:** Usuarios solo acceden a sus propias conversaciones, scoped por organización

### 9.2 Backend de Conversaciones

**Ubicación:** `lib/lexia/`

| Función | Descripción |
|---------|-------------|
| `createConversation(supabase, userId, caseId?)` | Crea conversación, retorna `{ id }` |
| `loadConversation(supabase, convId, userId)` | Carga conversación + mensajes (verifica permisos) |
| `loadConversations(supabase, userId, { caseId?, limit? })` | Lista conversaciones, opcionalmente filtradas por caso |
| `loadMessagesForConversation(supabase, convId, userId)` | Carga mensajes como `UIMessage[]` |
| `saveMessages(supabase, convId, messages, metadata?)` | Reemplaza mensajes (delete + insert) |
| `updateConversationMeta(supabase, convId, updates)` | Actualiza `message_count`, `last_message_at`, `intent`, `model_used` |
| `updateConversation(supabase, convId, userId, updates)` | Actualiza `title`, `is_pinned`, `is_archived` |

**Formato de mensajes:** Se almacena el UIMessage completo en JSONB para reconstruir con `validateUIMessages`.

### 9.3 API de Conversaciones

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/lexia/conversations` | GET | Lista conversaciones. Query: `?caseId=uuid` (opcional) |
| `/api/lexia/conversations` | POST | Crea conversación. Body: `{ caseId?: string }` |
| `/api/lexia/conversations/[id]` | GET | Devuelve conversación + mensajes |
| `/api/lexia/conversations/[id]` | PATCH | Actualiza `title`, `is_pinned`, `is_archived` |

### 9.4 API Principal: Persistencia

**Archivo:** `app/api/lexia/route.ts`

**Cambios en el body:**
- `conversationId` (o `id`): ID de la conversación para persistir
- Si existe: carga mensajes previos desde DB, combina con el nuevo mensaje del cliente

**Flujo cuando hay `conversationId`:**
1. `loadMessagesForConversation()` carga mensajes previos
2. Si el cliente envía solo el último mensaje: `messages = [...previousMessages, newMessage]`
3. `validateUIMessages` sobre el array completo
4. En `onFinish`: `saveMessages()` y `updateConversationMeta()`

**Otros cambios:**
- `createIdGenerator({ prefix: 'msg', size: 16 })` para IDs de mensajes consistentes
- `result.consumeStream()` para que `onFinish` se ejecute aunque el cliente se desconecte

### 9.5 UI: Layout y Rutas

**Estructura de rutas:**
- `/lexia` → Redirige a `/lexia/chat` (mantiene `?caso=` si existe)
- `/lexia/chat` → Crea conversación automáticamente y redirige a `/lexia/chat/[id]`
- `/lexia/chat/[id]` → Chat con historial persistido

**Layout** (`app/(dashboard)/lexia/layout.tsx`): Dos columnas (sidebar + contenido principal).

**Componentes:**
- `LexiaSidebar`: Selector de caso, botón "Nueva conversación", lista de conversaciones
- `LexiaConversationList`: Lista con título, caso, fecha relativa
- `LexiaChat`: Chat con `useChat`, quick tools, persistencia (`conversationId` + `caseContext`)
- `LexiaLayoutClient`: Wrapper que carga contexto de caso desde URL (`?caso=`)

### 9.6 Flujo "Nueva conversación"

1. **Click en "Nueva conversación":** `POST /api/lexia/conversations` → `router.push(/lexia/chat/[id])`
2. **Desde `/lexia` o `/lexia?caso=xxx`:** Redirect a `/lexia/chat` → creación automática → redirect a `/lexia/chat/[id]`

---

## 10. Redactor Jurídico (Drafting)

### 10.1 Descripción

El Redactor Jurídico es un módulo integrado en Lexia que genera borradores de documentos legales mediante formularios guiados. Opera con una API independiente (`/api/lexia/draft`) que hace streaming de texto sin herramientas (tools).

### 10.2 Tipos de Documento

| Tipo | Descripción |
|------|-------------|
| `demanda` | Escrito de demanda judicial |
| `contestacion` | Contestación de demanda |
| `apelacion` | Recurso de apelación |
| `casacion` | Recurso de casación |
| `recurso_extraordinario` | Recurso extraordinario |
| `contrato` | Contrato civil o comercial |
| `carta_documento` | Notificación fehaciente |
| `mediacion` | Escrito de mediación |
| `oficio_judicial` | Oficio dirigido al tribunal |

### 10.3 Arquitectura

```
lib/ai/draft-schemas.ts   - DOCUMENT_TYPE_SCHEMAS, validación Zod, structure_schema
lib/ai/draft-prompts.ts   - buildDraftPrompt, resolveTemplateContent, baseContent
app/api/lexia/draft/route.ts - POST streaming, carga template, validación
app/api/lexia/draft/export/route.ts - POST exporta a Word (.docx)
```

### 10.4 Flujo del Borrador

1. Usuario elige tipo de documento en el Redactor.
2. Completa formulario con campos dinámicos (o usa datos del caso si hay contexto).
3. `POST /api/lexia/draft` con `documentType`, `formData`, `caseContext`.
4. API carga template efectivo (org o global), valida con `structure_schema`.
5. Reemplaza placeholders en `template_content` con datos del formulario.
6. Construye prompt con `buildDraftPrompt` (instrucciones, baseContent, datos).
7. Streaming de respuesta del modelo (Claude Sonnet o GPT-4 Turbo con fallback).
8. Usuario puede iterar vía chat de modificación.

### 10.5 Integración con Caso

Cuando hay `?caso=uuid` en la URL:
- Se cargan datos de partes del caso (actor, demandado) desde `case_participants`.
- El usuario elige si representa al actor o al demandado.
- Los campos del formulario se autocompletan con datos de la parte seleccionada.

---

## 11. Plantillas de Documentos Personalizables

### 11.1 Descripción

Las organizaciones pueden crear y gestionar plantillas propias para cada tipo de documento. Una plantilla define tres dimensiones editables:

| Dimensión | Campo DB | Uso |
|-----------|----------|-----|
| **Instrucciones** | `system_prompt_fragment` | Indicaciones específicas para la IA sobre cómo estructurar o redactar |
| **Contenido base** | `template_content` | Texto reutilizable con placeholders `{{key}}` reemplazados por datos del formulario |
| **Campos del formulario** | `structure_schema` | Definición de campos del formulario (filtro/orden o override completo) |

### 11.2 Jerarquía de Plantillas

- **Global** (`organization_id IS NULL`): Plantillas estándar de Lexia, disponibles para todos. Solo lectura.
- **Organización** (`organization_id = org del usuario`): Plantillas personalizadas del estudio. Se priorizan sobre las globales.

### 11.3 Base de Datos

**Tabla:** `lexia_document_templates` (script `025_lexia_document_templates.sql`)

```sql
id, organization_id, document_type, name, structure_schema, template_content,
system_prompt_fragment, is_active, created_at, updated_at
```

**Índices únicos:** Un template global por tipo; un template por org por tipo.

**RLS:** Usuarios leen templates de su org o globales; solo pueden crear/actualizar/eliminar templates de su org.

### 11.4 API de Plantillas

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/lexia/templates` | GET | Lista templates disponibles (global + org). Query: `?documentType=demanda` |
| `/api/lexia/templates` | POST | Crear template de org (duplicar desde global). Body: `{ documentType, name?, ... }` |
| `/api/lexia/templates/by-type/[documentType]` | GET | Template efectivo para un tipo (org primero, fallback global). Incluye `fields` resueltos |
| `/api/lexia/templates/[id]` | PUT | Actualizar template de org |
| `/api/lexia/templates/[id]` | DELETE | Eliminar template de org (revertir a estándar) |

### 11.5 Estructura de `structure_schema`

**Formato simple** (filtrar/ordenar desde DOCUMENT_TYPE_SCHEMAS):
```json
{ "fields": ["actor", "demandado", "hechos", "pretension"] }
```

**Formato completo** (override total):
```json
{
  "fields": [
    { "key": "actor", "label": "Actor", "type": "text", "required": true },
    { "key": "hechos", "label": "Hechos", "type": "textarea", "required": true }
  ]
}
```

### 11.6 Placeholders en `template_content`

- Formato: `{{actor}}`, `{{hechos}}`, `{{pretension}}`, etc.
- Claves deben coincidir con las del formulario.
- `resolveTemplateContent()` reemplaza con valores de `formData`.

### 11.7 Rutas y Componentes UI

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/lexia/plantillas` | `app/(dashboard)/lexia/plantillas/page.tsx` | Lista de plantillas por tipo |
| `/lexia/plantillas/[documentType]` | `app/(dashboard)/lexia/plantillas/[documentType]/page.tsx` | Editor de plantilla |
| `/lexia/redactor` | `app/(dashboard)/lexia/redactor/page.tsx` | Redactor con formulario dinámico |

**Componentes:**
- `components/lexia/templates/template-list.tsx` - Grid de tipos con estado (estándar vs estudio)
- `components/lexia/templates/template-editor.tsx` - Editor con pestañas
- `components/lexia/templates/template-instructions-editor.tsx`
- `components/lexia/templates/template-content-editor.tsx`
- `components/lexia/templates/template-fields-editor.tsx`

### 11.8 Integración en el Redactor

- Al seleccionar tipo: `GET /api/lexia/templates/by-type/[documentType]` para obtener `fields` e `isOrgTemplate`.
- El formulario usa `fieldsOverride` si la plantilla define campos personalizados.
- Badge "Plantilla del estudio" cuando `isOrgTemplate` es true.
- Enlace a Plantillas en el sidebar de Lexia (solo visible si el usuario tiene `organization_id`).

---

## 12. Flujo de Datos Completo

```
1. USUARIO escribe mensaje en el chat
   │
2. useChat().sendMessage({ text: messageText })
   │
3. DefaultChatTransport prepara request:
   - messages[]
   - caseContext (si hay)
   - conversationId (si hay conversación activa)
   │
4. HTTP POST /api/lexia
   │
5. API ROUTE:
   a. Autenticación (Supabase Auth)
   b. Si conversationId: loadMessagesForConversation() → mensajes previos
   c. messages = [...previos, nuevo] (si aplica)
   d. Validación de mensajes
   e. Extracción del último mensaje de usuario
   │
6. CONTROLLER.processRequest():
   a. Clasifica intent (regex patterns)
   b. Resuelve routing (MODEL_REGISTRY + ROUTING_RULES)
   c. Decide si enriquecer contexto
   d. Retorna ControllerDecision
   │
7. Si enrichContext = true:
   CONTROLLER.enrichCaseContext()
   → Supabase: cases + companies + deadlines + tasks + case_notes
   │
8. CONTROLLER.finalizeDecision():
   → buildSystemPrompt(intent, caseContext)
   │
9. getToolsForIntent(allowedTools):
   → Filtra tools según clasificación de intent
   │
10. streamText() con configuración del Controller:
    - model (decidido por Controller)
    - system (construido por Controller)
    - messages (convertidos)
    - tools (filtrados)
    - temperature, maxTokens (decididos por Controller)
    - stopWhen: stepCountIs(5)
    │
11. VERCEL AI GATEWAY → MODELO IA
    │
12. MODELO puede:
    a. Responder con texto directamente
    b. Invocar una tool:
       i.  Tool ejecuta (yield states)
       ii. Modelo continúa generando con resultado de tool
    c. Repetir hasta 5 pasos
    │
13. toUIMessageStreamResponse() → SSE stream al cliente
    │
14. CLIENTE (useChat):
    a. Recibe chunks del stream
    b. Actualiza messages[] reactivamente
    c. lexia-chat-message renderiza:
       - Texto: con formato
       - Tool invocations: con estados (spinner/check)
    │
15. onFinish callback:
    a. saveMessages(conversationId, messages) → persiste en lexia_messages
    b. updateConversationMeta(conversationId, ...) → actualiza lexia_conversations
    c. createAuditEntry() genera registro
    d. Inserta en activity_log (Supabase)
```

---

## 13. Logging y Auditoría

### 13.1 Audit Entry

Cada interacción genera un `LexiaAuditEntry`:

```typescript
{
  traceId: 'lexia-1707842334567-a8b3c9',
  userId: 'uuid-del-usuario',
  timestamp: '2026-02-09T15:25:34.567Z',
  intent: 'document_drafting',
  provider: 'gateway',
  model: 'anthropic/claude-sonnet-4-20250514',
  caseId: 'uuid-del-caso' | null,
  messageCount: 5,
  tokensUsed: 1247,
  durationMs: 3456,
  toolsInvoked: ['generateDraft'],
}
```

### 13.2 Activity Log

Se inserta un registro en `activity_log` para cada consulta:

```typescript
await supabase.from('activity_log').insert({
  user_id: user.id,
  action_type: 'lexia_query',
  entity_type: caseContext ? 'case' : 'general',
  entity_id: caseContext?.caseId || 'general',
  description: `Lexia [${intent}] via ${model} (${durationMs}ms)`,
  case_id: caseContext?.caseId || null,
})
```

### 13.3 Trazabilidad

El `traceId` se genera en el Controller y se propaga a través de todas las capas:
- Controller decision
- Audit entry
- Activity log
- Logs de error

Esto permite rastrear completamente una interacción a través del sistema.

---

## 14. Seguridad

### 14.1 Autenticación

- Cada request valida el token de Supabase Auth
- Si el token es inválido o ha expirado: `401 Unauthorized`

### 14.2 Autorización de Contexto de Caso

Actualmente NO se valida que el usuario tenga acceso al caso. **TODO:**

```typescript
// En processRequest, antes de enrichCaseContext:
const { data: assignment } = await supabase
  .from('case_assignments')
  .select('id')
  .eq('case_id', caseInput.caseId)
  .eq('user_id', userId)
  .single()

if (!assignment) {
  throw new Error('User does not have access to this case')
}
```

### 14.3 Validación de Mensajes

`validateUIMessages()` asegura que:
- Los mensajes tienen el formato correcto (`UIMessage`)
- Las tool invocations referencian tools válidas
- Los roles son válidos (`user`, `assistant`)

### 14.4 Rate Limiting

**TODO:** Implementar rate limiting en el middleware o API Gateway.

Ejemplo con Vercel Edge Config:
```typescript
const rateLimitKey = `lexia:${user.id}`
const count = await edgeConfig.get(rateLimitKey)
if (count > 100) {
  return new Response('Rate limit exceeded', { status: 429 })
}
```

### 14.5 Sanitización de Contexto

El contexto de caso se trunca antes de enviarlo al modelo:
- Notas: 200 caracteres cada una
- Descripción: No se trunca (puede ser largo)
- Top 5 de vencimientos, tareas

Esto previene que el contexto crezca descontroladamente.

---

## 15. Guía de Extensión

### 15.1 Agregar un Nuevo Modelo

**Paso 1:** Agrega el modelo al `MODEL_REGISTRY` en `lib/ai/providers.ts`:

```typescript
'gpt-5': {
  provider: 'gateway',
  model: 'openai/gpt-5',
  displayName: 'GPT-5',
  maxTokens: 8192,
  defaultTemperature: 0.7,
  costPer1kInput: 0.015,
  costPer1kOutput: 0.045,
  strengths: ['legal_analysis', 'document_drafting'],
}
```

**Paso 2:** Actualiza `ROUTING_RULES` para usar el nuevo modelo:

```typescript
{
  intent: 'legal_analysis',
  primaryModel: 'gpt-5',  // Cambiado de 'gpt4-turbo'
  fallbackModel: 'gpt4-turbo',
  // ...
}
```

**Listo.** El Controller automáticamente usará el nuevo modelo para ese intent.

### 15.2 Agregar un Nuevo Intent

**Paso 1:** Agrega el intent al tipo en `lib/ai/types.ts`:

```typescript
export type LexiaIntent =
  | 'legal_analysis'
  | 'document_drafting'
  | 'contract_analysis'  // NUEVO
  | ...
```

**Paso 2:** Agrega patrones en `lib/ai/lexia-controller.ts`:

```typescript
const INTENT_PATTERNS: Record<LexiaIntent, RegExp[]> = {
  // ...
  contract_analysis: [
    /\b(analiz[ae]\s+(este|el|un)\s*contrato)\b/i,
    /\b(cl[aá]usulas?\s+(abusivas?|riesgosas?|problem[aá]ticas?))\b/i,
  ],
}
```

**Paso 3:** Agrega una regla de routing en `lib/ai/providers.ts`:

```typescript
{
  intent: 'contract_analysis',
  primaryModel: 'claude-sonnet',
  fallbackModel: 'gpt4o',
  temperature: 0.4,
  maxTokens: 3000,
  toolsAllowed: ['summarizeDocument', 'queryCaseInfo'],
}
```

**Paso 4 (opcional):** Agrega un prompt especializado en `lib/ai/prompts.ts`:

```typescript
const CONTRACT_ANALYSIS_PROMPT = `${IDENTITY}

ROL ESPECIALIZADO: ANÁLISIS DE CONTRATOS
...`

const INTENT_PROMPTS: Record<LexiaIntent, string> = {
  // ...
  contract_analysis: CONTRACT_ANALYSIS_PROMPT,
}
```

**Listo.** El sistema ahora reconoce y maneja el nuevo intent.

### 15.3 Agregar una Nueva Tool

**Paso 1:** Define la tool en `lib/ai/tools.ts`:

```typescript
export const analyzeRiskTool = tool({
  description: 'Analyze legal risks in a contract or situation',
  inputSchema: z.object({
    text: z.string(),
    riskType: z.enum(['contractual', 'labor', 'tax']),
  }),
  async *execute({ text, riskType }) {
    yield { state: 'analyzing', message: 'Analizando riesgos...' }
    // Lógica de análisis
    yield { state: 'ready', risks: [...], message: 'Análisis completo.' }
  },
})
```

**Paso 2:** Agrega metadatos al `TOOL_REGISTRY`:

```typescript
export const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  // ...
  analyzeRisk: {
    name: 'analyzeRisk',
    category: 'semantic',
    preferredModel: 'openai/gpt-4-turbo',
    allowedIntents: ['legal_analysis', 'contract_analysis', 'general_chat'],
  },
}
```

**Paso 3:** Agrega la tool al objeto `lexiaTools`:

```typescript
export const lexiaTools = {
  // ...
  analyzeRisk: analyzeRiskTool,
} as const
```

**Paso 4:** Actualiza `ROUTING_RULES` para habilitar la tool en los intents relevantes:

```typescript
{
  intent: 'contract_analysis',
  toolsAllowed: ['summarizeDocument', 'analyzeRisk', 'queryCaseInfo'],
}
```

**Listo.** La tool ahora está disponible para los intents configurados.

### 15.4 Cambiar el Modelo por Defecto para un Intent

Simplemente edita `ROUTING_RULES` en `lib/ai/providers.ts`:

```typescript
{
  intent: 'document_drafting',
  primaryModel: 'gpt-5',  // Cambiado de 'claude-sonnet'
  fallbackModel: 'claude-sonnet',
  // ...
}
```

No se requiere ningún cambio en el código de la API route.

### 15.5 Agregar un Proveedor Externo (No Gateway)

**Ejemplo: Anthropic Direct API**

**Paso 1:** Instala el paquete del proveedor:

```bash
npm install @ai-sdk/anthropic
```

**Paso 2:** Agrega modelos al `MODEL_REGISTRY`:

```typescript
'claude-direct': {
  provider: 'anthropic_direct',  // Nuevo provider
  model: 'claude-sonnet-4-20250514',  // Sin prefijo 'anthropic/'
  // ...
}
```

**Paso 3:** Crea un servicio específico en `lib/ai/services/anthropic-service.ts`:

```typescript
import { anthropic } from '@ai-sdk/anthropic'

export async function streamAnthropicDirect(config: AIServiceConfig) {
  return streamText({
    model: anthropic(config.model),  // Usa el paquete directo
    system: config.systemPrompt,
    // ...
  })
}
```

**Paso 4:** Modifica la API route para detectar el provider:

```typescript
let result
if (decision.serviceConfig.provider === 'anthropic_direct') {
  result = await streamAnthropicDirect(decision.serviceConfig)
} else {
  // Gateway default
  result = streamText({ model: decision.serviceConfig.model, ... })
}
```

---

## 16. Roadmap de Funcionalidades Futuras

### 16.1 Corto Plazo (Q1 2026)

#### 1. Clasificador de Intent Basado en Embeddings
- Reemplazar regex patterns con embeddings + k-NN
- Mayor precisión para mensajes ambiguos
- Confidence scores más confiables

#### 2. Fallback Automático
- Si el modelo primario falla, usar el fallback configurado
- Reintentos con exponential backoff

#### 3. Validación de Acceso a Casos
- Verificar que el usuario tiene `case_assignment` antes de enriquecer contexto
- Retornar 403 si no tiene acceso

#### 4. Rate Limiting por Usuario
- Límite de queries por hora/día según plan
- Almacenar contadores en Redis o Edge Config

### 16.2 Mediano Plazo (Q2 2026)

#### 5. Memoria Conversacional (implementado en v3.0)
- ✅ Almacenar conversaciones completas en la DB
- ✅ Cargar historial cuando el usuario vuelve a Lexia
- Pendiente: Resumen automático de conversaciones largas (compresión progresiva)

#### 6. Tool de Búsqueda en Jurisprudencia
- Integración con base de datos de jurisprudencia argentina
- Semantic search con embeddings
- Citar sentencias relevantes en respuestas

#### 7. Tool de Generación de Cálculos
- Cálculos de honorarios
- Cálculos de intereses
- Actualización de montos por inflación

#### 8. Análisis de Sentimientos y Urgencia
- Detectar si el usuario está frustrado o bajo presión
- Ajustar el tono y prioridad de la respuesta

### 16.3 Largo Plazo (Q3-Q4 2026)

#### 9. Multi-Caso Context
- Comparar múltiples casos
- Identificar patrones comunes
- Sugerir estrategias basadas en casos similares

#### 10. Sugerencias Proactivas
- Notificar al usuario cuando Lexia detecta algo relevante
- "Detecté que el plazo de apelación vence en 3 días"
- "Hay jurisprudencia nueva relacionada con tu caso"

#### 11. Fine-Tuning de Modelos
- Fine-tune GPT-4 con datos específicos del estudio
- Mejora la consistencia y estilo de respuestas

#### 12. Integración con Sistemas Externos
- Enviar borradores a Google Docs
- Crear deadlines en Google Calendar
- Notificar a clientes via email/WhatsApp

---

**Fin del documento**

Esta documentación refleja la arquitectura real del sistema después de la refactorización a 3 capas. Cualquier cambio en el código debe reflejarse aquí para mantener la coherencia.
