'use client'

import { SignUp } from '@clerk/nextjs'

/**
 * Registration, open for now.
 *
 * Deliberately unrestricted while the engine is being shown around: the cost of a stranger seeing
 * the list is low, and the cost of a demo blocked on an invitation is not. Narrowing it later is
 * one rule in the middleware and one setting in Clerk, and the note below says so out loud rather
 * than leaving anyone to assume this is how it will stay.
 */

const ACC = '#0028ff'

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#fff',
        color: '#111',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 44px' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Originaatio</span>
          <span style={{ fontWeight: 400, color: '#8a8a8a' }}>×</span>
          <span style={{ color: ACC }}>Mergero</span>
        </span>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          gap: 'clamp(32px,6vw,80px)',
          alignItems: 'center',
          padding: '0 44px 8vh',
          maxWidth: 1100,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ maxWidth: '40ch' }}>
          <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8a8a8a' }}>
            Off-market origination
          </div>
          <h1
            style={{
              fontFamily: 'var(--d-serif),Georgia,serif',
              fontSize: 'clamp(26px,3.4vw,40px)',
              fontWeight: 400,
              lineHeight: 1.18,
              letterSpacing: '-.01em',
              margin: '10px 0 14px',
            }}
          >
            Luo tunnus ja katso mitä moottori löysi.
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#555', margin: 0, textWrap: 'pretty' }}>
            Rekisteröityminen on toistaiseksi auki kaikille. Sisällä on lista nimettyjä yksityisiä
            yhtiöitä ja perustelut jokaisen kohdalle, joten rajaus tulee myöhemmin.
          </p>
          <div style={{ marginTop: 20, display: 'grid', gap: 6, fontSize: 12.5, color: '#555' }}>
            {['Sähköposti riittää', 'Suomi ja Norja ajossa', 'Mikään ei lähde ilman ihmistä'].map(
              (line) => (
                <div key={line} style={{ display: 'flex', gap: 9 }}>
                  <span style={{ color: ACC, fontWeight: 600 }}>✓</span>
                  <span>{line}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <div style={{ justifySelf: 'center' }}>
          <SignUp
            appearance={{
              variables: {
                colorPrimary: ACC,
                colorBackground: '#ffffff',
                borderRadius: '4px',
                fontFamily: 'var(--d-sans), system-ui, sans-serif',
                fontSize: '13px',
              },
              elements: {
                rootBox: { width: '100%' },
                cardBox: { boxShadow: 'none', border: '1px solid rgba(0,0,0,.1)', borderRadius: 4 },
                card: { boxShadow: 'none', padding: '28px 26px' },
                headerTitle: { fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' },
                headerSubtitle: { fontSize: 12.5, color: '#8a8a8a' },
                formButtonPrimary: {
                  background: ACC,
                  fontSize: 12.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  boxShadow: 'none',
                },
                formFieldInput: { border: '1px solid rgba(0,0,0,.15)', boxShadow: 'none' },
                formFieldLabel: { fontSize: 11.5, color: '#555' },
                footer: { background: 'transparent' },
                footerActionText: { fontSize: 12 },
                footerActionLink: { fontSize: 12, color: ACC },
                socialButtonsBlockButton: { border: '1px solid rgba(0,0,0,.15)', boxShadow: 'none' },
                dividerLine: { background: 'rgba(0,0,0,.1)' },
                dividerText: { fontSize: 11, color: '#8a8a8a' },
                identityPreviewEditButton: { color: ACC },
                formResendCodeLink: { color: ACC },
                otpCodeFieldInput: { border: '1px solid rgba(0,0,0,.15)' },
              },
            }}
          />
        </div>
      </div>
    </main>
  )
}
