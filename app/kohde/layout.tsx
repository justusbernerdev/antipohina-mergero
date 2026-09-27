import Provider from '../dataflow/provider'

/** The owner's page reads the engine's store directly, so it needs the same client. */
export default function KohdeLayout({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}
