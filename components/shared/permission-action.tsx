/**
 * Permission-Aware Action Components
 * 
 * Components that handle visibility and state based on user permissions.
 * Provides consistent UX patterns for permission-restricted actions.
 * 
 * @example
 * <PermissionGate permission="canEdit" fallback={<DisabledButton />}>
 *   <EditButton />
 * </PermissionGate>
 */
'use client'

import React from 'react'
import Link from 'next/link'
import { Lock, Eye, EyeOff, Shield, Type as type, LucideIcon } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { type SystemRole, type CaseRole } from '@/lib/types'

/**
 * Permission types that can be checked
 */
type PermissionType =
  | 'canView'
  | 'canEdit'
  | 'canDelete'
  | 'canCreate'
  | 'canManageUsers'
  | 'canManageTeam'
  | 'canShareDocuments'
  | 'canCloseCase'
  | 'isAdmin'
  | 'isCaseLeader'

/**
 * User permissions context
 */
interface UserPermissions {
  systemRole?: SystemRole
  caseRole?: CaseRole
  canView?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canCreate?: boolean
  canManageUsers?: boolean
  canManageTeam?: boolean
  canShareDocuments?: boolean
  canCloseCase?: boolean
}

/**
 * Check if user has specific permission
 */
function hasPermission(
  permissions: UserPermissions,
  requiredPermission: PermissionType
): boolean {
  // Admin always has all permissions (systemRole may be typed narrowly from context)
  if ((permissions.systemRole as string) === 'admin_general') return true

  switch (requiredPermission) {
    case 'isAdmin':
      return (permissions.systemRole as string) === 'admin_general'
    case 'isCaseLeader':
      return permissions.caseRole === 'leader'
    case 'canView':
      return permissions.canView ?? true
    case 'canEdit':
      return permissions.canEdit ?? false
    case 'canDelete':
      return permissions.canDelete ?? false
    case 'canCreate':
      return permissions.canCreate ?? false
    case 'canManageUsers':
      return permissions.canManageUsers ?? false
    case 'canManageTeam':
      return permissions.canManageTeam ?? false
    case 'canShareDocuments':
      return permissions.canShareDocuments ?? false
    case 'canCloseCase':
      return permissions.canCloseCase ?? false
    default:
      return false
  }
}

/**
 * Permission messages for different actions
 */
const permissionMessages: Record<PermissionType, string> = {
  canView: 'No tiene permiso para ver este elemento',
  canEdit: 'No tiene permiso para editar',
  canDelete: 'No tiene permiso para eliminar',
  canCreate: 'No tiene permiso para crear',
  canManageUsers: 'Solo administradores pueden gestionar usuarios',
  canManageTeam: 'Solo el responsable del caso puede gestionar el equipo',
  canShareDocuments: 'No tiene permiso para compartir documentos',
  canCloseCase: 'Solo el responsable o administrador puede cerrar el caso',
  isAdmin: 'Esta acción requiere permisos de administrador',
  isCaseLeader: 'Esta acción requiere ser responsable del caso',
}

/**
 * Props for PermissionGate component
 */
interface PermissionGateProps {
  /** Required permission to show children */
  permission: PermissionType
  /** User's permissions */
  permissions: UserPermissions
  /** Content to show when user has permission */
  children: React.ReactNode
  /** Content to show when user doesn't have permission (optional) */
  fallback?: React.ReactNode
  /** Whether to completely hide the element (vs show disabled state) */
  hideWhenDenied?: boolean
}

/**
 * Permission gate that controls visibility of child elements
 */
