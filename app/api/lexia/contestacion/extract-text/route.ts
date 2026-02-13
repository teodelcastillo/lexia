/**
 * Lexia Contestación - Extract Text API
 * POST /api/lexia/contestacion/extract-text
 * Extracts text from uploaded PDF or Word (DOCX) file for use as demanda_raw.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
const ALLOWED_PDF = 'application/pdf'
const ALLOWED_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ALLOWED_DOC = 'application/msword'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with a file' },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Use form field "file"' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 15 MB' },
        { status: 400 }
      )
    }

    const mime = file.type
    const isPdf = mime === ALLOWED_PDF
    const isDocx = mime === ALLOWED_DOCX || mime === ALLOWED_DOC

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Use PDF or Word (.doc, .docx)',
        },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (isPdf) {
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        await parser.destroy()
        return NextResponse.json({ text: result.text ?? '' })
      } catch (err) {
        await parser.destroy().catch(() => {})
        console.error('[Contestacion] PDF extract error:', err)
        return NextResponse.json(
          { error: 'Failed to extract text from PDF' },
          { status: 500 }
        )
      }
    }

    // Word (mammoth)
    const result = await mammoth.extractRawText({ buffer })
    return NextResponse.json({ text: result.value ?? '' })
  } catch (err) {
    console.error('[Contestacion] Extract-text error:', err)
    return NextResponse.json(
      { error: 'Error processing file' },
      { status: 500 }
    )
  }
}
