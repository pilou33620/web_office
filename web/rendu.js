// Circuit Story — rendu du plan en 3D low-poly avec three.js.
// plan.js décrit la scène (volumes capturés), jeu.js dit qui est où ; ici on construit les maillages et on anime.
// La caméra orthographique reproduit exactement la projection isométrique de plan.js : les couches HTML (bulles, étiquettes, cartes, fantôme) restent alignées.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const { W, H } = PLAN;
const ECHELLE = Math.sqrt(1.5);  // pixels du plan par unité du monde, dans cette projection
const DOUX = matchMedia('(prefers-reduced-motion: reduce)');
let hasard0 = 11;
const hasard = () => ((hasard0 = (hasard0 * 16807) % 2147483647) / 2147483647);
const pioche = (l) => l[Math.floor(hasard() * l.length)];
const scene = new THREE.Scene();
let rendu, camera, compo, ao, voile, soleil, ciel, appoint, cadre, echelle, calqueBulles;
let maintenant = performance.now();

// ---------------------------------------------------------------- géométrie : tout l'opaque d'un ensemble part dans un seul maillage
let LOT = [], LUEUR = [], OZ = 0;  // listes en cours de remplissage ; OZ : décalage en hauteur (le paysage sous les étages)
function ajoute(geo, c, { amp = 0.05, par = 3, m = null, liste = LOT, faces = null } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const n = g.attributes.position.count, cols = new Float32Array(n * 3), base = new THREE.Color(c), co = new THREE.Color();
  for (let i = 0; i < n; i += par) {
    co.copy(faces ? new THREE.Color(faces[Math.floor(i / par)] || c) : base).multiplyScalar(1 + (hasard() - 0.5) * 2 * amp);
    for (let k = i; k < Math.min(n, i + par); k++) cols.set([co.r, co.g, co.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  liste.push(g);
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, z + OZ, y);  // monde (x, y, hauteur z) → three (x, z, y)
function B(x, y, z, w, d, h, c, amp = 0.04, haut = null, face = null, liste = LOT, faceX = null) {
  ajoute(new THREE.BoxGeometry(Math.max(w, 0.1), Math.max(h, 0.1), Math.max(d, 0.1)), c, { amp, par: 6, m: T(x + w / 2, y + d / 2, z + h / 2), liste, faces: [faceX || c, c, haut || c, c, face || c, c] });
}
const Cyl = (x, y, z, r, h, c, seg = 8, rh = r, amp = 0.04) => ajoute(new THREE.CylinderGeometry(rh, r, h, seg), c, { amp, par: 6, m: T(x, y, z + h / 2) });
const Cone = (x, y, z, r, h, c, seg = 7, rot = 0) => ajoute(new THREE.ConeGeometry(r, h, seg), c, { amp: 0.09, m: T(x, y, z + h / 2).multiply(new THREE.Matrix4().makeRotationY(rot)) });
function bosse(geo, a) {  // déforme une boule à facettes, sommets partagés soudés
  const p = geo.attributes.position, vus = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    if (!vus.has(k)) vus.set(k, 1 + (hasard() - 0.5) * a);
    const f = vus.get(k);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  return geo;
}
const Sph = (x, y, z, r, c, det = 1, amp = 0.08, sy = 1, b = 0, liste = LOT) => {
  const g = new THREE.IcosahedronGeometry(r, det); if (b) bosse(g, b);
  ajoute(g, c, { amp, liste, m: T(x, y, z).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(hasard() * 3, hasard() * 3, 0))).multiply(new THREE.Matrix4().makeScale(1, sy, 1)) });
};
function Rod(a, b, r, c, seg = 6) {  // barre entre deux points du monde [x, y, z]
  const A = new THREE.Vector3(a[0], a[2] + OZ, a[1]), Bb = new THREE.Vector3(b[0], b[2] + OZ, b[1]), d = Bb.clone().sub(A), L = d.length();
  const m = new THREE.Matrix4().compose(A.clone().add(Bb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
  ajoute(new THREE.CylinderGeometry(r, r, L, seg), c, { amp: 0.03, par: 6, m });
}
const Tor = (x, y, z, R, r, c, axe = 'x') => ajoute(new THREE.TorusGeometry(R, r, 6, 16), c, { amp: 0.03, m: T(x, y, z).multiply(axe === 'x' ? new THREE.Matrix4().makeRotationY(Math.PI / 2) : new THREE.Matrix4().makeRotationX(Math.PI / 2)) });
// posé sur une face de mur : u le long du mur, z en hauteur, e l'épaisseur vers l'intérieur de la pièce
const face = (axe, f) => (u, z, e, lu, lz, le, c, amp = 0.03) => (axe === 'x' ? B(f + e, u, z, le, lu, lz, c, amp) : B(u, f + e, z, lu, le, lz, c, amp));

// ---------------------------------------------------------------- couleurs et matières
const MOTIFS = { herbe: '#7cc46a', parquet: '#e6b980', carrelage: '#ece6da', chaud: '#f3c9a8', moquette: '#cdb894', bleue: '#a9c7e8', lino: '#e9eef2', vert: '#d3ebe2',
  beton: '#d6d3cc', couloir: '#efe6d2', pave: '#cfc8b8', pyramides: '#2f3a46', jaune: '#ffe08a', violet: '#c3b0ea', marches: '#d7dde3', bois: '#cf9a5e', ecran: '#6fb4f0' };
function teinte(f) {
  if (!f || f === 'none') return null;
  const u = /url\(#i-([a-z]+)\)/.exec(f);
  if (u) return MOTIFS[u[1]] || null;
  const r = /rgba?\(([^)]+)\)/.exec(f);
  if (r) { const [R, G, Bl, A = 1] = r[1].split(',').map(Number); return A < 0.5 ? null : A < 1 ? { verre: `rgb(${R},${G},${Bl})` } : `rgb(${R},${G},${Bl})`; }
  return f;
}
const VERRE = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide });
const LUMINEUX = new Set(['#7cc0f2', '#ff9a4a', '#ff6b5a', '#7be08a', '#ffe08a', '#fff2c8']);
const MAT_LOT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide });
const MAT_LUEUR = new THREE.MeshBasicMaterial({ vertexColors: true });
const MAT_EAU = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15, side: THREE.DoubleSide });
function texture(dessine, taille = 256) {
  const cv = Object.assign(document.createElement('canvas'), { width: taille, height: taille }), c = cv.getContext('2d');
  dessine(c, taille);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const tache = (c, n, cols, s, tmin, tmax) => { for (let i = 0; i < n; i++) { c.fillStyle = pioche(cols); const r = tmin + hasard() * (tmax - tmin); c.fillRect(hasard() * s, hasard() * s, r, r); } };
let TEX = null;
function textures() {  // une fois, au premier décor
  TEX = {
    herbe: [160, texture((c, s) => { c.fillStyle = '#74bb58'; c.fillRect(0, 0, s, s); tache(c, 60, ['#6fb553', '#7cc35f'], s, 30, 70); for (let i = 0; i < 2600; i++) { c.strokeStyle = pioche(['#5fa647', '#84c866', '#6db251', '#92d072', '#57993f']); c.beginPath(); const x = hasard() * s, y = hasard() * s; c.moveTo(x, y); c.lineTo(x + (hasard() - 0.5) * 4, y - 3 - hasard() * 4); c.stroke(); } })],
    beton: [90, texture((c, s) => { c.fillStyle = '#d3d0c8'; c.fillRect(0, 0, s, s); tache(c, 1400, ['#c6c3bb', '#dcd9d2', '#bdbab2'], s, 1, 3); c.fillStyle = '#a8a59d'; c.fillRect(0, 0, s, 2); c.fillRect(0, 0, 2, s); })],
    pave: [40, texture((c, s) => { c.fillStyle = '#9d9789'; c.fillRect(0, 0, s, s); const k = s / 4; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { c.fillStyle = pioche(['#cfc8b8', '#c4bdab', '#d8d2c4', '#bab3a1']); c.fillRect(i * k + (j % 2 ? k / 2 : 0) + 3, j * k + 3, k - 6, k - 6); if (j % 2 && i === 3) c.fillRect(3 - k / 2, j * k + 3, k - 6, k - 6); } })],
    parquet: [70, texture((c, s) => { const k = s / 6; for (let j = 0; j < 6; j++) { c.fillStyle = pioche(['#e6b980', '#dcae74', '#edc48d', '#d6a468']); c.fillRect(0, j * k, s, k - 2); c.fillStyle = '#b78a54'; c.fillRect(0, j * k + k - 2, s, 2); c.fillRect((j * 97) % s, j * k, 2, k); } })],
    asphalte: [80, texture((c, s) => { c.fillStyle = '#54595e'; c.fillRect(0, 0, s, s); tache(c, 3000, ['#4b5055', '#5f6469', '#696e73', '#44494e'], s, 1, 2.5); })],
  };
  for (const nom of ['carrelage', 'chaud', 'moquette', 'bleue', 'lino', 'vert', 'couloir', 'violet', 'jaune', 'marches']) {
    const c0 = MOTIFS[nom], c1 = new THREE.Color(c0), f = (k) => '#' + c1.clone().multiplyScalar(k).getHexString(THREE.SRGBColorSpace);
    const dalle = ['carrelage', 'lino', 'vert', 'couloir', 'marches', 'chaud'].includes(nom);
    TEX[nom] = [dalle ? 44 : 60, texture((c, s) => { c.fillStyle = c0; c.fillRect(0, 0, s, s); tache(c, dalle ? 500 : 2600, [f(0.96), f(1.03), f(0.92)], s, 1, dalle ? 2 : 3); if (dalle) { c.fillStyle = f(0.82); c.fillRect(0, 0, s, 3); c.fillRect(0, 0, 3, s); } })];
  }
}
function matTexture(nom, w, h, teinteSol = null) {
  const [s, t0] = TEX[nom], t = t0.clone(); t.needsUpdate = true; t.repeat.set(w / s, h / s);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  if (teinteSol && nom === 'herbe') m.color.set(teinteSol);
  return m;
}

// ---------------------------------------------------------------- ce que plan.js a décrit
const estLaVoitureDuGarage = (x, y) => x >= 538 && x <= 570 && y >= 698 && y <= 758;
function construire(prims, groupe, garage = false) {
  for (const x of prims) {
    if (x.t === 'boite') {
      if (garage && (estLaVoitureDuGarage(x.x, x.y) || (x.x === 460 && x.y === 600))) continue;  // refaits plus finement
      const c = teinte(x.c); if (!c) continue;
      if (c.verre) { const m = new THREE.Mesh(new THREE.BoxGeometry(x.w, x.h, x.dp), VERRE); m.position.set(x.x + x.w / 2, x.z + x.h / 2, x.y + x.dp / 2); groupe.add(m); continue; }
      const haut = teinte(x.haut), fa = teinte(x.face), lum = x.face && /ecran/.test(x.face), fx = teinte(x.faceX), lumX = x.faceX && /ecran/.test(x.faceX);
      B(x.x, x.y, x.z, x.w, x.dp, x.h, c, 0.05, typeof haut === 'string' ? haut : null, typeof fa === 'string' && !lum ? fa : null, LOT, typeof fx === 'string' && !lumX ? fx : null);
      if (lumX) B(x.x + x.w, x.y + 0.6, x.z + 0.6, 0.2, x.dp - 1.2, x.h - 1.2, '#6fb4f0', 0, null, null, LUEUR);
      if (lum) B(x.x + 0.6, x.y + x.dp, x.z + 0.6, x.w - 1.2, 0.2, x.h - 1.2, '#6fb4f0', 0, null, null, LUEUR);
    } else if (x.t === 'boule') {
      const c = teinte(x.c); if (!c) continue;
      if (x.r >= 10) {  // feuillage : une boule bosselée et ses voisines
        Sph(x.x, x.y, x.z, x.r, c, 1, 0.14, 0.92, 0.28);
        for (let k = 0; k < 4; k++) { const a = hasard() * 6.28; Sph(x.x + Math.cos(a) * x.r * 0.7, x.y + Math.sin(a) * x.r * 0.7, x.z - x.r * 0.2 + hasard() * x.r * 0.5, x.r * (0.45 + hasard() * 0.2), c, 1, 0.16, 0.92, 0.3); }
      } else Sph(x.x, x.y, x.z, x.r, c, 1, 0.1, 1, 0, LUMINEUX.has(c) ? LUEUR : LOT);
    } else if (x.t === 'bouton') {
      if (garage && estLaVoitureDuGarage(x.x, x.y)) continue;
      const c = teinte(x.c); if (c) Sph(x.x, x.y + 0.3, x.z, Math.max(x.r, 0.8), c, 0, 0.02, 1, 0, LUMINEUX.has(c) ? LUEUR : LOT);
    } else if (x.t === 'cable') {
      const [a, b] = [x.a, x.b], mil = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(0.3, Math.min(a[2], b[2]) - x.creux * 0.4)];
      const courbe = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a[0], a[2], a[1]), new THREE.Vector3(mil[0], mil[2], mil[1]), new THREE.Vector3(b[0], b[2], b[1]));
      ajoute(new THREE.TubeGeometry(courbe, 10, Math.max(0.35, x.w * 0.35), 5), teinte(x.c) || '#3d3d3d', { amp: 0.02 });
    } else if (x.t === 'poly') {
      const c = teinte(x.c); if (!c || x.p.length < 3) continue;
      const v = [];
      for (let k = 1; k < x.p.length - 1; k++) for (const q of [x.p[0], x.p[k], x.p[k + 1]]) v.push(q[0], q[2] + 0.15, q[1]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      if (c.verre === 'rgb(255,255,255)') { ajoute(g, '#f4f7fa', { amp: 0.01, par: v.length / 3 }); continue; }  // stores
      if (c.verre) { groupe.add(new THREE.Mesh(g, VERRE)); continue; }
      ajoute(g, c, { amp: 0.01, par: v.length / 3 });
    } else if (x.t === 'perso') {
      figurineFixe(x.x, x.y, x.z, x);
    }
  }
}
function fermer(groupe) {  // les listes deviennent des maillages du groupe
  if (LOT.length) { const m = new THREE.Mesh(mergeGeometries(LOT), MAT_LOT); m.castShadow = m.receiveShadow = true; groupe.add(m); }
  if (LUEUR.length) groupe.add(new THREE.Mesh(mergeGeometries(LUEUR), MAT_LUEUR));
  LOT = []; LUEUR = [];
}
const liberer = (o) => o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.map && c.material.map !== CODE) { c.material.map.dispose(); c.material.dispose(); } });
const plan = (groupe, x, y, w, d, z, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x + w / 2, z, y + d / 2); m.receiveShadow = true; groupe.add(m); return m; };

