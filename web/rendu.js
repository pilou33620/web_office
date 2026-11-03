// Circuit Story — rendu du plan en pixel art avec PixiJS et pixelfx.
// Les dessins de plan.js (SVG) sont rendus par le navigateur en basse résolution, sans lissage, puis posés en sprites triés par
// profondeur ; personnages, rue, gestes de métier, effets (pixelfx), météo et lumière sont animés ici. jeu.js décide quoi montrer et où.
import { Application, Container, Graphics, ImageSource, Sprite, Text, Texture } from './vendor/pixi.min.mjs';
import * as PFX from './vendor/pixelfx/core/index.js';

const PX = 2;  // côté d'un gros pixel, en pixels du monde
const { W, H } = PLAN;
const FW = Math.ceil(W / PX), FH = Math.ceil(H / PX);
const DOUX = matchMedia('(prefers-reduced-motion: reduce)');
const POLICE = 'Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif', TRAIT = 0x2b1d14;
const CARTON = '<path d="M1 4 L8 1 L15 4 L15 10 L8 11.5 L1 10Z" fill="#c48a52" stroke="#2b1d14" stroke-width="1"/><path d="M1 4 L8 6 L15 4 M8 6 V11.5" fill="none" stroke="#2b1d14" stroke-width=".9"/>';
const FAUTEUIL = '<rect x="3" y="2" width="18" height="7" rx="2" fill="#3d3d3d" stroke="#2b1d14"/><path d="M12 9v4M6 14h12" stroke="#2b1d14" stroke-width="2"/>';
const app = new Application(), C = {};
const grille = (v) => Math.round(v / PX) * PX;
const interieur = (svg) => svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
let maintenant = performance.now();

// ---------------------------------------------------------------- dessin SVG → texture en gros pixels
let DEFS = '', STYLE = '';
function raster(contenu, x, y, w, h) {
  const x0 = Math.floor(x / PX) * PX, y0 = Math.floor(y / PX) * PX;
  const w0 = Math.max(PX, Math.ceil((x + w - x0) / PX) * PX), h0 = Math.max(PX, Math.ceil((y + h - y0) / PX) * PX);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w0} ${h0}" width="${w0 / PX}" height="${h0 / PX}" shape-rendering="crispEdges">${DEFS}${STYLE}${contenu}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), img = new Image();
  img.src = url;
  return img.decode().then(() => createImageBitmap(img))
    .then((b) => ({ t: new Texture({ source: new ImageSource({ resource: b, scaleMode: 'nearest' }) }), x: x0, y: y0, w: w0, h: h0 }), () => null)
    .finally(() => URL.revokeObjectURL(url));
}
const liberer = (t) => { if (t && t !== Texture.EMPTY) t.destroy(true); };
function habiller(sprite, r) {  // nouvelle texture à sa place, l'ancienne libérée
  const ancienne = sprite.texture;
  sprite.texture = r.t;
  sprite.position.set(r.x, r.y);
  sprite.scale.set(PX);
  sprite.visible = true;
  liberer(ancienne);
}
// Un dessin tenu à jour : redessiné seulement si son contenu, sa place ou le style de lumière qui le touche change
function dessin(parent) {
  const d = { sprite: new Sprite(), cle: null };
  d.sprite.visible = false;
  parent.addChild(d.sprite);
  d.poser = (svg, x, y, w, h) => {
    d.args = [svg, x, y, w, h];
    const cle = `${svg.length}|${x}|${y}|${w}|${h}|${/lum-soir|soleil/.test(svg) ? STYLE : ''}|${svg}`;
    if (d.cle === cle) return;
    d.cle = cle;
    raster(svg, x, y, w, h).then((r) => { if (!r) return; if (d.cle !== cle || d.mort) liberer(r.t); else habiller(d.sprite, r); });
  };
  d.refaire = () => d.args && d.poser(...d.args);  // la clé tient compte du style : rien à faire si le dessin n'en dépend pas
  d.detruire = () => { d.mort = true; liberer(d.sprite.texture); d.sprite.destroy(); };
  return d;
}

