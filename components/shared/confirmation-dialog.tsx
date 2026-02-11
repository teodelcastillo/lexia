/**
 * Confirmation Dialog Component
 * 
 * Provides confirmation flows for critical and legal-sensitive operations.
 * Supports different severity levels and optional input verification.
 * 
 * @example
 * <ConfirmationDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   title="Eliminar caso"
 *   description="Esta acción no se puede deshacer."
 *   severity="danger"
 *   onConfirm={handleDelete}
 * />
 */
'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  Trash2,
  FileX,
  UserMinus,
  Archive,
  Send,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/**
 * Severity levels for confirmation dialogs
 */
type ConfirmationSeverity = 'info' | 'warning' | 'danger'

/**
 * Predefined action types with default configurations
 */
type ConfirmationActionType =
  | 'delete'
  | 'archive'
  | 'remove_user'
  | 'close_case'
  | 'send_document'
  | 'change_status'
  | 'custom'

/**
 * Default configurations for each action type
 */
const actionDefaults: Record<
  ConfirmationActionType,
  {
    icon: React.ComponentType<{ className?: string }>
    title: string
    description: string
    confirmLabel: string
    severity: ConfirmationSeverity
  }
> = {
  delete: {
    icon: Trash2,
    title: 'Confirmar eliminación',
    description: 'Esta acción eliminará permanentemente el elemento seleccionado y no se puede deshacer.',
    confirmLabel: 'Eliminar',
    severity: 'danger',
  },
  archive: {
    icon: Archive,
    title: 'Confirmar archivo',
    description: 'El elemento será archivado y ya no aparecerá en las listas activas.',
    confirmLabel: 'Archivar',
    severity: 'warning',
  },
  remove_user: {
    icon: UserMinus,
    title: 'Remover usuario',
    description: 'El usuario será removido del caso y perderá acceso a toda la información relacionada.',
    confirmLabel: 'Remover',
    severity: 'danger',
  },
  close_case: {
    icon: FileX,
    title: 'Cerrar caso',
    description: 'El caso será marcado como cerrado. Esta acción puede revertirse posteriormente.',
    confirmLabel: 'Cerrar caso',
    severity: 'warning',
  },
  send_document: {
    icon: Send,
    title: 'Compartir con cliente',
    description: 'El documento será visible para el cliente en su portal. Asegúrese de que la información es correcta.',
    confirmLabel: 'Compartir',
    severity: 'info',
  },
  change_status: {
    icon: AlertCircle,
    title: 'Cambiar estado',
    description: 'El estado del elemento será actualizado.',
    confirmLabel: 'Cambiar',
    severity: 'info',
  },
  custom: {
    icon: AlertTriangle,
    title: 'Confirmar acción',
    description: '¿Está seguro de que desea continuar con esta acción?',
    confirmLabel: 'Confirmar',
    severity: 'warning',
  },
}

/**
 * Severity configurations for styling
 */
const severityConfig: Record<
  ConfirmationSeverity,
  {
    iconContainerClass: string
    iconClass: string
    actionClass: string
  }
> = {
  info: {
    iconContainerClass: 'bg-primary/10',
    iconClass: 'text-primary',
    actionClass: '',
  },
  warning: {
    iconContainerClass: 'bg-amber-100',
    iconClass: 'text-amber-600',
    actionClass: 'bg-amber-600 hover:bg-amber-700',
  },
  danger: {
    iconContainerClass: 'bg-destructive/10',
    iconClass: 'text-destructive',
    actionClass: 'bg-destructive hover:bg-destructive/90',
  },
}

/**
 * Props for the ConfirmationDialog component
 */
interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Predefined action type */
  actionType?: ConfirmationActionType
  /** Custom icon (overrides actionType default) */
  icon?: React.ComponentType<{ className?: string }>
  /** Dialog title (overrides actionType default) */
  title?: string
  /** Dialog description (overrides actionType default) */
  description?: string
  /** Confirm button label (overrides actionType default) */
  confirmLabel?: string
  /** Severity level (overrides actionType default) */
  severity?: ConfirmationSeverity
  /** Name of the item being acted upon (shown in dialog) */
  itemName?: string
  /** Callback when user confirms the action */
  onConfirm: () => void | Promise<void>
  /** Whether the confirm action is currently loading */
  isLoading?: boolean
  /** Require typing a specific word to confirm (for dangerous actions) */
  requireTypedConfirmation?: string
  /** Require checking a legal acknowledgment checkbox */
  requireLegalAcknowledgment?: boolean
  /** Custom legal acknowledgment text */
  legalAcknowledgmentText?: string
  /** Additional warning message */
  additionalWarning?: string
  /** Items that will be affected (shown as list) */
  affectedItems?: string[]
}