// ---------------------------------------------------------------- figurines
const PANT = '#3a4a6a', CHAUSSURE = '#2b1d14';
function piecesFigurine({ couleur: haut, cheveux, peau, assis, i, pose }) {
  // renvoie { corps, jambes: [g, d], bras: [g, d] } en géométries fusionnées, origine aux pieds, face vers +z ; assis : tout dans le corps
  const L = { corps: [], jg: [], jd: [], bg: [], bd: [] };
  const P = (g, c, lx, ly, lz, liste = L.corps, amp = 0.03, par = 3) => ajoute(g, c, { amp, par, liste, m: new THREE.Matrix4().makeTranslation(lx, ly, lz) });
  const bb = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const membre = (a, b, r, c, liste) => { const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A), Ln = D.length(), g = new THREE.CylinderGeometry(r, r * 1.05, Ln, 6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), D.clone().normalize())); P(g, c, a[0] + D.x / 2, a[1] + D.y / 2, a[2] + D.z / 2, liste, 0.02, 6); };
  const bas = assis ? 10.5 : 10, ep = bas + 13;
  if (assis) for (const s of [-1, 1]) { membre([s * 2.3, bas, 0], [s * 2.3, bas, 7], 1.7, PANT, L.corps); membre([s * 2.3, bas, 7], [s * 2.3, 1, 8], 1.5, PANT, L.corps); P(bb(3, 1.6, 5), CHAUSSURE, s * 2.3, 0.8, 9); }
  else for (const [s, l] of [[-1, L.jg], [1, L.jd]]) { membre([s * 2.3, bas, 0], [s * 2.3, 1.4, 0], 1.6, PANT, l); P(bb(3, 1.8, 5), CHAUSSURE, s * 2.3, 0.9, 1, l); }
  P(new THREE.CylinderGeometry(4.7, 3.7, 13, 6), haut, 0, bas + 6.5, 0, L.corps, 0.05, 6);
  P(bb(9, 1.6, 6), PANT, 0, bas + 0.4, 0);
  for (const [s, l] of [[-1, assis ? L.corps : L.bg], [1, assis ? L.corps : L.bd]]) {
    const main = pose === 'telephone' && s > 0 ? [5.6, ep + 4, 1.5] : assis ? [s * 4.6, ep - 7, 7.5] : [s * 6.2, ep - 11, 1];
    membre([s * 5.2, ep - 1, 0], [s * 5.8, ep - 6.5, assis ? 3 : 0.5], 1.4, haut, l);
    membre([s * 5.8, ep - 6.5, assis ? 3 : 0.5], main, 1.2, haut, l);
    P(new THREE.IcosahedronGeometry(1.4, 0), peau, main[0], main[1], main[2], l, 0.02);
  }
  if (pose === 'telephone') P(bb(1, 4.2, 2), '#1a1a1a', 5.4, ep + 4.5, 2.2, assis ? L.corps : L.bd);
  P(new THREE.CylinderGeometry(1.5, 1.8, 2, 6), peau, 0, ep + 1, 0, L.corps, 0.02, 6);
  const tete = ep + 5.6, st = (typeof i === 'number' ? i : 0) % 4;
  P(new THREE.IcosahedronGeometry(4.5, 1), peau, 0, tete, 0, L.corps, 0.015);
  const coupe = new THREE.SphereGeometry(4.85, 8, 6, 0, Math.PI * 2, 0, Math.PI * (st === 1 ? 0.72 : 0.52));
  if (st === 3) { P(coupe, haut, 0, tete + 0.3, -0.2, L.corps, 0.05); P(bb(6.5, 0.8, 4), haut, 0, tete + 1.3, 5); }  // casquette
  else { P(coupe, cheveux, 0, tete + 0.3, -0.35, L.corps, 0.08); if (st === 2) P(new THREE.IcosahedronGeometry(2.1, 1), cheveux, 0, tete + 5, -1.6, L.corps, 0.06); }
  for (const s of [-1, 1]) P(new THREE.IcosahedronGeometry(0.62, 0), '#1c120b', s * 1.7, tete + 0.3, 4.15, L.corps, 0);
  const fusion = (l) => (l.length ? mergeGeometries(l) : null);
  return { corps: fusion(L.corps), jambes: [fusion(L.jg), fusion(L.jd)], bras: [fusion(L.bg), fusion(L.bd)], hanche: bas, epaule: ep - 1 };
}
function figurineFixe(x, y, z, p) {  // personnage dessiné par plan.js (voisin, hôtesse…) : fait partie du décor
  const f = piecesFigurine({ couleur: teinte(p.haut) || '#6aa8f0', cheveux: teinte(p.cheveux) || '#2b1d14', peau: p.peau, assis: p.assis, i: p.i, pose: p.pose === 'marche' ? 'debout' : p.pose });
  const m = T(x, y, z).multiply(new THREE.Matrix4().makeRotationY(((x * 7 + y) % 628) / 100));
  for (const g of [f.corps, ...f.jambes, ...f.bras]) if (g) { g.applyMatrix4(m); LOT.push(g); }
}
const FIGURES = new Map();  // géométries partagées par apparence
function figureDe(a) {
  const cle = `${a.couleur}|${a.cheveux}|${a.peau}|${typeof a.i === 'number' ? a.i % 4 : 0}|${a.assis}|${a.pose}`;
  if (!FIGURES.has(cle)) FIGURES.set(cle, piecesFigurine(a));
  return FIGURES.get(cle);
}
function creerFigurine(a) {
  const f = figureDe(a), g = new THREE.Group(), buste = new THREE.Group(), mesh = (geo) => { const m = new THREE.Mesh(geo, MAT_LOT); m.castShadow = true; return m; };
  g.add(buste);
  buste.add(mesh(f.corps));
  const articule = (geo, y) => { if (!geo) return null; const pivot = new THREE.Group(), m = mesh(geo); m.position.y = -y; pivot.position.y = y; pivot.add(m); buste.add(pivot); return pivot; };
  return Object.assign(g, { buste, jambes: f.jambes.map((q) => articule(q, f.hanche)), bras: f.bras.map((q) => articule(q, f.epaule)) });
}

// ---------------------------------------------------------------- décor d'un étage
const VERTS = { printemps: ['#4fa043', '#5cb84c', '#6cbf4a', '#88c34e', '#3f8f3a', '#ffb3d1'], ete: ['#3f8f3a', '#4fa043', '#5cb84c', '#2f7a2a', '#6cbf4a', '#88c34e', '#a2c83f', '#2e6e3a'],
  automne: ['#d9822b', '#b8562a', '#e0a23a', '#c9702a', '#a8b85a', '#8a5a2a'], hiver: ['#c9d6d0', '#b8c8c0', '#dfe8e4', '#9fb4a8'] };
