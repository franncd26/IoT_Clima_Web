async function loadJSON(path){ const r = await fetch(path); return r.json(); }

let chartLecturas, chartHora, chartDia;

function mkLine(ctx, labels, seriesLabel, data){
  if (!ctx) return null;
  if (ctx._chart) ctx._chart.destroy();
  const c = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: seriesLabel, data }] },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: { x: { ticks:{autoSkip:true,maxRotation:0} }, y: { beginAtZero:false } }
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

  // Lecturas (últimas N)
  const inputN = document.getElementById('n-ultimas');
  const btnN   = document.getElementById('btn-ultimas');
  const ctxL   = document.getElementById('chartLecturas');

  function drawUltimas(N){
    const items = lecturas.items.slice(-N);
    const labels = items.map(x => x.timestamp_local || x.doc_id);
    const temps  = items.map(x => x.temp);
    if (chartLecturas) chartLecturas.destroy();
    chartLecturas = mkLine(ctxL, labels, 'Temperatura (°C)', temps);
  }
  drawUltimas(parseInt(inputN.value||'50',10));
  btnN.addEventListener('click', () => drawUltimas(parseInt(inputN.value||'50',10)));

  // Agg por hora (temp promedio)
  const ctxH = document.getElementById('chartHora');
  const labelsH = aggHora.items.map(x => x.doc_id);
  const dataH = aggHora.items.map(x => x.temp_avg);
  chartHora = mkBar(ctxH, labelsH, 'Temp. promedio por hora (°C)', dataH);

  // Agg por día (lluvia total)
  const ctxD = document.getElementById('chartDia');
  const labelsD = aggDia.items.map(x => x.doc_id);
  const dataD = aggDia.items.map(x => x.lluvia_total);
  chartDia = mkBar(ctxD, labelsD, 'Lluvia total por día (mm)', dataD);
})();
