# BBIM · Arquitectura de datos

Blockfinity Blockchain Intelligence Monitor — inventario, diagnóstico y optimización

Medido el 21/09/2026 contra los proveedores reales y el servidor local. Las
latencias "en frío" incluyen la compilación de `next dev`; en producción esa
parte desaparece, el costo de red no.

Versión web del mismo informe: https://claude.ai/artifact/DsaHHMwQrHhhZSU6exaVBD

Alcance: 26 APIs, 4 páginas raspadas, 5 feeds RSS, 1 WebSocket, 41 rutas,
23 páginas y 12 registros estáticos.

## Estado: optimización aplicada el 21/09/2026

Hechos los puntos 1, 2, 3 y 7 del plan. Medido reiniciando el servidor, que es
el caso real: proceso nuevo, memoria vacía, copia en disco disponible.

| Ruta | Antes (reinicio) | Después (reinicio) | En caliente |
|---|---|---|---|
| `/api/networks` | 60,8 s | **2,0 s** | 0,11 s |
| `/api/terminal/radar` | 11,6 s | **1,3 s** | 0,04 s |
| `/api/report` | 11,5 s | **1,8 s** | 0,07 s |
| `/api/terminal/overview` | 11,2 s | **1,2 s** | 0,05 s |
| `/api/capital-markets` | 8,0 s | **0,8 s** | 0,09 s |
| `/api/yields` | 3,8 s | **1,5 s** | 0,05 s |

Ninguna ruta pasa de 2,1 s tras un reinicio, y lo que queda es sobre todo
compilación de `next dev`, que en producción no existe.

Qué cambió:

1. **`lib/cache.ts` sirve el dato vencido y refresca por detrás.** Solo espera
   quien no tiene nada que leer: la primera carga de esa clave o un dato con más
   de 24 h sin poder refrescarse (`maxStaleMs`). Dentro de un TTL de gracia el
   dato no se marca como caché, porque es tan reciente como antes de vencer; más
   viejo que eso sí viaja marcado, y `fetchedAt` siempre dice la hora real.
2. **La copia en disco quedó activa para todas las claves** (`persist` por
   defecto). Un reinicio ya no vuelve a descargar nada ni gasta cuota.
3. **Las 40 rutas de datos declaran su frescura** con `lib/httpCache.ts`:
   `max-age` de hasta 5 minutos en el navegador, `s-maxage` igual al TTL de la
   fuente y `stale-while-revalidate` para CDN. Una respuesta fallida nunca se
   cachea: los 502 salen con `no-store`.
4. **`fetchShared` lee esa cabecera** y reutiliza la respuesta ese mismo tiempo,
   en vez de su ventana fija de 30 s: volver a un módulo ya visitado no dispara
   ninguna petición.

Pendientes del plan: 4, 5, 6 y 8 a 11.

## 01 · Qué persiste y qué no

No hay base de datos. Hacen de base de datos cuatro capas, y solo dos sobreviven
a un reinicio:

| Capa | Dónde vive | Tamaño | ¿Persiste? |
|---|---|---|---|
| Caché por clave y TTL | `lib/cache.ts`, un `Map` del proceso | ~40 MB en caliente | Se vacía al reiniciar, pero se rehidrata del disco |
| Copia en disco | `%TEMP%/blockfinity-research-cache` | 24 MB, 86 archivos | **Sí, todas las claves** (desde el 21/09) |
| Registros curados | `data/*.json`, 12 archivos | 170 KB | Sí, en el repositorio |
| Todo lo demás | APIs externas, en vivo | — | — |

## 02 · La cadena de datos

```
middleware.ts          · Basic Auth si APP_PASSWORD tiene valor (hoy vacía)
  ↓ proveedor externo  · 26 APIs, 4 scrapes, 5 RSS
  ↓ lib/sources/*.ts   · normaliza, recorta y tipa (falta = null con motivo)
  ↓ lib/cache.ts       · memoria + dedupe en vuelo + memoria de fallos + disco
  ↓ lib/*.ts           · cálculo: BBI, Builder Score, índices, riesgo de pools
  ↓ app/api/**/route   · 41 rutas que agregan y publican
  ↓ useSource/usePayload + fetchShared (reutiliza lo que la ruta declara fresco)
  ↓ componente React

aparte: WebSocket a wss://stream.bybit.com (liquidaciones, 500 ms) desde el
navegador, sin pasar por rutas ni caché.
```

