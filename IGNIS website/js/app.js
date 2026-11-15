(() => {
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* ---------- Starfield ---------- */
const sc = $('stars'), sx = sc.getContext('2d');
let stars = [];
function sizeStars(){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  sc.width = innerWidth*dpr; sc.height = innerHeight*dpr; sx.setTransform(dpr,0,0,dpr,0,0);
  const n = Math.round(innerWidth*innerHeight/4200);
  stars = Array.from({length:n}, () => ({x:Math.random()*innerWidth, y:Math.random()*innerHeight, r:Math.random()*1.3+.2, t:Math.random()*6.28, s:Math.random()*.02+.004, d:Math.random()*.08+.01}));
}
function drawStars(){
  sx.clearRect(0,0,innerWidth,innerHeight);
  for (const s of stars){
    s.t += s.s; if(!reduce){ s.x -= s.d; if (s.x < 0) s.x = innerWidth; }
    const a = .35 + .45*Math.abs(Math.sin(s.t));
    sx.fillStyle = `rgba(220,228,255,${a})`;
    sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, 6.283); sx.fill();
  }
}
sizeStars(); addEventListener('resize', sizeStars);

/* ---------- Flame renderer (qualitative) ---------- */
class Flame {
  constructor(canvas, opts={}){
    this.c = canvas; this.x = canvas.getContext('2d'); this.p = []; this.opts = opts; this.k = opts.scale || 1;
    this.params = {g:1, o2:21, flow:0, dir:1, quiescent:false, kind:'solid'};
    this.resize(); new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize(){
    const dpr = Math.min(window.devicePixelRatio||1, 2), r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height; this.c.width = r.width*dpr; this.c.height = r.height*dpr;
    this.x.setTransform(dpr,0,0,dpr,0,0);
  }
  vigor(){ // 0..~1.3 — qualitative intensity
    const {g,o2,flow,quiescent} = this.params;
    let v = clamp((o2-9)/22, 0.05, 1.35);
    const u = quiescent ? 0 : flow;
    if (g < 0.01 && u < 2) v *= 0.45;          // oxygen-starved diffusion flame
    if (u > 35 && o2 < 16) v *= 0.6;             // blow-off tendency near limit
    return v;
  }
  step(){
    const {g,o2,flow,dir,quiescent,kind} = this.params, w=this.w, h=this.h;
    if (!w) return;
    const gf = Math.sqrt(g), u = quiescent ? 0 : flow, v = this.vigor();
    const cx = w*.5, cy = g < 0.01 ? h*.55 : h*.78;
    const spawn = Math.round(4 + 12*v);
    for (let i=0;i<spawn;i++){
      const spread = kind==='droplet' || kind==='gas' ? 6 : w*.16;
      const a = Math.random()*6.283, sp = .35 + Math.random()*.5;
      this.p.push({
        x: cx + (Math.random()-.5)*spread*(g<0.01?0.25:1),
        y: cy + (Math.random()-.5)*4,
        vx: (Math.cos(a)*sp*(1-gf)*0.9 + (Math.random()-.5)*.3*gf)*this.k,
        vy: (Math.sin(a)*sp*(1-gf)*0.9 - .3*gf)*this.k,
        life: 1, decay: .012 + Math.random()*.012 + (1-v)*.01
      });
    }
    for (const p of this.p){
      p.vy -= .055*gf;                 // buoyancy
      p.vx += u*dir*.0025;             // forced flow
      p.vx *= .985; p.vy *= .985;
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
    }
    this.p = this.p.filter(p => p.life > 0 && p.y > -20 && p.x > -20 && p.x < w+20);
    if (this.p.length > 1600) this.p.splice(0, this.p.length-1600);
  }
  draw(){
    const ctx = this.x, w=this.w, h=this.h, {g,o2,kind,flow,dir,quiescent} = this.params;
    if (!w) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4,6,13,.38)'; ctx.fillRect(0,0,w,h);
    const gf = Math.sqrt(g), v = this.vigor();
    const soot = clamp(gf*1.05 + (o2-21)/35, 0, 1);           // yellow luminosity
    // fuel
    const cy = g < 0.01 ? h*.55 : h*.78;
    ctx.fillStyle = '#39406a';
    if (kind==='droplet'){ ctx.beginPath(); ctx.arc(w*.5, cy, 4, 0, 6.283); ctx.fill(); }
    else if (kind==='gas'){ ctx.fillRect(w*.5-3, cy, 6, h-cy); }
    else ctx.fillRect(w*.18, cy+3, w*.64, 5);
    // flow streaks
    const u = quiescent ? 0 : flow;
    if (u > 0){
      ctx.strokeStyle = 'rgba(124,196,255,.18)'; ctx.lineWidth = 1;
      const t = performance.now()/1000;
      for (let i=0;i<6;i++){
        const yy = h*(.15+i*.13), off = ((t*u*3*dir + i*57) % w + w) % w;
        ctx.beginPath(); ctx.moveTo(off, yy); ctx.lineTo(off + 22*dir, yy); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.p){
      const L = p.life, r = (4 + 11*v) * this.k * (0.5 + L*0.7) * (g<0.01?1.25:1);
      const hue = L > .75 ? 215 : 215 - (215-32)*soot*(1-(L-.1)/.65);
      const sat = 95, lig = 55 + 10*soot*(1-L);
      const alpha = clamp(L*0.16*(0.6+v*0.5), 0, .3) * (this.opts.glow || 1);
      ctx.fillStyle = `hsla(${hue},${sat}%,${lig}%,${alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    }
  }
}


/* ---------- Data ---------- */
const PSI = window.PSI;
if (!PSI){ document.body.insertAdjacentHTML('afterbegin', '<p style="position:relative;z-index:5;background:#5a1d0d;padding:12px;margin:0">data/psi_data.js did not load. Run <code>python scripts/build_data.py</code> and keep the data folder next to index.html.</p>'); return; }
const RUNS = PSI.runs, FAM = PSI.families, FUELS = PSI.fuels;
const POOL = RUNS.filter(r => !r.x);                     // runs usable for matching
const fmtInt = n => n.toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const median = a => { if (!a.length) return null; const s = [...a].sort((x,y) => x-y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const fmtNum = (v, d=1) => v == null ? '—' : (+v).toFixed(d).replace(/\.0+$/, '');
const kpa = v => `${Math.round(v)} kPa`;
const atm = v => (v/101.325).toFixed(2) + ' atm';

const ENV = {
  craft:{name:'Spacecraft cabin', g:0.000001},
  moon:{name:'Moon habitat', g:0.166},
  mars:{name:'Mars habitat', g:0.38},
  earth:{name:'Earth', g:1}
};
const CAT_LABEL = {solid:'solid', droplet:'droplet', gas:'gas-jet'};
const KIND = {solid:'solid', droplet:'droplet', gas:'gas'};

/* Per-category feature scales: the standard deviation of each variable in the matching pool. */
const std = a => { const m = a.reduce((s,v) => s+v, 0)/a.length; return Math.sqrt(a.reduce((s,v) => s+(v-m)**2, 0)/a.length) || 1; };
const SCALE = {};
for (const c of ['solid','droplet','gas']){
  const rs = POOL.filter(r => r.c === c);
  const o = rs.filter(r => r.o != null).map(r => r.o), p = rs.filter(r => r.p != null).map(r => Math.log(r.p)), v = rs.filter(r => r.v != null).map(r => r.v);
  SCALE[c] = {o: o.length > 1 ? Math.max(std(o), 1) : 3, p: p.length > 1 ? Math.max(std(p), .1) : .4, v: v.length > 1 ? Math.max(std(v), 2) : 10};
}
const MISSING = 1;     // a variable the run did not record counts as 1 standard deviation away
const FUEL_MISMATCH = 1.5;

/* Which variables can be matched: those the scenario sets AND that at least one run of the
   chosen fuel (or of the fuel type, for "any") records. A variable nobody recorded is skipped
   rather than counted against every run. */
function activeVars(s){
  const rs = POOL.filter(r => r.c === s.cat && (s.fuel === 'any' || r.u === s.fuel));
  const has = k => rs.some(r => r[k] != null);
  return {
    o: has('o'),
    p: s.p != null && has('p'),
    v: s.cat !== 'droplet' && s.dir !== 'quiescent' && has('v'),
    d: s.cat === 'solid' && (s.dir === 'concurrent' || s.dir === 'opposed') && has('d')
  };
}

/* ---------- Nearest-neighbour matching ---------- */
function distance(s, r, act){
  const sc = SCALE[s.cat], terms = [];
  if (act.o) terms.push(r.o == null ? MISSING : (r.o - s.o2)/sc.o);
  if (act.p) terms.push(r.p == null ? MISSING : (Math.log(r.p) - Math.log(s.p))/sc.p);
  if (act.v) terms.push(r.v == null ? MISSING : (r.v - s.flow)/sc.v);
  if (act.d) terms.push(r.d == null ? MISSING : r.d === s.dir ? 0 : 1.5);
  if (s.fuel !== 'any') terms.push(r.u === s.fuel ? 0 : FUEL_MISMATCH);
  return terms.length ? Math.sqrt(terms.reduce((a,t) => a + t*t, 0) / terms.length) : 0;
}
function match(s, k=10){
  const act = activeVars(s);
  const rs = POOL.filter(r => r.c === s.cat).map(r => ({r, d: distance(s, r, act)})).sort((a,b) => a.d - b.d);
  const close = rs.filter(x => x.d < 0.5).length;
  return {near: rs.slice(0, k), all: rs, close, act};
}
const simPct = d => Math.round(100*Math.exp(-d*d/2));

function confidence(s, m){
  let c = m.close >= 10 ? {t:'High · data-dense', c:'ok', lvl:3} : m.close >= 3 ? {t:'Moderate', c:'info', lvl:2} : m.close >= 1 ? {t:'Low · few close runs', c:'warn', lvl:1} : {t:'Outside tested range', c:'crit', lvl:0};
  if (ENV[s.env].g > 0.01 && c.lvl > 1) c = {t:'Low · gravity not tested', c:'warn', lvl:1};
  return c;
}

/* ---------- Outcome summary from the nearest runs ---------- */
function summarize(s, near){
  const rs = near.map(x => x.r), withOut = rs.filter(r => r.out && Object.keys(r.out).length);
  const res = {label:'Outcome', big:'No outcome recorded', sub:'', kv:[], short:'no outcomes recorded'};
  if (s.cat === 'droplet'){
    const flex = rs.filter(r => r.out && r.out.end);
    if (flex.length){
      const cnt = {}; flex.forEach(r => cnt[r.out.end] = (cnt[r.out.end]||0) + 1);
      const ext = cnt.Extinction || 0;
      res.label = 'How the nearest FLEX tests ended';
      res.big = `${ext} of ${flex.length} extinguished`;
      res.short = `${ext}/${flex.length} extinction`;
      res.sub = Object.entries(cnt).map(([k,v]) => `${k} ${v}`).join(' · ') + '. Disruption means the droplet broke apart; completion means it burned away.';
      const bt = median(flex.map(r => r.out.bt).filter(v => v != null)), K = median(flex.map(r => r.out.K).filter(v => v != null)), de = median(flex.map(r => r.out.dext).filter(v => v != null));
      if (bt != null) res.kv.push(['Median burn time', `${fmtNum(bt)} s`]);
      if (K != null) res.kv.push(['Median burning rate', `${fmtNum(K,2)} mm²/s`]);
      if (de != null) res.kv.push(['Median extinction diameter', `${fmtNum(de,2)} mm`]);
    }
    if (flex.length < rs.length) res.kv.push(['Runs without outcomes', `${rs.length - flex.length} (CFI lists conditions only)`]);
  } else if (s.cat === 'gas'){
    const cf = rs.filter(r => r.out && r.out.ign);
    if (cf.length){
      const yes = cf.filter(r => r.out.ign === 'yes').length;
      res.label = 'Hot-flame ignition in nearest CFI-G runs';
      res.big = `${yes} of ${cf.length} ignited`;
      res.short = `${yes}/${cf.length} ignited`;
      const se = cf.filter(r => r.out.term === 'SE').length, ft = cf.filter(r => r.out.term === 'FT').length;
      res.sub = `Of these, ${se} self-extinguished and ${ft} were ended by shutting off the fuel flow.`;
      const bt = median(cf.filter(r => r.out.ign === 'yes').map(r => r.out.bt).filter(v => v != null));
      if (bt != null) res.kv.push(['Median burn time (ignited)', `${fmtNum(bt)} s`]);
      const cool = cf.filter(r => r.out.cool).length;
      if (cool) res.kv.push(['Cool flames noted', String(cool)]);
    }
    const none = rs.length - cf.length;
    if (none) res.kv.push(['Runs without outcomes', `${none} (SPICE and Flame Design list conditions only)`]);
  } else {
    const timed = rs.filter(r => r.out && r.out.bt != null), o2drop = rs.filter(r => r.out && r.out.o2f != null && r.o != null);
    const spread = rs.filter(r => r.out && r.out.spread != null);
    if (timed.length){
      res.label = 'Burn time in the nearest Saffire runs';
      const insig = timed.filter(r => r.out.btNote === 'insignificant').length;
      res.big = insig === timed.length ? 'Did not sustain' : `${fmtNum(median(timed.map(r => r.out.bt)),0)} s median burn`;
      res.short = insig === timed.length ? 'no sustained burn' : `${fmtNum(median(timed.map(r => r.out.bt)),0)} s burn`;
      res.sub = `${timed.length} timed run${timed.length>1?'s':''}` + (insig ? `; ${insig} recorded as an insignificant burn.` : '.');
    } else if (o2drop.length){
      res.label = 'Chamber O₂ change in nearest BASS-II runs';
      const dm = median(o2drop.map(r => r.o - r.out.o2f));
      res.big = `${fmtNum(dm)} points O₂ used`;
      res.short = `${fmtNum(dm)} pt O₂ used`;
      res.sub = `Median drop in chamber O₂ between start and end of the run, across ${o2drop.length} runs. BASS-II records no burn time or spread rate, so this is the only burn indicator it gives.`;
    }
    if (spread.length) res.kv.push(['Microgravity spread rate', spread.map(r => `${fmtNum(r.out.spread)} mm/s`).join(', ')]);
    const g1 = rs.filter(r => r.out && r.out.g1Burn);
    if (g1.length) res.kv.push(['Same samples at 1 g', g1.map(r => `${esc(r.t)}: ${esc(r.out.g1Burn)}`).join('; ')]);
    if (o2drop.length && res.label.startsWith('Burn')) res.kv.push(['Median O₂ used (BASS-II)', `${fmtNum(median(o2drop.map(r => r.o - r.out.o2f)))} points`]);
    if (timed.length && !res.label.startsWith('Burn')) res.kv.push(['Saffire burn time', timed.map(r => r.out.btNote ? 'insignificant' : `${fmtNum(r.out.bt)} s`).join(', ')]);
    const none = rs.length - withOut.length;
    if (none) res.kv.push(['Runs without outcomes', `${none} (BASS lists samples only)`]);
  }
  if (res.big === 'No outcome recorded'){
    const fams = [...new Set(rs.map(r => FAM[r.f].name))].join(', ');
    const withData = Object.values(FAM).filter(f => f.cat === s.cat && f.nMatch && f.measured.length).map(f => f.name).join(', ');
    res.sub = `The nearest runs come from ${fams}, which list conditions but no outcomes.` + (withData ? ` Outcomes for this fuel type are recorded in ${withData}; choosing a fuel tested there gives an outcome summary.` : '');
  }
  return res;
}

/* ---------- State ---------- */
const state = {};
function read(){
  const cat = document.querySelector('input[name=cat]:checked').value;
  Object.assign(state, {
    env: document.querySelector('input[name=env]:checked').value,
    cat, fuel: $('fuel').value || 'any',
    o2: +$('o2').value, p: $('pOff').checked ? null : +$('press').value,
    flow: +$('flow').value, dir: $('dir').value
  });
  state.g = ENV[state.env].g;
  state.gcls = state.g < 0.01 ? 'micro' : state.g < 0.9 ? 'partial' : 'earth';
  return state;
}
const fmtG = g => g < 0.01 ? '~10⁻⁶' : g.toFixed(2);
const ub = g => 30*Math.sqrt(g);
function regime(s){
  const u = s.dir === 'quiescent' ? 0 : s.flow, b = ub(s.g);
  if (s.g < 0.01 && u < 2) return {label:'Diffusion-limited', cls:'crit'};
  const r = u / Math.max(b, 1e-6);
  if (r > 3) return {label:'Forced-flow dominated', cls:'info'};
  if (r < 0.33) return {label:'Buoyancy dominated', cls:'ok'};
  return {label:'Mixed convection', cls:'warn'};
}

/* ---------- Fuel select ---------- */
function fillFuels(){
  const cat = document.querySelector('input[name=cat]:checked').value, sel = $('fuel'), prev = sel.value;
  const opts = Object.entries(FUELS).filter(([,f]) => f.cat === cat && f.n > 0).sort((a,b) => b[1].n - a[1].n);
  const total = POOL.filter(r => r.c === cat).length;
  sel.innerHTML = opts.map(([k,f]) => `<option value="${k}">${esc(f.name)} · ${f.n} runs</option>`).join('') + `<option value="any">Any ${CAT_LABEL[cat]} fuel · ${total} runs</option>`;
  sel.value = opts.some(([k]) => k === prev) ? prev : opts[0][0];
}
function fuelName(s){ return s.fuel === 'any' ? `any ${CAT_LABEL[s.cat]} fuel` : FUELS[s.fuel].name; }

/* ---------- Readout (rule-based, labelled by source) ---------- */
function rangeOf(rs, k){ const v = rs.map(r => r[k]).filter(x => x != null); return v.length ? [Math.min(...v), Math.max(...v), v.length] : null; }
function readout(s, m){
  const out = [], rs = POOL.filter(r => r.c === s.cat && (s.fuel === 'any' || r.u === s.fuel));
  const D = 'data', P = 'phys', who = fuelName(s);
  // gravity
  if (s.gcls === 'micro') out.push({src:D, c:'', x:`All ${fmtInt(PSI.meta.runs)} runs were done in microgravity, so this scenario is the one the data covers.`});
  else out.push({src:D, c:'c', x:`No run in the dataset was done at ${fmtG(s.g)} g. Everything below comes from microgravity runs; treat it as a lower bound on buoyancy effects, not a ${ENV[s.env].name} measurement.`});
  if (s.gcls === 'partial') out.push({src:P, c:'w', x:`At ${fmtG(s.g)} g the buoyant flow is roughly ${ub(s.g).toFixed(0)} cm/s (rule of thumb, against about 30 cm/s on Earth), so a flame gets more oxygen from rising air than it would in orbit.`});
  if (s.gcls === 'micro' && s.dir === 'quiescent') out.push({src:P, c:'c', x:'With no buoyancy and no forced flow, oxygen reaches the flame only by diffusion, which is slow.'});
  // oxygen
  const ro = rangeOf(rs, 'o');
  if (!ro) out.push({src:D, c:'w', x:`No ${who} run records the oxygen level.`});
  else {
    const spiceOnly = rs.every(r => r.o == null || r.f === 'SPICE'), rtxt = ro[0] === ro[1] ? `${fmtNum(ro[0])}%` : `${fmtNum(ro[0])}–${fmtNum(ro[1])}%`;
    const tail = spiceOnly ? ' SPICE burns in air, so its O₂ is assumed, not measured.' : '';
    if (s.o2 < ro[0] - .5 || s.o2 > ro[1] + .5) out.push({src:D, c:'c', x:`${s.o2}% O₂ is outside the tested range for ${who} (${rtxt} across ${ro[2]} runs).${tail}`});
    else out.push({src:D, c:'', x:`${s.o2}% O₂ is inside the tested range for ${who} (${rtxt}, ${ro[2]} runs).${tail}`});
  }
  // pressure
  if (s.p != null){
    const rp = rangeOf(rs, 'p');
    if (!rp) out.push({src:D, c:'w', x:`No ${who} run records pressure, so pressure is not used for matching.`});
    else if (s.p < rp[0] || s.p > rp[1]) out.push({src:D, c:'c', x:`${kpa(s.p)} is outside the tested pressure range for ${who} (${kpa(rp[0])}–${kpa(rp[1])}).`});
    else out.push({src:D, c:'', x:`${kpa(s.p)} is inside the tested pressure range for ${who} (${kpa(rp[0])}–${kpa(rp[1])}, ${rp[2]} runs).`});
    out.push({src:P, c: s.o2 > 23 && s.p < 80 ? 'w' : '', x:`O₂ partial pressure: ${(s.p*s.o2/100).toFixed(1)} kPa (sea-level air ≈ 21.2 kPa).`});
  }
  // airflow
  if (s.cat !== 'droplet' && s.dir !== 'quiescent'){
    const rv = rangeOf(rs, 'v');
    if (!rv) out.push({src:D, c:'w', x:`No ${who} run records airflow in cm/s.`});
    else out.push({src:D, c: s.flow < rv[0] || s.flow > rv[1] ? 'c' : '', x:`Airflow was recorded in ${rv[2]} ${who} runs (${fmtNum(rv[0])}–${fmtNum(rv[1])} cm/s)${s.cat === 'gas' ? ', all SPICE co-flow air around a fuel jet, not cabin ventilation' : ''}.`});
  }
  if (s.cat === 'droplet') out.push({src:D, c:'', x:'The droplet runs were done in still gas, so airflow is not used for matching.'});
  // flow direction
  if (s.cat === 'solid' && (s.dir === 'concurrent' || s.dir === 'opposed')){
    const f = PSI.facts;
    out.push({src:D, c: s.dir === 'concurrent' ? 'w' : '', x:`In Saffire-I, the same SIBAL sheet burned ${fmtNum(f.saffireConc,0)} s with concurrent flow and ${fmtNum(f.saffireOpp,0)} s with opposed flow, both at 20 cm/s.`});
  }
  // fuel
  if (s.fuel !== 'any') out.push({src:D, c:'', x:`<strong>${esc(FUELS[s.fuel].name)}.</strong> ${esc(FUELS[s.fuel].note)} ${FUELS[s.fuel].n} runs from ${FUELS[s.fuel].fams.map(k => FAM[k].name).join(', ')}.`});
  return out;
}

/* ---------- Coverage chart ---------- */
const chart = $('chart'), cx = chart.getContext('2d');
let chartData = null;
function drawChart(){
  if (!chartData) return;
  const {s, m} = chartData, yk = document.querySelector('input[name=yax]:checked').value;
  const dpr = Math.min(window.devicePixelRatio||1, 2), r = chart.getBoundingClientRect(), W = r.width, H = r.height;
  if (!W) return;
  chart.width = W*dpr; chart.height = H*dpr; cx.setTransform(dpr,0,0,dpr,0,0);
  cx.clearRect(0,0,W,H);
  const L = 54, R = 12, T = 10, B = 34, strip = 18, pw = W-L-R, ph = H-T-B-strip;
  const xmin = 10, xmax = 42;
  const ylog = yk === 'p', ymin = ylog ? 40 : -6, ymax = ylog ? 560 : 90;
  const X = v => L + (v - xmin)/(xmax - xmin)*pw;
  const Y = v => ylog ? T + ph - (Math.log(v) - Math.log(ymin))/(Math.log(ymax) - Math.log(ymin))*ph : T + ph - (v - ymin)/(ymax - ymin)*ph;
  const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--ink-dim').trim(), line = css.getPropertyValue('--line').trim();
  cx.font = '11px "IBM Plex Mono", monospace'; cx.fillStyle = ink; cx.strokeStyle = line; cx.lineWidth = 1;
  // grid
  const xt = [12,16,20,24,28,32,36,40], yt = ylog ? [50,70,101,150,200,300,500] : [0,20,40,60,80];
  cx.textAlign = 'center';
  xt.forEach(v => { cx.globalAlpha = .5; cx.beginPath(); cx.moveTo(X(v), T); cx.lineTo(X(v), T+ph); cx.stroke(); cx.globalAlpha = 1; cx.fillText(v+'%', X(v), H-6); });
  cx.textAlign = 'right';
  yt.forEach(v => { cx.globalAlpha = .5; cx.beginPath(); cx.moveTo(L, Y(v)); cx.lineTo(L+pw, Y(v)); cx.stroke(); cx.globalAlpha = 1; cx.fillText(ylog ? v : v, L-6, Y(v)+4); });
  cx.save(); cx.translate(12, T+ph/2); cx.rotate(-Math.PI/2); cx.textAlign = 'center'; cx.fillText(ylog ? 'pressure, kPa (log)' : 'airflow, cm/s', 0, 0); cx.restore();
  cx.textAlign = 'left'; cx.fillText('O₂ %', L+pw-30, H-20 > T+ph+strip+4 ? H-20 : H-20);
  // "not recorded" strip
  const sy = T + ph + strip/2 + 2;
  cx.globalAlpha = .6; cx.setLineDash([3,4]); cx.beginPath(); cx.moveTo(L, T+ph+4); cx.lineTo(L+pw, T+ph+4); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
  cx.textAlign = 'right'; cx.fillText('n/r', L-6, sy+4);
  // points
  const nearSet = new Set(m.near.map(x => x.r));
  const pts = m.all.map(x => x.r).filter(r => r.o != null);
  const jitter = r => ((r.t.length*37 + (r.p||0)*13 + (r.v||0)*7) % 11 - 5);
  const pos = r => [X(r.o) + jitter(r)*.5, r[yk] == null ? sy + jitter(r)*.6 : Y(Math.max(r[yk], ymin))];
  const draw = (r, fill, rad) => { const [x,y] = pos(r); cx.fillStyle = fill; cx.beginPath(); cx.arc(x, y, rad, 0, 6.283); cx.fill(); };
  for (const r of pts) if (!(s.fuel === 'any' || r.u === s.fuel)) draw(r, 'rgba(154,163,196,.28)', 2.4);
  for (const r of pts) if (s.fuel === 'any' || r.u === s.fuel) draw(r, 'rgba(124,196,255,.75)', 3);
  for (const r of nearSet){ if (r.o == null) continue; const [x,y] = pos(r); cx.strokeStyle = '#ff8a3d'; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 6.283); cx.stroke(); }
  // scenario
  const sv = yk === 'p' ? s.p : s.flow;
  const ux = X(clamp(s.o2, xmin, xmax)), uy = sv == null ? sy : Y(clamp(sv, ymin, ymax));
  cx.strokeStyle = '#ffffff'; cx.lineWidth = 1.5; cx.setLineDash([4,4]);
  cx.beginPath(); cx.moveTo(ux, T); cx.lineTo(ux, T+ph); cx.stroke();
  if (sv != null){ cx.beginPath(); cx.moveTo(L, uy); cx.lineTo(L+pw, uy); cx.stroke(); }
  cx.setLineDash([]); cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(ux, uy, 5, 0, 6.283); cx.fill();
  const noO = m.all.filter(x => x.r.o == null).length, noY = pts.filter(r => r[yk] == null).length;
  $('chartNote').textContent = `${pts.length} ${CAT_LABEL[s.cat]} runs with an O₂ value are plotted` + (noY ? `; ${noY} of them ${noY === 1 ? 'has' : 'have'} no ${yk === 'p' ? 'pressure' : 'airflow'} and ${noY === 1 ? 'sits' : 'sit'} in the "n/r" (not recorded) strip` : '') + (noO ? `. ${noO} runs record no O₂ and are not shown.` : '.') + (yk === 'v' && s.cat === 'gas' ? ' Gas-jet airflow is SPICE co-flow.' : '');
}
addEventListener('resize', drawChart);
document.querySelectorAll('input[name=yax]').forEach(el => el.addEventListener('change', drawChart));

/* ---------- Evidence cards ---------- */
function runLine(r){
  const bits = [];
  if (r.o != null) bits.push(`O₂ ${fmtNum(r.o)}%`); else if (r.oRange) bits.push(`O₂ ${esc(r.oRange)}%`);
  if (r.p != null) bits.push(`${kpa(r.p)}`);
  if (r.v != null) bits.push(`${fmtNum(r.v)} cm/s${r.vk === 'coflow' ? ' co-flow' : ''}`);
  if (r.d) bits.push(r.d);
  if (r.dil) bits.push(`diluent ${r.dil}`);
  return bits.join(' · ') || 'no conditions recorded';
}
function outLine(r){
  const o = r.out || {}, b = [];
  if (o.end) b.push(o.end);
  if (o.ign) b.push(o.ign === 'yes' ? 'hot flame ignited' : o.ign === 'flash' ? 'flash only' : 'no ignition');
  if (o.term) b.push(o.term === 'SE' ? 'self-extinguished' : 'flow terminated');
  if (o.bt != null) b.push(o.btNote ? 'insignificant burn' : `burned ${fmtNum(o.bt)} s`);
  if (o.K != null) b.push(`K ${fmtNum(o.K,2)} mm²/s`);
  if (o.spread != null) b.push(`spread ${fmtNum(o.spread)} mm/s`);
  if (o.g1Burn) b.push(`1 g: ${esc(o.g1Burn)}`);
  if (o.o2f != null && r.o != null) b.push(`O₂ ${fmtNum(r.o)}→${fmtNum(o.o2f)}%`);
  if (o.cool) b.push('cool flame');
  if (o.color) b.push(esc(o.color));
  return b.join(' · ');
}
function renderNear(s, m){
  $('nearNote').textContent = `${m.all.length} ${CAT_LABEL[s.cat]} runs compared · ${m.close} within close range of your scenario. Variables are scaled by their spread in the data (O₂ σ ${fmtNum(SCALE[s.cat].o)} points).`;
  $('nearCards').innerHTML = m.near.slice(0, 8).map((x,i) => {
    const r = x.r, f = FAM[r.f], ol = outLine(r), sim = simPct(x.d);
    return `<article class="card">
      <div class="card-top">
        <div><div class="rank">#${i+1} · ${esc(f.name)} · ${esc(f.psi)}</div><h4>${esc(r.fr)}</h4></div>
        <div class="score">${sim}<small>% MATCH</small></div>
      </div>
      <div class="bar"><i style="width:${sim}%;background:linear-gradient(90deg,var(--plasma),var(--flame))"></i></div>
      <p class="mono" style="font-size:.78rem">${runLine(r)}</p>
      <p>${ol ? `<strong>Outcome:</strong> ${ol}` : '<em>No outcome recorded for this run.</em>'}</p>
      ${r.n ? `<p class="note">Note: ${esc(r.n)}</p>` : ''}
      <p class="srcline">Test ${esc(r.t)}${r.date ? ' · ' + r.date : ''} · ${esc(r.src)}</p>
    </article>`;
  }).join('');
}
function renderFamilies(s, m){
  const cnt = {}; m.near.forEach(x => cnt[x.r.f] = (cnt[x.r.f]||0) + 1);
  const order = Object.entries(FAM).sort((a,b) => (cnt[b[0]]||0) - (cnt[a[0]]||0) || (b[1].cat === s.cat) - (a[1].cat === s.cat) || b[1].nMatch - a[1].nMatch);
  const OUT = {end:'test end', bt:'burn time', K:'burning rate', dext:'extinction diameter', d0:'initial diameter', ign:'ignition', term:'termination', cool:'cool flames', color:'flame colour', spread:'spread rate', ugBurn:'µg burn length', g1Burn:'1 g burn length', g1Spread:'1 g spread', o2f:'final O₂', nIgn:'flames ignited', btNote:'burn note'};
  const rng = (a, u, d=1) => a ? `${fmtNum(a[0],d)}–${fmtNum(a[1],d)} ${u}` : '—';
  $('famCards').innerHTML = order.map(([k,f]) => {
    const used = f.nMatch > 0, n = cnt[k] || 0;
    const reason = RUNS.find(r => r.f === k && r.x);
    return `<article class="card ${f.cat === s.cat ? '' : 'dim'}">
      <div class="card-top">
        <div><div class="rank">${esc(f.psi)} · ${f.years ? f.years[0] + (f.years[1] !== f.years[0] ? '–' + f.years[1] : '') : 'undated'} · ${f.cat}</div><h4>${esc(f.name)}</h4></div>
        <div class="score">${n}<small>OF 10 NEAREST</small></div>
      </div>
      <p>${esc(f.full)}. ${esc(f.desc)}</p>
      <dl class="kv" style="margin:0">
        <dt>Runs</dt><dd class="mono">${f.n}${f.nMatch !== f.n ? ` (${f.nMatch} used for matching)` : ''}</dd>
        <dt>O₂</dt><dd class="mono">${f.o2 ? rng(f.o2,'%') : f.o2jet ? rng(f.o2jet,'% (jet)') : '—'}</dd>
        <dt>Pressure</dt><dd class="mono">${rng(f.p,'kPa',0)}</dd>
        <dt>Airflow</dt><dd class="mono">${rng(f.v,'cm/s')}</dd>
        <dt>Fuels</dt><dd>${Object.entries(f.fuels).slice(0,4).map(([n,c]) => `${esc(n)} (${c})`).join(', ')}</dd>
      </dl>
      <div class="chips">${f.measured.filter(x => OUT[x] && x !== 'btNote').map(x => `<span class="match y">${OUT[x]}</span>`).join('') || '<span class="match n">no outcomes</span>'}</div>
      ${used ? '' : `<p class="note">Not used for matching: ${esc(reason ? reason.x : 'no usable runs')}.</p>`}
    </article>`;
  }).join('');
}

/* ---------- Render ---------- */
const logPos = v => clamp((Math.log10(Math.max(v, .01)) + 2) / (Math.log10(90) + 2), 0, 1) * 100;
function update(){
  const s = read(), rg = regime(s), u = s.dir === 'quiescent' ? 0 : s.flow;
  // labels
  $('o2v').textContent = s.o2 + '%';
  $('pv').textContent = s.p == null ? 'not set' : `${kpa(s.p)} · ${atm(s.p)}`;
  $('press').disabled = $('pOff').checked;
  $('flowv').textContent = s.flow + ' cm/s';
  $('fuelNote').textContent = s.fuel === 'any' ? 'Matches any fuel of this type.' : FUELS[s.fuel].note;
  // HUD + flame
  $('hudEnv').textContent = ENV[s.env].name.toUpperCase(); $('hudG').textContent = fmtG(s.g); $('hudO2').textContent = s.o2 + '%';
  $('hudFlow').textContent = u + ' cm/s ' + (s.dir === 'opposed' ? '←' : u ? '→' : '');
  $('hudMat').textContent = (s.fuel === 'any' ? 'ANY ' + CAT_LABEL[s.cat] : FUELS[s.fuel].name).toUpperCase();
  const b = ub(s.g);
  $('ubv').textContent = (b < .1 ? b.toExponential(0) : b.toFixed(1)) + ' cm/s'; $('ufv').textContent = u + ' cm/s';
  $('ubBar').style.width = logPos(b) + '%'; $('ufBar').style.width = logPos(u) + '%';
  $('regimeTag').textContent = rg.label; $('regimeTag').className = 'tag ' + rg.cls;
  Object.assign(main.params, {g:s.g, o2:s.o2, flow:s.flow, dir: s.dir === 'opposed' ? -1 : 1, quiescent: s.dir === 'quiescent' || s.cat === 'droplet', kind:KIND[s.cat]});
  // matching
  const m = match(s), sum = summarize(s, m.near), conf = confidence(s, m);
  $('confTag').textContent = conf.t; $('confTag').className = 'tag ' + conf.c;
  $('outLabel').textContent = sum.label; $('outBig').textContent = sum.big;
  $('outSub').textContent = sum.sub;
  const avg = m.near.length ? Math.round(m.near.reduce((a,x) => a + simPct(x.d), 0)/m.near.length) : 0;
  $('outKv').innerHTML = [['Nearest runs used', `${m.near.length} · average match ${avg}%`], ['Runs in close range', String(m.close)], ...sum.kv].map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('interp').innerHTML = readout(s, m).map(i => `<li class="${i.c}"><span class="src ${i.src}">${i.src === 'data' ? 'DATA' : 'PHYSICS'}</span> ${i.x}</li>`).join('');
  chartData = {s, m}; drawChart();
  renderNear(s, m); renderFamilies(s, m);
  syncCompare();
}

/* ---------- Compare ---------- */
function side(id){
  const s = {...state, o2: +$('o2'+id).value, p: state.p == null ? null : +$('p'+id).value, flow: +$('flow'+id).value};
  $('o2'+id+'v').textContent = s.o2 + '%'; $('p'+id+'v').textContent = state.p == null ? 'not set' : kpa(+$('p'+id).value); $('flow'+id+'v').textContent = s.flow + ' cm/s';
  $('p'+id).disabled = state.p == null;
  const m = match(s), sum = summarize(s, m.near), conf = confidence(s, m);
  $('cmpTag'+id).textContent = conf.t; $('cmpTag'+id).className = 'tag ' + conf.c;
  $('cmpOut'+id).innerHTML = `<div class="lbl" style="margin:0">${esc(sum.label)}</div><div class="big sm">${esc(sum.big)}</div><p class="hint">${m.close} runs in close range</p>`;
  Object.assign(cmp[id].params, {g:s.g, o2:s.o2, flow:s.flow, dir: s.dir === 'opposed' ? -1 : 1, quiescent: s.dir === 'quiescent' || s.cat === 'droplet', kind:KIND[s.cat]});
  return {s, m, sum, conf};
}
function syncCompare(){
  const A = side('A'), B = side('B'), d = [];
  $('cmpEnv').textContent = `${ENV[state.env].name} · ${fuelName(state)}`;
  if (A.sum.big !== B.sum.big) d.push({c:'', x:`<strong>Nearest-run outcome:</strong> ${esc(A.sum.big)} → ${esc(B.sum.big)}.`});
  else d.push({c:'', x:`<strong>Nearest-run outcome is the same on both sides</strong> (${esc(A.sum.big)}).`});
  if (A.m.close !== B.m.close) d.push({c: Math.min(A.m.close, B.m.close) < 3 ? 'w' : '', x:`<strong>Data coverage:</strong> ${A.m.close} close runs for A, ${B.m.close} for B.${Math.min(A.m.close, B.m.close) < 3 ? ' The side with fewer close runs is poorly supported.' : ''}`});
  if (A.s.o2 !== B.s.o2 && state.p != null) d.push({c:'', x:`<strong>O₂ partial pressure:</strong> ${(A.s.p*A.s.o2/100).toFixed(1)} → ${(B.s.p*B.s.o2/100).toFixed(1)} kPa.`});
  const shared = A.m.near.filter(x => B.m.near.some(y => y.r === x.r)).length;
  d.push({c:'', x:`<strong>Overlap:</strong> ${shared} of the 10 nearest runs are shared, so ${shared >= 7 ? 'the two scenarios draw on mostly the same evidence' : shared >= 3 ? 'the evidence partly overlaps' : 'each side draws on different runs'}.`});
  d.push({c:'', x:'<strong>Confidence.</strong> These compare recorded outcomes of nearby runs; no rate is computed from a model.'});
  $('delta').innerHTML = d.map(i => `<li class="${i.c}">${i.x}</li>`).join('');
}

/* ---------- Static stats from the data ---------- */
function fillStats(){
  const M = PSI.meta, F = PSI.facts;
  document.querySelectorAll('[data-stat]').forEach(el => el.textContent = fmtInt(M[el.dataset.stat]));
  $('telMicro').textContent = fmtInt(M.runs); $('envMicroN').textContent = fmtInt(M.runs);
  ['solid','droplet','gas'].forEach(c => $('catN-'+c).textContent = `${M.cats[c]} runs`);
  $('factFlexN').textContent = `${F.flexExt} of ${F.flexN}`;
  $('factFlex').textContent = `FLEX droplet flames ended in extinction; ${F.flexDis} ended with the droplet breaking apart and ${F.flexComp} burned to completion.`;
  $('factSaffN').textContent = `${fmtNum(F.saffireConc,0)} s vs ${fmtNum(F.saffireOpp,0)} s`;
  $('factSaff').textContent = 'Saffire-I burn time for the same fabric sheet in concurrent versus opposed airflow at 20 cm/s, inside a Cygnus spacecraft.';
  $('factSiliN').textContent = `${F.siliconeInsig} of ${F.siliconeN}`;
  $('factSili').textContent = `Saffire-II silicone samples barely burned in microgravity at 20 cm/s, while ${F.silicone1gComplete} of the same samples burned completely in 1 g tests. Earth tests are not always the gentler case.`;
  const kv = [
    ['Source', `${esc(M.source)} · ${fmtInt(M.rows)} rows from ${M.families} investigations`],
    ['Runs kept', `${fmtInt(M.runs)} (${M.dupesDropped} exact duplicate rows dropped)`],
    ['Used for matching', `${fmtInt(M.matchRuns)} · solid ${M.cats.solid}, droplet ${M.cats.droplet}, gas jet ${M.cats.gas}`],
    ['Not used for matching', `${fmtInt(M.runs - M.matchRuns)}: smoke experiments, test-design summaries, day summaries, inverse flames and cleaning runs`],
    ['Gravity', Object.entries(M.gravity).map(([k,v]) => `${esc(k)}: ${fmtInt(v)}`).join(', ')],
    ['Ambient O₂ range', `${fmtNum(M.o2[0])}–${fmtNum(M.o2[1])}%`],
    ['Pressure range', `${kpa(M.p[0])}–${kpa(M.p[1])}`],
    ['Airflow range', `${fmtNum(M.v[0])}–${fmtNum(M.v[1])} cm/s (negative values are as recorded in SPICE)`],
    ['Years', `${M.years[0]}–${M.years[1]}`],
    ['Assumptions', 'SPICE co-flow is air, so its O₂ is set to 20.9%. Rows giving only a shape (rod, sphere, film) are kept as "material not stated". Inverse-flame O₂ is the jet\'s, not the atmosphere\'s.']
  ];
  $('dataKv').innerHTML = kv.map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

/* ---------- Wire up ---------- */
const main = new Flame($('mainFlame'));
const cmp = {A: new Flame($('flameA')), B: new Flame($('flameB'))};
const heroE = new Flame($('heroEarth')); Object.assign(heroE.params, {g:1, o2:21, flow:0});
const heroM = new Flame($('heroMicro')); Object.assign(heroM.params, {g:0.000001, o2:21, flow:3});
const land = new Flame($('landingFlame'), {scale:2.4, glow:.42}); Object.assign(land.params, {g:0.000001, o2:24, flow:2.5, kind:'droplet'});
const flames = [land, heroE, heroM, main, cmp.A, cmp.B];

fillStats(); fillFuels();
document.querySelectorAll('input[name=cat]').forEach(el => el.addEventListener('change', () => { fillFuels(); update(); }));
document.querySelectorAll('#scenario input, #scenario select').forEach(el => el.addEventListener('input', update));
['o2A','pA','flowA','o2B','pB','flowB'].forEach(id => $(id).addEventListener('input', syncCompare));
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const hab = b.dataset.preset === 'habitat';
  $('o2').value = hab ? 34 : 21; $('press').value = hab ? 56.5 : 101; $('pOff').checked = false; update();
}));
$('scenario').addEventListener('submit', e => e.preventDefault());

update();
for (let i=0;i<90;i++) flames.forEach(f => f.step());

function loop(){
  drawStars();
  flames.forEach(f => { f.step(); f.draw(); });
  requestAnimationFrame(loop);
}
if (reduce){ drawStars(); flames.forEach(f => f.draw()); setInterval(() => flames.forEach(f => { f.step(); f.draw(); }), 120); }
else loop();
})();
