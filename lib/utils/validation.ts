/**
 * Validation utilities for Argentina-specific formats
 * 
 * Provides validation functions for CUIT, DNI, email, and phone numbers
 * following Argentine standards and formats.
 */

/**
 * Validates CUIT (Clave Única de Identificación Tributaria)
 * Format: XX-XXXXXXXX-X (11 digits without dashes)
 * 
 * @param cuit - CUIT string (with or without dashes)
 * @returns true if valid format, false otherwise
 */
export function validateCUIT(cuit: string): boolean {
  if (!cuit || typeof cuit !== 'string') return false
  
  // Remove dashes and spaces
  const cleaned = cuit.replace(/[-\s]/g, '')
  
  // Must be exactly 11 digits
  if (cleaned.length !== 11) return false
  if (!/^\d+$/.test(cleaned)) return false
  
  // Validate check digit (dígito verificador)
  // Algorithm: multiply each digit by weights [5,4,3,2,7,6,5,4,3,2]
  // Sum all products, divide by 11, remainder should match last digit
  const digits = cleaned.split('').map(Number)
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  
  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * weights[i]
  }
  
  const remainder = sum % 11
  let checkDigit = 11 - remainder
  
  // Special cases
  if (checkDigit === 11) checkDigit = 0
  if (checkDigit === 10) checkDigit = 9
  
  return checkDigit === digits[10]
}

/**
 * Validates DNI (Documento Nacional de Identidad)
 * Format: 7-8 digits (can have dots or spaces)
 * 
 * @param dni - DNI string
 * @returns true if valid format, false otherwise
 */
export function validateDNI(dni: string): boolean {
  if (!dni || typeof dni !== 'string') return false
  
  // Remove dots, spaces, and dashes
  const cleaned = dni.replace(/[.\s-]/g, '')
  
  // Must be 7 or 8 digits
  return /^\d{7,8}$/.test(cleaned)
}

/**
 * Validates email address format
 * 
 * @param email - Email string
 * @returns true if valid format, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  // Basic email regex (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) return false
  
  // Additional checks
  const [localPart, domain] = email.split('@')
  
  // Local part should not be empty and not too long
  if (!localPart || localPart.length > 64) return false
  
  // Domain should have at least one dot and valid TLD
  if (!domain || !domain.includes('.')) return false
  
  const domainParts = domain.split('.')
  const tld = domainParts[domainParts.length - 1]
  
  // TLD should be at least 2 characters
  if (!tld || tld.length < 2) return false
  
  return true
}

/**
 * Validates Argentine phone number
 * Accepts various formats:
 * - +54 9 11 1234-5678
 * - 54 9 11 1234-5678
 * - 011 1234-5678
 * - 11 1234-5678
 * - 1234-5678
 * 
 * @param phone - Phone string
 * @returns true if valid format, false otherwise
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false
  
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Argentine phone patterns:
  // - International: +54 or 54 followed by 9 (mobile) or area code, then 10 digits
  // - National: 0 + area code (2-4 digits) + number (6-8 digits)
  // - Local: area code (2-4 digits) + number (6-8 digits)
  // - Mobile: 9 + area code (2-3 digits) + number (7 digits)
  
  // International format: +54 or 54 + 9 + area + number (total 13-14 digits)
  if (cleaned.startsWith('54')) {
    const withoutCountry = cleaned.substring(2)
    // Should be 9 (mobile indicator) + area code + number = 10-11 digits
    return /^9?\d{10,11}$/.test(withoutCountry)
  }
  
  // National format: 0 + area code + number
  if (cleaned.startsWith('0')) {
    const withoutZero = cleaned.substring(1)
    // Area code (2-4 digits) + number (6-8 digits) = 8-12 digits total
    return /^\d{8,12}$/.test(withoutZero)
  }
  
  // Local format: area code + number (8-12 digits)
  // Mobile format: 9 + area code + number (10-11 digits)
  return /^\d{8,12}$/.test(cleaned)
}

/**
 * Formats CUIT for display (adds dashes)
 * 
 * @param cuit - CUIT string without dashes
 * @returns Formatted CUIT (XX-XXXXXXXX-X)
 */
export function formatCUIT(cuit: string): string {
  const cleaned = cuit.replace(/[-\s]/g, '')
  if (cleaned.length !== 11) return cuit
  return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 10)}-${cleaned.substring(10)}`
}

/**
 * Formats DNI for display (adds dots)
 * 
 * @param dni - DNI string
 * @returns Formatted DNI (XX.XXX.XXX)
 */
export function formatDNI(dni: string): string {
  const cleaned = dni.replace(/[.\s-]/g, '')
  if (cleaned.length === 7) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}.${cleaned.substring(5)}`
  }
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}.${cleaned.substring(5)}`
  }
  return dni
}

/**
 * Formats phone number for display
 * 
 * @param phone - Phone string
 * @returns Formatted phone number
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // If it's a mobile number (starts with 9 or has country code)
  if (cleaned.startsWith('549') || cleaned.startsWith('54') && cleaned.length > 12) {
    const withoutCountry = cleaned.startsWith('549') ? cleaned.substring(3) : cleaned.substring(2)
    if (withoutCountry.length === 10) {
      return `+54 9 ${withoutCountry.substring(0, 2)} ${withoutCountry.substring(2, 6)}-${withoutCountry.substring(6)}`
    }
  }
  
  // National format (starts with 0)
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    const areaCode = cleaned.substring(1, 4)
    const number = cleaned.substring(4)
    return `(0${areaCode}) ${number.substring(0, 4)}-${number.substring(4)}`
  }
  
  // Local format
  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`
  }
  
  return phone
}

/**
 * Cleans and normalizes input for validation
 * Removes common formatting characters
 * 
 * @param input - Input string
 * @returns Cleaned string
 */
export function cleanInput(input: string): string {
  return input.trim().replace(/[.\s-]/g, '')
}
