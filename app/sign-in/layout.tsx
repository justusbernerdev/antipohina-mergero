import { Lora, Poppins } from 'next/font/google'
import '../dataflow/dataflow.css'

/** The same two faces the engine uses, so the door does not look like a different building. */
const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--d-sans',
})

const lora = Lora({ subsets: ['latin', 'latin-ext'], weight: ['400'], variable: '--d-serif' })

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <div className={`dataflow-scope ${poppins.variable} ${lora.variable}`}>{children}</div>
}
