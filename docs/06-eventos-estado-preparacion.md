# Eventos: Estado Temporal vs Preparación

## Objetivo

Separar visual y funcionalmente el **estado temporal** del evento (fecha) del **estado operativo de preparación** (tareas). Así, un evento en fecha pasada con tareas completas se muestra como correctamente preparado, sin connotación de incumplimiento.

## Reglas de dominio

### Estado temporal (`proximo` | `hoy` | `pasado`)

- **proximo**: fecha posterior a hoy
- **hoy**: misma fecha que hoy
- **pasado**: fecha anterior a hoy

### Estado de preparación (`sin_iniciar` | `en_curso` | `listo` | `no_aplica`)

Calculado desde tareas asociadas:

| Condición | Estado |
|-----------|--------|
| 0 tareas | `no_aplica` |
| Todas completadas | `listo` |
| Alguna `in_progress` o `under_review` | `en_curso` |
| Resto | `sin_iniciar` |

Las tareas con `cancelled` se excluyen del cálculo.

### Riesgo legal (`alto` | `medio` | `bajo` | `ninguno`)

- **alto**: evento tipo entregable, fecha pasada, preparación no `listo`
- **medio**: evento tipo entregable, fecha hoy, preparación no `listo`
- **bajo**: reunión/audiencia/otro, o entregable con preparación `listo`
- **ninguno**: preparación `no_aplica`

### Tipo de evento (`deliverable` | `meeting` | `hearing` | `other`)

- **deliverable**: vencimientos, plazos, presentaciones, escritos
- **hearing**: audiencias, juicios, tribunal
- **meeting**: reuniones
- **other**: resto

Inferencia por texto (summary/description) cuando no hay clasificación manual.

## UX

- **Badge 1**: Fecha (temporal): Próximo / Hoy / Pasado
- **Badge 2**: Preparación: Sin iniciar / En curso / Listo / No aplica
- **Indicador %**: completadas/total en detalle de evento
- **Color rojo**: solo para riesgo legal real, no solo "pasó la fecha"

## Implementación

- Utilidades centrales en `lib/event-status.ts`
- Single source of truth: no duplicar lógica por componente
- Accesibilidad: badges con texto explícito, no depender solo de color

## Migración opcional (Fase 3)

Ejecutar `scripts/043_google_calendar_event_preparation.sql` para habilitar override manual:

- `event_kind`: clasificación manual (deliverable, meeting, hearing, other)
- `preparation_override`: estado manual (sin_iniciar, en_curso, listo, no_aplica)
- `prepared_at`: timestamp de preparación

Precedencia: `preparation_override` > cálculo por tareas > `no_aplica`.

## Métricas sugeridas

Para observabilidad post-rollout:

- Eventos con `listo` antes de la fecha (buen indicador)
- Eventos pasados no-listos (riesgo legal potencial)
- Uso de override manual vs inferencia automática
