'use client'
import { useAppContext } from '@/app/context/AppContext'
import { useSearchParams } from 'next/navigation'

export default function ChannelPage() {
  const searchParams = useSearchParams()
  const channelId = searchParams.get('channel')
  const { fetchVideosForChannel } = useAppContext()

  // Vous pouvez déclencher le fetch ici avec un useEffect
  return <div>Channel: {channelId}</div>
}