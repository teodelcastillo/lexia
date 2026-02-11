'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CaseLexiaButtonProps {
  caseId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
}

export function CaseLexiaButton({ 
  caseId, 
  variant = 'outline', 
  size = 'sm',
  showLabel = true 
}: CaseLexiaButtonProps) {
  if (size === 'icon' || !showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={variant} size="icon" asChild>
              <Link href={`/lexia?caso=${caseId}`}>
                <Sparkles className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Abrir Lexia con contexto de este caso</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button variant={variant} size={size} asChild>
      <Link href={`/lexia?caso=${caseId}`}>
        <Sparkles className="mr-2 h-4 w-4" />
        Lexia
      </Link>
    </Button>
  )
}
