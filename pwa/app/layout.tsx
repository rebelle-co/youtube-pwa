'use client'
import { useState } from 'react';
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import SuspenseWrapper from "./components/SuspenseWrapper";
import "./styles/global.css";
import "./styles/login.css";

// layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(false); // Commencez fermé si vous voulez

  return (
    <html lang="fr">
      <body style={{margin:0}}>
        <Header toggleNavbar={() => setIsNavOpen(!isNavOpen)} />
        {/* On passe la prop isNavOpen à la navbar */}
        <div className={`app-container ${isNavOpen ? 'nav-open' : 'nav-closed'}`}>
          <Navbar isOpen={isNavOpen} /> 
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}