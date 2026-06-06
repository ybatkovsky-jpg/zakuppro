'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, Sparkles, TrendingUp, Search, FolderKanban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/auth-fetch'
import { Textarea } from '@/components/ui/textarea'
import { useMutation } from '@tanstack/react-query'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_ACTIONS = [
  { label: 'Анализ бюджета', icon: TrendingUp, prompt: 'Проведи анализ текущих бюджетов проектов. Какие проекты имеют перерасход? Какие рекомендации по оптимизации?' },
  { label: 'Найти поставщика', icon: Search, prompt: 'Мне нужно найти надёжного поставщика. Какие критерии отбора рекомендуешь? Как оценить надёжность поставщика мебели и материалов?' },
  { label: 'Оптимизация затрат', icon: Sparkles, prompt: 'Предложи способы оптимизации затрат на закупках для мебельного производства. На чём можно сэкономить без потери качества?' },
  { label: 'Статус проектов', icon: FolderKanban, prompt: 'Расскажи, как правильно отслеживать статусы проектов закупок. Какие есть этапы и на что обращать внимание при переходе между статусами?' },
]

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Здравствуйте! Я ИИ-ассистент ПРОМЕБЕЛЬ. Помогу с управлением закупками, анализом бюджетов, выбором поставщиков и оптимизацией процессов. Чем могу помочь?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const sendMessage = useMutation({
    mutationFn: async (chatMessages: ChatMessage[]) => {
      const res = await authFetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages }),
      })
      if (!res.ok) throw new Error('Ошибка при отправке сообщения')
      return res.json()
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response, timestamp: new Date() }])
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Извините, произошла ошибка при обработке запроса. Попробуйте ещё раз.', timestamp: new Date() },
      ])
    },
  })

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || sendMessage.isPending) return

    const userMessage: Message = { role: 'user', content: trimmed, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    const chatMessages: ChatMessage[] = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))
    sendMessage.mutate(chatMessages)
  }, [input, messages, sendMessage])

  const handleQuickAction = useCallback(
    (prompt: string) => {
      if (sendMessage.isPending) return

      const userMessage: Message = { role: 'user', content: prompt, timestamp: new Date() }
      setMessages((prev) => [...prev, userMessage])

      const chatMessages: ChatMessage[] = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      sendMessage.mutate(chatMessages)
    },
    [messages, sendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sendMessage.isPending])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow cursor-pointer animate-pulse-glow"
            aria-label="Открыть ИИ-ассистент"
          >
            <Bot className="w-6 h-6" />
            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col w-[400px] h-[500px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-3rem)] rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">ИИ-Ассистент</h3>
                  <p className="text-xs text-muted-foreground">ПРОМЕБЕЛЬ</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть чат"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'hsl(var(--border)) transparent',
              }}
            >
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index === messages.length - 1 ? 0.1 : 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                        : 'bg-muted rounded-2xl rounded-bl-md'
                    } px-3.5 py-2.5 text-sm leading-relaxed`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 dark:bg-primary/20 shrink-0">
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Ассистент</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    {message.timestamp && (
                      <div className={`text-[10px] mt-1.5 ${message.role === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`}>
                        {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {sendMessage.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 dark:bg-primary/20 shrink-0">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-0.5">Печатает...</span>
                  </div>
                </motion.div>
              )}

              {/* Quick Actions (show only when few messages) */}
              {messages.length <= 1 && !sendMessage.isPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <p className="text-xs text-muted-foreground text-center">Быстрые действия</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <motion.button
                        key={action.label}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleQuickAction(action.prompt)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors text-center cursor-pointer"
                      >
                        <action.icon className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium leading-tight">{action.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t bg-background/80 backdrop-blur-sm p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Введите вопрос..."
                  className="min-h-[40px] max-h-[120px] resize-none text-sm rounded-xl border-border focus-visible:ring-primary/30"
                  rows={1}
                  disabled={sendMessage.isPending}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || sendMessage.isPending}
                  className="h-10 w-10 rounded-xl shrink-0"
                  aria-label="Отправить сообщение"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
                Enter — отправить, Shift+Enter — новая строка
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
