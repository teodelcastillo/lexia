'use client'

import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Tool {
  id: string
  name: string
  description: string
  icon: LucideIcon
  prompt: string
}

interface LexiaToolCardProps {
  tool: Tool
  onClick: () => void
}

export function LexiaToolCard({ tool, onClick }: LexiaToolCardProps) {
  return (
    <Button
      variant="ghost"
      className="w-full h-auto p-2 justify-start text-left hover:bg-primary/5"
      onClick={onClick}
    >
      <tool.icon className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{tool.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
      </div>
    </Button>
  )
}
