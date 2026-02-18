# Integración con Google

Este documento describe la configuración e implementación de la integración con servicios de Google (Calendar, Drive, Sheets, Docs).

## Prioridad 1: Google Calendar

Los usuarios pueden conectar su cuenta de Google para sincronizar vencimientos con Google Calendar.

### Flujo de conexión

1. El usuario va a **Perfil** o **Configuración** > Integraciones
2. Hace clic en **Conectar** en Google Calendar
3. Es redirigido a Google para autorizar
4. Tras autorizar, vuelve a la app con la cuenta conectada
5. Al crear vencimientos con "Sincronizar con calendario", se crea el evento en Google Calendar

### Configuración en Google Cloud Console

1. Cree un proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilite **Google Calendar API** en APIs y servicios > Biblioteca
3. Cree credenciales OAuth 2.0:
   - APIs y servicios > Credenciales > Crear credenciales > ID de cliente OAuth
   - Tipo: Aplicación web
   - Orígenes JavaScript autorizados:
     - `http://localhost:3000` (desarrollo)
     - `https://tu-dominio.com` (producción)
   - URIs de redirección autorizados:
     - `http://localhost:3000/api/google/callback` (desarrollo)
     - `https://tu-dominio.com/api/google/callback` (producción)
4. Copie el **Client ID** y **Client Secret**

### Variables de entorno

Agregue a `.env.local`:

```env
# Google OAuth (para Calendar, Drive, Sheets, Docs)
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

En producción, use la URL de su dominio:

```env
GOOGLE_REDIRECT_URI=https://tu-dominio.com/api/google/callback
```

### Base de datos

Ejecute el script de migración:

```bash
# En Supabase SQL Editor o via CLI
psql -f scripts/038_google_connections.sql
```

La tabla `google_connections` almacena los tokens OAuth por usuario y servicio.

### API Routes

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/google/connect` | POST | Inicia el flujo OAuth, devuelve URL de autorización |
| `/api/google/callback` | GET | Callback de Google, guarda tokens |
| `/api/google/disconnect` | POST | Desconecta un servicio |
| `/api/google/status` | GET | Estado de conexiones del usuario |
| `/api/deadlines/[id]/sync-google` | POST | Sincroniza un vencimiento a Google Calendar |

---

## Próximos pasos: Sheets y Docs

Las integraciones con Google Sheets y Google Docs están preparadas en el esquema y la UI (mostrando "Próximamente"). Para habilitarlas:

1. Habilitar las APIs correspondientes en Google Cloud Console
2. Los scopes ya están definidos en `lib/google/client.ts`
3. Quitar `comingSoon: true` en `components/settings/google-integrations.tsx`

---

## Seguridad

- Los tokens se almacenan en `google_connections` con RLS: cada usuario solo accede a sus propias conexiones
- El flujo OAuth usa `state` para prevenir CSRF
- Las cookies de estado son HttpOnly y de corta duración (10 min)
