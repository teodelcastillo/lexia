/**
 * Supabase Storage - Documentos
 *
 * Convención de paths en el bucket "documents":
 *   {case_id}/{document_id}_{nombre_archivo_sanitizado}
 * Ej: abc-123/def-456_contrato.pdf
 */

const BUCKET = 'documents'

/** Caracteres no permitidos en nombres de archivo para storage */
const SANITIZE_REGEX = /[^a-zA-Z0-9._-]/g

/**
 * Sanitiza el nombre de archivo para usarlo en el path de storage.
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(SANITIZE_REGEX, '_').slice(0, 200) || 'document'
}

/**
 * Genera el path de storage para un nuevo documento.
 * Formato: {caseId}/{documentId}_{nombreSanitizado}
 */
export function buildDocumentStoragePath(
  caseId: string,
  documentId: string,
  originalFileName: string
): string {
  const base = sanitizeFileName(originalFileName)
  return `${caseId}/${documentId}_${base}`
}

/**
 * Indica si un file_path en DB corresponde a Supabase Storage (path relativo),
 * y no a una URL externa (p. ej. Google Drive).
 */
export function isStoragePath(filePath: string | null): boolean {
  if (!filePath || filePath.startsWith('http')) return false
  return filePath.startsWith('/') || !filePath.includes('://')
}

/**
 * Normaliza file_path de DB al path usado en Storage (sin leading slash si lo tiene).
 * El bucket "documents" usa paths como "caseId/docId_file.pdf".
 */
export function toStoragePath(filePath: string): string {
  const trimmed = filePath.replace(/^\/+/, '')
  return trimmed.startsWith('documents/') ? trimmed.slice('documents/'.length) : trimmed
}

export const DOCUMENTS_STORAGE = {
  bucket: BUCKET,
  sanitizeFileName,
  buildDocumentStoragePath,
  isStoragePath,
  toStoragePath,
} as const