## 03 · Fuentes

### DeFiLlama (sin clave), el proveedor dominante

| Endpoint | Entidad → campos | TTL | Peso | Latencia |
|---|---|---|---|---|
| `/protocols` | Protocolo → nombre, slug, categoría, cadena, TVL, cambio 1d/7d. Alimenta top, movers, filtro RWA y el directorio de yields | 30 min | **8,5 MB** | 1,0 s |
| `/v2/chains` | Cadena → TVL, gecko_id, símbolo | 30 min | 63 KB | 0,1 s |
| `/v2/historicalChainTvl` | Serie diaria global | 30 min | 119 KB | 0,1 s |
| `/v2/historicalChainTvl/{cadena}` | Igual por cadena; 15 redes × 400 días | 6 h | ~100 KB c/u | 0,1 s |
| `/overview/dexs` | Volumen DEX 24h, cambio 7d, top DEX | 30 min | **1,8 MB** | 2,1 s |
| `/overview/fees` | Protocolo → revenue 24h/7d/30d | 30 min | **3,8 MB** | 2,5 s |
| `/protocol/{slug}` | Estado de resultados: fees, revenue, incentivos, margen (24h a histórico) | 30 min | **10,0 MB** | 8,6 s |
| `/hacks` | Incidente → fecha, monto, devuelto, cadenas, clasificación, técnica, objetivo | 6 h | 340 KB | 1,6 s |
| `stablecoins/stablecoins` | Stablecoin → mecanismo, circulante, cambio 7d, 6 cadenas | 1 h | 543 KB | 0,6 s |
| `stablecoins/stablecoinchains` | Cadena → circulante, nº de activos | 1 h | 19 KB | 0,8 s |
| `stablecoins/stablecoincharts` | Serie por emisor; 7 emisores, 7 llamadas | 6 h | 456 KB c/u | 1,4 s |
| `yields/pools` | Pool → TVL, APY base y reward, media 30d, cambios en pp, stablecoin, riesgo IL, exposición, predicción, días de historia | 30 min | **11,3 MB** | 1,0 s |
| `yields/lendBorrow` | Pool → tasa de préstamo, utilización, LTV, prestable | 30 min | 778 KB | 2,0 s |
| `yields/chart/{pool}` | Serie diaria de un pool (solo al abrir el histórico) | 1 h | variable | — |

`/pools` y `/protocols` se descargan **y se guardan enteros** en memoria para
mostrar diez filas.

### Scraping

| Qué | Cómo | TTL | Peso | Latencia |
|---|---|---|---|---|
| Dashboard RWA | HTTPS directo → Cloudflare responde 403; luego `r.jina.ai` en HTML. KPI + 6.025 activos, 10 clases, 50 plataformas | 30 min + disco | **8,8 MB** | **7–10 s** |
| Dashboard de cadenas | `r.jina.ai` → direcciones activas, TVL, stablecoins, DEX 24h/7d, fees, revenue de apps | 30 min | 34 KB | 5,4 s |
| Dashboard de stablecoins | `r.jina.ai` → total, cambios 1d/7d/30d en % y USD, dominante | 30 min | 18 KB | 4,6 s |
| BCB | HTML del reporte oficial → tipo de cambio. **Ninguna ruta lo llama: código muerto** | 1 h | 27 KB | 1,0 s |

### Resto

