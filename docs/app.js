// app.js — versión con 3 series en el primer gráfico

async function loadJSON(path){ const r = await fetch(path); return r.json(); }

let chartLecturas, chartHora, chartDia;

// Línea multi-serie
function mkMultiLine(ctx, labels, datasets){
  if (!ctx) return null;
  if (ctx._chart) ctx._chart.destroy();
  const c = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true } },
      scales: {
        x: { ticks:{ autoSkip:true, maxRotation:0 } },
        y: { beginAtZero: false }
      }
    }
  });
  ctx._chart = c;
  return c;
}

// Barras (se queda igual)
function mkBar(ctx, labels, seriesLabel, data){
  if (!ctx) return null;
  if (ctx._chart) ctx._chart.destroy();
  const c = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: seriesLabel, data }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
  ctx._chart = c;
  return c;
}

(async () => {
  // Carga de JSON estáticos
  const lecturas = await loadJSON('./lecturas.json'); // {items, count}
  const aggHora  = await loadJSON('./agg_hora.json');
  const aggDia   = await loadJSON('./agg_dia.json');

  // === Primer gráfico: Lecturas (últimas N) con 3 series
  const inputN = document.getElementById('n-ultimas');
  const btnN   = document.getElementById('btn-ultimas');
  const ctxL   = document.getElementById('chartLecturas');

  function drawUltimas(N){
    const items = lecturas.items.slice(-N); // últimas N

    // Labels (timestamp_local si existe, sino doc_id)
    const labels = items.map(x => x.timestamp_local || x.doc_id);

    // Series: usa 0 si el campo no existe en alguna fila
    const serieTemp = items.map(x => (x.temp ?? 0));
    const serieLluvia = items.map(x => (x.lluvia ?? 0));       // en Lectura es 'lluvia'
    const serieRadMax = items.map(x => (x.rad_max ?? 0));      // en Lectura es 'rad_max'

    // Multi-dataset (Chart.js asigna colores por defecto)
    const datasets = [
      { label: 'Temperatura (°C)', data: serieTemp },
      { label: 'Lluvia (mm)',      data: serieLluvia },
      { label: 'Radiación máx. (W/m²)', data: serieRadMax },
    ];

    chartLecturas = mkMultiLine(ctxL, labels, datasets);
  }

  drawUltimas(parseInt(inputN.value || '50', 10));
  btnN.addEventListener('click', () => {
    drawUltimas(parseInt(inputN.value || '50', 10));
  });

  // === Segundo gráfico: Agregados por hora (temperatura promedio)
  const ctxH = document.getElementById('chartHora');
  const labelsH = aggHora.items.map(x => x.doc_id);
  const dataH = aggHora.items.map(x => x.temp_avg ?? 0);
  chartHora = mkBar(ctxH, labelsH, 'Temp. promedio por hora (°C)', dataH);

  // === Tercer gráfico: Agregados por día (lluvia total)
  const ctxD = document.getElementById('chartDia');
  const labelsD = aggDia.items.map(x => x.doc_id);
  const dataD = aggDia.items.map(x => x.lluvia_total ?? 0);
  chartDia = mkBar(ctxD, labelsD, 'Lluvia total por día (mm)', dataD);
})();
