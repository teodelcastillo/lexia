# LEXIA - Documentacion Tecnica Completa

**Version:** 1.0.0
**Ultima actualizacion:** Febrero 2026
**Stack tecnologico:** Next.js 16 + Supabase + Vercel AI SDK 6 + Tailwind CSS 4

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Modulo de Autenticacion y Seguridad](#2-modulo-de-autenticacion-y-seguridad)
3. [Modulo de Gestion de Casos](#3-modulo-de-gestion-de-casos)
4. [Modulo de Personas y Empresas](#4-modulo-de-personas-y-empresas)
5. [Modulo de Documentos](#5-modulo-de-documentos)
6. [Modulo de Tareas y Vencimientos](#6-modulo-de-tareas-y-vencimientos)
7. [Modulo de Inteligencia Artificial (Lexia)](#7-modulo-de-inteligencia-artificial-lexia)
8. [Modulo de Notificaciones](#8-modulo-de-notificaciones)
9. [Portal de Clientes](#9-portal-de-clientes)
10. [Panel de Administracion](#10-panel-de-administracion)
11. [Base de Datos - Esquema Completo](#11-base-de-datos-esquema-completo)
12. [Estructura de Archivos](#12-estructura-de-archivos)
13. [Variables de Entorno](#13-variables-de-entorno)
14. [Guia de Despliegue](#14-guia-de-despliegue)

---

## 1. Arquitectura General

### 1.1 Vision General

Lexia es un sistema de gestion integral para estudios juridicos construido como una aplicacion web monolitica de servidor y cliente (Server-Side Rendering + Client Components) usando el App Router de Next.js 16. La aplicacion sigue una arquitectura de tres capas:

```
+---------------------------------------------------------+
|                    CAPA DE PRESENTACION                 |
|   Next.js App Router (RSC + Client Components)         |
|   Tailwind CSS 4 + shadcn/ui + Lucide Icons            |
+---------------------------------------------------------+
                          |
+---------------------------------------------------------+
|                 CAPA DE LOGICA DE NEGOCIO               |
|   Server Actions | API Routes | Middleware              |
|   Vercel AI SDK 6 (Lexia AI) | Notification Service    |
+---------------------------------------------------------+
                          |
+---------------------------------------------------------+
|                 CAPA DE PERSISTENCIA                    |
|   Supabase (PostgreSQL + Auth + RLS + Storage)          |
|   Row Level Security | Real-time Subscriptions          |
+---------------------------------------------------------+
```

### 1.2 Stack Tecnologico

| Tecnologia | Version | Proposito |
|---|---|---|
| **Next.js** | 16 | Framework full-stack con App Router |
| **React** | 19.2 | Biblioteca de UI con Server Components |
| **TypeScript** | 5.x | Tipado estatico |
| **Tailwind CSS** | 4 | Sistema de estilos utility-first |
| **shadcn/ui** | Latest | Componentes de UI accesibles |
| **Supabase** | Latest | Backend-as-a-Service (PostgreSQL, Auth, Storage) |
| **Vercel AI SDK** | 6 | Integracion con modelos de IA (GPT-4) |
| **Zod** | Latest | Validacion de esquemas |
| **Sonner** | Latest | Notificaciones toast |
| **Lucide** | Latest | Iconografia |
| **date-fns** | Latest | Manipulacion de fechas |

### 1.3 Patrones Arquitectonicos

- **Server Components by Default:** Las paginas se renderizan en el servidor para performance optima. Solo se usa `'use client'` cuando se requiere interactividad (formularios, estados locales, event handlers).
- **Colocation de datos:** Cada pagina Server Component realiza sus propias queries a Supabase directamente, eliminando la necesidad de una capa API intermedia para lectura.
- **Server Actions para mutaciones:** Las operaciones de escritura (crear caso, actualizar tarea) se implementan como Server Actions o API Routes protegidos.
- **Role-Based Access Control (RBAC):** Cuatro roles del sistema (`admin_general`, `case_leader`, `lawyer_executive`, `client`) con permisos granulares.
- **Middleware de proteccion:** Todas las rutas del dashboard estan protegidas a nivel de middleware de Next.js con verificacion de sesion Supabase.

### 1.4 Flujo de Datos

```
Browser Request
      |
  proxy.ts (Session refresh + Route protection)
      |
  layout.tsx (Dashboard shell: Sidebar + Header)
      |
  page.tsx (Server Component - fetches data from Supabase)
      |
  Client Components (Interactive UI with local state)
      |
  Server Actions / API Routes (Mutations + AI)
      |
  Supabase (PostgreSQL with RLS)
```

---

## 2. Modulo de Autenticacion y Seguridad

### 2.1 Arquitectura de Auth

La autenticacion se implementa con **Supabase Auth**, que provee JWT tokens, session management, y refresh token rotation de forma nativa.

**Archivos clave:**
```
lib/supabase/client.ts       - Cliente Supabase para browser (singleton)
lib/supabase/server.ts        - Cliente Supabase para Server Components/Actions
lib/supabase/proxy.ts     - Session refresh y route protection
lib/hooks/use-auth.ts          - Hook de autenticacion para Client Components
lib/utils/access-control.ts   - Validacion de acceso en Server Components
proxy.ts                  - Entry point del middleware de Next.js
app/auth/login/page.tsx        - Pagina de login para equipo interno
app/auth/portal-login/page.tsx - Pagina de login para clientes
app/auth/sign-up/page.tsx      - Registro de nuevos usuarios
app/auth/callback/route.ts     - Callback de OAuth
```

### 2.2 Roles del Sistema

| Rol | Clave DB | Permisos |
|---|---|---|
| **Administrador General** | `admin_general` | Acceso total: gestionar usuarios, ver todos los casos, configuracion del sistema, reportes |
| **Lider de Caso** | `case_leader` | Crear/editar casos, gestionar equipo de caso, asignar tareas, ver todos sus casos |
| **Abogado Ejecutivo** | `lawyer_executive` | Trabajar en casos asignados, crear clientes/personas, ver documentos asignados |
| **Cliente** | `client` | Acceso solo lectura al Portal de Clientes, ver sus casos y documentos marcados como visibles |

### 2.3 Middleware de Proteccion de Rutas

El middleware (`lib/supabase/proxy.ts`) intercepta TODAS las solicitudes y:

1. **Refresca la sesion** en cada request para evitar logouts inesperados.
2. **Protege rutas internas:** `/dashboard`, `/casos`, `/clientes`, `/personas`, `/empresas`, `/tareas`, `/vencimientos`, `/documentos`, `/calendario`, `/notas`, `/lexia`, `/herramientas`, `/admin`, `/perfil`, `/notificaciones`, `/configuracion`.
3. **Protege el portal de clientes:** `/portal/*` requiere autenticacion con redireccion a `/auth/portal-login`.
4. **Redirige usuarios autenticados** fuera de las paginas de auth, considerando su rol (clientes al portal, equipo al dashboard).

### 2.4 Hook useAuth (Client-Side)

```typescript
interface UseAuthReturn {
  user: User | null              // Usuario Supabase autenticado
  profile: UserProfile | null    // Perfil del usuario (de tabla profiles)
  isLoading: boolean             // Estado de carga
  error: Error | null            // Error de autenticacion
  signOut: () => Promise<void>   // Cerrar sesion
  refreshProfile: () => Promise<void>  // Refrescar perfil
  hasRole: (role) => boolean     // Verificar rol
  permissions: GlobalPermissions  // Permisos globales computados
}
```

**Mecanismo de inicializacion:**
- Escucha `onAuthStateChange` para eventos `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, y `SIGNED_OUT`.
- Fallback de 1.5 segundos: si el listener no dispara, inicializa manualmente via `getUser()`.
- Computa permisos globales derivados del `system_role`:
  - `is_admin`: Solo `admin_general`
  - `can_create_cases`: `admin_general` y `case_leader`
  - `can_create_clients`: `admin_general`, `case_leader`, `lawyer_executive`
  - `can_manage_users`: Solo `admin_general`
  - `can_view_all_cases`: Solo `admin_general`
  - `can_access_settings`: Solo `admin_general`

### 2.5 Control de Acceso en Servidor

```typescript
// lib/utils/access-control.ts

validateAndRedirectAccess()  // Redirige clientes a /portal, requiere auth
validateAdminAccess()        // Solo admin_general, redirige al inicio si no
validateTeamAccess()         // Excluye clientes, requiere auth
```

Cada pagina del dashboard invoca `validateAndRedirectAccess()` o funciones mas especificas al inicio de su ejecucion como Server Component.

### 2.6 Row Level Security (RLS)

Las tablas criticas tienen RLS habilitado en Supabase:

| Tabla | RLS | Politicas |
|---|---|---|
| `profiles` | Si | Ver propio perfil + ver perfiles internos + insertar autenticado + actualizar propio |
| `activity_log` | Si | Seleccionar propios registros |
| `case_assignments` | Si | Seleccionar propias asignaciones |
| `case_participants` | Si | CRUD con permisos por rol (admin ve todo, asignados ven sus casos) |
| `companies` | Si | CRUD completo para autenticados |
| `deadlines` | Si | Seleccionar propios vencimientos |
| `documents` | Si | Habilitado (politicas pendientes) |
| `notifications` | Si | Ver propias + insertar autenticados + actualizar propias |
| `people` | Si | Seleccionar propios (clientes) + CRUD para equipo |
| `tasks` | Si | Habilitado (politicas pendientes) |
| `cases` | Si | Habilitado (politicas pendientes) |
| `case_notes` | Si | Habilitado (politicas pendientes) |

---

## 3. Modulo de Gestion de Casos

### 3.1 Descripcion

El modulo central de la aplicacion. Permite la gestion completa del ciclo de vida de un caso legal, desde su creacion hasta su archivo.

**Archivos clave:**
```
app/(dashboard)/casos/page.tsx          - Listado de casos con filtros
app/(dashboard)/casos/[id]/page.tsx     - Detalle de caso (vista completa)
app/(dashboard)/casos/nuevo/page.tsx    - Formulario de creacion
components/cases/case-overview.tsx       - Vista general del caso
components/cases/case-timeline.tsx       - Linea de tiempo del caso
components/cases/case-documents.tsx      - Documentos vinculados
components/cases/case-notes.tsx          - Notas del caso
components/cases/case-tasks.tsx          - Tareas del caso
components/cases/case-deadlines.tsx      - Vencimientos del caso
components/cases/case-team.tsx           - Equipo asignado
components/cases/case-activity-log.tsx   - Log de actividad
components/cases/cases-table.tsx         - Tabla de casos con sorting
components/cases/cases-filters.tsx       - Filtros avanzados
components/cases/create-case-form.tsx    - Formulario de creacion
components/cases/case-lexia-button.tsx   - Boton de acceso a Lexia desde caso
```

### 3.2 Modelo de Datos

```sql
TABLE cases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number           TEXT NOT NULL UNIQUE,
  title                 TEXT NOT NULL,
  case_type             TEXT NOT NULL,
  status                case_status DEFAULT 'active',
  company_id            UUID REFERENCES companies(id),
  description           TEXT,
  court_name            TEXT,
  court_number          TEXT,
  jurisdiction          TEXT,
  filing_date           DATE,
  next_hearing_date     TIMESTAMPTZ,
  opposing_party        TEXT,
  opposing_counsel      TEXT,
  estimated_value       NUMERIC,
  fee_arrangement       TEXT,
  statute_of_limitations DATE,
  notes                 TEXT,
  is_visible_to_client  BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
)

ENUM case_status: active | pending | on_hold | closed | archived
```

### 3.3 Estados del Caso

| Estado | Clave | Descripcion |
|---|---|---|
| Activo | `active` | Caso con actividad procesal en curso |
| Pendiente | `pending` | Esperando respuesta o accion externa |
| En Espera | `on_hold` | Suspendido temporalmente |
| Cerrado | `closed` | Caso finalizado |
| Archivado | `archived` | Caso archivado para referencia |

### 3.4 Relaciones del Caso

Un caso se conecta con multiples entidades:

- **company_id** -> `companies`: La empresa/cliente asociada al caso.
- **case_assignments** -> `profiles`: Equipo de abogados asignado (con roles: `leader`, `member`, `assistant`).
- **case_participants** -> `people`: Partes procesales (juez, fiscal, perito, testigo, contraparte, etc.).
- **tasks**: Tareas asociadas al caso.
- **deadlines**: Vencimientos y audiencias programadas.
- **documents**: Documentos del caso.
- **case_notes**: Notas internas y visibles al cliente.
- **activity_log**: Registro de toda la actividad del caso.

### 3.5 Vista de Detalle (Tabs)

La pagina de detalle del caso (`/casos/[id]`) organiza la informacion en pestanas:

1. **General**: Vista panoramica con informacion del caso, empresa, tribunal, partes.
2. **Timeline**: Linea cronologica de eventos y actividades.
3. **Documentos**: Documentos vinculados con filtros por categoria.
4. **Notas**: Notas del equipo con opcion de visibilidad al cliente y anclado.
5. **Tareas**: Tareas pendientes y completadas del caso.
6. **Vencimientos**: Audiencias, plazos procesales, reuniones.
7. **Equipo**: Abogados asignados con roles y fecha de asignacion.
8. **Actividad**: Log completo de acciones realizadas en el caso.

### 3.6 Permisos Contextuales por Caso

El hook `useCasePermissions(caseId)` computa permisos especificos para cada caso:

```typescript
interface CasePermissionContext {
  case_id: string
  can_view: boolean         // Puede ver el caso
  can_edit: boolean         // Puede editar datos del caso
  can_manage_team: boolean  // Puede agregar/quitar miembros
  can_delete: boolean       // Puede eliminar el caso
  role: CaseRole | null     // Rol en el caso
}
```

- **admin_general**: Acceso total a todos los casos.
- **case_leader**: Acceso total a sus casos asignados.
- **lawyer_executive**: Puede ver y editar casos donde esta asignado, pero no gestionar equipo.
- **client**: Solo lectura via Portal de Clientes.

---

## 4. Modulo de Personas y Empresas

### 4.1 Descripcion

Gestion de todas las personas fisicas y juridicas involucradas en los casos del estudio.

**Archivos clave:**
```
app/(dashboard)/personas/page.tsx        - Listado de personas
app/(dashboard)/personas/[id]/page.tsx   - Detalle de persona
app/(dashboard)/personas/nueva/page.tsx  - Crear persona
app/(dashboard)/empresas/[id]/page.tsx   - Detalle de empresa
app/(dashboard)/empresas/nueva/page.tsx  - Crear empresa
app/(dashboard)/clientes/page.tsx        - Listado de clientes (vista especial)
app/(dashboard)/clientes/[id]/page.tsx   - Detalle de cliente
app/(dashboard)/clientes/nuevo/page.tsx  - Crear cliente
components/people/create-person-form.tsx - Formulario de persona
components/companies/create-company-form.tsx - Formulario de empresa
components/clients/client-form.tsx       - Formulario de cliente
components/clients/client-info-card.tsx  - Tarjeta de info del cliente
components/clients/client-cases-list.tsx - Casos del cliente
components/clients/client-documents.tsx  - Documentos del cliente
components/clients/client-notes.tsx      - Notas del cliente
```

### 4.2 Personas Fisicas

```sql
TABLE people (
  id                UUID PRIMARY KEY,
  first_name        TEXT,
  last_name         TEXT,
  name              TEXT,
  email             TEXT NOT NULL,
  phone             TEXT,
  secondary_phone   TEXT,
  dni               TEXT,
  cuit              TEXT,
  person_type       person_type,  -- client, judge, opposing_lawyer, etc.
  client_type       TEXT,
  company_id        UUID REFERENCES companies(id),
  company_name      TEXT,
  company_role      company_role,
  portal_user_id    UUID REFERENCES profiles(id),
  address           TEXT,
  city              TEXT,
  province          TEXT,
  postal_code       TEXT,
  legal_representative TEXT,
  notes             TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
)

ENUM person_type: client | judge | opposing_lawyer | prosecutor | witness | expert | other
```

### 4.3 Tipos de Persona

| Tipo | Clave | Descripcion |
|---|---|---|
| Cliente | `client` | Cliente del estudio |
| Juez | `judge` | Juez del tribunal |
| Abogado Contraparte | `opposing_lawyer` | Abogado de la parte contraria |
| Fiscal | `prosecutor` | Fiscal interviniente |
| Testigo | `witness` | Testigo en causa |
| Perito | `expert` | Perito designado |
| Otro | `other` | Otras personas vinculadas |

### 4.4 Empresas / Personas Juridicas

```sql
TABLE companies (
  id              UUID PRIMARY KEY,
  company_name    TEXT NOT NULL,
  name            TEXT,
  legal_name      TEXT,
  tax_id          TEXT,
  cuit            TEXT,
  legal_form      TEXT,
  industry        TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  address         TEXT,
  city            TEXT,
  province        TEXT,
  postal_code     TEXT,
  country         TEXT,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
```

### 4.5 Participantes en Casos

Las personas se vinculan a casos a traves de `case_participants`:

```sql
TABLE case_participants (
  id          UUID PRIMARY KEY,
  case_id     UUID REFERENCES cases(id),
  person_id   UUID REFERENCES people(id),
  role        participant_role,
  notes       TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)

ENUM participant_role: client_representative | opposing_party | opposing_lawyer |
                       judge | prosecutor | expert_witness | witness | mediator |
                       court_clerk | other
```

### 4.6 Miembros de Empresa (Vista Materializada)

```sql
VIEW company_members AS (
  person_id, first_name, last_name, email, phone,
  person_type, company_id, company_name, company_role
)
```

---

## 5. Modulo de Documentos

### 5.1 Descripcion

Gestion de documentos asociados a casos, con soporte para carga de archivos, vinculacion de Google Drive, categorizacion, y control de visibilidad para clientes.

**Archivos clave:**
```
app/(dashboard)/documentos/page.tsx        - Listado (tabla + grilla + arbol)
app/(dashboard)/documentos/[id]/page.tsx   - Detalle del documento
app/(dashboard)/documentos/subir/page.tsx  - Formulario de subida
app/(dashboard)/documentos/vincular/page.tsx - Vincular desde Google Drive
components/documents/document-upload-form.tsx - Formulario de carga
components/documents/document-link-form.tsx   - Formulario de vinculacion
components/cases/case-documents.tsx           - Documentos dentro del caso
```

### 5.2 Modelo de Datos

```sql
TABLE documents (
  id                    UUID PRIMARY KEY,
  case_id               UUID NOT NULL REFERENCES cases(id),
  name                  TEXT NOT NULL,
  description           TEXT,
  file_path             TEXT,
  file_size             INTEGER,
  mime_type             TEXT,
  category              document_category DEFAULT 'other',
  is_visible_to_client  BOOLEAN DEFAULT false,
  version               INTEGER DEFAULT 1,
  parent_document_id    UUID REFERENCES documents(id),
  google_drive_id       TEXT,
  google_drive_url      TEXT,
  uploaded_by           UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
)

ENUM document_category: contract | court_filing | correspondence |
                        evidence | internal_memo | client_document | other
```

### 5.3 Categorias de Documentos

| Categoria | Clave | Descripcion |
|---|---|---|
| Contrato | `contract` | Contratos y acuerdos |
| Escrito Judicial | `court_filing` | Escritos presentados al tribunal |
| Correspondencia | `correspondence` | Cartas, emails, comunicaciones |
| Evidencia | `evidence` | Pruebas documentales |
| Memo Interno | `internal_memo` | Notas y memos del estudio |
| Documento del Cliente | `client_document` | Documentos aportados por el cliente |
| Otro | `other` | Otros documentos |

### 5.4 Funcionalidades

- **Triple vista**: Tabla (listado), Grilla (tarjetas), Arbol (agrupado por caso/empresa).
- **Carga de archivos**: Formulario con drag-and-drop, previsualizacion de nombre y tamano.
- **Vinculacion Google Drive**: Permite vincular documentos de Google Drive por ID sin subir el archivo.
- **Control de visibilidad**: Campo `is_visible_to_client` determina si el cliente puede ver el documento en su portal.
- **Versionamiento**: Campo `version` y `parent_document_id` para rastrear versiones de un documento.
- **Filtros**: Por caso, empresa, categoria, visibilidad, y busqueda por nombre.

---

## 6. Modulo de Tareas y Vencimientos

### 6.1 Tareas

**Archivos clave:**
```
app/(dashboard)/tareas/page.tsx          - Listado de tareas
app/(dashboard)/tareas/[id]/page.tsx     - Detalle de tarea
app/(dashboard)/tareas/nueva/page.tsx    - Crear tarea
components/tasks/task-form.tsx           - Formulario de tarea
components/tasks/task-status-actions.tsx  - Acciones de cambio de estado
components/cases/case-tasks.tsx          - Tareas dentro del caso
components/dashboard/pending-tasks.tsx   - Widget de tareas pendientes
```

```sql
TABLE tasks (
  id                        UUID PRIMARY KEY,
  case_id                   UUID REFERENCES cases(id),
  title                     TEXT NOT NULL,
  description               TEXT,
  status                    task_status DEFAULT 'pending',
  priority                  task_priority DEFAULT 'medium',
  assigned_to               UUID REFERENCES profiles(id),
  created_by                UUID NOT NULL REFERENCES profiles(id),
  due_date                  TIMESTAMPTZ,
  estimated_hours           NUMERIC,
  actual_hours              NUMERIC,
  completed_at              TIMESTAMPTZ,
  reminder_date             TIMESTAMPTZ,
  google_calendar_event_id  TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
)

ENUM task_status: pending | in_progress | under_review | completed | cancelled
ENUM task_priority: urgent | high | medium | low
```

### 6.2 Vencimientos y Audiencias

**Archivos clave:**
```
app/(dashboard)/vencimientos/page.tsx       - Listado de vencimientos
app/(dashboard)/vencimientos/nuevo/page.tsx  - Crear vencimiento
components/deadlines/deadline-form.tsx       - Formulario de vencimiento
components/cases/case-deadlines.tsx          - Vencimientos del caso
components/dashboard/upcoming-deadlines.tsx  - Widget de proximos vencimientos
```

```sql
TABLE deadlines (
  id                        UUID PRIMARY KEY,
  case_id                   UUID NOT NULL REFERENCES cases(id),
  title                     TEXT NOT NULL,
  description               TEXT,
  deadline_type             TEXT NOT NULL,
  due_date                  TIMESTAMPTZ NOT NULL,
  status                    deadline_status DEFAULT 'pending',
  assigned_to               UUID REFERENCES profiles(id),
  is_completed              BOOLEAN DEFAULT false,
  completed_at              TIMESTAMPTZ,
  completed_by              UUID REFERENCES profiles(id),
  created_by                UUID NOT NULL REFERENCES profiles(id),
  reminder_days             INTEGER[],
  google_calendar_event_id  TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
)

ENUM deadline_status: pending | completed | missed | cancelled
ENUM deadline_type: court_date | filing_deadline | meeting | other
```

### 6.3 Tipos de Vencimiento

| Tipo | Clave | Descripcion |
|---|---|---|
| Audiencia | `court_date` | Audiencia judicial programada |
| Presentacion | `filing_deadline` | Plazo para presentar escrito |
| Reunion | `meeting` | Reunion con cliente o equipo |
| Otro | `other` | Otros vencimientos |

### 6.4 Calendario

```
app/(dashboard)/calendario/page.tsx  - Vista de calendario unificada
```

El calendario unifica tareas y vencimientos en una vista mensual interactiva.

---

## 7. Modulo de Inteligencia Artificial (Lexia)

> **Nota:** La documentacion en profundidad de este modulo se encuentra en `docs/02-modulo-ia-lexia.md`.

### 7.1 Resumen

Lexia es el asistente legal de IA integrado, basado en Vercel AI SDK 6 con GPT-4. Opera en dos modos:

1. **Modo Contextual**: Desde un caso especifico, con acceso a datos, documentos, notas y vencimientos del caso.
2. **Modo General**: Asistencia juridica standalone sin contexto de caso.

### 7.2 Puntos de Integracion

```
app/api/lexia/route.ts              - API Route principal (streaming)
app/api/ai-assistant/route.ts       - API Route alternativa (AI assistant)
app/(dashboard)/lexia/page.tsx       - Interfaz de chat completa
components/lexia/lexia-chat-message.tsx   - Componente de mensaje
components/lexia/lexia-context-panel.tsx  - Panel de contexto del caso
components/lexia/lexia-tool-card.tsx      - Tarjetas de herramientas
components/cases/case-lexia-button.tsx    - Boton "Consultar a Lexia" desde caso
```

### 7.3 Herramientas Disponibles

| Herramienta | Funcion |
|---|---|
| `summarizeDocument` | Resume documentos legales identificando partes, obligaciones, plazos |
| `generateDraft` | Genera borradores de escritos judiciales (9 plantillas) |
| `getProceduralChecklist` | Checklists procesales por tipo de caso (9 tipos) |
| `calculateDeadline` | Calculo de plazos procesales en dias habiles |
| `queryCaseInfo` | Consulta datos del caso activo (documentos, notas, tareas) |

---

## 8. Modulo de Notificaciones

### 8.1 Descripcion

Sistema de notificaciones internas en tiempo real con categorizacion por actividad y trabajo.

**Archivos clave:**
```
lib/services/notifications.ts                  - Servicio de creacion de notificaciones
app/api/notifications/route.ts                 - API de notificaciones
app/(dashboard)/notificaciones/page.tsx         - Pagina de notificaciones
components/notifications/notifications-popover.tsx - Popover en el header
components/notifications/notifications-view.tsx    - Vista completa
```

### 8.2 Modelo de Datos

```sql
TABLE notifications (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id),
  category      notification_category,  -- 'activity' | 'work'
  type          notification_type,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  case_id       UUID REFERENCES cases(id),
  task_id       UUID REFERENCES tasks(id),
  deadline_id   UUID REFERENCES deadlines(id),
  document_id   UUID REFERENCES documents(id),
  triggered_by  UUID REFERENCES profiles(id),
  metadata      JSONB DEFAULT '{}',
  is_read       BOOLEAN DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
)
```

### 8.3 Tipos de Notificacion

- `case_created`, `case_updated`, `case_status_changed`, `case_assigned`
- `task_assigned`, `task_completed`, `task_overdue`
- `deadline_approaching`, `deadline_overdue`, `deadline_created`
- `document_uploaded`, `document_deleted`
- `user_login`, `user_created`, `comment_added`, `person_created`, `company_created`, `mention`

### 8.4 Jerarquia de Notificaciones

```
Evento ocurre
      |
  getUsersToNotify() --> Determina destinatarios por jerarquia:
      |                   - Admins: Reciben TODA la actividad
      |                   - Case Leaders: Reciben actividad de SUS casos
      |                   - Assignees: Reciben tareas y vencimientos asignados
      |
  createNotifications() --> Inserta en tabla con batch insert
```

### 8.5 Funciones del Servicio

```typescript
// Notificar creacion de caso (a admins)
notifyCaseCreated(caseId, caseNumber, title, createdBy)

// Notificar asignacion de tarea (al asignado + admins/leaders)
notifyTaskAssigned(taskId, taskTitle, caseId, assignedTo, assignedBy)

// Notificar vencimiento proximo (a todos los involucrados)
notifyDeadlineApproaching(deadlineId, title, caseId, dueDate, daysRemaining)

// Notificar subida de documento (al equipo del caso)
notifyDocumentUploaded(documentId, documentName, caseId, uploadedBy)
```

---

## 9. Portal de Clientes

### 9.1 Descripcion

Interfaz separada y simplificada para clientes externos del estudio. Usa un layout completamente distinto al dashboard interno, con lenguaje amigable y no tecnico.

**Archivos clave:**
```
app/(portal)/layout.tsx                  - Layout del portal (distinto al dashboard)
app/(portal)/portal/page.tsx             - Dashboard del cliente
app/(portal)/portal/casos/[id]/page.tsx  - Detalle de caso (vista cliente)
app/(portal)/portal/documentos/page.tsx  - Documentos del cliente
app/(portal)/portal/ayuda/page.tsx       - Centro de ayuda
components/portal/portal-header.tsx      - Header del portal
app/auth/portal-login/page.tsx           - Login exclusivo para clientes
```

### 9.2 Funcionalidades

- **Vista de casos**: Muestra solo casos donde `is_visible_to_client = true`, con estados traducidos a lenguaje amigable (ej: "active" -> "En Curso").
- **Proximas fechas**: Audiencias y plazos proximos visibles para el cliente.
- **Documentos**: Solo documentos con `is_visible_to_client = true`.
- **Actualizaciones recientes**: Feed de actividad filtrada relevante para el cliente.
- **Centro de ayuda**: Informacion de contacto y preguntas frecuentes.

### 9.3 Seguridad del Portal

- Login separado (`/auth/portal-login`) con UI diferenciada.
- Middleware redirige a clientes al portal y previene acceso al dashboard interno.
- RLS de Supabase filtra datos a nivel de base de datos para que el cliente solo vea lo propio.
- Personas con `portal_user_id` vinculan al usuario de auth con su registro de persona/cliente.

---

## 10. Panel de Administracion

### 10.1 Descripcion

Herramientas de administracion del sistema, accesibles solo para `admin_general`.

**Archivos clave:**
```
app/(dashboard)/admin/usuarios/page.tsx       - Gestion de usuarios
app/(dashboard)/admin/usuarios/nuevo/page.tsx  - Crear usuario
app/(dashboard)/admin/usuarios/users-table.tsx - Tabla de usuarios
app/(dashboard)/admin/perfiles/page.tsx        - Gestionar perfiles de clientes
components/admin/new-user-form.tsx             - Formulario nuevo usuario
components/admin/team-profiles-manager.tsx     - Gestion de perfiles del equipo
components/admin/client-profiles-manager.tsx   - Gestion de perfiles de clientes
```

### 10.2 Funcionalidades

- **Gestion de usuarios**: CRUD completo de usuarios del sistema con asignacion de roles.
- **Perfiles de equipo**: Gestion de datos profesionales (numero de matricula, titulo, etc.).
- **Perfiles de clientes**: Vincular personas con cuentas de portal.
- **Configuracion**: Parametros generales del sistema.

### 10.3 Dashboards por Rol

```
components/dashboard/admin-dashboard.tsx   - Dashboard del admin
components/dashboard/leader-dashboard.tsx  - Dashboard del lider de caso
components/dashboard/lawyer-dashboard.tsx  - Dashboard del abogado ejecutivo
components/dashboard/dashboard-stats.tsx   - Estadisticas compartidas
components/dashboard/recent-cases.tsx      - Casos recientes
components/dashboard/recent-activity.tsx   - Actividad reciente
components/dashboard/pending-tasks.tsx     - Tareas pendientes
components/dashboard/upcoming-deadlines.tsx - Proximos vencimientos
```

Cada rol ve un dashboard personalizado:
- **Admin**: Metricas globales, actividad de todo el estudio, gestion de usuarios.
- **Lider de Caso**: Sus casos, equipo, vencimientos criticos.
- **Abogado Ejecutivo**: Tareas asignadas, proximos vencimientos, casos participados.

---

## 11. Base de Datos - Esquema Completo

### 11.1 Diagrama de Entidad-Relacion (Textual)

```
profiles (1) ---< (N) case_assignments (N) >--- (1) cases
profiles (1) ---< (N) tasks
profiles (1) ---< (N) deadlines
profiles (1) ---< (N) documents
profiles (1) ---< (N) notifications
profiles (1) ---< (N) activity_log

cases (1) ---< (N) case_assignments
cases (1) ---< (N) case_participants (N) >--- (1) people
cases (1) ---< (N) case_notes
cases (1) ---< (N) tasks
cases (1) ---< (N) deadlines
cases (1) ---< (N) documents
cases (1) ---< (N) activity_log
cases (N) >--- (1) companies

people (N) >--- (1) companies
people (1) ---< (N) case_participants

documents (N) >--- (1) documents (parent_document_id - versionamiento)
```

### 11.2 Tablas Totales: 14

| # | Tabla | Registros Clave | RLS |
|---|---|---|---|
| 1 | `profiles` | Usuarios del sistema | Si |
| 2 | `cases` | Casos legales | Si |
| 3 | `companies` | Empresas / personas juridicas | Si |
| 4 | `people` | Personas fisicas (clientes, jueces, etc.) | Si |
| 5 | `case_assignments` | Asignacion equipo -> caso | Si |
| 6 | `case_participants` | Participantes procesales | Si |
| 7 | `case_notes` | Notas de caso | Si |
| 8 | `tasks` | Tareas | Si |
| 9 | `deadlines` | Vencimientos y audiencias | Si |
| 10 | `documents` | Documentos | Si |
| 11 | `notifications` | Notificaciones | Si |
| 12 | `activity_log` | Registro de actividad | Si |
| 13 | `case_participants_detail` | Vista materializada | No |
| 14 | `company_members` | Vista materializada | No |

### 11.3 Enums de PostgreSQL

```sql
-- Roles de usuario
CREATE TYPE user_role AS ENUM ('admin_general', 'case_leader', 'lawyer_executive', 'client');

-- Estado de caso
CREATE TYPE case_status AS ENUM ('active', 'pending', 'on_hold', 'closed', 'archived');

-- Estado de tarea
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'under_review', 'completed', 'cancelled');

-- Prioridad de tarea
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'medium', 'low');

-- Estado de vencimiento
CREATE TYPE deadline_status AS ENUM ('pending', 'completed', 'missed', 'cancelled');

-- Tipo de vencimiento
CREATE TYPE deadline_type AS ENUM ('court_date', 'filing_deadline', 'meeting', 'other');

-- Categoria de documento
CREATE TYPE document_category AS ENUM ('contract', 'court_filing', 'correspondence', 'evidence', 'internal_memo', 'client_document', 'other');

-- Tipo de persona
CREATE TYPE person_type AS ENUM ('client', 'judge', 'opposing_lawyer', 'prosecutor', 'witness', 'expert', 'other');

-- Rol de participante
CREATE TYPE participant_role AS ENUM ('client_representative', 'opposing_party', 'opposing_lawyer', 'judge', 'prosecutor', 'expert_witness', 'witness', 'mediator', 'court_clerk', 'other');

-- Rol en empresa
CREATE TYPE company_role AS ENUM ('legal_representative', 'attorney', 'contact', 'shareholder', 'director', 'other');

-- Categoria de notificacion
CREATE TYPE notification_category AS ENUM ('activity', 'work');
```

---

## 12. Estructura de Archivos

```
/
+-- app/
|   +-- (dashboard)/           # Rutas del dashboard interno
|   |   +-- admin/             # Panel de administracion
|   |   +-- asistente-ia/      # Asistente IA (ruta alternativa)
|   |   +-- calendario/        # Vista de calendario
|   |   +-- casos/             # Gestion de casos
|   |   +-- clientes/          # Gestion de clientes
|   |   +-- configuracion/     # Configuracion del sistema
|   |   +-- dashboard/         # Pagina principal del dashboard
|   |   +-- documentos/        # Gestion de documentos
|   |   +-- empresas/          # Gestion de empresas
|   |   +-- herramientas/      # Herramientas auxiliares
|   |   +-- lexia/             # Asistente IA Lexia
|   |   +-- notas/             # Notas rapidas
|   |   +-- notificaciones/    # Centro de notificaciones
|   |   +-- perfil/            # Perfil del usuario
|   |   +-- personas/          # Gestion de personas
|   |   +-- tareas/            # Gestion de tareas
|   |   +-- vencimientos/      # Gestion de vencimientos
|   |   +-- layout.tsx         # Layout del dashboard (sidebar + header)
|   +-- (portal)/              # Rutas del portal de clientes
|   |   +-- portal/            # Paginas del portal
|   |   +-- layout.tsx         # Layout del portal
|   +-- api/                   # API Routes
|   |   +-- ai-assistant/      # API del asistente IA
|   |   +-- lexia/             # API de Lexia
|   |   +-- notifications/     # API de notificaciones
|   |   +-- admin/             # API de administracion
|   +-- auth/                  # Paginas de autenticacion
|   +-- actions/               # Server Actions
|   +-- layout.tsx             # Root layout
|   +-- page.tsx               # Landing page
+-- components/
|   +-- admin/                 # Componentes de administracion
|   +-- cases/                 # Componentes de casos
|   +-- clients/               # Componentes de clientes
|   +-- companies/             # Componentes de empresas
|   +-- dashboard/             # Componentes del dashboard
|   +-- deadlines/             # Componentes de vencimientos
|   +-- documents/             # Componentes de documentos
|   +-- lexia/                 # Componentes de Lexia IA
|   +-- notifications/         # Componentes de notificaciones
|   +-- people/                # Componentes de personas
|   +-- portal/                # Componentes del portal
|   +-- profile/               # Componentes de perfil
|   +-- shared/                # Componentes compartidos
|   +-- tasks/                 # Componentes de tareas
|   +-- theme/                 # Tema y modo oscuro
|   +-- ui/                    # Componentes base shadcn/ui
+-- lib/
|   +-- hooks/                 # Custom hooks (useAuth, useCasePermissions)
|   +-- services/              # Servicios (notifications)
|   +-- supabase/              # Clientes Supabase (client, server, middleware)
|   +-- types/                 # TypeScript types y enums
|   +-- utils/                 # Utilidades (access-control, cn)
+-- docs/                      # Documentacion
+-- scripts/                   # Scripts de migracion y seed
```

---

## 13. Variables de Entorno

| Variable | Requerida | Descripcion |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Si | URL publica del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Clave anonima publica de Supabase |
| `SUPABASE_URL` | Si | URL del proyecto Supabase (server) |
| `SUPABASE_ANON_KEY` | Si | Clave anonima (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Si | Clave de service role (operaciones admin) |
| `SUPABASE_JWT_SECRET` | Si | Secreto JWT para verificacion de tokens |
| `POSTGRES_URL` | Si | URL de conexion directa a PostgreSQL |
| `POSTGRES_URL_NON_POOLING` | Si | URL sin connection pooling |
| `POSTGRES_PRISMA_URL` | Si | URL para Prisma (si se usa) |
| `POSTGRES_USER` | Si | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | Si | Contrasena de PostgreSQL |
| `POSTGRES_DATABASE` | Si | Nombre de la base de datos |
| `POSTGRES_HOST` | Si | Host de PostgreSQL |

Todas las variables del servidor se configuran automaticamente a traves de la integracion de Supabase en Vercel.

---

## 14. Guia de Despliegue

### 14.1 Requisitos Previos

1. Cuenta de **Vercel** con proyecto creado.
2. Proyecto de **Supabase** configurado con esquema de base de datos.
3. Variables de entorno configuradas en Vercel.

### 14.2 Pasos de Despliegue

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd lexia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# (Se configuran automaticamente via integracion Supabase en Vercel)

# 4. Ejecutar migraciones de base de datos
# Los scripts SQL en /scripts se ejecutan en el dashboard de Supabase

# 5. Desplegar a Vercel
vercel deploy --prod
```

### 14.3 Configuracion Post-Despliegue

1. **Crear usuario admin**: Registrar primer usuario y cambiar su `system_role` a `admin_general` en la tabla `profiles` de Supabase.
2. **Configurar RLS**: Verificar que las politicas de seguridad estan activas.
3. **Configurar dominios**: Si se usa dominio personalizado, configurar en Vercel y Supabase Auth.
4. **Habilitar AI**: El modelo GPT-4 se conecta automaticamente via Vercel AI Gateway.

---

*Documento generado automaticamente. Revision: Febrero 2026.*
