// app/profile/page.tsx
'use client'

import { useAppContext } from "@/app/context/AppContext"




export default function VideoPage() {
  const { user, handleLogout } = useAppContext()

  if (!user) return <p>Chargement...</p>

  return (
    <section>
      <h2>Video de la chaine</h2>
    </section>
  )
}