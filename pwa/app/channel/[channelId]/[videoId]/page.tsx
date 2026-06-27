'use client'
import { useParams } from 'next/navigation'
import "@/app/styles/video-player.css"

export default function VideoPage() {
  const { videoId } = useParams()

  return (
    <div className="video-watch-page">
      {/* Colonne de gauche (Lecteur + Infos) */}
      <main className="video-left-column">
        <div className="video-player-container">
          <iframe 
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} 
            allowFullScreen 
          />
        </div>
        <div className="video-info">
          <h1>Titre de la vidéo</h1>
          <div className="video-meta">714 k vues • il y a 1 an</div>
          <div className="description-box">
             {/* Ici votre composant description/commentaires */}
             <p>Description ici...</p>
          </div>
        </div>
      </main>

      {/* Colonne de droite (Suggestions) */}
      <aside className="video-sidebar">
        <h3>Vidéos suggérées</h3>
        {/* Mapping de vos vidéos suggérées ici */}
        <div className="suggestion-card">Vidéo suggérée 1</div>
        <div className="suggestion-card">Vidéo suggérée 2</div>
      </aside>
    </div>
  )
}