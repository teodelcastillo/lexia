/**
 * Document type labels and icons for Lexia Redactor and Templates
 */

import {
  FileText,
  Scale,
  Mail,
  FileSignature,
  Handshake,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import type { DocumentType } from '@/lib/ai/draft-schemas'

export const DOCUMENT_TYPE_CONFIG: Record<
  DocumentType,
  { label: string; icon: LucideIcon; description: string }
> = {
  demanda: {
    label: 'Demanda',
    icon: FileText,
    description: 'Escrito de demanda judicial',
  },
  contestacion: {
    label: 'Contestación',
    icon: FileText,
    description: 'Contestación de demanda',
  },
  apelacion: {
    label: 'Apelación',
    icon: Scale,
    description: 'Recurso de apelación',
  },
  casacion: {
    label: 'Casación',
    icon: Scale,
    description: 'Recurso de casación',
  },
  recurso_extraordinario: {
    label: 'Recurso Extraordinario',
    icon: Scale,
    description: 'Recurso extraordinario',
  },
  contrato: {
    label: 'Contrato',
    icon: FileSignature,
    description: 'Contrato civil o comercial',
  },
  carta_documento: {
    label: 'Carta Documento',
    icon: Mail,
    description: 'Notificación fehaciente',
  },
  mediacion: {
    label: 'Mediación',
    icon: Handshake,
    description: 'Escrito de mediación',
  },
  oficio_judicial: {
    label: 'Oficio Judicial',
    icon: Building2,
    description: 'Oficio dirigido al tribunal',
  },
}
