import React from "react"
/**
 * Client Information Card
 * 
 * Displays the general information of a client in a clean,
 * organized card layout with contact details and address.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  User,
  FileDigit,
  Calendar,
  Globe,
} from 'lucide-react'
import type { Client } from '@/lib/types'

interface ClientInfoCardProps {
  client: Client
}

/**
 * Information row component for consistent styling
 */
function InfoRow({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-foreground break-words">
          {value}
        </p>
      </div>
    </div>
  )
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  const isCompany = client.client_type === 'company'
  
  // Format the full address
  const fullAddress = [
    client.address,
    client.city,
    client.province,
    client.postal_code && `CP ${client.postal_code}`,
  ].filter(Boolean).join(', ')

  // Format date
  const createdDate = new Date(client.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Contact Information */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Información de Contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <InfoRow 
            icon={isCompany ? Building2 : User}
            label={isCompany ? 'Razón Social' : 'Nombre Completo'}
            value={client.name}
          />
          <InfoRow 
            icon={FileDigit}
            label={isCompany ? 'CUIT' : 'CUIL/DNI'}
            value={client.tax_id}
          />
          <InfoRow 
            icon={Mail}
            label="Correo Electrónico"
            value={client.email}
          />
          <InfoRow 
            icon={Phone}
            label="Teléfono"
            value={client.phone}
          />
        </CardContent>
      </Card>

      {/* Address & Additional Info */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Ubicación y Datos Adicionales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <InfoRow 
            icon={MapPin}
            label="Dirección Completa"
            value={fullAddress || null}
          />
          <InfoRow 
            icon={Globe}
            label="Ciudad"
            value={client.city}
          />
          <InfoRow 
            icon={Globe}
            label="Provincia"
            value={client.province}
          />
          <InfoRow 
            icon={Calendar}
            label="Cliente desde"
            value={createdDate}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      {client.notes && (
        <Card className="border-border/60 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Observaciones Generales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {client.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
