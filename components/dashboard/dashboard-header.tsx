/**
 * Dashboard Header
 * 
 * Top header component for the dashboard.
 * Contains sidebar trigger, search, and quick actions.
 */
'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Plus, 
  Command,
  User,
  LogOut,
  Settings,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/hooks/use-auth'
import { ThemeSwitcher } from '@/components/theme/theme-switcher'
import { NotificationsPopover } from '@/components/notifications/notifications-popover'

interface DashboardHeaderProps {
  /** Page title to display */
  title?: string
  /** Optional description below the title */
  description?: string
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const router = useRouter()
  // Usamos una sola instancia de useAuth para evitar estados duplicados/inconsistentes
  const { permissions, user, profile, signOut } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const userInitials = `${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`.toUpperCase()

  /**
   * Handles the global search submission
   */
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Sidebar Toggle */}
      <SidebarTrigger className="-ml-1" />
      
      <Separator orientation="vertical" className="h-6" />

      {/* Page Title (if provided) */}
      {title && (
        <div className="hidden md:block">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-1 items-center justify-end gap-2 md:justify-center">
        <form onSubmit={handleSearch} className="w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar casos, clientes, tareas..."
              className="h-9 w-full rounded-lg bg-muted/50 pl-9 pr-12 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Quick Add Dropdown */}
        {(permissions.can_create_cases || permissions.can_create_clients) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 bg-transparent">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Crear nuevo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {permissions.can_create_cases && (
                <DropdownMenuItem onClick={() => router.push('/casos/nuevo')}>
                  Nuevo Caso
                </DropdownMenuItem>
              )}
              {permissions.can_create_clients && (
                <DropdownMenuItem onClick={() => router.push('/clientes/nuevo')}>
                  Nuevo Cliente
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/tareas/nueva')}>
                Nueva Tarea
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <NotificationsPopover />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs font-semibold">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Abrir menú de usuario</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="font-medium text-sm">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/configuracion')}>
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
