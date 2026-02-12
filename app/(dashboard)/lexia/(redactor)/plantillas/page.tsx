'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TemplateList } from '@/components/lexia/templates/template-list'
import { createClient } from '@/lib/supabase/client'

export default function PlantillasPage() {
  const router = useRouter()
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      setHasOrg(!!profile?.organization_id)
    }
    check()
  }, [router])

  if (hasOrg === null) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    )
  }

  if (!hasOrg) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/lexia/redactor">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-muted-foreground">
              Debes pertenecer a una organización para gestionar plantillas personalizadas.
            </p>
            <Button asChild className="mt-4">
              <Link href="/lexia/redactor">Ir al Redactor</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold">Plantillas de documentos</h1>
            <p className="text-xs text-muted-foreground">
              Personalizá instrucciones, contenido base y campos del formulario por tipo de documento
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lexia/redactor">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver al Redactor
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <TemplateList />
        </div>
      </div>
    </div>
  )
}