const SOLS = { printemps: 0xffffff, ete: 0xffffff, automne: 0xd8c890, hiver: 0xdfe8ee };
function feuillu(x, y, t, couleurs) {
  const c = pioche(couleurs);
  Cyl(x, y, 0, 5 * t, 30 * t, '#6e4a2e', 6, 2.8 * t, 0.1);
  Rod([x, y, 22 * t], [x + 12 * t, y - 4 * t, 38 * t], 1.7 * t, '#6e4a2e', 5); Rod([x, y, 22 * t], [x - 10 * t, y + 6 * t, 36 * t], 1.5 * t, '#6e4a2e', 5);
  Sph(x, y, 46 * t, 22 * t, c, 1, 0.15, 0.9, 0.3);
  const n = 3 + Math.floor(hasard() * 3);
  for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + hasard(), d = (12 + hasard() * 9) * t; Sph(x + Math.cos(a) * d, y + Math.sin(a) * d, (34 + hasard() * 16) * t, (11 + hasard() * 7) * t, hasard() < 0.5 ? c : pioche(couleurs), 1, 0.17, 0.9, 0.34); }
}
function sapin(x, y, t, saison) {
  const c = pioche(VERTS.ete);
  Cyl(x, y, 0, 3.6 * t, 14 * t, '#5e3f28', 6, 2.6 * t, 0.1);
  const tiers = 3 + Math.floor(hasard() * 2);
  for (let k = 0; k < tiers; k++) Cone(x, y, (10 + k * 13) * t, (24 - k * 5) * t, 27 * t, saison === 'hiver' && k === tiers - 1 ? '#eef3f4' : c, 7, hasard() * 3);
}
// Forêt autour de ce qui est construit, seulement dans la zone que le plan peut montrer ; `pris` : où ne pas planter
function foret(saison, pris, n = 150, z = 0) {
  OZ = z;
  const couleurs = VERTS[saison] || VERTS.ete, vus = [];
  for (let k = 0, essais = 0; k < n && essais < n * 12; essais++) {
    const X = -100 + hasard() * (W + 200), Y = -60 + hasard() * (H + 120), [x, y] = PLAN.versMonde(X, Y + z);
    if (pris(x, y) || vus.some(([a, b]) => Math.hypot(a - x, b - y) < 34)) continue;
    vus.push([x, y]); k++;
    const q = hasard(), t = 0.8 + hasard() * 0.9;
    if (q < 0.4) sapin(x, y, t, saison); else if (q < 0.85) feuillu(x, y, t, couleurs); else Sph(x, y, 7 * t, 9 * t, pioche(couleurs), 1, 0.16, 0.8, 0.3);
  }
  OZ = 0;
}
function herbes(groupe, pris, z = 0) {  // touffes et fleurs posées sur la pelouse
  const touffes = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.5, 3), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), 2600);
  const fleurs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 0), new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), 500);
  const mt0 = new THREE.Matrix4(), c0 = new THREE.Color(), place = (mesh, n, cols, h) => {
    for (let k = 0; k < n; k++) {
      let x, y, g = 0;
      do { [x, y] = PLAN.versMonde(-100 + hasard() * (W + 200), -60 + hasard() * (H + 120) + z); g++; } while (pris(x, y) && g < 30);
      mt0.makeTranslation(x, z + h + hasard() * 0.6, y); mesh.setMatrixAt(k, mt0); mesh.setColorAt(k, c0.set(pioche(cols)));
    }
  };
  place(touffes, 2600, ['#5fa647', '#6db251', '#84c866', '#4f9a3c', '#92d072'], 2);
  place(fleurs, 500, ['#ef6f9a', '#ffd34d', '#ffffff', '#b08af0', '#ff7a4a', '#e8467a'], 4);
  touffes.receiveShadow = true;
  groupe.add(touffes, fleurs);
}
function route(groupe, yTrottoir, yRoute, hauteurRoute, z, xDe = -2000, xA = 3400) {  // trottoir, chaussée, tirets, bordure, sur toute la largeur
  const w = xA - xDe;
  plan(groupe, xDe, yTrottoir, w, yRoute - yTrottoir, z + 0.3, matTexture('pave', w, yRoute - yTrottoir));
  plan(groupe, xDe, yRoute, w, hauteurRoute, z + 0.3, matTexture('asphalte', w, hauteurRoute));
  for (let x = xDe; x < xA; x += 50) B(x, yRoute + hauteurRoute / 2 - 2, z + 0.32, 26, 4, 0.06, '#ffe08a', 0);
  B(xDe, yRoute - 1, z, w, 2.5, 1.6, '#b9b4a8', 0.03); B(xDe, yRoute + hauteurRoute - 1, z, w, 2.5, 1.2, '#b9b4a8', 0.03);
}
function fenetre(f, u, z, lu, lz, volets, fleurit) {
  const blanc = '#f7f3ea';
  f(u - 1.6, z - 1.6, 0, lu + 3.2, 1.6, 1.8, blanc); f(u - 1.6, z + lz, 0, lu + 3.2, 1.6, 1.8, blanc); f(u - 1.6, z, 0, 1.6, lz, 1.8, blanc); f(u + lu, z, 0, 1.6, lz, 1.8, blanc);
  f(u + lu / 2 - 0.5, z, 0.5, 1, lz, 1, blanc); f(u, z + lz / 2, 0.5, lu, 1, 1, blanc);
  f(u + 1, z + lz - 8, 0.3, lu - 2, 7, 0.4, '#efe6d2');  // rideau
  f(u - 3, z - 3.4, 0, lu + 6, 1.8, 4, blanc);           // appui
  if (!volets) return;
  for (const du of [-9.5, lu + 1.8]) { f(u + du, z - 1, 0, 7.7, lz + 2, 1.2, '#3f7a5a', 0.05); for (let k = 2; k < lz; k += 3) f(u + du + 0.6, z + k, 1.2, 6.5, 0.6, 0.3, '#346a4d', 0.03); }
  f(u - 1, z - 9, 0, lu + 2, 5.4, 5, '#7a5236', 0.06);   // jardinière
  for (let k = 0; k < lu / 3; k++) fleurit(u + 1 + k * 3, z - 2.6, hasard() < 0.5 ? pioche(['#ef6f9a', '#ffd34d', '#ffffff', '#b08af0', '#ff7a4a']) : '#4fa043');
}
// La maison du garage, le garage, le terrain : tout ce qui n'est pas un meuble du joueur
function detailsGarage(saison) {
  const hx = 70, hy = 300, hw = 320, hd = 380, hh = 70, faite = 140, pc = hx + hw / 2, mx = face('x', hx + hw), my = face('y', hy + hd);
  B(hx - 1, hy - 1, 0, hw + 2, hd + 2, 6, '#8f8c84', 0.05);
  for (let z = 8; z < hh; z += 5) { mx(hy, z, 0, hd, 0.8, 0.7, '#cfc2ab', 0.02); my(hx, z, 0, hw, 0.8, 0.7, '#cfc2ab', 0.02); }
  for (let z = hh + 3; z < faite - 4; z += 5) { const w = hw * (1 - (z - hh) / (faite - hh)); B(hx + (hw - w) / 2, hy + hd + 10, z, w, 0.7, 0.8, '#cfc2ab', 0.02); }
  B(hx + hw - 2, hy + hd - 2, 0, 3, 3, hh, '#f4f1e8', 0.02);
  for (let k = 0; k < 4; k++) fenetre(mx, hy + 40 + k * 90, 20, 30, 30, true, (u, z, c) => Sph(hx + hw + 3, u, z, 1.7, c, 0, 0.1));
  for (const u of [hx + 30, hx + hw - 70]) fenetre(my, u, 22, 40, 30, true, (a, z, c) => Sph(a, hy + hd + 3, z, 1.7, c, 0, 0.1));
  my(pc - 16, 0, 0, 2, 42, 2, '#f7f3ea'); my(pc + 14, 0, 0, 2, 42, 2, '#f7f3ea'); my(pc - 16, 40, 0, 32, 2.4, 2.4, '#f7f3ea');
  my(pc - 10, 8, 0.4, 20, 12, 0.5, '#7a4c2c'); my(pc - 10, 24, 0.4, 20, 12, 0.5, '#7a4c2c'); Sph(pc + 10, hy + hd + 2, 19, 1.1, '#ffc94d', 0);
  B(pc - 22, hy + hd, 0, 44, 10, 3, '#b9b4a8', 0.04); B(pc - 18, hy + hd + 2, 3, 36, 6, 0.4, '#5a4632', 0.05);
  Sph(pc + 21, hy + hd + 2, 44, 2.2, '#fff2c8', 1, 0, 1, 0, LUEUR);
  // toit : rangées de tuiles
  const an = Math.atan2(faite - hh, hw / 2 + 10), lg = Math.hypot(faite - hh, hw / 2 + 10), rangs = 18, parRang = 36, ld = (hd + 20) / parRang;
  for (const sens of [1, -1]) for (let r = 0; r < rangs; r++) for (let k = 0; k < parRang; k++) {
    const q = (r + 0.5) / rangs, cx = pc + sens * (hw / 2 + 10) * (1 - q), hz = hh + (faite - hh) * q + 1.1;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, hz, hy - 10 + (k + (r % 2 ? 0.25 : 0.75)) * ld), new THREE.Quaternion().setFromEuler(new THREE.Euler((hasard() - 0.5) * 0.03, 0, -sens * an + (hasard() - 0.5) * 0.05)), new THREE.Vector3(1, 1, 1));
    ajoute(new THREE.BoxGeometry(lg / rangs + 1.6, 1.5, ld - 0.5), hasard() < 0.1 ? '#a04a33' : hasard() < 0.15 ? '#c9654a' : '#b5543c', { amp: 0.07, par: 36, m });
  }
  B(pc - 2.5, hy - 12, faite, 5, hd + 24, 3, '#8e3f2c', 0.05);
  Rod([hx + hw + 12, hy - 10, hh - 1], [hx + hw + 12, hy + hd + 10, hh - 1], 1.6, '#8d96a1'); Rod([hx + hw + 12, hy + hd + 8, hh - 1], [hx + hw + 2, hy + hd + 8, 1], 1.2, '#8d96a1');
  for (const a of [[hx + hw + 11, hy + hd + 11, hh - 1], [hx - 11, hy + hd + 11, hh - 1]]) Rod(a, [pc, hy + hd + 11, faite + 1], 1.4, '#f4f1e8');
  for (let k = 0; k < 8; k++) {  // panneaux solaires
    const q0 = 0.36 + (k % 2) * 0.24, u0 = hy + 90 + Math.floor(k / 2) * 44, cx = pc + (hw / 2 + 10) * (1 - q0 - 0.11), hz = hh + (faite - hh) * (q0 + 0.11) + 3;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, hz, u0 + 19), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -an)), new THREE.Vector3(1, 1, 1));
    ajoute(new THREE.BoxGeometry(38, 1.2, 40), '#203a66', { amp: 0.02, par: 6, m, faces: ['#b0b8c0', '#b0b8c0', '#23426f', '#b0b8c0', '#b0b8c0', '#b0b8c0'] });
    for (let l = 1; l < 4; l++) { ajoute(new THREE.BoxGeometry(0.4, 1.3, 40), '#8fa8c8', { amp: 0, par: 36, m: m.clone().multiply(new THREE.Matrix4().makeTranslation(-19 + l * 9.5, 0.1, 0)) }); ajoute(new THREE.BoxGeometry(38, 1.3, 0.4), '#8fa8c8', { amp: 0, par: 36, m: m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.1, -20 + l * 10)) }); }
  }
  B(pc + 38, hy + 58, 150, 34, 34, 3, '#6b4a2e', 0.04); Cyl(pc + 55, hy + 75, 153, 4, 9, '#b5543c', 8); Cyl(pc + 46, hy + 68, 153, 3, 7, '#b5543c', 8);
  for (let z = 104; z < 150; z += 5) { B(pc + 70, hy + 60, z, 0.5, 30, 0.7, '#5f4128', 0.02); B(pc + 40, hy + 90, z, 30, 0.5, 0.7, '#5f4128', 0.02); }
  // garage : murs en planches, fenêtre, affiches, pendule, guirlande
  const gx = 430, gy = 400, gw = 250, gF = face('y', gy), gG = face('x', gx);
  for (let z = 5; z < 60; z += 6) { gF(gx, z, 0, gw, 0.7, 0.5, '#a88a64', 0.03); gG(gy, z, 0, gw, 0.7, 0.5, '#9a7c58', 0.03); }
  fenetre(gG, gy + 60, 18, 36, 30, false);
  gG(516, 45, 0, 28, 13, 0.6, '#f4f1e8'); for (let k = 0; k < 3; k++) gG(519, 47.5 + k * 3.4, 0.6, 22 - (k % 2) * 7, 1.6, 0.2, pioche(['#4a8ad8', '#2f8a3a', '#d9534f']), 0);
  gG(582, 45, 0, 30, 13, 0.6, '#2f8a3a'); for (let k = 0; k < 5; k++) gG(585 + k * 5, 47 + (k % 3) * 3, 0.6, 3, 2.4, 0.3, '#d4b24c', 0);
  gF(gx + 225, 40, 0, 12, 12, 1, '#f4f1e8'); gF(gx + 230.5, 46, 1, 1, 5, 0.3, '#2b1d14', 0); gF(gx + 230.5, 45, 1, 4, 1, 0.3, '#2b1d14', 0);
  for (let k = 0; k < 13; k++) { const x0 = gx + 8 + k * 18.6, z0 = 58 - Math.sin(k % 2 ? 1.2 : 0.3) * 3; if (k < 12) Rod([x0, gy + 2, z0], [x0 + 18.6, gy + 2, 58 - Math.sin(k % 2 ? 0.3 : 1.2) * 3], 0.25, '#3d3d3d', 4); Sph(x0, gy + 2, z0 - 1.6, 1.4, pioche(['#ffe08a', '#fff2c8', '#ffb35a']), 0, 0, 1, 0, LUEUR); }
  // établi : tiroirs, lattes, casiers, lampe, tasse
  const [ex, ey, ew, ed] = [440, 408, 232, 44], fe = face('y', ey + ed);
  for (let k = 0; k < 6; k++) { const u = ex + 4 + k * (ew / 6), l = ew / 6 - 6; for (const z of [3, 11]) { fe(u, z, 0, l, 6, 0.7, '#b67a45', 0.05); Rod([u + l / 2 - 3, ey + ed + 1.2, z + 3], [u + l / 2 + 3, ey + ed + 1.2, z + 3], 0.4, '#d6d3cc', 4); } }
  for (let k = 1; k < 8; k++) B(ex, ey + k * ed / 8, 20, ew, 0.3, 0.1, '#a8703f', 0);
  for (let j = 0; j < 3; j++) for (let k = 0; k < 6; k++) B(636 + k * 5.6, 411, 20 + j * 4.6, 5, 7, 4.2, pioche(['#4a8ad8', '#ef6f9a', '#ffc94d', '#7be08a', '#e8e8e0']), 0.04);
  Cyl(447, 440, 20, 2.6, 5, '#f4f1e8', 10); Tor(450, 440, 22.6, 1.4, 0.4, '#f4f1e8', 'z');
  Cyl(660, 444, 20, 3.4, 1, '#3d3d3d', 8); Rod([660, 444, 21], [654, 438, 38], 0.6, '#d9534f'); Rod([654, 438, 38], [646, 442, 46], 0.6, '#d9534f'); Cyl(646, 442, 41, 4.4, 5, '#d9534f', 8, 2); Sph(646, 442, 41, 2, '#fff2c8', 1, 0, 1, 0, LUEUR);
  const sol = 0.5;  // au-dessus des couches du sol
  B(432, 454, sol, 66, 170, 0.4, '#5d7a96', 0.02); for (let k = 0; k < 6; k++) B(436 + k * 11, 457, sol + 0.4, 1.6, 164, 0.06, '#7a96b0', 0);
  for (let k = 0; k < 15; k++) B(gx + 50 + k * 10, gy + gw - 11, sol, 10, 7, 0.1, k % 2 ? '#ffc94d' : '#2b2b2b', 0);
  for (let k = 0; k < 3; k++) Tor(466, 632, 2.8 + k * 5.6, 8.5, 2.9, '#26262a', 'z');
  for (const dy of [-6, 6]) Rod([446, 634 + dy, 0], [432, 634 + dy, 58], 0.9, '#d6d3cc');
  for (let k = 1; k < 10; k++) { const q = k / 10; Rod([446 - 14 * q, 628, 58 * q], [446 - 14 * q, 640, 58 * q], 0.5, '#b9c0c7', 5); }
  Cyl(433, 448, 10, 2.2, 15, '#d9352c', 8); Cyl(433, 448, 25, 1, 3, '#2b2b2b', 6);
  Cyl(664, 630, 0, 5.6, 8, '#b5543c', 8, 6.6); for (let k = 0; k < 7; k++) { const a = k * 0.9; Sph(664 + Math.cos(a) * 4, 630 + Math.sin(a) * 4, 12 + k * 1.6, 4, '#3e8f33', 0, 0.2); }
  // vélo contre le muret, voiture dans l'allée
  const vx = 456, vy = 656;
  for (const dy of [2, 22]) { Tor(vx, vy + dy, 6, 5.4, 0.55, '#222222', 'x'); Cyl(vx, vy + dy, 5.6, 1, 0.8, '#d6d3cc', 6); }
  Rod([vx, vy + 2, 6], [vx, vy + 12, 12], 0.5, '#d9534f'); Rod([vx, vy + 22, 6], [vx, vy + 12, 12], 0.5, '#d9534f'); Rod([vx, vy + 2, 6], [vx, vy + 4, 15], 0.5, '#d9534f'); Rod([vx - 4.5, vy + 4, 15.5], [vx + 4.5, vy + 4, 15.5], 0.5, '#2b2b2b'); B(vx - 1.5, vy + 13, 13, 3, 6, 1.4, '#2b2b2b', 0);
  voitureDansLot(540, 700, '#3a7bc8');
  // clôture, potager, terrasse, massifs, mobilier de rue
  const piquets = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / 9), dx = (x1 - x0) / L, dy = (y1 - y0) / L; for (let k = 0; k <= n; k++) B(x0 + dx * k * 9 - 1.6, y0 + dy * k * 9 - 1.6, 0, dx ? 3.2 : 1, dy ? 3.2 : 1, 15 + (k % 2), '#c49a68', 0.08); B(x0, y0, 5, x1 - x0 || 0.8, y1 - y0 || 0.8, 1.6, '#a87e50', 0.05); B(x0, y0, 11, x1 - x0 || 0.8, y1 - y0 || 0.8, 1.6, '#a87e50', 0.05); };
  piquets(40, 120, 820, 120); piquets(40, 120, 40, 800); piquets(820, 120, 820, 800);
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) { const x = 128 + k * 34, y = 186 + j * 16; Sph(x, y, 5, 5.2, pioche(['#4fa043', '#5cb84c', '#3e8f33']), 1, 0.16, 0.8, 0.3); if ((k + j) % 3 === 0) Sph(x + 2, y, 8.4, 1.6, pioche(['#d9352c', '#ff7a4a', '#ffc94d']), 0); }
  Cyl(90, 180, 0, 8, 17, '#7a5236', 10, 9); for (const z of [3, 13]) Tor(90, 180, z, 8.6, 0.5, '#3d3d3d', 'z'); Cyl(90, 180, 16.6, 7.6, 0.4, '#4a90c8', 10);
  Rod([160, 717, 0], [160, 717, 42], 0.8, '#e8e8e0'); ajoute(new THREE.ConeGeometry(30, 11, 8), '#d9534f', { amp: 0, m: T(160, 717, 44), faces: Array.from({ length: 32 }, (_, k) => (k % 2 ? '#d9534f' : '#f7f3ea')) });
  Cyl(258, 736, 0, 8, 12, '#3d3d3d', 10, 9); B(249, 727, 12, 18, 18, 1.5, '#8d96a1', 0.02);
  for (const [x, y] of [[118, 690], [282, 690], [118, 744]]) { Cyl(x, y, 0, 5, 8, '#b5543c', 8, 6); Sph(x, y, 13, 6.5, '#4fa043', 1, 0.16, 1, 0.3); }
  const fl = ['#ef6f9a', '#ffd34d', '#ffffff', '#b08af0', '#ff7a4a', '#e8467a'];
  for (let k = 0; k < 90; k++) { const le = hasard() < 0.55, x = le ? 396 + hasard() * 18 : 300 + hasard() * 86, y = le ? 300 + hasard() * 86 : 684 + hasard() * 11; Sph(x, y, 3, 2.6, '#4fa043', 0, 0.2); Sph(x, y, 5.4, 1.5, pioche(fl), 0, 0.05); }
  for (let k = 0; k < 8; k++) ajoute(new THREE.CylinderGeometry(7, 7.6, 0.8, 7), '#c4bdab', { amp: 0.06, par: 6, m: T(230 + 30 * k, 700 + 7.5 * k, 0.4) });
  B(600, 815, 8, 40, 7, 1.6, '#a87e50', 0.05); B(600, 814, 11, 40, 1.4, 8, '#a87e50', 0.05); for (const x of [603, 635]) B(x, 816, 0, 2, 6, 8, '#3d3d3d', 0.02);
  Cyl(650, 820, 0, 4.2, 13, '#3f7a5a', 8, 4.8);
  for (const [x, y, t] of [[600, 190, 1.1], [760, 640, 1.05], [790, 340, 1.2], [90, 480, 0.9], [640, 300, 0.85]]) feuillu(x, y, t, VERTS[saison] || VERTS.ete);
  for (const [x, y, t] of [[780, 180, 1.2], [420, 160, 1], [730, 300, 0.9], [60, 620, 1.1]]) sapin(x, y, t, saison);
}
// Rivière : un peu d'eau dans le paysage
function ruban(pts, w, c, y, liste, z = 0) {
  const courbe = new THREE.CatmullRomCurve3(pts.map(([a, b]) => new THREE.Vector3(a, 0, b))), v = [], n = 60, P = (k, s) => { const q = courbe.getPoint(k / n), t = courbe.getTangent(k / n), l = w * (1 + 0.14 * Math.sin(k * 0.6)) * 0.5; return [q.x + s * t.z * l, y + z, q.z - s * t.x * l]; };
  for (let k = 0; k < n; k++) v.push(...P(k, -1), ...P(k, 1), ...P(k + 1, 1), ...P(k, -1), ...P(k + 1, 1), ...P(k + 1, -1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  ajoute(g, c, { amp: 0.018, par: 6, liste });
  return courbe.getPoints(n).map((q) => [q.x, q.z]);
}
function riviere(pts, EAU, z = 0) {
  const b = ruban(pts, 74, '#d9c896', 0.1, LOT, z); ruban(pts, 58, '#2f6f8f', 0.2, LOT, z); ruban(pts, 50, '#55aede', 0.35, EAU, z);
  return b;
}
const voisinDe = (l, x, y, d) => l.some(([a, b]) => Math.hypot(a - x, b - y) < d);
let DECOR = null, DY = 0, ETAGE = 'garage', VOIES = null;
const CENTRE_SOLEIL = new THREE.Vector3();
function decor(e, cat, etage) {
  if (!TEX) textures();
  if (DECOR) { scene.remove(DECOR); liberer(DECOR); }
  DECOR = new THREE.Group(); scene.add(DECOR);
  hasard0 = 11;
  ETAGE = etage; DY = etage === 'garage' ? 0 : cat.etages[etage].y0;
  const saison = e.saison || 'ete', garage = etage === 'garage';
  let fond = '';
  const prims = PLAN.capture(() => { fond = PLAN.fond(e, cat); PLAN.fixes(e, cat); PLAN.devant(e, cat); });
  // second établi du labo : dosseret côté mur
  for (const [ex, ey, , ed] of cat.etablis[garage ? 'garage' : 'batiment']) if (ey === 1678) for (const x of prims) if (x.t === 'boite' && x.x === ex && x.y === ey && x.dp === 4 && x.z === 20) x.y = ey + ed - 4;
  construire(prims, DECOR, garage);
  // le sol : les rectangles et ronds du plan à plat
  const plat = /translate\(0 -?\d+\)">([\s\S]*)<\/g><\/g>/.exec(fond)[1];
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${plat}</svg>`, 'image/svg+xml');
  let couche = 0;
  const herbe = SOLS[saison] || 0xffffff;
  for (const el of doc.querySelectorAll('rect, circle')) {
    const f = el.getAttribute('fill'), n = (k) => parseFloat(el.getAttribute(k)) || 0, c = teinte(f);
    if (!c || c.verre || f === '#c6dbea' || f === '#c99a63') continue;  // le ciel des étages ; la clôture dessinée à plat
    const z = 0.004 * ++couche, u = /i-([a-z]+)/.exec(f), nom = u && TEX[u[1]] ? u[1] : f === '#565b60' ? 'asphalte' : null;
    if (el.nodeName === 'circle') { const m = new THREE.Mesh(new THREE.CircleGeometry(n('r'), 12), new THREE.MeshStandardMaterial({ color: c })); m.rotation.x = -Math.PI / 2; m.position.set(n('cx'), z, n('cy')); m.receiveShadow = true; DECOR.add(m); continue; }
    plan(DECOR, n('x'), n('y'), n('width'), n('height'), z, nom ? matTexture(nom, n('width'), n('height'), herbe) : new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  }
  const EAU = [];
  if (garage) {
    plan(DECOR, -3000, -3000, 7000, 7000, -0.5, matTexture('herbe', 7000, 7000, herbe));
    route(DECOR, 810, 834, 50, 0.05);
    detailsGarage(saison);
    const cours = riviere([[1040, -500], [960, -180], [1050, 90], [950, 400], [1060, 660], [1020, 800], [1030, 900], [1160, 1300]], EAU);
    const pris = (x, y) => (x > 28 && x < 832 && y > 108 && y < 812) || (y > 790 && y < 905) || voisinDe(cours, x, y, 56);
    foret(saison, pris);
    const pelouse = (x, y) => (y > 806 && y < 890) || (x > 58 && x < 412 && y > 288 && y < 700) || (x > 416 && x < 690 && y > 386 && y < 660) || (x > 476 && x < 634 && y > 646 && y < 815) || (x > 106 && x < 296 && y > 678 && y < 756) || (x > 96 && x < 344 && y > 156 && y < 274) || voisinDe(cours, x, y, 50);
    herbes(DECOR, pelouse);
    VOIES = { x0: -300, x1: 1300, voie1: 846, voie2: 870, trottoir: 822, porte: 555, seuil: 660, arret: 500, v: 1.6 };
  } else if (etage === 'rdc') {
    plan(DECOR, -4000, -3000, 9000, 9000, -0.5, matTexture('herbe', 9000, 9000, herbe));
    route(DECOR, 776, 800, 64, 0.05);
    const pris = (x, y) => (x > 0 && x < 1300 && y > 0 && y < 790) || (y > 760 && y < 880);
    foret(saison, pris, 110);
    herbes(DECOR, (x, y) => (x > 10 && x < 1290 && y > 10 && y < 780) || (y > 770 && y < 880));
    VOIES = { x0: -700, x1: 1900, voie1: 816, voie2: 848, trottoir: 788, porte: 636, seuil: 744, arret: 300, v: 2.4 };
  } else {
    // à l'étage : le bâtiment dessous, le paysage en contrebas
    const SOL = etage === 'r1' ? -110 : -220, [bx, by, bw, bh] = [20, DY + 20, 1260, 720];
    plan(DECOR, -4000, DY - 3000, 9000, 9000, SOL, matTexture('herbe', 9000, 9000, herbe));
    route(DECOR, DY + 776, DY + 800, 64, SOL);
    for (const [x, y, w, h] of cat.coques[etage]) { B(x, y, SOL, w, h, -SOL - 0.3, '#d8cdb8', 0.015); B(x - 4, y - 4, -6, w + 8, h + 8, 5.7, '#b8ac96', 0.02); }
    if (etage === 'r2') B(bx, by, SOL, 540, 720, -SOL - 0.4, '#d8cdb8', 0.015);
    for (let z = SOL + 26; z < -56; z += 84) {
      for (let k = 0; k < 18; k++) { const x = bx + 24 + k * 68; B(x, by + bh, z, 40, 0.8, 54, '#f4f1e8', 0); B(x + 2, by + bh + 0.6, z + 2, 36, 0.6, 50, '#7fb4d8', 0.03); B(x + 19.5, by + bh + 1.1, z, 1, 0.5, 54, '#f4f1e8', 0); }
      for (let k = 0; k < 10; k++) { const y = by + 20 + k * 68; B(bx + bw, y, z, 0.8, 40, 54, '#f4f1e8', 0); B(bx + bw + 0.6, y + 2, z + 2, 0.6, 36, 50, '#7fb4d8', 0.03); B(bx + bw + 1.1, y + 19.5, z, 0.5, 1, 54, '#f4f1e8', 0); }
    }
    const pris = (x, y) => (x > -40 && x < 1340 && y > DY - 40 && y < DY + 780) || (y > DY + 766 && y < DY + 872);
    foret(saison, pris, 120, SOL);
    // affiches entre les fenêtres, plinthes
    const cadres = ['#e0474c', '#3a7bc8', '#2f8a3a', '#e0923a', '#7a5fc4', '#f4f1e8'];
    for (const [x, y, w, h] of cat.coques[etage]) {
      for (let k = 0; (k + 1) * 64 < w; k += 2) { const a = x + 18 + 36 + 14 + k * 64 - 9; B(a, y, 24, 18, 0.6, 26, '#2b1d14', 0); B(a + 1, y + 0.4, 25, 16, 0.4, 24, pioche(cadres), 0.02); }
      for (let k = 1; (k + 1) * 64 < h; k += 2) { const b = y + 18 + 36 + 14 + k * 64 - 9; B(x, b, 24, 0.6, 18, 26, '#2b1d14', 0); B(x + 0.4, b + 1, 25, 0.4, 16, 24, pioche(cadres), 0.02); }
      B(x, y, 0.2, w, 1, 4, '#8d7a62', 0.02); B(x, y, 0.2, 1, h, 4, '#7d6a52', 0.02);
    }
    VOIES = null;
  }
  // établis du bâtiment : tiroirs, lattes, casiers, lampe
  if (!garage) for (const [ex, ey, ew, ed] of cat.etablis.batiment) if (ey >= DY && ey < DY + 1000) {
    const contreBas = ey === 1678, f = face('y', ey + ed), n = Math.floor(ew / 38);
    if (!contreBas) for (let k = 0; k < n; k++) { const u = ex + 3 + k * (ew / n), l = ew / n - 5; for (const z of [3, 11]) { f(u, z, 0, l, 6.2, 0.7, '#6fb0d0', 0.05); Rod([u + l / 2 - 3, ey + ed + 1.2, z + 3], [u + l / 2 + 3, ey + ed + 1.2, z + 3], 0.4, '#e8edf2', 4); } }
    for (let k = 1; k < 8; k++) B(ex, ey + k * ed / 8, 20, ew, 0.3, 0.08, '#4f93b8', 0);
    if (!contreBas) { const [x, y] = [ex + 222, ey + 36]; Cyl(x, y, 20, 3.4, 1, '#3d3d3d', 8); Rod([x, y, 21], [x - 6, y - 6, 38], 0.6, '#d9534f'); Rod([x - 6, y - 6, 38], [x - 14, y - 2, 46], 0.6, '#d9534f'); Cyl(x - 14, y - 2, 41, 4.4, 5, '#d9534f', 8, 2); Sph(x - 14, y - 2, 41, 2, '#fff2c8', 1, 0, 1, 0, LUEUR); }
  }
  if (EAU.length) { const m = new THREE.Mesh(mergeGeometries(EAU), MAT_EAU); m.receiveShadow = true; DECOR.add(m); }
  fermer(DECOR);
  // soleil et caméra sur cet étage : la projection de plan.js, centrée au milieu de son monde
  const [cx, cy] = PLAN.versMonde(W / 2, H / 2);
  CENTRE_SOLEIL.set(cx, 0, cy);
  camera.position.set(cx + 5000, 5000, cy + 5000);
  camera.lookAt(cx, 0, cy);
  camera.updateMatrixWorld();
  soleil.position.set(cx - 340, 1000, cy - 260);
  soleil.target.position.copy(CENTRE_SOLEIL);
  soleil.target.updateMatrixWorld();
  soleil.shadow.needsUpdate = true;
  creerRue();
}

// ---------------------------------------------------------------- meubles du joueur
const CODE_TEX = () => texture((c, s) => { c.fillStyle = '#0d1f3a'; c.fillRect(0, 0, s, s); for (let j = 0; j < 22; j++) { let x = 8 + (j % 4) * 14; for (let k = 0; k < 4; k++) { const l = 8 + hasard() * 44; c.fillStyle = pioche(['#7cc0f2', '#ffc94d', '#7be08a', '#ef6f9a', '#d6dee8']); c.fillRect(x, 6 + j * 11, l, 5); x += l + 7; } } });
let CODE = null;
const OBJETS = new Map(), ECRANS = new Map();
function pivote(x, o, H0) {  // meuble tourné selon son mur : n tel quel, o et e long côté contre le mur, s dos au mur du bas
  const c = o.cote || 'n', dy = (b) => b - o.y, dx = (a) => a - o.x;
  if (c === 'n') return x;
  const S = (a, b) => (c === 'o' ? [o.x + dy(b), o.y + dx(a)] : c === 's' ? [a, o.y + H0 - dy(b)] : [o.x + H0 - dy(b), o.y + dx(a)]);
  if (x.t === 'boite') {
    if (c === 'o') return { ...x, x: o.x + dy(x.y), y: o.y + dx(x.x), w: x.dp, dp: x.w, face: null, faceX: x.face };
    if (c === 's') return { ...x, y: o.y + H0 - dy(x.y) - x.dp, face: null };
    return { ...x, x: o.x + H0 - dy(x.y) - x.dp, y: o.y + dx(x.x), w: x.dp, dp: x.w, face: null };
  }
  if (x.t === 'boule' || x.t === 'bouton') { const [a, b] = S(x.x, x.y); return { ...x, x: a, y: b }; }
  if (x.t === 'poly') return { ...x, p: x.p.map(([a, b, z]) => [...S(a, b), z]) };
  if (x.t === 'cable') return { ...x, a: [...S(x.a[0], x.a[1]), x.a[2]], b: [...S(x.b[0], x.b[1]), x.b[2]] };
  return x;
}
function construireObjet({ o, f, panne, sel, etablis }) {
  const g = new THREE.Group(), prims = PLAN.capture(() => PLAN.objet(o, f, etablis)).map((x) => pivote(x, o, f.h));
  const tourne = o.cote === 'o' || o.cote === 'e', [w, d] = tourne ? [f.h, f.w] : [f.w, f.h];
  if (o.type === 'clim') for (const x of prims) if (x.t === 'boite') { x.z = 61; x.h = 7; x.dp = 9; }  // en haut du mur
  construire(prims, g);
  if (o.type === 'plantes') { const x = o.x + 14, y = o.y + 14; for (let k = 0; k < 7; k++) { const a = k * 0.9, r = k ? 6 : 0; Sph(x + Math.cos(a) * r, y + Math.sin(a) * r, 13 + (k % 3) * 3.5, 5.6, pioche(['#3e8f33', '#4fa043', '#5cb84c']), 1, 0.16, 0.9, 0.3); } }
  if (panne) Sph(o.x + w / 2, o.y + d / 2, 50, 4.5, '#ff5a4a', 1, 0, 1, 0, LUEUR);
  fermer(g);
  if (sel) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, d + 8), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.45 })); m.rotation.x = -Math.PI / 2; m.position.set(o.x + w / 2, 0.8, o.y + d / 2); g.add(m); }
  if (o.type === 'poste' && (o.cote === 'n' || o.cote === 'o' || !o.cote)) {  // écran où défile le code quand quelqu'un y travaille
    CODE = CODE || CODE_TEX();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(29, 15.5), new THREE.MeshBasicMaterial({ map: CODE }));
    if (o.cote === 'o') { m.rotation.y = Math.PI / 2; m.position.set(o.x + 9.45, 34, o.y + 39); } else m.position.set(o.x + 39, 34, o.y + 9.45);
    m.visible = false; g.add(m); ECRANS.set(o.id, m);
  }
  return g;
}
function elements(liste) {
  const vus = new Set();
  for (const el of liste) {
    vus.add(el.cle);
    if (!OBJETS.has(el.cle)) { const g = construireObjet(el); scene.add(g); OBJETS.set(el.cle, g); soleil.shadow.needsUpdate = true; }
  }
  for (const [k, g] of OBJETS) if (!vus.has(k)) { scene.remove(g); liberer(g); OBJETS.delete(k); soleil.shadow.needsUpdate = true; }
}
let ZONES = null;
function zones(liste) {
  if (ZONES) { scene.remove(ZONES); ZONES.traverse((c) => { if (c.geometry) { c.geometry.dispose(); c.material.dispose(); } }); }
  ZONES = new THREE.Group(); scene.add(ZONES);
  for (const { x, y, w, h, couleur, alpha } of liste) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: alpha, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x + w / 2, 1, y + h / 2); ZONES.add(m); }
}

// ---------------------------------------------------------------- personnages
const PERSOS = new Map(), ORIENT = { n: Math.PI, o: -Math.PI / 2, s: 0, e: Math.PI / 2 };
function persos(liste) {
  const vus = new Set();
  for (const p of liste) {
    vus.add(p.id);
    let o = PERSOS.get(p.id);
    const app = p.figure, cleFig = JSON.stringify(app);
    if (!o) {
      o = { x: p.x, y: p.y, rot: (p.id.length * 2.1) % 6.28 };
      PERSOS.set(p.id, o);
      if (p.arrive) nuage(p.x, p.y);
    }
    if (o.cleFig !== cleFig) { if (o.g) scene.remove(o.g); o.cleFig = cleFig; o.g = creerFigurine(app); scene.add(o.g); o.assis = app.assis; o.carton = null; }
    Object.assign(o, { anim: p.anim, secoue: p.secoue, affale: p.affale, cote: p.cote });
    if (o.cX !== p.x || o.cY !== p.y) {  // nouvelle destination : il y marche (chemin fourni) ou il y est posé ; sinon la marche en cours continue
      o.cX = p.x; o.cY = p.y;
      o.marche = p.chemin && p.chemin.length && !DOUX.matches ? { pts: [[o.x, o.y], ...p.chemin], t0: maintenant, duree: p.duree * 1000 } : null;
      if (!o.marche) { o.x = p.x; o.y = p.y; }
    }
    const cleBulle = p.bulle ? p.bulle.texte + '|' + p.bulle.couleur : '';
    if (o.cleBulle !== cleBulle) {
      o.cleBulle = cleBulle;
      if (o.bulle) o.bulle.remove();
      o.bulle = null;
      if (p.bulle) { o.bulle = document.createElement('div'); o.bulle.className = 'bulle'; o.bulle.textContent = p.bulle.texte; o.bulle.style.background = p.bulle.couleur; calqueBulles.appendChild(o.bulle); o.bulleL = o.bulle.offsetWidth; }
    }
    if (p.carton && !o.carton) { const sauve = LOT; LOT = []; B(-7, 5, 15, 14, 8, 10, '#c48a52', 0.03); B(-7.3, 8, 15, 14.6, 1.5, 10.2, '#a8703f', 0); o.carton = new THREE.Mesh(mergeGeometries(LOT), MAT_LOT); LOT = sauve; o.carton.castShadow = true; o.g.buste.add(o.carton); }
    else if (!p.carton && o.carton) { o.g.buste.remove(o.carton); o.carton.geometry.dispose(); o.carton = null; }
  }
  for (const [id, o] of PERSOS) if (!vus.has(id)) {
    if (String(id).startsWith('f')) nuage(o.x, o.y);  // celui qui part disparaît dans un petit nuage
    if (o.bulle) o.bulle.remove();
    scene.remove(o.g);
    PERSOS.delete(id);
  }
}
const position = (id) => { const o = PERSOS.get(id); return o ? [o.x, o.y] : null; };
function animerPerso(o, t) {
  let dirige = null;
  if (o.marche) {
    const m = o.marche, k = Math.min(1, (maintenant - m.t0) / m.duree);
    if (!m.long) { m.long = [0]; for (let i = 1; i < m.pts.length; i++) m.long.push(m.long[i - 1] + Math.hypot(m.pts[i][0] - m.pts[i - 1][0], m.pts[i][1] - m.pts[i - 1][1])); }
    const L = m.long.at(-1) * k, i = Math.max(1, m.long.findIndex((l) => l >= L)), a = m.pts[i - 1], b = m.pts[i] || a, s = (L - m.long[i - 1]) / ((m.long[i] - m.long[i - 1]) || 1);
    o.x = a[0] + (b[0] - a[0]) * s; o.y = a[1] + (b[1] - a[1]) * s;
    if (b !== a) dirige = Math.atan2(b[0] - a[0], b[1] - a[1]);
    if (k >= 1) o.marche = null;
  }
  const g = o.g, marche = !!o.marche && !DOUX.matches, oscille = marche ? Math.sin(2 * Math.PI * t / 0.5) : 0;
  if (dirige !== null) o.rot = dirige;
  else if (o.cote) o.rot = ORIENT[o.cote];
  g.rotation.y = o.rot;
  g.position.set(o.x + (o.secoue && !DOUX.matches ? (Math.floor(t / 0.0625) % 4 === 1 ? -1.4 : Math.floor(t / 0.0625) % 4 === 3 ? 1.4 : 0) : 0), 0.5, o.y);
  const bob = DOUX.matches ? 0 : o.anim === 'bob' ? (1 - Math.cos(2 * Math.PI * t / 0.45)) : o.anim === 'bob2' ? (1 - Math.cos(2 * Math.PI * (t - 0.2) / 0.45)) : marche ? Math.abs(oscille) * 1.4 : 0;
  g.buste.position.y = bob;
  g.buste.rotation.x = o.affale ? 1.05 : 0;
  g.jambes.forEach((j, k) => { if (j) j.rotation.x = oscille * (k ? 0.6 : -0.6); });
  g.bras.forEach((b, k) => { if (b) b.rotation.x = oscille * (k ? -0.5 : 0.5); });
  if (o.secoue && !DOUX.matches && hasard() < 0.1) etincelle(o.x, o.y, 40, '#ffe08a');
  if (o.affale && !DOUX.matches && hasard() < 0.03) bouffee(o.x, o.y, 34, '#ffffff', 1.4, 2.2, 8);
  if (o.bulle) {
    const [X, Y] = PLAN.iso(o.x, o.y, o.assis ? 42 : 46);
    o.bulle.style.transform = `translate(${Math.round(X - o.bulleL / 2)}px, ${Math.round(Y - 24 - bob)}px)`;
  }
}
let COURSE = [];
function course(liste) {
  for (const c of COURSE) scene.remove(c.g);
  COURSE = liste.map((p) => {
    const g = creerFigurine(p.figure), sauve = LOT;
    LOT = []; Cyl(0, 0, 0, 7, 2, '#2b2b2b', 8); Rod([0, 0, 2], [0, 0, 8], 0.8, '#555555'); B(-8, -8, 8, 16, 14, 3, '#3d3d3d', 0.03); B(-8, -9, 11, 16, 3, 14, '#3d3d3d', 0.03);
    const fauteuil = new THREE.Mesh(mergeGeometries(LOT), MAT_LOT); LOT = sauve; fauteuil.castShadow = true; g.add(fauteuil);
    scene.add(g);
    return { ...p, g };
  });
}

// ---------------------------------------------------------------- rue : véhicules, passants, oiseaux, nuages, passages ponctuels
function voitureDansLot(x, y, c) {  // profilée, le long de l'axe y du plan
  const geom = (pts, l) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), g = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false }); g.rotateY(Math.PI / 2); return g; };
  const pose = (g, couleur, dx, dz) => ajoute(g, couleur, { amp: 0.02, m: new THREE.Matrix4().makeTranslation(x + dx, dz + OZ, y + 56) });
  pose(geom([[0, 4], [2, 9], [13, 11], [18, 12], [50, 13], [56, 11], [56, 4]], 28), c, 0, 0);
  pose(geom([[16, 12], [24, 21], [44, 21], [52, 13]], 24), '#2c3e50', 2, 0.1);
  pose(geom([[17.5, 12.5], [25, 20.4], [43, 20.4], [50.5, 13]], 24.6), '#a9d8f5', 1.7, 0.15);
  pose(geom([[24, 21], [44, 21], [44, 22], [24, 22]], 22), c, 3, 0);
  for (const dy of [10, 44]) for (const dx of [-0.8, 26.2]) { const r = new THREE.CylinderGeometry(4.6, 4.6, 2.8, 12); r.rotateZ(Math.PI / 2); ajoute(r, '#1d1d20', { amp: 0.02, par: 6, m: T(x + dx + 1.2, y + dy, 4.6) }); const h = new THREE.CylinderGeometry(2.3, 2.3, 3, 8); h.rotateZ(Math.PI / 2); ajoute(h, '#c9ced4', { amp: 0.02, par: 6, m: T(x + dx + 1.2, y + dy, 4.6) }); }
  for (const dx of [3, 21]) { B(x + dx, y + 55.6, 7, 4, 0.8, 2.6, '#fff2c8', 0, null, null, LUEUR); B(x + dx, y - 0.4, 8, 4, 0.8, 2.4, '#d9352c', 0); }
  B(x + 1, y + 55.8, 3, 26, 1, 2, '#3d3d3d', 0.02);
}
const maillage = (remplir) => { const sauve = [LOT, LUEUR]; LOT = []; LUEUR = []; remplir(); const g = new THREE.Group(); fermer(g); [LOT, LUEUR] = sauve; return g; };
const modeleVoiture = (c) => maillage(() => voitureDansLot(-14, -28, c));
const roues = (ys, xs, r) => { for (const y of ys) for (const x of xs) { const g = new THREE.CylinderGeometry(r, r, 3, 12); g.rotateZ(Math.PI / 2); ajoute(g, '#1d1d20', { amp: 0.02, par: 6, m: T(x, y, r) }); } };
const modeleBus = () => maillage(() => { B(-12, -55, 2, 24, 110, 30, '#2e8b57', 0.02, '#3a9b67'); for (let k = 0; k < 6; k++) { B(12, -48 + k * 17, 14, 0.5, 14, 11, '#bfe6ff', 0); B(-12.5, -48 + k * 17, 14, 0.5, 14, 11, '#bfe6ff', 0); } roues([-34, 34], [-13, 13], 5.4); });
const modeleCamion = () => maillage(() => { B(-13, -38, 4, 26, 58, 32, '#f4f4f4', 0.02); B(-11, 22, 4, 22, 18, 22, '#2f8a3a', 0.02, '#2f8a3a'); B(-9, 30, 16, 18, 10.5, 9, '#bfe6ff', 0, '#2f8a3a'); B(-13.2, -30, 16, 0.4, 40, 10, '#2f8a3a', 0); B(13, -30, 16, 0.4, 40, 10, '#2f8a3a', 0); roues([-26, 26], [-13, 13], 5.4); });
const modeleOiseau = () => { const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x2b1d14, side: THREE.DoubleSide }), aile = () => new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 2.4), mat), [a, b] = [aile(), aile()]; a.position.x = -3.5; b.position.x = 3.5; g.add(a, b); return Object.assign(g, { ailes: [a, b] }); };
const modeleChat = () => maillage(() => { B(-3, -7, 3, 6, 14, 6, '#e8913a', 0.05); Sph(0, 8, 10, 3.6, '#e8913a', 0); Cone(-1.8, 9, 12, 1, 2.4, '#e8913a', 4); Cone(1.8, 9, 12, 1, 2.4, '#e8913a', 4); Rod([0, -7, 6], [0, -12, 13], 0.7, '#c9702a', 4); for (const [a, b] of [[-2, -5], [2, -5], [-2, 5], [2, 5]]) B(a - 0.8, b - 0.8, 0, 1.6, 1.6, 3.4, '#c9702a', 0); });
let RUE = [];
function ajouterRue(m, o) { scene.add(m); RUE.push({ m, t0: maintenant, ...o }); }
function creerRue() {
  for (const r of RUE) { scene.remove(r.m); liberer(r.m); }
  RUE = [];
  const V = VOIES;
  if (V) {
    const v = V.v;
    for (const [c, d] of [['#ffc94d', 1], ['#d9534f', 5]]) ajouterRue(modeleVoiture(c), { genre: 'auto', de: [V.x0, V.voie1], a: [V.x1, V.voie1], T: 12 * v, d: d * v });
    ajouterRue(modeleBus(), { genre: 'auto', de: [V.x0, V.voie1], a: [V.x1, V.voie1], T: 12 * v, d: 9 * v });
    for (const [c, d] of [['#4a8ad8', 3], ['#e8e8e8', 10]]) ajouterRue(modeleVoiture(c), { genre: 'auto', de: [V.x1, V.voie2], a: [V.x0, V.voie2], T: 14 * v, d: d * v });
    for (const [c, sens, T0, d, i] of [['#ef6f9a', 1, 38, 5, 1], ['#b08af0', -1, 44, 27, 2], ['#7be08a', 1, 52, 40, 3]]) {
      const g = creerFigurine({ couleur: c, cheveux: '#2b1d14', peau: PLAN.PEAUX[i], i, assis: false, pose: 'debout' });
      ajouterRue(g, { genre: 'pieton', de: sens > 0 ? [V.x0, V.trottoir] : [V.x1, V.trottoir], a: sens > 0 ? [V.x1, V.trottoir] : [V.x0, V.trottoir], T: T0 * v, d });
    }
    ajouterRue(modeleChat(), { genre: 'chat', de: ETAGE === 'garage' ? [120, 560] : [-120, DY + 420], a: ETAGE === 'garage' ? [360, 560] : [10, DY + 420], T: 26, d: 4 });
  }
  for (const [x, y, T0, d] of [[-200, DY + 200, 34, 6], [-260, DY + 230, 34, 7.5], [-150, DY + 520, 47, 30]]) ajouterRue(modeleOiseau(), { genre: 'oiseau', de: [x, y], a: [x + 1500, y], T: T0, d, z: 160 });
}
function passage(genre) {
  const V = VOIES; if (!V) return;
  const bat = ETAGE !== 'garage';
  if (genre === 'camion') ajouterRue(modeleCamion(), { genre: 'ponctuel', T: bat ? 14 : 9, etapes: [[0, V.x0, V.voie1], [0.4, V.arret, V.voie1], [0.62, V.arret, V.voie1], [1, V.x1, V.voie1]] });
  else {
    const xs = V.porte - (bat ? 260 : 220), g = creerFigurine({ couleur: genre === 'client' ? '#3a4a6a' : '#ffc94d', cheveux: '#2b1d14', peau: PLAN.PEAUX[genre === 'client' ? 3 : 1], i: genre === 'client' ? 0 : 3, assis: false, pose: 'debout' });
    const [a, b, c] = [[xs, V.trottoir], [V.porte, V.trottoir], [V.porte, V.seuil]];
    ajouterRue(g, { genre: 'ponctuel', pieton: true, T: genre === 'client' ? 7 : 8, etapes: genre === 'client' ? [[0, ...a], [0.5, ...b], [0.85, ...c], [1, ...c]] : [[0, ...a], [0.35, ...b], [0.48, ...c], [0.6, ...c], [0.73, ...b], [1, ...a]] });
  }
}
function animerMarche(g, t, marche) { const o = marche ? Math.sin(2 * Math.PI * t / 0.5) : 0; g.jambes.forEach((j, k) => { if (j) j.rotation.x = o * (k ? 0.6 : -0.6); }); g.bras.forEach((b, k) => { if (b) b.rotation.x = o * (k ? -0.5 : 0.5); }); g.buste.position.y = Math.abs(o) * 1.2; }
function animerRue(t) {
  RUE = RUE.filter((r) => {
    const e = (maintenant - r.t0) / 1000;
    if (r.genre === 'ponctuel') {
      const p = e / r.T;
      if (p >= 1) { scene.remove(r.m); liberer(r.m); return false; }
      const E = r.etapes, i = Math.max(1, E.findIndex((q) => q[0] >= p)), a = E[i - 1], b = E[i], s = (p - a[0]) / ((b[0] - a[0]) || 1), x = a[1] + (b[1] - a[1]) * s, y = a[2] + (b[2] - a[2]) * s;
      r.m.position.set(x, 0.3, y);
      if (b[1] !== a[1] || b[2] !== a[2]) r.m.rotation.y = Math.atan2(b[1] - a[1], b[2] - a[2]);
      if (r.pieton) animerMarche(r.m, t, b[1] !== a[1] || b[2] !== a[2]);
      return true;
    }
    const p = DOUX.matches ? 0 : (((e + r.d) / r.T) % 1 + 1) % 1, x = r.de[0] + (r.a[0] - r.de[0]) * p, y = r.de[1] + (r.a[1] - r.de[1]) * p;
    r.m.position.set(x, (r.z || 0) + 0.3, y);
    r.m.rotation.y = Math.atan2(r.a[0] - r.de[0], r.a[1] - r.de[1]);
    if (r.genre === 'pieton') animerMarche(r.m, t, true);
    if (r.genre === 'oiseau') { const v = Math.sin(t * 16) * 0.7; r.m.ailes[0].rotation.z = -v; r.m.ailes[1].rotation.z = v; }
    return true;
  });
}

// ---------------------------------------------------------------- particules : fumée, confettis, nuages, étincelles, météo
const MAX_P = 1400;
let particules, PARTS = [];
const mt = new THREE.Matrix4(), qt = new THREE.Quaternion(), vs = new THREE.Vector3(), vp = new THREE.Vector3(), eu = new THREE.Euler(), ct = new THREE.Color();
function bouffee(x, y, z, c, s, vie, vz = 12, dx = 0, dy = 0, g = 0, platte = false) { if (PARTS.length < MAX_P) PARTS.push({ x, y, z, c: new THREE.Color(c), s, vie, age: 0, vx: dx, vy: dy, vz, g, platte, a: hasard() * 6 }); }
const etincelle = (x, y, z, c = '#ffe08a') => bouffee(x, y, z, c, 0.8, 0.45, 26, (hasard() - 0.5) * 34, (hasard() - 0.5) * 34, 90);
function nuage(x, y) { if (DOUX.matches) return; for (let k = 0; k < 18; k++) { const a = hasard() * 6.28; bouffee(x, y, 6 + hasard() * 18, '#f4f7fa', 5 + hasard() * 5, 0.9 + hasard() * 0.6, 8, Math.cos(a) * 26, Math.sin(a) * 26); } }
function animerParticules(dt) {
  PARTS = PARTS.filter((p) => (p.age += dt) < p.vie);
  let n = 0;
  for (const p of PARTS) {
    p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0.6, p.z + p.vz * dt);
    const k = p.age / p.vie, s = p.platte ? p.s : p.s * (0.6 + 0.8 * k) * (1 - k * k * 0.7);
    eu.set(p.a + p.age * 3, p.a * 2 + p.age * 4, 0); qt.setFromEuler(eu); vp.set(p.x, p.z, p.y); vs.set(s, p.platte ? s * 0.25 : s, s);
    particules.setMatrixAt(n, mt.compose(vp, qt, vs)); particules.setColorAt(n, p.c); n++;
  }
  particules.count = n; particules.instanceMatrix.needsUpdate = true; if (particules.instanceColor) particules.instanceColor.needsUpdate = true;
}
const CONF = ['#ffc94d', '#ef6f9a', '#7cc0f2', '#7be08a', '#b08af0', '#ff9a4a'];
let GESTES = new Map(), EN_COURS = new Map(), gestes;
function effets(voulus) {
  for (const [k, v] of voulus) if ((v[0] === 'fumee' || v[0] === 'confettis') && !EN_COURS.has(k)) EN_COURS.set(k, { type: v[0], x: v[1], y: v[2] });
  for (const [k, e] of EN_COURS) { const v = voulus.get(k); if (!v) EN_COURS.delete(k); else { e.x = v[1]; e.y = v[2]; } }
  for (const [id, m] of ECRANS) m.visible = voulus.has('p' + id);
  GESTES = new Map([...voulus].filter(([, [t]]) => t !== 'fumee' && t !== 'confettis' && t !== 'code'));
}
function animerEffets(t, dt) {
  if (DOUX.matches) { gestes.count = 0; return; }
  for (const e of EN_COURS.values()) {
    if (e.type === 'fumee' && hasard() < dt * 26) bouffee(e.x + (hasard() - 0.5) * 60, e.y + (hasard() - 0.5) * 60, 8 + hasard() * 12, pioche(['#6a6a70', '#55555b', '#8a8a90']), 9 + hasard() * 8, 2 + hasard() * 1.4, 22);
    if (e.type === 'confettis' && hasard() < dt * 60) bouffee(e.x + (hasard() - 0.5) * 90, e.y + (hasard() - 0.5) * 90, 80, pioche(CONF), 2.2, 2.2, -6, (hasard() - 0.5) * 18, (hasard() - 0.5) * 18, 18, true);
  }
  let n = 0;
  const pose = (x, y, z, s, c) => { if (n >= 300) return; vp.set(x, z, y); vs.set(s, s, s); qt.identity(); gestes.setMatrixAt(n, mt.compose(vp, qt, vs)); gestes.setColorAt(n, ct.set(c)); n++; };
  for (const [type, x, y, z] of GESTES.values()) {
    if (type === 'etincelles' || type === 'copeaux') { if (hasard() < dt * 14) etincelle(x, y, z, type === 'etincelles' ? '#ffe08a' : '#cfc8b8'); }
    else if (type === 'tete') pose(x + 5 * Math.sin(Math.PI * t / 0.9), y, z - 4, 2.2, '#9aa1a8');
    else if (type === 'onde') for (let i = 0; i < 8; i++) pose(x - 7 + i * 2, y + 7, z - 8 + 2.5 * Math.sin(i * 0.9 - t * 9), 0.7, '#7be08a');
    else if (type === 'four') for (let i = 0; i < 3; i++) pose(x - 10 + i * 10, y + 2, z - 12, 2.6 + 1.2 * Math.sin(t * 4 + i), '#ff8c28');
  }
  gestes.count = n; gestes.instanceMatrix.needsUpdate = true; if (gestes.instanceColor) gestes.instanceColor.needsUpdate = true;
}
// Météo : gouttes, flocons, feuilles, pétales autour de ce qu'on regarde
let gouttes, flocons, AMB = {};
const N_G = 700, N_F = 360, BASE = Array.from({ length: Math.max(N_G, N_F) }, () => [Math.random(), Math.random(), Math.random(), Math.random() * 6]);
const COUL_F = { neige: ['#ffffff'], feuilles: ['#d9822b', '#b8562a', '#e0a23a'], petales: ['#ffd3e8', '#ffb3d1', '#ffffff'] };
function animerMeteo(t) {
  const m = AMB.meteo, pluie = (m === 'pluie' || m === 'orage') && !DOUX.matches, genre = DOUX.matches ? null : m === 'neige' ? 'neige' : AMB.dehors && AMB.saison === 'automne' ? 'feuilles' : AMB.dehors && AMB.saison === 'printemps' ? 'petales' : null;
  const [cx, cy] = centreVue(), R = 700;
  gouttes.visible = pluie; flocons.visible = !!genre;
  if (pluie) {
    for (let i = 0; i < N_G; i++) { const b = BASE[i], z = 230 - ((b[2] * 230 + t * 420) % 230); vp.set(cx + (b[0] - 0.5) * 2 * R, z, cy + (b[1] - 0.5) * 2 * R); qt.identity(); vs.set(1, 1, 1); gouttes.setMatrixAt(i, mt.compose(vp, qt, vs)); }
    gouttes.instanceMatrix.needsUpdate = true;
  }
  if (genre) {
    const v = genre === 'neige' ? 42 : 30, cols = COUL_F[genre];
    for (let i = 0; i < N_F; i++) {
      const b = BASE[i], z = 200 - ((b[2] * 200 + t * v) % 200), ox = Math.sin(t * 0.9 + b[3]) * 12;
      vp.set(cx + (b[0] - 0.5) * 2 * R + ox, z, cy + (b[1] - 0.5) * 2 * R); eu.set(t * 1.3 + b[3], t * 0.8, 0); qt.setFromEuler(eu); vs.set(1, genre === 'neige' ? 1 : 0.35, 1);
      flocons.setMatrixAt(i, mt.compose(vp, qt, vs)); flocons.setColorAt(i, ct.set(cols[i % cols.length]));
    }
    flocons.instanceMatrix.needsUpdate = true; if (flocons.instanceColor) flocons.instanceColor.needsUpdate = true;
  }
}
const LUMIERES = {  // soleil [couleur, intensité], ciel [couleur, sol, intensité]
  '': [0xffedc9, 2.8, 0xe6f4ff, 0x8a8f70, 1.45], matin: [0xffd2a6, 2.2, 0xffe6d6, 0x8a8f70, 1.3], soir: [0xffa36b, 1.7, 0xffc9a8, 0x6a6458, 1.05], nuit: [0x8ea2d8, 0.55, 0x46569a, 0x2a2c44, 0.8] };
function ambiance(a) {
  const [sc, si, cc, cs, ci] = LUMIERES[a.soir] || LUMIERES[''], couvert = ['pluie', 'orage', 'neige', 'brouillard'].includes(a.meteo) ? 0.62 : 1;
  soleil.color.setHex(sc); soleil.intensity = si * couvert; appoint.intensity = a.soir === 'nuit' ? 0.12 : 0.35;
  ciel.color.setHex(cc); ciel.groundColor.setHex(cs); ciel.intensity = ci * (couvert < 1 ? 0.92 : 1);
  voile.uniforms.voile.value.setRGB(...(a.meteo === 'brouillard' ? [0.94, 0.96, 0.965] : a.meteo === 'canicule' ? [1, 0.67, 0.24] : [1, 1, 1]));
  voile.uniforms.force.value = a.meteo === 'brouillard' ? 0.26 : a.meteo === 'canicule' ? 0.1 : 0;
  scene.background.setHex(a.soir === 'nuit' ? 0x1a2240 : a.soir === 'soir' ? 0xf0b080 : 0x8fc9e8);
  AMB = a;
}

// ---------------------------------------------------------------- caméra : la zone visible de #cadre, en coordonnées du plan
function zoneVue() {
  const z = echelle.offsetWidth / W || 1, l = (cadre.scrollLeft - echelle.offsetLeft) / z, t = (cadre.scrollTop - echelle.offsetTop) / z;
  return { l, t, w: cadre.clientWidth / z, h: cadre.clientHeight / z };
}
function centreVue() { const v = zoneVue(); return PLAN.versMonde(v.l + v.w / 2, v.t + v.h / 2); }
let LARG = 0, HAUT = 0;
function cadrer() {
  const cw = cadre.clientWidth, ch = cadre.clientHeight;
  if (cw !== LARG || ch !== HAUT) { LARG = cw; HAUT = ch; rendu.setSize(cw, ch, false); compo.setSize(cw, ch); }
  const v = zoneVue();
  camera.left = (v.l - W / 2) / ECHELLE; camera.right = (v.l + v.w - W / 2) / ECHELLE;
  camera.top = (H / 2 - v.t) / ECHELLE; camera.bottom = (H / 2 - v.t - v.h) / ECHELLE;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- boucle
let dernier = performance.now(), ombreAvant = 0;
function tic() {
  requestAnimationFrame(tic);
  if (document.hidden) { dernier = performance.now(); return; }
  maintenant = performance.now();
  const dt = Math.min((maintenant - dernier) / 1000, 0.05), t = maintenant / 1000;
  dernier = maintenant;
  cadrer();
  for (const o of PERSOS.values()) animerPerso(o, t);
  for (const c of COURSE) {  // aller-retour dans le couloir
    const q = DOUX.matches ? 0 : (1 - Math.cos(Math.PI * ((t / c.t) % 2))) / 2, u = (t / c.t) % 2 < 1 ? 1 : -1;
    c.g.position.set(c.x1 + (c.x2 - c.x1) * q, 0.5, c.y1 + (c.y2 - c.y1) * q);
    c.g.rotation.y = Math.atan2((c.x2 - c.x1) * u, (c.y2 - c.y1) * u);
  }
  animerRue(t);
  animerEffets(t, dt);
  animerParticules(dt);
  animerMeteo(t);
  if (CODE) CODE.offset.y = Math.floor(t * 8) / 24;
  if (maintenant - ombreAvant > 110) { soleil.shadow.needsUpdate = true; ombreAvant = maintenant; }  // les ombres suivent les gens, un peu moins souvent que l'image
  rendu.toneMappingExposure = AMB.meteo === 'orage' && !DOUX.matches && t % 6 > 5.82 ? 2.2 : 1.02;  // éclair
  compo.render();
}

async function init(zone, elCadre, elEchelle, elBulles) {
  cadre = elCadre; echelle = elEchelle; calqueBulles = elBulles;
  rendu = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  rendu.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap;
  rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.02;
  rendu.domElement.className = 'rendu';
  zone.prepend(rendu.domElement);
  camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 100, 14000);
  scene.background = new THREE.Color(0x8fc9e8);
  ciel = new THREE.HemisphereLight(0xe6f4ff, 0x8a8f70, 1.45);
  soleil = new THREE.DirectionalLight(0xffedc9, 2.8);
  soleil.castShadow = true; soleil.shadow.mapSize.set(4096, 4096);
  Object.assign(soleil.shadow.camera, { left: -1250, right: 1250, top: 1250, bottom: -1250, near: 10, far: 3400 });
  soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.7; soleil.shadow.autoUpdate = false;
  appoint = new THREE.DirectionalLight(0xbfdcff, 0.35); appoint.position.set(600, 300, 400);
  scene.add(ciel, soleil, soleil.target, appoint);
  particules = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), MAX_P); particules.count = 0; particules.frustumCulled = false; particules.setColorAt(0, ct.set('#ffffff'));
  gestes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 300); gestes.count = 0; gestes.frustumCulled = false; gestes.setColorAt(0, ct.set('#ffffff'));
  gouttes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 11, 0.5), new THREE.MeshBasicMaterial({ color: 0xa8c8e8, transparent: true, opacity: 0.6 }), N_G); gouttes.frustumCulled = false; gouttes.visible = false;
  flocons = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), N_F); flocons.frustumCulled = false; flocons.visible = false; flocons.setColorAt(0, ct.set('#ffffff'));
  scene.add(particules, gestes, gouttes, flocons);
  compo = new EffectComposer(rendu);
  compo.addPass(new RenderPass(scene, camera));
  ao = new GTAOPass(scene, camera, 256, 256);
  ao.updateGtaoMaterial({ radius: 16, distanceExponent: 1.4, thickness: 5, scale: 1.3 }); ao.blendIntensity = 1;
  compo.addPass(ao);
  compo.addPass(new OutputPass());
  voile = new ShaderPass({ uniforms: { tDiffuse: { value: null }, voile: { value: new THREE.Color(1, 1, 1) }, force: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec3 voile; uniform float force;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
        float g = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(g), c, 1.22); c = (c - 0.5) * 1.07 + 0.5;
        c = mix(c, voile, force);
        float v = 1.0 - 0.22 * smoothstep(0.45, 0.98, distance(vUv, vec2(0.5))); gl_FragColor = vec4(c * v, 1.0); }` });
  compo.addPass(voile);
  requestAnimationFrame(tic);
}

// Tant que three.js n'est pas prêt (ou sans WebGL), les appels de jeu.js ne font rien
let pret = false;
const garde = (f) => (...a) => (pret ? f(...a) : undefined);
window.RENDU = { init: async (...a) => { await init(...a); pret = true; },
  ...Object.fromEntries(Object.entries({ decor, zones, elements, persos, position, course, passage, effets, ambiance }).map(([k, f]) => [k, garde(f)])) };
window.dispatchEvent(new Event('rendu-pret'));
