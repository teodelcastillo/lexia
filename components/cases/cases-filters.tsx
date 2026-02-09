/**
 * Cases Filters Component
 * 
 * Filter controls for the cases list page.
 * Updates URL search params for server-side filtering.
 */
'use client'

import React from "react"

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface CasesFiltersProps {
  currentStatus?: string
  currentPriority?: string
  currentSearch?: string
}

/**
 * Status options for filtering
 */
const statusOptions = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'on_hold', label: 'En Espera' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'archived', label: 'Archivado' },
]

/**
 * Priority options for filtering
 */
const priorityOptions = [
  { value: 'all', label: 'Todas las prioridades' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

export function CasesFilters({ 
  currentStatus, 
  currentPriority, 
  currentSearch 
}: CasesFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(currentSearch || '')

  /**
   * Updates URL with new search params
   */
  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    // Reset to page 1 when filters change
    params.delete('page')

    startTransition(() => {
      router.push(`/casos?${params.toString()}`)
    })
  }, [router, searchParams])

  /**
   * Handles search form submission
   */
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    updateFilters({ search: searchValue })
  }

  /**
   * Clears all filters
   */
  const clearFilters = () => {
    setSearchValue('')
    startTransition(() => {
      router.push('/casos')
    })
  }

  // Count active filters
  const activeFiltersCount = [currentStatus, currentPriority, currentSearch].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Main Filter Row */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por número, título o cliente..."
              className="pl-9"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            Buscar
          </Button>
        </form>

        {/* Status Filter */}
        <Select
          value={currentStatus || 'all'}
          onValueChange={(value) => updateFilters({ status: value })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select
          value={currentPriority || 'all'}
          onValueChange={(value) => updateFilters({ priority: value })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtros activos:</span>
          
          {currentStatus && (
            <Badge variant="secondary" className="gap-1">
              Estado: {statusOptions.find(o => o.value === currentStatus)?.label}
              <button
                onClick={() => updateFilters({ status: null })}
                className="ml-1 hover:text-foreground"
                aria-label="Quitar filtro de estado"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {currentPriority && (
            <Badge variant="secondary" className="gap-1">
              Prioridad: {priorityOptions.find(o => o.value === currentPriority)?.label}
              <button
                onClick={() => updateFilters({ priority: null })}
                className="ml-1 hover:text-foreground"
                aria-label="Quitar filtro de prioridad"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {currentSearch && (
            <Badge variant="secondary" className="gap-1">
              Búsqueda: {`"${currentSearch}"`}
              <button
                onClick={() => {
                  setSearchValue('')
                  updateFilters({ search: null })
                }}
                className="ml-1 hover:text-foreground"
                aria-label="Quitar búsqueda"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 text-xs"
          >
            Limpiar todos
          </Button>
        </div>
      )}
    </div>
  )
}
