import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { HistoryProvider } from "@/components/history/HistoryProvider";
import "./globals.css";

export const metadata: Metadata = {
  // el nombre completo va en la raíz; las demás páginas usan la sigla
  title: "Blockfinity Blockchain Intelligence Monitor (BBIM)",
  description: "BBIM — terminal interna de inteligencia blockchain de Blockfinity Advisors",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {/* la ficha de histórico vive acá: cualquier vista la abre sin navegar */}
        <HistoryProvider>
          {/* columna en móvil (barra arriba), fila en escritorio (sidebar) */}
          <div className="min-h-screen lg:flex">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-4 lg:px-5 lg:py-5">{children}</main>
          </div>
        </HistoryProvider>
      </body>
    </html>
  );
}
