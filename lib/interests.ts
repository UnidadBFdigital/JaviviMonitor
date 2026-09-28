// Puntos de interés del terminal: para quién sirve cada módulo.
//
// La taxonomía no se inventó acá. Sale de cruzar las cuatro unidades de
// negocio del documento del proyecto (§2.1: Compliance Solutions, NEXUM,
// Consultoría estratégica y Área Comercial) con los tres servicios que el
// mismo documento define como producto final (§7): evaluación tecnológica
// para tokenización, evaluación de riesgo blockchain para compliance y
// selección de infraestructura DLT para instituciones.
//
// Un módulo puede servir a varios perfiles —el Landscape lo usa tanto un CTO
// como un inversionista—, así que la relación es de muchos a muchos. Lo que
// no se permite es un módulo sin perfil: si no se sabe a quién le sirve,
// falta decidirlo, y la prueba de nav lo marca.

export type InterestId =
  | "inversion"
  | "riesgo"
  | "cumplimiento"
  | "tecnologia"
  | "institucional"
  | "formacion";

export type Interest = {
  id: InterestId;
  /** rótulo del filtro */
  label: string;
  /** una palabra para la ficha del filtro. No se usan códigos de tres letras:
   *  chocarían con los de los módulos (RSK es Risk Profiles, TKN es el hub) */
  short: string;
  /** a quién le sirve, en sus palabras */
  audience: string;
  /** qué pregunta responde el conjunto de módulos */
  question: string;
  /** unidad de negocio del proyecto que lo consume */
  unit: string;
};

export const INTERESTS: Interest[] = [
  {
    id: "inversion",
    label: "Inversión y mercado",
    short: "Inversión",
    audience: "Inversionistas, tesorería y quien decide exposición",
    question: "¿Dónde está el capital, qué se mueve y cuánto rinde?",
    unit: "Consultoría estratégica",
  },
  {
    id: "riesgo",
    label: "Riesgo",
    short: "Riesgo",
    audience: "Gestión de riesgos y auditoría interna",
    question: "¿Qué puede salir mal, dónde ya salió mal y con cuánta frecuencia?",
    unit: "Compliance Solutions",
  },
  {
    id: "cumplimiento",
    label: "Cumplimiento y regulación",
    short: "Cumplimiento",
    audience: "Compliance, legal y relación con el regulador",
    question: "¿Qué exige hoy la norma y hacia dónde va?",
    unit: "Compliance Solutions",
  },
  {
    id: "tecnologia",
    label: "Tecnología e infraestructura",
    short: "Tecnología",
    audience: "CTO, arquitectura y equipos de desarrollo",
    question: "¿Sobre qué red construir y qué cuesta operarla?",
    unit: "Consultoría estratégica",
  },
  {
    id: "institucional",
    label: "Tokenización e institucional",
    short: "Institucional",
    audience: "Banca, emisores y mercado de capitales",
    question: "¿Qué activos reales ya están on-chain y quién los emite?",
    unit: "Consultoría estratégica",
  },
  {
    id: "formacion",
    label: "Formación y material comercial",
    short: "Formación",
    audience: "NEXUM y ventas consultativas",
    question: "¿Con qué explico y con qué abro una reunión?",
    unit: "NEXUM · Área Comercial",
  },
];

export const INTEREST_BY_ID = new Map(INTERESTS.map((i) => [i.id, i]));
