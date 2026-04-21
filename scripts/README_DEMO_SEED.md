# Demo Seed — Workspace completo para presentaciones

Guía rápida para poblar un "estudio ficticio" con data creíble en TODOS los
módulos de Lexia, listo para grabar videos, capturar screenshots o armar
presentaciones para prospects.

> **Archivo:** `scripts/052_demo_seed.sql`
> **Objetivo:** que un usuario controlado por vos tenga una sesión rica
> (casos, clientes, personas, tareas, vencimientos, documentos, chat de Lexia,
> documentos del Workspace, facturación) sin exponer data real.

---

## Contenido del demo

Se crea la organización **Estudio Demo Lexia** (slug `estudio-demo-lexia`,
plan `professional`) y un usuario admin que vas a usar vos.

| Módulo        | Cantidades                                                    |
| ------------- | ------------------------------------------------------------- |
| Empresas      | 5 (distribuidora, constructora, agro, textil, hotel)         |
| Personas      | 15 (clientes, jueces, contrapartes, peritos, testigos)        |
| Casos         | 8 (7 activos + 1 cerrado, mix laboral / civil / comercial / concursal / sucesorio) |
| Asignaciones  | 8 (sos líder en todos)                                        |
| Participantes | 17 (roles: cliente, juez, perito, testigo, contraparte)       |
| Notas de caso | 6 (incluye notas pineadas con estrategia)                    |
| Tareas        | 15 (mix de estados y prioridades; incluye una standalone)    |
| Vencimientos  | 9 (próximos, atrasados y completados)                        |
| Documentos    | 20 (PDF/Excel con metadata, un caso con varios)               |
| Notificaciones| 7 (4 sin leer + 3 leídas)                                    |
| Activity log  | 6 entradas recientes                                         |
| Lexia Workspace | 4 documentos (contestación avanzada, demanda, ofrecimiento de prueba, borrador vacío) |
| Versiones Lexia | 6 (historial del caso principal)                           |
| Ediciones AI | 3 (2 aplicadas, 1 pendiente)                                 |
| Chat Lexia   | 3 conversaciones (8 mensajes)                                 |
| Acuerdos honorarios | 4 (retainer + task, fixed+success, por etapas, cuota litis) |
| Facturas     | 5 (pagadas, emitidas, vencidas, parcialmente pagadas)         |
| Items facturación | 7                                                        |
| Pagos        | 3                                                             |
| Movimientos cuenta corriente | 8                                              |
| Participaciones abogado | 4 (pendiente, aprobada, pagada)                    |
| Liquidaciones mensuales | 2 (septiembre y octubre 2025)                      |

Los casos están ambientados en Córdoba (Argentina) con jueces, tribunales y
montos realistas. Todo vive bajo `organization_id = d3100000-0000-4000-a000-000000000001`.

---

## Cómo aplicarlo (primera vez)

### 1. Crear el usuario de demo en Supabase Auth

En el dashboard de Supabase → **Authentication → Users → Add user**:

- **Email:** `demo@lexia.app` (o el que prefieras — ver "Personalización")
- **Password:** cualquiera; vos te la acordás
- **Auto confirm:** activado
- **User metadata:** dejar vacío

> No es necesario pasar `firm_name` ni `system_role`: el seed se encarga.

### 2. Correr el script

Opción A — **Supabase SQL Editor** (recomendado):

1. Pegar el contenido de `scripts/052_demo_seed.sql`.
2. Ejecutar. El script usa `service_role`, bypasea RLS y tarda ~5 segundos.

Opción B — **psql con la connection string directa:**

```bash
psql "$SUPABASE_DB_URL" -f scripts/052_demo_seed.sql
```

### 3. Entrar a la app

- Ir a `/auth/login`.
- Email: `demo@lexia.app` (o el que hayas puesto).
- Password: la que definiste.
- Vas a aterrizar en el dashboard con toda la data demo cargada.

> **Importante:** si recién creás al usuario, Supabase suele pedir que
> confirmes el email la primera vez. Hacelo desde el dashboard (botón
> "Confirm email") o marcá "Auto confirm" al crear el usuario.

---

## Personalización

Al principio del script `052_demo_seed.sql` hay tres variables editables:

```sql
v_demo_email   TEXT := 'demo@lexia.app';
v_demo_first   TEXT := 'Dra. Lucía';
v_demo_last    TEXT := 'Martín';
v_demo_firm    TEXT := 'Estudio Demo Lexia';
v_demo_slug    TEXT := 'estudio-demo-lexia';
```

Cambialas y volvé a correr el script. Los datos ficticios de clientes,
casos y facturas se mantienen igual; sólo cambia tu identidad y el branding
del estudio.

---

## Refrescar la data (re-ejecutar)

