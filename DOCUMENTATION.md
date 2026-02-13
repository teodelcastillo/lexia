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

#### Rutas Protegidas

```
/dashboard
├── /casos              # Listado de casos
├── /casos/[id]         # Detalle de caso
├── /clientes           # Listado de clientes
├── /personas           # Listado de personas
├── /empresas           # Listado de empresas
├── /tareas             # Gestión de tareas
├── /deadlines          # Vencimientos
├── /lexia              # Asistente Legal IA
├── /notificaciones     # Centro de notificaciones
├── /perfil             # Mi perfil
└── /admin
    ├── /usuarios       # Gestión de usuarios
    ├── /perfiles       # Gestión de perfiles (team + clients)
    └── /portal         # Portal de cliente (admin)
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

### Endpoints Principales

#### Autenticación

```typescript
POST /api/auth/logout
POST /api/auth/login
POST /api/auth/signup
```

#### Notificaciones

```typescript
GET /api/notifications
  Query params:
  - category: 'all' | 'activity' | 'work'
  - limit: number (default: 20)

Retorna: { work: Notification[], activity: Notification[] }
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

Flujo asistido para redactar contestaciones desde el texto de la demanda. Documentación completa en `docs/02-modulo-ia-lexia.md` (sección 10.6).

```typescript
POST /api/lexia/contestacion/sessions
Body: { caseId?: string, demandaRaw: string }
Retorna: { sessionId, state, current_step }

GET  /api/lexia/contestacion/sessions/[id]
Retorna: { session: { id, state, current_step, demanda_raw, ... } }

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
Body: {
  email: string
  clientId: string
}

Retorna: { userId, email, temporalPassword }
```

### Estructura de Respuestas

#### Notificación

```typescript
interface Notification {
  id: string
  user_id: string
  title: string
  description: string
  category: 'activity' | 'work'
  type: NotificationType
  related_entity_id?: string
  related_entity_type?: string
  is_read: boolean
  created_at: string
}

type NotificationType =
  | 'task_assigned'
  | 'deadline_approaching'
  | 'document_uploaded'
  | 'comment_added'
  | 'case_status_changed'
  | 'user_joined'
  | 'file_shared'
```

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

**persons** (Personas)
- id, first_name, last_name
- company_id (FK)
- role, email, phone

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

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
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

**Última actualización:** 2026-02-03
**Versión:** 1.0.0
