/**
 * Application Sidebar
 * 
 * Main navigation sidebar for the dashboard.
 * Displays navigation items based on user's permissions.
 * 
 * Navigation Structure:
 * - OPERACIONAL: Core daily workflow modules (Dashboard, Cases, Clients, Tasks)
 * - DOCUMENTACIÓN: Document management and calendar
 * - COMUNICACIÓN: Internal notes, AI assistant, and email tools
 * - ADMINISTRACIÓN: Admin-only settings and user management
 */
'use client'

import React from "react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Scale,
  LayoutDashboard,
  Briefcase,
  Users,
  Building2,
  CheckSquare,
  FileText,
  Calendar,
  Settings,
  Mail,
  LogOut,
  ChevronDown,
  User,
  MessageSquare,
  Sparkles,
  Clock,
  UserCog,
  ExternalLink,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/hooks/use-auth'

/** System role types for navigation visibility control */
type SystemRole = 'admin_general' | 'case_leader' | 'lawyer_executive'

/**
 * Navigation item configuration
 */
interface NavItem {
  /** Display title in the sidebar */
  title: string
  /** Route path for the navigation link */
  href: string
  /** Icon component to display */
  icon: React.ComponentType<{ className?: string }>
  /** Required system roles to view this item (empty = visible to all internal users) */
  requiredRoles?: SystemRole[]
  /** Optional badge text (e.g., "Beta", "Nuevo") */
  badge?: string
}

/**
 * Navigation section grouping related items
 */
interface NavSection {
  /** Section label displayed above items */
  label: string
  /** Navigation items in this section */
  items: NavItem[]
  /** Required roles to see this entire section */
  requiredRoles?: SystemRole[]
}

/**
 * Complete navigation structure organized by functional areas
 * 
 * Sections are designed to separate:
 * - Operational: Day-to-day workflow (cases, clients, tasks)
 * - Documentation: Document and calendar management
 * - Communication: Internal collaboration tools
 * - Administration: System settings (admin only)
 */
const navigationSections: NavSection[] = [
  {
    label: 'Operacional',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Casos',
        href: '/casos',
        icon: Briefcase,
      },
      {
        title: 'Clientes',
        href: '/clientes',
        icon: Building2,
      },
      {
        title: 'Personas',
        href: '/personas',
        icon: Users,
      },
      {
        title: 'Tareas',
        href: '/tareas',
        icon: CheckSquare,
      },
      {
        title: 'Vencimientos',
        href: '/vencimientos',
        icon: Clock,
      },
    ],
  },
  {
    label: 'Documentación',
    items: [
      {
        title: 'Documentos',
        href: '/documentos',
        icon: FileText,
      },
      {
        title: 'Calendario',
        href: '/calendario',
        icon: Calendar,
      },
    ],
  },
  {
    label: 'Comunicación',
    items: [
      {
        title: 'Notas Internas',
        href: '/notas',
        icon: MessageSquare,
      },
  {
  title: 'Lexia',
  href: '/lexia',
  icon: Sparkles,
  badge: 'IA',
  },
      {
        title: 'Correo Rápido',
        href: '/herramientas/correo',
        icon: Mail,
      },
    ],
  },
  {
    label: 'Administración',
    requiredRoles: ['admin_general'],
    items: [
      {
        title: 'Usuarios',
        href: '/admin/usuarios',
        icon: UserCog,
        requiredRoles: ['admin_general'],
      },
      {
        title: 'Perfiles',
        href: '/admin/perfiles',
        icon: Users,
        requiredRoles: ['admin_general'],
      },
      {
        title: 'Portal Clientes',
        href: '/admin/portal',
        icon: ExternalLink,
        requiredRoles: ['admin_general'],
      },
      {
        title: 'Configuración',
        href: '/configuracion',
        icon: Settings,
        requiredRoles: ['admin_general'],
      },
    ],
  },
]

/**
 * Gets the user's initials for the avatar fallback
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

/**
 * Formats the system role for display in Spanish
 */
function formatRole(role: string): string {
  const roleLabels: Record<string, string> = {
    admin_general: 'Administrador',
    case_leader: 'Lider de caso',
    lawyer_executive: 'Abogado',
    client: 'Cliente',
  }
  return roleLabels[role] || role
}

/**
 * Main Application Sidebar Component
 * 
 * Renders the navigation sidebar with role-based visibility.
 * Adapts displayed sections and items based on user's system role.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { user, profile, isLoading, signOut } = useAuth()

  if (isLoading) {
    return (
      <Sidebar variant="sidebar" collapsible="icon">
        {/* Header */}
        <SidebarHeader className="border-b border-sidebar-border pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard" className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold tracking-tight">LegalHub</span>
                    <span className="text-xs text-muted-foreground">Gestión Legal</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Skeleton */}
        <SidebarContent className="scrollbar-thin">
          <SidebarGroup>
            <SidebarGroupLabel>Cargando…</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-3 px-2 py-2">
                      <div className="h-4 w-4 rounded bg-muted" />
                      <div className="h-4 w-32 rounded bg-muted" />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border" />
      </Sidebar>
    )
  }

  // Si terminó de cargar y NO hay user => no hay sesión
  if (!user) {
    return (
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard" className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold tracking-tight">LegalHub</span>
                    <span className="text-xs text-muted-foreground">Gestión Legal</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      </Sidebar>
    )
  }

  // ✅ Rol normalizado (si profile es null, userRole queda vacío y admin no se muestra)
  const userRole = (profile?.system_role || '').trim().toLowerCase() as SystemRole | ''

  const isNavItemVisible = (item: NavItem): boolean => {
    if (!item.requiredRoles || item.requiredRoles.length === 0) return true
    if (!userRole) return false
    return item.requiredRoles.includes(userRole as SystemRole)
  }

  const isSectionVisible = (section: NavSection): boolean => {
    if (!section.requiredRoles || section.requiredRoles.length === 0) return true
    if (!userRole) return false
    return section.requiredRoles.includes(userRole as SystemRole)
  }

  const isNavItemActive = (href: string): boolean => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      {/* Header with Logo and Firm Branding */}
      <SidebarHeader className="border-b border-sidebar-border pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Scale className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold tracking-tight">LegalHub</span>
                  <span className="text-xs text-muted-foreground">Gestión Legal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Navigation - Renders all visible sections */}
      <SidebarContent className="scrollbar-thin">
        {navigationSections.map((section, index) => {
          if (!isSectionVisible(section)) return null

          const visibleItems = section.items.filter(isNavItemVisible)
          if (visibleItems.length === 0) return null

          return (
            <React.Fragment key={section.label}>
              {index > 0 && <SidebarSeparator />}

              <SidebarGroup>
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isNavItemActive(item.href)}
                          tooltip={item.title}
                        >
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.title}</span>
                            {item.badge && (
                              <Badge
                                variant="secondary"
                                className="ml-auto text-[10px] px-1.5 py-0"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </React.Fragment>
          )
        })}
      </SidebarContent>

      {/* Footer with User Profile Menu */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={profile.avatar_url || undefined}
                      alt={profile.first_name || 'Usuario'}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(profile.first_name, profile.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {profile.first_name} {profile.last_name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatRole(profile.system_role)}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-56" side="top" align="start" sideOffset={8}>
                <DropdownMenuItem asChild>
                  <Link href="/perfil" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
