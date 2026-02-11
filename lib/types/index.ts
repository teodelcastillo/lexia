// Re-export all database types
export * from './database'

// Import database types for use in this file
import type {
  Profile as DBProfile,
  Case as DBCase,
  Company as DBCompany,
  Person as DBPerson,
  Task as DBTask,
  Document as DBDocument,
  Deadline as DBDeadline,
  CaseAssignment as DBCaseAssignment,
  CaseNote as DBCaseNote,
  CaseParticipant as DBCaseParticipant,
  CaseStatus,
  TaskStatus,
  TaskPriority,
  DeadlineStatus,
  DeadlineType,
  DocumentCategory,
  UserRole,
  PersonType,
  ParticipantRole,
  CompanyRole,
} from './database'

// ============================================
// Extended Types with Relations
// ============================================

/**
 * Profile with computed full name
 */
export interface ProfileWithFullName extends DBProfile {
  full_name?: string
}

/**
 * Case with related data
 */
export interface CaseWithRelations extends DBCase {
  companies?: DBCompany | null
  case_assignments?: (DBCaseAssignment & {
    profiles?: DBProfile
  })[]
  case_participants?: (DBCaseParticipant & {
    people?: DBPerson
  })[]
  tasks?: DBTask[]
  deadlines?: DBDeadline[]
  documents?: DBDocument[]
}

/**
 * Company with related people
 */
export interface CompanyWithMembers extends DBCompany {
  people?: DBPerson[]
  cases?: DBCase[]
}

/**
 * Person with company and cases
 */
export interface PersonWithRelations extends DBPerson {
  companies?: DBCompany | null
  case_participants?: (DBCaseParticipant & {
    cases?: DBCase
  })[]
}

/**
 * Task with related data
 */
export interface TaskWithRelations extends DBTask {
  cases?: DBCase
  assigned_to_profile?: DBProfile
  created_by_profile?: DBProfile
}

/**
 * Deadline with related data
 */
export interface DeadlineWithRelations extends DBDeadline {
  cases?: DBCase
  assigned_to_profile?: DBProfile
}

/**
 * Document with related data
 */
export interface DocumentWithRelations extends DBDocument {
  cases?: DBCase
  uploaded_by_profile?: DBProfile
}

// ============================================
// UI Configuration Types
// ============================================

export interface StatusConfig {
  label: string
  color: string
  bgColor: string
  borderColor: string
}

export interface PriorityConfig {
  label: string
  color: string
  bgColor: string
  icon?: string
}

// ============================================
// Status/Priority Configurations
// ============================================

export const caseStatusConfig: Record<CaseStatus, StatusConfig> = {
  active: {
    label: 'Activo',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  pending: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  on_hold: {
    label: 'En Espera',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  closed: {
    label: 'Cerrado',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  archived: {
    label: 'Archivado',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
}

export const taskStatusConfig: Record<TaskStatus, StatusConfig> = {
  pending: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  in_progress: {
    label: 'En Progreso',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  under_review: {
    label: 'En Revisión',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  completed: {
    label: 'Completada',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
}

export const taskPriorityConfig: Record<TaskPriority, PriorityConfig> = {
  urgent: {
    label: 'Urgente',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  high: {
    label: 'Alta',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  medium: {
    label: 'Media',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  low: {
    label: 'Baja',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
  },
}

export const deadlineStatusConfig: Record<DeadlineStatus, StatusConfig> = {
  pending: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  completed: {
    label: 'Completado',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  missed: {
    label: 'Vencido',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  cancelled: {
    label: 'Cancelado',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
}

export const userRoleConfig: Record<UserRole, { label: string; description: string }> = {
  admin_general: {
    label: 'Administrador General',
    description: 'Acceso completo al sistema',
  },
  case_leader: {
    label: 'Líder de Caso',
    description: 'Gestión de casos asignados',
  },
  lawyer_executive: {
    label: 'Abogado Ejecutivo',
    description: 'Trabajo en casos asignados',
  },
  client: {
    label: 'Cliente',
    description: 'Acceso limitado a sus casos',
  },
}

export const personTypeConfig: Record<PersonType, { label: string; color: string; bgColor: string }> = {
  client: {
    label: 'Cliente',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
  },
  judge: {
    label: 'Juez',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  opposing_lawyer: {
    label: 'Abogado Contraparte',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  prosecutor: {
    label: 'Fiscal',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  witness: {
    label: 'Testigo',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  expert: {
    label: 'Perito',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
  },
  other: {
    label: 'Otro',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
  },
}

export const participantRoleConfig: Record<ParticipantRole, { label: string; color: string; bgColor: string }> = {
  client_representative: {
    label: 'Representante del Cliente',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
  },
  opposing_party: {
    label: 'Parte Contraria',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  opposing_lawyer: {
    label: 'Abogado Contraparte',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  judge: {
    label: 'Juez',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  prosecutor: {
    label: 'Fiscal',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  expert_witness: {
    label: 'Perito',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
  },
  witness: {
    label: 'Testigo',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  mediator: {
    label: 'Mediador',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
  },
  court_clerk: {
    label: 'Secretario Judicial',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
  },
  other: {
    label: 'Otro',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
  },
}

export const companyRoleConfig: Record<CompanyRole, { label: string }> = {
  legal_representative: { label: 'Representante Legal' },
  attorney: { label: 'Apoderado' },
  contact: { label: 'Contacto' },
  shareholder: { label: 'Accionista' },
  director: { label: 'Director' },
  other: { label: 'Otro' },
}

export const deadlineTypeConfig: Record<DeadlineType, { label: string; color: string; bgColor: string }> = {
  court_date: { label: 'Audiencia', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  filing_deadline: { label: 'Presentacion', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  meeting: { label: 'Reunion', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  other: { label: 'Otro', color: 'text-gray-700', bgColor: 'bg-gray-50' },
}

export const documentCategoryConfig: Record<DocumentCategory, { label: string; color: string }> = {
  contract: { label: 'Contrato', color: 'text-blue-700' },
  court_filing: { label: 'Escrito Judicial', color: 'text-purple-700' },
  correspondence: { label: 'Correspondencia', color: 'text-emerald-700' },
  evidence: { label: 'Evidencia', color: 'text-amber-700' },
  internal_memo: { label: 'Memo Interno', color: 'text-gray-700' },
  client_document: { label: 'Documento del Cliente', color: 'text-cyan-700' },
  other: { label: 'Otro', color: 'text-slate-700' },
}

// ============================================
// Legacy type aliases for backwards compatibility
// ============================================
export type CasePriority = TaskPriority
export const casePriorityConfig = taskPriorityConfig
