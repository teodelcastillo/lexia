/**
 * Portal Header Component
 * 
 * Header for the client portal with navigation and user menu.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale, LogOut, User, FileText, Briefcase, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface PortalHeaderProps {
  userName: string
}

/** Navigation items for the client portal */
const portalNavItems = [
  {
    title: 'Mis Casos',
    href: '/portal',
    icon: Briefcase,
  },
  {
    title: 'Documentos',
    href: '/portal/documentos',
    icon: FileText,
  },
  {
    title: 'Ayuda',
    href: '/portal/ayuda',
    icon: HelpCircle,
  },
]

/** Gets initials from a name string */
function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return parts[0]?.charAt(0)?.toUpperCase() || 'C'
}

export function PortalHeader({ userName }: PortalHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  /** Handles sign out */
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/portal-login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/portal" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight">LegalHub</span>
              <span className="text-xs text-muted-foreground">
                Portal de Clientes
              </span>
            </div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {portalNavItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/portal' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                    transition-colors
                    ${isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            })}
          </nav>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">
                  {userName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/portal/perfil" className="flex items-center gap-2">
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
        </div>

        {/* Navigation - Mobile */}
        <nav className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
          {portalNavItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/portal' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                  transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
