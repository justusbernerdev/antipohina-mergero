import { SignIn } from '@clerk/nextjs'

/**
 * The internal view is behind this. The owner's page is not, and that separation is the whole
 * product decision: what the deal team sees is gated, what gets sent to an owner is open.
 */
export default function SignInPage() {
  return (
    <main
      className="wrap"
      style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 28 }}
    >
      <div style={{ textAlign: 'center' }}>
        <span className="kick">antipöhinä × Mergero</span>
        <h1 style={{ margin: '8px 0 6px' }}>Off-market origination</h1>
        <p className="dim" style={{ margin: 0 }}>
          Sisäinen näkymä. Omistajalle lähtevä sivu on julkinen eikä vaadi kirjautumista.
        </p>
      </div>
      <SignIn />
    </main>
  )
}
