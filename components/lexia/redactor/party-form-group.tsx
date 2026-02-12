'use client'

import { useFormContext } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DOCUMENTO_TIPOS } from '@/lib/lexia/party-fields'

export type PartyType = 'persona_fisica' | 'persona_juridica'

interface PartyFormGroupProps {
  prefix: string
  label: string
  disabled?: boolean
}

export function PartyFormGroup({ prefix, label, disabled }: PartyFormGroupProps) {
  const form = useFormContext()
  const tipo = form.watch(`${prefix}_tipo`) as PartyType | undefined
  const hasRazonSocial = !!((form.watch(`${prefix}_razon_social`) ?? '').trim())
  const isPersonaFisica = tipo === 'persona_fisica' || (!tipo && !hasRazonSocial)
  const isPersonaJuridica = tipo === 'persona_juridica' || (!tipo && hasRazonSocial)

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <Label className="text-base font-medium">{label}</Label>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Tipo</Label>
        <RadioGroup
          value={tipo ?? ''}
          onValueChange={(v) => form.setValue(`${prefix}_tipo`, v)}
          className="flex gap-6"
          disabled={disabled}
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="persona_fisica" id={`${prefix}-pf`} />
            <span className="text-sm">Persona física</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="persona_juridica" id={`${prefix}-pj`} />
            <span className="text-sm">Persona jurídica</span>
          </label>
        </RadioGroup>
      </div>

      {isPersonaFisica && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}_nombre`}>Nombre</Label>
            <Input
              id={`${prefix}_nombre`}
              placeholder="Nombre"
              disabled={disabled}
              {...form.register(`${prefix}_nombre`)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}_apellido`}>Apellido</Label>
            <Input
              id={`${prefix}_apellido`}
              placeholder="Apellido"
              disabled={disabled}
              {...form.register(`${prefix}_apellido`)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}_edad`}>Edad</Label>
            <Input
              id={`${prefix}_edad`}
              type="number"
              placeholder="Edad (años)"
              disabled={disabled}
              {...form.register(`${prefix}_edad`)}
            />
          </div>
        </div>
      )}

      {isPersonaJuridica && (
        <div className="space-y-2">
          <Label htmlFor={`${prefix}_razon_social`}>Razón social</Label>
          <Input
            id={`${prefix}_razon_social`}
            placeholder="Razón social de la empresa"
            disabled={disabled}
            {...form.register(`${prefix}_razon_social`)}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}_documento_tipo`}>Tipo de documento</Label>
          <Select
            value={form.watch(`${prefix}_documento_tipo`) ?? ''}
            onValueChange={(v) => form.setValue(`${prefix}_documento_tipo`, v)}
            disabled={disabled}
          >
            <SelectTrigger id={`${prefix}_documento_tipo`} className="w-full">
              <SelectValue placeholder="DNI / PASAPORTE / CUIT" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENTO_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}_documento`}>Número de documento</Label>
          <Input
            id={`${prefix}_documento`}
            placeholder="Número de DNI, Pasaporte o CUIT"
            disabled={disabled}
            {...form.register(`${prefix}_documento`)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}_domicilio_real`}>Domicilio real</Label>
        <Input
          id={`${prefix}_domicilio_real`}
          placeholder="Dirección completa (calle, número, localidad, provincia)"
          disabled={disabled}
          {...form.register(`${prefix}_domicilio_real`)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}_domicilio_legal`}>Domicilio legal (opcional)</Label>
        <Input
          id={`${prefix}_domicilio_legal`}
          placeholder="Si difiere del domicilio real"
          disabled={disabled}
          {...form.register(`${prefix}_domicilio_legal`)}
        />
      </div>
    </div>
  )
}
