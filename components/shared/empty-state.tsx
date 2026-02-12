/**
 * Empty State Component
 * 
 * Displays friendly, contextual empty states when no data is available.
 * Provides clear messaging and optional actions to guide users.
 * 
 * @example
 * <EmptyState
 *   type="cases"
 *   title="No hay casos"
 *   description="Aún no tiene casos asignados"
 *   action={{ label: "Crear Caso", href: "/casos/nuevo" }}
 * />
 */
'use client'

import React from 'react'
import Link from 'next/link'
import { Briefcase, Users, CheckSquare, FileText, Calendar, MessageSquare, Clock, Search, FolderOpen, Bell, AlertCircle, Type as type, LucideIcon, Building2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Predefined empty state types with default icons and messages
 */
type EmptyStateType =
  | 'cases'
  | 'clients'
  | 'companies'
  | 'suppliers'
  | 'tasks'
  | 'documents'
  | 'deadlines'
  | 'notes'
  | 'activity'
  | 'search'
  | 'calendar'
  | 'notifications'
  | 'generic'

/**
 * Default configurations for each empty state type
 */
const emptyStateDefaults: Record<
  EmptyStateType,
  { icon: LucideIcon; title: string; description: string }
> = {
  cases: {
    icon: Briefcase,
    title: 'No hay casos',
    description: 'No se encontraron casos que coincidan con los criterios de búsqueda.',
  },
  clients: {
    icon: Users,
    title: 'No hay clientes',
    description: 'Aún no hay clientes registrados en el sistema.',
  },
  companies: {
    icon: Building2,
    title: 'No hay empresas clientes',
    description: 'Agregue una nueva empresa como cliente.',
  },
  suppliers: {
    icon: Package,
    title: 'No hay empresas proveedoras',
    description: 'Agregue una empresa y márquela como proveedor.',
  },
  tasks: {
    icon: CheckSquare,
    title: 'No hay tareas',
    description: 'No tiene tareas pendientes. ¡Excelente trabajo!',
  },
  documents: {
    icon: FileText,
    title: 'No hay documentos',
    description: 'No se han subido documentos aún.',
  },
  deadlines: {
    icon: Clock,
    title: 'No hay vencimientos',
    description: 'No hay vencimientos próximos programados.',
  },
  notes: {
    icon: MessageSquare,
    title: 'No hay notas',
    description: 'No se han agregado notas internas.',
  },
  activity: {
    icon: Bell,
    title: 'Sin actividad reciente',
    description: 'No hay actividad registrada en este período.',
  },
  search: {
    icon: Search,
    title: 'Sin resultados',
    description: 'No se encontraron resultados para su búsqueda.',
  },
  calendar: {
    icon: Calendar,
    title: 'Calendario vacío',
    description: 'No hay eventos programados para este período.',
  },
  notifications: {
    icon: Bell,
    title: 'Sin notificaciones',
    description: 'No tiene notificaciones pendientes.',
  },
  generic: {
    icon: FolderOpen,
    title: 'No hay datos',
    description: 'No hay información disponible.',
  },
}

/**
 * Action configuration for empty states
 */
interface EmptyStateAction {
  /** Button label */
  label: string
  /** Link destination (renders as Link) */
  href?: string
  /** Click handler (renders as Button) */
  onClick?: () => void
  /** Whether the action requires specific permissions */
  requiresPermission?: boolean
}

/**
 * Props for the EmptyState component
 */
interface EmptyStateProps {
  /** Predefined type for default icon and messages */
  type?: EmptyStateType
  /** Custom icon (overrides type default) */
  icon?: LucideIcon
  /** Title text (overrides type default) */
  title?: string
  /** Description text (overrides type default) */
  description?: string
  /** Primary action button */
  action?: EmptyStateAction
  /** Secondary action button */
  secondaryAction?: EmptyStateAction
  /** Whether user has permission to perform the action */
  hasPermission?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

/**
 * EmptyState component for displaying friendly empty states
 */
export function EmptyState({
  type = 'generic',
  icon,
  title,
  description,
  action,
  secondaryAction,
  hasPermission = true,
  size = 'md',
  className,
}: EmptyStateProps) {
  const defaults = emptyStateDefaults[type]
  const Icon = icon || defaults.icon
  const displayTitle = title || defaults.title
  const displayDescription = description || defaults.description

  const sizeClasses = {
    sm: {
      container: 'py-6',
      icon: 'h-8 w-8',
      iconContainer: 'h-12 w-12',
      title: 'text-sm font-medium',
      description: 'text-xs',
    },
    md: {
      container: 'py-12',
      icon: 'h-10 w-10',
      iconContainer: 'h-16 w-16',
      title: 'text-base font-semibold',
      description: 'text-sm',
    },
    lg: {
      container: 'py-16',
      icon: 'h-12 w-12',
      iconContainer: 'h-20 w-20',
      title: 'text-lg font-semibold',
      description: 'text-base',
    },
  }

  const sizes = sizeClasses[size]

  /** Render action button based on configuration */
  const renderAction = (actionConfig: EmptyStateAction, variant: 'default' | 'outline') => {
    // Hide action if it requires permission and user doesn't have it
    if (actionConfig.requiresPermission && !hasPermission) {
      return null
    }

    const buttonProps = {
      variant,
      size: size === 'sm' ? 'sm' : 'default',
    } as const

    if (actionConfig.href) {
      return (
        <Button {...buttonProps} asChild>
          <Link href={actionConfig.href}>{actionConfig.label}</Link>
        </Button>
      )
    }

    return (
      <Button {...buttonProps} onClick={actionConfig.onClick}>
        {actionConfig.label}
      </Button>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizes.container,
        className
      )}
    >
      {/* Icon container */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted mb-4',
          sizes.iconContainer
        )}
      >
        <Icon className={cn('text-muted-foreground', sizes.icon)} />
      </div>

      {/* Title */}
      <h3 className={cn('text-foreground mb-1', sizes.title)}>
        {displayTitle}
      </h3>

      {/* Description */}
      <p className={cn('text-muted-foreground max-w-sm mb-4', sizes.description)}>
        {displayDescription}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action && renderAction(action, 'default')}
          {secondaryAction && renderAction(secondaryAction, 'outline')}
        </div>
      )}
    </div>
  )
}

/**
 * Specialized empty state for search results
 */
export function SearchEmptyState({
  query,
  onClear,
  suggestions,
}: {
  query: string
  onClear?: () => void
  suggestions?: string[]
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        Sin resultados para &ldquo;{query}&rdquo;
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        No encontramos coincidencias. Intente con otros términos.
      </p>

      {suggestions && suggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Sugerencias:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion) => (
              <span
                key={suggestion}
                className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      )}

      {onClear && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Limpiar búsqueda
        </Button>
      )}
    </div>
  )
}

/**
 * Specialized empty state for errors
 */
export function ErrorEmptyState({
  title = 'Error al cargar datos',
  description = 'Ocurrió un problema al cargar la información. Por favor, intente nuevamente.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
