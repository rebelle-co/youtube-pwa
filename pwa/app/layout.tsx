'use client'
import { useState } from 'react';
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import SuspenseWrapper from "./components/SuspenseWrapper";
import "./styles/global.css";
import "./styles/login.css";
import { Providers } from './providers';

// layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{margin:0}}>
        <Providers> 
          {/* Maintenant, Header et Navbar peuvent lire le contexte sans erreur */}
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