/**
 * ConfirmationDialog component for critical action confirmation
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  actionType = 'custom',
  icon,
  title,
  description,
  confirmLabel,
  severity,
  itemName,
  onConfirm,
  isLoading = false,
  requireTypedConfirmation,
  requireLegalAcknowledgment = false,
  legalAcknowledgmentText = 'Entiendo las consecuencias de esta acción y confirmo que deseo proceder.',
  additionalWarning,
  affectedItems,
}: ConfirmationDialogProps) {
  const [typedValue, setTypedValue] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  const defaults = actionDefaults[actionType]
  const Icon = icon || defaults.icon
  const displayTitle = title || defaults.title
  const displayDescription = description || defaults.description
  const displayConfirmLabel = confirmLabel || defaults.confirmLabel
  const displaySeverity = severity || defaults.severity
  const severityStyles = severityConfig[displaySeverity]

  // Check if confirmation requirements are met
  const typedConfirmationMet = !requireTypedConfirmation || typedValue === requireTypedConfirmation
  const legalAcknowledgmentMet = !requireLegalAcknowledgment || acknowledged
  const canConfirm = typedConfirmationMet && legalAcknowledgmentMet && !isLoading && !isConfirming

  /** Handle confirm action */
  const handleConfirm = async () => {
    if (!canConfirm) return
    
    setIsConfirming(true)
    try {
      await onConfirm()
      onOpenChange(false)
      // Reset state
      setTypedValue('')
      setAcknowledged(false)
    } finally {
      setIsConfirming(false)
    }
  }

  /** Reset state when dialog closes */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTypedValue('')
      setAcknowledged(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={cn(
                'flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full',
                severityStyles.iconContainerClass
              )}
            >
              <Icon className={cn('h-6 w-6', severityStyles.iconClass)} />
            </div>

            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="text-lg">
                {displayTitle}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                {displayDescription}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Item name */}
          {itemName && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Elemento:</p>
              <p className="text-sm font-medium text-foreground truncate">{itemName}</p>
            </div>
          )}

          {/* Affected items list */}
          {affectedItems && affectedItems.length > 0 && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-2">
                Elementos afectados ({affectedItems.length}):
              </p>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {affectedItems.map((item, index) => (
                  <li key={index} className="text-sm text-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional warning */}
          {additionalWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{additionalWarning}</p>
            </div>
          )}

          {/* Typed confirmation */}
          {requireTypedConfirmation && (
            <div className="space-y-2">
              <Label htmlFor="confirm-input" className="text-sm">
                Escriba <span className="font-mono font-semibold">{requireTypedConfirmation}</span> para confirmar:
              </Label>
              <Input
                id="confirm-input"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                placeholder={requireTypedConfirmation}
                className="font-mono"
                autoComplete="off"
              />
              {typedValue && typedValue !== requireTypedConfirmation && (
                <p className="text-xs text-destructive">
                  El texto no coincide
                </p>
              )}
            </div>
          )}

          {/* Legal acknowledgment */}
          {requireLegalAcknowledgment && (
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <Checkbox
                id="legal-ack"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="legal-ack" className="text-sm text-muted-foreground cursor-pointer">
                {legalAcknowledgmentText}
              </Label>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading || isConfirming}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              displaySeverity !== 'info' && severityStyles.actionClass
            )}
          >
            {(isLoading || isConfirming) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {displayConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Quick confirmation dialog for simple actions
 */
export function QuickConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  isLoading = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}) {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading || isConfirming}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || isConfirming}
          >
            {(isLoading || isConfirming) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Success confirmation dialog (after action completes)
 */
export function SuccessDialog({
  open,
  onOpenChange,
  title = 'Acción completada',
  description = 'La operación se realizó correctamente.',
  actionLabel = 'Aceptar',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  actionLabel?: string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