| Proveedor | Qué trae | TTL | Peso · latencia | Clave |
|---|---|---|---|---|
| CoinGecko | Global (market cap, volumen, dominancias). Activo → precio, market cap, FDV, volumen, turnover, máx/mín 24h, cambios 24h/7d/30d, ATH y caída, supply, float. Universo del screener, performance e histórico | 5 min–1 h | 4–193 KB | Demo |
| growthepie | Por red EVM: costo mediano por transacción, direcciones activas, transacciones, gas/s, fees, stablecoins y TVL, en serie diaria. Más metadatos | 6 h / 24 h | **3,8 MB** · 1,7 s | No |
| L2BEAT | Rollup → tipo, anfitriona, categoría, proveedores, stage, DA, VM, riesgos | 24 h | 270 KB · 2,2 s | No |
| GitHub | Repo núcleo → estrellas, forks, issues, último push, commits 52 semanas. **2 llamadas por repo, ~31 por tanda** | 12 h / 30 min parcial | 6 KB c/u | Falta token: 60/h |
| Coin Metrics | BTC → precio, MVRV, market cap y realizado, precio realizado, ganancia no realizada, supply y supply en exchanges. BTC/ETH → direcciones y transacciones | 1 h | — | No |
| Binance Futures | Open interest, premium index, long/short, taker ratio | 5 min | — | No |
| Bybit (WebSocket) | Liquidaciones en vivo: precio de quiebra, tamaño, lado | en vivo | — | No |
| Crypto.com | Velas OHLC + volumen (4 pares), tickers | 1 h / 5 min | 14 / 250 KB | No |
| Yahoo | Series y cotizaciones tradicionales | 6 h / 1 h | 27 KB | No |
| Blockscout | Estadísticas de Ethereum | 15 min | 1 KB | No |
| Alternative.me | Fear & Greed, 30 días | 1 h | 3 KB | No |
| 5 RSS + Google News | Titulares por categoría y noticias de Bolivia | 30 min | ~30 / 130 KB | No |
| Messari · Dune | Detalle de activos · trades DEX | 15 min / 1 h | — | Sí |
| Nansen | Smart money netflow | 1 h | — | **Vacía: 502** |
| Anthropic | Texto del módulo de IA sobre datos ya calculados | sin caché | — | Sí |

## 04 · Lo que no se descarga: se calcula

| Módulo | Qué deriva | Sobre qué | Dónde |
|---|---|---|---|
| `networks/score.ts` (745) | Builder Score: 5 pilares, recorte a percentiles 5 y 95, renormalización ante faltantes, momentum ajustado por tamaño, señales | growthepie, DeFiLlama, GitHub, L2BEAT | Servidor |
| `yields.ts` (703) | Clasifica cada pool por operación, lee plazos, puntúa riesgo por reglas, arma rangos y destacados | pools + lendBorrow | Servidor |
| `indices.ts` (380) | Índices propietarios; cada uno declara su fórmula en un registro | varias | Servidor |
| `bbi.ts` (245) | BBI: seis categorías editoriales + índice de actividad | registro + TVL, stablecoins, actividad | Servidor |
| `nexum.ts` (232) | Ejercicios sobre cifras congeladas, con valores vivos donde existen | currículo + 5 métricas | Ambos |
| `rwaSectors.ts` (155) | Sectores de negocio RWA y lecturas por reglas | `/protocols` filtrado | Servidor |
| `marketScreener.ts` (141) | Filtro, orden y paginado; el servidor manda solo la página visible | universo CoinGecko | Servidor |
| `hackStats.ts` (132) | Agregaciones del registro de incidentes, recalculadas al filtrar | los 337 KB de `/hacks` | **Navegador** |

## 05 · Cómo funciona la caché

`cached(clave, fetcher, TTL)` ya hace:

- **Dedupe en vuelo:** dos vistas que piden la misma clave comparten una llamada.
- **Memoria de fallos:** una fuente caída no se reintenta en cada petición.
- **TTL variable:** se puede calcular sobre el dato (GitHub incompleto vence en 30 min, no en 12 h).
- **Último dato bueno:** por repositorio en GitHub; copia en disco en GitHub y RWA.
- **Servir vencido y refrescar detrás:** al vencer el TTL se responde con lo que hay y la recarga sale por detrás; solo espera quien no tiene nada que leer o lleva más de 24 h sin refrescar.

### Claves compartidas

| Rutas | Clave | Quiénes |
|---|---|---|
| 8 | `defillama:protocols` (8,5 MB) | insights, report, defi/analytics, indices, capital-markets, defi/movers, defi/protocols, tokenization/rwa, y el directorio de yields |
| 6 | `coingecko:global` | insights, report, indices, terminal/pulse, terminal/overview, nexum/live |
| 6 | `stablecoins:chains` | insights, report, indices, terminal/pulse, nexum/live, stablecoins |
| 6 | `news:all` | capital-markets, cbdc, news/headlines, news/institutional, stablecoins, terminal/radar |
| 5 | `defillama:rwa-dashboard:v2` (scrape) | insights, report, capital-markets, tokenization/rwa, nexum/live |
| 5 | `defillama:revenue` (3,8 MB) | insights, report, defi/analytics, defi/income-statement, defi/revenue |
| 5 | `chains`, `historicalChainTvl`, `dex-overview`, `feargreed`, `stablecoins:list` | las mismas agregadoras |
| 2 | `defillama:yields:universe:v1` (11,3 MB) | yields, yields/report |

