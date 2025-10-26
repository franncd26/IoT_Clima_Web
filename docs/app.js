// app.js — 3 series sin checkboxes, con doble eje Y y leyenda para toggles

async function loadJSON(path){ const r = await fetch(path); return r.json(); }

let chartLecturas, chartHora, chartDia;

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
        x:  { ticks:{ autoSkip:true, maxRotation:0 } },
        y:  { beginAtZero: false, position:'left',  title:{display:true, text:'Temperatura (°C)'} },
        y1: { beginAtZero: true,  position:'right', grid:{ drawOnChartArea:false },
              title:{display:true, text:'Lluvia (mm) / Radiación (W/m²)'} }
      }
    }
  });
  ctx._chart = c;
  return c;
}

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
  const lecturas = await loadJSON('./lecturas.json'); // {items, count}
  const aggHora  = await loadJSON('./agg_hora.json');
  const aggDia   = await loadJSON('./agg_dia.json');

  // === Gráfico 1: Lecturas (últimas N) con 3 series
  const inputN = document.getElementById('n-ultimas');
  const btnN   = document.getElementById('btn-ultimas');
  const ctxL   = document.getElementById('chartLecturas');

  function drawUltimas(N){
    const items  = lecturas.items.slice(-N);
    const labels = items.map(x => x.timestamp_local || x.doc_id);

    const serieTemp = items.map(x => x.temp ?? 0);
    const serieLluv = items.map(x => x.lluvia ?? 0);
    const serieRad  = items.map(x => x.rad_max ?? 0);

    const datasets = [
      { label:'Temperatura (°C)',         data: serieTemp, yAxisID:'y'  },
      { label:'Lluvia (mm)',              data: serieLluv, yAxisID:'y1' },
      { label:'Radiación máx. (W/m²)',    data: serieRad,  yAxisID:'y1' }
    ];

    chartLecturas = mkMultiLine(ctxL, labels, datasets);
  }

  drawUltimas(parseInt(inputN.value || '50', 10));
  btnN.addEventListener('click', () => {
    drawUltimas(parseInt(inputN.value || '50', 10));
  });

  // === Gráfico 2: Agregados por hora (temperatura promedio)
  const ctxH = document.getElementById('chartHora');
  const labelsH = aggHora.items.map(x => x.doc_id);
  const dataH = aggHora.items.map(x => x.temp_avg ?? 0);
  chartHora = mkBar(ctxH, labelsH, 'Temp. promedio por hora (°C)', dataH);

  // === Gráfico 3: Agregados por día (lluvia total)
  const ctxD = document.getElementById('chartDia');
  const labelsD = aggDia.items.map(x => x.doc_id);
  const dataD = aggDia.items.map(x => x.lluvia_total ?? 0);
  chartDia = mkBar(ctxD, labelsD, 'Lluvia total por día (mm)', dataD);
})();
