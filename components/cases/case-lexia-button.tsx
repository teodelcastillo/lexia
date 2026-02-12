'use client'

import { Sparkles, PenTool } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  showLabel = true,
}: CaseLexiaButtonProps) {
  const chatUrl = `/lexia/chat?caso=${caseId}`
  const redactorUrl = `/lexia/redactor?caso=${caseId}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size === 'icon' || !showLabel ? 'icon' : size}>
          {size === 'icon' || !showLabel ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Lexia
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={chatUrl} className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Chat
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={redactorUrl} className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            Redactor Jurídico
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
