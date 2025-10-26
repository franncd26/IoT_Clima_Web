// app.js — Punto 0: fechas legibles con Intl, manteniendo ISO para lógica

// === Utilidades ===
async function loadJSON(path) { const r = await fetch(path); return r.json(); }
let chartLecturas, chartHora, chartDia;

// === Helpers de fecha (solo presentación) ===
const CR_TZ = 'America/Costa_Rica';
const fmtDate = (iso, opts = { dateStyle: 'short', timeStyle: 'short' }) =>
  new Intl.DateTimeFormat('es-CR', { timeZone: CR_TZ, ...opts })
    .format(new Date(iso));

// === Factories de gráficos ===
function mkMultiLine(ctx, labels, datasets) {
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
        x:  { ticks: { autoSkip: true, maxRotation: 0 } },
        y:  { beginAtZero: false, position: 'left',  title: { display: true, text: 'Temperatura (°C)' } },
        y1: { beginAtZero: true,  position: 'right', grid: { drawOnChartArea: false },
              title: { display: true, text: 'Lluvia (mm) / Radiación (W/m²)' } }
      }
    }
  });
  ctx._chart = c;
  return c;
}

function mkBar(ctx, labels, seriesLabel, data) {
  if (!ctx) return null;
  if (ctx._chart) ctx._chart.destroy();
  const c = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: seriesLabel, data }] },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { ticks: { autoSkip: true, maxRotation: 0 } },
        y: { beginAtZero: true }
      }
    }
  });
  ctx._chart = c;
  return c;
}

// === Carga y render ===
(async function init() {
  const [lecturas, aggHora, aggDia] = await Promise.all([
    loadJSON('./lecturas.json'),
    loadJSON('./agg_hora.json'),
    loadJSON('./agg_dia.json'),
  ]);

  // === Gráfico 1: Lecturas (30 min)
  const ctxL = document.getElementById('chartLecturas');
  const L = (lecturas.items || []);
  const labelsL = L.map(x => fmtDate(x.timestamp_local || x.timestamp));
  const dataTemp = L.map(x => x.temp ?? 0);
  const dataRad  = L.map(x => x.rad_max ?? 0);
  const dataLlu  = L.map(x => x.lluvia ?? 0);

  chartLecturas = mkMultiLine(ctxL, labelsL, [
    { label: 'Temperatura (°C)', data: dataTemp, yAxisID: 'y'  },
    { label: 'Radiación (máx)',  data: dataRad,  yAxisID: 'y1' },
    { label: 'Lluvia (mm)',      data: dataLlu,  yAxisID: 'y1' },
  ]);

  // === Gráfico 2: Agregados por hora (temperatura promedio)
  const ctxH = document.getElementById('chartHora');
  const H = (aggHora.items || []);
  const labelsH = H.map(x =>
    fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle: 'short', timeStyle: 'short' })
  );
  const dataH = H.map(x => x.temp_avg ?? 0);
  chartHora = mkBar(ctxH, labelsH, 'Temp. promedio por hora (°C)', dataH);

  // === Gráfico 3: Agregados por día (lluvia total)
  const ctxD = document.getElementById('chartDia');
  const D = (aggDia.items || []);
  const labelsD = D.map(x =>
    fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle: 'medium' })
  );
  const dataD = D.map(x => x.lluvia_total ?? 0);
  chartDia = mkBar(ctxD, labelsD, 'Lluvia total por día (mm)', dataD);
})();
