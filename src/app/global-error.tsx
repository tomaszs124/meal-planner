'use client'

/**
 * Last-resort boundary for errors thrown inside the root layout itself.
 * Must render its own <html>/<body> because the layout is not available.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pl">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f9fafb', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 380, width: '100%', background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', border: '1px solid #e5e7eb' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#111827' }}>Aplikacja napotkała błąd</h1>
            <p style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>
              Spróbuj ponownie. Jeśli to nie pomoże, odśwież stronę.
            </p>
            {error.digest && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Kod błędu: {error.digest}</p>}
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 20, background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              Spróbuj ponownie
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
