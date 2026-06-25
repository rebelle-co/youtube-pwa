// app/api/classify-videos/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { videoIds } = await request.json()
    if (!Array.isArray(videoIds)) {
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
    }

    // On vérifie toutes les vidéos en parallèle pour un maximum de performance
    const classifications = await Promise.all(
      videoIds.map(async (id: string) => {
        try {
          const res = await fetch(`https://www.youtube.com/shorts/${id}`, {
            method: 'HEAD',
            redirect: 'manual', // Empêche de suivre la redirection automatiquement
          })
          
          // L'ajout de "as const" ici force TypeScript à garder les types littéraux 'shorts' ou 'standard'
          return { id, type: res.status === 200 ? 'shorts' : 'standard' } as const
        } catch {
          return { id, type: 'standard' } as const // Fallback en cas d'erreur
        }
      })
    )

    // On transforme le tableau en un objet de mapping : { [id]: 'shorts' | 'standard' }
    const mapping = classifications.reduce((acc, curr) => {
      acc[curr.id] = curr.type
      return acc
    }, {} as Record<string, 'standard' | 'shorts'>)

    return NextResponse.json(mapping)
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}