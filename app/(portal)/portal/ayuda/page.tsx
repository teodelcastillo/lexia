/**
 * Client Portal - Help & Contact Page
 * 
 * Provides contact information and FAQ for clients.
 * Designed to be reassuring and easy to understand.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEffectivePortalUserId } from '@/lib/portal/view-as'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  HelpCircle,
  ChevronDown,
  MessageSquare,
  Shield,
  CheckCircle2,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export const metadata = {
  title: 'Ayuda - Portal de Clientes',
  description: 'Información de contacto y preguntas frecuentes',
}

/** Frequently asked questions */
const faqItems = [
  {
    question: '¿Qué significa el estado "Activo" de mi caso?',
    answer: 'Un caso "Activo" significa que estamos trabajando activamente en él. Su abogado está realizando las gestiones necesarias y le informará sobre cualquier novedad importante.',
  },
  {
    question: '¿Qué significa el estado "Pendiente"?',
    answer: 'Un caso "Pendiente" está a la espera de alguna acción específica, como una respuesta del tribunal, la otra parte, o alguna documentación necesaria. Su abogado le contactará si necesita su colaboración.',
  },
  {
    question: '¿Qué significa el estado "En Espera"?',
    answer: 'Un caso "En Espera" indica que estamos aguardando un evento específico para continuar. Esto puede ser una audiencia programada, un plazo legal, o una decisión externa. Le mantendremos informado.',
  },
  {
    question: '¿Cómo puedo descargar mis documentos?',
    answer: 'En la sección "Documentos" encontrará todos los documentos que su abogado ha compartido con usted. Puede descargarlos directamente haciendo clic en el botón "Descargar".',
  },
  {
    question: '¿Por qué no veo todos los documentos de mi caso?',
    answer: 'Solo aparecen los documentos que su abogado ha decidido compartir con usted. Algunos documentos internos o borradores no se muestran. Si necesita algún documento específico, contacte a su abogado.',
  },
  {
    question: '¿Cómo se actualizan las fechas importantes?',
    answer: 'Las fechas se actualizan automáticamente cuando su equipo legal agenda nuevas audiencias, vencimientos o eventos importantes. Solo verá las fechas relevantes para usted.',
  },
  {
    question: '¿Qué hago si tengo una urgencia?',
    answer: 'Para asuntos urgentes, contacte directamente a su abogado por teléfono. Encontrará el número de contacto en esta página y en los detalles de su caso.',
  },
]

export default async function PortalHelpPage() {
  const supabase = await createClient()
  const effectiveUserId = await getEffectivePortalUserId()
  if (!effectiveUserId) redirect('/auth/portal-login')

  // Get client record (or viewed-as client when admin)
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', effectiveUserId)
    .single()

  // Get lead lawyer from any of client's cases
  const { data: caseWithLawyer } = await supabase
    .from('cases')
    .select(`
      case_assignments(
        role,
        profile:profiles(first_name, last_name, email)
      )
    `)
    .eq('client_id', client?.id)
    .limit(1)
    .single()

  const leadLawyer = caseWithLawyer?.case_assignments?.find(
    (a: { role: string }) => a.role === 'leader'
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Ayuda y Contacto
        </h1>
        <p className="text-muted-foreground mt-1">
          Estamos aquí para ayudarle con cualquier consulta
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Your Lawyer */}
          {leadLawyer?.profile && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-primary" />
                  Su Abogado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
                    {leadLawyer.profile.first_name.charAt(0)}
                    {leadLawyer.profile.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-lg">
                      {leadLawyer.profile.first_name} {leadLawyer.profile.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Abogado a cargo de su caso
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <a 
                    href={`mailto:${leadLawyer.profile.email}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Mail className="h-5 w-5 text-primary" />
                    <span className="text-sm">{leadLawyer.profile.email}</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Office Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-5 w-5" />
                Contacto del Estudio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <a 
                  href="tel:+543514000000"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">+54 351 400-0000</p>
                    <p className="text-xs text-muted-foreground">Línea principal</p>
                  </div>
                </a>
                
                <a 
                  href="mailto:contacto@legalhub.com"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">contacto@legalhub.com</p>
                    <p className="text-xs text-muted-foreground">Consultas generales</p>
                  </div>
                </a>
              </div>
              
              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Dirección</p>
                    <p className="text-muted-foreground">
                      Av. Colón 1234, Piso 5<br />
                      Córdoba, Argentina
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-sm">
                  <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Horario de Atención</p>
                    <p className="text-muted-foreground">
                      Lunes a Viernes<br />
                      9:00 - 18:00 hs
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reassurance Banner */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  Estamos trabajando en su caso
                </h3>
                <p className="text-muted-foreground mt-1">
                  Nuestro equipo está comprometido con brindarle el mejor servicio legal. 
                  Si no ve actualizaciones recientes, no significa que su caso esté detenido. 
                  Muchas gestiones se realizan de forma interna y le informaremos cuando haya novedades importantes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-5 w-5" />
                Preguntas Frecuentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-sm hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Additional Help */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted flex-shrink-0">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">¿No encontró lo que buscaba?</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Contacte directamente a su abogado para cualquier consulta sobre su caso.
                  </p>
                </div>
                <Button variant="outline" asChild className="flex-shrink-0 bg-transparent">
                  <a href={leadLawyer?.profile?.email ? `mailto:${leadLawyer.profile.email}` : 'mailto:contacto@legalhub.com'}>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar Email
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
