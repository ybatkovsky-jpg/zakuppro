'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  FolderKanban,
  Truck,
  Receipt,
  Package,
  FileText,
  Clock,
  X,
  ArrowRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ──────────────────────────────────────────────────────

interface SearchResultItem {
  id: string
  name: string
  type: 'project' | 'supplier' | 'invoice' | 'warehouse' | 'request'
  extra: string
  context: string
  status?: string
}

interface RecentSearch {
  query: string
  timestamp: number
}

// ── Constants ──────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  label: string
  icon: typeof FolderKanban
  color: string
  bgColor: string
  hoverColor: string
}> = {
  project: {
    label: 'Проекты',
    icon: FolderKanban,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    hoverColor: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
  supplier: {
    label: 'Поставщики',
    icon: Truck,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    hoverColor: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  invoice: {
    label: 'Счета',
    icon: Receipt,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/40',
    hoverColor: 'hover:bg-violet-50 dark:hover:bg-violet-900/20',
  },
  warehouse: {
    label: 'Склад',
    icon: Package,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-100 dark:bg-sky-900/40',
    hoverColor: 'hover:bg-sky-50 dark:hover:bg-sky-900/20',
  },
  request: {
    label: 'Запросы',
    icon: FileText,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/40',
    hoverColor: 'hover:bg-rose-50 dark:hover:bg-rose-900/20',
  },
}

const SUGGESTIONS = [
  'ДСП 16мм',
  'МДФ профиль',
  'Фурнитура',
  'Поролон',
  'Ткань обивочная',
  'Петля накладная',
]

const RECENT_SEARCHES_KEY = 'promebel-recent-searches'
const MAX_RECENT = 8

// ── Helpers ────────────────────────────────────────────────────

function loadRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = loadRecentSearches()
    const filtered = existing.filter(s => s.query !== query)
    const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // ignore
  }
}

function clearRecentSearches() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // ignore
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `${days} дн. назад`
}

