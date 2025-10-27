// app.js — versión simplificada: un solo gráfico de lecturas + min/max + CSV

// ===== Utilidades de carga =====
async function loadJSON(path) { const r = await fetch(path, { cache: 'no-store' }); return r.json(); }
let chartLecturas;

// ===== Helpers de fecha (presentación) =====
const CR_TZ = 'America/Costa_Rica';
const fmtDate = (iso, opts = { dateStyle: 'short', timeStyle: 'short' }) => {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return new Intl.DateTimeFormat('es-CR', { timeZone: CR_TZ, ...opts }).format(d);
};

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
  chartLecturas?.update();
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = `Tema: ${next === 'light' ? 'Claro' : 'Oscuro'}`;
};

// Init tema
(() => {
  const saved = getSavedTheme();
  applyTheme(saved || 'dark');
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = `Tema: ${(saved || 'dark') === 'light' ? 'Claro' : 'Oscuro'}`;
})();

// ===== Colores para Chart.js =====
const getCSSVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
function chartColors() {
  const text = getCSSVar('--text') || '#e6eefc';
  const grid = getCSSVar('--grid') || '#2a3b5e88';
  const accent = getCSSVar('--accent') || '#5da2ff';
  const muted = getCSSVar('--muted') || '#97a6c6';
  return { text, grid, accent, muted };
}
function applyColorsToChart(chart) {
  if (!chart) return;
  const { text, grid } = chartColors();
  const axes = chart.options?.scales || {};
  for (const k of Object.keys(axes)) {
    if (axes[k].ticks) axes[k].ticks.color = text;
    if (axes[k].grid)  axes[k].grid.color  = grid;
    if (axes[k].title) axes[k].title.color = text;
  }
  if (chart.options?.plugins?.legend?.labels)
    chart.options.plugins.legend.labels.color = text;
  if (chart.options?.plugins?.title)
    chart.options.plugins.title.color = text;
}
function recolorCharts() { applyColorsToChart(chartLecturas); }

// ===== Chart principal =====
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
      plugins: {
        legend: { display: true, labels: { color: text } },
        title:  { display: false }
      },
      scales: {
        x:  { ticks:{ autoSkip:true, maxRotation:0, color:text }, grid:{ color:grid } },
        y:  { beginAtZero:false, position:'left',
              ticks:{ color:text }, grid:{ color:grid },
              title:{ display:true, text:'Temperatura (°C)', color:text } },
        y1: { beginAtZero:true,  position:'right',
              grid:{ drawOnChartArea:false, color:grid },
              ticks:{ color:text },
              title:{ display:true, text:'Lluvia (mm) / Radiación (W/m²)', color:text } }
      }
    }
  });
  ctx._chart = c;
  return c;
}


// === Min/max ===
function minMaxWithTs(arr, key){
  let minVal = null, maxVal = null, minTs = null, maxTs = null;
  for (const o of arr){
    const v = Number(o[key]);
    if (!Number.isFinite(v)) continue;
    const ts = o.timestamp_local || o.timestamp;
    if (minVal === null || v < minVal){ minVal = v; minTs = ts; }
    if (maxVal === null || v > maxVal){ maxVal = v; maxTs = ts; }
  }
  return { minVal, minTs, maxVal, maxTs };
}
function setStat(idVal, idTs, val, ts, unit){
  const valEl = document.getElementById(idVal);
  const tsEl  = document.getElementById(idTs);
  if (!valEl || !tsEl) return;
  if (val == null){ valEl.textContent = '–'; tsEl.textContent  = ''; }
  else { valEl.textContent = `${val.toFixed(2)} ${unit}`; tsEl.textContent  = `(${fmtDate(ts)})`; }
}
function computeAndRenderStats(){
  const L = State.filtered.lecturas;
  const t = minMaxWithTs(L, 'temp');
  setStat('tempMinVal','tempMinTs', t.minVal, t.minTs, '°C');
  setStat('tempMaxVal','tempMaxTs', t.maxVal, t.maxTs, '°C');
  const ll = minMaxWithTs(L, 'lluvia');
  setStat('lluviaMinVal','lluviaMinTs', ll.minVal, ll.minTs, 'mm');
  setStat('lluviaMaxVal','lluviaMaxTs', ll.maxVal, ll.maxTs, 'mm');
  const r = minMaxWithTs(L, 'rad_max');
  setStat('radMinVal','radMinTs', r.minVal, r.minTs, 'W/m²');
  setStat('radMaxVal','radMaxTs', r.maxVal, r.maxTs, 'W/m²');
}

