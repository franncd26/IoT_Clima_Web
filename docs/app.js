// app.js — Punto 0 (fechas legibles) + Punto 1 (tema con etiqueta) + Punto 2 (filtro por fechas)

// ===== Utilidades de carga =====
async function loadJSON(path) { const r = await fetch(path, { cache: 'no-store' }); return r.json(); }
let chartLecturas, chartHora, chartDia;

// ===== Helpers de fecha (presentación) =====
const CR_TZ = 'America/Costa_Rica';
const fmtDate = (iso, opts = { dateStyle: 'short', timeStyle: 'short' }) =>
  new Intl.DateTimeFormat('es-CR', { timeZone: CR_TZ, ...opts }).format(new Date(iso));

// ===== Tema oscuro/claro =====
const THEME_KEY = 'iot_theme';
const applyTheme = (t) => document.documentElement.setAttribute('data-theme', t);
const getSavedTheme = () => localStorage.getItem(THEME_KEY);
const setSavedTheme = (t) => localStorage.setItem(THEME_KEY, t);
const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';
const toggleTheme = () => {
  const next = currentTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  setSavedTheme(next);
  recolorCharts();
  [chartLecturas, chartHora, chartDia].forEach(c => c?.update());

  const label = document.getElementById('themeLabel');
  if (label) label.textContent = `Tema: ${next === 'light' ? 'Claro' : 'Oscuro'}`;
};

// Init tema (preferencia almacenada si existe, si no por defecto 'dark')
(() => {
  const saved = getSavedTheme();
  applyTheme(saved || 'dark');
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);

  // Sincroniza etiqueta al cargar
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = `Tema: ${(saved || 'dark') === 'light' ? 'Claro' : 'Oscuro'}`;
})();

// ===== Colores desde CSS variables para Chart.js =====
const getCSSVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
function chartColors() {
  const text = getCSSVar('--text') || '#e6eefc';
  const grid = getCSSVar('--grid') || '#2a3b5e88';
  const accent = getCSSVar('--accent') || '#5da2ff';
  const muted = getCSSVar('--muted') || '#97a6c6';
  return { text, grid, accent, muted };
}

// Aplica colores actuales del tema a un chart (ticks/leyenda/grilla)
function applyColorsToChart(chart) {
  if (!chart) return;
  const { text, grid } = chartColors();
  const axes = chart.options?.scales || {};
  for (const k of Object.keys(axes)) {
    if (axes[k].ticks) axes[k].ticks.color = text;
    if (axes[k].grid)  axes[k].grid.color  = grid;
    if (axes[k].title) axes[k].title.color = text;
  }
  if (chart.options?.plugins?.legend?.labels) {
    chart.options.plugins.legend.labels.color = text;
  }
  if (chart.options?.plugins?.title) {
    chart.options.plugins.title.color = text;
  }
}

// Recolorea todos los charts
function recolorCharts() {
  [chartLecturas, chartHora, chartDia].forEach(applyColorsToChart);
}

// ===== Factories de gráficos =====
function mkMultiLine(ctx, labels, datasets){
  if (!ctx) return null;
  if (ctx._chart) ctx._chart.destroy();

  const { text, grid } = chartColors();

  const c = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { color: text } } },
      scales: {
        x:  { ticks:{ autoSkip:true, maxRotation:0, color:text }, grid:{ color:grid } },
        y:  { beginAtZero:false, position:'left',
              ticks:{ color:text }, grid:{ color:grid },
              title:{ display:true, text:'Temperatura (°C)', color:text } },
        y1: { beginAtZero:true,  position:'right', grid:{ drawOnChartArea:false, color:grid },
              ticks:{ color:text },
              title:{ display:true, text:'Lluvia (mm) / Radiación (W/m²)', color:text } }
      }
    }
  });
  ctx._chart = c;
  return c;
}

function mkBar(ctx, labels, seriesLabel, data){
  if (!ctx) return null;
  if (ctx._chart) ctx._chart.destroy();

  const { text, grid } = chartColors();

  const c = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: seriesLabel, data }] },
    options: {
      responsive: true,
      plugins: { legend: { display: true, labels: { color: text } } },
      scales: {
        x:{ ticks:{ autoSkip:true, maxRotation:0, color:text }, grid:{ color:grid } },
        y:{ beginAtZero:true, ticks:{ color:text }, grid:{ color:grid } }
      }
    }
  });
  ctx._chart = c;
  return c;
}

// ===== Estado y helpers de rango (Punto 2) =====
const State = {
  raw: { lecturas: [], aggHora: [], aggDia: [] },
  filtered: { lecturas: [], aggHora: [], aggDia: [] },
  range: { from: null, to: null }
};

function inRange(dateStr, from, to){
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < new Date(from + 'T00:00:00')) return false;
  if (to   && d > new Date(to   + 'T23:59:59')) return false;
  return true;
}

function setDateBounds(){
  const L = State.raw.lecturas;
  if (!L.length) return;
  const times = L
    .map(x => new Date(x.timestamp_local || x.timestamp))
    .filter(d => !Number.isNaN(d.getTime()))
    .sort((a,b)=>a-b);
  const toYMD = (d) => d.toISOString().slice(0,10);
  const min = toYMD(times[0]);
  const max = toYMD(times[times.length-1]);

  const fromEl = document.getElementById('dateFrom');
  const toEl   = document.getElementById('dateTo');
  if (fromEl){ fromEl.min = min; fromEl.max = max; if (!fromEl.value) fromEl.value = min; }
  if (toEl){   toEl.min   = min; toEl.max   = max; if (!toEl.value)   toEl.value   = max; }

  State.range.from = fromEl?.value || null;
  State.range.to   = toEl?.value   || null;
}

