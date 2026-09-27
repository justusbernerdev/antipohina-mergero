import { redirect } from 'next/navigation'

/**
 * There is one product and it lives at /dataflow. The earlier list view read a snapshot committed
 * into the repository, which stopped being true the moment the engine started running for real.
 */
export default function Home() {
  redirect('/dataflow')
}
