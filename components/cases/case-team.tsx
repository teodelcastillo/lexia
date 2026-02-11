/**
 * Case Team Component
 * 
 * Displays and manages team assignments for a case.
 * Includes confirmation dialogs for removing members.
 */
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Users, Crown, UserCog, User, Loader2 } from 'lucide-react'
import { 
  ConfirmationDialog,
  EmptyState,
  PermissionButton,
} from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { CaseRole } from '@/lib/types'

interface CaseTeamProps {
  caseId: string
  assignments: Array<{
    id: string
    case_role: string
    assigned_at: string
    profiles: {
      id: string
      first_name: string
      last_name: string
      email: string
      system_role: string
    } | null
  }>
  canManageTeam: boolean
}

/**
 * Role configuration
 */
const roleConfig: Record<CaseRole, { label: string; icon: typeof Crown; color: string }> = {
  leader: { label: 'Responsable', icon: Crown, color: 'text-amber-600' },
  lawyer: { label: 'Abogado', icon: UserCog, color: 'text-primary' },
  assistant: { label: 'Asistente', icon: User, color: 'text-muted-foreground' },
}

/**
 * System role labels
 */
const systemRoleLabels: Record<string, string> = {
  admin: 'Administrador',
  lawyer: 'Abogado',
  assistant: 'Asistente',
  client: 'Cliente',
}

/**
 * Gets initials from name
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function CaseTeam({ caseId, assignments, canManageTeam }: CaseTeamProps) {
  // State for remove member confirmation
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string
    name: string
  } | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // Sort assignments by role priority
  const sortedAssignments = [...assignments].sort((a, b) => {
    const roleOrder: Record<string, number> = { leader: 0, lawyer: 1, assistant: 2 }
    return (roleOrder[a.case_role] ?? 3) - (roleOrder[b.case_role] ?? 3)
  })

  /**
   * Handle remove member action
   */
  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    setIsRemoving(true)
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('case_assignments')
        .delete()
        .eq('id', memberToRemove.id)

      if (error) throw error

      toast.success('Miembro removido', {
        description: `${memberToRemove.name} fue removido del caso exitosamente.`,
      })

      // Refresh the page to update the list
      window.location.reload()
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Error al remover miembro', {
        description: 'No se pudo remover al miembro del caso. Intente nuevamente.',
      })
    } finally {
      setIsRemoving(false)
      setMemberToRemove(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Equipo del Caso ({assignments.length})
        </h3>
        <PermissionButton
          permission="canManageTeam"
          permissions={{ canManageTeam }}
          size="sm"
          hideWhenDenied={!canManageTeam}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Miembro
        </PermissionButton>
      </div>

      {assignments.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-0">
            <EmptyState
              type="generic"
              icon={Users}
              title="Sin miembros asignados"
              description="Este caso aún no tiene miembros del equipo asignados."
              action={
                canManageTeam
                  ? {
                      label: 'Asignar Primer Miembro',
                      onClick: () => {
                        /* TODO: Open add member dialog */
                      },
                    }
                  : undefined
              }
              size="md"
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Miembros Asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {sortedAssignments.map((assignment) => {
                const profile = assignment.profiles
                if (!profile) return null

                const role = roleConfig[assignment.case_role as CaseRole]
                const RoleIcon = role?.icon || User
                const isLeader = assignment.case_role === 'leader'
                const memberName = `${profile.first_name} ${profile.last_name}`

                return (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Avatar */}
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(profile.first_name, profile.last_name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {memberName}
                        </p>
                        <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                          <RoleIcon className={`h-3 w-3 ${role?.color || ''}`} />
                          {role?.label || assignment.case_role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {profile.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {systemRoleLabels[profile.system_role] || profile.system_role} · Asignado{' '}
                        {new Date(assignment.assigned_at).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Actions - Show remove button only for non-leaders when user can manage */}
                    {canManageTeam && !isLeader && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setMemberToRemove({
                            id: assignment.id,
                            name: memberName,
                          })
                        }
                      >
                        Remover
                      </Button>
                    )}

                    {/* Show tooltip for leader (cannot be removed) */}
                    {canManageTeam && isLeader && (
                      <span className="text-xs text-muted-foreground italic">
                        No removible
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Legend */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Roles del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(roleConfig).map(([key, config]) => (
              <div key={key} className="flex items-start gap-2">
                <config.icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{config.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {key === 'leader' && 'Gestión completa del caso y equipo'}
                    {key === 'case_leader' && 'Acceso completo al caso'}
                    {key === 'lawyer_executive' && 'Ejecuta tareas y sube documentos'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmationDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        actionType="remove_user"
        itemName={memberToRemove?.name}
        onConfirm={handleRemoveMember}
        isLoading={isRemoving}
        additionalWarning="El usuario perderá acceso inmediato a toda la información del caso, incluyendo documentos, tareas y notas."
        requireLegalAcknowledgment
        legalAcknowledgmentText="Confirmo que deseo remover a este miembro del caso y entiendo que perderá acceso a toda la información relacionada."
      />
    </div>
  )
}
