// app/profile/page.tsx
'use client'

import { useAppContext } from "../context/AppContext"


export default function ShortsPage() {
  const { user, handleLogout } = useAppContext()

  if (!user) return <p>Chargement...</p>

  return (
    <section>
      <h2>Shorts</h2>
      <p>{user.email}</p>
    </section>
  )
}