// ---------------------------------------------------------------- couches
async function init(monde) {
  await app.init({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: 1, preference: 'webgl' });
  app.canvas.className = 'rendu';
  monde.prepend(app.canvas);
  for (const k of ['fond', 'monde', 'zones', 'devant', 'rue', 'gestes', 'fx', 'etiquettes', 'bulles', 'lumiere']) app.stage.addChild(C[k] = ['gestes', 'lumiere'].includes(k) ? new Graphics() : new Container());
  C.monde.sortableChildren = true;
  for (const k of ['fond', 'devant', 'zones']) C[k].d = dessin(C[k]);
  initFx();
  await Promise.race([document.fonts.load(`600 12px ${POLICE}`), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  app.ticker.add(tic);
}

// Décor d'un étage : sol et murs du fond, façade et extérieur, noms des lieux
function decor({ fond, devant, etiquettes, defs }) {
  DEFS = defs;
  C.fond.d.poser(interieur(fond), 0, 0, W, H);
  C.devant.d.poser(interieur(devant), 0, 0, W, H);
  ecrireEtiquettes(etiquettes);
}
function zones(svg) { C.zones.d.poser(svg, 0, 0, W, H); }
// Étiquettes : rectangles arrondis et textes du SVG de plan.js, refaits en texte net (lisibles au zoom)
let ETIQ = null;
function ecrireEtiquettes(svg) {
  if (ETIQ === svg) return;
  ETIQ = svg;
  C.etiquettes.removeChildren().forEach((x) => x.destroy());
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), n = (el, k) => parseFloat(el.getAttribute(k)) || 0;
  for (const el of doc.documentElement.children) {
    if (el.nodeName === 'rect') C.etiquettes.addChild(new Graphics().roundRect(n(el, 'x'), n(el, 'y'), n(el, 'width'), n(el, 'height'), n(el, 'rx')).fill(el.getAttribute('fill')));
    else if (el.nodeName === 'text') {
      const taille = n(el, 'font-size'), t = new Text({ text: el.textContent, resolution: 2,
        style: { fontFamily: el.getAttribute('font-family') || POLICE, fontWeight: el.getAttribute('font-weight') || '800', fontSize: taille, fill: el.getAttribute('fill') || '#ffffff' } });
      t.anchor.set(el.getAttribute('text-anchor') === 'middle' ? 0.5 : 0, 0);
      t.position.set(n(el, 'x'), n(el, 'y') - taille * 0.95);
      C.etiquettes.addChild(t);
    }
  }
}

// Objets et mobilier : [{ cle, prof, svg, x, y, w, h }] (contour à l'écran), triés avec les personnages par profondeur
const ELEMENTS = new Map();
function elements(liste) {
  const vus = new Set();
  for (const el of liste) {
    vus.add(el.cle);
    let d = ELEMENTS.get(el.cle);
    if (!d) ELEMENTS.set(el.cle, d = dessin(C.monde));
    d.sprite.zIndex = el.prof;
    d.poser(el.svg, el.x - 3, el.y - 3, el.w + 6, el.h + 6);
  }
  for (const [k, d] of ELEMENTS) if (!vus.has(k)) { d.detruire(); ELEMENTS.delete(k); }
}

// ---------------------------------------------------------------- personnages
const FIGURES = new Map();  // une texture par apparence (habits, cheveux, peau, coiffure, pose)
const figure = (svg) => { if (!FIGURES.has(svg)) FIGURES.set(svg, raster(interieur(svg), -18, -50, 36, 56)); return FIGURES.get(svg); };
let CARTON_T = null, FAUTEUIL_T = null;
const PERSOS = new Map();
function bulle(texte, couleur) {  // comme la bulle HTML : bord brun, ombre portée, texte Fredoka
  const c = new Container(), t = new Text({ text: texte, resolution: 2, style: { fontFamily: POLICE, fontWeight: '600', fontSize: 12, fill: TRAIT } });
  const w = Math.ceil(t.width) + 20, h = 19;
  c.addChild(new Graphics().roundRect(0, 3, w, h, 10).fill({ color: 0x000000, alpha: 0.3 }).roundRect(0, 0, w, h, 10).fill(couleur).stroke({ color: TRAIT, width: 2 }));
  t.position.set(10, 2);
  c.addChild(t);
  return c;
}
// [{ id, figure, X, Y, prof, chemin?, duree?, bulle?: { texte, couleur, parle }, carton, anim: 'bob'|'bob2'|'', secoue, affale, arrive }]
// X, Y : pieds du personnage à l'écran ; chemin : points d'écran jusqu'à (X, Y) quand il y va à pied
function persos(liste) {
  const vus = new Set();
  for (const p of liste) {
    vus.add(p.id);
    let o = PERSOS.get(p.id);
    if (!o) {
      o = { c: new Container(), corps: new Sprite(), X: p.X, Y: p.Y };
      o.corps.visible = false;
      o.c.addChild(o.corps);
      o.c.pivot.set(0, -22);  // les gestes tournent autour du milieu du corps
      C.monde.addChild(o.c);
      PERSOS.set(p.id, o);
      if (p.arrive) jouer('spawn/poof', p.X, p.Y);
    }
    Object.assign(o, { anim: p.anim, secoue: p.secoue, affale: p.affale, prof: p.prof });
    if (o.figure !== p.figure) {
      const f = o.figure = p.figure;
      figure(f).then((r) => { if (r && o.figure === f && !o.mort) { o.corps.texture = r.t; o.corps.position.set(r.x, r.y); o.corps.scale.set(PX); o.corps.visible = true; } });
    }
    if (p.chemin && p.chemin.length && !DOUX.matches) o.marche = { pts: [[o.X, o.Y], ...p.chemin], t0: maintenant, duree: p.duree * 1000 };
    else if (!p.chemin) o.marche = null;
    if (!o.marche) { o.X = p.X; o.Y = p.Y; }
    const cleBulle = p.bulle ? p.bulle.texte + '|' + p.bulle.couleur : '';
    if (o.cleBulle !== cleBulle) {
      o.cleBulle = cleBulle;
      if (o.bulle) o.bulle.destroy({ children: true });
      o.bulle = p.bulle ? C.bulles.addChild(bulle(p.bulle.texte, p.bulle.couleur)) : null;
    }
    if (o.bulle) o.bulle.parle = p.bulle.parle;
    if (p.carton && !o.carton) {
      o.carton = o.c.addChild(new Sprite());
      (CARTON_T ||= raster(CARTON, 0, 0, 16, 12)).then((r) => { if (r && o.carton) { o.carton.texture = r.t; o.carton.scale.set(PX); o.carton.position.set(-8, -20); } });
    } else if (!p.carton && o.carton) { o.carton.destroy(); o.carton = null; }
    const statut = p.affale ? 'status/sleep' : p.secoue ? 'status/stunned' : null;
    if (o.statut !== statut) {
      if (o.fxStatut) o.fxStatut.stop();
      o.statut = statut;
      o.fxStatut = null;
      if (statut) jouer(statut, o.X, o.Y, { boucle: true }).then((f) => { if (o.statut === statut && !o.mort) o.fxStatut = f; else if (f) f.stop(); });
    }
  }
  for (const [id, o] of PERSOS) if (!vus.has(id)) {
    if (String(id).startsWith('f')) jouer('spawn/poof', o.X, o.Y);  // celui qui part disparaît dans un petit nuage
    if (o.fxStatut) o.fxStatut.stop();
    if (o.bulle) o.bulle.destroy({ children: true });
    o.mort = true;
    o.c.destroy({ children: true });
    PERSOS.delete(id);
  }
}
const position = (id) => { const o = PERSOS.get(id); return o ? [o.X, o.Y] : null; };
function animerPerso(o, t) {
  if (o.marche) {
    const m = o.marche, k = Math.min(1, (maintenant - m.t0) / m.duree);
    if (!m.long) { m.long = [0]; for (let i = 1; i < m.pts.length; i++) m.long.push(m.long[i - 1] + Math.hypot(m.pts[i][0] - m.pts[i - 1][0], m.pts[i][1] - m.pts[i - 1][1])); }
    const L = m.long.at(-1) * k, i = Math.max(1, m.long.findIndex((l) => l >= L)), a = m.pts[i - 1], b = m.pts[i] || a, s = (L - m.long[i - 1]) / ((m.long[i] - m.long[i - 1]) || 1);
    o.X = a[0] + (b[0] - a[0]) * s; o.Y = a[1] + (b[1] - a[1]) * s;
    if (k >= 1) o.marche = null;
  }
  let dx = 0, dy = 0, rot = 0;
  const vague = (T, retard = 0) => (1 - Math.cos(2 * Math.PI * (t - retard) / T)) / 2;
  if (DOUX.matches) { /* pas de gestes */ } else if (o.marche) { dy = -4 * vague(0.28); rot = 5 * Math.sin(2 * Math.PI * t / 0.28 - Math.PI / 2); }
  else if (o.anim === 'bob') dy = -3 * vague(0.45);
  else if (o.anim === 'bob2') dy = -3 * vague(0.45, 0.2);
  if (o.secoue && !DOUX.matches) dx = (Math.floor(t / 0.0625) % 4 === 1 ? -2 : Math.floor(t / 0.0625) % 4 === 3 ? 2 : 0);
  if (o.affale) { rot = 70; dx += 10; dy += 16; }
  o.c.position.set(grille(o.X + dx), grille(o.Y - 22 + dy));
  o.c.angle = rot;
  if (o.marche) { const [wx, wy] = PLAN.versMonde(o.X, o.Y); o.c.zIndex = wx + wy; } else o.c.zIndex = o.prof;  // en marche, la profondeur suit le sol
  if (o.bulle) {
    const s = o.bulle.parle && !DOUX.matches ? 1 + 0.08 * vague(1) : 1;
    o.bulle.scale.set(s);
    o.bulle.position.set(Math.round(o.X - 28 - (o.bulle.width * (s - 1)) / 2), Math.round(o.Y - 74 + dy));
  }
  if (o.fxStatut) { o.fxStatut.options.x = o.X / PX; o.fxStatut.options.y = o.Y / PX; }
}

// Course de fauteuils du vendredi soir : [{ figure, X1, Y1, X2, Y2, t, texte }]
let COURSE = [];
function course(liste) {
  for (const c of COURSE) c.c.destroy({ children: true });
  COURSE = liste.map((p, k) => {
    const c = new Container(), f = new Sprite(), corps = new Sprite();
    c.addChild(f, corps);
    (FAUTEUIL_T ||= raster(FAUTEUIL, 0, 0, 24, 16)).then((r) => { if (r && !f.destroyed) { f.texture = r.t; f.scale.set(PX); f.position.set(-12, -8); } });
    figure(p.figure).then((r) => { if (r && !corps.destroyed) { corps.texture = r.t; corps.scale.set(PX); corps.position.set(r.x, r.y - 4); } });
    const b = bulle(p.texte, 0xffc94d);
    b.position.set(-28, -78);
    c.addChild(b);
    c.zIndex = 1e6 + k;
    C.monde.addChild(c);
    return { ...p, c };
  });
}

// ---------------------------------------------------------------- rue : voitures, bus, passants, chat, oiseaux, nuages ; passages ponctuels
const GENRES = ['pieton', 'nuage', 'oiseau', 'chat', 'camion', 'coursier', 'client'];
const ETAPES = {  // [part de l'animation, part du trajet 1, part du trajet 2] comme les @keyframes de style.css
  camion: [[0, 0, 0], [0.4, 1, 0], [0.62, 1, 0], [1, 0, 1]],
  coursier: [[0, 0, 0], [0.35, 1, 0], [0.48, 0, 1], [0.6, 0, 1], [0.73, 1, 0], [1, 0, 0]],
  client: [[0, 0, 0], [0.5, 1, 0], [0.85, 0, 1], [1, 0, 1]],
};
let RUE = [];
function lireMobiles(html) {  // les mobiles de plan.js : <div class="mobile …" style="left; top; --dx; --dy; --t; --d"><svg viewBox>…</svg></div>
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return [...tpl.content.querySelectorAll('.mobile')].map((el) => {
    const st = el.style, v = (k) => parseFloat(st.getPropertyValue(k)) || 0, svg = el.querySelector('svg');
    const [vx, vy, vw, vh] = (svg.getAttribute('viewBox') || '0 0 10 10').split(/[\s,]+/).map(Number);
    const m = { genre: GENRES.find((g) => el.classList.contains(g)) || 'auto', ponctuel: el.classList.contains('ponctuel'), x: v('left'), y: v('top'),
      dx: v('--dx'), dy: v('--dy'), dx1: v('--dx1'), dy1: v('--dy1'), dx2: v('--dx2'), dy2: v('--dy2'), t: v('--t') || 10, d: v('--d'), t0: maintenant, s: new Sprite() };
    m.s.visible = false;
    C.rue.addChild(m.s);
    raster(svg.innerHTML, vx, vy, vw, vh).then((r) => {
      if (!r || m.mort) return r && liberer(r.t);
      habiller(m.s, r);
      m.ox = r.x - vx + r.w / 2; m.oy = r.y - vy + r.h * 0.85;  // les gestes tournent autour des pieds
      m.s.pivot.set(r.w / PX / 2, (r.h / PX) * 0.85);
    });
    return m;
  });
}
function rue(html) {
  for (const m of RUE) { m.mort = true; liberer(m.s.texture); m.s.destroy(); }
  RUE = lireMobiles(html);
}
const passage = (html) => { RUE.push(...lireMobiles(html)); };
function animerMobile(m, t) {
  if (m.ox === undefined) return true;
  const ecoule = (maintenant - m.t0) / 1000;
  let p = m.ponctuel ? ecoule / m.t : (((ecoule - m.d) / m.t) % 1 + 1) % 1, x = 0, y = 0, a = 1;
  if (m.ponctuel && p >= 1) return false;
  if (DOUX.matches) p = 0;
  if (ETAPES[m.genre]) {
    const E = ETAPES[m.genre], i = Math.max(1, E.findIndex((e) => e[0] >= p)), [p0, a0, b0] = E[i - 1], [p1, a1, b1] = E[i], s = (p - p0) / ((p1 - p0) || 1);
    const k1 = a0 + (a1 - a0) * s, k2 = b0 + (b1 - b0) * s;
    x = k1 * m.dx1 + k2 * m.dx2; y = k1 * m.dy1 + k2 * m.dy2;
    const fin = m.genre === 'client' ? 0.85 : m.genre === 'camion' ? 0.96 : 0.95, debut = m.genre === 'camion' ? 0.04 : 0.05;
    a = p < debut ? p / debut : p > fin ? (1 - p) / (1 - fin) : 1;
  } else {
    x = p * m.dx; y = p * m.dy;
    if (m.genre !== 'nuage') a = p < 0.03 ? p / 0.03 : p > 0.97 ? (1 - p) / 0.03 : 1;
  }
  m.s.position.set(grille(m.x + x + m.ox), grille(m.y + y + m.oy));
  m.s.alpha = DOUX.matches ? 1 : a;
  const marche = ['pieton', 'coursier', 'client'].includes(m.genre) && !DOUX.matches;
  m.s.angle = marche ? 5 * Math.sin(2 * Math.PI * t / 0.55) : 0;
  m.s.scale.y = PX * (m.genre === 'oiseau' && !DOUX.matches ? 1 - 0.6 * (1 - Math.cos(2 * Math.PI * t / 0.35)) / 2 : 1);
  if (marche) m.s.y -= grille(4 * (1 - Math.cos(4 * Math.PI * t / 0.55)) / 2);
  return true;
}

// ---------------------------------------------------------------- effets : pixelfx (fumée, confettis, statuts, météo) et petits gestes de métier
const MODULES = {};
const module = (nom) => (MODULES[nom] ||= import(`./vendor/pixelfx/fx/${nom}.js`));
let frame, img, ctx, texFx, VIVANTS = [], actifAvant = false;
function initFx() {
  frame = PFX.createFrame(FW, FH);
  const cv = Object.assign(document.createElement('canvas'), { width: FW, height: FH });
  ctx = cv.getContext('2d');
  img = ctx.createImageData(FW, FH);
  texFx = Texture.from(cv);
  texFx.source.scaleMode = 'nearest';
  C.fx.addChild(new Sprite(texFx)).scale.set(PX);
}
// Joue un effet aux pieds (X, Y) de l'écran ; boucle : rejoué jusqu'à stop() ; renvoie une promesse de l'instance
const graine = () => Math.floor(Math.random() * 1e6);
function lancer(mod, o, boucle) {
  let cur = PFX.createFx(mod, { seed: graine(), ...o }), fini = false;
  // un effet unique rejoué en boucle : relancé à la fin, à l'endroit où l'on a déplacé ses options
  const fx = !boucle || mod.meta.loop ? cur : { options: cur.options, draw: (f, l) => cur.draw(f, l), stop: () => { fini = true; cur.stop(); }, done: () => fini && cur.done(),
    update: (dt) => { if (cur.done() && !fini) cur = PFX.createFx(mod, { ...fx.options, seed: graine() }); cur.options.x = fx.options.x; cur.options.y = fx.options.y; cur.update(dt); } };
  VIVANTS.push(fx);
  return fx;
}
function jouer(nom, X, Y, { boucle = false, ...o } = {}) {
  if (DOUX.matches) return Promise.resolve(null);
  return module(nom).then((mod) => lancer(mod, { x: X / PX, y: Y / PX, ...o }, boucle)).catch(() => null);
}
// Météo et saison : l'effet (une vignette de ciel) répété en tuiles sur tout le monde
function tuiles(nom) {
  if (DOUX.matches) return [];
  return [module(nom).then((mod) => {
    const [sw, sh] = mod.meta.size || [320, 180], [ox, oy] = mod.meta.origin || [sw / 2, sh];
    const liste = [];
    for (let i = 0; i < Math.ceil(FW / sw); i++) for (let j = 0; j < Math.ceil(FH / sh); j++) liste.push(lancer(mod, { x: i * sw + ox, y: j * sh + oy }, true));
    return { stop: () => liste.forEach((f) => f.stop()) };
  }).catch(() => null)];
}

// Gestes de métier et effets des lieux : Map clé → [type, X, Y] (comme avant dans #effets)
let GESTES = new Map(), EN_COURS = new Map();
function effets(voulus) {
  for (const [k, [type, X, Y]] of voulus) {
    if (EN_COURS.has(k)) continue;
    if (type === 'fumee') EN_COURS.set(k, jouer('explosions/smoke-bomb', X, Y + 40));  // jeu.js vise 40 px au-dessus du sol
    else if (type === 'confettis') EN_COURS.set(k, jouer('ui/confetti', X, Y + 70, { boucle: true }));
  }
  for (const [k, f] of EN_COURS) if (!voulus.has(k)) { f.then((x) => x && x.stop()); EN_COURS.delete(k); }
  GESTES = new Map([...voulus].filter(([, [type]]) => type !== 'fumee' && type !== 'confettis'));
}
function dessinerGestes(g, t) {
  g.clear();
  const pt = (x, y, c, s = PX) => g.rect(grille(x), grille(y), s, s).fill(c);
  for (const [type, X, Y] of GESTES.values()) {
    if (type === 'etincelles' || type === 'copeaux') {
      const n = type === 'etincelles' ? 4 : 3, T = type === 'etincelles' ? 0.6 : 0.5, ecarts = type === 'etincelles' ? [5, -7, 6, -3] : [5, -6, 4];
      for (let k = 0; k < n; k++) {
        const q = DOUX.matches ? 0 : ((t + k * 0.15) % T) / T;
        if (q < 0.95) pt(X + ecarts[k] * q, Y - 9 * q, type === 'etincelles' ? (q < 0.4 ? 0xfff4bc : 0xffb02e) : 0xcfc8b8);
      }
    } else if (type === 'tete') {
      const x = X - 3 + 5 * (DOUX.matches ? 0 : -Math.cos(Math.PI * t / 0.9));
      g.rect(grille(x) - 1, grille(Y - 2) - 1, 8, 6).fill(TRAIT).rect(grille(x), grille(Y - 2), 6, 4).fill(0x9aa1a8);
    } else if (type === 'onde') {
      g.rect(grille(X - 8), grille(Y - 4), 16, 10).fill(0x12261a);
      for (let i = 0; i < 16; i += PX) pt(X - 8 + i, Y + Math.round(2.5 * Math.sin(i * 0.8 - (DOUX.matches ? 0 : t * 9))), 0x7be08a);
    } else if (type === 'four') {
      g.ellipse(X, Y, 15, 7).fill({ color: 0xff8c28, alpha: 0.2 + 0.35 * (DOUX.matches ? 1 : (1 + Math.cos(2 * Math.PI * t / 1.6)) / 2) });
    } else if (type === 'code') {  // lignes de code qui défilent sur l'écran, penché comme lui
      const dec = DOUX.matches ? 0 : Math.floor(t * 8) % 6;
      for (let r = 0; r < 4; r++) {
        const l = [8, 12, 6, 10, 14, 7][(r + dec) % 6];
        g.poly([X - 9, Y - 3 + r * 2 + 5, X - 9 + l, Y - 3 + r * 2 + 5 + l * 0.58, X - 9 + l, Y - 2 + r * 2 + 5 + l * 0.58, X - 9, Y - 2 + r * 2 + 5]).fill(r % 2 ? 0xffc94d : 0x7cc0f2);
      }
    }
  }
}

// ---------------------------------------------------------------- ambiance : météo, saisons au jardin, lumière du jour, éclairs
const METEO_FX = { pluie: 'weather/rain', orage: 'weather/storm', neige: 'weather/snow', brouillard: 'weather/fog', canicule: 'weather/god-rays' };
const SAISON_FX = { automne: 'weather/falling-leaves', printemps: 'weather/cherry-blossoms' };
const LUMIERE = { matin: [0xffbe96, 0.08], soir: [0xff783c, 0.12], nuit: [0x1e1e5a, 0.25] };
let AMB = {}, METEO = [];
function ambiance(a) {
  const style = `<style>.lum-soir{display:${a.soir === 'soir' || a.soir === 'nuit' ? 'inline' : 'none'}}${a.soir === 'soir' || a.soir === 'nuit' || ['pluie', 'orage', 'neige', 'brouillard'].includes(a.meteo) ? '.soleil{display:none}' : ''}</style>`;
  if (style !== STYLE) {  // lampes du soir et rayons du soleil : les dessins concernés sont refaits
    STYLE = style;
    for (const d of [C.fond.d, C.devant.d, C.zones.d, ...ELEMENTS.values()]) d.refaire();
  }
  const fx = [METEO_FX[a.meteo], a.dehors ? SAISON_FX[a.saison] : null].filter(Boolean).join(',');
  if (fx !== AMB.fx) {
    for (const f of METEO) f.then((x) => x && x.stop());
    METEO = [];
    for (const nom of fx ? fx.split(',') : []) METEO.push(...tuiles(nom));
  }
  AMB = { ...a, fx };
}
function eclairer(g, t) {
  g.clear();
  const [c, al] = LUMIERE[AMB.soir] || [0, 0];
  if (al) g.rect(0, 0, W, H).fill({ color: c, alpha: al });
  if (AMB.meteo === 'canicule') g.rect(0, 0, W, H).fill({ color: 0xffaa3c, alpha: 0.12 });
  if (AMB.meteo === 'orage' && !DOUX.matches && t % 6 > 5.82) g.rect(0, 0, W, H).fill({ color: 0xffffff, alpha: 0.55 });
}

// ---------------------------------------------------------------- boucle d'animation
function tic(tk) {
  maintenant = performance.now();
  const t = maintenant / 1000, dt = Math.min(tk.deltaMS / 1000, 0.05);
  for (const o of PERSOS.values()) animerPerso(o, t);
  for (const c of COURSE) {  // aller-retour dans le couloir, en douceur
    const q = DOUX.matches ? 0 : (1 - Math.cos(Math.PI * ((t / c.t) % 2))) / 2;
    c.c.position.set(grille(c.X1 + (c.X2 - c.X1) * q), grille(c.Y1 + (c.Y2 - c.Y1) * q));
  }
  RUE = RUE.filter((m) => animerMobile(m, t) || (m.mort = true, liberer(m.s.texture), m.s.destroy(), false));
  dessinerGestes(C.gestes, t);
  eclairer(C.lumiere, t);
  VIVANTS = VIVANTS.filter((f) => !f.done());
  if (VIVANTS.length || actifAvant) {  // effets pixelfx : un frame partagé, recomposé seulement quand quelque chose joue
    PFX.clearFrame(frame);
    for (const f of VIVANTS) { f.update(dt); f.draw(frame); }
    PFX.composite(frame, img.data, null);
    ctx.putImageData(img, 0, 0);
    texFx.source.update();
  }
  actifAvant = VIVANTS.length > 0;
}

// Tant que PixiJS n'est pas prêt (ou sans WebGL), les appels de jeu.js ne font rien
let pret = false;
const garde = (f) => (...a) => (pret ? f(...a) : undefined);
window.RENDU = { init: async (monde) => { await init(monde); pret = true; },
  ...Object.fromEntries(Object.entries({ decor, zones, elements, persos, position, course, rue, passage, effets, jouer, ambiance }).map(([k, f]) => [k, garde(f)])) };
window.dispatchEvent(new Event('rendu-pret'));
