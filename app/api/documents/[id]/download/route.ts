/**
 * GET /api/documents/[id]/download
 * Redirige a la URL firmada de Supabase Storage o a Google Drive según el documento.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import {
  DOCUMENTS_STORAGE,
  isStoragePath,
  toStoragePath,
} from '@/lib/storage/documents'

const SIGNED_URL_EXPIRES_SEC = 60

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: documentId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, case_id, file_path, google_drive_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
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
        { error: 'Sin permiso para este documento' },
        { status: 403 }
      )
    }

    // Enlace a Google Drive
    if (doc.google_drive_id) {
      const driveUrl = `https://drive.google.com/file/d/${doc.google_drive_id}/view`
      return NextResponse.redirect(driveUrl)
    }

    // Archivo en Supabase Storage
    if (doc.file_path && isStoragePath(doc.file_path)) {
      const storagePath = toStoragePath(doc.file_path)
      const {
        data: signed,
        error: signError,
      } = await supabase.storage
        .from(DOCUMENTS_STORAGE.bucket)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC)

      if (signError || !signed?.signedUrl) {
        console.error('[documents/download] Signed URL error:', signError)
        return NextResponse.json(
          { error: 'No se pudo generar el enlace de descarga' },
          { status: 502 }
        )
      }
      return NextResponse.redirect(signed.signedUrl)
    }

    return NextResponse.json(
      { error: 'Este documento no tiene archivo disponible para descargar' },
      { status: 404 }
    )
  } catch (err) {
    console.error('[documents/download]', err)
    return NextResponse.json(
      { error: 'Error al obtener el documento' },
      { status: 500 }
    )
  }
}
