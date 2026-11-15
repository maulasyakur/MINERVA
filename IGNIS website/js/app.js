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

/* ---------- Domain data ---------- */
const ENV = {
  general:{name:'General exploration', g:null, cls:null},
  earth:{name:'Earth', g:1, cls:'earth'},
  mars:{name:'Mars habitat', g:0.38, cls:'partial'},
  moon:{name:'Moon habitat', g:0.166, cls:'partial'},
  craft:{name:'Spacecraft cabin', g:0.000001, cls:'micro'}
};
const MAT = {
  pe:{name:'Polyethylene', cls:'plastic', kind:'solid', note:'Polyethylene is a thermoplastic that melts before it burns. On Earth the melt drips away from the flame; with weaker gravity the molten fuel tends to stay with the burning region, so melt behavior is a key uncertainty.'},
  pmma:{name:'PMMA (acrylic)', cls:'plastic', kind:'solid', note:'PMMA is one of the most studied reference fuels in microgravity flame-spread work, so comparable data are relatively plentiful.'},
  sibal:{name:'Cotton-fiberglass fabric', cls:'thin', kind:'solid', note:'Thin fabrics heat through quickly, so flames spread over them faster than over thick plastics under the same conditions.'},
  nomex:{name:'Nomex fabric', cls:'thin', kind:'solid', note:'Nomex is a flame-resistant aramid fabric; it typically needs enriched oxygen to sustain burning.'},
  paper:{name:'Filter paper', cls:'thin', kind:'solid', note:'Thin cellulose fuels are classic flame-spread test materials and ignite readily.'},
  silicone:{name:'Silicone rubber', cls:'plastic', kind:'solid', note:'Silicone leaves an insulating silica ash layer that can slow further burning.'},
  droplet:{name:'Liquid fuel droplet', cls:'liquid', kind:'droplet', note:'Without buoyancy, isolated fuel droplets burn inside a near-spherical flame, which is why droplet combustion is a classic microgravity experiment.'},
  gas:{name:'Gaseous fuel jet', cls:'gas', kind:'gas', note:'Gas-jet diffusion flames in microgravity grow wider and rounder, and burn with less yellow soot glow near the tip.'}
};
const LIB = [
  {name:'Saffire (Spacecraft Fire Safety Experiments)', platform:'Uncrewed Cygnus vehicle', desc:'Large-scale fire spread tests run inside Cygnus cargo vehicles after they departed the ISS, the largest fires deliberately lit in space.', g:['micro'], mats:['thin','plastic'], forced:true, quiescent:false, o2varied:false, pVaried:false, outcome:'Flame spread and growth over large samples'},
  {name:'BASS / BASS-II (Burning and Suppression of Solids)', platform:'ISS Microgravity Science Glovebox', desc:'Small solid samples burned under controlled low-speed airflow to see how flames spread and how they can be extinguished.', g:['micro'], mats:['thin','plastic'], forced:true, quiescent:false, o2varied:true, pVaried:false, outcome:'Spread behavior and flammability limits'},
  {name:'SoFIE (Solid Fuel Ignition and Extinction)', platform:'ISS Combustion Integrated Rack', desc:'Studies of how solid materials ignite, grow and go out in microgravity when oxygen, pressure and flow are varied.', g:['micro'], mats:['thin','plastic'], forced:true, quiescent:false, o2varied:true, pVaried:true, outcome:'Ignition and extinction limits'},
  {name:'FLEX / FLEX-2 (Flame Extinguishment Experiment)', platform:'ISS Combustion Integrated Rack', desc:'Burning fuel droplets in still air; these runs revealed long-lived "cool flames" that continue after the visible flame goes out.', g:['micro'], mats:['liquid'], forced:false, quiescent:true, o2varied:true, pVaried:true, outcome:'Droplet burning and extinction'},
  {name:'ACME (Advanced Combustion via Microgravity Experiments)', platform:'ISS Combustion Integrated Rack', desc:'A set of gaseous-flame investigations covering soot formation, flame structure and extinction.', g:['micro'], mats:['gas'], forced:true, quiescent:false, o2varied:true, pVaried:false, outcome:'Gas flame structure and soot'},
  {name:'Reduced-gravity flights & drop towers', platform:'Parabolic aircraft, drop towers', desc:'Short-duration ground-based tests; parabolic flights can hold lunar and Martian gravity levels for tens of seconds.', g:['micro','partial'], mats:['thin','plastic','liquid','gas'], forced:true, quiescent:true, o2varied:true, pVaried:false, outcome:'Short-duration partial-g data'},
  {name:'NASA-STD-6001 Test 1 (Upward flammability)', platform:'Ground laboratory, 1 g', desc:'The standard upward flame-propagation test used to screen spacecraft materials in their worst-case use atmosphere.', g:['earth'], mats:['thin','plastic'], forced:false, quiescent:false, o2varied:true, pVaried:true, outcome:'Pass/fail material screening'}
];

