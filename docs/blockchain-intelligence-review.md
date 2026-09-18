# Revisión de Blockchain Intelligence — 7 de septiembre de 2026

El ranking anterior asignaba 85% a seis notas editoriales y 15% a una escala sobre TVL + stablecoins. TRON ya saturaba esa escala en 10/10, pero sus direcciones activas y su volumen no intervenían. En el corte consultado de la aplicación quedaba novena, con BBI 7,00, pese a liderar las direcciones activas del universo monitoreado y quedar segunda en oferta de stablecoins.

También se detectaron listados de TVL/stablecoins que conservaban el orden BBI, valores ausentes convertidos a cero, descripciones regulatorias inferidas a partir de notas editoriales y un cálculo de índices que no incorporaba los mismos insumos que el terminal y el PDF.

## BBI v2

| Categoría | Peso anterior | Peso actual |
| --- | ---: | ---: |
| Seguridad editorial | 20% | 15% |
| Adopción editorial | 20% | 10% |
| Actividad observable | 15% | 40% |
| Escalabilidad editorial | 15% | 10% |
| Ecosistema editorial | 15% | 10% |
| Encaje institucional editorial | 10% | 10% |
| Monitoreo y controles editorial | 5% | 5% |

La actividad normaliza por separado direcciones activas (30%), oferta de stablecoins (25%), TVL (20%), volumen DEX (15%) y comisiones de red (10%). Las anclas logarítmicas fijas y sus pesos están publicados en `lib/bbiMethodology.ts` y en la interfaz. Son decisiones metodológicas editoriales, no parámetros calibrados estadísticamente. El corte diario es volátil: no mide retención, personas únicas ni adopción sostenida.

No se suman stocks y flujos. La suma bruta TVL + stablecoins se conserva por compatibilidad del contrato, pero ya no interviene en el índice ni se presenta como volumen. La oferta puede solaparse con el TVL.

Se requieren tres indicadores y cobertura ponderada de al menos 60% para calcular actividad. Con datos incompletos se renormalizan los pesos y se marca la nota parcial. Solo 100% de cobertura habilita el ranking comparable. Las fichas sin actividad pública continúan disponibles; no se presentan como un puesto comparable. El universo institucional permite comparar sus notas editoriales, con esa distinción visible.

## Revisión documentada de TRON

- Se conservan seguridad 6, adopción 9, escalabilidad 8 y ecosistema 5.
- Encaje institucional pasa de 3 a 5 por soporte verificable de infraestructura institucional. [Fireblocks documenta su integración](https://www.fireblocks.com/blog/tron-x-fireblocks); esto no implica aprobación universal por entidades reguladas.
- Monitoreo pasa de 5 a 7 por herramientas y cooperación verificables: [Tether documenta la iniciativa T3 con TRON y TRM Labs](https://tether.io/news/450-million-frozen-and-counting-t3-financial-crime-unit-continues-global-crackdown-on-illicit-crypto-flows/). Esta capacidad no equivale a ausencia de actividad ilícita.
- Se reemplaza el rótulo jurídico genérico por contexto fechado: la [SEC publicó una resolución propuesta el 5 de marzo de 2026](https://www.sec.gov/enforcement-litigation/litigation-releases/lr-26496) y [registra una orden del 9 de marzo](https://www.sec.gov/enforcement-litigation/whistleblower-program/notice-covered-actions/award-claim-2026-034). No se infiere autorización general de la red.
- Se conserva el riesgo de concentración: [27 Super Representatives producen bloques](https://developers.tron.network/docs/super-representatives).
- El [reporte Q2 2026 de TRON DAO](https://trondao.org/research/tron-q2-2026-quarterly-report) publica USD 2,08 billones (2.08T) de liquidación de stablecoins. Se presenta como referencia histórica del emisor con período explícito; no se incorpora al BBI porque no hay una serie homogénea de transferencias para todas las redes. No se interpreta como pagos comerciales verificados.

Las fuentes sustentan hechos; las notas siguen siendo juicio editorial. Se revisó la lógica de cálculo para todo el universo. Las otras notas individuales conservan su corte base y se identifican como evaluaciones sin revisión documental nueva; no se declara una auditoría actualizada de los 21 perfiles.

## Experiencia y consistencia

Las vistas separan BBI general, uso observable y encaje institucional. Cada red tiene una explicación de componentes, pesos efectivos, cobertura y puestos por métrica. Landscape permite ordenar por direcciones, stablecoins, TVL, DEX/fees de 24h y siete días, con búsqueda y CSV. Las fichas de riesgo separan herramientas de monitoreo, contexto regulatorio y actividad.

El terminal, los índices y el informe usan `getBlockchainSnapshot`. El PDF conserva fondo blanco y publica metodología, cobertura y actividad por red. Las cifras de distintas fuentes pueden corresponder a cortes distintos, indicados mediante sus horas de consulta.

## Verificación

`npm test` verifica datos ausentes frente a cero, límites logarítmicos, cobertura parcial, parsing, aliases, independencia respecto al nombre de red, sensibilidad al uso, invariancia al agregar redes y caída de fuentes. TypeScript y ESLint verifican la integración. La prueba de navegador comprueba rankings, selector de red, volumen semanal, diseño móvil y exportación del informe.
