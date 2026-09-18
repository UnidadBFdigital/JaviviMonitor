import { ExecutiveHeader } from "@/components/terminal/ExecutiveHeader";
import { IndicesStrip } from "@/components/indices/IndicesStrip";
import { MorningBrief } from "@/components/terminal/MorningBrief";
import { SectionDivider } from "@/components/SectionDivider";

import { TokenizationBrief } from "@/components/tokenization/TokenizationBrief";
import { RwaMomentumCard } from "@/components/tokenization/RwaMomentumCard";

import { StablecoinSupplyCard } from "@/components/stablecoins/StablecoinSupplyCard";
import { StablecoinChainsCard } from "@/components/stablecoins/StablecoinChainsCard";

import { ChainsTvlCard } from "@/components/blockchains/ChainsTvlCard";
import { BbiTopCard } from "@/components/blockchains/BbiTopCard";

import { PulsePanel } from "@/components/terminal/PulsePanel";
import { DefiTreemapCard } from "@/components/terminal/DefiTreemapCard";
import { TvlHistoryChart } from "@/components/defi/TvlHistoryChart";
import { RevenueCard } from "@/components/defi/RevenueCard";
import { MoversCard } from "@/components/defi/MoversCard";

// Portada del día como dashboard. El primer pantallazo es todo cifra y
// gráfico —KPI, índices propietarios y tokenización—; la lectura escrita
// (Morning Brief) va al final, cuando el usuario ya vio los datos.
// Las noticias viven en News B2B, no acá.
export default function Home() {
  return (
    <div className="space-y-5">
      <ExecutiveHeader />

      <IndicesStrip />

      {/* ---------- Tokenización: el eje del producto ---------- */}
      <SectionDivider
        title="Tokenización"
        hint="AUM RWA oficial y momentum del TVL por protocolo"
        href="/tokenizacion"
        linkLabel="Tokenization Hub →"
      />

      <TokenizationBrief />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RwaMomentumCard />
        <BbiTopCard />
      </div>

      {/* ---------- Stablecoins: la demanda de dólar digital ---------- */}
      <SectionDivider
        title="Stablecoins"
        hint="Supply, crecimiento y en qué redes circula"
        href="/stablecoins"
        linkLabel="Stablecoin Intelligence →"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_5fr]">
        <StablecoinSupplyCard />
        <StablecoinChainsCard />
      </div>

      {/* ---------- Blockchain: dónde ocurre la actividad ---------- */}
      <SectionDivider
        title="Blockchain"
        hint="Infraestructura, concentración y actividad por red"
        href="/blockchains"
        linkLabel="Blockchain Intelligence →"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChainsTvlCard />
        <DefiTreemapCard />
      </div>

      {/* ---------- DeFi: capital y quién captura valor ---------- */}
      <SectionDivider
        title="DeFi"
        hint="Capital inmovilizado, ingresos y rotación"
        href="/defi"
        linkLabel="Protocol Analytics →"
      />

      <TvlHistoryChart />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueCard />
        <MoversCard />
      </div>

      {/* ---------- Lectura del día: el texto, al final ---------- */}
      <SectionDivider
        title="Lectura del día"
        hint="Señales derivadas de los datos de arriba, por reglas deterministas"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_3fr]">
        <MorningBrief />
        <PulsePanel />
      </div>
    </div>
  );
}
