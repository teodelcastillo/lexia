/**
 * Party field definitions for Lexia Redactor.
 * Persona física: Nombre, Apellido, Edad, Documento (DNI/PASAPORTE/CUIT), Domicilio real, Domicilio legal (opcional)
 * Persona jurídica: Razón social, Documento (CUIT), Domicilio real, Domicilio legal (opcional)
 */

import type { FormFieldDefinition } from '@/lib/ai/draft-schemas'

export const PARTY_FIELD_KEYS = {
  tipo: '_tipo',
  nombre: '_nombre',
  apellido: '_apellido',
  edad: '_edad',
  razon_social: '_razon_social',
  documento_tipo: '_documento_tipo',
  documento: '_documento',
  domicilio_real: '_domicilio_real',
  domicilio_legal: '_domicilio_legal',
} as const

export const DOCUMENTO_TIPOS = ['DNI', 'PASAPORTE', 'CUIT'] as const

const PARTY_SUB_KEYS = [
  'tipo', 'nombre', 'apellido', 'edad', 'razon_social',
  'documento_tipo', 'documento', 'domicilio_real', 'domicilio_legal',
] as const

export function getPartyFieldKeys(prefix: string): string[] {
  return PARTY_SUB_KEYS.map((s) => `${prefix}_${s}`)
}

export function getPartyFields(prefix: string, label: string): FormFieldDefinition[] {
  return [
    { key: `${prefix}_tipo`, label: `Tipo - ${label}`, type: 'text', required: true },
    { key: `${prefix}_nombre`, label: `Nombre - ${label}`, type: 'text', required: false, placeholder: 'Solo para persona física' },
    { key: `${prefix}_apellido`, label: `Apellido - ${label}`, type: 'text', required: false, placeholder: 'Solo para persona física' },
    { key: `${prefix}_edad`, label: `Edad - ${label}`, type: 'text', required: false, placeholder: 'Solo para persona física (no aplica persona jurídica)' },
    { key: `${prefix}_razon_social`, label: `Razón social - ${label}`, type: 'text', required: false, placeholder: 'Solo para persona jurídica' },
    { key: `${prefix}_documento_tipo`, label: `Tipo documento - ${label}`, type: 'text', required: true },
    { key: `${prefix}_documento`, label: `Número documento - ${label}`, type: 'text', required: true, placeholder: 'DNI, Pasaporte o CUIT' },
    { key: `${prefix}_domicilio_real`, label: `Domicilio real - ${label}`, type: 'text', required: true, placeholder: 'Dirección completa' },
    { key: `${prefix}_domicilio_legal`, label: `Domicilio legal - ${label}`, type: 'text', required: false, placeholder: 'Opcional' },
  ]
}
