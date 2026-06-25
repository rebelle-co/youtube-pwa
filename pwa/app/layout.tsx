'use client'
import { useState } from 'react';
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import SuspenseWrapper from "./components/SuspenseWrapper";
import "./styles/global.css";
import "./styles/login.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(true);

  return (
    <html lang="fr">
      <body style={{margin:0}}>
        <SuspenseWrapper>
          <Header toggleNavbar={() => setIsNavOpen(!isNavOpen)} />
            <div className={`app-container ${isNavOpen ? 'nav-open' : 'nav-closed'}`}>
              {isNavOpen && <Navbar />}
                <main className="main-content">
                  {children}
                </main>
            </div>
        </SuspenseWrapper>
      </body>
    </html>
  );
}