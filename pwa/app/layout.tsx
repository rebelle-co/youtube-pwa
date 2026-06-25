import Navbar from "./components/Navbar";
import SuspenseWrapper from "./components/SuspenseWrapper";
import "./styles/global.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SuspenseWrapper>
          <div className="app-layout">
            <Navbar /> {/* La Navbar est TOUJOURS présente */}
            <main className="main-content">
              {children}
            </main>
          </div>
        </SuspenseWrapper>
      </body>
    </html>
  );
}