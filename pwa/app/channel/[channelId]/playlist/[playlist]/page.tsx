// app/profile/page.tsx
'use client'

import { useAppContext } from "@/app/context/AppContext"




export default function PlaylistsPage() {
  const { user, handleLogout } = useAppContext()

  if (!user) return <p>Chargement...</p>

  return (
    <section>
      <h2>Shorts</h2>
      <p>{user.email}</p>
    </section>
  )
}