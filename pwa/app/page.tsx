'use client'
import { useAppContext } from "./context/AppContext"
import "./styles/login.css"

export default function HomePage() {
  const { user, loginWithGoogle } = useAppContext()

  if (!user) {
    return (
      <main className="auth-wrapper">
        <div className="auth-card">
          <h1>Bienvenue sur YT Simulator</h1>
          <button onClick={loginWithGoogle}>Se connecter avec Google</button>
        </div>
      </main>
    )
  }

  return (
    <section>
      <h1>Accueil</h1>
      <p>Contenu de l'accueil...</p>
    </section>
  )
}