'use client'

/**
 * Lexia - AI Legal Assistant
 *
 * Comprehensive AI-powered legal assistant with two modes:
 * - Contextual: Within a case, with access to case documents and data
 * - General: Standalone, user provides context
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  Send,
  Sparkles,
  Briefcase,
  History,
  Trash2,
  FolderOpen,
  MessageSquare,
  FileSearch,
  PenTool,
  FileEdit,
  Calculator,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Loader2,
} from 'lucide-react'

import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { LexiaChatMessage } from '@/components/lexia/lexia-chat-message'

/** Available Lexia tools organized by category */
const lexiaTools = {
  redaccion: [
    {
      id: 'draft',
      name: 'Redactar Documento',
      description: 'Genera borradores de escritos judiciales, contratos y más',
      icon: PenTool,
      prompt: 'Necesito redactar un documento legal. El tipo de documento es: ',
    },
    {
      id: 'improve',
      name: 'Mejorar Texto',
      description: 'Revisa y mejora la redacción de un texto legal',
      icon: FileEdit,
      prompt: 'Por favor mejora el siguiente texto legal: ',
    },
  ],
  investigacion: [
    {
      id: 'summarize',
      name: 'Resumir Documento',
      description: 'Analiza y resume documentos legales extensos',
      icon: FileSearch,
      prompt: 'Resume el siguiente documento identificando partes, obligaciones y plazos: ',
    },
    {
      id: 'research',
      name: 'Investigar Tema',
      description: 'Investiga jurisprudencia y doctrina sobre un tema',
      icon: GraduationCap,
      prompt: 'Investiga sobre el siguiente tema legal en Argentina: ',
    },
  ],
  procedimiento: [
    {
      id: 'checklist',
      name: 'Checklist Procesal',
      description: 'Genera lista de pasos para un tipo de procedimiento',
      icon: ListChecks,
      prompt: 'Dame el checklist completo para un proceso de: ',
    },
    {
      id: 'deadline',
      name: 'Calcular Plazos',
      description: 'Calcula vencimientos según ley procesal',
      icon: Calculator,
      prompt: 'Calcula el plazo para: ',
    },
  ],
  consulta: [
    {
      id: 'question',
      name: 'Consulta Legal',
      description: 'Responde preguntas sobre procedimientos y normativa',
      icon: MessageSquare,
      prompt: '',
    },
    {
      id: 'strategy',
      name: 'Estrategia Legal',
      description: 'Sugiere estrategias para un caso',
      icon: Lightbulb,
      prompt: 'Necesito una estrategia legal para: ',
    },
  ],
}

type LexiaTool = (typeof lexiaTools)[keyof typeof lexiaTools][number]

/** Case context type */
interface CaseContext {
  id: string
  caseNumber: string
  title: string
  type: string
  status: string
  company?: string
  documentsCount: number
  notesCount: number
}