// ── Component ──────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { navigate, navigateToProject, navigateToSupplier } = useAppStore()

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

  // Refresh recent searches when dialog opens
  useEffect(() => {
    if (open) {
      const stored = loadRecentSearches()
      requestAnimationFrame(() => setRecentSearches(stored))
    }
  }, [open])

  // Fetch unified search results
  const { data: searchData, isLoading: isSearching } = useQuery<{
    results: SearchResultItem[]
    categories: string[]
  }>({
    queryKey: ['global-search', query, activeCategory],
    queryFn: async () => {
      if (!query || query.length < 1) return { results: [], categories: [] }
      const params = new URLSearchParams({ q: query })
      if (activeCategory) params.set('category', activeCategory)
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) return { results: [], categories: [] }
      return res.json()
    },
    enabled: query.length >= 1,
  })

  const results = searchData?.results ?? []
  const resultCategories = searchData?.categories ?? []

  // Group results by category
  const groupedResults = resultCategories.reduce<Record<string, SearchResultItem[]>>((acc, cat) => {
    acc[cat] = results.filter(r => r.type === cat)
    return acc
  }, {})

  const hasResults = results.length > 0
  const showRecent = !query && recentSearches.length > 0
  const showSuggestions = !query && recentSearches.length === 0

  // Navigate to result
  const handleSelect = useCallback(
    (result: SearchResultItem) => {
      setOpen(false)
      saveRecentSearch(query || result.name)
      setQuery('')

      switch (result.type) {
        case 'project':
          navigateToProject(result.id)
          break
        case 'supplier':
          navigateToSupplier(result.id)
          break
        case 'invoice':
          navigate('invoices')
          break
        case 'warehouse':
          navigate('warehouse')
          break
        case 'request':
          navigate('requests')
          break
      }
    },
    [navigate, navigateToProject, navigateToSupplier, query],
  )

  // Handle recent search click
  const handleRecentClick = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
  }, [])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion)
  }, [])

  // Handle clear recent
  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setRecentSearches([])
  }, [])

  // Category icon renderer
  const CategoryIcon = ({ type, className }: { type: string; className?: string }) => {
    const config = CATEGORY_CONFIG[type]
    if (!config) return <Search className={className || "size-4"} />
    const Icon = config.icon
    return <Icon className={className || "size-4"} />
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-muted-foreground transition-all hover:shadow-sm hover:border-primary/30"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Поиск...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-[9px]">Ctrl</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen)
          if (!isOpen) {
            setQuery('')
            setActiveCategory(null)
          }
        }}
        title="Глобальный поиск"
        description="Ищите проекты, поставщиков, счета, складские позиции, запросы"
      >
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <CommandInput
            ref={inputRef}
            placeholder="Поиск по названию, артикулу, контрагенту..."
            value={query}
            onValueChange={setQuery}
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 border-b px-3 py-2 overflow-x-auto">
          <Button
            variant={activeCategory === null ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5 shrink-0"
            onClick={() => setActiveCategory(null)}
          >
            <Search className="size-3" />
            Все
          </Button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const Icon = config.icon
            const count = groupedResults[key]?.length ?? 0
            const isActive = activeCategory === key
            return (
              <Button
                key={key}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs gap-1.5 shrink-0 ${isActive ? config.color : ''}`}
                onClick={() => setActiveCategory(isActive ? null : key)}
              >
                <Icon className="size-3" />
                {config.label}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {count}
                  </Badge>
                )}
              </Button>
            )
          })}
        </div>

        {/* Results */}
        <CommandList className="max-h-[400px]">
          {/* Recent Searches */}
          <AnimatePresence mode="wait">
            {showRecent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <CommandGroup heading={
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3" />
                      Недавние запросы
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={handleClearRecent}
                    >
                      <RotateCcw className="size-2.5 mr-1" />
                      Очистить
                    </Button>
                  </div>
                }>
                  {recentSearches.map((search) => (
                    <CommandItem
                      key={search.query}
                      value={`recent-${search.query}`}
                      onSelect={() => handleRecentClick(search.query)}
                      className="gap-3 cursor-pointer"
                    >
                      <Clock className="size-3.5 text-muted-foreground/50" />
                      <span className="text-sm flex-1">{search.query}</span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatTimeAgo(search.timestamp)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggestions (when no query and no recent) */}
          <AnimatePresence mode="wait">
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <CommandGroup heading={
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3" />
                    Попробуйте найти
                  </span>
                }>
                  {SUGGESTIONS.map((suggestion) => (
                    <CommandItem
                      key={suggestion}
                      value={`suggestion-${suggestion}`}
                      onSelect={() => handleSuggestionClick(suggestion)}
                      className="gap-3 cursor-pointer"
                    >
                      <Search className="size-3.5 text-muted-foreground/50" />
                      <span className="text-sm">{suggestion}</span>
                      <ArrowRight className="size-3 text-muted-foreground/30 ml-auto" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Results by Category */}
          {hasResults && resultCategories.map((category) => {
            const config = CATEGORY_CONFIG[category]
            if (!config) return null
            const Icon = config.icon
            const categoryResults = groupedResults[category] ?? []

            return (
              <CommandGroup
                key={category}
                heading={
                  <span className={`flex items-center gap-1.5 ${config.color}`}>
                    <Icon className="size-3.5" />
                    {config.label}
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                      {categoryResults.length}
                    </Badge>
                  </span>
                }
              >
                {categoryResults.map((result, idx) => (
                  <CommandItem
                    key={result.id}
                    value={`${category}-${result.name}-${idx}`}
                    onSelect={() => handleSelect(result)}
                    className={`gap-3 cursor-pointer ${config.hoverColor}`}
                  >
                    {/* Category Icon */}
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}>
                      <Icon className={`size-4 ${config.color}`} />
                    </div>

                    {/* Result Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{result.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {result.extra && (
                          <span className="text-xs text-muted-foreground truncate">{result.extra}</span>
                        )}
                        {result.extra && result.context && (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                        {result.context && (
                          <span className="text-xs text-muted-foreground truncate">{result.context}</span>
                        )}
                      </div>
                    </div>

                    {/* Navigate Arrow */}
                    <ArrowRight className="size-3.5 text-muted-foreground/30 shrink-0 opacity-0 group-aria-selected:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}

          {/* No Results State */}
          {query.length >= 1 && !isSearching && !hasResults && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                  <Search className="size-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Ничего не найдено</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    По запросу &laquo;{query}&raquo; ничего не найдено
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {SUGGESTIONS.slice(0, 3).map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setQuery(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </CommandEmpty>
          )}

          {/* Loading indicator */}
          {isSearching && query.length >= 1 && (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Поиск...
              </div>
            </div>
          )}
        </CommandList>

        {/* Footer with keyboard hints */}
        <div className="border-t px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">↑↓</kbd>
            навигация
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">↵</kbd>
            выбрать
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">Esc</kbd>
            закрыть
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">Ctrl</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">K</kbd>
            поиск
          </span>
        </div>
      </CommandDialog>
    </>
  )
}
