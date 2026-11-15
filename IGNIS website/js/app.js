(() => {
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- Starfield ---------- */
const sc = $('stars'), sx = sc.getContext('2d'); let stars = [];
function sizeStars(){
  const dpr = Math.min(devicePixelRatio||1, 2);
  sc.width = innerWidth*dpr; sc.height = innerHeight*dpr; sx.setTransform(dpr,0,0,dpr,0,0);
  stars = Array.from({length:Math.round(innerWidth*innerHeight/4200)}, () => ({x:Math.random()*innerWidth, y:Math.random()*innerHeight, r:Math.random()*1.3+.2, t:Math.random()*6.28, s:Math.random()*.02+.004, d:Math.random()*.08+.01}));
}
function drawStars(){
  sx.clearRect(0,0,innerWidth,innerHeight);
  for (const s of stars){ s.t += s.s; if(!reduce){ s.x -= s.d; if (s.x < 0) s.x = innerWidth; }
    sx.fillStyle = `rgba(220,228,255,${.35 + .45*Math.abs(Math.sin(s.t))})`; sx.beginPath(); sx.arc(s.x,s.y,s.r,0,6.283); sx.fill(); }
}
sizeStars(); addEventListener('resize', sizeStars);

/* ---------- Flame renderer (qualitative) ---------- */
class Flame {
  constructor(canvas, opts={}){
    this.c = canvas; this.x = canvas.getContext('2d'); this.p = []; this.opts = opts; this.k = opts.scale || 1;
    this.params = {g:1, o2:21, flow:0, dir:1, quiescent:false, kind:'solid', vigor:null};
    this.resize(); new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize(){ const dpr = Math.min(devicePixelRatio||1, 2), r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height; this.c.width = r.width*dpr; this.c.height = r.height*dpr; this.x.setTransform(dpr,0,0,dpr,0,0); }
  vigor(){
    if (this.params.vigor != null) return this.params.vigor;
    const {g,o2,flow,quiescent} = this.params; let v = clamp((o2-9)/22, .05, 1.35);
    if (g < .01 && (quiescent ? 0 : flow) < 2) v *= .45; return v;
  }
  step(){
    const {g,flow,dir,quiescent,kind} = this.params, w=this.w, h=this.h; if (!w) return;
    const gf = Math.sqrt(g), u = quiescent ? 0 : flow, v = this.vigor();
    const cx = w*.5, cy = g < .01 ? h*.55 : h*.78, n = Math.round(4 + 12*v);
    for (let i=0;i<n;i++){
      const spread = kind === 'solid' ? w*.16 : 6, a = Math.random()*6.283, sp = .35 + Math.random()*.5;
      this.p.push({x: cx + (Math.random()-.5)*spread*(g<.01?.25:1), y: cy + (Math.random()-.5)*4,
        vx:(Math.cos(a)*sp*(1-gf)*.9 + (Math.random()-.5)*.3*gf)*this.k, vy:(Math.sin(a)*sp*(1-gf)*.9 - .3*gf)*this.k,
        life:1, decay:.012 + Math.random()*.012 + (1-Math.min(v,1))*.01});
    }
    for (const p of this.p){ p.vy -= .055*gf; p.vx += u*dir*.0025; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.life -= p.decay; }
    this.p = this.p.filter(p => p.life > 0 && p.y > -20 && p.x > -20 && p.x < w+20);
    if (this.p.length > 1600) this.p.splice(0, this.p.length-1600);
  }
  draw(){
    const ctx = this.x, w=this.w, h=this.h, {g,o2,kind,flow,dir,quiescent} = this.params; if (!w) return;
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(4,6,13,.38)'; ctx.fillRect(0,0,w,h);
    const gf = Math.sqrt(g), v = this.vigor(), soot = clamp(gf*1.05 + (o2-21)/35, 0, 1), cy = g < .01 ? h*.55 : h*.78;
    ctx.fillStyle = '#39406a';
    if (kind === 'droplet'){ ctx.beginPath(); ctx.arc(w*.5, cy, 4, 0, 6.283); ctx.fill(); }
    else if (kind === 'gas') ctx.fillRect(w*.5-3, cy+4, 6, h-cy);
    else ctx.fillRect(w*.18, cy+3, w*.64, 5);
    const u = quiescent ? 0 : flow;
    if (u > 0){ ctx.strokeStyle = 'rgba(124,196,255,.18)'; ctx.lineWidth = 1; const t = performance.now()/1000;
      for (let i=0;i<6;i++){ const yy = h*(.15+i*.13), off = ((t*u*3*dir + i*57) % w + w) % w; ctx.beginPath(); ctx.moveTo(off,yy); ctx.lineTo(off+22*dir,yy); ctx.stroke(); } }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.p){
      const L = p.life, r = (4 + 11*Math.min(v,1.3)) * (.5 + L*.7) * (g<.01?1.25:1) * this.k;
      const hue = (L > .78 || soot < .3) ? 215 : 28 + 22*L;
      ctx.fillStyle = `hsla(${hue},95%,${55 + 10*soot*(1-L)}%,${clamp(L*.16*(.6+v*.5),0,.3)*(this.opts.glow||1)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    }
  }
}

/* ---------- Data (built by scripts/build_data.py) ---------- */
const PSI = window.PSI;
if (!PSI){ document.body.insertAdjacentHTML('afterbegin', '<p style="position:relative;z-index:5;background:#5a1d0d;padding:12px;margin:0">data/psi_data.js did not load. Run <code>python scripts/build_data.py</code> and keep the data folder next to index.html.</p>'); return; }
const RUNS = PSI.runs, FAM = PSI.families, FUELS = PSI.fuels;
const POOL = RUNS.filter(r => !r.x);                     // runs usable for matching
const fmtInt = n => n.toLocaleString('en-US');
const median = a => { if (!a.length) return null; const s = [...a].sort((x,y) => x-y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const fmtNum = (v, d=1) => v == null ? '—' : (+v).toFixed(d).replace(/\.0+$/, '');
const kpa = v => `${Math.round(v)} kPa`;

const ENV = {
  general:{name:'Not-specified habitat', g:null, orb:'o-general'},
  earth:{name:'Earth', g:1, orb:'o-earth'},
  moon:{name:'Moon', g:0.166, orb:'o-moon'},
  mars:{name:'Mars', g:0.38, orb:'o-mars'},
  craft:{name:'Spacecraft cabin', g:0.000001, orb:'o-craft'}
};
const CAT_LABEL = {solid:'solid', droplet:'droplet', gas:'gas-jet'};

/* ---------- Nearest-neighbour matching ---------- */
const std = a => { const m = a.reduce((s,v) => s+v, 0)/a.length; return Math.sqrt(a.reduce((s,v) => s+(v-m)**2, 0)/a.length) || 1; };
const SCALE = {};
for (const c of ['solid','droplet','gas']){
  const rs = POOL.filter(r => r.c === c);
  const o = rs.filter(r => r.o != null).map(r => r.o), p = rs.filter(r => r.p != null).map(r => Math.log(r.p)), v = rs.filter(r => r.v != null).map(r => r.v);
  SCALE[c] = {o: o.length > 1 ? Math.max(std(o), 1) : 3, p: p.length > 1 ? Math.max(std(p), .1) : .4, v: v.length > 1 ? Math.max(std(v), 2) : 10};
}
const MISSING = 1;      // a variable the run did not record counts as 1 standard deviation away
const FUEL_MISMATCH = 1.5;
const uForced = s => s.dir === 'quiescent' ? 0 : s.flow;

/* A variable is matched only if the scenario sets it and at least one run of the chosen fuel
   (or fuel type, for "any") records it; otherwise it is skipped, not counted against every run. */
function activeVars(s){
  const rs = POOL.filter(r => r.c === s.cat && (s.fuel === 'any' || r.u === s.fuel)), has = k => rs.some(r => r[k] != null);
  return {o: has('o'), p: s.p != null && has('p'), v: s.cat !== 'droplet' && s.dir !== 'quiescent' && has('v'),
          d: s.cat === 'solid' && (s.dir === 'concurrent' || s.dir === 'opposed') && has('d')};
}
function distance(s, r, act){
  const sc = SCALE[s.cat], t = [];
  if (act.o) t.push(r.o == null ? MISSING : (r.o - s.o2)/sc.o);
  if (act.p) t.push(r.p == null ? MISSING : (Math.log(r.p) - Math.log(s.p))/sc.p);
  if (act.v) t.push(r.v == null ? MISSING : (r.v - s.flow)/sc.v);
  if (act.d) t.push(r.d == null ? MISSING : r.d === s.dir ? 0 : 1.5);
  if (s.fuel !== 'any') t.push(r.u === s.fuel ? 0 : FUEL_MISMATCH);
  return t.length ? Math.sqrt(t.reduce((a,x) => a + x*x, 0)/t.length) : 0;
}
function match(s, k=10){
  const act = activeVars(s);
  const all = POOL.filter(r => r.c === s.cat).map(r => ({r, d: distance(s, r, act)})).sort((a,b) => a.d - b.d);
  return {near: all.slice(0, k), all, close: all.filter(x => x.d < .5).length, act};
}
const simPct = d => Math.round(100*Math.exp(-d*d/2));
function confidence(s, m){
  let c = m.close >= 10 ? {t:'High · data-dense', c:'ok', lvl:3} : m.close >= 3 ? {t:'Moderate', c:'info', lvl:2} : m.close >= 1 ? {t:'Low · few close runs', c:'warn', lvl:1} : {t:'Outside tested range', c:'crit', lvl:0};
  if (s.g > .01 && c.lvl > 1) c = {t:'Low · gravity not tested', c:'warn', lvl:1};
  return c;
}

/* ---------- Outcome summary from the nearest runs ---------- */
function summarize(s, near){
  const rs = near.map(x => x.r), withOut = rs.filter(r => r.out && Object.keys(r.out).length);
  const res = {kind:'none', label:'Outcome', big:'No outcome recorded', sub:'', kv:[], short:'no outcomes'};
  if (s.cat === 'droplet'){
    const flex = rs.filter(r => r.out && r.out.end);
    if (flex.length){
      const cnt = {}; flex.forEach(r => cnt[r.out.end] = (cnt[r.out.end]||0) + 1);
      const ext = cnt.Extinction || 0;
      Object.assign(res, {kind:'flex', share: ext/flex.length, label:'How the nearest FLEX tests ended', big:`${ext} of ${flex.length} extinguished`, short:`${ext}/${flex.length} extinguished`,
        sub: Object.entries(cnt).map(([k,v]) => `${k} ${v}`).join(' · ') + '. Disruption means the droplet broke apart; completion means it burned away.'});
      const bt = median(flex.map(r => r.out.bt).filter(v => v != null)), K = median(flex.map(r => r.out.K).filter(v => v != null)), de = median(flex.map(r => r.out.dext).filter(v => v != null));
      res.K = K;
      if (bt != null) res.kv.push(['Median burn time', `${fmtNum(bt)} s`]);
      if (K != null) res.kv.push(['Median burning rate K', `${fmtNum(K,2)} mm²/s`]);
      if (de != null) res.kv.push(['Median extinction diameter', `${fmtNum(de,2)} mm`]);
    }
    if (flex.length < rs.length) res.kv.push(['Runs without outcomes', `${rs.length - flex.length} (CFI lists conditions only)`]);
  } else if (s.cat === 'gas'){
    const cf = rs.filter(r => r.out && r.out.ign);
    if (cf.length){
      const yes = cf.filter(r => r.out.ign === 'yes').length, se = cf.filter(r => r.out.term === 'SE').length, ft = cf.filter(r => r.out.term === 'FT').length;
      Object.assign(res, {kind:'cfig', share: yes/cf.length, label:'Hot-flame ignition in nearest CFI-G runs', big:`${yes} of ${cf.length} ignited`, short:`${yes}/${cf.length} ignited`,
        sub:`Of these, ${se} self-extinguished and ${ft} were ended by shutting off the fuel flow.`});
      const bt = median(cf.filter(r => r.out.ign === 'yes').map(r => r.out.bt).filter(v => v != null));
      if (bt != null) res.kv.push(['Median burn time (ignited)', `${fmtNum(bt)} s`]);
      const cool = cf.filter(r => r.out.cool).length;
      if (cool) res.kv.push(['Cool flames noted', String(cool)]);
    }
    if (rs.length - cf.length) res.kv.push(['Runs without outcomes', `${rs.length - cf.length} (SPICE and Flame Design list conditions only)`]);
  } else {
    const timed = rs.filter(r => r.out && r.out.bt != null), o2drop = rs.filter(r => r.out && r.out.o2f != null && r.o != null), spread = rs.filter(r => r.out && r.out.spread != null);
    if (timed.length){
      const insig = timed.filter(r => r.out.btNote === 'insignificant').length, mbt = median(timed.map(r => r.out.bt));
      Object.assign(res, {kind:'saffire', share: insig/timed.length, label:'Burn time in the nearest Saffire runs',
        big: insig === timed.length ? 'Did not sustain' : `${fmtNum(mbt,0)} s median burn`, short: insig === timed.length ? 'no sustained burn' : `${fmtNum(mbt,0)} s burn`,
        sub:`${timed.length} timed run${timed.length > 1 ? 's' : ''}` + (insig ? `; ${insig} recorded as an insignificant burn.` : '.')});
    } else if (o2drop.length){
      const dm = median(o2drop.map(r => r.o - r.out.o2f));
      Object.assign(res, {kind:'bass', label:'Chamber O₂ change in nearest BASS-II runs', big:`${fmtNum(dm)} points O₂ used`, short:`${fmtNum(dm)} pt O₂ used`,
        sub:`Median drop in chamber O₂ between start and end of the run, across ${o2drop.length} runs. BASS-II records no burn time or spread rate.`});
    }
    if (spread.length) { res.spread = spread.map(r => r.out.spread); res.kv.push(['Microgravity spread rate', spread.map(r => `${fmtNum(r.out.spread)} mm/s`).join(', ')]); }
    const g1 = rs.filter(r => r.out && r.out.g1Burn);
    if (g1.length) res.kv.push(['Same samples at 1 g', g1.map(r => `${esc(r.t)}: ${esc(r.out.g1Burn)}`).join('; ')]);
    if (o2drop.length && res.kind === 'saffire') res.kv.push(['Median O₂ used (BASS-II)', `${fmtNum(median(o2drop.map(r => r.o - r.out.o2f)))} points`]);
    if (rs.length - withOut.length) res.kv.push(['Runs without outcomes', `${rs.length - withOut.length} (BASS lists samples only)`]);
  }
  if (res.kind === 'none'){
    const fams = [...new Set(rs.map(r => FAM[r.f].name))].join(', ');
    const withData = Object.values(FAM).filter(f => f.cat === s.cat && f.nMatch && f.measured.length).map(f => f.name).join(', ');
    res.sub = `The nearest runs come from ${fams}, which list conditions but no outcomes.` + (withData ? ` Outcomes for this fuel type are recorded in ${withData}; choosing a fuel tested there gives an outcome summary.` : '');
  }
  return res;
}

/* ---------- Physics approximation (kept from the original layout, now labelled as physics) ---------- */
const ub = g => 30*Math.sqrt(g);                         // buoyant velocity scale, cm/s, cm-sized flame
const gcls = g => g < .01 ? 'micro' : g < .9 ? 'partial' : 'earth';
const fmtG = g => g < .01 ? '~10⁻⁶' : g.toFixed(2);
function regime(s){
  const u = uForced(s), b = ub(s.g);
  if (s.g < .01 && u < 2) return {label:'Diffusion-limited', cls:'crit'};
  const r = u / Math.max(b, 1e-6);
  return r > 3 ? {label:'Forced-flow dominated', cls:'info'} : r < .33 ? {label:'Buoyancy dominated', cls:'ok'} : {label:'Mixed convection', cls:'warn'};
}
function fmtRate(v){ return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= .1 ? v.toFixed(2) : v.toFixed(3); }
// Approximate limiting oxygen index (% O2, 1 g, ambient pressure) from the flammability literature, for the solids in the dataset.
const PHYS = {
  pmma:{cls:'thick', loi:17.3}, pmma_like:{cls:'thick', loi:17.3, note:'treated as PMMA'},
  ultem:{cls:'thick', loi:47},   // silicone removed: the only LOI found (30%) is for an additive-filled foam, not neat silicone
  sibal:{cls:'thin', loi:19}, nomex:{cls:'thin', loi:28}
};
const BASE = {thin:{opp:[1,4], con:[10,50]}, thick:{opp:[0.05,0.2], con:[1,10]}};   // Earth, 21% O2, still air, mm/s
function estimate(s){
  const u = uForced(s), b = ub(s.g), ue = Math.hypot(u, b), basis = [];
  if (s.cat === 'droplet'){
    // Fitted to the recorded FLEX droplet runs (log10 K vs O2, 21% O2 reference). Microgravity data only.
    // pf = 90% prediction factor for a single run (scatter between recorded runs), not the confidence interval of the fit.
    const DROP = {methanol:{k21:.482, slope:.0135, pf:1.34, n:154},
                  heptane:{k21:.515, slope:.0139, pf:1.72, n:113}};
    const d = DROP[s.fuel];
    const gfac = s.g < .01 ? 1 : (.85 + .15*Math.sqrt(s.g));
    const scale = Math.pow(10, (d ? d.slope : .0136) * (s.o2 - 21)) * gfac;
    if (d){
      const mid = d.k21*scale;
      basis.push(`Burning-rate constant K from ${d.n} recorded FLEX runs of ${FUELS[s.fuel].name.toLowerCase()}, fitted on the log scale against oxygen.`);
      basis.push(`At 21% O₂ the fit gives K ≈ ${d.k21.toFixed(2)} mm²/s; each extra point of oxygen raises K by about ${((Math.pow(10, d.slope)-1)*100).toFixed(1)}%.`);
      basis.push(`The range is the 90% spread of individual recorded runs around the fit (factor ${d.pf} either way), so a single real run can fall outside the fit's central value.`);
      basis.push(s.g < .01 ? 'These runs were all in microgravity, so this value is a microgravity fit.' : 'The FLEX runs were all in microgravity; the reduced-gravity adjustment here is an approximation.');
      return {kind:'K', unit:'mm²/s', lo:mid/d.pf, hi:mid*d.pf, mid, rel:scale, relText:`${scale.toFixed(2)}× the 21% O₂ value`, ext:false, margin:99, basis, limit:null};
    }
    basis.push('Droplet fires are rated by their burning-rate constant K (how fast the droplet\'s diameter² shrinks), not by surface spread.');
    basis.push('No recorded runs for this droplet fuel: a rough baseline of about 0.5–1.0 mm²/s is used, scaled with the square root of oxygen concentration. Treat as uncalibrated.');
    const f = Math.sqrt(s.o2/21) * gfac;
    return {kind:'K', unit:'mm²/s', lo:.5*f, hi:1.0*f, mid:.707*f, rel:f, relText:`${f.toFixed(2)}× an Earth-air droplet (uncalibrated)`, ext:false, margin:99, basis, limit:null};
  }
  if (s.cat === 'gas') return {none:'No spread-rate approximation for gas-jet flames: they do not spread over a surface. Use the recorded ignition and burn-time outcomes above.'};
  const m = PHYS[s.fuel];
  if (!m) return {none: s.fuel === 'any' ? 'Choose a specific material to get a spread-rate approximation.' : `No oxygen-limit value is on file for ${FUELS[s.fuel].name.toLowerCase()}, so no spread-rate approximation is made.`};
  const name = FUELS[s.fuel].name;
  basis.push('The base rates and oxygen limits are typical values for each material class, not measured values for this exact sample.');
  let L = m.loi; const lowg = 1 - Math.sqrt(s.g);
  basis.push(`Starts from the approximate oxygen limit of ${name.toLowerCase()} in Earth tests (about ${m.loi}% O₂${m.note ? ', ' + m.note : ''}).`);
  if (ue < 2){ L += 5; basis.push('Near-zero total flow: oxygen arrives only by diffusion, so the effective limit is raised by about 5 points (oxygen starvation).'); }
  else if (ue <= 30 && lowg > .1){ L -= 3*lowg; basis.push(`Gentle flow in ${s.g < .01 ? 'microgravity' : 'reduced gravity'} lets some materials burn below their Earth limit, so the limit is lowered by about ${(3*lowg).toFixed(1)} points.`); }
  // Pressure: the literature does not agree on the direction of the oxygen-limit change at reduced pressure, so no adjustment is applied.
  if (s.p && s.p < 100) basis.push(`Pressure (${s.p} kPa) is recorded but does not change the estimated oxygen limit here, because its effect is not settled in the literature.`);
  const margin = s.o2 - L;
  const dirs = s.dir === 'concurrent' ? ['con'] : s.dir === 'opposed' ? ['opp'] : ['opp','con'];
  if (!s.dir) basis.push('Flow direction not given, so the band spans opposed (slow) to concurrent (fast) spread.');
  if (margin <= 0){
    basis.push(`At ${s.o2}% O₂ the scenario sits ${Math.abs(margin).toFixed(1)} points below the estimated limit of ${L.toFixed(1)}%, so a flame would most likely not sustain itself.`);
    return {kind:'V', unit:'mm/s', lo:0, hi:0, mid:0, rel:0, relText:'Below the estimated burning limit', ext:true, margin, basis, limit:L};
  }
  const ref = Math.max(21 - m.loi, 3), n = m.cls === 'thick' ? 2 : 1, earthMargin = s.o2 - m.loi;
  let fo;
  if (earthMargin > 0){ fo = Math.min(Math.pow(earthMargin/ref, n), 6);
    basis.push(`Oxygen is ${earthMargin.toFixed(1)} points above the Earth limit; the oxygen margin is mapped to a spread factor with an assumed empirical form (${n === 2 ? 'stronger dependence assumed for thick fuel' : 'weaker dependence assumed for thin fuel'}). This form is not derived from theory or validated against data, so treat the result as an order-of-magnitude guide, relative to Earth air.`); }
  else { fo = Math.min(Math.pow(margin/ref, n), 1)*.5; basis.push('The material would not burn at this oxygen level on Earth; it only burns here because of the low-gravity limit shift, so the flame is weak and slow.'); }
  if (margin < 2){ fo *= Math.max(margin/2, .15); basis.push(`Only ${margin.toFixed(1)} points above the estimated limit (${L.toFixed(1)}%), so the flame is near extinction and slows down.`); }
  const pf = (m.cls === 'thick' && s.p) ? s.p/101.3 : 1;
  const blow = (s.dir === 'opposed' && u > 30 && margin < 3) ? .5 : 1;
  if (blow < 1) basis.push('Strong opposed flow near the limit can blow the flame off, so the estimate is halved.');
  const df = d => d === 'con' ? ue/30 : (m.cls === 'thick' ? ue/30 : Math.min(1, ue/5));
  basis.push(`Effective flow ≈ ${ue < .1 ? ue.toExponential(0) : ue.toFixed(1)} cm/s (forced ${u} + buoyant ${b < .1 ? b.toExponential(0) : b.toFixed(1)}), compared with about 30 cm/s for buoyant flow on Earth.`);
  let lo = Infinity, hi = 0, b0lo = Infinity, b0hi = 0;
  for (const d of dirs){ const [a, z] = BASE[m.cls][d], f = fo*df(d)*pf*blow; lo = Math.min(lo, a*f); hi = Math.max(hi, z*f); b0lo = Math.min(b0lo, a); b0hi = Math.max(b0hi, z); }
  const mid = Math.sqrt(lo*hi), base = Math.sqrt(b0lo*b0hi), rel = mid/base;
  return {kind:'V', unit:'mm/s', lo, hi, mid, rel, base, ext:false, margin, basis, limit:L,
    relText: m.loi < 21 ? `about ${rel >= 10 ? rel.toFixed(0) : rel.toFixed(1)}× the same material in Earth air` : 'This material does not burn in Earth air at all'};
}

/* Hazard indicator: recorded outcomes first, physics estimate where there are none. */
function hazard(s, e, sum){
  if (sum.kind === 'cfig'){
    if (sum.share < .3) return {cls:'ok', tag:'LOW', text:'Most nearby runs failed to ignite'};
    return s.o2 >= 25 ? {cls:'crit', tag:'ELEVATED', text:'Ignites readily in enriched oxygen'} : {cls:'warn', tag:'MODERATE', text:'Nearby runs ignited and burned'};
  }
  if (sum.kind === 'flex') return s.o2 >= 25 ? {cls:'crit', tag:'ELEVATED', text:'Droplet burns vigorously in enriched oxygen'} : {cls:'warn', tag:'MODERATE', text:'Droplet burns, then goes out locally'};
  if (sum.kind === 'saffire' && sum.share === 1) return {cls:'ok', tag:'LOW', text:'Nearby samples did not sustain a flame'};
  if (!e || e.none){ return {cls:'info', tag:'UNRATED', text:'No recorded outcome or physics model for this case'}; }
  if (e.ext) return {cls:'ok', tag:'LOW', text:'Likely self-extinguishing'};
  if (e.kind === 'K') return s.o2 >= 25 ? {cls:'crit', tag:'ELEVATED', text:'Fast-burning droplet in enriched oxygen'} : {cls:'warn', tag:'MODERATE', text:'Droplet burns, but stays local'};
  if (e.margin < 2) return {cls:'warn', tag:'NEAR LIMIT', text:'Marginal flame, hard to predict'};
  if (e.rel >= 1.5 || s.o2 >= 25) return {cls:'crit', tag:'ELEVATED', text:'Faster spread than on Earth'};
  if (e.rel >= .6) return {cls:'warn', tag:'MODERATE', text:'Spread comparable to Earth'};
  return {cls:'info', tag:'REDUCED', text:'Burns, but slower than on Earth'};
}

/* ---------- Notes (each labelled DATA or PHYSICS) ---------- */
function fuelName(s){ return s.fuel === 'any' ? `any ${CAT_LABEL[s.cat]} fuel` : FUELS[s.fuel].name; }
function rangeOf(rs, k){ const v = rs.map(r => r[k]).filter(x => x != null); return v.length ? [Math.min(...v), Math.max(...v), v.length] : null; }
function notes(s){
  const out = [], rs = POOL.filter(r => r.c === s.cat && (s.fuel === 'any' || r.u === s.fuel)), who = fuelName(s), D = 'data', P = 'phys', u = uForced(s);
  if (gcls(s.g) === 'micro') out.push({src:D, c:'', x:`All ${fmtInt(PSI.meta.runs)} runs were done in microgravity, so this is the gravity level the data covers.`});
  else out.push({src:D, c:'c', x:`No run in the dataset was done at ${fmtG(s.g)} g. The evidence below comes from microgravity runs and is extrapolated to ${ENV[s.env].name === 'Not-specified habitat' ? 'this gravity' : ENV[s.env].name}.`});
  if (gcls(s.g) === 'micro') out.push({src:P, c: u < 2 ? 'c' : '', x: u < 2 ? 'With almost no buoyancy and no forced flow, oxygen reaches the flame only by slow diffusion; such flames often starve.' : `In microgravity the ventilation (${u} cm/s) replaces buoyancy as the oxygen supply.`});
  else if (gcls(s.g) === 'partial') out.push({src:P, c:'w', x:`At ${fmtG(s.g)} g the buoyant plume is weaker than on Earth (about ${ub(s.g).toFixed(0)} versus 30 cm/s), so the flame is taller, slower-moving and more sensitive to ventilation.`});
  else out.push({src:P, c:'', x:'On Earth, buoyancy drives a strong upward flow that feeds the flame and gives the familiar teardrop shape.'});
  const ro = rangeOf(rs, 'o');
  if (!ro) out.push({src:D, c:'w', x:`No ${who} run records the oxygen level.`});
  else {
    const spiceOnly = rs.every(r => r.o == null || r.f === 'SPICE'), rtxt = ro[0] === ro[1] ? `${fmtNum(ro[0])}%` : `${fmtNum(ro[0])}–${fmtNum(ro[1])}%`;
    const tail = spiceOnly ? ' SPICE burns in air, so its O₂ is assumed, not measured.' : '';
    const outside = s.o2 < ro[0] - .5 || s.o2 > ro[1] + .5;
    out.push({src:D, c: outside ? 'c' : '', x:`${s.o2}% O₂ is ${outside ? 'outside' : 'inside'} the tested range for ${who} (${rtxt}, ${ro[2]} runs).${tail}`});
  }
  if (s.p != null){
    const rp = rangeOf(rs, 'p');
    if (!rp) out.push({src:D, c:'w', x:`No ${who} run records pressure, so pressure is not used for matching.`});
    else { const o = s.p < rp[0] || s.p > rp[1]; out.push({src:D, c: o ? 'c' : '', x:`${kpa(s.p)} is ${o ? 'outside' : 'inside'} the tested pressure range for ${who} (${kpa(rp[0])}–${kpa(rp[1])}, ${rp[2]} runs).`}); }
    out.push({src:P, c: s.o2 > 23 && s.p < 80 ? 'w' : '', x:`O₂ partial pressure: ${(s.p*s.o2/100).toFixed(1)} kPa (sea-level air ≈ 21.2 kPa).`});
  }
  if (s.cat !== 'droplet' && s.dir !== 'quiescent'){
    const rv = rangeOf(rs, 'v');
    if (!rv) out.push({src:D, c:'w', x:`No ${who} run records airflow in cm/s.`});
    else out.push({src:D, c: s.flow < rv[0] || s.flow > rv[1] ? 'c' : '', x:`Airflow was recorded in ${rv[2]} ${who} runs (${fmtNum(rv[0])}–${fmtNum(rv[1])} cm/s)${s.cat === 'gas' ? ', all SPICE co-flow air around a fuel jet, not cabin ventilation' : ''}.`});
  }
  if (s.cat === 'droplet') out.push({src:D, c:'', x:'The droplet runs were done in still gas, so airflow is not used for matching.'});
  if (s.cat === 'solid' && (s.dir === 'concurrent' || s.dir === 'opposed'))
    out.push({src:D, c: s.dir === 'concurrent' ? 'w' : '', x:`In Saffire-I the same SIBAL sheet burned ${fmtNum(PSI.facts.saffireConc,0)} s with concurrent flow and ${fmtNum(PSI.facts.saffireOpp,0)} s with opposed flow, both at 20 cm/s.`});
  if (s.fuel !== 'any') out.push({src:D, c:'', x:`<strong>${esc(FUELS[s.fuel].name)}.</strong> ${esc(FUELS[s.fuel].note)} ${FUELS[s.fuel].n} runs from ${FUELS[s.fuel].fams.map(k => FAM[k].name).join(', ')}.`});
  return out;
}
const plain = h => h.replace(/<[^>]+>/g, '');

/* ---------- Interpretation text (rule-based; AI replaces it when available) ---------- */
function fallbackText(ev){
  const {s, e, hz, m, sum, conf} = ev, fams = [...new Set(m.near.map(x => FAM[x.r.f].name))];
  const lines = [`Verdict: ${hz.text}. In the ${ENV[s.env].name} scenario with ${fuelName(s)} at ${s.o2}% O₂.`];
  lines.push(`What the data shows: ${sum.kind === 'none' ? 'the closest runs record conditions but no outcomes.' : `${sum.label} — ${sum.big}. ${sum.sub}`}`);
  const pe = !e || e.none ? '' : e.ext ? ' The physics approximation puts the scenario below the burning limit.' : ` The physics approximation gives ${e.kind === 'K' ? 'a burning rate' : 'a spread rate'} of roughly ${fmtRate(e.lo)}–${fmtRate(e.hi)} ${e.unit}.`;
  lines.push('What drives it: ' + notes(s).filter(n => n.src === 'phys').slice(0,1).map(n => plain(n.x)).join(' ') + pe);
  lines.push('Safety meaning: ' + (hz.cls === 'ok' ? 'Low risk of sustained burning, but hot spots can reignite if airflow or oxygen increases; keep ventilation shutdown in the fire response plan.'
    : hz.cls === 'crit' ? 'Treat this as a priority hazard: limit quantity near ignition sources, and plan for rapid ventilation shutdown and suppression.'
    : hz.cls === 'info' ? 'The data cannot rate this case; treat it as untested and rely on certified flammability tests.'
    : 'A fire could keep burning; detection and ventilation control matter more than in Earth-like conditions because the flame behaves differently.'));
  lines.push(`Evidence and uncertainty: confidence is ${conf.t.toLowerCase()}, with ${m.close} runs close to this scenario. The nearest runs come from ${fams.join(', ')}.${gcls(s.g) !== 'micro' ? ' All of them were done in microgravity, so this gravity level is extrapolated.' : ''}`);
  return lines.join('\n');
}
function renderAI(text){
  $('r-ai').innerHTML = text.split(/\n+/).filter(Boolean).map(line => {
    const mm = line.match(/^([A-Z][A-Za-z ,’'\-]{2,48}):\s*(.*)$/);
    return mm ? `<p><strong>${esc(mm[1])}.</strong> ${esc(mm[2])}</p>` : `<p>${esc(line)}</p>`;
  }).join('');
}

/* ---------- State ---------- */
let S = {env:'craft', g:0.000001, cat:'solid', fuel:'pmma', o2:21, flow:20, p:null, dir:''};
let lastEval = null, fromClick = false;
function evaluate(s){ const m = match(s), sum = summarize(s, m.near), e = estimate(s), conf = confidence(s, m); return {s, m, sum, e, conf, hz: hazard(s, e, sum)}; }
function flameVigor(ev){
  const {e, sum} = ev;
  if (sum.kind === 'cfig') return clamp(.25 + sum.share, .2, 1.2);
  if (sum.kind === 'saffire' && sum.share === 1) return .15;
  if (!e || e.none) return null;
  if (e.ext) return .12; if (e.kind === 'K') return clamp(.5*e.rel, .3, 1.2);
  return clamp(.35 + .35*Math.log10(Math.max(e.rel,.05)) + .4, .2, 1.3);
}
const flameParams = ev => ({g:ev.s.g, o2:ev.s.o2, flow:ev.s.flow, dir: ev.s.dir === 'opposed' ? -1 : 1, quiescent: ev.s.dir === 'quiescent' || ev.s.cat === 'droplet', kind: ev.s.cat, vigor: flameVigor(ev)});

/* ---------- Render results ---------- */
function renderResults(){
  const ev = evaluate(S), {s, m, sum, e, conf, hz} = ev, rg = regime(s), u = uForced(s);
  lastEval = ev;
  $('r-orb').className = 'big-orb orb ' + ENV[s.env].orb;
  $('r-habitat').textContent = ENV[s.env].name;
  const P = [['Gravity', fmtG(s.g) + ' g'], ['Fuel', fuelName(s)], ['Oxygen concentration', s.o2 + '%'], ['Airflow speed', s.flow + ' cm/s'],
    ['Pressure', s.p ? s.p + ' kPa' : null], ['Flow direction', s.dir ? s.dir[0].toUpperCase() + s.dir.slice(1) : null]];
  $('r-params').innerHTML = P.map(([k,v]) => `<div><div class="k">${k}</div><div class="v ${v ? '' : 'unset'}">${v ? esc(v) : 'Not set · not matched'}</div></div>`).join('');
  $('r-verdict').className = 'verdict ' + hz.cls; $('r-hz').className = 'tag ' + hz.cls; $('r-hz').textContent = hz.tag; $('r-hzt').textContent = hz.text;

  Object.assign(main.params, flameParams(ev));
  $('hudG').textContent = fmtG(s.g); $('hudO2').textContent = s.o2 + '%';
  $('hudFlow').textContent = u + ' cm/s ' + (s.dir === 'opposed' ? '←' : u ? '→' : ''); $('hudMat').textContent = fuelName(s).toUpperCase();
  const b = ub(s.g), logPos = v => clamp((Math.log10(Math.max(v,.01)) + 2)/(Math.log10(90) + 2), 0, 1)*100;
  $('ubv').textContent = (b < .1 ? b.toExponential(0) : b.toFixed(1)) + ' cm/s'; $('ufv').textContent = u + ' cm/s';
  $('ubBar').style.width = logPos(b) + '%'; $('ufBar').style.width = logPos(u) + '%';
  $('regimeTag').textContent = rg.label; $('regimeTag').className = 'tag ' + rg.cls;

  // data outcome
  $('confTag').textContent = conf.t; $('confTag').className = 'tag ' + conf.c;
  // Tooltip: say what the label is based on (the number of recorded runs close to this scenario).
  $('confTag').title = `Based on ${lastEval.m.close} recorded run(s) close to this scenario. High: 10 or more; Moderate: 3 to 9; Low: 1 to 2; Outside tested range: none. Gravity not tested lowers the label one step.`;
  $('outLabel').textContent = sum.label; $('outBig').textContent = sum.big; $('outSub').textContent = sum.sub;
  const avg = m.near.length ? Math.round(m.near.reduce((a,x) => a + simPct(x.d), 0)/m.near.length) : 0;
  $('outKv').innerHTML = [['Nearest runs used', `${m.near.length} · average match ${avg}%`], ['Runs in close range', String(m.close)], ...sum.kv].map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  renderSpread(ev);
  $('r-notes').innerHTML = notes(s).map(n => `<li class="${n.c}"><span class="src ${n.src}">${n.src === 'data' ? 'DATA' : 'PHYSICS'}</span> ${n.x}</li>`).join('');
  renderAI(fallbackText(ev));
  $('r-ai-src').textContent = 'Rule-based interpretation from the evidence below';
  chartData = {s, m}; drawChart();
  renderStudies(ev); renderFamilies(ev);
  syncCompare();
  if (sampleFn){ $('r-ai-btn').hidden = false; if (fromClick){ fromClick = false; askAI(); } }
}

function renderSpread(ev){
  const {e, sum, s} = ev, none = !e || e.none;
  $('sr-body').hidden = none; $('sr-none').hidden = !none;
  if (none){ $('sr-none').textContent = e.none; $('sr-tag').textContent = 'Not available'; $('sr-tag').className = 'tag'; return; }
  $('sr-label').textContent = e.kind === 'K' ? 'Burning-rate constant (droplet)' : 'Estimated spread rate';
  $('sr-tag').textContent = 'Physics approximation'; $('sr-tag').className = 'tag warn';
  if (e.ext){ $('sr-big').innerHTML = '≈ 0 <small>mm/s</small>'; $('sr-range').textContent = `Likely self-extinguishing · estimated limit ${e.limit.toFixed(1)}% O₂`; $('sr-method').textContent = 'Oxygen-limit check with gravity, flow and pressure corrections.'; }
  else { $('sr-big').innerHTML = `≈ ${fmtRate(e.mid)} <small>${e.unit}</small>`; $('sr-range').textContent = `Likely range ${fmtRate(e.lo)}–${fmtRate(e.hi)} ${e.unit}`;
    $('sr-method').textContent = e.kind === 'K' ? 'Droplet burning-rate scaling.' : 'Empirical flame-spread approximation with oxygen-limit, buoyancy and flow corrections. Order-of-magnitude only.'; }
  $('sr-rel').textContent = e.relText;
  // compare the approximation with what the nearest runs recorded
  let chk = 'No recorded rate among the nearest runs to compare with.';
  if (e.kind === 'K' && sum.K != null) chk = `Nearest FLEX runs measured K ≈ ${fmtNum(sum.K,2)} mm²/s (${sum.K >= e.lo && sum.K <= e.hi ? 'inside' : 'outside'} this range).`;
  if (e.kind === 'V' && sum.spread) chk = `Nearest Saffire runs measured ${sum.spread.map(v => fmtNum(v)).join(', ')} mm/s.`;
  if (e.kind === 'V' && sum.kind === 'saffire' && sum.share === 1) chk = 'The nearest Saffire samples did not sustain a flame.';
  $('sr-check').textContent = chk;
  $('sr-basis').innerHTML = e.basis.map(t => `<li>${esc(t)}</li>`).join('');
  const pos = v => clamp((Math.log10(Math.max(v,1e-3)) + 2)/4, 0, 1)*100;
  $('sr-ticks').innerHTML = [0.01,0.1,1,10,100].map(v => `<span style="left:${pos(v)}%">${v}</span>`).join('');
  const show = !e.ext && e.kind === 'V';
  $('sr-scale').style.display = show ? '' : 'none';
  if (show){ $('sr-band').style.left = pos(e.lo) + '%'; $('sr-band').style.width = Math.max(pos(e.hi) - pos(e.lo), 1.5) + '%'; $('sr-base').style.left = pos(e.base) + '%'; $('sr-base').title = 'Earth-air baseline'; }
}

/* ---------- Evidence: nearest runs and investigations ---------- */
function runLine(r){
  const b = [];
  if (r.o != null) b.push(`O₂ ${fmtNum(r.o)}%`); else if (r.oRange) b.push(`O₂ ${esc(r.oRange)}%`);
  if (r.p != null) b.push(kpa(r.p));
  if (r.v != null) b.push(`${fmtNum(r.v)} cm/s${r.vk === 'coflow' ? ' co-flow' : ''}`);
  if (r.d) b.push(r.d);
  if (r.dil) b.push(`diluent ${r.dil}`);
  return b.join(' · ') || 'no conditions recorded';
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
function renderStudies(ev){
  const {s, m} = ev;
  $('st-note').textContent = `The five closest of ${m.all.length} ${CAT_LABEL[s.cat]} runs, with ${m.close} in close range. Match is 100% for identical conditions; each variable is scaled by its spread in the data, and a value a run did not record counts against it.`;
  $('studies').innerHTML = m.near.slice(0,5).map((x,i) => {
    const r = x.r, f = FAM[r.f], ol = outLine(r);
    return `<li class="study"><span class="num">${i+1}.</span>
      <div><h4>${esc(r.fr)}</h4><div class="plat">${esc(f.name)} · ${esc(f.psi)} · test ${esc(r.t)}${r.date ? ' · ' + r.date : ''}</div>
        <p class="run">${runLine(r)}</p>
        <p class="uses">${ol ? `Outcome: ${ol}` : 'No outcome recorded for this run.'}</p>
        ${r.n ? `<p class="note">Note: ${esc(r.n)}</p>` : ''}
        <p class="srcline">${esc(r.src)}</p></div>
      <div class="score">${simPct(x.d)}<small>% MATCH</small></div></li>`;
  }).join('');
}
const OUTNAME = {end:'test end', bt:'burn time', K:'burning rate', dext:'extinction diameter', d0:'initial diameter', ign:'ignition', term:'termination', cool:'cool flames', color:'flame colour', spread:'spread rate', ugBurn:'µg burn length', g1Burn:'1 g burn length', g1Spread:'1 g spread', o2f:'final O₂', nIgn:'flames ignited'};
function renderFamilies(ev){
  const {s, m} = ev, cnt = {}; m.near.forEach(x => cnt[x.r.f] = (cnt[x.r.f]||0) + 1);
  const rng = (a, u, d=1) => a ? `${fmtNum(a[0],d)}–${fmtNum(a[1],d)} ${u}` : '—';
  $('famCards').innerHTML = Object.entries(FAM).sort((a,b) => (cnt[b[0]]||0) - (cnt[a[0]]||0) || (b[1].cat === s.cat) - (a[1].cat === s.cat) || b[1].nMatch - a[1].nMatch).map(([k,f]) => {
    const reason = RUNS.find(r => r.f === k && r.x);
    return `<article class="card ${f.cat === s.cat ? '' : 'dim'}">
      <div class="card-top"><div><div class="rank">${esc(f.psi)} · ${f.years ? f.years[0] + (f.years[1] !== f.years[0] ? '–' + f.years[1] : '') : 'undated'} · ${f.cat}</div><h4>${esc(f.name)}</h4></div>
        <div class="score">${cnt[k] || 0}<small>OF 10 NEAREST</small></div></div>
      <p>${esc(f.full)}. ${esc(f.desc)}</p>
      <dl class="kv" style="margin:0">
        <dt>Runs</dt><dd class="mono">${f.n}${f.nMatch !== f.n ? ` (${f.nMatch} used for matching)` : ''}</dd>
        <dt>O₂</dt><dd class="mono">${f.o2 ? rng(f.o2,'%') : f.o2jet ? rng(f.o2jet,'% (jet)') : '—'}</dd>
        <dt>Pressure</dt><dd class="mono">${rng(f.p,'kPa',0)}</dd>
        <dt>Airflow</dt><dd class="mono">${rng(f.v,'cm/s')}</dd>
        <dt>Fuels</dt><dd>${Object.entries(f.fuels).slice(0,4).map(([n,c]) => `${esc(n)} (${c})`).join(', ')}</dd>
      </dl>
      <div class="chips">${f.measured.filter(x => OUTNAME[x]).map(x => `<span class="match y">${OUTNAME[x]}</span>`).join('') || '<span class="match n">no outcomes</span>'}</div>
      ${f.nMatch ? '' : `<p class="note">Not used for matching: ${esc(reason ? reason.x : 'no usable runs')}.</p>`}
    </article>`;
  }).join('');
}

/* ---------- Coverage chart ---------- */
const chart = $('chart'), cx = chart.getContext('2d');
let chartData = null;
function drawChart(){
  if (!chartData) return;
  const {s, m} = chartData, yk = document.querySelector('input[name=yax]:checked').value;
  const dpr = Math.min(devicePixelRatio||1, 2), rect = chart.getBoundingClientRect(), W = rect.width, H = rect.height;
  if (!W) return;
  chart.width = W*dpr; chart.height = H*dpr; cx.setTransform(dpr,0,0,dpr,0,0); cx.clearRect(0,0,W,H);
  const L = 54, R = 12, T = 10, B = 34, strip = 18, pw = W-L-R, ph = H-T-B-strip, xmin = 10, xmax = 42;
  const ylog = yk === 'p', ymin = ylog ? 40 : -6, ymax = ylog ? 560 : 90;
  const X = v => L + (v - xmin)/(xmax - xmin)*pw;
  const Y = v => ylog ? T + ph - (Math.log(v) - Math.log(ymin))/(Math.log(ymax) - Math.log(ymin))*ph : T + ph - (v - ymin)/(ymax - ymin)*ph;
  const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--ink-dim').trim(), line = css.getPropertyValue('--line').trim();
  cx.font = '11px "IBM Plex Mono", monospace'; cx.fillStyle = ink; cx.strokeStyle = line; cx.lineWidth = 1;
  cx.textAlign = 'center';
  [12,16,20,24,28,32,36,40].forEach(v => { cx.globalAlpha = .5; cx.beginPath(); cx.moveTo(X(v), T); cx.lineTo(X(v), T+ph); cx.stroke(); cx.globalAlpha = 1; cx.fillText(v+'%', X(v), H-6); });
  cx.textAlign = 'right';
  (ylog ? [50,70,101,150,200,300,500] : [0,20,40,60,80]).forEach(v => { cx.globalAlpha = .5; cx.beginPath(); cx.moveTo(L, Y(v)); cx.lineTo(L+pw, Y(v)); cx.stroke(); cx.globalAlpha = 1; cx.fillText(v, L-6, Y(v)+4); });
  cx.save(); cx.translate(12, T+ph/2); cx.rotate(-Math.PI/2); cx.textAlign = 'center'; cx.fillText(ylog ? 'pressure, kPa (log)' : 'airflow, cm/s', 0, 0); cx.restore();
  cx.textAlign = 'left'; cx.fillText('O₂ %', L+pw-30, H-20);
  const sy = T + ph + strip/2 + 2;
  cx.globalAlpha = .6; cx.setLineDash([3,4]); cx.beginPath(); cx.moveTo(L, T+ph+4); cx.lineTo(L+pw, T+ph+4); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
  cx.textAlign = 'right'; cx.fillText('n/r', L-6, sy+4);
  const pts = m.all.map(x => x.r).filter(r => r.o != null);
  const jit = r => ((r.t.length*37 + (r.p||0)*13 + (r.v||0)*7) % 11 - 5);
  const pos = r => [X(r.o) + jit(r)*.5, r[yk] == null ? sy + jit(r)*.6 : Y(Math.max(r[yk], ymin))];
  const dot = (r, fill, rad) => { const [x,y] = pos(r); cx.fillStyle = fill; cx.beginPath(); cx.arc(x, y, rad, 0, 6.283); cx.fill(); };
  const same = r => s.fuel === 'any' || r.u === s.fuel;
  pts.forEach(r => { if (!same(r)) dot(r, 'rgba(154,163,196,.28)', 2.4); });
  pts.forEach(r => { if (same(r)) dot(r, 'rgba(124,196,255,.75)', 3); });
  m.near.forEach(({r}) => { if (r.o == null) return; const [x,y] = pos(r); cx.strokeStyle = '#ff8a3d'; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 6.283); cx.stroke(); });
  const sv = yk === 'p' ? s.p : s.flow, ux = X(clamp(s.o2, xmin, xmax)), uy = sv == null ? sy : Y(clamp(sv, ymin, ymax));
  cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.setLineDash([4,4]);
  cx.beginPath(); cx.moveTo(ux, T); cx.lineTo(ux, T+ph); cx.stroke();
  if (sv != null){ cx.beginPath(); cx.moveTo(L, uy); cx.lineTo(L+pw, uy); cx.stroke(); }
  cx.setLineDash([]); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ux, uy, 5, 0, 6.283); cx.fill();
  const noO = m.all.length - pts.length, noY = pts.filter(r => r[yk] == null).length;
  $('chartNote').textContent = `${pts.length} ${CAT_LABEL[s.cat]} runs with an O₂ value are plotted` + (noY ? `; ${noY} of them ${noY === 1 ? 'has' : 'have'} no ${yk === 'p' ? 'pressure' : 'airflow'} and ${noY === 1 ? 'sits' : 'sit'} in the "n/r" (not recorded) strip` : '') + (noO ? `. ${noO} runs record no O₂ and are not shown.` : '.') + (yk === 'v' && s.cat === 'gas' ? ' Gas-jet airflow is SPICE co-flow.' : '') + (s.p == null && yk === 'p' ? ' No pressure set, so your scenario sits in the n/r strip.' : '');
}
addEventListener('resize', drawChart);
document.querySelectorAll('input[name=yax]').forEach(el => el.addEventListener('change', drawChart));

/* ---------- AI interpretation (Claude via the page's sample capability, on claude.ai only) ---------- */
let sampleFn = null, aiCtl = null;
function buildPrompt(){
  const {s, m, sum, e, conf, hz} = lastEval, rg = regime(s);
  const phys = !e || e.none ? 'none for this case' : e.ext ? `below the estimated burning limit (${e.limit.toFixed(1)}% O2): likely self-extinguishing`
    : `${e.kind === 'K' ? 'droplet burning-rate constant' : 'spread rate'} about ${fmtRate(e.lo)}-${fmtRate(e.hi)} ${e.unit} (${e.relText})`;
  return `You are MINERVA, a fire-safety assistant for crewed space habitats. Interpret one fire scenario for students and mission planners.

SCENARIO
- Habitat: ${ENV[s.env].name}; gravity ${fmtG(s.g)} g
- Fuel: ${fuelName(s)} (${CAT_LABEL[s.cat]})
- Oxygen concentration: ${s.o2}%
- Airflow: ${s.flow} cm/s; flow direction: ${s.dir || 'not specified'}
- Pressure: ${s.p ? s.p + ' kPa (O2 partial pressure ' + (s.p*s.o2/100).toFixed(1) + ' kPa)' : 'not specified'}

RECORDED NASA TEST RUNS (all in microgravity; nearest 10 by similarity)
- Outcome summary: ${sum.label}: ${sum.big}. ${sum.sub}
- Data confidence: ${conf.t}; ${m.close} runs in close range
${m.near.slice(0,6).map((x,i) => `${i+1}. ${FAM[x.r.f].name} test ${x.r.t}, ${x.r.fr}: ${runLine(x.r)}; outcome: ${outLine(x.r) || 'not recorded'}; match ${simPct(x.d)}%`).join('\n')}

PHYSICS INDICATORS (computed, not measured)
- Buoyant flow scale ~${ub(s.g).toFixed(2)} cm/s vs forced ${uForced(s)} cm/s; regime: ${rg.label}
- Scaling-law approximation: ${phys}
- Hazard indicator: ${hz.tag} (${hz.text})

NOTES
${notes(s).map(n => `- [${n.src === 'data' ? 'data' : 'physics'}] ${plain(n.x)}`).join('\n')}

Write the interpretation in 170 to 230 words, as plain text with exactly these five lines, each starting with its label and a colon:
Verdict: one sentence on the overall fire hazard.
What the flame would likely do: shape, color, speed and whether it keeps burning.
Why: the physics (gravity, oxygen, airflow, pressure, material).
Safety meaning for the crew: practical implications for the habitat.
Evidence and uncertainty: which recorded runs are closest, what they measured, and what is extrapolated.

Rules: Base claims on the recorded runs first and the physics indicators second, and say which is which. Never write that there is no evidence while RECORDED NASA TEST RUNS lists runs: compare the parameters that match (oxygen, airflow, pressure, flow direction, material) and state what differs. If the gravity level was not tested, say the result is extrapolated from microgravity. Use only the numbers given above and do not invent experiment results, dates or measurements. No markdown, bullets or asterisks.`;
}
async function askAI(){
  if (!sampleFn || !lastEval) return;
  if (aiCtl) aiCtl.abort(); aiCtl = new AbortController();
  $('r-ai-btn').disabled = true;
  $('r-ai-src').innerHTML = '<span class="pulse"></span>MINERVA AI is writing…';
  try {
    const res = await sampleFn(buildPrompt(), {signal: aiCtl.signal, onText: ({text}) => { if (text && text !== 'Thinking...') renderAI(text); }});
    renderAI(res.text);
    $('r-ai-src').textContent = 'Written by MINERVA AI from the evidence below · check key claims';
  } catch (err){
    if (err && err.name === 'AbortError') return;
    $('r-ai-src').textContent = err && err.code === 'rate_limited' ? 'AI is busy; showing the rule-based interpretation. Try again in a minute.'
      : err && err.code === 'not_granted' ? 'AI access was not granted; showing the rule-based interpretation.'
      : err && err.message ? `${err.message} Showing the rule-based interpretation.` : 'AI interpretation failed; showing the rule-based interpretation.';
    if (err && err.code === 'not_granted'){ sampleFn = null; $('r-ai-btn').hidden = true; }
    renderAI(fallbackText(lastEval));
  } finally { $('r-ai-btn').disabled = false; $('r-ai-btn').textContent = 'Regenerate AI answer'; }
}
$('r-ai-btn').addEventListener('click', askAI);

/* ---------- Word report for the current scenario (ai-engine /report, via /api/report) ---------- */
async function downloadReport(){
  const btn = $('r-report'), label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const narrative = $('r-ai').innerText || '';
    const r = await fetch('/api/report', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({scenario:{env:S.env, g:S.g, o2:S.o2, flow:S.flow, mat:S.fuel, p:S.p, dir:S.dir}, narrative: narrative.slice(0, 4000)})});
    if (!r.ok){ const j = await r.json().catch(() => ({})); throw new Error(j.error || 'HTTP ' + r.status); }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = 'minerva-scenario.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err){
    alert(`Report unavailable (${err.message}).`);
  } finally { btn.disabled = false; btn.textContent = label; }
}
$('r-report').addEventListener('click', downloadReport);

/* ---------- Ask the dataset (ai-engine /ask, via /api/ask) ---------- */
async function askDataset(e){
  e.preventDefault();
  const q = $('askQ').value.trim();
  if (q.length < 3) return;
  const btn = $('askBtn'), out = $('askAns'), src = $('askSrc');
  btn.disabled = true; out.textContent = 'Searching the dataset…'; src.innerHTML = '';
  try {
    const r = await fetch('/api/ask', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({question: q, top_k: 5})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    out.textContent = j.answer;
    for (const s of j.sources || []){
      const li = document.createElement('li');
      li.textContent = `row ${s.row_index} · ${s.dataset || ''} ${s.psi_id || ''} · ${s.fuel_material || ''} · O₂ ${s.o2_pct || '—'}% · airflow ${s.airflow_cm_s || '—'} cm/s · ${s.gravity_level || ''}`;
      src.appendChild(li);
    }
  } catch (err){
    out.textContent = `Dataset question unavailable (${err.message}).`;
  } finally { btn.disabled = false; }
}
$('askForm').addEventListener('submit', askDataset);

/* ---------- Map CSV headers (ai-engine /columns/map, via /api/columns/map). Only the header row leaves the browser. ---------- */
function splitHeader(line){
  const out = []; let cell = '', q = false;
  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (q){ if (ch === '"'){ if (line[i+1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ','){ out.push(cell.trim()); cell = ''; }
    else cell += ch;
  }
  out.push(cell.trim());
  return out.map(h => h.replace(/^﻿/, '')).filter(Boolean);
}
async function mapHeaders(e){
  const file = e.target.files[0], list = $('colMap');
  list.innerHTML = '';
  if (!file) return;
  const head = await file.slice(0, 65536).text();
  const headers = splitHeader(head.split(/\r?\n/)[0] || '').slice(0, 200).map(h => h.slice(0, 100));
  const put = msg => { const li = document.createElement('li'); li.textContent = msg; list.appendChild(li); };
  if (!headers.length){ put('No header row found in this file.'); return; }
  put('Mapping…');
  try {
    const r = await fetch('/api/columns/map', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({headers, use_llm: true})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    list.innerHTML = '';
    put(`Method: ${j.method === 'llm' ? 'AI' : 'rules'}`);
    for (const [field, header] of Object.entries(j.mapping)){
      const c = (j.confidence || {})[field];
      const note = !header ? '' : c === undefined ? '' : c >= .8 ? ` (confidence ${Math.round(c * 100)}%)` : ` (confidence ${Math.round(c * 100)}%: check this column)`;
      put(`${field} → ${header || '(not found)'}${note}`);
    }
    await rankCsv(file, j.mapping);
  } catch (err){
    list.innerHTML = '';
    put(`Mapping unavailable (${err.message}).`);
  }
}
// Rank the file's rows against the current scenario, in the browser. Data rows are never sent anywhere.
const CSV_PENALTY = 2.25;
function csvRows(text){
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q){ if (ch === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ','){ row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
function gravityOf(text){
  const t = (text || '').toLowerCase();
  if (/micro|orbit|iss|space|flight/.test(t)) return 1e-6;
  if (/lunar|moon/.test(t)) return .166;
  if (/mars|martian/.test(t)) return .38;
  if (/earth|normal|ground|1\s*g/.test(t)) return 1;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
async function rankCsv(file, mapping){
  const list = $('csvTop');
  list.innerHTML = '';
  const rows = csvRows(await file.text()).filter(r => r.some(c => c.trim() !== ''));
  if (rows.length < 2) return;
  const header = rows[0].map(h => h.trim()), body = rows.slice(1, 20001);
  const idx = f => mapping[f] ? header.indexOf(mapping[f]) : -1;
  const io = idx('o2'), ifl = idx('airflow'), ig = idx('gravity'), ip = idx('pressure'), im = idx('material'), io2out = idx('outcome');
  const pScale = /atm/i.test(mapping.pressure || '') ? 101.325 : /psi/i.test(mapping.pressure || '') ? 6.89476 : 1;
  const num = (r, i) => { if (i < 0) return NaN; const m = String(r[i] || '').match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const fuel = S.fuel !== 'any' && FUELS[S.fuel] ? FUELS[S.fuel].name.toLowerCase().split(/[ (]/)[0] : '';
  const put = msg => { const li = document.createElement('li'); li.textContent = msg; list.appendChild(li); };
  const scored = body.map((r, k) => {
    let cost = 0;
    if (io >= 0 && !isNaN(num(r, io))) cost += ((num(r, io) - S.o2) / 5) ** 2;
    if (ifl >= 0 && S.dir !== 'quiescent' && !isNaN(num(r, ifl))) cost += ((num(r, ifl) - S.flow) / 10) ** 2;
    if (ip >= 0 && S.p && !isNaN(num(r, ip))) cost += ((num(r, ip) * pScale - S.p) / 20) ** 2;
    if (ig >= 0){ const g = gravityOf(r[ig]); if (g != null && !isNaN(g)) cost += .5 * (Math.log10(Math.max(S.g, 1e-6)) - Math.log10(Math.max(g, 1e-6))) ** 2; }
    if (im >= 0 && fuel && !String(r[im] || '').toLowerCase().includes(fuel)) cost += CSV_PENALTY;
    return { r, k, cost };
  }).sort((a, b) => a.cost - b.cost).slice(0, 5);
  // Data checks, run here in the browser. Flags values that are likely wrong or unit mix-ups.
  const checks = [];
  const flagCol = (label, i, test, why) => {
    if (i < 0) return;
    const bad = body.filter(r => { const v = num(r, i); return !isNaN(v) && test(v); }).length;
    const blank = body.filter(r => String(r[i] || '').trim() === '').length;
    if (bad) checks.push(`${label}: ${bad} value(s) ${why}`);
    if (blank > body.length / 2) checks.push(`${label}: ${blank} of ${body.length} rows are blank`);
  };
  flagCol('O₂', io, v => v < 0 || v > 100, 'outside 0–100 %');
  flagCol('Airflow', ifl, v => v < 0, 'negative (check the sign convention)');
  flagCol('Pressure', ip, v => v * pScale < 20 || v * pScale > 300, 'outside 20–300 kPa after unit conversion');
  if (io < 0 && ifl < 0 && ip < 0) checks.push('No O₂, airflow, or pressure column was matched, so rows cannot be scored on those.');
  if (checks.length){ put('Data checks:'); checks.forEach(c => put(`• ${c}`)); }
  else put('Data checks: no problems found.');
  put(`Closest rows to the current scenario (${body.length} rows checked in your browser):`);
  for (const x of scored){
    const cell = i => i >= 0 && String(x.r[i] || '').trim() !== '' ? String(x.r[i]).trim() : '—';
    put(`Row ${x.k + 1} · cost ${x.cost.toFixed(2)} · material ${cell(im)} · O₂ ${cell(io)} · airflow ${cell(ifl)} · pressure ${cell(ip)} · gravity ${cell(ig)} · outcome ${cell(io2out)}`);
  }
}
$('csvHead').addEventListener('change', mapHeaders);

/* ---------- Coverage gaps (ai-engine /coverage, via /api/coverage) ---------- */
async function showGaps(){
  const list = $('gapList'), note = $('gapNote'), btn = $('gapBtn');
  list.innerHTML = ''; note.textContent = 'Checking…'; btn.disabled = true;
  try {
    const r = await fetch('/api/coverage');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    const name = g => g.replace('moon_0.17g','Moon 0.17 g').replace('mars_0.38g','Mars 0.38 g').replace('earth_1g','Earth 1 g').replace('microgravity','Microgravity');
    note.textContent = `${j.gaps.length} of ${j.total_cells} combinations have no recorded run. ${j.runs_without_o2} runs have no O₂ value and are not placed in the grid.`;
    for (const c of j.gaps){
      const li = document.createElement('li');
      li.textContent = `${name(c.gravity)} · ${c.fuel} · O₂ ${c.o2_band}`;
      list.appendChild(li);
    }
  } catch (err){
    note.textContent = `Coverage unavailable (${err.message}).`;
  } finally { btn.disabled = false; }
}
$('gapBtn').addEventListener('click', showGaps);
if (window.claude && typeof window.claude.use === 'function'){
  window.claude.use('sample').then(fn => { if (fn){ sampleFn = fn; if (!$('view-results').hidden) $('r-ai-btn').hidden = false; } }).catch(() => {});
} else if (location.protocol.startsWith('http')){
  // Not on claude.ai: use the local Gemma proxy (server/llm-proxy.js) when the page is served by it.
  sampleFn = gemmaSample;
}
async function gemmaSample(prompt, {signal} = {}){
  const r = await fetch('/api/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt}), signal});
  const j = await r.json().catch(() => ({}));
  if (!r.ok){ const e = new Error(j.error || 'HTTP ' + r.status); e.code = j.code || 'failed'; throw e; }
  return {text: j.text};
}

/* ---------- Compare ---------- */
function syncCompare(){
  const a = S, envB = $('cB-env').value;
  const b = {...a, env:envB, g:ENV[envB].g, fuel:$('cB-mat').value || a.fuel, o2:+$('cB-o2').value, flow:+$('cB-flow').value};
  $('cB-o2v').textContent = b.o2 + '%'; $('cB-flowv').textContent = b.flow + ' cm/s';
  const A = evaluate(a), Bv = evaluate(b);
  const val = e => !e || e.none ? 'n/a' : e.ext ? '≈ 0 · goes out' : `≈ ${fmtRate(e.mid)} ${e.unit}`;
  $('cA-val').textContent = val(A.e); $('cB-val').textContent = val(Bv.e);
  $('cA-data').textContent = A.sum.short; $('cB-data').textContent = Bv.sum.short;
  $('cA-hz').textContent = A.hz.tag; $('cA-hz').className = 'tag ' + A.hz.cls; $('cB-hz').textContent = Bv.hz.tag; $('cB-hz').className = 'tag ' + Bv.hz.cls;
  $('cA-desc').textContent = `${ENV[a.env].name} · ${fmtG(a.g)} g · ${fuelName(a)} · ${a.o2}% O₂ · ${a.flow} cm/s${a.p ? ' · ' + a.p + ' kPa' : ''}`;
  Object.assign(cmp.A.params, flameParams(A)); Object.assign(cmp.B.params, flameParams(Bv));
  const d = [];
  if (a.env !== b.env) d.push({c: gcls(b.g) !== 'micro' ? 'w' : '', x:`<strong>Habitat ${esc(ENV[a.env].name)} → ${esc(ENV[b.env].name)}.</strong> Gravity changes from ${fmtG(a.g)} to ${fmtG(b.g)} g, so the buoyant flow scale goes from about ${ub(a.g).toFixed(1)} to ${ub(b.g).toFixed(1)} cm/s.${gcls(b.g) !== 'micro' ? ' No runs exist at this gravity, so B\'s recorded outcomes are still from microgravity.' : ''}`});
  if (a.fuel !== b.fuel) d.push({c:'', x:`<strong>Fuel ${esc(fuelName(a))} → ${esc(fuelName(b))}.</strong> ${b.fuel === 'any' ? '' : esc(FUELS[b.fuel].note)}`});
  if (a.o2 !== b.o2) d.push({c: b.o2 > a.o2 ? 'w' : 'g', x:`<strong>Oxygen ${a.o2}% → ${b.o2}%.</strong> ${b.o2 > a.o2 ? 'More oxygen means a hotter, larger flame and faster spread.' : 'Less oxygen moves the flame toward its extinction limit.'}${a.p ? ` O₂ partial pressure ${(a.p*a.o2/100).toFixed(1)} → ${(a.p*b.o2/100).toFixed(1)} kPa.` : ''}`});
  if (a.flow !== b.flow && a.cat !== 'droplet') d.push({c:'', x:`<strong>Airflow ${a.flow} → ${b.flow} cm/s.</strong> ${b.g < .01 ? 'In microgravity the airflow is the oxygen supply, so this change matters a lot.' : 'Compared with buoyancy at this gravity, the effect is ' + (Math.max(a.flow,b.flow) > ub(b.g) ? 'significant.' : 'secondary.')}`});
  d.push({c: A.sum.big === Bv.sum.big ? '' : 'w', x:`<strong>Recorded outcome of the nearest runs:</strong> ${esc(A.sum.big)} → ${esc(Bv.sum.big)}.`});
  const shared = A.m.near.filter(x => Bv.m.near.some(y => y.r === x.r)).length;
  d.push({c: Math.min(A.m.close, Bv.m.close) < 3 ? 'w' : '', x:`<strong>Data coverage:</strong> ${A.m.close} close runs for A, ${Bv.m.close} for B; ${shared} of the 10 nearest runs are shared.`});
  if (A.e && !A.e.none && Bv.e && !Bv.e.none && !A.e.ext && !Bv.e.ext && A.e.kind === Bv.e.kind){
    const r = Bv.e.mid/A.e.mid; d.push({c: r > 1.2 ? 'c' : r < .8 ? 'g' : '', x:`<strong>Physics approximation.</strong> B's ${A.e.kind === 'K' ? 'burning rate' : 'spread rate'} is about ${r >= 10 ? r.toFixed(0) : r.toFixed(1)}× A's (${fmtRate(A.e.mid)} → ${fmtRate(Bv.e.mid)} ${A.e.unit}). Hazard: ${A.hz.tag} → ${Bv.hz.tag}.`});
  } else if (A.e && Bv.e && (A.e.ext || Bv.e.ext)) d.push({c:'', x:`<strong>Physics approximation.</strong> ${A.e.ext ? 'A is estimated to go out' : 'A keeps burning'}; ${Bv.e.ext ? 'B is estimated to go out' : 'B keeps burning'}. Hazard: ${A.hz.tag} → ${Bv.hz.tag}.`});
  $('delta').innerHTML = d.map(i => `<li class="${i.c}">${i.x}</li>`).join('');
}
['cB-env','cB-mat','cB-o2','cB-flow'].forEach(id => $(id).addEventListener('input', syncCompare));

/* ---------- Home builder ---------- */
function fuelOptions(cat){
  const opts = Object.entries(FUELS).filter(([,f]) => f.cat === cat && f.n > 0).sort((a,b) => b[1].n - a[1].n);
  return opts.map(([k,f]) => `<option value="${k}">${esc(f.name)} · ${f.n} runs</option>`).join('') + `<option value="any">Any ${CAT_LABEL[cat]} fuel · ${POOL.filter(r => r.c === cat).length} runs</option>`;
}
function fillFuels(sel, cat, keep){ const prev = keep || sel.value; sel.innerHTML = fuelOptions(cat); sel.value = [...sel.options].some(o => o.value === prev) ? prev : sel.options[0].value; }
const homeCat = () => document.querySelector('input[name=cat]:checked').value;
function fuelHint(){ const k = $('h-material').value; $('h-fuelNote').textContent = k === 'any' ? 'Matches any fuel of this type.' : FUELS[k].note; }
document.querySelectorAll('input[name=cat]').forEach(el => el.addEventListener('change', () => { fillFuels($('h-material'), homeCat()); fuelHint(); }));
$('h-material').addEventListener('change', fuelHint);
const homeEnv = {v:'craft'}, habs = [...document.querySelectorAll('.hab')];
function setHab(env){ homeEnv.v = env; habs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.env === env))); if (env !== 'general') $('h-gravity').value = String(ENV[env].g); }
habs.forEach(b => b.addEventListener('click', () => setHab(b.dataset.env)));
$('h-gravity').addEventListener('change', () => { if (homeEnv.v !== 'general' && $('h-gravity').value !== String(ENV[homeEnv.v].g)) setHab('general'); });
const step = () => habs[1].getBoundingClientRect().width + 14;
$('habPrev').addEventListener('click', () => $('habTrack').scrollBy({left:-step(), behavior: reduce ? 'auto' : 'smooth'}));
$('habNext').addEventListener('click', () => $('habTrack').scrollBy({left: step(), behavior: reduce ? 'auto' : 'smooth'}));
$('h-o2').addEventListener('input', () => $('h-o2v').textContent = $('h-o2').value + '%');
$('h-flow').addEventListener('input', () => $('h-flowv').textContent = $('h-flow').value + ' cm/s');
$('homeForm').addEventListener('submit', ev => {
  ev.preventDefault();
  const raw = $('h-pressure').value.trim(); let p = null;
  if (raw !== ''){ p = parseFloat(raw); if (isNaN(p) || p < 40 || p > 510){ $('h-pressure-err').textContent = 'Enter a pressure between 40 and 510 kPa (the tested range is about 51–507), or leave it blank.'; $('h-pressure').focus(); return; } }
  $('h-pressure-err').textContent = '';
  S = {env:homeEnv.v, g:parseFloat($('h-gravity').value), cat:homeCat(), fuel:$('h-material').value, o2:+$('h-o2').value, flow:+$('h-flow').value, p, dir:$('h-dir').value};
  prepCompare();
  fromClick = true;
  if (location.hash === '#results') route(); else location.hash = 'results';
});
function prepCompare(){
  fillFuels($('cB-mat'), S.cat, S.fuel); $('cB-flow').value = S.flow; $('cB-o2').value = S.o2 >= 26 ? 21 : 30;
  $('cB-env').value = S.env === 'craft' ? 'mars' : 'craft';
}

/* ---------- About: figures computed from the data ---------- */
function fillStats(){
  const M = PSI.meta, F = PSI.facts;
  document.querySelectorAll('[data-stat]').forEach(el => el.textContent = fmtInt(M[el.dataset.stat]));
  ['solid','droplet','gas'].forEach(c => $('catN-'+c).textContent = `${M.cats[c]} runs`);
  $('rangeO2').textContent = `${fmtNum(M.o2[0])}–${fmtNum(M.o2[1])}%`; $('rangeP').textContent = `${kpa(M.p[0])}–${kpa(M.p[1])}`;
  // Runs per environment, counted from the gravity labels in the bundled data (not typed in by hand).
  const GRAV = {mars:/mars|martian/i, moon:/lunar|moon/i, earth:/earth|normal|ground|1\s*g\b/i};
  const runsAt = env => Object.entries(M.gravity).reduce((a, [label, n]) => a + (GRAV[env].test(label) ? n : 0), 0);
  $('tel-mars').textContent = fmtInt(runsAt('mars'));
  $('tel-moon').textContent = fmtInt(runsAt('moon'));
  $('tel-earth').textContent = fmtInt(runsAt('earth'));
  $('factFlexN').textContent = `${F.flexExt} of ${F.flexN}`;
  $('factFlex').textContent = `FLEX droplet flames ended in extinction; ${F.flexDis} ended with the droplet breaking apart and ${F.flexComp} burned to completion.`;
  $('factSaffN').textContent = `${fmtNum(F.saffireConc,0)} s vs ${fmtNum(F.saffireOpp,0)} s`;
  $('factSaff').textContent = 'Saffire-I burn time for the same fabric sheet in concurrent versus opposed airflow at 20 cm/s, inside a Cygnus spacecraft.';
  $('factSiliN').textContent = `${F.siliconeInsig} of ${F.siliconeN}`;
  $('factSili').textContent = `Saffire-II silicone samples barely burned in microgravity at 20 cm/s, while ${F.silicone1gComplete} of the same samples burned completely in 1 g tests. Earth tests are not always the gentler case.`;
  $('dataKv').innerHTML = [
    ['Source', `${esc(M.source)} · ${fmtInt(M.rows)} rows from ${M.families} investigations`],
    ['Runs kept', `${fmtInt(M.runs)} (${M.dupesDropped} exact duplicate rows dropped)`],
    ['Used for matching', `${fmtInt(M.matchRuns)} · solid ${M.cats.solid}, droplet ${M.cats.droplet}, gas jet ${M.cats.gas}`],
    ['Not used for matching', `${fmtInt(M.runs - M.matchRuns)}: smoke experiments, test-design summaries, day summaries, inverse flames and cleaning runs`],
    ['Gravity', Object.entries(M.gravity).map(([k,v]) => `${esc(k)}: ${fmtInt(v)}`).join(', ')],
    ['Ambient O₂ range', `${fmtNum(M.o2[0])}–${fmtNum(M.o2[1])}%`],
    ['Pressure range', `${kpa(M.p[0])}–${kpa(M.p[1])}`],
    ['Airflow range', `${fmtNum(M.v[0])}–${fmtNum(M.v[1])} cm/s (negative values are as recorded in SPICE)`],
    ['Years', `${M.years[0]}–${M.years[1]}`],
    ['Assumptions', 'SPICE co-flow is air, so its O₂ is set to 20.9%. Rows giving only a shape (rod, sphere, film) are kept as "material not stated". Inverse-flame O₂ is the jet\'s, not the atmosphere\'s. Oxygen-limit values in the physics approximation come from the flammability literature, not this dataset.']
  ].map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

/* ---------- Routing ---------- */
function route(){
  const h = location.hash.slice(1);
  // No hash (first visit) opens About. The scenario builder lives at #home.
  const view = h === 'results' || h === 'compare' ? 'results' : h === 'home' ? 'home' : 'about';
  ['home','results','about'].forEach(v => $('view-' + v).hidden = v !== view);
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === (h || 'about') || (view === 'home' && a.dataset.nav === 'home')) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if (view === 'results') renderResults();
  requestAnimationFrame(() => { const el = h === 'compare' ? $('compare') : null; if (el) el.scrollIntoView({block:'start'}); else scrollTo(0,0); if (view === 'results') drawChart(); });
}
addEventListener('hashchange', route);

/* ---------- Flames & loop ---------- */
const main = new Flame($('mainFlame'), {glow:.75});
const cmp = {A: new Flame($('flameA'), {glow:.75}), B: new Flame($('flameB'), {glow:.75})};
const land = new Flame($('landingFlame'), {scale:2.2, glow:.42}); Object.assign(land.params, {g:.000001, o2:24, flow:2.5, kind:'droplet'});
const flames = [land, main, cmp.A, cmp.B];
fillStats();
fillFuels($('h-material'), 'solid', 'pmma'); fuelHint();
prepCompare();
route();
for (let i=0;i<60;i++) flames.forEach(f => f.step());
function loop(){ drawStars(); flames.forEach(f => { f.step(); f.draw(); }); requestAnimationFrame(loop); }
if (reduce){ drawStars(); setInterval(() => flames.forEach(f => { f.step(); f.draw(); }), 120); } else loop();
})();