// ===== Estado y filtros =====
const State = {
  raw: { lecturas: [] },
  filtered: { lecturas: [] },
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
  const times = L.map(x => new Date(x.timestamp_local || x.timestamp)).filter(d => !isNaN(d)).sort((a,b)=>a-b);
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
}

// ===== Descarga CSV =====
function toCSV(arr){
  const cols = ['fecha_local','temp','lluvia','rad_max'];
  const header = cols.join(',');
  if (!arr.length) return header + '\n';
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const lines = arr.map(o => {
    const raw = o.timestamp_local ?? o.timestamp ?? '';
    const fecha = raw ? fmtDate(raw, { dateStyle:'short', timeStyle:'short' }) : '';
    const row = [fecha, o.temp, o.lluvia, o.rad_max].map(esc);
    return row.join(',');
  });
  return [header, ...lines].join('\n');
}
function downloadCSV(){
  const csv = toCSV(State.filtered.lecturas);
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lecturas_${State.range.from || 'inicio'}_${State.range.to || 'fin'}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// ===== Carga y render inicial =====
(async function init(){
  const lecturas = await loadJSON('./lecturas.json');
  State.raw.lecturas = (lecturas.items || []);

  setDateBounds();
  applyRangeFilter();

  const L = State.filtered.lecturas;
  chartLecturas = mkMultiLine(
    document.getElementById('chartLecturas'),
    L.map(x => fmtDate(x.timestamp_local || x.timestamp)),
    [
      { label:'Temperatura (°C)', data:L.map(x => x.temp ?? 0),    yAxisID:'y'  },
      { label:'Radiación (máx)',  data:L.map(x => x.rad_max ?? 0), yAxisID:'y1' },
      { label:'Lluvia (mm)',      data:L.map(x => x.lluvia ?? 0),  yAxisID:'y1' },
    ]
  );


  recolorCharts();
  computeAndRenderStats();

  document.getElementById('applyRange')?.addEventListener('click', () => {
    State.range.from = document.getElementById('dateFrom').value || null;
    State.range.to   = document.getElementById('dateTo').value   || null;
    applyRangeFilter();
    const L = State.filtered.lecturas;
    chartLecturas.data.labels = L.map(x => fmtDate(x.timestamp_local || x.timestamp));
    chartLecturas.data.datasets[0].data = L.map(x => x.temp ?? 0);
    chartLecturas.data.datasets[1].data = L.map(x => x.rad_max ?? 0);
    chartLecturas.data.datasets[2].data = L.map(x => x.lluvia ?? 0);
    chartLecturas.update();
    computeAndRenderStats();
  });

  document.getElementById('clearRange')?.addEventListener('click', () => {
    const fromEl = document.getElementById('dateFrom');
    const toEl   = document.getElementById('dateTo');
    fromEl.value = ''; toEl.value = '';
    State.range = { from:null, to:null };
    applyRangeFilter();
    const L = State.filtered.lecturas;
    chartLecturas.data.labels = L.map(x => fmtDate(x.timestamp_local || x.timestamp));
    chartLecturas.data.datasets[0].data = L.map(x => x.temp ?? 0);
    chartLecturas.data.datasets[1].data = L.map(x => x.rad_max ?? 0);
    chartLecturas.data.datasets[2].data = L.map(x => x.lluvia ?? 0);
    chartLecturas.update();
    computeAndRenderStats();
  });

  document.getElementById('downloadCSV')?.addEventListener('click', downloadCSV);
})();
