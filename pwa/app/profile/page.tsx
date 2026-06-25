// app/profile/page.tsx
'use client'

import { useAppContext } from "../context/AppContext"


export default function ProfilePage() {
  const { user, handleLogout } = useAppContext()

  if (!user) return <p>Chargement...</p>

  return (
    <section>
      <h2>Mon Profil</h2>
      <p>{user.email}</p>
      <button onClick={handleLogout}>Se déconnecter</button>
    </section>
  )
}