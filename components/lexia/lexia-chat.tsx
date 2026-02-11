'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send,
  Sparkles,
  Briefcase,
  MessageSquare,
  FileSearch,
  PenTool,
  ListChecks,
  Loader2,
  Trash2,
} from 'lucide-react'

import { toast } from 'sonner'
import { LexiaChatMessage } from './lexia-chat-message'

const lexiaTools = {
  redaccion: [
    { id: 'draft', name: 'Redactar Documento', prompt: 'Necesito redactar un documento legal. El tipo de documento es: ', icon: PenTool },
    { id: 'improve', name: 'Mejorar Texto', prompt: 'Por favor mejora el siguiente texto legal: ', icon: PenTool },
  ],
  investigacion: [
    { id: 'summarize', name: 'Resumir Documento', prompt: 'Resume el siguiente documento identificando partes, obligaciones y plazos: ', icon: FileSearch },
    { id: 'research', name: 'Investigar Tema', prompt: 'Investiga sobre el siguiente tema legal en Argentina: ', icon: FileSearch },
  ],
  procedimiento: [
    { id: 'checklist', name: 'Checklist Procesal', prompt: 'Dame el checklist completo para un proceso de: ', icon: ListChecks },
    { id: 'deadline', name: 'Calcular Plazos', prompt: 'Calcula el plazo para: ', icon: ListChecks },
  ],
  consulta: [
    { id: 'question', name: 'Consulta Legal', prompt: '', icon: MessageSquare },
    { id: 'strategy', name: 'Estrategia Legal', prompt: 'Necesito una estrategia legal para: ', icon: MessageSquare },
  ],
}

type LexiaTool = (typeof lexiaTools)[keyof typeof lexiaTools][number]

interface CaseContext {
  id: string
  caseNumber: string
  title: string
  type?: string
}

interface LexiaChatProps {
  conversationId: string
  initialMessages?: unknown[]
  caseContext: CaseContext | null
}

export function LexiaChat({
  conversationId,
  initialMessages = [],
  caseContext,
}: LexiaChatProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: conversationId,
    messages: (initialMessages || []) as Parameters<typeof useChat>[0]['messages'],
    transport: new DefaultChatTransport({
      api: '/api/lexia',
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: {
          id,
          conversationId: id,
          messages: msgs,
          caseContext: caseContext
            ? {
                caseId: caseContext.id,
                caseNumber: caseContext.caseNumber,
                title: caseContext.title,
                type: caseContext.type || 'general',
              }
            : null,
        },
      }),
    }),
    onFinish: async ({ messages: finishedMessages }) => {
      if (finishedMessages.length === 0 || !conversationId) return
      try {
        const res = await fetch(`/api/lexia/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: finishedMessages }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error('[Lexia] Persist messages failed:', err)
        } else {
          // Notify sidebar to refresh (title may have been generated)
          window.dispatchEvent(new CustomEvent('lexia-conversations-refresh'))
        }
      } catch (err) {
        console.error('[Lexia] Persist messages error:', err)
      }
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const isReady = status === 'ready'

  useEffect(() => {
    if (error) {
      toast.error('Error al conectar con Lexia. Por favor intenta de nuevo.')
    }
  }, [error])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !isReady) return
    const messageText = input.trim()
    setInput('')
    try {
      await sendMessage({ text: messageText })
    } catch (err) {
      toast.error('Error al enviar mensaje')
    }
  }

  const handleToolSelect = (tool: LexiaTool) => {
    setInput(tool.prompt)
  }

  const handleClearChat = () => {
    setMessages([])
    setInput('')
    toast.success('Conversación limpiada')
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  const quickTools = [
    { icon: PenTool, title: 'Redactar', desc: 'Crear documentos legales', tool: lexiaTools.redaccion[0] },
    { icon: FileSearch, title: 'Resumir', desc: 'Analizar documentos', tool: lexiaTools.investigacion[0] },
    { icon: ListChecks, title: 'Checklist', desc: 'Pasos procesales', tool: lexiaTools.procedimiento[0] },
    { icon: MessageSquare, title: 'Consultar', desc: 'Preguntas legales', tool: lexiaTools.consulta[0] },
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border px-4 py-2 flex-shrink-0 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {caseContext ? (
            <>
              <Briefcase className="inline h-3 w-3 mr-1" />
              {caseContext.caseNumber}
            </>
          ) : (
            'Chat general'
          )}
        </span>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearChat}>
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-0 rounded-none">
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center py-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Hola, soy Lexia</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                Tu asistente legal de IA. Puedo ayudarte a redactar documentos, investigar
                jurisprudencia, calcular plazos y responder consultas legales.
              </p>
              {caseContext ? (
                <div className="w-full max-w-2xl">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      Contexto activo: {caseContext.caseNumber}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    Tengo acceso a la información de este caso.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 w-full max-w-2xl">
                {quickTools.map((item) => (
                  <Button
                    key={item.title}
                    variant="outline"
                    className="h-auto p-4 justify-start text-left bg-transparent"
                    onClick={() => handleToolSelect(item.tool)}
                  >
                    <item.icon className="h-5 w-5 mr-3 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <LexiaChatMessage
                  key={message.id}
                  message={message}
                  onCopy={handleCopy}
                  isStreaming={
                    isLoading &&
                    index === messages.length - 1 &&
                    message.role === 'assistant'
                  }
                />
              ))}
              {isLoading &&
                (!messages[messages.length - 1] ||
                  messages[messages.length - 1].role === 'user') && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex gap-1 py-0.5" aria-hidden="true">
                        <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.33s]" />
                        <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.16s]" />
                        <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 flex-shrink-0">
          {caseContext && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              <span>Contexto: {caseContext.caseNumber} - {caseContext.title}</span>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder={
                caseContext
                  ? `Pregunta sobre ${caseContext.caseNumber}...`
                  : 'Escribe tu consulta legal...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="min-h-[60px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
