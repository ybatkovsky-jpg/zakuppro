'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: '#dc2626' }}>
          Ошибка загрузки страницы
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          Не удалось загрузить содержимое. Попробуйте обновить страницу.
        </p>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
          {error?.message || 'Неизвестная ошибка'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.875rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            Попробовать снова
          </button>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.875rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            На главную
          </button>
        </div>
      </div>
    </div>
  )
}