## 06 · Rutas: tiempos y fan-out

| Ruta | 1ª (compila + frío) | 2ª | 3ª (caliente) | KB |
|---|---|---|---|---|
| `/api/networks` | **60,8 s** | 3,3 s | 0,13 s | 222 |
| `/api/terminal/radar` | 11,6 s | 0,11 s | 0,11 s | 9 |
| `/api/report` | 11,5 s | 0,47 s | 0,08 s | 45 |
| `/api/terminal/overview` | 11,2 s | 0,55 s | 0,10 s | 3 |
| `/api/capital-markets` | 8,0 s | 0,14 s | 0,10 s | 12 |
| `/api/onchain/network-activity` | 4,1 s | 0,07 s | 0,06 s | 5 |
| `/api/blockchains` | 4,0 s | 0,16 s | 0,13 s | 195 |
| `/api/yields` | 3,8 s | 0,11 s | 0,10 s | 24 |
| `/api/networks/prices` | 3,5 s | 0,09 s | 0,09 s | 61 |
| `/api/indices` · `insights` · `tokenization/rwa` | 2,3–2,6 s | ~0,12 s | ~0,10 s | 1–25 |
| Resto (25 rutas) | 0,5–2,9 s | < 0,2 s | < 0,15 s | 1–64 |
| `/api/onchain/smart-money` | — | — | — | **502: falta la clave** |

### Llamadas externas por ruta pesada

| Ruta | Llamadas | De dónde | Datos en frío |
|---|---|---|---|
| `/api/networks` | **~53** | growthepie (2), scrape de cadenas, `/v2/chains`, stablecoinchains, `/protocols`, L2BEAT, **GitHub (31)**, **15 históricos de TVL** | ~14 MB |
| `/api/report` | ~20 | 17 funciones de fuente, incluido el scrape RWA y las 7 series por emisor | ~23 MB |
| `/api/networks/prices` | 16 | `/v2/chains` + **15 históricos de CoinGecko**, de a 3 | ~1 MB |
| `/api/stablecoins` | 10 | lista + 7 series + cadenas + noticias | ~4 MB |
| `/api/yields` | 3 | pools + lendBorrow + directorio de protocolos | **~20 MB** |
| `/api/terminal/radar` | 5 | los cinco RSS: pesan poco, responden lento | ~150 KB |

### El histórico, aparte

`/api/history` alimenta la ficha lateral y el comparador; se pide al abrir, no al
cargar la página.

| Tipo | Ventana |
|---|---|
| `chain-tvl` | **5.000 días** |
| `stablecoin-total` | **3.650 días** |
| `asset` | 365 días |
| `ticker` | 300 días |
| `protocol`, `stablecoin`, `stablecoin-chain`, `quote`, `yield-pool`, `rwa-sector` (4 protocolos en paralelo) | según fuente |

### Lo más pesado hacia el navegador

`/api/security/hacks` 337 KB (registro completo; el navegador recalcula al
filtrar) · `/api/onchain/bitcoin-intelligence` 249 KB · `/api/networks` 222 KB ·
`/api/blockchains` 195 KB · `/api/defi/analytics` 64 KB · `/api/networks/prices`
61 KB.

## 07 · Qué carga cada página

