# Documentación Completa - Sistema de Gestión Legal

## Tabla de Contenidos
- [Información General](#información-general)
- [Autenticación](#autenticación)
- [Arquitectura de la Aplicación](#arquitectura-de-la-aplicación)
- [API REST](#api-rest)
- [Lexia - Asistente Legal IA](#lexia---asistente-legal-ia)
- [Notificaciones](#notificaciones)
- [Base de Datos](#base-de-datos)

---

## Información General

### Descripción del Proyecto

Sistema integral de gestión legal diseñado para firmas jurídicas. Proporciona herramientas para gestionar casos, documentos, tareas, deadlines y ofrece un asistente legal de IA llamado **Lexia** para optimizar el trabajo legal.

### Stack Tecnológico

- **Frontend:** Next.js 16, React 19, TypeScript
- **UI Components:** Shadcn/UI, Radix UI
- **Styling:** Tailwind CSS v4
- **Backend:** Next.js API Routes, Server Components
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Authentication
- **AI:** Vercel AI SDK 6
- **Notificaciones:** Sistema interno con Supabase real-time

### Arquitectura General

```
app/
├── (auth)              # Rutas públicas de autenticación
├── (dashboard)         # Rutas protegidas del dashboard
├── api/                # Rutas API
├── layout.tsx          # Layout raíz con providers
└── globals.css         # Estilos globales

components/
├── ui/                 # Componentes base de Shadcn
├── dashboard/          # Componentes del dashboard
├── lexia/              # Componentes de Lexia
├── notifications/      # Sistema de notificaciones
├── cases/              # Componentes de casos
└── ...

lib/
├── supabase/           # Clientes de Supabase
├── hooks/              # Hooks personalizados
├── services/           # Servicios de negocio
├── types/              # Tipos TypeScript
└── utils/              # Utilidades
```

---

## Autenticación

### Flujo de Autenticación

La autenticación se maneja a través de **Supabase Auth**, utilizando correo electrónico y contraseña.

#### Roles y Permisos

El sistema soporta cuatro roles principales:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `admin_general` | Administrador del sistema | Acceso completo a toda la plataforma, gestión de usuarios y perfiles |
| `case_leader` | Líder de caso | Acceso a casos asignados, gestión de documentos y tareas |
| `lawyer_executive` | Abogado ejecutor | Acceso a tareas asignadas y casos donde participa |
| `client` | Cliente | Acceso al portal de cliente para ver estado de casos |

#### Hook de Autenticación: `useAuth()`

```typescript
import { useAuth } from '@/lib/hooks/use-auth'

export function MyComponent() {
  const { user, profile, isLoading, permissions, hasRole, signOut } = useAuth()

  // Verificar rol
  if (hasRole('admin_general')) {
    // Mostrar panel de admin
  }

  // Acceder a permisos
  if (permissions.can_manage_users) {
    // Mostrar opciones de gestión
  }
}
```

#### Propiedades de `useAuth()`:

- `user`: Objeto User de Supabase (email, id, etc.)
- `profile`: Datos del perfil del usuario desde la BD
- `isLoading`: Estado de carga inicial
- `permissions`: Permisos globales basados en rol
- `hasRole(role)`: Función para verificar rol específico
- `signOut()`: Cerrar sesión
- `refreshProfile()`: Actualizar datos del perfil

#### Tabla de Permisos por Rol

```
admin_general:
  - can_manage_users ✓
  - can_create_cases ✓
  - can_view_all_cases ✓
  - can_manage_settings ✓
  - can_manage_companies ✓

case_leader:
  - can_create_cases ✓
  - can_manage_cases (assigned only)
  - can_create_clients ✓

lawyer_executive:
  - can_view_cases (assigned only)
  - can_manage_tasks ✓
  - can_view_deadlines ✓
```

---

## Arquitectura de la Aplicación

### Estructura de Rutas

#### Dashboard Principal (`/dashboard`)

- **Usuarios Admin:** AdminDashboard con KPIs globales
- **Usuarios Team:** Dashboard personal con casos y tareas
- **Clientes:** Redirect a `/portal`

#### Rutas Protegidas (middleware)

Todas redirigen a `/auth/login` si no hay sesion, y los clientes son redirigidos a `/portal`.

```
/dashboard              # Dashboard principal (admin / team)
/tablero                # Kanban general
/casos                  # Listado y detalle de casos
/clientes               # Listado de clientes
/personas               # Personas fisicas (tabla DB: people)
/empresas               # Alias de compatibilidad: redirige a /companias
/companias              # Listado y detalle de empresas
/tareas                 # Gestion de tareas
/eventos                # Vencimientos, audiencias y reuniones
/vencimientos           # (legacy, redirige a /eventos)
/calendario             # Vista de calendario
/documentos             # Gestion documental
/notas                  # Notas rapidas
/lexia                  # Asistente IA Lexia (chat, redactor, estratega)
/asistente-ia           # Alias de /lexia
/herramientas           # Herramientas auxiliares (correo, cedulas, SAC)
/buscar                 # Busqueda global (q=...)
/notificaciones         # Centro de notificaciones
/perfil                 # Mi perfil
/configuracion          # Configuracion del sistema
/facturacion            # Modulo de facturacion
/cuentas                # Estado de cuenta por cliente/empresa
/cobranzas              # Cobranzas
/liquidaciones          # Liquidaciones mensuales
/admin
 ├── /usuarios          # Gestion de usuarios
 ├── /perfiles          # Gestion de perfiles (team + clients)
 └── /portal-admin      # Administracion del portal de clientes

/portal                 # Portal de clientes (rol client)
 ├── /portal/casos      # Casos visibles al cliente
 ├── /portal/documentos # Documentos compartidos
 └── /portal/perfil     # Perfil + cambio de contrasena (cliente)
```

### Componentes Clave

#### Dashboard Header

El header contiene:
- Selector de tema (light/dark)
- Botón de crear nuevo (casos, clientes, tareas)
- Campana de notificaciones con polling
- Menú de usuario con "Mi Perfil" y logout

#### Sidebar de Navegación

Muestra solo las opciones accesibles según el rol del usuario. Los links se filtran dinámicamente basados en `requiredRoles`.

#### Sistema de Notificaciones

Dos categorías de notificaciones:
- **Actividad:** Acciones del sistema (usuarios, archivos)
- **Trabajo:** Tareas, vencimientos, cambios en casos

---

## API REST

### Base de Datos

Todas las llamadas API utilizan Supabase Client SDK.

### Reglas de Seguridad para API Routes

Cada `route.ts` dentro de `app/api/*` debe cumplir los siguientes requisitos
minimos (verificados en la ultima auditoria):

1. **Autenticacion explicita**: todas las rutas llaman a
   `supabase.auth.getUser()` y devuelven 401 si no hay usuario. El middleware
   solo protege paginas navegables, no endpoints API.
2. **Autorizacion por caso**: cuando la operacion toca un `case_id`, la ruta
   usa `checkCasePermission(supabase, user.id, caseId, 'can_view' | 'can_edit')`
   desde `lib/utils/access-control.ts`.
3. **Validacion de JSON**: cualquier `request.json()` va envuelto en
   `.catch(() => null)` y se responde 400 si el cuerpo no es objeto valido.
4. **Parametros numericos**: `limit`/`offset` se saneizan para evitar `NaN`.
5. **Filas opcionales**: usar `.maybeSingle()` cuando la fila puede no existir.
6. **Sin no-ops silenciosos**: PATCH/POST vacios responden 400, no `{ok: true}`.
7. **UPDATE de fila unica**: verificar que al menos una fila fue modificada
   (`.select()` post-update) para no devolver 200 cuando RLS bloqueo el cambio.

### Endpoints Principales

#### Autenticación

Las paginas `app/auth/*` (login, sign-up, portal-login, forgot-password,
reset-password, callback, error) manejan el flujo con Supabase Auth. No hay
endpoints REST separados; se usan Server Actions y el cliente Supabase.

#### Notificaciones

```typescript
GET /api/notifications
  Query params:
  - category?: 'activity' | 'work'  // opcional
  - limit?: number (default 20, max 50)
  - offset?: number

Retorna: {
  notifications: Notification[],
  unreadCount: number,
  hasMore: boolean,
}

PATCH /api/notifications
Body: {
  notificationIds?: string[]   // marcar especificas
  markAll?: boolean            // marcar todas
  category?: 'activity' | 'work' // opcional, solo con markAll
}
// Responde 400 si no se envia ninguno de los dos modos.
Retorna: { success: true }

POST /api/notifications/trigger
// Disparador interno desde el cliente despues de acciones (crear/completar
// tareas, crear/asignar vencimientos). El servidor REVALIDA contra la DB:
// - Carga la tarea/deadline real por ID.
// - Verifica que assignedTo, caseId y estado coincidan con el payload.
// - Rechaza 400/404 si no coincide (previene notificaciones forjadas).
Body: { type: 'task_assigned' | 'task_completed' | 'task_created'
       | 'deadline_created' | 'deadline_assigned', ... }
Retorna: { success: true }
```

#### Lexia - Workspace (flujo principal desde Fase 4)

Editor Tiptap + ⌘K + modo agente + stress-test. Detalle de arquitectura
en la sección "Lexia - Asistente Legal IA" más abajo.

```typescript
// CRUD de documentos
GET    /api/lexia/documents?caseId=...&limit=50
POST   /api/lexia/documents
       Body: { documentType: 'demanda'|'contestacion',
               caseId?: string, clientRole?: string, title?: string }
GET    /api/lexia/documents/[id]
PATCH  /api/lexia/documents/[id]
       Body: { content?, title?, activeContext?, clientRole? }
DELETE /api/lexia/documents/[id]   // owner-only

// Edición por selección (⌘K)
POST   /api/lexia/documents/[id]/edit
       Body: EditRequest
       Retorna: stream<EditOperation>

// Modo Agente (Fase 3)
POST   /api/lexia/documents/[id]/agent/plan
       Body: { objective: string, context? }
       Retorna: stream<AgentPlan>
POST   /api/lexia/documents/[id]/agent/execute
       Body: { plan, stepIndex, previousResults, context?, planRunId }
       Retorna: stream<AgentStepResult>

// Stress-test del borrador completo
POST   /api/lexia/documents/[id]/stress-test
       Body: { context? }
       Retorna: { report: StressReport }

// Modos auxiliares
POST   /api/lexia/investigar            // pregunta sobre docs del caso
POST   /api/lexia/counter-argue         // stress-test de un fragmento
POST   /api/lexia/verify-citation       // verificador de citas (dataset + heurística + LLM)
```

#### Lexia - Chat

```typescript
POST /api/lexia
Body: {
  messages: UIMessage[]
  caseContext?: { id, caseNumber, title }
  tool?: string (redaccion | investigacion | procedimiento | consulta)
}

Retorna: Stream de respuesta IA
```

#### Lexia - Redactor (Borradores) — DEPRECADO (Fase 4)

La ruta UI `/lexia/redactor` redirige a `/lexia/workspace/nuevo?type=demanda`.
Los endpoints siguen activos para compatibilidad con borradores guardados
y la lista `/lexia/borradores`.

```typescript
POST /api/lexia/draft
Body: {
  documentType: string  // demanda, contestacion, apelacion, contrato, etc.
  formData: Record<string, string>
  caseContext?: { caseId, caseNumber, title, type }
  previousDraft?: string | null
  iterationInstruction?: string | null
}

Retorna: Stream de texto del borrador
```

#### Lexia - Contestación Guiada — DEPRECADO (Fase 4)

La ruta UI `/lexia/contestacion` redirige a
`/lexia/workspace/nuevo?type=contestacion`. Los endpoints de sesiones
legacy se mantienen para no romper sesiones en curso; el flujo nuevo
vive en el Workspace.

Documentación histórica: `docs/02-modulo-ia-lexia.md` (sección 10.6).

```typescript
POST /api/lexia/contestacion/sessions
Body: { caseId?: string, demandaRaw: string, demandaDocumentId?: string }
Retorna: { sessionId, state, current_step }

GET  /api/lexia/contestacion/sessions/[id]
Retorna: { session: { id, state, current_step, demanda_raw, demanda_document_id, ... } }

GET  /api/lexia/contestacion/case-documents?caseId=...
Retorna: { documents: [{ id, name, mime_type, file_path, file_size }] }

GET  /api/lexia/contestacion/documents/[id]/extract-text
Retorna: { text: string }

POST /api/lexia/contestacion/extract-text
Body: multipart/form-data con campo "file" (PDF o Word)
Retorna: { text: string }

POST /api/lexia/contestacion/orchestrate
Body: { sessionId: string, userResponses?: Record<string, BlockResponse> }
Retorna: { action, state, nextStep, preguntas? }

POST /api/lexia/contestacion/generate-draft
Body: { sessionId: string, iterationInstruction?: string }
Retorna: Stream de texto del borrador

POST /api/lexia/contestacion/save-draft
Body: { sessionId: string, name?: string }
Retorna: { draftId, caseId }
```

#### Lexia - Plantillas

```typescript
GET  /api/lexia/templates?documentType=demanda  // Lista templates (global + org)
POST /api/lexia/templates                        // Crear template org (Body: { documentType, ... })
GET  /api/lexia/templates/by-type/[documentType] // Template efectivo + fields
PUT  /api/lexia/templates/[id]                   // Actualizar template org
DELETE /api/lexia/templates/[id]                 // Eliminar template org
```

#### Admin - Crear Usuario Cliente

```typescript
POST /api/admin/create-client-user
// Requiere rol admin_general. Verifica que la persona y la empresa
// pertenezcan a la organizacion del administrador (incluyendo el caso
// donde person.organization_id es NULL, que ahora se rechaza).
Body: {
  email: string
  personId: string    // id en tabla `people`
  companyId: string   // id en tabla `companies`
}

Retorna: { userId, email, temporalPassword }
```

#### Lexia - Estratega

```typescript
GET /api/lexia/estratega/analyses?caseId=...
// Sin caseId: lista analisis del usuario actual (scoped por user_id).
// Con caseId: verifica checkCasePermission('can_view') antes de filtrar.

GET /api/lexia/estratega/analyses/[id]
// Verifica que el solicitante sea el owner del analisis o miembro del caso.

POST /api/lexia/estratega/analyze
Body: { caseId: string, ... }
// Upsert on (case_id, user_id). Rate limit en memoria.
```

#### Lexia - Conversaciones y Borradores

```typescript
GET  /api/lexia/conversations?caseId=...&limit=50
POST /api/lexia/conversations    // Body: { caseId?: string }
                                 // Verifica acceso al caso si caseId presente.
GET  /api/lexia/conversations/[id]
PATCH /api/lexia/conversations/[id]  // title | is_pinned | is_archived
                                     // 400 si no hay campos a actualizar.

GET  /api/lexia/drafts?caseId=...&limit=50  // Scoped por user_id.
POST /api/lexia/drafts    // { documentType, name?, content, formData, caseId? }
                          // Verifica acceso al caso si caseId presente.

POST /api/lexia/draft/export     // Genera .docx. Requiere sesion.
```

#### Deadlines (Vencimientos)

```typescript
DELETE /api/deadlines/[id]
// Verifica checkCasePermission('can_edit') sobre deadline.case_id.
// Si hay google_calendar_event_id, intenta borrar del calendario antes.

POST /api/deadlines/[id]/complete
// Verifica checkCasePermission('can_edit').
// Usa .select() post-update para devolver 404 si RLS bloqueo la actualizacion.
```

#### Herramientas de Correo

```typescript
GET /api/herramientas/correo/data
// Requiere auth. Modes: 'contacts' | 'cases' | 'companies' |
// 'case-detail' | 'client-cases'.

POST /api/herramientas/correo/informe-estado
// Requiere auth. Genera texto via IA usando datos del caso.
Body: { caseId: string }
```

### Estructura de Respuestas

#### Notificación

El schema real (tabla `notifications`) usa columnas especificas por entidad
en lugar de un `related_entity_id` generico.

```typescript
interface Notification {
  id: string
  user_id: string
  category: 'activity' | 'work'
  type: string                     // task_assigned, deadline_due_soon, etc.
  title: string
  message: string

  // Foreign keys (todas opcionales, ON DELETE SET NULL)
  case_id?: string | null
  task_id?: string | null
  deadline_id?: string | null
  document_id?: string | null

  triggered_by?: string | null     // user_id de quien origino la accion
  metadata: Record<string, unknown>

  is_read: boolean
  read_at?: string | null
  created_at: string
}
```

La UI (`notifications-view.tsx` / `notifications-popover.tsx`) rutea al
hacer click en orden de especificidad:
`task_id` -> `/tareas/[id]`, `deadline_id` -> `/eventos?deadline=...`,
`document_id` -> `/documentos/[id]`, `metadata.google_calendar_event_id`
-> `/calendario`, `case_id` -> `/casos/[id]`.

#### Caso

```typescript
interface Case {
  id: string
  case_number: string
  title: string
  description?: string
  status: 'active' | 'closed' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  case_type: string
  company_id: string
  created_by: string
  created_at: string
  updated_at: string
  
  // Relaciones
  company?: Company
  documents?: Document[]
  case_notes?: CaseNote[]
  deadlines?: Deadline[]
  tasks?: Task[]
}
```

---

## Lexia - Asistente Legal IA

### Visión General

**Lexia** es un copiloto legal centrado en el **documento**, no en el chat.
Está diseñado para tareas de alta exigencia (demanda, contestación) con
control granular del abogado, diff visual antes de aceptar cualquier
cambio, contexto real del caso (documentos extraídos y personas) y
auditoría completa de cada intervención de la IA.

Entry point: `/lexia` → redirige a `/lexia/workspace`.

### Submódulos activos

| Ruta | Rol | Badge |
|------|-----|-------|
| `/lexia/workspace` | Editor de documentos con IA (default) | — |
| `/lexia/workspace/nuevo` | Wizard de alta (tipo + caso) | — |
| `/lexia/workspace/[id]` | Editor Tiptap + ⌘K + paneles | — |
| `/lexia/chat` | Chat conversacional (sin documento) | — |
| `/lexia/estratega` | Análisis estratégico estructurado | — |

#### Submódulos deprecados (Fase 4)

- `/lexia/redactor` → 302 a `/lexia/workspace/nuevo?type=demanda`
- `/lexia/contestacion` → 302 a `/lexia/workspace/nuevo?type=contestacion`

Las rutas permanecen reachable para deep-links pero redirigen al
Workspace. Los borradores existentes del Redactor siguen consultables en
`/lexia/borradores` y las plantillas organizacionales en `/lexia/plantillas`.

---

### Workspace (flujo principal)

#### Modelo de datos (script `051_lexia_workspace.sql`)

```sql
lexia_documents           -- Documento vivo (Tiptap JSON + texto plano)
  id, user_id, case_id, document_type, title,
  content JSONB, content_text TEXT, client_role,
  metadata JSONB, active_context JSONB, version

lexia_document_versions   -- Snapshots inmutables por cambio aceptado
  document_id, version, content, edit_id

lexia_document_edits      -- Auditoría de CADA intervención de la IA
  document_id, user_id, instruction, mode ('selection'|'insert'|'agent'),
  selection_from/to/text, context JSONB,
  reasoning, replacement, alternatives, citations,
  status ('pending'|'accepted'|'rejected'|'edited'),
  accepted_text, model_used, tokens_used
```

#### Editor Tiptap

`components/lexia/workspace/workspace-editor.tsx`

- StarterKit + Placeholder + Typography + Underline + Highlight + Link.
- Marcas custom:
  - `placeholderInline` — texto tutor tipo `[demandante]` en gris.
  - `citation` — cita jurídica con `kind` y `status` (`verified` |
    `warning` | `invalid` | `unverified`).
  - `pendingEdit` — resalta en ámbar el rango que el popover está
    editando.
- Atajo `⌘K` (`Ctrl+K` en Windows) para abrir el popover de IA sobre
  la selección actual o el punto de inserción.

#### ⌘K — Edición por selección con diff

`components/lexia/workspace/ai-edit-popover.tsx`

Flujo:
1. El abogado selecciona texto y pulsa ⌘K.
2. Escribe una instrucción breve ("más formal", "agregá CCyCN 1737", etc.).
3. Lexia streamea un `EditOperation` estructurado con **razonamiento**,
   **reemplazo**, **alternativas**, **citas** y **caveats**.
4. Se muestra `DiffView` (rojo tachado / verde nuevo).
5. El abogado acepta, rechaza, o abre "Cuestionar" para stress-test del
   fragmento.

API: `POST /api/lexia/documents/[id]/edit`. Usa `streamObject` con el
schema `EditOperationSchema`, inyecta contexto real del caso
(`buildCaseContext`) y registra el intento en `lexia_document_edits`
incluyendo los documentos/personas que efectivamente entraron al prompt
(`context.resolved`).

#### Contexto granular del caso

`lib/lexia/workspace/case-context.ts` + `document-extract.ts`.

- **document-extract.ts**: baja archivos de Supabase Storage y extrae
  texto plano (`pdf-parse` para PDF, `mammoth` para DOCX/DOC) con límites
  por documento para evitar prompt overflow.
- **case-context.ts**: arma el bloque contextual con pasajes de los
  documentos seleccionados + personas con su rol en
  `case_participants`, respetando un presupuesto total de caracteres.

El abogado elige qué documentos y personas entran al contexto desde el
`WorkspaceContextPanel` (panel izquierdo).

#### Verificador de citas

`POST /api/lexia/verify-citation` con pipeline de tres pasos:

1. **Dataset curado** (`lib/lexia/workspace/citation-sources.ts`) —
   matching determinístico contra CCyCN, CN, LCT, CPCCN, etc., con
   número máximo de artículos conocido y URL oficial (InfoLEG/SAIJ).
2. **Heurísticas regex** sobre `label`.
3. **LLM juez** (`generateObject`) sólo para citas que los pasos
   anteriores no resolvieron.

`components/lexia/workspace/citation-chips.tsx` consume este endpoint y
pinta cada cita según el veredicto, mostrando link a la fuente oficial
cuando existe.

---

### Modo Agente (Fase 3)

Redacción de secciones enteras con plan previo.

#### APIs

```
POST /api/lexia/documents/[id]/agent/plan
  body: { objective, context? }
  returns: stream<AgentPlan> { summary, risks[], steps[] }

POST /api/lexia/documents/[id]/agent/execute
  body: { plan, stepIndex, previousResults, context?, planRunId }
  returns: stream<AgentStepResult>
    { stepId, kind, heading?, headingLevel?, content,
      reasoning, citations[], caveats[] }
```

#### AgentStep.kind

| kind | Aplicación en el editor |
|------|-------------------------|
| `draft_section` | Crea heading + párrafos y los agrega al final. |
| `replace_section` | Reemplaza el contenido entre `targetHeading` y el próximo heading de igual-o-mayor jerarquía. |
| `insert_after_heading` | Inserta párrafos justo debajo del heading indicado. |
| `rewrite_entire` | Reemplaza todo el documento (requiere confirmación). |

#### UI

`components/lexia/workspace/agent-panel.tsx` — sheet de dos fases:

1. **Planificación**: el abogado escribe el objetivo, ve el plan
   streamed y marca con checkboxes los pasos que quiere ejecutar.
2. **Ejecución**: cada paso se streamea y se aplica sobre el editor
   via `applyAgentStep` (`components/lexia/workspace/agent-applier.ts`)
   con fuzzy-match de headings. El panel muestra en vivo reasoning +
   citas verificadas + caveats. Cancelable en cualquier momento.

Al finalizar se ofrece correr el **stress-test** directamente.

#### Auditoría del agente

Cada paso se registra en `lexia_document_edits` con `mode='agent'` y
`context.agent = { plan_run_id, step_id, step_index, step_kind,
target_heading, plan_summary }`.

---

### Stress-test del borrador (Fase 3)

`POST /api/lexia/documents/[id]/stress-test`

1. Segmenta el documento por `(sección, párrafo)` y toma los N
   párrafos más extensos (peso argumentativo).
2. Para cada uno, `generateObject` desde la perspectiva de la
   contraparte devuelve `attacks[]`, `defenses[]`, `suggestedRewrite?` y
   `severity`.
3. Veredicto global heurístico: `strong | acceptable | weak`.

`components/lexia/workspace/stress-test-panel.tsx` muestra el informe
con findings ordenados por severidad, permite navegar al párrafo exacto
(scroll + selección) y aplicar la reescritura sugerida con un click.

---

### Modos auxiliares del Workspace

- **Investigar** — `POST /api/lexia/investigar` + `investigate-panel.tsx`.
  Pregunta sobre los documentos del caso con respuestas citadas pasaje
  por pasaje. Los pasajes se pueden insertar directamente en el editor.
- **Cuestionar** — `POST /api/lexia/counter-argue` +
  `counter-argue-panel.tsx`. Stress-test de un fragmento puntual
  (accesible desde el popover ⌘K).

### Otros módulos

- **Chat** (`/lexia/chat`) — conversación libre con herramientas
  rápidas y contexto opcional de caso. Implementación: `useChat` +
  `lexiaTools` + `/api/lexia`.
- **Estratega** (`/lexia/estratega`) — análisis estructurado de casos
  (FODA, estrategia, recomendaciones). Persiste análisis en
  `lexia_estratega_analyses`.

### Logging de uso

Cada interacción se registra en `activity_log`:
- `action_type`: 'lexia_query' | 'lexia_edit' | 'lexia_agent_run' | 'lexia_stress_test'
- `entity_type`: 'lexia_document' | 'case' | 'general'
- `entity_id`: id del documento / caso
- `description`: contexto de la operación

---

## Sistema de Notificaciones

### Arquitectura

```typescript
// Tabla: notifications
interface Notification {
  id: uuid
  user_id: uuid
  title: string
  description: string
  category: 'activity' | 'work'
  type: notification_type enum
  related_entity_id: string?
  related_entity_type: string?
  is_read: boolean
  created_at: timestamp
}
```

### Generación de Notificaciones por Rol

#### Admin General
Recibe todas las notificaciones del sistema:
- Usuarios nuevos
- Cambios en casos
- Documentos subidos
- Actividad del equipo

#### Case Leader
Recibe notificaciones de casos asignados:
- Tareas en sus casos
- Vencimientos en sus casos
- Documentos en sus casos
- Cambios de estado

#### Lawyer Executive
Recibe notificaciones de su trabajo:
- Tareas asignadas
- Vencimientos donde está asignado
- Cambios en casos donde participa

#### Client
Recibe notificaciones de sus casos:
- Actualizaciones de estado
- Documentos nuevos
- Mensajes del equipo legal

### Componente NotificationsPopover

- **Polling:** Actualiza cada 30 segundos
- **Tabs:** Todas, Trabajo, Actividad
- **Badge:** Muestra conteo de no leídas
- **Link:** "Ver todas" abre página completa

### Página Completa (`/notificaciones`)

- Vista expandida con filtros
- Agrupación por fecha
- Estadísticas de notificaciones
- Marcar como leído/no leído
- Buscar por tipo

---

## Base de Datos

### Schema Principal

#### Tablas Centrales

**profiles** (Usuarios)
- id (UUID, PK)
- email (texto)
- first_name, last_name
- system_role (admin_general | case_leader | lawyer_executive | client)
- avatar_url
- phone, address, city

**cases** (Casos)
- id, case_number, title, description
- status (active | closed | on_hold)
- priority (low | medium | high | urgent)
- company_id (FK)
- created_by (FK to profiles)

**companies** (Empresas)
- id, company_name, industry
- address, phone, email

**people** (Personas fisicas)
- id, first_name, last_name, name (computed), company_name
- person_type (client | judge | opposing_lawyer | prosecutor | witness | expert | other)
- client_type (person | company) cuando corresponde
- email, phone, address
- organization_id (FK a organizations, para multitenancy)
- is_active

**documents** (Documentos)
- id, case_id (FK)
- file_name, file_path, file_type
- uploaded_by, uploaded_at

**tasks** (Tareas)
- id, case_id (FK)
- title, description, status
- assigned_to (FK to profiles)
- priority, due_date

**deadlines** (Vencimientos)
- id, case_id (FK)
- title, due_date, status
- assigned_to (FK)

**case_notes** (Notas de Caso)
- id, case_id (FK)
- content, created_by (FK)
- created_at

#### Tablas de Sistema

**notifications** (Notificaciones Internas)
- id, user_id (FK)
- title, description, category
- type, is_read, created_at

**activity_log** (Log de Actividades)
- id, user_id (FK)
- action_type, entity_type, entity_id
- case_id (FK), description
- created_at

### Políticas de Row Level Security (RLS)

Todas las tablas principales tienen RLS habilitado:

```sql
-- Users can view their own profile
SELECT: (auth.uid() = id)

-- Admins view everything
SELECT: (user_role = 'admin_general')

-- Case leaders view their cases
SELECT: (case_id IN (select id from cases where leader_id = auth.uid()))

-- Clients view only their data
SELECT: (user_id = auth.uid() AND system_role = 'client')
```

---

## Guía de Desarrollo

### Ejecutar Localmente

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Ejecutar servidor de desarrollo
npm run dev

# Acceder a http://localhost:3000
```

### Variables de Entorno Requeridas

El archivo `.env.example` contiene la lista completa. Resumen:

```bash
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx        # operaciones admin (server-only)

# --- IA (al menos una proveedor) ---
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# --- Cron ---
CRON_SECRET=<openssl rand -hex 32>     # requerido en producción

# --- Feature flags ---
LEXIA_CREDITS_ENFORCEMENT=false        # activar cobro de creditos Lexia
SEED_USERS_ENABLED=false               # habilitar endpoints de seed
VIEW_AS_ENABLED=false                  # permitir "view as" admin

# --- Google (opcional, baja prioridad) ---
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# --- SAC (Cordoba) ---
SAC_ENCRYPTION_KEY=<openssl rand -hex 32>
```

Si las variables de Supabase faltan en build, `lib/supabase/client.ts` devuelve
un stub durante prerender SSR y lanza un error claro en runtime del browser.
`lib/supabase/server.ts` lanza el error explicito en runtime del servidor.

### Integración Google (Calendar, Drive, Sheets, Docs)

Para habilitar la conexión con Google, agregar a `.env.local`:

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

Ver `docs/04-integracion-google.md` para la configuración completa en Google Cloud Console.

### Recordatorios de Calendario (Cron)

Las notificaciones de vencimientos, tareas y eventos de Google se generan automáticamente vía cron:

- **Endpoint**: `GET /api/cron/calendar-reminders`
- **Horario**: 8:00 UTC diario (configurable en `vercel.json`)
- **Autenticación**: `Authorization: Bearer <CRON_SECRET>`

Variables de entorno en Vercel:

```
CRON_SECRET=<generar con: openssl rand -hex 32>
```

Para probar manualmente:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.vercel.app/api/cron/calendar-reminders
```

### Agregar Nuevo Rol

1. Actualizar enum `user_role` en Supabase
2. Agregar tipo en `/lib/types/database.ts`
3. Definir permisos en `/lib/hooks/use-auth.ts`
4. Actualizar RLS policies en Supabase
5. Filtrar rutas en sidebar si es necesario

### Crear Nueva Herramienta de Lexia

1. Agregar a `lexiaTools` object en `/app/(dashboard)/lexia/page.tsx`
2. Implementar handler en `/app/api/lexia/route.ts`
3. Crear componente UI si es necesario
4. Documentar en esta guía

### Plantillas del Redactor Juridico

Las plantillas se gestionan en la tabla `lexia_document_templates` (script `025_lexia_document_templates.sql`). Cada organizacion puede tener plantillas propias por tipo de documento. Documentacion tecnica completa en `docs/02-modulo-ia-lexia.md` (secciones 10 y 11).

---

## Troubleshooting

### Error de Autenticación

**Problema:** "No user logged in"
**Solución:** Verificar que Supabase session está activa. Revisa dashboard de Supabase.

### Notificaciones No Aparecen

**Problema:** El contador muestra 0 pero hay eventos
**Solución:** Verificar RLS policies. El usuario debe tener SELECT en `notifications`.

### Lexia No Responde

**Problema:** Spinner infinito o error 500
**Solución:** Verificar que las API keys de AI están configuradas. Ver logs en Supabase.

### Problemas de Permisos

**Problema:** Usuario no puede acceder a recurso
**Solución:** 
1. Verificar `system_role` en tabla `profiles`
2. Verificar RLS policies en tabla
3. Revisar `permissions` en `useAuth()` hook

---

## Contacto y Soporte

Para reportar bugs o solicitar features, contactar al equipo de desarrollo.

**Última actualización:** 2026-04-21
**Versión:** 1.1.0

### Cambios recientes (2026-04-21)

- **Build:** `next.config.mjs` fija `turbopack.root = __dirname` para
  resolver warning de workspace. `.env.example` agregado.
- **Supabase clients:** `lib/supabase/client.ts` ahora devuelve un stub
  durante prerender si faltan envs y lanza un error claro en browser.
- **Middleware (`lib/supabase/middleware.ts`):** extiende la lista de
  rutas protegidas con `/facturacion`, `/cuentas`, `/cobranzas`,
  `/liquidaciones`, `/tablero`, `/buscar`, `/asistente-ia`.
- **Runtime fixes:** `/cuentas` evita crash si no hay accounts;
  `/liquidaciones` usa `.maybeSingle()`; `/notificaciones` sin header
  duplicado; nueva pagina `/buscar` global; `/portal/perfil` agregado;
  `/empresas` redirige a `/companias`; sidebar sign-out redirige
  explicitamente; notifications-view rutea al entity especifico
  (tarea/vencimiento/documento) en vez del listado generico.
- **API routes (auditoria de seguridad):**
  - Auth explicita agregada a `/api/herramientas/correo/data`,
    `/api/herramientas/correo/informe-estado`, `/api/lexia/draft/export`.
  - Permisos de caso (`checkCasePermission`) agregados a
    `/api/lexia/drafts` (POST), `/api/lexia/conversations` (POST),
    `/api/deadlines/[id]` (DELETE) y `/api/deadlines/[id]/complete`.
  - `/api/lexia/estratega/analyses` scope por `user_id` si no hay caseId;
    `/[id]` valida ownership o membership del caso.
  - `/api/notifications/trigger` ahora revalida task/deadline contra la DB
    antes de emitir notificaciones (previene forged notifications).
  - `/api/notifications` PATCH responde 400 si no se manda ni `markAll`
    ni `notificationIds` no vacio (antes era no-op silencioso).
  - `/api/admin/create-client-user`: rechazo explicito cuando
    `person.organization_id === null` (antes by-passaba check).
  - Saneado `limit` (NaN-safe) en drafts y conversations.
  - `request.json()` envuelto en `.catch(() => null)` con 400 en:
    lexia (main), lexia/draft, cases/generate-description,
    admin/create-client-user, lexia/draft/export.
  - `.maybeSingle()` donde la fila puede no existir
    (templates/[id], deadlines, google_connections, cuentas).
- **Tests:** 23/23 pasando en `lib/event-status.test.ts` tras fix de
  timezone (`getTemporalState`) y reordenar prioridades de riesgo.
