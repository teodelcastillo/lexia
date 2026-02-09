/**
 * Standardized error handling utilities
 * 
 * Provides consistent error handling across the application with
 * user-friendly error messages and error codes.
 */

/**
 * Custom application error class with user-friendly messages
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'AppError'
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

/**
 * Error codes used throughout the application
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INVALID_INPUT: 'INVALID_INPUT',
} as const

/**
 * Gets a user-friendly error message from an error
 * 
 * @param error - Error object (unknown type for safety)
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase()
    
    // Database errors
    if (message.includes('duplicate') || message.includes('unique')) {
      return 'Este registro ya existe en el sistema'
    }
    
    if (message.includes('foreign key') || message.includes('constraint')) {
      return 'No se puede realizar esta operación debido a restricciones de datos'
    }
    
    if (message.includes('not null') || message.includes('required')) {
      return 'Faltan campos requeridos'
    }
    
    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Error de conexión. Por favor, verifique su conexión a internet'
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'No tiene autorización para realizar esta acción'
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return 'No tiene permisos para realizar esta acción'
    }
    
    // Return original message if no pattern matches
    return error.message
  }
  
  // Fallback for unknown error types
  return 'Ocurrió un error inesperado. Por favor, intente nuevamente'
}

/**
 * Gets error code from an error
 * 
 * @param error - Error object
 * @returns Error code string
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    if (message.includes('duplicate') || message.includes('unique')) {
      return ERROR_CODES.DUPLICATE_ENTRY
    }
    
    if (message.includes('not found')) {
      return ERROR_CODES.NOT_FOUND
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ERROR_CODES.UNAUTHORIZED
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return ERROR_CODES.FORBIDDEN
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return ERROR_CODES.NETWORK_ERROR
    }
    
    if (message.includes('database') || message.includes('sql')) {
      return ERROR_CODES.DATABASE_ERROR
    }
  }
  
  return ERROR_CODES.SERVER_ERROR
}

/**
 * Creates a validation error
 * 
 * @param message - Validation error message
 * @param field - Field name that failed validation (optional)
 * @returns AppError instance
 */
export function createValidationError(message: string, field?: string): AppError {
  const userMessage = field 
    ? `Error de validación en ${field}: ${message}`
    : `Error de validación: ${message}`
  
  return new AppError(
    message,
    ERROR_CODES.VALIDATION_ERROR,
    userMessage,
    400
  )
}

/**
 * Creates a not found error
 * 
 * @param resource - Resource name (e.g., "Caso", "Cliente")
 * @returns AppError instance
 */
export function createNotFoundError(resource: string): AppError {
  return new AppError(
    `${resource} no encontrado`,
    ERROR_CODES.NOT_FOUND,
    `No se encontró el ${resource.toLowerCase()} solicitado`,
    404
  )
}

/**
 * Creates an unauthorized error
 * 
 * @param message - Optional custom message
 * @returns AppError instance
 */
export function createUnauthorizedError(message?: string): AppError {
  return new AppError(
    message || 'No autorizado',
    ERROR_CODES.UNAUTHORIZED,
    message || 'No tiene autorización para realizar esta acción',
    401
  )
}

/**
 * Creates a forbidden error
 * 
 * @param message - Optional custom message
 * @returns AppError instance
 */
export function createForbiddenError(message?: string): AppError {
  return new AppError(
    message || 'Acceso denegado',
    ERROR_CODES.FORBIDDEN,
    message || 'No tiene permisos para realizar esta acción',
    403
  )
}

/**
 * Creates a server error
 * 
 * @param message - Internal error message
 * @returns AppError instance
 */
export function createServerError(message: string): AppError {
  return new AppError(
    message,
    ERROR_CODES.SERVER_ERROR,
    'Ocurrió un error en el servidor. Por favor, intente nuevamente más tarde',
    500
  )
}

/**
 * Checks if an error is a specific error code
 * 
 * @param error - Error object
 * @param code - Error code to check
 * @returns true if error matches code
 */
export function isErrorCode(error: unknown, code: string): boolean {
  return getErrorCode(error) === code
}

/**
 * Logs error with context for debugging
 * 
 * @param error - Error object
 * @param context - Additional context (component name, action, etc.)
 */
export function logError(error: unknown, context?: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorCode = getErrorCode(error)
  const contextInfo = context ? ` [${context}]` : ''
  
  console.error(`[${errorCode}]${contextInfo}:`, errorMessage)
  
  // In production, you might want to send this to an error tracking service
  // Example: Sentry.captureException(error, { extra: { context } })
}
