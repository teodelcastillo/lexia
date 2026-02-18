-- =============================================================================
-- Fix: documents_storage_insert policy incorrectly required a second folder
-- level that never exists in our path structure: {caseId}/{docId}_{filename}
--
-- The old policy had: AND (storage.foldername(name))[2] IS NOT NULL
-- storage.foldername('caseId/docId_file.pdf') → '{caseId}' (1 element)
-- so [2] is always NULL → INSERT was always rejected by RLS.
-- =============================================================================

DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;

CREATE POLICY "documents_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_case_access(((storage.foldername(name))[1])::uuid)
  );
