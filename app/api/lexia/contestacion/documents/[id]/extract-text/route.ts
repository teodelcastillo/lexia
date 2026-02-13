/**
 * Lexia Contestación - Document Extract Text API
 * GET /api/lexia/contestacion/documents/[id]/extract-text
 * Extracts text from a case document (PDF/Word) stored in Supabase Storage.
 * Returns 501 if file is not in Storage (e.g. only Google Drive).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { toStoragePath } from '@/lib/storage/documents'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

const ALLOWED_PDF = 'application/pdf'
const ALLOWED_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ALLOWED_DOC = 'application/msword'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: documentId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, case_id, name, mime_type, file_path, google_drive_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const canView = await checkCasePermission(
      supabase,
      user.id,
      doc.case_id,
      'can_view'
    )
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden: no access to this case' },
        { status: 403 }
      )
    }

    const mime = doc.mime_type ?? ''
    const isPdf = mime === ALLOWED_PDF
    const isDocx = mime === ALLOWED_DOCX || mime === ALLOWED_DOC

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: 'Document type not supported for text extraction (PDF or Word only)' },
        { status: 400 }
      )
    }

    if (!doc.file_path) {
      return NextResponse.json(
        {
          error:
            'Este documento no tiene archivo disponible en Storage. Usá "Subir archivo" o "Pegar texto" para cargar la demanda.',
        },
        { status: 501 }
      )
    }

    const storagePath = toStoragePath(doc.file_path)

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json(
        {
          error:
            'No se pudo descargar el archivo. Verificá que el documento esté en Storage.',
        },
        { status: 501 }
      )
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    if (isPdf) {
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        await parser.destroy()
        return NextResponse.json({ text: result.text ?? '' })
      } catch (err) {
        await parser.destroy().catch(() => {})
        console.error('[Contestacion] Document PDF extract error:', err)
        return NextResponse.json(
          { error: 'Failed to extract text from PDF' },
          { status: 500 }
        )
      }
    }

    const result = await mammoth.extractRawText({ buffer })
    return NextResponse.json({ text: result.value ?? '' })
  } catch (err) {
    console.error('[Contestacion] Document extract-text error:', err)
    return NextResponse.json(
      { error: 'Error processing document' },
      { status: 500 }
    )
  }
}
