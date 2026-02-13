-- =============================================================================
-- Supabase Storage: bucket "documents" y políticas RLS
-- =============================================================================
-- Los archivos de documentos se guardan en Supabase Storage (bucket "documents").
-- Path en DB (documents.file_path) = path dentro del bucket, ej: {case_id}/{uuid}_{nombre}.pdf
--
-- IMPORTANTE: Crear el bucket manualmente si no existe:
--   Dashboard > Storage > New bucket
--   - Name: documents
--   - Public: false (acceso por signed URL o RLS)
--   - File size limit: 50 MB
--   - Allowed MIME types: (opcional) pdf, word, excel, images
-- =============================================================================

-- Función auxiliar: verificar si el usuario puede acceder a un objeto de storage
-- por tener acceso al documento en public.documents (caso o cliente visible).
CREATE OR REPLACE FUNCTION public.has_document_storage_access(object_path TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_path = object_path
    AND (
      -- Usuario interno con acceso al caso
      public.has_case_access(d.case_id)
      OR
      -- Cliente con documento visible
      (public.is_client_for_case(d.case_id) AND d.is_visible_to_client = true)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Política SELECT: solo si el usuario tiene acceso al documento asociado
CREATE POLICY "documents_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_document_storage_access(name)
  );

-- Política INSERT: usuarios autenticados con acceso al caso pueden subir
-- Path debe ser {case_id}/... (primer segmento = case_id UUID)
CREATE POLICY "documents_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_case_access(((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] IS NOT NULL
  );

-- Política UPDATE: mismo criterio que SELECT (para upsert / reemplazar)
CREATE POLICY "documents_storage_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_document_storage_access(name)
  );

-- Política DELETE: solo si tiene acceso al documento (líder/admin o propio)
CREATE POLICY "documents_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_document_storage_access(name)
  );
