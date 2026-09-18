import curriculumJson from "@/data/nexum-curriculum.json";
import { NexumLayer } from "@/components/nexum/NexumLayer";
import type { NexumCurriculum } from "@/lib/nexum";

export const metadata = {
  title: "NEXUM Intelligence Layer — Blockfinity Research",
  description:
    "Capa educativa del terminal: dashboards simplificados, esquemas animados y ejercicios prácticos sobre un snapshot de datos.",
};

// El currículo se lee del JSON en tiempo de build. El casteo es necesario
// porque TypeScript infiere del JSON un tipo estructural amplio y los
// ejercicios son una unión discriminada por `type`.
const curriculum = curriculumJson as unknown as NexumCurriculum;

export default function NexumPage() {
  return <NexumLayer curriculum={curriculum} />;
}
