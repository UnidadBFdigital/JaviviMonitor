import Link from "next/link";

export default function BlockchainLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">
    <nav aria-label="Blockchain Intelligence" className="flex flex-wrap gap-2 text-xs">
      {[["/blockchains", "Actividad y capital"], ["/blockchains/scorecard", "Rankings y metodología"], ["/blockchains/riesgo", "Riesgos y controles"], ["/blockchains/infraestructura", "Builder Radar"]].map(([href, label]) =>
        <Link key={href} href={href} className="rounded border border-line bg-card px-3 py-2 text-ink-secondary hover:border-electric hover:text-ink">{label}</Link>)}
    </nav>{children}
  </div>;
}