El script es **idempotente**: usa UUIDs fijos + `ON CONFLICT` en cada INSERT.
Podés volver a correrlo cuantas veces quieras:

- Filas existentes se **actualizan** en los campos relevantes (títulos,
  estados, `updated_at`, etc.).
- Filas nuevas se insertan.
- **No se duplica nada.**

Esto es útil si durante el demo modificaste algo y querés volver al estado
base (volver a correr el script revierte las modificaciones en los campos
que el seed controla).

> Ojo: si en la sesión creaste filas NUEVAS (por ejemplo, un caso nuevo), el
> re-seed no las toca. Tendrías que borrarlas manualmente.

---

## Reset completo (borrar todo el demo)

Si querés borrar completamente la organización demo y su data:

```sql
-- CUIDADO: borra TODO lo asociado al estudio demo
DELETE FROM public.organizations
WHERE id = 'd3100000-0000-4000-a000-000000000001';
```

Algunas FKs son `RESTRICT` (ej. `profiles.organization_id`), así que primero
tenés que dejar el profile del usuario demo sin org:

```sql
UPDATE public.profiles
SET organization_id = NULL
WHERE email = 'demo@lexia.app';

-- Luego:
DELETE FROM public.organizations
WHERE id = 'd3100000-0000-4000-a000-000000000001';
```

Después podés volver a correr `052_demo_seed.sql` para regenerar todo.

---

## Tips para la presentación

1. **Pitch en 3 casos clave:**
   - `Molina c/ Distribuidora San Martín` → mostrar **Lexia Workspace** con
     contestación avanzada, modo agente, stress-test, citas verificadas.
   - `Constructora Arroyito c/ Frigorífico` → mostrar ejecutivo, audiencia
     próxima, factura vencida.
   - `Sierras Chicas s/ Concurso` → caso estratégico con conversación de
     chat, verificación de créditos, vencimiento inminente (8 días).

2. **Dashboard / inicio:**
   - Hay 4 notificaciones sin leer (1 atrasada, 2 próximas, 1 de documento
     nuevo) — perfecto para mostrar urgencia.
   - Actividad reciente muestra creación de casos, uploads, tareas completas
     y una intervención de "Modo Agente".

3. **Vencimientos / agenda:**
   - Mostrá el vencimiento atrasado (Sucesión Fernández, hace 5 días) en
     contraste con uno inminente (Contestar Molina, 6 días) y uno mediano.

4. **Lexia Workspace — grabación estrella:**
   - Abrí el documento "Contestación — Molina c/ Distribuidora San Martín".
   - Ya tiene contenido y citas. Ejecutá un **⌘K** sobre un párrafo nuevo
     para mostrar la edición con diff.
   - Abrí el **modo agente** con un objetivo nuevo (ej: "redactar sección VII
     sobre daños y perjuicios agravados") y mostrá el plan + ejecución.
   - Disparar el **stress-test** para mostrar hallazgos y rewrites sugeridos.

5. **Billing:**
   - Mostrá la factura vencida de Constructora Arroyito ($968.000).
   - La cuenta corriente de Hotel Sierras Chicas tiene saldo pendiente
     (pago parcial).
   - La liquidación mensual de octubre 2025 incluye participación del
     concurso.

---

## Seguridad / Multi-tenant

Todo el seed se encuadra en la organización `Estudio Demo Lexia`. Las
políticas RLS existentes garantizan que un usuario de otra organización
**no ve** esta data. Podés dejar el script aplicado en producción sin riesgo:
sólo impacta a quien tenga el login del usuario demo.

Si querés más prolijo (separar instancia demo de producción), hacé un
clon de la base o una segunda Supabase project exclusiva para demos.

---

## Diagnóstico / troubleshooting

| Síntoma                                             | Causa probable / solución                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `No encontré un usuario con email...`               | El usuario no existe en `auth.users`. Creá la cuenta en Supabase Auth primero.              |
| Al loguearte ves un dashboard vacío                 | Probablemente el profile no quedó ligado a la org. Verificá `SELECT organization_id FROM public.profiles WHERE email='demo@lexia.app';` y reejecutá el seed. |
| "permission denied for table..."                    | Estás corriendo como usuario normal. Ejecutá el script con service_role (SQL Editor) o como postgres (`psql`). |
| Citas verificadas no matchean con jurisprudencia real | Son ficticias a propósito. Podés reemplazarlas editando los contenidos en `lexia_documents.content`. |
| Falta alguna funcionalidad nueva                    | Verificá que todas las migraciones anteriores (001–051) estén aplicadas.                    |

---

## Archivos involucrados

- `scripts/052_demo_seed.sql` — el seed completo.
- `scripts/README_DEMO_SEED.md` — este archivo.

No se modifica ninguna migración previa ni código de aplicación; el seed es
puro SQL idempotente sobre las tablas existentes.
