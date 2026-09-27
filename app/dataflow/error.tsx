'use client'

/**
 * A rejected Convex query throws inside render, and without a boundary Next.js unmounts the tree
 * and leaves a white page that no reload fixes because the cause is the session, not the paint.
 * This turns that into a sentence and a retry.
 */
export default function DataflowError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 44,
        textAlign: 'center',
        background: '#ffffff',
        color: '#111111',
        fontSize: 13,
      }}
    >
      <strong style={{ fontSize: 14 }}>Moottori ei vastannut</strong>
      <span
        style={{
          color: '#8a8a8a',
          maxWidth: 560,
          lineHeight: 1.55,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11.5,
          wordBreak: 'break-word',
        }}
      >
        {error.message}
      </span>
      <button
        onClick={reset}
        style={{
          marginTop: 6,
          border: '1px solid rgba(0,0,0,.18)',
          background: '#fff',
          borderRadius: 3,
          padding: '6px 12px',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Yritä uudelleen
      </button>
    </div>
  )
}
