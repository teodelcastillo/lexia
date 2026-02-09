# Flujo de Registro de Usuarios con Organizaciones

## Cambios Realizados

### 1. Script SQL: `016_update_user_registration_trigger.sql`

**Ejecutar este script después de los scripts de multi-tenancy (012-015)**

Este script actualiza el trigger `handle_new_user()` para:

- **Crear organización automáticamente** cuando un usuario con `system_role: 'admin_general'` se registra directamente (sign-up)
- **Asignar organization_id** a nuevos usuarios basándose en:
  - Si es admin_general con `firm_name` en metadata → crea nueva organización
  - Si tiene `organization_id` en metadata → usa esa organización (cuando admin crea usuarios)
  - Si no tiene ninguno → deja NULL (fallback, aplicación debe manejar)

### 2. Código Actualizado

#### `app/actions/create-team-member.ts`
- Ahora obtiene `organization_id` del admin que crea el usuario
- Pasa `organization_id` en metadata al crear el usuario
- Asigna `organization_id` al perfil si el trigger no lo hace

#### `app/api/admin/create-client-user/route.ts`
- Ahora obtiene `organization_id` del admin que crea el usuario cliente
- Pasa `organization_id` en `user_metadata` al crear el usuario
- Asigna `organization_id` al perfil al crearlo manualmente

#### `app/auth/sign-up/page.tsx`
- Ya pasa `firm_name` y `firm_city` en metadata (no necesita cambios)
- El trigger usará estos datos para crear la organización automáticamente

---

## Flujo Completo

### Registro de Nuevo Estudio (Sign-Up)

1. Usuario completa formulario en `/auth/sign-up`
2. Se crea usuario en `auth.users` con:
   - `system_role: 'admin_general'`
   - `firm_name` y `firm_city` en metadata
3. Trigger `handle_new_user()` ejecuta:
   - Detecta que es `admin_general` con `firm_name`
   - Crea nueva organización con slug único
   - Crea perfil con `organization_id` asignado
4. Usuario queda como admin de su organización

### Creación de Miembros del Equipo (Admin)

1. Admin va a `/admin/usuarios/nuevo`
2. Completa formulario con datos del nuevo usuario
3. `createTeamMember()` ejecuta:
   - Obtiene `organization_id` del admin actual
   - Crea usuario con `organization_id` en metadata
   - Trigger asigna `organization_id` al perfil
4. Nuevo usuario pertenece a la misma organización del admin

### Creación de Usuarios Cliente (Admin)

1. Admin crea usuario cliente desde panel
2. `create-client-user` API ejecuta:
   - Obtiene `organization_id` del admin actual
   - Crea usuario con `organization_id` en metadata
   - Asigna `organization_id` al perfil
3. Usuario cliente pertenece a la misma organización del admin

---

## Orden de Ejecución de Scripts

1. `012_create_organizations.sql` - Crea tabla organizations y agrega columnas
2. `013_organizations_helpers_and_triggers.sql` - Crea funciones y triggers de auto-asignación
3. `014_organizations_rls_policies.sql` - Actualiza políticas RLS
4. `015_create_default_organization.sql` - Crea org por defecto (si hay usuarios existentes)
5. **`016_update_user_registration_trigger.sql`** - Actualiza trigger de registro

---

## Notas Importantes

1. **Slug único**: El trigger genera un slug único basado en `firm_name` + `firm_city`. Si ya existe, agrega un número aleatorio.

2. **Fallback**: Si por alguna razón el trigger no asigna `organization_id`, el código de la aplicación lo hace manualmente como fallback.

3. **Usuarios existentes**: Si ya tienes usuarios antes de ejecutar estos scripts, ejecuta `015_create_default_organization.sql` para asignarlos a una organización por defecto.

4. **Testing**: Después de ejecutar los scripts, prueba:
   - Registro de nuevo estudio (debe crear organización)
   - Creación de miembro del equipo (debe usar organización del admin)
   - Creación de usuario cliente (debe usar organización del admin)

---

## Verificación

Ejecuta estas queries para verificar:

```sql
-- Ver organizaciones creadas
SELECT id, name, slug, created_by FROM public.organizations;

-- Ver usuarios con sus organizaciones
SELECT 
  p.id,
  p.email,
  p.system_role,
  p.organization_id,
  o.name as organization_name
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.organization_id
ORDER BY p.created_at DESC
LIMIT 10;

-- Verificar que todos los admins tienen organización
SELECT 
  p.id,
  p.email,
  p.organization_id,
  o.name as organization_name
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.organization_id
WHERE p.system_role = 'admin_general'
AND p.organization_id IS NULL;
```

Si hay admins sin `organization_id`, ejecuta manualmente:

```sql
-- Asignar organización por defecto a admins sin organización
UPDATE public.profiles
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'default' LIMIT 1)
WHERE system_role = 'admin_general' 
AND organization_id IS NULL;
```
