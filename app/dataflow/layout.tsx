import { Lora, Poppins } from 'next/font/google'
import Provider from './provider'
import './dataflow.css'

/**
 * Own typography, own scope. Fonts are self-hosted by next/font because this view has to render
 * at a demo with no guarantee of network.
 */
const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--d-sans',
})

const lora = Lora({ subsets: ['latin', 'latin-ext'], weight: ['400'], variable: '--d-serif' })

export default function DataflowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`dataflow-scope ${poppins.variable} ${lora.variable}`}>
      <Provider>{children}</Provider>
    </div>
  )
}
