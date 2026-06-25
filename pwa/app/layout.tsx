import Navbar from "./components/Navbar";
import SuspenseWrapper from "./components/SuspenseWrapper";
import "./styles/global.css";
import "./styles/login.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SuspenseWrapper>
          <div className="app-layout">
            <div className="app-container">
              <Navbar /> {/* La Navbar est TOUJOURS présente */}
              <main className="main-content">
                {children}
              </main>
            </div>
          </div>
        </SuspenseWrapper>
      </body>
    </html>
  );
}