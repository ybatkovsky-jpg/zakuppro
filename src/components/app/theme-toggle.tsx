'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themes = [
  { value: 'light', label: 'Светлая', icon: Sun, desc: 'Светлый интерфейс' },
  { value: 'dark', label: 'Тёмная', icon: Moon, desc: 'Тёмный интерфейс' },
  { value: 'system', label: 'Системная', icon: Monitor, desc: 'Как в системе' },
] as const

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 relative overflow-hidden"
          type="button"
        >
          {/* Sun icon */}
          <Sun className="size-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
          {/* Moon icon */}
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Переключить тему</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Внешний вид
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((t) => {
          const Icon = t.icon
          const isActive = theme === t.value
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
              type="button"
            >
              <div className={`size-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/50 text-muted-foreground'
              }`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.desc}</div>
              </div>
              {isActive && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className={`size-2 rounded-full ${
              mounted && resolvedTheme === 'dark'
                ? 'bg-slate-700'
                : 'bg-amber-400'
            }`} />
            Активна: {mounted ? (resolvedTheme === 'dark' ? 'тёмная' : 'светлая') : '...'}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
