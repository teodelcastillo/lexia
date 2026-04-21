/**
 * Shared helper to extract plain text from a case document stored in
 * Supabase Storage. Supports PDF (via `pdf-parse`) and Word (.docx/.doc
 * via `mammoth`).
 *
 * Returns `null` when the document cannot be extracted (wrong mime type,
 * not in storage, download failure). Consumers should degrade gracefully
 * when a document is unreachable.
 */

import { createClient } from '@/lib/supabase/server'
import { toStoragePath } from '@/lib/storage/documents'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

const MIME_PDF = 'application/pdf'
const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MIME_DOC = 'application/msword'

export const EXTRACTABLE_MIMES = [MIME_PDF, MIME_DOCX, MIME_DOC] as const

export interface DocumentRecord {
  id: string
  name: string
  mimeType: string | null
  filePath: string | null
}

export interface ExtractedDocument extends DocumentRecord {
  text: string
  truncated: boolean
  error?: string
}

/**
 * Extract text for a single document. The caller is responsible for
 * authorization (we only check that the mime type and file path are usable).
 */
export async function extractDocumentText(
  supabase: SupabaseServer,
  doc: DocumentRecord,
  opts: { maxChars?: number } = {}
): Promise<ExtractedDocument> {
  const maxChars = opts.maxChars ?? 15000
  const base: ExtractedDocument = {
    ...doc,
    text: '',
    truncated: false,
  }

  const mime = doc.mimeType ?? ''
  const isPdf = mime === MIME_PDF
  const isDocx = mime === MIME_DOCX || mime === MIME_DOC

  if (!isPdf && !isDocx) {
    return { ...base, error: 'Mime type no soportado' }
  }
  if (!doc.filePath) {
    return { ...base, error: 'Sin archivo en Storage' }
  }

  const storagePath = toStoragePath(doc.filePath)
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath)

  if (downloadError || !fileData) {
    return { ...base, error: 'No se pudo descargar el archivo' }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())

  try {
    let rawText = ''
    if (isPdf) {
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        rawText = result.text ?? ''
      } finally {
        await parser.destroy().catch(() => {})
      }
    } else {
      const result = await mammoth.extractRawText({ buffer })
      rawText = result.value ?? ''
    }

    const cleaned = rawText.replace(/\u0000/g, '').trim()
    if (cleaned.length > maxChars) {
      return { ...base, text: cleaned.slice(0, maxChars), truncated: true }
    }
    return { ...base, text: cleaned, truncated: false }
  } catch (err) {
    console.error('[lexia/workspace] extractDocumentText failed:', err)
    return { ...base, error: 'Error extrayendo texto del documento' }
  }
}

/**
 * Extract text for many documents given their ids. Verifies that all ids
 * belong to the provided `caseId` (authorization still belongs to the caller).
 */
export async function extractDocumentsForCase(
  supabase: SupabaseServer,
  caseId: string,
  documentIds: string[],
  opts: { maxCharsPerDoc?: number; maxDocs?: number } = {}
): Promise<ExtractedDocument[]> {
  if (documentIds.length === 0) return []
  const maxDocs = opts.maxDocs ?? 8
  const clipped = documentIds.slice(0, maxDocs)

  const { data: rows } = await supabase
    .from('documents')
    .select('id, name, mime_type, file_path')
    .eq('case_id', caseId)
    .in('id', clipped)
    .limit(maxDocs)

  if (!Array.isArray(rows) || rows.length === 0) return []

  const results = await Promise.all(
    rows.map((row) => {
      const typed = row as {
        id: string
        name: string
        mime_type: string | null
        file_path: string | null
      }
      return extractDocumentText(
        supabase,
        {
          id: typed.id,
          name: typed.name,
          mimeType: typed.mime_type,
          filePath: typed.file_path,
        },
        { maxChars: opts.maxCharsPerDoc }
      )
    })
  )
  return results
}