function applyRangeFilter(){
  const { from, to } = State.range;
  State.filtered.lecturas = State.raw.lecturas.filter(x => inRange(x.timestamp_local || x.timestamp, from, to));
  State.filtered.aggHora  = State.raw.aggHora .filter(x => inRange(x.from_ts_local || x.from_ts || x.doc_id, from, to));
  State.filtered.aggDia   = State.raw.aggDia  .filter(x => inRange(x.from_ts_local || x.from_ts || x.doc_id, from, to));
}

// ===== Carga y render inicial =====
(async function init(){
  const [lecturas, aggHora, aggDia] = await Promise.all([
    loadJSON('./lecturas.json'),
    loadJSON('./agg_hora.json'),
    loadJSON('./agg_dia.json'),
  ]);

  // Guarda los datos originales en el estado
  State.raw.lecturas = (lecturas.items || []);
  State.raw.aggHora  = (aggHora.items  || []);
  State.raw.aggDia   = (aggDia.items   || []);

  // Inicializa límites del selector y aplica filtro inicial
  setDateBounds();
  applyRangeFilter();

  // === Gráfico 1: Lecturas (30 min)
  {
    const ctxL = document.getElementById('chartLecturas');
    const L = State.filtered.lecturas;
    const labelsL = L.map(x => fmtDate(x.timestamp_local || x.timestamp));
    const dataTemp = L.map(x => x.temp ?? 0);
    const dataRad  = L.map(x => x.rad_max ?? 0);
    const dataLlu  = L.map(x => x.lluvia ?? 0);

    chartLecturas = mkMultiLine(ctxL, labelsL, [
      { label:'Temperatura (°C)', data:dataTemp, yAxisID:'y'  },
      { label:'Radiación (máx)',  data:dataRad,  yAxisID:'y1' },
      { label:'Lluvia (mm)',      data:dataLlu,  yAxisID:'y1' },
    ]);
  }

  // === Gráfico 2: Agregados por hora (temperatura promedio)
  {
    const ctxH = document.getElementById('chartHora');
    const H = State.filtered.aggHora;
    const labelsH = H.map(x => fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle:'short', timeStyle:'short' }));
    const dataH = H.map(x => x.temp_avg ?? 0);
    chartHora = mkBar(ctxH, labelsH, 'Temp. promedio por hora (°C)', dataH);
  }

  // === Gráfico 3: Agregados por día (lluvia total)
  {
    const ctxD = document.getElementById('chartDia');
    const D = State.filtered.aggDia;
    const labelsD = D.map(x => fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle:'medium' }));
    const dataD = D.map(x => x.lluvia_total ?? 0);
    chartDia = mkBar(ctxD, labelsD, 'Lluvia total por día (mm)', dataD);
  }

  // Aplicar colores por si el tema cargó desde localStorage
  recolorCharts();

  // ===== Listeners de filtros =====
  document.getElementById('applyRange')?.addEventListener('click', () => {
    State.range.from = document.getElementById('dateFrom').value || null;
    State.range.to   = document.getElementById('dateTo').value   || null;
    applyRangeFilter();

    // Refrescar gráficos
    const L = State.filtered.lecturas;
    chartLecturas.data.labels = L.map(x => fmtDate(x.timestamp_local || x.timestamp));
    chartLecturas.data.datasets[0].data = L.map(x => x.temp ?? 0);
    chartLecturas.data.datasets[1].data = L.map(x => x.rad_max ?? 0);
    chartLecturas.data.datasets[2].data = L.map(x => x.lluvia ?? 0);
    chartLecturas.update();

    const H = State.filtered.aggHora;
    chartHora.data.labels = H.map(x => fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle:'short', timeStyle:'short' }));
    chartHora.data.datasets[0].data = H.map(x => x.temp_avg ?? 0);
    chartHora.update();

    const D = State.filtered.aggDia;
    chartDia.data.labels = D.map(x => fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle:'medium' }));
    chartDia.data.datasets[0].data = D.map(x => x.lluvia_total ?? 0);
    chartDia.update();
  });

  document.getElementById('clearRange')?.addEventListener('click', () => {
    const fromEl = document.getElementById('dateFrom');
    const toEl   = document.getElementById('dateTo');
    fromEl.value = ''; toEl.value = '';
    State.range = { from:null, to:null };
    applyRangeFilter();

    // Refrescar gráficos
    const L = State.filtered.lecturas;
    chartLecturas.data.labels = L.map(x => fmtDate(x.timestamp_local || x.timestamp));
    chartLecturas.data.datasets[0].data = L.map(x => x.temp ?? 0);
    chartLecturas.data.datasets[1].data = L.map(x => x.rad_max ?? 0);
    chartLecturas.data.datasets[2].data = L.map(x => x.lluvia ?? 0);
    chartLecturas.update();

    const H = State.filtered.aggHora;
    chartHora.data.labels = H.map(x => fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle:'short', timeStyle:'short' }));
    chartHora.data.datasets[0].data = H.map(x => x.temp_avg ?? 0);
    chartHora.update();

    const D = State.filtered.aggDia;
    chartDia.data.labels = D.map(x => fmtDate(x.from_ts_local || x.from_ts || x.doc_id, { dateStyle:'medium' }));
    chartDia.data.datasets[0].data = D.map(x => x.lluvia_total ?? 0);
    chartDia.update();
  });
})();
