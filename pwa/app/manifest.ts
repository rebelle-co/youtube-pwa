import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YouTube Premium Simulator',
    short_name: 'YT Simulator',
    description: 'Alternative YouTube PWA sans publicité',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f0f',
    theme_color: '#0f0f0f',
    icons: [
      {
        src: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}