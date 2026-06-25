'use client'
import { Suspense } from 'react'
import { AppProvider } from '../context/AppContext'
import { useSearchParams } from 'next/navigation'

function SearchParamsLoader({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams() 
  const channelParam = searchParams.get('channel')
  return <>{children}</>
}

export default function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <AppProvider>
        {children}
      </AppProvider>
    </Suspense>
  )
}