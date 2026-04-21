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

#### Lexia (IA)

```typescript
POST /api/lexia
Body: {
  messages: UIMessage[]
  caseContext?: { id, caseNumber, title }
  tool?: string (redaccion | investigacion | procedimiento | consulta)
}

Retorna: Stream de respuesta IA
```

#### Lexia - Redactor (Borradores)

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

#### Lexia - Contestación Guiada

Flujo asistido para redactar contestaciones desde el texto de la demanda. Tres fuentes de texto: documento del caso, subir archivo (PDF/Word) o pegar texto. Documentación completa en `docs/02-modulo-ia-lexia.md` (sección 10.6).

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

**Lexia** es un asistente de IA especializado en legal que funciona en dos modos:

1. **Modo Contextual:** Dentro de un caso, con acceso a documentos, notas y contexto
2. **Modo General:** Sin contexto específico, para consultas generales

### Arquitectura

#### Componentes Principales

```
/lexia/page.tsx               # Página principal de Lexia
/components/lexia/
  ├── lexia-chat-message.tsx  # Renderizado de mensajes
  ├── lexia-context-panel.tsx # Panel con contexto del caso
  └── lexia-tool-card.tsx     # Cards de herramientas
```

#### Módulos de Lexia

- **Chat:** Conversación con IA, historial de conversaciones, herramientas rápidas.
- **Redactor:** Formularios guiados para generar borradores (demanda, contestación, apelación, etc.).
- **Contestación Guiada:** Flujo completo desde el texto de la demanda hasta un borrador de contestación (parse → análisis → preguntas → respuestas → generación → iteración). Ver `docs/02-modulo-ia-lexia.md` (sección 10.6) y `docs/03-manual-de-usuario.md` (sección 11.6.1).

#### API: `/api/lexia`

Maneja streaming de respuestas de IA con contexto opcional.

```typescript
POST /api/lexia
Body: {
  messages: UIMessage[]              // Historial de chat
  caseContext?: {
    caseId: string
    caseNumber: string
    title: string
    description?: string
  }
}

Retorna: ReadableStream<UIMessage>   // Stream SSE
```

### Herramientas Disponibles

Organizadas en 4 categorías:

#### 1. Redacción
- **Generar Documento Legal:** Crear escritos, demandas, contestaciones
- **Mejorar Texto:** Optimizar gramática y claridad legal
- **Traducir Legal:** Traducir documentos legales

#### 2. Investigación
- **Resumir Documento:** Extraer puntos clave
- **Investigar Jurisprudencia:** Buscar casos similares
- **Analizar Contrato:** Revisar cláusulas críticas

#### 3. Procedimiento
- **Calcular Plazos:** Determinar fechas límite de procedimientos
- **Checklist Procesal:** Pasos para procedimientos específicos
- **Verificar Requisitos:** Validar documentación requerida

#### 4. Consulta
- **Pregunta Legal:** Consultas generales sobre leyes
- **Estrategia de Caso:** Recomendaciones de estrategia
- **Riesgos Legales:** Análisis de riesgos

### Modo Contextual

Cuando se selecciona un caso en Lexia:

```typescript
// El panel izquierdo muestra:
- Número y título del caso
- Compañía/cliente
- Documentos del caso
- Vencimientos próximos
- Notas recientes
```

Lexia puede entonces:
- Responder preguntas sobre ese caso específico
- Redactar documentos contextualizados
- Sugerir próximos pasos basados en los vencimientos
- Analizar documentos del caso

### Flujo de Mensaje

```typescript
1. Usuario escribe mensaje o selecciona herramienta
2. Se envía a /api/lexia con contexto
3. IA procesa y comienza streaming
4. Cada chunk se actualiza en tiempo real
5. Usuario puede copiar, expandir, o hacer follow-ups
```

### Logging de Uso

Cada interacción se registra en `activity_log`:
- `action_type`: 'lexia_query'
- `entity_type`: 'case' | 'general'
- `entity_id`: case_id o 'general'
- `case_id`: null si es general
- `description`: contexto de la consulta

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
