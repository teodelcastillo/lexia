-- Add company_type to companies: 'client' (cliente) or 'supplier' (proveedor)
-- Enables Compañías section with tabs Clientes / Proveedores

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'company_type'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN company_type TEXT CHECK (company_type IN ('client', 'supplier')) DEFAULT 'client';
    COMMENT ON COLUMN public.companies.company_type IS 'client = Cliente, supplier = Proveedor';
  END IF;
END $$;

-- Backfill: existing rows without company_type treat as client
UPDATE public.companies SET company_type = 'client' WHERE company_type IS NULL;
