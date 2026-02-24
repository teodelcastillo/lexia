'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'
import { compensationStatusConfig, participationTypeConfig } from '@/lib/types'

interface CompensationDetailProps {
  compensation: any
  participations: any[]
}

export function CompensationDetail({ compensation, participations }: CompensationDetailProps) {
  const statusCfg = compensationStatusConfig[compensation.status as keyof typeof compensationStatusConfig]
  const lawyerName = `${compensation.profiles?.first_name} ${compensation.profiles?.last_name}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/liquidaciones">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Liquidación: {lawyerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Período {compensation.period}
          </p>
        </div>
        <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0 text-sm px-3 py-1`}>
          {statusCfg?.label}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Compensation Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose de Compensación</CardTitle>
            <CardDescription>Cálculo detallado del período {compensation.period}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Básico en JUS</span>
                <span className="font-medium">
                  {compensation.base_salary_jus?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'} JUS
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor del JUS al período</span>
                <span className="font-medium">
                  ${compensation.jus_value_at_period?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base en ARS ({compensation.base_salary_jus} x ${compensation.jus_value_at_period})</span>
                <span className="font-medium">
                  ${compensation.base_amount_ars?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Participaciones variables</span>
                <span className="font-medium">
                  ${compensation.participations_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {compensation.deductions > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deducciones</span>
                  <span className="font-medium text-red-600">
                    -${compensation.deductions?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Bruto</span>
                <span>${compensation.total_gross?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {compensation.payment_date && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                Pagado el {compensation.payment_date}
              </div>
            )}

            {compensation.notes && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">{compensation.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lawyer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Abogado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Nombre</p>
              <p className="font-medium">{lawyerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{compensation.profiles?.email}</p>
            </div>
            {compensation.profiles?.bar_number && (
              <div>
                <p className="text-muted-foreground">Matrícula</p>
                <p className="font-medium">{compensation.profiles.bar_number}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participations Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Participaciones en Causas</CardTitle>
          <CardDescription>Causas que contribuyen a la compensación variable</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Causa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Porcentaje</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Calculado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participations.length > 0 ? (
                participations.map((p: any) => {
                  const typeCfg = participationTypeConfig[p.participation_type as keyof typeof participationTypeConfig]
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/casos/${p.case_id}`} className="font-medium hover:underline">
                          {p.cases?.case_number} - {p.cases?.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{typeCfg?.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.percentage}%</TableCell>
                      <TableCell className="text-right">
                        ${p.base_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${p.calculated_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-0' :
                          p.status === 'approved' ? 'bg-blue-50 text-blue-700 border-0' :
                          'bg-gray-50 text-gray-700 border-0'
                        }>
                          {p.status === 'paid' ? 'Pagado' : p.status === 'approved' ? 'Aprobado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Sin participaciones para este período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