export default function LexiaPage() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')

  const [input, setInput] = useState('')
  const [caseContext, setCaseContext] = useState<CaseContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [, setActiveTab] = useState<'chat' | 'tools'>('chat')

  const [availableCases, setAvailableCases] = useState<
    { id: string; caseNumber: string; title: string }[]
  >([])

  const scrollRef = useRef<HTMLDivElement>(null)

  const supabase = useMemo(() => createClient(), [])

  // AI Chat hook
  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/lexia',
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          id,
          messages,
          caseContext: caseContext
            ? {
                caseId: caseContext.id,
                caseNumber: caseContext.caseNumber,
                title: caseContext.title,
                type: caseContext.type,
              }
            : null,
        },
      }),
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const isReady = status === 'ready'

  // Log errors
  useEffect(() => {
    if (error) {
      console.error('[v0] Chat error:', error)
      toast.error('Error al conectar con Lexia. Por favor intenta de nuevo.')
    }
  }, [error])

  /** Load case context from database */
  const loadCaseContext = async (id: string) => {
    setIsLoadingContext(true)
    try {
      const { data: caseData, error } = await supabase
        .from('cases')
        .select(
          `
            id, case_number, title, case_type, status,
            companies(company_name),
            documents(count),
            case_notes(count)
          `
        )
        .eq('id', id)
        .single()

      if (error) throw error

      if (caseData) {
        setCaseContext({
          id: caseData.id,
          caseNumber: caseData.case_number,
          title: caseData.title,
          type: caseData.case_type || 'general',
          status: caseData.status,
          company: (caseData.companies as { company_name?: string } | null)?.company_name,
          documentsCount: (caseData.documents as { count: number }[])?.[0]?.count || 0,
          notesCount: (caseData.case_notes as { count: number }[])?.[0]?.count || 0,
        })
      }
    } catch (err) {
      console.error('[v0] Error loading case context:', err)
      toast.error('Error al cargar el contexto del caso')
    } finally {
      setIsLoadingContext(false)
    }
  }

  // Load case context if caseId is provided
  useEffect(() => {
    if (caseId) {
      loadCaseContext(caseId)
    } else {
      setCaseContext(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  // Load available cases for selector
  useEffect(() => {
    const loadCases = async () => {
      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, title')
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('[v0] Error loading cases:', error)
        return
      }

      if (data) {
        setAvailableCases(
          data.map((c) => ({
            id: c.id,
            caseNumber: c.case_number,
            title: c.title,
          }))
        )
      }
    }

    loadCases()
  }, [supabase])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  /** Handle sending a message */
  const handleSend = async () => {
    if (!input.trim() || !isReady) return
    const messageText = input.trim()
    setInput('')

    try {
      await sendMessage({ text: messageText })
    } catch (err) {
      console.error('[v0] Error sending message:', err)
      toast.error('Error al enviar mensaje')
    }
  }

  /** Handle tool selection */
  const handleToolSelect = (tool: LexiaTool) => {
    setInput(tool.prompt)
    setActiveTab('chat')
  }

  /** Handle case selection */
  const handleCaseSelect = (id: string) => {
    if (id === 'none') {
      setCaseContext(null)
      window.history.replaceState(null, '', '/lexia')
      return
    }

    loadCaseContext(id)
    window.history.replaceState(null, '', `/lexia?caso=${id}`)
  }

  /** Clear conversation */
  const handleClearChat = () => {
    setMessages([])
    setInput('')
    toast.success('Conversación limpiada')
  }

  /** Copy message */
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Lexia
                </h1>
                <Badge variant="secondary" className="text-xs">
                  IA Legal
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                Asistente inteligente para investigación y redacción legal
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <Select
              value={caseContext?.id || 'none'}
              onValueChange={handleCaseSelect}
              disabled={isLoadingContext}
            >
              <SelectTrigger className="w-[280px]">
                <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Sin contexto de caso" />
                {isLoadingContext && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin contexto de caso</SelectItem>
                <Separator className="my-1" />
                {availableCases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.caseNumber} - {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" disabled>
              <History className="mr-2 h-4 w-4" />
              Historial
            </Button>

            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearChat}>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
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
                    Tengo acceso a la información de este caso. Puedes preguntarme sobre
                    documentos, plazos o pedirme que redacte escritos relacionados.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 w-full max-w-2xl">
                  {[
                    {
                      icon: PenTool,
                      title: 'Redactar',
                      desc: 'Crear documentos legales',
                      tool: lexiaTools.redaccion[0],
                    },
                    {
                      icon: FileSearch,
                      title: 'Resumir',
                      desc: 'Analizar documentos',
                      tool: lexiaTools.investigacion[0],
                    },
                    {
                      icon: ListChecks,
                      title: 'Checklist',
                      desc: 'Pasos procesales',
                      tool: lexiaTools.procedimiento[0],
                    },
                    {
                      icon: MessageSquare,
                      title: 'Consultar',
                      desc: 'Preguntas legales',
                      tool: lexiaTools.consulta[0],
                    },
                  ].map((item) => (
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
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <LexiaChatMessage
                  key={message.id}
                  message={message}
                  onCopy={handleCopy}
                />
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>

                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Lexia está pensando...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 flex-shrink-0">
          {caseContext && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              <span>
                Contexto: {caseContext.caseNumber} - {caseContext.title}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              placeholder={
                caseContext
                  ? `Pregunta sobre ${caseContext.caseNumber} o pide ayuda con documentos...`
                  : 'Escribe tu consulta legal o selecciona una herramienta...'
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
