// app/channel/[channelId]/page.tsx
'use client'
import { useEffect } from 'react'
import { useAppContext } from '@/app/context/AppContext'
import { useParams } from 'next/navigation' // useParams est mieux pour [channelId]

export default function ChannelPage() {
  const params = useParams()
  const channelId = params.channelId as string
  const { fetchVideosForChannel, selectedChannel } = useAppContext()

  useEffect(() => {
    if (channelId) {
      // On déclenche le chargement des vidéos
      fetchVideosForChannel(channelId)
    }
  }, [channelId])

  return (
    // On utilise la classe .tab-content définie dans votre CSS
    <main className="tab-content">
      <h1 className="tab-title">
        {selectedChannel?.title || "Chargement de la chaîne..."}
      </h1>
      
      {/* Ici viendra le contenu de votre grille de vidéos */}
      <div className="video-grid">
         {/* Votre mapping de vidéos ici */}
      </div>
    </main>
  )
}