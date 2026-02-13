/**
 * Demand template variants for incumplimiento contractual.
 * Used by Redactor and Plantillas UI.
 */

export const DEMANDA_VARIANT_STANDARD = '' as const
export const DEMANDA_VARIANT_INCUMPLIMIENTO_LOCACION = 'incumplimiento_locacion' as const
export const DEMANDA_VARIANT_INCUMPLIMIENTO_COMPRAVENTA = 'incumplimiento_compraventa' as const
export const DEMANDA_VARIANT_INCUMPLIMIENTO_SUMINISTRO = 'incumplimiento_suministro' as const
export const DEMANDA_VARIANT_INCUMPLIMIENTO_SERVICIOS = 'incumplimiento_servicios' as const

export type DemandaVariant =
  | typeof DEMANDA_VARIANT_STANDARD
  | typeof DEMANDA_VARIANT_INCUMPLIMIENTO_LOCACION
  | typeof DEMANDA_VARIANT_INCUMPLIMIENTO_COMPRAVENTA
  | typeof DEMANDA_VARIANT_INCUMPLIMIENTO_SUMINISTRO
  | typeof DEMANDA_VARIANT_INCUMPLIMIENTO_SERVICIOS

export const DEMANDA_VARIANTS: DemandaVariant[] = [
  DEMANDA_VARIANT_STANDARD,
  DEMANDA_VARIANT_INCUMPLIMIENTO_LOCACION,
  DEMANDA_VARIANT_INCUMPLIMIENTO_COMPRAVENTA,
  DEMANDA_VARIANT_INCUMPLIMIENTO_SUMINISTRO,
  DEMANDA_VARIANT_INCUMPLIMIENTO_SERVICIOS,
]

export const DEMANDA_VARIANT_LABELS: Record<DemandaVariant, string> = {
  [DEMANDA_VARIANT_STANDARD]: 'Demanda (estándar)',
  [DEMANDA_VARIANT_INCUMPLIMIENTO_LOCACION]: 'Incumplimiento - Locación',
  [DEMANDA_VARIANT_INCUMPLIMIENTO_COMPRAVENTA]: 'Incumplimiento - Compraventa',
  [DEMANDA_VARIANT_INCUMPLIMIENTO_SUMINISTRO]: 'Incumplimiento - Suministro',
  [DEMANDA_VARIANT_INCUMPLIMIENTO_SERVICIOS]: 'Incumplimiento - Servicios',
}

export function getDemandaVariantLabel(variant: string): string {
  const label = DEMANDA_VARIANT_LABELS[variant as DemandaVariant]
  if (label !== undefined) return label
  return variant ? variant : 'Demanda (estándar)'
}

export function isDemandaVariant(value: string): value is DemandaVariant {
  return DEMANDA_VARIANTS.includes(value as DemandaVariant)
}
