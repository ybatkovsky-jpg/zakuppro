'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

interface SearchResult {
  id: string
  name: string
  type: 'project' | 'supplier' | 'warehouse'
  extra?: string
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { navigate, navigateToProject } = useAppStore()

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Fetch search results
  const { data: projectResults = [] } = useQuery<SearchResult[]>({
    queryKey: ['search-projects', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const res = await fetch(`/api/projects?search=${encodeURIComponent(query)}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.map((p: { id: string; name: string; customerName: string }) => ({
        id: p.id,
        name: p.name,
        type: 'project' as const,
        extra: p.customerName || undefined,
      }))
    },
    enabled: query.length >= 2,
  })

  const { data: supplierResults = [] } = useQuery<SearchResult[]>({
    queryKey: ['search-suppliers', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const res = await fetch(`/api/suppliers?search=${encodeURIComponent(query)}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.map((s: { id: string; name: string; contactPerson: string }) => ({
        id: s.id,
        name: s.name,
        type: 'supplier' as const,
        extra: s.contactPerson || undefined,
      }))
    },
    enabled: query.length >= 2,
  })

  const { data: warehouseResults = [] } = useQuery<SearchResult[]>({
    queryKey: ['search-warehouse', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const res = await fetch(`/api/warehouse?search=${encodeURIComponent(query)}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.map((w: { id: string; name: string; category: string }) => ({
        id: w.id,
        name: w.name,
        type: 'warehouse' as const,
        extra: w.category || undefined,
      }))
    },
    enabled: query.length >= 2,
  })

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      setQuery('')
      switch (result.type) {
        case 'project':
          navigateToProject(result.id)
          break
        case 'supplier':
          navigate('suppliers')
          break
        case 'warehouse':
          navigate('warehouse')
          break
      }
    },
    [navigate, navigateToProject],
  )

  const hasResults = projectResults.length > 0 || supplierResults.length > 0 || warehouseResults.length > 0

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-muted-foreground transition-all hover:shadow-sm"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Поиск...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen)
          if (!isOpen) setQuery('')
        }}
        title="Глобальный поиск"
        description="Ищите проекты, поставщиков, складские позиции"
      >
        <CommandInput
          placeholder="Поиск..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length >= 2 && !hasResults && (
            <CommandEmpty>Ничего не найдено</CommandEmpty>
          )}
          {projectResults.length > 0 && (
            <CommandGroup heading="Проекты">
              {projectResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={`project-${result.name}`}
                  onSelect={() => handleSelect(result)}
                >
                  <Search className="size-4 mr-2 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{result.name}</span>
                    {result.extra && (
                      <span className="text-xs text-muted-foreground">{result.extra}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {supplierResults.length > 0 && (
            <CommandGroup heading="Поставщики">
              {supplierResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={`supplier-${result.name}`}
                  onSelect={() => handleSelect(result)}
                >
                  <Search className="size-4 mr-2 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{result.name}</span>
                    {result.extra && (
                      <span className="text-xs text-muted-foreground">{result.extra}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {warehouseResults.length > 0 && (
            <CommandGroup heading="Склад">
              {warehouseResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={`warehouse-${result.name}`}
                  onSelect={() => handleSelect(result)}
                >
                  <Search className="size-4 mr-2 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{result.name}</span>
                    {result.extra && (
                      <span className="text-xs text-muted-foreground">{result.extra}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
