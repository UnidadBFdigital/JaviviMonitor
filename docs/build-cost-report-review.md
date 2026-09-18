# Revisión de Build & Cost e integración del informe

El índice de accesibilidad 1.1 usa el registro completo como referencia. Filtrar por capa/VM o elegir redes en el comparador conserva las notas; cambiar el caso de uso aplica los pesos y multiplicadores publicados. La cobertura mide componentes observados, no solo pilares aceptados. Se requieren tres pilares y 60% de cobertura global. Los impulsores se ordenan según su aporte con los denominadores de cada pilar.

El parser de growthepie conserva cero frente a ausencia, valida fechas y deduplica observaciones. Las ventanas usan días de calendario; las variaciones requieren ventanas consecutivas completas. El gráfico usa fechas reales y corta las líneas cuando faltan días. Las medias de costos se identifican como medias de medianas diarias, con fecha y días disponibles. El escenario mensual permite cambiar la cantidad y muestra una referencia y extremos históricos, excluyendo costos de infraestructura y operaciones específicas.

La conversión de L2BEAT se identifica como proxy editorial de madurez, no como calificación de seguridad de L2BEAT. Los proyectos bajo revisión no reciben ese proxy. Las fuentes de TVL, stablecoins, RWA y metadatos tienen trazabilidad separada.

El informe incorpora tres capítulos: costos y capacidad (07), desarrollo y arquitectura de las 15 redes del registro (08), perfiles, momentum, metodología y fuentes de Build & Cost (09). La metodología general pasa a 10. Conserva el detalle documentado de TRON y sus referencias históricas. El escenario impreso declara 100.000 transacciones mensuales; es independiente de los filtros y la cantidad seleccionada en la página. El botón espera a que los bloques adicionales terminen de cargar o declaren su error.

El informe solo usa fondo blanco. El pie usa el PNG original dentro de un contenedor SVG de tamaño fijo, ubicado en el margen inferior de cada página mediante CSS paginado, junto al número de página. No se altera el arte del logo.

Verificación: 14 pruebas de cálculo y parsing, TypeScript, ESLint y Chrome. La prueba de navegador comprueba estabilidad del índice al filtrar, presupuesto de cero transacciones, diseño móvil, las 15 fichas impresas, coherencia del BBI entre terminal e informe y exportación de PDF. Los costos operativos siguen sin cobertura comparable para varias L1; N/A no se convierte en costo cero.
