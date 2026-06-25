'use client'
import { Suspense, useState } from 'react';
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import "./styles/global.css";
import "./styles/login.css";
import { Providers } from './providers';
import ParamsHandler from './context/ParamsHandler';

// layout.tsx
// layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{margin:0}}>
        <Providers>
          {/* Suspense est OBLIGATOIRE pour tout composant utilisant useSearchParams */}
          <Suspense fallback={null}>
            <ParamsHandler />
          </Suspense>
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  );
}

// Composant intermédiaire pour gérer l'état de la nav
function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  return (
    <>
      <Header toggleNavbar={() => setIsNavOpen(!isNavOpen)} />
      <div className={`app-container ${isNavOpen ? 'nav-open' : 'nav-closed'}`}>
        <Navbar isOpen={isNavOpen} />
        <main className="main-content">{children}</main>
      </div>
    </>
  );
}