/**
 * Lexia Document Drafting - Export to Word
 * POST /api/lexia/draft/export
 *
 * Converts draft content to .docx format.
 */

import { NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const content = (body.content ?? '') as string
    const fileName = (body.fileName ?? 'borrador.docx') as string

    if (!content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Split content into paragraphs (double newline = new paragraph)
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim())

    const docChildren = paragraphs.map((text) => {
      const trimmed = text.trim()
      if (!trimmed) return null

      // Detect simple headers (all caps, short, or ending with :)
      const isHeader =
        trimmed.length < 80 &&
        (trimmed === trimmed.toUpperCase() || trimmed.endsWith(':'))

      return new Paragraph({
        children: [
          new TextRun({
            text: trimmed.replace(/\n/g, ' '),
            bold: isHeader,
          }),
        ],
        heading: isHeader ? HeadingLevel.HEADING_2 : undefined,
        spacing: { before: 120, after: 120 },
      })
    }).filter(Boolean) as Paragraph[]

    if (docChildren.length === 0) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: content.trim() })],
        })
      )
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch = 1440 twips
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: docChildren,
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const finalName = safeName.endsWith('.docx') ? safeName : `${safeName}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${finalName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[Lexia Draft Export] Error:', error)
    return NextResponse.json(
      { error: 'Error generating document' },
      { status: 500 }
    )
  }
}
