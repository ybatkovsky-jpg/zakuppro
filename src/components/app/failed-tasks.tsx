'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { failedTasksApi } from '@/lib/api/failed-tasks'
import type { FailedTaskResponse } from '@/types/fastapi'
import {
  Eye,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// ── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd MMM yyyy, HH:mm', { locale: ru })
  } catch {
    return dateStr
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function parseContext(ctx: string | null | undefined): string {
  if (!ctx) return '—'
  try {
    return JSON.stringify(JSON.parse(ctx), null, 2)
  } catch {
    return ctx
  }
}

// ── Component ────────────────────────────────────────────────

export function FailedTasks() {
  const queryClient = useQueryClient()
  const { role } = useAuth()
  const isOwner = role === 'owner'

  // List query
  const [page, setPage] = useState(0)
  const pageSize = 20

  const {
    data: listData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['failed-tasks', { skip: page * pageSize, limit: pageSize }],
    queryFn: () => failedTasksApi.list({ skip: page * pageSize, limit: pageSize }),
  })

  const items = listData?.data?.items ?? []
  const total = listData?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Detail drawer state
  const [detailTask, setDetailTask] = useState<FailedTaskResponse | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function openDetail(task: FailedTaskResponse) {
    setDetailTask(task)
    setDrawerOpen(true)
  }

  function closeDetail() {
    setDrawerOpen(false)
    // Delay clearing to allow sheet close animation
    setTimeout(() => setDetailTask(null), 300)
  }

  // Retry confirmation dialog
  const [retryTask, setRetryTask] = useState<FailedTaskResponse | null>(null)

  const retryMutation = useMutation({
    mutationFn: (id: number) => failedTasksApi.retry(id),
    onSuccess: (result) => {
      if (result.error) {
        toast({ title: 'Ошибка', description: result.error.error, variant: 'destructive' })
      } else {
        toast({ title: 'Задача перезапущена', description: 'Задача отправлена в очередь Celery' })
        queryClient.invalidateQueries({ queryKey: ['failed-tasks'] })
        closeDetail()
      }
      setRetryTask(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
      setRetryTask(null)
    },
  })

  function handleRetry(task: FailedTaskResponse) {
    setRetryTask(task)
  }

  function confirmRetry() {
    if (retryTask) {
      retryMutation.mutate(retryTask.id)
    }
  }

  // ── Render helpers ─────────────────────────────────────────

  function renderSkeleton() {
    return Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skel-${i}`}>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
      </TableRow>
    ))
  }

  // ── Main render ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <XCircle className="size-5 text-destructive" />
            Неудачные задачи Celery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error state */}
          {isError && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="size-10 text-destructive mb-3" />
              <p className="text-sm font-medium text-destructive">
                {(error as Error)?.message || 'Ошибка загрузки данных'}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Повторить
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead>Задача</TableHead>
                  <TableHead>Ошибка</TableHead>
                  <TableHead className="w-[180px]">Создана</TableHead>
                  <TableHead className="w-[100px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderSkeleton()}</TableBody>
            </Table>
          )}

          {/* Empty state */}
          {!isLoading && !isError && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="size-10 text-emerald-500 mb-3" />
              <p className="text-sm font-medium">Нет неудачных задач</p>
              <p className="text-xs text-muted-foreground mt-1">
                Все задачи Celery выполняются успешно
              </p>
            </div>
          )}

          {/* Data table */}
          {!isLoading && !isError && items.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">ID</TableHead>
                    <TableHead>Задача</TableHead>
                    <TableHead>Ошибка</TableHead>
                    <TableHead className="w-[180px]">Создана</TableHead>
                    <TableHead className="w-[100px] text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {task.id}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={task.task_name}>
                        {truncate(task.task_name, 40)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {truncate(task.error_type, 30)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(task.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Детали"
                            onClick={() => openDetail(task)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={isOwner ? 'Перезапустить' : 'Требуются права владельца'}
                            disabled={!isOwner}
                            onClick={() => handleRetry(task)}
                          >
                            {retryMutation.isPending && retryTask?.id === task.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">
                    Всего: {total}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Назад
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Вперед
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet (drawer) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">Детали задачи</SheetTitle>
          </SheetHeader>
          {detailTask && (
            <div className="space-y-4 py-2">
              {/* Labeled fields */}
              <div>
                <span className="text-xs font-medium text-muted-foreground">Задача</span>
                <p className="text-sm mt-0.5">{detailTask.task_name}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground">Тип ошибки</span>
                <p className="mt-0.5">
                  <Badge variant="outline">{detailTask.error_type}</Badge>
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground">Task ID</span>
                <p className="text-sm font-mono text-xs mt-0.5 break-all">{detailTask.task_id}</p>
              </div>

              {detailTask.file_path && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Файл</span>
                  <p className="text-sm font-mono text-xs mt-0.5 break-all">{detailTask.file_path}</p>
                </div>
              )}

              {detailTask.chat_id != null && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Chat ID</span>
                  <p className="text-sm font-mono text-xs mt-0.5">{detailTask.chat_id}</p>
                </div>
              )}

              <div>
                <span className="text-xs font-medium text-muted-foreground">Создана</span>
                <p className="text-sm mt-0.5">{formatDate(detailTask.created_at)}</p>
              </div>

              {/* Error message */}
              <div>
                <span className="text-xs font-medium text-muted-foreground">Сообщение об ошибке</span>
                <pre className="mt-1 text-xs bg-muted rounded-md p-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                  {detailTask.error_message}
                </pre>
              </div>

              {/* Context JSON */}
              <div>
                <span className="text-xs font-medium text-muted-foreground">Контекст задачи</span>
                <pre className="mt-1 text-xs bg-muted rounded-md p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {parseContext(detailTask.context)}
                </pre>
              </div>

              {/* Retry button in drawer footer */}
              <div className="pt-2 border-t">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2"
                  disabled={!isOwner || retryMutation.isPending}
                  onClick={() => handleRetry(detailTask)}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Перезапустить задачу
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Retry confirmation dialog */}
      <AlertDialog open={!!retryTask} onOpenChange={(open) => { if (!open) setRetryTask(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перезапустить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Задача <span className="font-mono text-xs">{retryTask?.task_name}</span> будет
              повторно отправлена в очередь Celery. При успешном выполнении запись будет удалена
              из списка.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={retryMutation.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={retryMutation.isPending}
              onClick={confirmRetry}
            >
              {retryMutation.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
              Перезапустить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
