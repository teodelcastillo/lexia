/**
 * Procesador de Cédulas - API
 * POST /api/herramientas/cedulas/procesar
 *
 * Recibe un PDF (nativo o escaneado), extrae el texto, analiza con IA
 * según el CPCC Córdoba y devuelve el análisis con plazos calculados.
 */

import { NextResponse } from 'next/server'

export const maxDuration = 90
import { createClient } from '@/lib/supabase/server'
import { PDFParse } from 'pdf-parse'
import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import {
  CedulaAnalysisSchema,
  CPCC_SYSTEM_PROMPT,
} from '@/lib/herramientas/cordoba-cpcc'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
const MIN_TEXT_LENGTH = 200 // Si pdf-parse devuelve menos, tratar como escaneado
const ALLOWED_PDF = 'application/pdf'

/** Modelo para análisis de texto (nativo) */
const TEXT_MODEL = 'anthropic/claude-sonnet-4-20250514'
/** Modelo para PDF con visión (escaneados) - Claude soporta PDF nativo */
const VISION_MODEL = 'anthropic/claude-sonnet-4-20250514'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Se espera multipart/form-data con un archivo' },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo. Usá el campo "file"' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande. Máximo 15 MB' },
        { status: 400 }
      )
    }

    if (file.type !== ALLOWED_PDF) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos PDF' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // 1. Intentar extraer texto con pdf-parse
    let extractedText = ''
    try {
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      await parser.destroy()
      extractedText = (result?.text ?? '').trim()
    } catch (err) {
      console.error('[Cedulas] PDF parse error:', err)
    }

    const isScanned = extractedText.length < MIN_TEXT_LENGTH

    if (isScanned) {
      // 2a. PDF escaneado: enviar el PDF directamente a Claude (soporta PDF nativo)
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const base64 = Buffer.from(uint8Array).toString('base64')
      const fileDataUrl = `data:application/pdf;base64,${base64}`

      const { resolveModel } = await import('@/lib/ai/resolver')
      const { object } = await generateObject({
        model: resolveModel(VISION_MODEL),
        schema: zodSchema(CedulaAnalysisSchema),
        system: CPCC_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analizá el siguiente PDF de cédula o notificación judicial de Córdoba. Es un documento escaneado, por lo que debés interpretar su contenido visualmente. Extraé la información relevante y calculá el plazo de vencimiento según el CPCC Córdoba (Ley 8465).`,
              },
              {
                type: 'file',
                data: fileDataUrl,
                mediaType: 'application/pdf',
              },
            ],
          },
        ],
        temperature: 0.1,
      })

      return NextResponse.json({ analysis: object })
    }

    // 2b. PDF nativo: analizar el texto extraído
    const { resolveModel } = await import('@/lib/ai/resolver')

    const { object } = await generateObject({
      model: resolveModel(TEXT_MODEL),
      schema: zodSchema(CedulaAnalysisSchema),
      system: CPCC_SYSTEM_PROMPT,
      prompt: `Analizá el siguiente texto extraído de una cédula o notificación judicial de Córdoba y calculá el plazo de vencimiento según el CPCC Córdoba (Ley 8465).

TEXTO DEL DOCUMENTO:
---
${extractedText.slice(0, 100_000)}
---`,
      temperature: 0.1,
    })

    return NextResponse.json({ analysis: object })
  } catch (err) {
    console.error('[Cedulas] Procesar error:', err)
    const message =
      err instanceof Error ? err.message : 'Error al procesar el documento'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