export function PermissionGate({
  permission,
  permissions,
  children,
  fallback,
  hideWhenDenied = false,
}: PermissionGateProps) {
  const allowed = hasPermission(permissions, permission)

  if (allowed) {
    return <>{children}</>
  }

  if (hideWhenDenied) {
    return null
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return null
}

/**
 * Props for PermissionButton component
 */
interface PermissionButtonProps extends Omit<ButtonProps, 'disabled'> {
  /** Required permission to enable the button */
  permission: PermissionType
  /** User's permissions */
  permissions: UserPermissions
  /** Button content */
  children: React.ReactNode
  /** Link destination (renders as Link when user has permission) */
  href?: string
  /** Show a tooltip explaining why action is disabled */
  showTooltip?: boolean
  /** Custom tooltip message */
  tooltipMessage?: string
  /** Whether to hide the button entirely when denied (vs disabled state) */
  hideWhenDenied?: boolean
  /** Icon to show in disabled state */
  disabledIcon?: LucideIcon
}

/**
 * Permission-aware button that disables/hides based on permissions
 */
export function PermissionButton({
  permission,
  permissions,
  children,
  href,
  showTooltip = true,
  tooltipMessage,
  hideWhenDenied = false,
  disabledIcon: DisabledIcon = Lock,
  className,
  ...buttonProps
}: PermissionButtonProps) {
  const allowed = hasPermission(permissions, permission)
  const message = tooltipMessage || permissionMessages[permission]

  // Hide entirely if requested and denied
  if (!allowed && hideWhenDenied) {
    return null
  }

  // Enabled state
  if (allowed) {
    if (href) {
      return (
        <Button className={className} asChild {...buttonProps}>
          <Link href={href}>{children}</Link>
        </Button>
      )
    }
    return (
      <Button className={className} {...buttonProps}>
        {children}
      </Button>
    )
  }

  // Disabled state
  const disabledButton = (
    <Button
      className={cn('cursor-not-allowed', className)}
      disabled
      {...buttonProps}
    >
      <DisabledIcon className="mr-2 h-4 w-4 opacity-50" />
      {children}
    </Button>
  )

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{disabledButton}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              {message}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return disabledButton
}

/**
 * Permission badge showing user's access level
 */
export function PermissionBadge({
  permissions,
  showDetails = false,
}: {
  permissions: UserPermissions
  showDetails?: boolean
}) {
  const { systemRole, caseRole } = permissions

  // Determine the display role
  let roleLabel: string
  let roleColor: string
  let RoleIcon: LucideIcon

  if (systemRole === 'admin_general') {
    roleLabel = 'Administrador'
    roleColor = 'bg-primary text-primary-foreground'
    RoleIcon = Shield
  } else if (caseRole === 'leader') {
    roleLabel = 'Responsable'
    roleColor = 'bg-blue-100 text-blue-800'
    RoleIcon = Eye
  } else if (systemRole === 'case_leader') {
    roleLabel = 'Abogado'
    roleColor = 'bg-green-100 text-green-800'
    RoleIcon = Eye
  } else if (systemRole === 'lawyer_executive') {
    roleLabel = 'Asistente'
    roleColor = 'bg-amber-100 text-amber-800'
    RoleIcon = EyeOff
  } else {
    roleLabel = 'Invitado'
    roleColor = 'bg-muted text-muted-foreground'
    RoleIcon = EyeOff
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
              roleColor
            )}
          >
            <RoleIcon className="h-3 w-3" />
            {roleLabel}
          </div>
        </TooltipTrigger>
        {showDetails && (
          <TooltipContent>
            <div className="space-y-1 text-xs">
              <p className="font-medium">Permisos:</p>
              <ul className="space-y-0.5">
                <li className="flex items-center gap-1">
                  {permissions.canEdit ? (
                    <Eye className="h-3 w-3 text-green-500" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  Editar
                </li>
                <li className="flex items-center gap-1">
                  {permissions.canDelete ? (
                    <Eye className="h-3 w-3 text-green-500" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  Eliminar
                </li>
                <li className="flex items-center gap-1">
                  {permissions.canManageTeam ? (
                    <Eye className="h-3 w-3 text-green-500" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  Gestionar equipo
                </li>
              </ul>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Visibility indicator for client-visible content
 */
export function ClientVisibilityIndicator({
  isClientVisible,
  showLabel = true,
}: {
  isClientVisible: boolean
  showLabel?: boolean
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
              isClientVisible
                ? 'bg-green-100 text-green-800'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isClientVisible ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            {showLabel && (isClientVisible ? 'Visible para cliente' : 'Solo interno')}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isClientVisible
            ? 'Este elemento es visible para el cliente en su portal'
            : 'Este elemento solo es visible para el equipo interno'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Read-only mode indicator
 */
export function ReadOnlyIndicator({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
      <Lock className="h-4 w-4" />
      <span>{message || 'Modo de solo lectura - No tiene permisos para editar'}</span>
    </div>
  )
}
