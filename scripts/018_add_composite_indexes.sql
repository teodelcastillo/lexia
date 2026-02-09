/**
 * Script 018: Agregar Índices Compuestos para Optimización Multi-Tenant
 * 
 * Este script crea índices compuestos para optimizar queries comunes que filtran
 * por organization_id y otros campos frecuentemente usados juntos.
 * 
 * Los índices mejoran significativamente el rendimiento de:
 * - Filtros por organización y estado
 * - Ordenamiento por fecha dentro de una organización
 * - Búsquedas de tareas por usuario y organización
 * - Queries de vencimientos por fecha y estado
 * - Documentos por caso dentro de una organización
 * 
 * IMPORTANTE: Ejecutar este script después de haber ejecutado los scripts de
 * multi-tenancy (012-017) para asegurar que las columnas organization_id existan.
 */

-- Verificar que las columnas organization_id existen antes de crear índices
DO $$
BEGIN
  -- Verificar columnas organization_id en tablas principales
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cases' 
    AND column_name = 'organization_id'
  ) THEN
    RAISE EXCEPTION 'La columna organization_id no existe en la tabla cases. Ejecute primero los scripts de multi-tenancy (012-017).';
  END IF;
END $$;

-- ============================================================================
-- ÍNDICES PARA CASES
-- ============================================================================

-- Índice para filtros por organización y estado (muy común en dashboards)
CREATE INDEX IF NOT EXISTS idx_cases_org_status 
  ON public.cases(organization_id, status) 
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_cases_org_status IS 
  'Optimiza queries que filtran casos por organización y estado (ej: casos activos de una organización)';

-- Índice para ordenamiento por fecha de actualización dentro de una organización
CREATE INDEX IF NOT EXISTS idx_cases_org_updated 
  ON public.cases(organization_id, updated_at DESC) 
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_cases_org_updated IS 
  'Optimiza queries que ordenan casos por fecha de actualización dentro de una organización';

-- ============================================================================
-- ÍNDICES PARA TASKS
-- ============================================================================

-- Índice para tareas asignadas a un usuario dentro de una organización
CREATE INDEX IF NOT EXISTS idx_tasks_org_assigned 
  ON public.tasks(organization_id, assigned_to) 
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_tasks_org_assigned IS 
  'Optimiza queries que buscan tareas de un usuario específico dentro de una organización';

-- Índice para filtros comunes de tareas: organización, estado y fecha de vencimiento
CREATE INDEX IF NOT EXISTS idx_tasks_org_status_due 
  ON public.tasks(organization_id, status, due_date) 
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_tasks_org_status_due IS 
  'Optimiza queries que filtran tareas por organización, estado y fecha de vencimiento';

-- ============================================================================
-- ÍNDICES PARA DEADLINES
-- ============================================================================

-- Índice para vencimientos ordenados por fecha dentro de una organización
CREATE INDEX IF NOT EXISTS idx_deadlines_org_due 
  ON public.deadlines(organization_id, due_date) 
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_deadlines_org_due IS 
  'Optimiza queries que ordenan vencimientos por fecha dentro de una organización';

-- Índice para vencimientos pendientes ordenados por fecha (muy común en dashboards)
CREATE INDEX IF NOT EXISTS idx_deadlines_org_completed_due 
  ON public.deadlines(organization_id, is_completed, due_date) 
  WHERE organization_id IS NOT NULL AND is_completed = false;

COMMENT ON INDEX idx_deadlines_org_completed_due IS 
  'Optimiza queries que buscan vencimientos pendientes ordenados por fecha dentro de una organización';

-- ============================================================================
-- ÍNDICES PARA DOCUMENTS
-- ============================================================================

-- Índice para documentos por caso dentro de una organización
CREATE INDEX IF NOT EXISTS idx_documents_org_case 
  ON public.documents(organization_id, case_id) 
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_documents_org_case IS 
  'Optimiza queries que buscan documentos de un caso específico dentro de una organización';

-- ============================================================================
-- VERIFICACIÓN DE ÍNDICES CREADOS
-- ============================================================================

-- Mostrar índices creados
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%_org_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- NOTAS ADICIONALES
-- ============================================================================

-- Los índices parciales (con WHERE) son más eficientes porque:
-- 1. Ocupan menos espacio (solo indexan filas donde organization_id IS NOT NULL)
-- 2. Son más rápidos de mantener
-- 3. Mejoran el rendimiento de queries que filtran por organización
--
-- PostgreSQL puede usar múltiples índices en una sola query si es beneficioso,
-- pero estos índices compuestos son especialmente útiles cuando se filtran
-- por múltiples columnas juntas.
--
-- Para verificar el uso de índices en queries específicas, usar EXPLAIN ANALYZE:
-- EXPLAIN ANALYZE SELECT * FROM cases WHERE organization_id = 'xxx' AND status = 'active';
