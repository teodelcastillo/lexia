'use client'

/**
 * Button to mark a deadline as complete.
 * Calls API and refreshes the page on success.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeadlineCompleteButtonProps {
  deadlineId: string
  variant?: 'ghost' | 'default' | 'outline'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  className?: string
  showLabel?: boolean
}

export function DeadlineCompleteButton({
  deadlineId,
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = false,
}: DeadlineCompleteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleComplete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/deadlines/${deadlineId}/complete`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al completar')
      }
      toast.success('Vencimiento marcado como completado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleComplete}
      disabled={loading}
      title="Marcar completado"
      aria-label="Marcar completado"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      {showLabel && <span className="ml-2">Marcar completado</span>}
    </Button>
  )
}
