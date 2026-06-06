'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#1a1a2e'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          maxWidth: '480px'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#dc2626' }}>
            Произошла ошибка
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            При загрузке приложения произошла непредвиденная ошибка.
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
            {error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.875rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              marginRight: '0.5rem'
            }}
          >
            Попробовать снова
          </button>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
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
            Очистить и перезагрузить
          </button>
        </div>
      </body>
    </html>
  )
}

