/**
 * Shared Components Index
 * 
 * Centralized exports for reusable UX components.
 */

// Empty states
export {
  EmptyState,
  SearchEmptyState,
  ErrorEmptyState,
} from './empty-state'

// Confirmation dialogs
export {
  ConfirmationDialog,
  QuickConfirmDialog,
  SuccessDialog,
} from './confirmation-dialog'

// Permission-aware components
export {
  PermissionGate,
  PermissionButton,
  PermissionBadge,
  ClientVisibilityIndicator,
  ReadOnlyIndicator,
} from './permission-action'

// Form helpers
export {
  FieldHint,
  FieldError,
  FieldWarning,
  FieldSuccess,
  RequiredIndicator,
  LabelInfo,
  EnhancedLabel,
  ValidatedInput,
  ValidatedTextarea,
  PasswordInput,
  CopyableField,
  FormSection,
  UnsavedChangesWarning,
  FormError,
  FormSuccess,
  LegalDisclaimer,
} from './form-helpers'