| Página | Peticiones | Endpoints |
|---|---|---|
| `/` | **11** | blockchains, defi/analytics, defi/movers, defi/revenue, defi/tvl-history, indices, insights, stablecoins, terminal/overview, terminal/pulse, tokenization/rwa |
| `/defi` | 7 | analytics, dex-volume, income-statement, movers, protocols, revenue, tvl-history |
| `/mercado` | 6 | market/* + terminal/overview |
| `/informe` | 5 | indices, insights, networks, report, yields/report |
| `/noticias` · `/onchain` | 3 | news/* , terminal/radar · onchain/* + WebSocket |
| `/blockchains/infraestructura` | 2 | networks, networks/prices |
| Otras 16 | 1 | — |

`/api/blockchains` lo piden 4 páginas; `indices` y `tokenization/rwa`, 3 cada
uno. Ninguna página hace polling: se pide al montar y otra vez en cada visita.

## 08 · Por qué cada módulo carga de cero

1. ~~**Sin `Cache-Control` en las 41 rutas.**~~ **Resuelto:** las 40 rutas de
   datos declaran su frescura y `fetchShared` la respeta.
2. ~~**La caché muere con el proceso.**~~ **Resuelto:** copia en disco para
   todas las claves; un reinicio ya no descarga nada.
3. ~~**Al vencer el TTL la petición espera.**~~ **Resuelto:** se sirve lo
   vencido y la recarga va por detrás.
4. **Se guarda el crudo, no lo usado.** ~20 MB por clave, recorridos en cada
   lectura.
5. **La portada dispara 11 peticiones** que comparten cinco claves y repiten
   cálculos.
6. **Nada se precalienta**, y las ventanas de histórico piden hasta 5.000 días.

## 09 · Plan de optimización

| # | Cambio | Qué resuelve | Impacto | Esfuerzo |
|---|---|---|---|---|
| 1 | ✅ **Hecho** · Servir el dato vencido y refrescar por detrás | Causa 3: adiós a los picos de 60 s y 11 s | Alto | ~20 líneas |
| 2 | ✅ **Hecho** · Copia en disco para todas las claves | Causa 2 | Alto | La maquinaria ya existe |
| 3 | ✅ **Hecho** · `Cache-Control` en las 40 rutas de datos | Causa 1; habilita CDN | Alto | Un helper |
| 4 | Guardar el derivado, no el crudo | Causa 4 | Alto | Medio |
| 5 | Precalentar al arrancar y por cron | Causa 6 | Medio-alto | Medio |
| 6 | Un endpoint por página en portada e informe | Causa 5 | Medio | Medio-alto |
| 7 | ✅ **Hecho** · Caché de URL en el cliente con el TTL que declara la ruta | Causa 1 en el navegador | Medio | Bajo |
| 8 | Configurar `GITHUB_TOKEN` | 60 → 5.000 consultas/hora | Medio | Trivial |
| 9 | Aligerar `hacks` y `bitcoin-intelligence` | 337 y 249 KB por carga | Medio | Medio |
| 10 | Recortar las ventanas de `/api/history` | 5.000 y 3.650 días por apertura | Medio | Bajo |
| 11 | Resolver Nansen y quitar el scraping del BCB | Una ruta en 502 y una fuente muerta | Bajo | Trivial |

## 10 · Anexos

### Claves de entorno

| Variable | Para qué | Estado |
|---|---|---|
| `ANTHROPIC_API_KEY` | Módulo de IA | Configurada |
| `COINGECKO_DEMO_API_KEY` | Precios, universo, performance | Configurada (demo) |
| `MESSARI_API_KEY`, `DUNE_API_KEY` | Detalle de activos, trades DEX | Configuradas |
| `NANSEN_API_KEY` | Smart money | **Vacía: 502** |
| `GITHUB_TOKEN` | Actividad de repositorios | **Ausente: 60/hora** |
| `APP_PASSWORD` | Basic Auth de toda la app | **Vacía: sin protección** |
| `BF_CACHE_DIR` | Carpeta de copias en disco | Opcional (pruebas) |

### Registros estáticos (`data/`, 170 KB)

`nexum-curriculum.json` 61,1 KB · `blockchains.json` 25,0 · `networks.json` 18,2
· `world-land.json` 17,0 · `cbdc-tracker.json` 16,9 · `asset-classes` 7,6 ·
`bolivia-events` 5,9 · `case-studies` 5,6 · `bolivia-opportunities` 5,5 ·
`tokenization` 4,0 · `partnerships` 2,2 · `fan-tokens` 1,4. Se importan al
compilar: costo cero.

### Qué no está conectado

- **Scraping del BCB:** funciona y devuelve el tipo de cambio, pero ninguna ruta lo llama.
- **Nansen:** la página consume la ruta, pero sin clave siempre responde 502.
- **Dune:** solo se usa el volumen DEX; el lector genérico de consultas quedó sin uso.
