'use client'

import { useAppContext } from "./context/AppContext"


export default function HomePage() {
  const { user, loginWithGoogle } = useAppContext()

  if (!user) {
    return (
      <main className="auth-wrapper">
        <div className="auth-card">
          <div className="site-brand"><span>🔻</span> YT Premium Simulator</div>
          <button onClick={loginWithGoogle} className="btn-google">Se connecter</button>
        </div>
      </main>
    )
  }

  return (
    <section>
      <h2 className="tab-title">Accueil</h2>
      <p>Bienvenue sur votre simulateur YouTube.</p>
    </section>
  )
}