/* ---------- State ---------- */
const state = {};
function read(){
  const env = document.querySelector('input[name=env]:checked').value;
  const gSel = $('gravity');
  gSel.disabled = env !== 'general';
  if (env !== 'general') gSel.value = String(ENV[env].g);
  const g = parseFloat(gSel.value);
  Object.assign(state, {
    env, g, gcls: g < 0.01 ? 'micro' : g < 0.9 ? 'partial' : 'earth',
    mat: $('material').value, o2: +$('o2').value, flow: +$('flow').value,
    p: $('pressure').value ? parseFloat($('pressure').value) : null, dir: $('dir').value
  });
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

/* ---------- Analysis ---------- */
function analyze(s){
  const out = [], m = MAT[s.mat], rg = regime(s), u = s.dir === 'quiescent' ? 0 : s.flow;
  // gravity
  if (s.gcls === 'micro'){
    out.push({t:'Gravity', c: u < 2 ? 'c':'' , x: u < 2
      ? 'With almost no buoyancy and no forced flow, oxygen reaches the flame only by slow diffusion. Comparable experiments show such flames often starve and go out, but they can also smolder or reignite when ventilation returns.'
      : `In microgravity the cabin ventilation, here ${u} cm/s, replaces buoyancy as the oxygen supply. Low-speed flows of this order are the conditions in which microgravity tests have found materials to be most flammable.`});
  } else if (s.gcls === 'partial'){
    out.push({t:'Gravity', c:'w', x:`At ${fmtG(s.g)} g the buoyant plume is weaker than on Earth (about ${ub(s.g).toFixed(0)} cm/s versus 30 cm/s by this scaling), so the flame is taller and slower-moving. Partial-gravity combustion data are scarce, so this behavior is interpolated between 1 g and microgravity results.`});
  } else {
    out.push({t:'Gravity', c:'', x:'At 1 g buoyancy drives a strong upward flow that feeds oxygen to the flame and carries hot gas away, which gives the familiar teardrop flame shape.'});
  }
  // oxygen
  if (s.o2 < 16) out.push({t:'Oxygen', c:'w', x:`At ${s.o2}% O₂ many materials will not sustain a flame in normal gravity. Microgravity studies have found that some materials still burn below their 1 g oxygen limit when a gentle flow is present, so a low concentration alone is not a guarantee of safety.`});
  else if (s.o2 <= 23) out.push({t:'Oxygen', c:'', x:`${s.o2}% O₂ is close to normal air, the baseline condition for most ground and ISS tests.`});
  else out.push({t:'Oxygen', c:'c', x:`${s.o2}% O₂ is enriched relative to air. Higher oxygen concentration generally widens the range of materials that burn and speeds up flame spread, which is the main fire-safety concern for reduced-pressure, oxygen-enriched habitat atmospheres.`});
  // pressure
  if (s.p){
    const pp = s.p * s.o2/100;
    out.push({t:'Pressure', c: s.p < 80 && s.o2 > 23 ? 'w' : '', x:`At ${s.p} kPa the oxygen partial pressure is ${pp.toFixed(1)} kPa (sea-level air is about 21.2 kPa). Flammability tends to follow the oxygen concentration more closely than the partial pressure, so a low-pressure, high-concentration atmosphere can still be more flammable than sea-level air.`});
  }
  // flow direction
  if (s.dir === 'concurrent') out.push({t:'Flow direction', c:'w', x:'Concurrent flow pushes hot gases ahead over unburned fuel, so flames typically grow and accelerate along the sample.'});
  if (s.dir === 'opposed') out.push({t:'Flow direction', c:'', x:'Opposed flow meets the flame head-on; spread is usually slower and steadier, and strong opposed flow at low oxygen can blow the flame out.'});
  if (s.dir === 'quiescent') out.push({t:'Flow direction', c: s.gcls==='micro'?'c':'', x:'With no forced flow, the only oxygen supply is buoyancy and diffusion.'});
  // material
  out.push({t:m.name, c:'', x:m.note});
  return {items:out, rg};
}

function renderAnalysis(){
  const s = read(), a = analyze(s);
  $('interp').innerHTML = a.items.map(i => `<li class="${i.c}"><strong>${i.t}.</strong> ${i.x}</li>`).join('');
  const miss = [];
  if (!s.p) miss.push('Pressure');
  if (!s.dir) miss.push('Flow direction');
  $('missing').innerHTML = miss.length ? miss.map(x => `<span class="tag warn">${x}</span>`).join('') : '<span class="tag ok">None</span>';
  $('predReason').textContent = (miss.length ? `Missing ${miss.join(' and ').toLowerCase()}; ` : '') + 'no validated spread-rate model has been fitted to the indexed dataset yet.';
  const conf = miss.length ? {t:'Low · qualitative', c:'warn'} : {t:'Moderate · qualitative', c:'info'};
  $('confTag').textContent = conf.t; $('confTag').className = 'tag ' + conf.c;
  $('ppo2').textContent = s.p ? `${(s.p*s.o2/100).toFixed(1)} kPa` : 'Needs pressure';
  $('gap').textContent = s.gcls === 'partial' ? 'Few long-duration partial-gravity tests exist; results are interpolated.'
    : s.gcls === 'micro' ? 'Microgravity data exist, mostly for small samples and short burns.'
    : 'Ground data are plentiful at 1 g.';
  $('results').classList.remove('is-stale');
  renderEvidence();
}

/* ---------- Live HUD & regime ---------- */
const logPos = v => clamp((Math.log10(Math.max(v, .01)) + 2) / (Math.log10(60) + 2), 0, 1) * 100;
function live(){
  const s = read(), m = MAT[s.mat], rg = regime(s), u = s.dir === 'quiescent' ? 0 : s.flow;
  $('o2v').textContent = s.o2 + '%'; $('flowv').textContent = s.flow + ' cm/s';
  $('hudEnv').textContent = ENV[s.env].name.toUpperCase();
  $('hudG').textContent = fmtG(s.g); $('hudO2').textContent = s.o2 + '%';
  $('hudFlow').textContent = u + ' cm/s ' + (s.dir === 'opposed' ? '←' : u ? '→' : '');
  $('hudMat').textContent = m.name.toUpperCase();
  const b = ub(s.g);
  $('ubv').textContent = (b < .1 ? b.toExponential(0) : b.toFixed(1)) + ' cm/s';
  $('ufv').textContent = u + ' cm/s';
  $('ubBar').style.width = logPos(b) + '%'; $('ufBar').style.width = logPos(u) + '%';
  $('regimeTag').textContent = rg.label; $('regimeTag').className = 'tag ' + rg.cls;
  const fp = {g:s.g, o2:s.o2, flow:s.flow, dir: s.dir === 'opposed' ? -1 : 1, quiescent: s.dir === 'quiescent', kind:m.kind};
  Object.assign(main.params, fp);
  syncCompare();
}

/* ---------- Evidence ranking ---------- */
let dataset = null;
function conditions(s){
  const c = [{k:'Gravity', f: e => e.g.includes(s.gcls)}, {k:'Material type', f: e => e.mats.includes(MAT[s.mat].cls)}];
  if (s.dir === 'quiescent') c.push({k:'Quiescent air', f: e => e.quiescent});
  else if (s.dir) c.push({k:'Forced flow', f: e => e.forced});
  if (s.o2 < 19 || s.o2 > 23) c.push({k:'Non-air O₂', f: e => e.o2varied});
  if (s.p && s.p < 100) c.push({k:'Reduced pressure', f: e => e.pVaried});
  return c;
}
function renderEvidence(){
  const s = state;
  if (dataset) return renderDataset(s);
  const conds = conditions(s);
  const ranked = LIB.map(e => {
    const hits = conds.map(c => ({k:c.k, y:c.f(e)}));
    return {e, hits, score: hits.filter(h => h.y).length / hits.length};
  }).sort((a,b) => b.score - a.score);
  $('sourceNote').textContent = `Built-in reference set of ${LIB.length} NASA experiment families · scored on ${conds.length} conditions from your scenario. Load a CSV above to rank your own indexed runs.`;
  $('cards').innerHTML = ranked.map((r,i) => `
    <article class="card">
      <div class="card-top">
        <div><div class="rank">#${i+1} · ${r.e.platform}</div><h4>${r.e.name}</h4></div>
        <div class="score">${Math.round(r.score*100)}<small>% MATCH</small></div>
      </div>
      <div class="bar"><i style="width:${r.score*100}%;background:linear-gradient(90deg,var(--plasma),var(--flame))"></i></div>
      <p>${r.e.desc}</p>
      <div class="chips">${r.hits.map(h => `<span class="match ${h.y?'y':'n'}">${h.k}</span>`).join('')}</div>
      <p class="mono" style="font-size:.74rem">OUTCOME · ${r.e.outcome}</p>
    </article>`).join('');
}

/* CSV indexing */
function parseCSV(text){
  const rows = []; let row = [], cell = '', q = false;
  for (let i=0;i<text.length;i++){
    const ch = text[i];
    if (q){ if (ch === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ','){ row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
const findCol = (h, pats) => h.findIndex(x => pats.some(p => p.test(x)));
$('csv').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  const rows = parseCSV(await f.text());
  if (rows.length < 2){ $('sourceNote').textContent = `${f.name} has no data rows. Choose a CSV with a header row and at least one run.`; return; }
  const header = rows[0].map(x => x.replace(/^﻿/, '').trim());
  const h = header.map(x => x.toLowerCase());
  const col = {
    o2: findCol(h, [/^o2/, /oxygen/, /(^|[^c])o2/]),
    flow: findCol(h, [/flow.*(cm|speed|vel)/, /velocity/, /air.?speed/, /^(air)?flow$/]),
    g: findCol(h, [/grav/, /g.?level/, /^g$/]),
    p: findCol(h, [/press/, /kpa/, /(^|_)psi[ag]?$/]),
    mat: findCol(h, [/material/, /^fuel$/, /fuel.?name/, /sample/]),
    cat: findCol(h, [/category/, /fuel.?type/, /fuel.?class/]),
    ds: findCol(h, [/^dataset$/, /experiment/, /^campaign$/]),
    exp: findCol(h, [/test.?(id|#|no|num)/, /^test$/, /^id$/, /^run/, /name/]),
    out: findCol(h, [/spread/, /burn.?rate/, /outcome/, /extinct/, /result/])
  };
  // pressure unit from the column name: atm and psi are converted to kPa
  const ph = col.p >= 0 ? h[col.p] : '';
  const pScale = /atm/.test(ph) ? 101.325 : /psi/.test(ph) ? 6.89476 : 1;
  dataset = {name: f.name, header, rows: rows.slice(1), col, pScale};
  renderEvidence();
});
function renderDataset(s){
  const {rows, col, header, name, pScale} = dataset;
  const num = (r,i) => {
    if (i < 0) return NaN;
    const m = String(r[i]).match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  };
  // gravity may be a number (in g) or a description such as "microgravity (flight)"
  const grav = (r,i) => {
    const n = num(r,i); if (!isNaN(n)) return n;
    const t = i < 0 ? '' : String(r[i]).toLowerCase();
    if (/micro|orbit|flight|iss|space/.test(t)) return 1e-6;
    if (/lunar|moon/.test(t)) return 0.166;
    if (/mars|martian/.test(t)) return 0.38;
    if (/earth|normal|ground|1\s*g/.test(t)) return 1;
    return NaN;
  };
  const M = MAT[s.mat];
  const matTerms = [M.name.toLowerCase().split(/[ (]/)[0], ...(s.mat.length > 3 ? [s.mat] : [])];
  const catRe = {plastic:/solid/, thin:/solid/, liquid:/liquid|droplet/, gas:/gas/}[M.cls];
  const lab = (k, v) => [k, v];
  const scored = rows.map(r => {
    const parts = [];   // a condition the run does not report scores 0
    if (col.o2 >= 0){ const o2 = num(r,col.o2); parts.push(lab('O₂', isNaN(o2) ? 0 : 1 - clamp(Math.abs(o2 - s.o2)/20, 0, 1))); }
    if (col.flow >= 0 && s.dir !== 'quiescent'){ const fl = num(r,col.flow); parts.push(lab('Airflow', isNaN(fl) ? 0 : 1 - clamp(Math.abs(fl - s.flow)/30, 0, 1))); }
    if (col.g >= 0){ const g = grav(r,col.g); parts.push(lab('Gravity', isNaN(g) ? 0 : 1 - clamp(Math.abs(Math.log10(Math.max(g,1e-6)) - Math.log10(s.g))/6, 0, 1))); }
    if (col.p >= 0 && s.p){ const p = num(r,col.p)*pScale; parts.push(lab('Pressure', isNaN(p) ? 0 : 1 - clamp(Math.abs(p - s.p)/60, 0, 1))); }
    if (col.mat >= 0 || col.cat >= 0){
      const mt = col.mat >= 0 ? String(r[col.mat]).toLowerCase() : '';
      const ct = col.cat >= 0 ? String(r[col.cat]).toLowerCase() : '';
      parts.push(lab('Material', matTerms.some(t => mt.includes(t)) ? 1 : catRe && catRe.test(ct) ? 0.5 : 0));
    }
    const score = parts.length ? parts.reduce((a,b) => a + b[1], 0)/parts.length : 0;
    return {r, parts, score};
  }).sort((a,b) => b.score - a.score).slice(0, 6);
  const found = Object.entries(col).filter(([,v]) => v >= 0).map(([k,v]) => header[v]).join(', ') || 'none';
  $('sourceNote').textContent = `Indexed ${rows.length} runs from ${name} · matched columns: ${found}${pScale !== 1 ? ' (pressure converted to kPa)' : ''}. Scores compare each run's conditions with your scenario; a condition a run does not report counts as no match.`;
  const cell = (r,i) => i >= 0 && String(r[i]).trim() !== '' ? String(r[i]).trim() : '—';
  const title = x => {
    const ds = cell(x.r,col.ds), id = cell(x.r,col.exp);
    if (ds !== '—' && id !== '—') return `${ds} · test ${id}`;
    return ds !== '—' ? ds : id !== '—' ? id : 'Run ' + (rows.indexOf(x.r)+1);
  };
  $('cards').innerHTML = scored.map((x,i) => `
    <article class="card">
      <div class="card-top">
        <div><div class="rank">#${i+1} · ${name}</div><h4>${title(x)}</h4></div>
        <div class="score">${Math.round(x.score*100)}<small>% MATCH</small></div>
      </div>
      <div class="bar"><i style="width:${x.score*100}%;background:linear-gradient(90deg,var(--plasma),var(--flame))"></i></div>
      <dl class="kv" style="margin:0">
        ${col.mat>=0?`<dt>${header[col.mat]}</dt><dd>${cell(x.r,col.mat)}</dd>`:''}
        ${col.cat>=0?`<dt>${header[col.cat]}</dt><dd>${cell(x.r,col.cat)}</dd>`:''}
        ${col.o2>=0?`<dt>${header[col.o2]}</dt><dd class="mono">${cell(x.r,col.o2)}</dd>`:''}
        ${col.flow>=0?`<dt>${header[col.flow]}</dt><dd class="mono">${cell(x.r,col.flow)}</dd>`:''}
        ${col.g>=0?`<dt>${header[col.g]}</dt><dd class="mono">${cell(x.r,col.g)}</dd>`:''}
        ${col.p>=0?`<dt>${header[col.p]}</dt><dd class="mono">${cell(x.r,col.p)}</dd>`:''}
        ${col.out>=0?`<dt>${header[col.out]}</dt><dd class="mono">${cell(x.r,col.out)}</dd>`:''}
      </dl>
      <div class="chips">${x.parts.map(([k,v]) => `<span class="match ${v>.6?'y':'n'}">${k}</span>`).join('')}</div>
    </article>`).join('');
}

/* ---------- Compare ---------- */
function syncCompare(){
  const s = state, m = MAT[s.mat];
  for (const side of ['A','B']){
    const o2 = +$('o2'+side).value, fl = +$('flow'+side).value;
    $('o2'+side+'v').textContent = o2 + '%'; $('flow'+side+'v').textContent = fl + ' cm/s';
    const fl2 = s.dir === 'quiescent' ? 0 : fl;
    Object.assign(cmp[side].params, {g:s.g, o2, flow:fl, dir: s.dir === 'opposed' ? -1 : 1, quiescent: s.dir === 'quiescent', kind:m.kind});
    const rg = regime({...s, o2, flow:fl});
    $('cmpTag'+side).textContent = rg.label; $('cmpTag'+side).className = 'tag ' + rg.cls;
  }
  $('cmpEnv').textContent = `${ENV[s.env].name} · ${fmtG(s.g)} g · ${m.name}`;
  const a = {o2:+$('o2A').value, f:+$('flowA').value}, b = {o2:+$('o2B').value, f:+$('flowB').value};
  const d = [];
  if (b.o2 !== a.o2){
    const up = b.o2 > a.o2;
    d.push({c: up ? 'w' : '', x:`<strong>Oxygen ${a.o2}% → ${b.o2}%.</strong> ${up ? 'B is expected to burn more vigorously: a larger, brighter flame and faster spread, with a wider margin above the extinction limit.' : 'B moves closer to the extinction limit: a smaller, dimmer flame that is easier to blow out or starve.'}${s.p ? ` O₂ partial pressure goes from ${(s.p*a.o2/100).toFixed(1)} to ${(s.p*b.o2/100).toFixed(1)} kPa.` : ''}`});
  }
  if (b.f !== a.f && s.dir !== 'quiescent'){
    const micro = s.g < 0.01;
    d.push({c:'', x:`<strong>Airflow ${a.f} → ${b.f} cm/s.</strong> ${micro
      ? (Math.min(a.f,b.f) < 2 ? 'Near zero flow in microgravity starves the flame of oxygen, so the side with more flow is the one likely to keep burning.' : 'In microgravity the flow is the oxygen supply; flammability tends to peak at low speeds and fall again as stronger flow cools or blows out the flame.')
      : `Compared with the ~${ub(s.g).toFixed(0)} cm/s buoyant flow at this gravity, ${Math.max(a.f,b.f) > ub(s.g) ? 'the stronger setting starts to dominate the flame shape.' : 'both settings remain secondary to buoyancy.'}`}`});
  }
  if (!d.length) d.push({c:'', x:'The two scenarios are identical. Move an oxygen or airflow slider on either side to compare.'});
  d.push({c:'', x:'<strong>Confidence.</strong> These are directional, qualitative differences drawn from experiment patterns; no spread rate is computed for either side.'});
  $('delta').innerHTML = d.map(i => `<li class="${i.c}">${i.x}</li>`).join('');
}

/* ---------- Wire up ---------- */
const main = new Flame($('mainFlame'));
const cmp = {A: new Flame($('flameA')), B: new Flame($('flameB'))};
const heroE = new Flame($('heroEarth')); Object.assign(heroE.params, {g:1, o2:21, flow:0});
const heroM = new Flame($('heroMicro')); Object.assign(heroM.params, {g:0.000001, o2:21, flow:3});
const land = new Flame($('landingFlame'), {scale:2.4, glow:.42}); Object.assign(land.params, {g:0.000001, o2:24, flow:2.5, kind:'droplet'});
const flames = [land, heroE, heroM, main, cmp.A, cmp.B];

document.querySelectorAll('#scenario input, #scenario select').forEach(el => {
  el.addEventListener('input', () => { live(); $('results').classList.add('is-stale'); });
});
['o2A','flowA','o2B','flowB'].forEach(id => $(id).addEventListener('input', syncCompare));
$('scenario').addEventListener('submit', e => {
  e.preventDefault(); renderAnalysis();
  if (!reduce) $('results').animate([{opacity:.6},{opacity:1}], {duration:350});
});

live(); renderAnalysis();
// warm up flames so the first frame is populated
for (let i=0;i<90;i++) flames.forEach(f => f.step());

function loop(){
  drawStars();
  flames.forEach(f => { f.step(); f.draw(); });
  requestAnimationFrame(loop);
}
if (reduce){ drawStars(); flames.forEach(f => f.draw()); setInterval(() => flames.forEach(f => { f.step(); f.draw(); }), 120); }
else loop();
})();
