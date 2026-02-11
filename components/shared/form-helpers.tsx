/**
 * Form Helper Components
 * 
 * Provides error prevention, validation feedback, and
 * user-friendly form interactions for legal-sensitive data.
 */
'use client'

import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Validation state types
 */
type ValidationState = 'idle' | 'valid' | 'invalid' | 'warning'

/**
 * Field hint component for providing context
 */
export function FieldHint({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-xs text-muted-foreground mt-1', className)}>
      {children}
    </p>
  )
}

/**
 * Field error message component
 */
export function FieldError({
  message,
  className,
}: {
  message?: string
  className?: string
}) {
  if (!message) return null

  return (
    <p className={cn('text-xs text-destructive mt-1 flex items-center gap-1', className)}>
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  )
}

/**
 * Field warning message component
 */
export function FieldWarning({
  message,
  className,
}: {
  message?: string
  className?: string
}) {
  if (!message) return null

  return (
    <p className={cn('text-xs text-amber-600 mt-1 flex items-center gap-1', className)}>
      <AlertTriangle className="h-3 w-3" />
      {message}
    </p>
  )
}

/**
 * Field success message component
 */
export function FieldSuccess({
  message,
  className,
}: {
  message?: string
  className?: string
}) {
  if (!message) return null

  return (
    <p className={cn('text-xs text-green-600 mt-1 flex items-center gap-1', className)}>
      <CheckCircle2 className="h-3 w-3" />
      {message}
    </p>
  )
}

/**
 * Required field indicator
 */
export function RequiredIndicator() {
  return <span className="text-destructive ml-1">*</span>
}

/**
 * Info tooltip for field labels
 */
export function LabelInfo({ info }: { info: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{info}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Enhanced label with optional required indicator and info tooltip
 */
export function EnhancedLabel({
  children,
  htmlFor,
  required = false,
  info,
  className,
}: {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
  info?: string
  className?: string
}) {
  return (
    <Label htmlFor={htmlFor} className={cn('flex items-center', className)}>
      {children}
      {required && <RequiredIndicator />}
      {info && <LabelInfo info={info} />}
    </Label>
  )
}

/**
 * Props for ValidatedInput component
 */
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Validation state */
  validationState?: ValidationState
  /** Error message to display */
  errorMessage?: string
  /** Warning message to display */
  warningMessage?: string
  /** Success message to display */
  successMessage?: string
  /** Hint text */
  hint?: string
  /** Show character count */
  showCharCount?: boolean
  /** Maximum characters */
  maxChars?: number
}

/**
 * Input with validation feedback
 */
export function ValidatedInput({
  validationState = 'idle',
  errorMessage,
  warningMessage,
  successMessage,
  hint,
  showCharCount = false,
  maxChars,
  className,
  value,
  ...props
}: ValidatedInputProps) {
  const charCount = typeof value === 'string' ? value.length : 0
  const isOverLimit = maxChars ? charCount > maxChars : false

  const stateClasses = {
    idle: '',
    valid: 'border-green-500 focus-visible:ring-green-500',
    invalid: 'border-destructive focus-visible:ring-destructive',
    warning: 'border-amber-500 focus-visible:ring-amber-500',
  }

  return (
    <div className="space-y-1">
      <Input
        value={value}
        className={cn(stateClasses[validationState], className)}
        {...props}
      />
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {validationState === 'invalid' && errorMessage && (
            <FieldError message={errorMessage} />
          )}
          {validationState === 'warning' && warningMessage && (
            <FieldWarning message={warningMessage} />
          )}
          {validationState === 'valid' && successMessage && (
            <FieldSuccess message={successMessage} />
          )}
          {validationState === 'idle' && hint && <FieldHint>{hint}</FieldHint>}
        </div>
        {showCharCount && maxChars && (
          <span
            className={cn(
              'text-xs',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {charCount}/{maxChars}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Props for ValidatedTextarea component
 */
interface ValidatedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Validation state */
  validationState?: ValidationState
  /** Error message to display */
  errorMessage?: string
  /** Warning message to display */
  warningMessage?: string
  /** Success message to display */
  successMessage?: string
  /** Hint text */
  hint?: string
  /** Show character count */
  showCharCount?: boolean
  /** Maximum characters */
  maxChars?: number
}

/**
 * Textarea with validation feedback
 */
export function ValidatedTextarea({
  validationState = 'idle',
  errorMessage,
  warningMessage,
  successMessage,
  hint,
  showCharCount = false,
  maxChars,
  className,
  value,
  ...props
}: ValidatedTextareaProps) {
  const charCount = typeof value === 'string' ? value.length : 0
  const isOverLimit = maxChars ? charCount > maxChars : false

  const stateClasses = {
    idle: '',
    valid: 'border-green-500 focus-visible:ring-green-500',
    invalid: 'border-destructive focus-visible:ring-destructive',
    warning: 'border-amber-500 focus-visible:ring-amber-500',
  }

  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        className={cn(stateClasses[validationState], className)}
        {...props}
      />
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {validationState === 'invalid' && errorMessage && (
            <FieldError message={errorMessage} />
          )}
          {validationState === 'warning' && warningMessage && (
            <FieldWarning message={warningMessage} />
          )}
          {validationState === 'valid' && successMessage && (
            <FieldSuccess message={successMessage} />
          )}
          {validationState === 'idle' && hint && <FieldHint>{hint}</FieldHint>}
        </div>
        {showCharCount && maxChars && (
          <span
            className={cn(
              'text-xs',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {charCount}/{maxChars}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Password input with visibility toggle
 */
export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        <span className="sr-only">
          {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </span>
      </button>
    </div>
  )
}

/**
 * Copyable text field
 */
export function CopyableField({
  value,
  label,
}: {
  value: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-1">
      {label && <Label className="text-sm text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        <Input value={value} readOnly className="font-mono text-sm" />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? 'Copiado' : 'Copiar'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

/**
 * Form section with title and optional description
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * Unsaved changes warning banner
 */
export function UnsavedChangesWarning({
  show,
  onSave,
  onDiscard,
  isSaving = false,
}: {
  show: boolean
  onSave: () => void
  onDiscard: () => void
  isSaving?: boolean
}) {
  if (!show) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg p-4 flex items-center gap-4">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <span className="text-sm font-medium">Tiene cambios sin guardar</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={isSaving}
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onSave}
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

/**
 * Form submission error banner
 */
export function FormError({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">Error al guardar</p>
        <p className="text-sm text-destructive/80 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-destructive hover:text-destructive/80"
        >
          <span className="sr-only">Cerrar</span>
          ×
        </button>
      )}
    </div>
  )
}

/**
 * Form submission success banner
 */
export function FormSuccess({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (onDismiss) {
      const timer = setTimeout(onDismiss, 5000)
      return () => clearTimeout(timer)
    }
  }, [onDismiss])

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-green-800">Guardado exitosamente</p>
        <p className="text-sm text-green-700 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-green-600 hover:text-green-800"
        >
          <span className="sr-only">Cerrar</span>
          ×
        </button>
      )}
    </div>
  )
}

/**
 * Legal disclaimer banner for sensitive forms
 */
export function LegalDisclaimer({
  title = 'Información importante',
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">{title}</p>
          <div className="text-sm text-amber-700 mt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
