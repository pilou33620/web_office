// Circuit Story — dessin du plan en vue isométrique (façon Game Dev Story), à partir des coordonnées du moteur (vue de dessus).
// Trois calques : fond (sol, murs du fond, mobilier fixe), objets (triés par profondeur), devant (façade basse, extérieur).
// Pas de filtre de flou (trop lourd sur Raspberry Pi) : ombres translucides et dégradés à la place.
'use strict';

const PLAN = (() => {
  const C = Math.cos(Math.PI / 6), S = 0.5, OX = 790, OY = 80, W = 1960, H = 1220;
  // Étage affiché du bâtiment : chaque étage occupe sa bande du monde (y0), ramenée au même endroit de l'écran
  let ETAGE = 'rdc', DY = 0;
  const T = '#2b1d14';
  // Capture : pendant PLAN.capture, chaque volume dessiné est aussi noté en 3D pour le rendu (rendu.js)
  const CAPT = { liste: null, dedans: 0, dern: null };
  const note = (x) => { if (CAPT.liste && !CAPT.dedans) CAPT.liste.push(x); };
  const sans = (f) => { CAPT.dedans++; try { return f(); } finally { CAPT.dedans--; } };
  const n1 = (v) => Math.round(v * 10) / 10;
  const iso = (x, y, z = 0) => [OX + (x - y + DY) * C, OY + (x + y - DY) * S - z];
  const versMonde = (X, Y) => { const a = (X - OX) / C, b = (Y - OY) / S; return [(b + a) / 2, (b - a) / 2 + DY]; };
  const pts = (...p) => { CAPT.dern = p; return p.map((q) => iso(...q).map(n1).join(',')).join(' '); };
  const poly = (points, f, sw = 1.2) => { if (CAPT.liste && !CAPT.dedans && CAPT.dern) CAPT.liste.push({ t: 'poly', p: CAPT.dern, c: f }); CAPT.dern = null; return `<polygon points="${points}" fill="${f}"${sw ? ` stroke="${T}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nuance = (c, k) => {
    if (!c.startsWith('#')) return c;
    let h = c.slice(1);
    if (h.length === 3) h = [...h].map((ch) => ch + ch).join('');
    return '#' + [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
  };
  // Pavé : face avant (+y, à gauche à l'écran), face droite (+x), dessus
  const boite0 = (x, y, w, dp, h, c, z = 0, haut = null, face = null, sw = 1.2) =>
    poly(pts([x, y + dp, z], [x + w, y + dp, z], [x + w, y + dp, z + h], [x, y + dp, z + h]), face || nuance(c, 0.82), sw)
    + poly(pts([x + w, y, z], [x + w, y + dp, z], [x + w, y + dp, z + h], [x + w, y, z + h]), nuance(c, 0.64), sw)
    + poly(pts([x, y, z + h], [x + w, y, z + h], [x + w, y + dp, z + h], [x, y + dp, z + h]), haut || nuance(c, 1.08), sw);
  const faceAvant = (x, y, dp, z0, u0, u1, v0, v1, f, sw = 0.8) => poly(pts([x + u0, y + dp + 0.3, z0 + v0], [x + u1, y + dp + 0.3, z0 + v0], [x + u1, y + dp + 0.3, z0 + v1], [x + u0, y + dp + 0.3, z0 + v1]), f, sw);
  const faceDroite = (x, y, w, z0, u0, u1, v0, v1, f, sw = 0.8) => poly(pts([x + w + 0.3, y + u0, z0 + v0], [x + w + 0.3, y + u1, z0 + v0], [x + w + 0.3, y + u1, z0 + v1], [x + w + 0.3, y + u0, z0 + v1]), f, sw);
  const dessus = (x, y, z, u0, u1, v0, v1, f, sw = 0.8) => poly(pts([x + u0, y + v0, z], [x + u1, y + v0, z], [x + u1, y + v1, z], [x + u0, y + v1, z]), f, sw);
  const bouton0 = (x, y, z, r, f) => { const [X, Y] = iso(x, y, z); return `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${r}" fill="${f}" stroke="${T}" stroke-width=".7"/>`; };
  const cable0 = (a, b, c = '#3d3d3d', w = 1.3, creux = 6) => { const [x1, y1] = iso(...a), [x2, y2] = iso(...b); return `<path d="M${n1(x1)} ${n1(y1)} Q${n1((x1 + x2) / 2)} ${n1(Math.max(y1, y2) + creux)} ${n1(x2)} ${n1(y2)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`; };
  const reflet = (x, y, w, dp, z) => poly(pts([x, y, z], [x + w, y, z], [x + w, y + dp, z], [x, y + dp, z]), 'url(#i-reflet)', 0);
  const ombre = (x, y, w, dp, d = 4) => poly(pts([x + d, y + d, 0], [x + w + d, y + d, 0], [x + w + d, y + dp + d, 0], [x + d, y + dp + d, 0]), 'rgba(20,14,8,.2)', 0);
  const boule0 = (x, y, z, r, c) => { const [X, Y] = iso(x, y, z), [, Ys] = iso(x, y, 0); return `<ellipse cx="${n1(X + 3)}" cy="${n1(Ys + 2)}" rx="${n1(r * 1.1)}" ry="${n1(r * 0.55)}" fill="rgba(20,14,8,.18)"/><circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(r)}" fill="${c}" stroke="${T}" stroke-width="1.4"/><circle cx="${n1(X - r * 0.3)}" cy="${n1(Y - r * 0.3)}" r="${n1(r * 0.4)}" fill="rgba(255,255,255,.25)"/>`; };
  const txtIso = (x, y, z, texte, taille, f, police = 'monospace') => { const [X, Y] = iso(x, y, z); return `<text x="${n1(X)}" y="${n1(Y)}" text-anchor="middle" font-family="${police}" font-weight="800" font-size="${taille}" fill="${f}">${texte}</text>`; };
  const boiteBois = (x, y, w, dp, h, z = 0, c = '#c48a52') => {
    let s = boite(x, y, w, dp, h, c, z, 'url(#i-bois)');
    for (let k = 1; k < 3; k++) { const [a, b] = iso(x + 3, y + dp * k / 3, z + h), [c2, d] = iso(x + w - 3, y + dp * k / 3, z + h); s += `<line x1="${n1(a)}" y1="${n1(b)}" x2="${n1(c2)}" y2="${n1(d)}" stroke="#a8703f" stroke-width=".6" opacity=".7"/>`; }
    return s;
  };
  const boiteMetal = (x, y, w, dp, h, c, z = 0, face = null) => boite(x, y, w, dp, h, c, z, null, face) + reflet(x, y, w, dp, z + h);
  const etiquette = (x, y, texte) => { const [X, Y] = iso(x, y, 0), l = 6.4 * texte.length + 16; return `<rect x="${n1(X - l / 2)}" y="${n1(Y - 9)}" width="${n1(l)}" height="17" rx="8.5" fill="rgba(27,33,26,.82)"/><text x="${n1(X)}" y="${n1(Y + 3)}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="10.5" fill="#f6f4ea">${esc(texte)}</text>`; };
  const bulle = (x, y, z, texte, c = '#fff7e6') => { const [X, Y] = iso(x, y, z), l = 6.2 * texte.length + 12; return `<rect x="${n1(X - l / 2)}" y="${n1(Y - 14)}" width="${n1(l)}" height="16" rx="8" fill="${c}" stroke="${T}" stroke-width="1.5"/><text x="${n1(X)}" y="${n1(Y - 2.5)}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="10" fill="${T}">${esc(texte)}</text>`; };
  const boite = (x, y, w, dp, h, c, z = 0, haut = null, face = null, sw) => { note({ t: 'boite', x, y, w, dp, h, c, z, haut, face }); return sans(() => boite0(x, y, w, dp, h, c, z, haut, face, sw)); };
  const boule = (x, y, z, r, c) => { note({ t: 'boule', x, y, z, r, c }); return sans(() => boule0(x, y, z, r, c)); };
  const bouton = (x, y, z, r, f) => { note({ t: 'bouton', x, y, z, r, c: f }); return sans(() => bouton0(x, y, z, r, f)); };
  const cable = (a, b, c = '#3d3d3d', w = 1.3, creux = 6) => { note({ t: 'cable', a, b, c, w, creux }); return sans(() => cable0(a, b, c, w, creux)); };
  const empreinte = (x, y, w, dp, z = 0) => pts([x, y, z], [x + w, y, z], [x + w, y + dp, z], [x, y + dp, z]);

  const DEFS = `<defs>
<pattern id="i-herbe" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#7cc46a"/><circle cx="5" cy="6" r="1.6" fill="#68b357"/><circle cx="16" cy="15" r="1.6" fill="#68b357"/><path d="M11 3 l1 -3 l1 3" stroke="#5aa04a" stroke-width="1" fill="none"/></pattern>
<pattern id="i-parquet" width="40" height="12" patternUnits="userSpaceOnUse"><rect width="40" height="12" fill="#e6b980"/><rect width="40" height="1.5" fill="#cf9f63"/><rect x="18" width="1.5" height="12" fill="#cf9f63"/></pattern>
<pattern id="i-carrelage" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#ece6da"/><rect width="20" height="1.2" fill="#d4ccbc"/><rect width="1.2" height="20" fill="#d4ccbc"/></pattern>
<pattern id="i-chaud" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#f3c9a8"/><rect width="11" height="11" fill="#e8b48e"/><rect x="11" y="11" width="11" height="11" fill="#e8b48e"/></pattern>
<pattern id="i-moquette" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#cdb894"/><circle cx="5" cy="5" r="1" fill="#bba67f"/></pattern>
<pattern id="i-bleue" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#a9c7e8"/><circle cx="5" cy="5" r="1.1" fill="#93b5db"/></pattern>
<pattern id="i-lino" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#e9eef2"/><rect width="30" height="1.2" fill="#d4dde4"/><rect width="1.2" height="30" fill="#d4dde4"/></pattern>
<pattern id="i-vert" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#d3ebe2"/><rect width="24" height="1.2" fill="#b8d8cc"/><rect width="1.2" height="24" fill="#b8d8cc"/></pattern>
<pattern id="i-beton" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#d6d3cc"/><circle cx="6" cy="8" r="1.2" fill="#c2beb5"/><circle cx="18" cy="19" r="1.5" fill="#c2beb5"/></pattern>
<pattern id="i-couloir" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#efe6d2"/><rect width="40" height="1" fill="#e0d5bd"/><rect width="1" height="40" fill="#e0d5bd"/></pattern>
<pattern id="i-pave" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#cfc8b8"/><rect width="16" height="1" fill="#bdb5a3"/><rect x="8" width="1" height="16" fill="#bdb5a3"/></pattern>

<pattern id="i-pyramides" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#2f3a46"/><path d="M0 0 L5 5 L10 0 M0 10 L5 5 L10 10" stroke="#46566a" stroke-width="1.5" fill="none"/></pattern>
<pattern id="i-jaune" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#ffe08a"/><circle cx="6" cy="6" r="1.4" fill="#f2c95c"/></pattern>
<pattern id="i-violet" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#c3b0ea"/><circle cx="5" cy="5" r="1.1" fill="#ab95dc"/></pattern>
<pattern id="i-marches" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#d7dde3"/><rect width="16" height="3" fill="#aeb8c2"/></pattern>
<linearGradient id="i-bois" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2b277"/><stop offset=".6" stop-color="#cf9a5e"/><stop offset="1" stop-color="#b8814a"/></linearGradient>
<linearGradient id="i-ecran" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#3b78b8"/></linearGradient>
<radialGradient id="i-reflet" cx=".3" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<radialGradient id="i-halo"><stop offset="0" stop-color="#fff2c0" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c0" stop-opacity="0"/></radialGradient>
<radialGradient id="i-soir"><stop offset="0" stop-color="#ffd68c" stop-opacity=".6"/><stop offset="1" stop-color="#ffd68c" stop-opacity=".15"/></radialGradient>
<linearGradient id="i-soleil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8" stop-opacity=".6"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
<linearGradient id="i-soleil-d" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff4c8" stop-opacity=".55"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
</defs>`;
  // Sol : le plan de dessus projeté par une matrice (motifs de sol réutilisés tels quels)
  const sol = (contenu) => `<g transform="matrix(${n1(C * 1e4) / 1e4},${S},${-n1(C * 1e4) / 1e4},${S},${OX},${OY})"><g transform="translate(0 ${-DY})">${contenu}</g></g>`;

  // ---------------------------------------------------------------- personnages
  const PEAUX = ['#f6cfa6', '#eab994', '#c98e5e', '#a86b45', '#f8d8b8', '#7a4a2e'];
  // Personnage en volume posé en (x, y, z) ; pose : debout, marche, telephone, portable ; assis : sur une chaise
  const personne0 = (x, y, z, haut, cheveux, peau, assis = false, i = 0, pose = 'debout') => {
    let s = '';
    if (!assis) {
      s += ombre(x - 5, y - 4, 10, 8, 1);
      const [a, b] = pose === 'marche' ? [[x - 4, y - 4], [x + 1, y + 1]] : [[x - 3, y - 2], [x + 1, y - 2]];
      s += boite(a[0], a[1], 3, 4, 10, '#3a4a6a', z) + boite(b[0], b[1], 3, 4, 10, '#3a4a6a', z) + boite(a[0], a[1], 3, 5, 1.5, T, z) + boite(b[0], b[1], 3, 5, 1.5, T, z);
    }
    const zc = z + (assis ? 6 : 10), hc = assis ? 10 : 13;
    s += boite(x - 5, y - 3, 10, 7, hc, haut, zc - (assis ? 4 : 0));
    s += boite(x - 7, y - 1, 2, 3, 8, haut, zc + (assis ? 0 : 3)) + boite(x + 5, y - 1, 2, 3, 8, haut, zc + (assis ? 0 : 3));
    const [X, Y] = iso(x, y, zc + hc + 6 - (assis ? 4 : 0));
    if (pose === 'telephone') { const [Xm, Ym] = iso(x + 6, y, zc + hc + 4); s += `<rect x="${n1(Xm - 1)}" y="${n1(Ym - 5)}" width="3" height="6" rx="1" fill="#3d3d3d"/>`; }
    if (pose === 'portable') s += boite(x - 6, y + 3, 12, 8, 1.5, '#5d6773', zc + 4) + boite(x - 6, y + 3, 12, 1.5, 7, '#36404b', zc + 5.5, null, 'url(#i-ecran)');
    s += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="6" fill="${peau}" stroke="${T}" stroke-width="1.3"/>`;
    const st = i % 4;
    if (st === 0) s += `<path d="M${n1(X - 6)} ${n1(Y - 1)} a6 6 0 0 1 12 0 q-6 -3 -12 0z" fill="${cheveux}"/>`;
    else if (st === 1) s += `<path d="M${n1(X - 6.5)} ${n1(Y + 4)} q0 -12 6.5 -11 q6.5 -1 6.5 11 l-2 0 q0 -6 -4.5 -7 q-4.5 1 -4.5 7z" fill="${cheveux}"/>`;
    else if (st === 2) s += `<path d="M${n1(X - 6)} ${n1(Y - 1)} a6 6 0 0 1 12 0 q-6 -3 -12 0z" fill="${cheveux}"/><circle cx="${n1(X)}" cy="${n1(Y - 7)}" r="2.8" fill="${cheveux}"/>`;
    else s += `<path d="M${n1(X - 6.3)} ${n1(Y - 0.5)} a6.3 6.3 0 0 1 12.6 0z" fill="${haut}" stroke="${T}" stroke-width=".8"/><rect x="${n1(X - 1)}" y="${n1(Y - 1.5)}" width="8" height="2" rx="1" fill="${haut}"/>`;
    return s + `<circle cx="${n1(X + 2)}" cy="${n1(Y + 1)}" r=".9" fill="${T}"/><circle cx="${n1(X - 2)}" cy="${n1(Y + 1)}" r=".9" fill="${T}"/>`;
  };
  const personne = (x, y, z, haut, cheveux, peau, assis = false, i = 0, pose = 'debout') => { note({ t: 'perso', x, y, z, haut, cheveux, peau, assis, i, pose }); return sans(() => personne0(x, y, z, haut, cheveux, peau, assis, i, pose)); };
  // Figure seule (calque des personnages) : SVG de 36x56, les pieds en (18, 50)
  const figure = (haut, cheveux, peau, i, assis = false, pose = 'debout') => {
    const [X0, Y0] = iso(0, 0, 0);
    return `<svg viewBox="-18 -50 36 56" width="36" height="56" aria-hidden="true"><g transform="translate(${n1(-X0)},${n1(-Y0)})">${personne(0, 0, assis ? 4 : 0, haut, cheveux, peau, assis, i, pose)}</g></svg>`;
  };

  // ---------------------------------------------------------------- appareils à taille réelle, dessinés au centre de leur emplacement
  const REEL = { multi: [7, 11, 4], station: [12, 12, 7], alim: [14, 12, 9], micro: [12, 12, 22], oscillo: [18, 12, 12], sonde: [10, 8, 3], four: [44, 26, 15],
    spectre: [24, 18, 11], fdm: [24, 24, 26], resine: [16, 16, 24], cao: [66, 28, 18], cnc: [66, 46, 40], stlink: [6, 4, 2], logique: [9, 6, 2], jlink: [7, 5, 2],
    ci: [10, 20, 26], banc: [60, 18, 16], esd: [12, 12, 20], chambre: [96, 96, 54], pickplace: [46, 84, 34], rayonx: [44, 60, 42], aoi: [42, 44, 30] };
  const appareil = (t, x, y, w, dp, h, z) => {
    let s = z === 0 ? ombre(x, y, w, dp, 2) : '';
    switch (t) {
      case 'multi':
        s += boite(x, y, w, dp, h, '#ffc94d', z) + dessus(x, y, z + h, 1, w - 1, 1, 5, '#c8e6b0') + bouton(x + w / 2, y + 8, z + h, 1.6, '#3d3d3d');
        s += cable([x + 2, y + dp, z + 1], [x - 6, y + dp + 6, z], '#d9534f', 1) + cable([x + 5, y + dp, z + 1], [x - 3, y + dp + 8, z], '#3d3d3d', 1); break;
      case 'station':
        s += boite(x, y, w, dp, h, '#3d3d3d', z) + faceAvant(x, y, dp, z, 2, 8, 2, 5, '#ff6b5a') + bouton(x + w - 3, y + dp, z + 3, 1.2, '#ffc94d');
        s += boite(x + w + 2, y + 2, 3, 3, 9, '#9aa1a8', z) + cable([x + w, y + 4, z + 4], [x + w + 3, y + 3, z + 9], '#3d3d3d', 1, 2); break;
      case 'alim':
        s += boiteMetal(x, y, w, dp, h, '#4a4a4a', z) + faceAvant(x, y, dp, z, 2, 9, 4, 8, '#1a1a1a') + txtIso(x + 5.5, y + dp, z + 5.2, '12.0', 3.6, '#7be08a');
        s += bouton(x + 11, y + dp, z + 6, 1.2, '#9aa1a8') + bouton(x + 4, y + dp, z + 2, 1, '#d9534f') + bouton(x + 8, y + dp, z + 2, 1, '#3d3d3d'); break;
      case 'micro':
        s += boite(x, y, w, dp, 2, '#d8dde3', z) + boite(x + w / 2 - 1.5, y + 2, 3, 3, h - 4, '#9aa1a8', z + 2) + boite(x + 2, y + 1, w - 4, 6, 4, '#3a4a5e', z + h - 6) + bouton(x + w / 2, y + dp - 3, z + 2, 2.4, '#2e8b57'); break;
      case 'oscillo': {
        s += boiteMetal(x, y, w, dp, h, '#e8e8e0', z) + faceAvant(x, y, dp, z, 2, 11, 3, 10, '#1f4a6e');
        const [X1, Y1] = iso(x + 3, y + dp, z + 6.5);
        s += `<path d="M${n1(X1)} ${n1(Y1)} q2 -3 3.5 0 t3.5 0" fill="none" stroke="#7be08a" stroke-width="1"/>`;
        ['#ffc94d', '#8fe0ff', '#ef6f9a', '#7be08a'].forEach((c, k) => { s += bouton(x + 13 + (k % 2) * 3, y + dp, z + 4 + Math.floor(k / 2) * 4, 1, c); });
        s += cable([x + 13, y + dp, z + 4], [x + 18, y + dp + 10, z], '#ffc94d', 0.9) + cable([x + 16, y + dp, z + 4], [x + 22, y + dp + 8, z], '#8fe0ff', 0.9); break;
      }
      case 'sonde': s += boite(x, y, w, dp, h, '#b08af0', z) + bouton(x + 3, y + 4, z + h, 1.8, 'none') + bouton(x + 7, y + 4, z + h, 1.3, 'none'); break;
      case 'four':
        s += boiteMetal(x, y, w, dp, h, '#b9c0c7', z) + faceAvant(x, y, dp, z, 4, w - 12, 4, 11, '#ff9a4a') + faceAvant(x, y, dp, z, w - 9, w - 3, 5, 10, '#1a1a1a');
        for (let k = 0; k < 3; k++) s += dessus(x, y, z + h, 6 + k * 12, 14 + k * 12, 8, 16, '#2e8b57');
        break;
      case 'spectre': {
        s += boiteMetal(x, y, w, dp, h, '#dfe3e8', z) + faceAvant(x, y, dp, z, 2, 14, 3, 9, '#215a3a');
        const [X1, Y1] = iso(x + 4, y + dp, z + 5);
        s += `<path d="M${n1(X1)} ${n1(Y1)} l3 -1 l1 -3 l1 3 l4 -1" fill="none" stroke="#ffe08a" stroke-width=".9"/>` + bouton(x + 18, y + dp, z + 6, 2, '#3d3d3d'); break;
      }
      case 'fdm': case 'resine': {
        const corps = t === 'fdm' ? '#3d3d3d' : '#f4f4f4';
        s += boite(x, y, w, dp, 3, corps, z);
        for (const [px, py] of [[x, y], [x + w - 3, y], [x, y + dp - 3], [x + w - 3, y + dp - 3]]) s += boite(px, py, 3, 3, h, corps, z);
        s += boite(x, y, w, dp, 3, corps, z + h - 3) + boite(x + w / 2 - 3, y + dp / 2 - 3, 6, 6, 3, '#9aa1a8', z + h - 9) + boite(x + w / 2 - 4, y + dp / 2 - 4, 8, 8, t === 'fdm' ? 5 : 8, t === 'fdm' ? '#ffc94d' : '#ff9a4a', z + 3);
        s += t === 'resine' ? poly(pts([x + 1, y + dp, z + 3], [x + w - 1, y + dp, z + 3], [x + w - 1, y + dp, z + h - 3], [x + 1, y + dp, z + h - 3]), 'rgba(255,154,74,.35)', 0.6)
          : bouton(x + w + 4, y + 6, z + 18, 4, '#ef6f9a') + bouton(x + w + 4, y + 6, z + 18, 1.5, '#3d3d3d');
        break;
      }
      case 'cao':
        s += ombre(x, y, w, dp) + boiteBois(x, y, w, dp, 18, z);
        ['url(#i-ecran)', '#d0955a'].forEach((c, k) => { s += boite(x + 8 + k * 26, y + 4, 22, 3, 14, '#1f2a3a', z + 18, null, c) + boite(x + 17 + k * 26, y + 6, 4, 4, 2, '#3d3d3d', z + 18); });
        s += boite(x + 24, y + 16, 18, 6, 1.5, '#f2f2ea', z + 18) + boite(x + 46, y + 17, 6, 5, 1.5, '#3a4a5e', z + 18) + boite(x + 4, y + 4, 10, 20, 26, '#2b3442', 0); break;
      case 'cnc':
        s += boiteMetal(x, y, w, dp, 10, '#5a6a7a', z) + boite(x, y, w, 4, h, '#8d96a1', z) + boite(x, y, 4, dp, h, '#8d96a1', z);
        s += poly(pts([x + 4, y + dp, z + 10], [x + w, y + dp, z + 10], [x + w, y + dp, z + h], [x + 4, y + dp, z + h]), 'rgba(191,230,255,.35)', 0.9);
        s += boite(x + 10, y + 10, w - 20, dp - 18, 4, '#c9ced4', z + 10) + boite(x + w / 2 - 4, y + 8, 8, 6, h - 16, '#3d3d3d', z + 14) + boite(x + 16, y + 16, 18, 12, 3, '#e8e8e0', z + 14);
        s += boite(x + w + 2, y + dp - 16, 6, 14, 26, '#3d3d3d') + faceDroite(x + w + 2, y + dp - 16, 6, 14, 3, 11, 0, 8, '#7be08a') + bouton(x + w + 8, y + dp - 4, 10, 1.6, '#d9534f'); break;
      case 'stlink': case 'jlink': case 'logique':
        s += boite(x, y, w, dp, h, { stlink: '#4a8ad8', jlink: '#2b2b2b', logique: '#3d3d3d' }[t], z) + bouton(x + w / 2, y + dp / 2, z + h, 0.9, '#ffc94d') + cable([x + w / 2, y + dp, z + 1], [x + w / 2 + 5, y + dp + 7, z], '#9aa1a8', 0.8); break;
      case 'ci':
        s += boiteMetal(x, y, w, dp, h, '#2b3442', z);
        for (let k = 0; k < 4; k++) s += faceAvant(x, y, dp, z, 1.5, w - 1.5, 4 + k * 5, 7 + k * 5, '#3d4a5c') + bouton(x + w - 2.5, y + dp, z + 5.5 + k * 5, 0.7, k === 2 ? '#ffc94d' : '#7be08a');
        break;
      case 'banc':
        s += boiteBois(x, y, w, dp, h, z, '#8a8f94') + boite(x + 4, y + 2, 14, 4, 12, '#1f4a6e', z + h, null, '#7cc0f2');
        for (let k = 0; k < 3; k++) s += boite(x + 24 + k * 10, y + 6, 7, 9, 1, '#2e8b57', z + h) + cable([x + 27 + k * 10, y + 6, z + h + 1], [x + 10, y + 4, z + h + 8], ['#d9534f', '#ffc94d', '#4a8ad8'][k], 0.8, -2);
        break;
      case 'esd': s += boite(x + 2, y + 2, 8, 8, 2, '#3d3d3d', z) + boite(x + 5, y + 5, 2, 2, h - 8, '#9aa1a8', z + 2) + boite(x + 1, y + 3, 10, 5, 6, '#ffc94d', z + h - 8) + bouton(x + 6, y + 8, z + h - 5, 1.5, '#3d3d3d'); break;
      case 'chambre':
        s += boite(x, y, w, dp, h, '#5a6a7a', z, 'url(#i-pyramides)') + faceAvant(x, y, dp, z, w * 0.55, w * 0.85, 0, h * 0.78, '#9aa1a8', 1.2);
        s += bouton(x + w * 0.6, y + dp, z + h * 0.4, 1.6, '#ffc94d') + faceDroite(x, y, w, z, dp * 0.2, dp * 0.5, h * 0.55, h * 0.75, '#bfe6ff');
        s += boite(x + w + 4, y + dp - 30, 26, 18, 14, '#e8e8e0') + boite(x + w + 8, y + dp - 28, 16, 3, 10, '#1f2a3a', 14, null, '#215a3a'); break;
      case 'pickplace':
        s += boiteMetal(x, y, w, dp, 18, '#c9ced4', z) + boite(x, y, w, dp, 2, '#8d96a1', z + h - 2);
        s += poly(pts([x, y + dp, z + 18], [x + w, y + dp, z + 18], [x + w, y + dp, z + h - 2], [x, y + dp, z + h - 2]), 'rgba(191,230,255,.4)', 0.9);
        s += boite(x + 4, y + dp / 2 - 2, w - 8, 4, 3, '#3d3d3d', z + 26) + boite(x + w / 2 - 3, y + dp / 2 - 4, 6, 8, 6, '#ffc94d', z + 22);
        for (let k = 0; k < 3; k++) s += bouton(x + 2, y + 16 + k * 16, z + 12, 4, ['#ef6f9a', '#6aa8f0', '#7be08a'][k]);
        break;
      case 'rayonx': {
        s += boiteMetal(x, y, w, dp, h, '#5a6a7a', z, '#6a7a8a') + faceAvant(x, y, dp, z, 6, w - 6, h * 0.45, h * 0.85, '#1a1a1a');
        const [X1, Y1] = iso(x + w / 2, y + dp, z + h * 0.65);
        s += `<path d="M${n1(X1 - 5)} ${n1(Y1 - 3)} l10 6 M${n1(X1 + 5)} ${n1(Y1 - 3)} l-10 6" stroke="#7be08a" stroke-width="1"/>` + faceAvant(x, y, dp, z, w / 2 - 8, w / 2 + 8, 4, 9, '#ffc94d') + txtIso(x + w / 2, y + dp, z + h * 0.3, '☢', 6, '#ffc94d'); break;
      }
      case 'aoi': s += boiteMetal(x, y, w, dp, h, '#e8e8e0', z) + faceAvant(x, y, dp, z, 6, w - 6, h * 0.45, h * 0.85, '#4a8ad8') + bouton(x + w / 2, y + dp, z + 6, 2.2, '#3d3d3d'); break;
      default: s += boite(x, y, w, dp, h, '#9aa1a8', z);
    }
    return s;
  };

  // ---------------------------------------------------------------- déco et mobilier placés
  const H_DECO = { cafe: 24, fontaine: 30, distrib: 44, biblio: 46, armoire: 44, imprimante: 16, aquarium: 22, arcade: 40, babyfoot: 18, canape: 14, table: 16, clim: 6, tableau: 34 };
  const plantePot = (x, y, w, dp, t) => {
    const r = Math.min(w, dp) * 0.42;
    let s = ombre(x + w * 0.2, y + dp * 0.2, w * 0.6, dp * 0.6) + boite(x + w * 0.25, y + dp * 0.25, w * 0.5, dp * 0.5, 9, '#b5543c', 0, '#5a3a22');
    if (t === 'ficus') {
      s += boite(x + w / 2 - 1, y + dp / 2 - 1, 2, 2, 18, '#7a5236', 9);
      [[0, 30, 1], [-0.4, 24, 0.7], [0.4, 26, 0.7], [0, 38, 0.6]].forEach(([dx, dz, rr], k) => { s += boule(x + w / 2 + dx * r, y + dp / 2, dz, r * rr, ['#3e8f33', '#4fa043', '#2f7a28', '#5cb84c'][k]); });
    } else {
      for (let k = 0; k < 5; k++) {
        const a = k * 1.256, [X, Y] = iso(x + w / 2 + Math.cos(a) * r * 0.5, y + dp / 2 + Math.sin(a) * r * 0.5, 16);
        s += `<ellipse cx="${n1(X)}" cy="${n1(Y)}" rx="${n1(r * 0.55)}" ry="${n1(r * 0.3)}" fill="${k % 2 ? '#5cb84c' : '#3e8f33'}" stroke="${T}" stroke-width=".9" transform="rotate(${k * 36} ${n1(X)} ${n1(Y)})"/>`;
      }
      s += boule(x + w / 2, y + dp / 2, 18, r * 0.4, '#6cc45a');
    }
    return s;
  };
  const canape = (x, y, w, dp, c = '#6aa8f0') => {
    let s = ombre(x, y, w, dp) + boite(x, y, w, dp, 9, nuance(c, 0.85)) + boite(x, y, w, 7, 20, c) + boite(x, y, 7, dp, 14, c) + boite(x + w - 7, y, 7, dp, 14, c);
    for (let k = 0; k < 2; k++) s += boite(x + 8 + k * (w - 16) / 2, y + 8, (w - 16) / 2 - 1, dp - 10, 4, nuance(c, 1.2), 9);
    return s + boite(x + 10, y + 8, 10, 4, 8, '#ffc94d', 13);
  };
  const deco = (t, x, y, w, dp) => {
    if (t === 'plantes' || t === 'ficus') return plantePot(x, y, w, dp, t);
    if (t === 'lampe') return boite(x + w / 2 - 4, y + dp / 2 - 4, 8, 8, 2, '#3d3d3d') + boite(x + w / 2 - 1, y + dp / 2 - 1, 2, 2, 30, '#9aa1a8', 2) + boule(x + w / 2, y + dp / 2, 34, 6, '#fff2c8');
    if (t === 'tapis' || t === 'poster') return poly(empreinte(x, y, w, dp, 0.5), t === 'tapis' ? '#b08af0' : '#ef6f9a');
    const h = H_DECO[t] || 12;
    let s = ombre(x, y, w, dp);
    switch (t) {
      case 'canape': return canape(x, y, w, dp);
      case 'babyfoot':
        s += boite(x + 2, y + 2, 4, 4, 10, '#5a3a22') + boite(x + w - 6, y + dp - 6, 4, 4, 10, '#5a3a22') + boite(x, y, w, dp, 8, '#7a5236', 10, '#5cb84c') + dessus(x, y, 18.1, 4, w - 4, dp / 2 - 0.5, dp / 2 + 0.5, '#ffffff', 0);
        for (let k = 0; k < 4; k++) s += boite(x + 8 + k * (w - 16) / 3, y - 5, 1.5, dp + 10, 1.5, '#9aa1a8', 19) + boite(x + 7 + k * (w - 16) / 3, y + dp / 2 - 2, 3.5, 4, 3, k % 2 ? '#d9534f' : '#4a8ad8', 18);
        return s + bouton(x + w / 2, y + dp / 2, 18.5, 1.5, '#ffffff');
      case 'table': return s + boiteBois(x, y, w, dp, 16, 0, '#d8ad72') + boite(x + w * 0.4, y + dp * 0.3, 8, 6, 1, '#ffffff', 16) + boite(x - 10, y + dp / 2 - 6, 9, 12, 8, '#3d3d3d') + boite(x + w + 1, y + dp / 2 - 6, 9, 12, 8, '#3d3d3d');
      case 'cafe': return s + boiteMetal(x, y, w, dp, h, '#3d3d3d') + faceAvant(x, y, dp, 0, 3, w - 3, 6, 12, '#1a1a1a') + boite(x + w / 2 - 2, y + dp - 5, 4, 4, 3, '#ffffff', 4) + bouton(x + w / 2, y + dp, 18, 1.3, '#ff6b5a');
      case 'fontaine': return s + boite(x + 2, y + 2, w - 4, dp - 4, 18, '#e8e8e0') + boite(x + 3, y + 3, w - 6, dp - 6, 12, '#8fd4ff', 18) + bouton(x + w / 2, y + dp - 2, 12, 1.2, '#4a8ad8');
      case 'distrib':
        s += boite(x, y, w, dp, h, '#d9534f') + faceAvant(x, y, dp, 0, 3, w * 0.65, 8, h - 4, 'rgba(191,230,255,.8)');
        for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) s += bouton(x + 6 + j * 6, y + dp, 14 + k * 9, 1.6, ['#ffc94d', '#7be08a', '#ef6f9a'][k]);
        return s;
      case 'biblio':
        s += boiteBois(x, y, w, dp, h, 0, '#a8703f');
        for (let k = 0; k < 4; k++) for (let j = 0; j < Math.floor((w - 4) / 5); j++) s += faceAvant(x, y, dp, 0, 2 + j * 5, 6 + j * 5, 3 + k * 11, 10 + k * 11 - (j % 3), ['#ef6f9a', '#6aa8f0', '#ffc94d', '#7be08a', '#b08af0'][(j + k) % 5], 0.5);
        return s;
      case 'armoire':
        s += boiteMetal(x, y, w, dp, h, '#b9c0c7');
        for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) s += faceAvant(x, y, dp, 0, 2 + j * (w - 4) / 3, (j + 1) * (w - 4) / 3, 3 + k * 10, 10 + k * 10, ['#ef6f9a', '#6aa8f0', '#ffc94d'][j], 0.5);
        return s;
      case 'aquarium':
        return s + boite(x, y, w, dp, 10, '#5a3a22') + poly(pts([x, y + dp, 10], [x + w, y + dp, 10], [x + w, y + dp, 10 + h], [x, y + dp, 10 + h]), 'rgba(143,224,255,.75)')
          + poly(pts([x + w, y, 10], [x + w, y + dp, 10], [x + w, y + dp, 10 + h], [x + w, y, 10 + h]), 'rgba(92,207,196,.75)') + txtIso(x + w * 0.4, y + dp, 18, '◀', 6, '#ff9a4a') + txtIso(x + w * 0.7, y + dp, 24, '◀', 5, '#ffc94d');
      case 'arcade':
        return s + boite(x, y, w, dp, h, '#3a2a5a') + faceAvant(x, y, dp, 0, 3, w - 3, h * 0.55, h * 0.85, '#7be08a') + faceAvant(x, y, dp, 0, 3, w - 3, h * 0.9, h - 1, '#ef6f9a') + bouton(x + w * 0.35, y + dp, h * 0.42, 1.5, '#d9534f') + bouton(x + w * 0.65, y + dp, h * 0.42, 1.3, '#ffc94d');
      case 'imprimante': return s + boiteMetal(x, y, w, dp, h, '#d8dde3') + boite(x + 4, y - 3, w - 8, 6, 0.5, '#ffffff', h);
      case 'tableau': return boite(x + 2, y + dp - 3, 2, 2, h, '#9aa1a8') + boite(x + w - 4, y + dp - 3, 2, 2, h, '#9aa1a8') + boite(x, y + dp - 2, w, 2, 20, '#ffffff', h - 22) + faceAvant(x, y + dp - 2, 2, h - 22, 6, w * 0.6, 8, 14, '#4a8ad8', 0) + faceAvant(x, y + dp - 2, 2, h - 22, w * 0.7, w - 6, 4, 12, '#ffe08a', 0);
      case 'clim': return boite(x, y, w, dp, 8, '#f4f4f4', 40);
      default: return s + boite(x, y, w, dp, h, '#9aa1a8');
    }
  };
  // Bureau dans son emprise 76x64 : plateau en haut, chaise devant (l'employé s'y assoit en (x+38, y+46))
  const poste = (x, y, i = 0) => {
    const bx = x + 7, by = y + 2;
    let s = ombre(bx, by, 62, 30) + boite(bx + 2, by + 2, 3, 3, 16, '#7a5236') + boite(bx + 57, by + 2, 3, 3, 16, '#7a5236');
    s += boite(bx + 46, by + 6, 10, 20, 22, '#2b3442', 0, null, '#3d4a5c') + bouton(bx + 51, by + 26, 18, 1, '#7be08a');
    s += boiteBois(bx, by, 62, 30, 4, 16) + boite(bx + 26, by + 6, 10, 4, 1, '#3d3d3d', 20) + boite(bx + 30, by + 7, 2, 2, 6, '#3d3d3d', 21);
    s += boite(bx + 16, by + 4, 32, 3, 18, '#1f2a3a', 25, null, 'url(#i-ecran)');
    ['#ffe08a', '#7be08a', '#ffffff'].forEach((c, k) => { s += faceAvant(bx + 16, by + 4, 3, 25, 4 + k * 8, 9 + k * 8, 12, 13.2, c, 0); });
    s += cable([bx + 32, by + 6, 21], [bx + 50, by + 8, 0], '#3d3d3d', 1, 10) + boite(bx + 18, by + 17, 22, 7, 1.5, '#f2f2ea', 20) + boite(bx + 43, by + 18, 5, 7, 1.5, '#e8e8e0', 20);
    s += dessus(bx, by, 20.1, 3, 13, 6, 20, '#ffffff', 0.6) + dessus(bx, by, 20.2, 5, 15, 8, 22, '#fff7e6', 0.6);
    s += i % 2 ? boite(bx + 54, by + 5, 4, 4, 5, '#ef6f9a', 20) : boite(bx + 4, by + 22, 6, 4, 2, '#3d3d3d', 20) + boite(bx + 54, by + 4, 3, 3, 4, '#6a7480', 20);
    if (i % 3 === 0) s += boite(bx + 54, by + 18, 4, 4, 1, '#3d3d3d', 20) + boite(bx + 55, by + 19, 2, 2, 12, '#9aa1a8', 21) + boule(bx + 56, by + 20, 34, 3.5, '#fff2c8');
    return s + boite(x + 36, y + 46, 4, 4, 6, '#555') + boite(x + 30, y + 40, 16, 14, 4, '#3d3d3d', 6, '#4a4a4a') + boite(x + 30, y + 52, 16, 3, 18, '#3d3d3d', 8);
  };
  // Un objet placé ; etablis : rectangles d'établi de la carte (le petit matériel y est posé à 20 de haut)
  const objet = (o, f, etablis) => {
    const { x, y, type: t } = o, w = f.w, dp = f.h;
    if (t === 'poste') return poste(x, y, o.id);
    if (REEL[t]) {
      const [rw0, rd0, rh] = REEL[t], rw = Math.min(rw0, w), rd = Math.min(rd0, dp);
      const z = etablis.some(([ex, ey, ew, eh]) => ex <= x && ey <= y && x + w <= ex + ew + 1 && y + dp <= ey + eh + 1) ? 20 : 0;
      return appareil(t, x + (w - rw) / 2, y + (dp - rd) / 2, rw, rd, rh, z);
    }
    return deco(t, x, y, w, dp);
  };
  // Profondeur d'affichage d'un objet (les plus lointains d'abord)
  const profondeur = (o, f) => (o.type === 'tapis' || o.type === 'poster' ? -1e4 : o.x + o.y + f.w / 2 + f.h / 2);

  // ---------------------------------------------------------------- murs
  const murs = (segments, h, c, ep = 6) => {
    const out = [];
    for (const [x1, y1, x2, y2] of segments) {
      const n = Math.max(1, Math.floor(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 30));
      for (let k = 0; k < n; k++) {
        const ax = x1 + (x2 - x1) * k / n, ay = y1 + (y2 - y1) * k / n, bx = x1 + (x2 - x1) * (k + 1) / n, by = y1 + (y2 - y1) * (k + 1) / n;
        const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.max(Math.abs(bx - ax), ep), dp = Math.max(Math.abs(by - ay), ep);
        out.push([x + y + w / 2 + dp / 2 - 4, boite(x, y, w, dp, h, c)]);
      }
    }
    return out;
  };
  // Grand mur du fond (nord : horizontal, ouest : vertical) avec fenêtres à stores sur sa face intérieure
  const murFond = (x1, y1, longueur, h, c, horizontal) => {
    let s = horizontal ? boite(x1, y1 - 8, longueur, 8, h, c) : boite(x1 - 8, y1, 8, longueur, h, c);
    for (let k = 0; k < Math.floor(longueur / 64); k++) {
      const f = (horizontal ? x1 : y1) + 18 + k * 64;
      const q = (u, v) => (horizontal ? [f + u, y1 + 0.2, v] : [x1 + 0.2, f + u, v]);
      s += poly(pts(q(0, 16), q(36, 16), q(36, h - 10), q(0, h - 10)), '#bfe6ff', 1.2);
      for (let b = 0; b < 5; b++) s += poly(pts(q(1, h - 14 - b * 7), q(35, h - 14 - b * 7), q(35, h - 15.5 - b * 7), q(1, h - 15.5 - b * 7)), 'rgba(255,255,255,.55)', 0);  // stores
      s += poly(pts(q(-1, 15), q(37, 15), q(37, 13), q(-1, 13)), '#f4f1e8', 0.6);  // rebord
    }
    return s;
  };

  // ---------------------------------------------------------------- arbres, voitures, extérieur
  let SAISON = 'printemps';
  const FEUILLES = { printemps: ['#3e8f33', '#4fa043', '#2f6e3a', '#3f8a4a', '#4f9a5a'], ete: ['#2f7a2a', '#3e8f33', '#245e2c', '#2f7a3a', '#3f8a4a'],
    automne: ['#d9822b', '#e8a33a', '#b8562a', '#cf6f2c', '#e0932e'], hiver: ['#9fb0a6', '#c4d2ca', '#8a9a90', '#a9b8ae', '#dfe7e2'] };
  const HERBE = { printemps: ['#7cc46a', '#68b357'], ete: ['#93c45a', '#7fb04a'], automne: ['#a9b45e', '#c2873a'], hiver: ['#e3ece8', '#ffffff'] };
  const arbre = (x, y, r = 22, espece = 0) => {
    const [f1, f2, f3, f4, f5] = FEUILLES[SAISON] || FEUILLES.printemps;
    if (espece === 1) return boite(x - 3, y - 3, 6, 6, 10, '#7a5236') + boule(x, y, 22, r * 0.9, f3) + boule(x, y, 34, r * 0.65, f4) + boule(x, y, 44, r * 0.4, f5);
    let s = boite(x - 3, y - 3, 6, 6, 18, '#7a5236') + boule(x, y, 30, r, f1) + boule(x - r * 0.3, y, 38, r * 0.6, f2);
    if (espece === 2 && SAISON !== 'hiver') for (let k = 0; k < 9; k++) { const a = k * 2.399, d = r * 0.7 * Math.sqrt((k + 0.5) / 9), [X, Y] = iso(x + Math.cos(a) * d, y + Math.sin(a) * d, 34 + (k % 3) * 3); s += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="2" fill="${k % 2 ? '#ffffff' : '#ffb3d1'}"/>`; }
    return s;
  };
  const voiture = (x, y, c, horizontal = true, recule = false) => {
    const [w, dp] = horizontal ? [56, 28] : [28, 56], av = horizontal && recule ? 0 : w;  // phares côté sens de la marche
    return ombre(x, y, w, dp) + boite(x, y, w, dp, 10, c) + boite(x + (horizontal ? 14 : 3), y + (horizontal ? 3 : 14), w - (horizontal ? 24 : 6), dp - (horizontal ? 6 : 24), 9, '#bfe6ff', 10, c)
      + bouton(x + (horizontal ? av : 6), y + (horizontal ? 6 : dp), 6, 1.6, '#ffe08a') + bouton(x + (horizontal ? av : 22), y + (horizontal ? 22 : dp), 6, 1.6, '#ffe08a');
  };
  const lampadaire = (x, y) => boite(x - 2, y - 2, 4, 4, 50, '#3d3d3d') + boule(x, y + 2, 54, 5, '#ffe08a');
  const velo = (x, y, c) => boite(x, y, 3, 24, 8, c) + bouton(x + 1.5, y + 2, 6, 3.5, 'none') + bouton(x + 1.5, y + 22, 6, 3.5, 'none');
  const rueEtTrottoir = () => `<rect x="0" y="834" width="860" height="50" fill="#565b60"/><rect x="0" y="810" width="860" height="24" fill="url(#i-pave)"/>`
    + Array.from({ length: 26 }, (_, k) => `<rect x="${k * 34}" y="857" width="20" height="4" fill="#ffe08a"/>`).join('')
    + Array.from({ length: 6 }, (_, k) => `<rect x="${300 + k * 14}" y="838" width="8" height="42" fill="#f4f1e8"/>`).join('')
    + `<circle cx="90" cy="870" r="6" fill="#4a4f54"/><circle cx="640" cy="870" r="6" fill="#4a4f54"/>`;
  const rueVolumes = () => {
    const v = [];
    for (const lx of [120, 470, 790]) v.push([lx + 812, lampadaire(lx, 810)]);
    v.push([420 + 822, personne(420, 822, 0, '#6aa8f0', T, PEAUX[1], false, 0, 'telephone')]);
    v.push([760 + 810, boite(760, 812, 60, 12, 26, 'rgba(191,230,255,.55)', 0, null, 'rgba(191,230,255,.4)') + boite(764, 816, 52, 4, 6, '#8a5a36')]);  // abribus
    v.push([60 + 816, boite(58, 814, 6, 6, 12, '#d9534f') + bouton(61, 817, 13, 2.5, '#d9534f')]);  // borne incendie
    return v;
  };

  // ---------------------------------------------------------------- bâtiment de bureaux, un étage à la fois
  const MOTIF = { bureau: 'parquet', res: 'moquette', rd: 'violet', dg: 'bleue', reunion: 'jaune', bulle: 'jaune', cantine: 'chaud', cafet: 'chaud', labo: 'vert',
    atelier: 'beton', stock: 'beton', sav: 'lino', etuves: 'carrelage', indus: 'lino', reception: 'lino', accueil: 'carrelage' };
  const piecesEtage = (cat) => Object.entries(cat.pieces).filter(([, pc]) => pc.etage === ETAGE);
  const dansEtage = (cat, y) => y >= cat.etages[ETAGE].y0 && y < cat.etages[ETAGE].y0 + 1000;
  // Côtés extérieurs de l'étage (union des coques), moins les parts collées à une autre coque et les ouvertures (entrée, terrasse) :
  // nord et ouest = murs du fond (on voit leur face intérieure, avec les fenêtres), sud et est = façade basse ; segments [x1, y1, x2, y2]
  const bords = (cat) => {
    const C = cat.coques[ETAGE], O = cat.ouvertures[ETAGE], b = { nord: [], ouest: [], sud: [], est: [] };
    const moins = (a1, a2, trous) => trous.reduce((parts, [t1, t2]) => parts.flatMap(([p1, p2]) => (t2 <= p1 || t1 >= p2 ? [[p1, p2]] : [[p1, t1], [t2, p2]].filter(([u, v]) => v - u > 1))), [[a1, a2]]);
    for (const [x, y, w, h] of C) {
      for (const [cote, yy, d] of [['nord', y, -0.5], ['sud', y + h, 0.5]]) {
        const trous = C.filter(([, cy, , ch]) => cy < yy + d && yy + d < cy + ch).map(([cx, , cw]) => [cx, cx + cw]).concat(O.filter(([, y1, , y2]) => y1 === yy && y2 === yy).map(([x1, , x2]) => [x1, x2]));
        for (const [p1, p2] of moins(x, x + w, trous)) b[cote].push([p1, yy, p2, yy]);
      }
      for (const [cote, xx, d] of [['ouest', x, -0.5], ['est', x + w, 0.5]]) {
        const trous = C.filter(([cx, , cw]) => cx < xx + d && xx + d < cx + cw).map(([, cy, , ch]) => [cy, cy + ch]).concat(O.filter(([x1, , x2]) => x1 === xx && x2 === xx).map(([, y1, , y2]) => [y1, y2]));
        for (const [p1, p2] of moins(y, y + h, trous)) b[cote].push([xx, p1, xx, p2]);
      }
    }
    return b;
  };
  // cloisons intérieures relevées sur le plan (un trou = une porte) : segments [x1, y1, x2, y2]
  const cloisonsEtage = (cat) => ({ restants: cat.cloisons[ETAGE].map((m) => m.slice()), el: [] });

  // ---------------------------------------------------------------- trajets : les personnages contournent les murs et passent par les portes
  const PAS = 8;  // côté d'une case de la grille de marche
  let GRILLE = { cle: null };
  const grilleMurs = (e, cat) => {
    const cle = (batiment(e) ? ETAGE : 'garage');
    if (GRILLE.cle === cle) return GRILLE;
    const g = { cle, x0: -40, y0: DY - 40, nx: Math.ceil(1400 / PAS), ny: Math.ceil(940 / PAS) };
    g.mur = new Uint8Array(g.nx * g.ny);
    g.c = (x, y) => { const i = Math.floor((x - g.x0) / PAS), j = Math.floor((y - g.y0) / PAS); return i >= 0 && j >= 0 && i < g.nx && j < g.ny ? j * g.nx + i : -1; };
    const segs = [];
    if (batiment(e)) {
      const b = bords(cat);
      segs.push(...cat.cloisons[ETAGE], ...b.nord, ...b.ouest, ...b.sud, ...b.est);
      const dans = (x, y, r) => r.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
      for (let k = 0; k < g.mur.length; k++) {  // hors du bâtiment : seulement le parvis et la terrasse
        const x = g.x0 + (k % g.nx + 0.5) * PAS, y = g.y0 + (Math.floor(k / g.nx) + 0.5) * PAS;
        if (!dans(x, y, cat.coques[ETAGE]) && !dans(x, y, cat.dehors[ETAGE])) g.mur[k] = 1;
      }
    } else {  // garage : murs du fond, mur est, mur sud ouvert sur la porte basculante
      const gx = 430, gy = 400, gw = 250;
      segs.push([gx, gy, gx + gw, gy], [gx, gy, gx, gy + gw], [gx + gw, gy, gx + gw, gy + gw], [gx, gy + gw, gx + 50, gy + gw], [gx + 200, gy + gw, gx + gw, gy + gw]);
    }
    for (const [x1, y1, x2, y2] of segs) {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 4));
      for (let k = 0; k <= n; k++) {
        const i = g.c(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n);
        if (i >= 0) g.mur[i] = 1;
      }
    }
    return (GRILLE = g);
  };
  // Points de passage de (ax, ay) à (bx, by), sans le départ, coordonnées du monde ; plus court chemin sur la grille puis lissé
  const trajet = (e, cat, ax, ay, bx, by) => {
    const g = grilleMurs(e, cat), N = g.nx * g.ny;
    const proche = (x, y) => {  // case libre la plus proche d'un point collé au mur
      for (let r = 0; r <= 2 * PAS; r += PAS) for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const k = g.c(x + dx, y + dy); if (k >= 0 && !g.mur[k]) return k; }
      return -1;
    };
    const s = proche(ax, ay), t = proche(bx, by);
    if (s < 0 || t < 0) return [[bx, by]];
    const de = new Int32Array(N).fill(-1), file = [s];
    de[s] = s;
    for (let q = 0; q < file.length && de[t] < 0; q++) {
      const k = file[q], i = k % g.nx;
      for (const n of [i > 0 ? k - 1 : -1, i < g.nx - 1 ? k + 1 : -1, k - g.nx, k + g.nx]) if (n >= 0 && n < N && de[n] < 0 && !g.mur[n]) { de[n] = k; file.push(n); }
    }
    if (de[t] < 0) return [[bx, by]];  // pas de chemin (point dans un mur ou hors du bâtiment) : tout droit
    const cases = [];
    for (let k = t; k !== s; k = de[k]) cases.push(k);
    const centre = (k) => [g.x0 + (k % g.nx + 0.5) * PAS, g.y0 + (Math.floor(k / g.nx) + 0.5) * PAS];
    const p = [[ax, ay], ...cases.reverse().slice(0, -1).map(centre), [bx, by]];
    const vue = ([x1, y1], [x2, y2]) => {
      const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (PAS / 4));
      for (let m = 1; m < n; m++) { const k = g.c(x1 + (x2 - x1) * m / n, y1 + (y2 - y1) * m / n); if (k >= 0 && g.mur[k]) return false; }
      return true;
    };
    const out = [];
    for (let i = 0; i < p.length - 1;) { let j = i + 1; while (j + 1 < p.length && vue(p[i], p[j + 1])) j++; out.push(p[j]); i = j; }
    return out;
  };

  const fondEtage = (e, cat) => {
    const y0 = cat.etages[ETAGE].y0, rdc = ETAGE === 'rdc';
    let plat = `<rect x="-400" y="${y0 - 400}" width="2100" height="1700" fill="${rdc ? 'url(#i-herbe)' : '#c6dbea'}"/>`;
    if (rdc) {
      plat += `<rect x="-400" y="${y0 + 776}" width="2100" height="24" fill="url(#i-pave)"/><rect x="-400" y="${y0 + 800}" width="2100" height="64" fill="#565b60"/>`;
      plat += Array.from({ length: 40 }, (_, k) => `<rect x="${-380 + k * 50}" y="${y0 + 830}" width="26" height="4" fill="#ffe08a"/>`).join('');
    } else {
      for (const [cx, cy, r] of [[-150, 200, 60], [1450, 120, 80], [1400, 760, 50], [-120, 820, 70]]) plat += `<ellipse cx="${cx}" cy="${y0 + cy}" rx="${r * 1.6}" ry="${r}" fill="#e4eef6"/>`;
    }
    for (const [x, y, w, h] of cat.coques[ETAGE]) plat += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#i-couloir)"/>`;
    // R2 : toit vert sur le reste du bâtiment et dalle technique avec son passage vers l'escalier
    if (ETAGE === 'r2') plat += `<rect x="20" y="${y0 + 20}" width="540" height="720" fill="#8fbf73"/><rect x="350" y="${y0 + 20}" width="210" height="260" fill="#c9ced4"/><rect x="20" y="${y0 + 232}" width="540" height="48" fill="#c9ced4"/>`;
    for (const [x, y, w, h] of cat.dehors[ETAGE]) plat += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#i-${rdc ? 'pave' : 'parquet'})"/>`;
    for (const [k, pc] of piecesEtage(cat)) {
      const [x, y, w, h] = pc.rect;
      plat += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#i-${MOTIF[pc.genre] || 'parquet'})"/>`;
      plat += `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.round(Math.min(w, h) * 0.45)}" fill="url(#i-halo)"/><g class="lum-soir"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#i-soir)"/></g>`;
      if (k === 'accueil') plat += `<rect x="${x + 70}" y="${y + 80}" width="${w - 140}" height="${h - 90}" rx="6" fill="#c0392b" opacity=".85"/>`;
    }
    for (const [t, x, y, w, h] of cat.communs[ETAGE]) plat += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#i-${t === 'wc' || t === 'douches' ? 'carrelage' : t === 'escalier' ? 'marches' : 'lino'})"/>`;
    // murs du fond avec fenêtres à stores
    const b = bords(cat), fond = b.nord.map(([x1, y, x2]) => murFond(x1, y, x2 - x1, 70, '#c9a77e', true)).concat(b.ouest.map(([x, y1, , y2]) => murFond(x, y1, y2 - y1, 70, '#b8946a', false))).join('');
    const { restants, el } = cloisonsEtage(cat);
    el.push(...murs(restants, 14, '#d8c0a0'));
    // parties communes : sanitaires, escalier, cagibis, reprographie, local technique
    for (const [t, x, y, w, h] of cat.communs[ETAGE]) {
      if (t === 'wc') for (let k = 0; k < Math.min(3, Math.floor(w / 40)); k++) el.push([x + y + 20 + k * 30, boite(x + 10 + k * 36, y + 8, 16, 22, 12, '#ffffff', 0, '#f4f8fb') + boite(x + 10 + k * 36, y + 6, 16, 4, 22, '#ffffff')]);
      else if (t === 'escalier') {
        let m = '';
        for (let k = 0; k < 8; k++) m += boite(x + 12 + k * ((w - 24) / 8), y + 14, (w - 24) / 8, h / 2 - 20, 4 + k * 7, '#c9ced4', 0, '#dfe3e8');
        for (let k = 0; k < 8; k++) m += boite(x + w - 12 - (k + 1) * ((w - 24) / 8), y + h / 2 + 6, (w - 24) / 8, h / 2 - 20, 60 - k * 7, '#c9ced4', 0, '#dfe3e8');
        el.push([x + y + w / 2 + h / 2, m + boite(x + 12, y + h / 2 - 6, w - 24, 4, 34, '#9aa1a8')]);
      } else if (t === 'cagibi') el.push([x + y + 30, boite(x + 6, y + 6, Math.min(26, w - 12), h - 12, 44, '#a8703f') + boite(x + 8, y + 10, Math.min(22, w - 16), 16, 10, '#d8b07a', 20)]);
      else if (t === 'imprimante') el.push([x + y + 60, boiteMetal(x + 20, y + 30, 50, 34, 28, '#e8e8e0') + boite(x + 26, y + 34, 38, 22, 3, '#3d3d3d', 28) + boite(x + 20, y + 120, 70, 24, 22, '#c48a52', 0, 'url(#i-bois)')]);
      else if (t === 'technique') for (let k = 0; k < Math.min(4, Math.floor(w / 30)); k++) {
        let baie = boite(x + 8 + k * 28, y + 8, 22, 22, 50, '#2b3442', 0, '#3d4a5c');
        for (let j = 0; j < 6; j++) baie += bouton(x + 26 + k * 28, y + 30, 8 + j * 7, 0.8, ['#7be08a', '#ffc94d', '#ff6b5a'][j % 3]);
        el.push([x + y + 20 + k * 28, baie]);
      }
      const ic = { wc: 'WC', escalier: '', cagibi: '', imprimante: 'COPIE', technique: 'SERVEURS' }[t];
      if (ic) el.push([x + y + w + h, txtIso(x + w / 2, y + h - 12, 2, ic, 9, '#2f3a4a', 'Nunito, sans-serif')]);
    }
    // R2 : toit-terrasse (parasols, tables, jardinières)
    if (ETAGE === 'r2') {
      const [tx, ty, tw, th] = cat.dehors.r2[0];
      for (const [px, py] of [[tx + 40, 60], [tx + 130, 150]]) el.push([px + ty + py, boite(px, ty + py, 32, 32, 16, '#f4f1e8') + boite(px + 14, ty + py + 14, 4, 4, 30, '#9aa1a8', 16) + boule(px + 16, ty + py + 16, 50, 26, '#ff8f7a')]);
      for (const [px, py] of [[tx + 6, 6], [tx + tw - 26, 6], [tx + tw - 26, th - 26]]) el.push([px + ty + py, plantePot(px, ty + py, 20, 20, 'plantes')]);
    }
    return { plat, fond, el };
  };
  // Mobilier fixe des pièces (et établi du labo) : trié avec les objets par profondeur
  const fixesEtage = (e, cat) => {
    const out = [];
    for (const [bx, by, bw, bh] of cat.etablis.batiment) if (dansEtage(cat, by)) out.push([-5e3, boite(bx, by, bw, bh, 20, '#4f93b8', 0, '#5aa0c8') + boite(bx, by, bw, 4, 8, '#4f93b8', 20)]);
    for (const [t, x, y, w, h] of cat.meubles.batiment) {
      if (!dansEtage(cat, y)) continue;
      let m = '';
      if (t === 'cuisine') {
        m = boite(x, y, w - 30, h - 6, 22, '#d8d0c0', 0, '#ece6da') + boite(x + 6, y + 4, 20, 14, 0.5, '#9aa1a8', 22) + boite(x + 34, y + 4, 12, 10, 14, '#3d3d3d', 22) + boite(x + 52, y + 4, 20, 12, 10, '#e8e8e0', 22, null, '#1f2a3a');
        for (let j = 0; j < Math.floor((w - 30) / 40); j++) m += faceAvant(x, y, h - 6, 0, 4 + j * 40, 38 + j * 40, 3, 19, '#c8bea8', 0.6);
        m += boiteMetal(x + w - 28, y, 28, h, 46, '#f4f4f4');
      } else if (t === 'comptoir') {
        m = ombre(x, y, w, h) + boite(x, y, w, h, 22, '#8a5a36', 0, 'url(#i-bois)') + boite(x, y, w, 4, 30, '#7a5236') + faceAvant(x, y, h, 0, w / 2 - 26, w / 2 + 26, 8, 16, '#ffc94d', 1);
        m += txtIso(x + w / 2, y + h, 10.5, esc(String(e.entreprise || '').toUpperCase().slice(0, 14)), 4.2, T) + boite(x + 40, y + 4, 24, 3, 14, '#1f2a3a', 22, null, 'url(#i-ecran)');
        out.push([x + y + h - 12, personne(x + w / 2, y - 12, 0, '#ef6f9a', '#e0703a', PEAUX[4], true, 1)]);
      } else if (t === 'rayonnage' || t === 'rayonnage_v') {
        const horiz = t === 'rayonnage', n = Math.floor((horiz ? w : h) / 90);
        for (let j = 0; j < n; j++) {
          const rx = horiz ? x + j * 90 : x, ry = horiz ? y : y + j * 90, rw = horiz ? 84 : w, rh = horiz ? h : 84;
          let r = '';
          for (const [ux, uy] of [[0, 0], [rw - 3, 0], [0, rh - 3], [rw - 3, rh - 3]]) r += boite(rx + ux, ry + uy, 3, 3, 40, '#7a5a3a');
          for (let q = 0; q < 4; q++) {
            r += boite(rx, ry, rw, rh, 1.2, '#c48a52', 4 + q * 11.6);
            if (q < 3) for (let c = 0; c < 3; c++) {  // trois cartons par tablette, de hauteurs variées
              const ht = 6 + (j + q + c) % 3, cz = 5.2 + q * 11.6, teinteC = ['#d8b07a', '#c9a26a', '#e2c08a'][(j + q * 2 + c) % 3];
              r += horiz ? boite(rx + 4 + c * 26, ry + 3, 24, rh - 6, ht, teinteC, cz) : boite(rx + 3, ry + 4 + c * 26, rw - 6, 24, ht, teinteC, cz);
            }
          }
          out.push([rx + ry + rw / 2 + rh / 2, r]);
        }
        continue;
      } else if (t === 'etuve') {
        for (let j = 0; j < Math.floor(w / 52); j++) out.push([x + j * 52 + y + 26, boiteMetal(x + j * 52, y, 48, h, 44, '#9aa1a8') + faceAvant(x + j * 52, y, h, 0, 8, 40, 14, 34, '#ff9a4a', 1) + bouton(x + j * 52 + 44, y + h, 38, 1.5, '#7be08a')]);
        continue;
      } else if (t === 'ligne') {
        for (let j = 0; j < Math.floor(h / 30); j++) out.push([x + w / 2 + y + j * 30 + 15, boite(x, y + j * 30, w, 30, 10, '#3d3d3d', 0, '#2e8b57') + boite(x + 4, y + j * 30 + 10, w - 8, 10, 3, '#2e8b57', 10)]);
        continue;
      } else if (t === 'table_reunion') {
        m = ombre(x, y, w, h) + boiteBois(x, y, w, h, 4, 14) + dessus(x, y, 18.1, 10, 26, 8, 18, '#ffffff') + dessus(x, y, 18.1, w - 30, w - 12, h - 18, h - 8, '#2a3a56');
        for (let j = 0; j < Math.floor(w / 30); j++) {
          out.push([x + 10 + j * 30 + y - 6, boite(x + 8 + j * 30, y - 16, 12, 12, 8, '#3d3d3d') + boite(x + 8 + j * 30, y - 18, 12, 3, 16, '#3d3d3d', 4)]);
          if (h >= 40) out.push([x + 10 + j * 30 + y + h + 14, boite(x + 8 + j * 30, y + h + 4, 12, 12, 8, '#3d3d3d') + boite(x + 8 + j * 30, y + h + 15, 12, 3, 16, '#3d3d3d', 4)]);
        }
      }
      out.push([x + y + w / 2 + h / 2, m]);
    }
    return out;
  };
  const devantEtage = (e, cat) => {
    const v = [], y0 = cat.etages[ETAGE].y0;
    // façades sud et est (basses, pour voir l'intérieur), percées de l'entrée au RDC
    const b = bords(cat);
    v.push(...murs([...b.sud, ...b.est], 18, '#c9a77e'));
    for (const [x1, y1, x2, y2] of cat.ouvertures[ETAGE]) if (y1 === y2 && b.sud.some(([, y]) => y === y1)) {
      v.push([(x1 + x2) / 2 + y1, boite(x1, y1 - 2, 2, 4, 30, '#9aa1a8') + boite(x2 - 2, y1 - 2, 2, 4, 30, '#9aa1a8') + boite(x1, y1 - 2, x2 - x1, 4, 3, '#9aa1a8', 30)]);
    }
    if (ETAGE === 'rdc') {
      for (const lx of [60, 320, 880, 1200]) v.push([lx + y0 + 776, lampadaire(lx, y0 + 776)]);
      ['#d9534f', '#4a8ad8', '#ffc94d'].forEach((c, k) => v.push([561 + k * 12 + y0 + 770, velo(561 + k * 12, y0 + 748, c)]));
      for (const [ax, ay, r, es] of [[-40, 300, 24, 0], [-60, 620, 20, 2], [1330, 200, 22, 1], [1340, 560, 24, 0]]) v.push([ax + y0 + ay, arbre(ax, y0 + ay, r, es)]);
    }
    return v;
  };
  const etiquettesEtage = (e, cat) => piecesEtage(cat).filter(([k]) => k !== 'stock2')
    .map(([, pc]) => { const [x, y, w, h] = pc.rect; return etiquette(x + w / 2, y + h - 12, pc.nom); }).join('');

  // ---------------------------------------------------------------- carte du garage
  const fondGarage = (e, cat) => {
    let plat = `<rect x="0" y="0" width="860" height="900" fill="url(#i-herbe)"/>` + rueEtTrottoir();
    plat += `<rect x="480" y="650" width="150" height="160" fill="url(#i-pave)"/><rect x="100" y="160" width="240" height="110" rx="18" fill="#68b357"/>`;
    plat += Array.from({ length: 4 }, (_, k) => `<rect x="${116 + k * 34}" y="176" width="24" height="78" rx="4" fill="#8a5a36"/>` + Array.from({ length: 4 }, (_, j) => `<circle cx="${128 + k * 34}" cy="${186 + j * 16}" r="5" fill="#5cb84c"/>`).join('')).join('');
    plat += `<rect x="438" y="408" width="234" height="234" fill="url(#i-beton)"/><rect x="110" y="682" width="180" height="70" fill="url(#i-parquet)"/>`;
    plat += `<g class="soleil"><polygon points="438,456 438,492 518,520 518,484" fill="url(#i-soleil-d)"/></g><g class="lum-soir"><rect x="438" y="408" width="234" height="234" fill="url(#i-soir)"/></g><circle cx="556" cy="524" r="100" fill="url(#i-halo)"/>`;
    plat += `<rect x="40" y="120" width="780" height="6" fill="#c99a63"/><rect x="40" y="120" width="6" height="680" fill="#c99a63"/>`;
    const el = [];
    // maison : murs, fenêtres, porte, toit à deux pans en tuiles, cheminée
    const hx = 70, hy = 300, hw = 320, hd = 380, hh = 70, faite = hh + 70;
    let m = boite(hx, hy, hw, hd, hh, '#e8dcc8');
    for (let k = 0; k < 4; k++) { const fy = hy + 40 + k * 90; m += poly(pts([hx + hw + 0.2, fy, 20], [hx + hw + 0.2, fy + 30, 20], [hx + hw + 0.2, fy + 30, 50], [hx + hw + 0.2, fy, 50]), '#bfe6ff', 1.2); }
    m += faceAvant(hx, hy, hd, 0, hw / 2 - 14, hw / 2 + 14, 0, 40, '#8a5a36', 1.2) + faceAvant(hx, hy, hd, 0, 30, 70, 22, 52, '#bfe6ff', 1.2) + faceAvant(hx, hy, hd, 0, hw - 70, hw - 30, 22, 52, '#bfe6ff', 1.2);
    m += poly(pts([hx - 10, hy - 10, hh], [hx - 10, hy + hd + 10, hh], [hx + hw / 2, hy + hd + 10, faite], [hx + hw / 2, hy - 10, faite]), '#9c4632', 1.5);
    m += poly(pts([hx + hw + 10, hy - 10, hh], [hx + hw + 10, hy + hd + 10, hh], [hx + hw / 2, hy + hd + 10, faite], [hx + hw / 2, hy - 10, faite]), '#b5543c', 1.5);
    for (let k = 1; k < 8; k++) { const xt = hx + hw + 10 - (hw / 2 + 10) * k / 8, zt = hh + 70 * k / 8, [a, b] = iso(xt, hy - 10, zt), [c2, d] = iso(xt, hy + hd + 10, zt); m += `<line x1="${n1(a)}" y1="${n1(b)}" x2="${n1(c2)}" y2="${n1(d)}" stroke="#9c4632" stroke-width="1.5"/>`; }
    m += poly(pts([hx - 10, hy + hd + 10, hh], [hx + hw + 10, hy + hd + 10, hh], [hx + hw / 2, hy + hd + 10, faite]), '#e8dcc8', 1.5) + boite(hx + hw / 2 + 40, hy + 60, 30, 30, 50, '#8a5a36', faite - 40);
    el.push([hx + hy + hw / 2 + hd / 2, m]);
    el.push([160 + 717, boite(146, 703, 28, 28, 14, '#f4f1e8') + boite(122, 709, 12, 12, 8, '#7a5236') + boite(186, 709, 12, 12, 8, '#7a5236')]);
    el.push([270 + 220, boite(266, 176, 58, 6, 3, '#7a5236', 60) + boite(268, 178, 3, 3, 60, '#3d3d3d') + boite(320, 178, 3, 3, 60, '#3d3d3d') + boite(286, 206, 18, 8, 2, '#d9534f', 22)]);
    for (const [ax, ay, r, es] of [[60, 90, 26, 0], [700, 230, 28, 2], [470, 200, 22, 1]]) el.push([ax + ay, arbre(ax, ay, r, es)]);
    // garage : murs du fond (panneau à outils, fenêtre), établi, étagère garnie, carton, vélo
    const gx = 430, gy = 400, gw = 250;
    let mf = boite(gx, gy - 8, gw, 8, 60, '#c9a77e') + boite(gx - 8, gy, 8, gw, 60, '#b8946a');
    mf += faceAvant(gx + 14, gy - 8, 8, 0, 0, 200, 28, 54, '#8a5a36', 1);
    for (let k = 0; k < 12; k++) mf += faceAvant(gx + 14, gy - 8, 8, 0, 8 + k * 16, 12 + k * 16, 34 + (k % 3) * 4, 48, ['#9aa1a8', '#d9534f', '#3d3d3d', '#ffc94d'][k % 4], 0.5);
    mf += poly(pts([gx + 0.2, gy + 60, 18], [gx + 0.2, gy + 96, 18], [gx + 0.2, gy + 96, 48], [gx + 0.2, gy + 60, 48]), '#bfe6ff', 1.2);
    el.push([gx + 210 + gy + 220, boite(gx + 196, gy + 198, 30, 26, 18, '#d8b07a') + dessus(gx + 196, gy + 198, 18.1, 0, 30, 12, 14, '#a8803a')]);
    el.push([gx + 30 + gy + 220, velo(gx + 30, gy + 200, '#d9534f')]);
    return { plat, fond: mf, el };
  };
  const fixesGarage = (e, cat) => {
    const out = [];
    for (const [bx, by, bw, bh] of cat.etablis.garage) out.push([-5e3, boite(bx, by, bw, bh, 20, '#a8703f', 0, 'url(#i-bois)')]);
    for (const [bx, by, bw, bh] of cat.obstacles.garage) {
      let et = boite(bx, by, 4, bh, 50, '#7a5236') + boite(bx + bw - 4, by, 4, 4, 50, '#7a5236') + boite(bx + bw - 4, by + bh - 4, 4, 4, 50, '#7a5236');
      for (let k = 0; k < 4; k++) {
        et += boite(bx, by, bw, bh, 2, '#a8703f', 2 + k * 15);
        for (let j = 0; j < Math.floor(bh / 26); j++) if ((j + k) % 3 !== 2) et += boite(bx + 6, by + 6 + j * 26, bw - 12, 16, 8, ['#ef6f9a', '#6aa8f0', '#ffc94d', '#7be08a', '#b08af0'][(j + k) % 5], 4 + k * 15);
      }
      out.push([bx + by + bh / 2, et]);
    }
    return out;
  };
  const devantGarage = () => {
    const v = rueVolumes();
    const gx = 430, gy = 400, gw = 250;
    v.push(...murs([[gx + gw, gy, gx + gw, gy + gw], [gx, gy + gw, gx + 50, gy + gw], [gx + 200, gy + gw, gx + gw, gy + gw]], 16, '#c9a77e'));
    v.push([gx + 125 + gy + gw, boite(gx + 50, gy + gw - 2, 150, 4, 4, '#9aa1a8', 12)]);
    v.push([540 + 728, voiture(540, 700, '#4a8ad8', false)], [760 + 420, arbre(760, 420, 22, 0)]);
    v.push([720 + 715, boite(720, 700, 22, 14, 14, '#d9534f', 30) + boite(729, 705, 4, 4, 30, '#3d3d3d')]);
    for (let k = 0; k < 6; k++) v.push([700 + k * 16 + 778, boule(700 + k * 16, 778, 6, 7, '#4fa043')]);
    v.push([300 + 760, personne(300, 760, 0, '#7be08a', '#5a3a22', PEAUX[0], false, 1) + bulle(300, 760, 50, 'Bon courage !')]);
    return v;
  };

  // ---------------------------------------------------------------- rue animée : voitures, bus, passants, nuages (calque animé en CSS)
  // Chaque mobile est un petit SVG posé à son point de départ ; il glisse de (dx, dy) à l'écran, en boucle.
  const mobile = (contenu, x, y, x2, gauche, haut, w, h, duree, retard, classe = '') => {
    const [X, Y] = iso(x, y, 0), [X2, Y2] = iso(x2, y, 0), l = n1(X + gauche), t = n1(Y + haut);
    return `<div class="mobile ${classe}" style="left:${l}px;top:${t}px;--dx:${n1(X2 - X)}px;--dy:${n1(Y2 - Y)}px;--t:${duree}s;--d:${retard}s"><svg viewBox="${l} ${t} ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${contenu}</svg></div>`;
  };
  const OISEAU = '<svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true"><path d="M1 2 Q4 6 7 3 Q10 6 13 2" fill="none" stroke="#2b1d14" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const oiseaux = () => [[-200, 200, 34, -6], [-260, 230, 34, -7.5], [-150, 520, 47, -30]].map(([x, y, t, d]) => {
    const [X, Y] = iso(x, DY + y, 160);
    return `<div class="mobile oiseau" style="left:${n1(X)}px;top:${n1(Y)}px;--dx:1700px;--dy:420px;--t:${t}s;--d:${d}s">${OISEAU}</div>`;
  }).join('');
  const chat = (x, y, x2) => mobile(boite(x, y, 14, 6, 6, '#e8913a', 0) + boite(x + 12, y, 6, 6, 6, '#e8913a', 6) + boite(x - 4, y + 2, 5, 2, 2, '#e8913a', 10)
    + bouton(x + 16, y + 3, 13, 1, T), x, y, x2, -16, -24, 34, 34, 26, -4, 'chat');
  const rue = (e) => {
    const bat = batiment(e);
    if (bat && ETAGE !== 'rdc') {  // aux étages : des nuages et des oiseaux qui passent dans le ciel
      return oiseaux() + [[-300, 260, 70, 90, -20], [-500, 640, 55, 120, -75]].map(([x, y, r, t, d]) => {
        const [X, Y] = iso(x, DY + y, 0);
        return `<div class="mobile nuage" style="left:${n1(X)}px;top:${n1(Y)}px;--dx:1500px;--dy:0px;--t:${t}s;--d:${d}s"><svg width="${n1(r * 3.4)}" height="${n1(r * 1.6)}" viewBox="0 0 ${n1(r * 3.4)} ${n1(r * 1.6)}" aria-hidden="true"><ellipse cx="${n1(r * 1.7)}" cy="${n1(r * 0.8)}" rx="${n1(r * 1.6)}" ry="${n1(r * 0.7)}" fill="#f4f8fb" opacity=".85"/></svg></div>`;
      }).join('');
    }
    const [x0, x1, voie1, voie2, trottoir] = bat ? [-400, 1640, DY + 804, DY + 832, DY + 788] : [0, 804, 835, 857, 822];
    const auto = (y, c, retour, t, d) => mobile(voiture(retour ? x1 : x0, y, c, true, retour), retour ? x1 : x0, y, retour ? x0 : x1, -32, -30, 90, 80, t, d);
    const bus = (y, t, d) => mobile(boite(x0, y, 110, 22, 22, '#2e8b57', 0, null, '#3a9b67') + faceAvant(x0, y, 22, 0, 6, 104, 10, 18, '#bfe6ff', 0.6), x0, y, x1 - 50, -22, -48, 130, 100, t, d);
    const pieton = (c, i, retour, t, d) => mobile(personne(retour ? x1 : x0, trottoir, 0, c, T, PEAUX[i % PEAUX.length], false, i, 'marche'), retour ? x1 : x0, trottoir, retour ? x0 : x1, -16, -50, 32, 58, t, d, 'pieton');
    const v = bat ? 2.4 : 1;  // la rue du bâtiment est plus longue : même vitesse à l'écran
    return oiseaux() + (bat ? chat(-120, DY + 420, 10) : chat(120, 560, 360)) + [pieton('#ef6f9a', 1, false, 38 * v, -5), pieton('#b08af0', 2, true, 44 * v, -27), pieton('#7be08a', 3, false, 52 * v, -40),
      // même vitesse sur une voie, départs décalés : les véhicules ne se rentrent pas dedans
      auto(voie1, '#ffc94d', false, 12 * v, -1), auto(voie1, '#d9534f', false, 12 * v, -5 * v), bus(voie1, 12 * v, -9 * v),
      auto(voie2, '#4a8ad8', true, 14 * v, -3 * v), auto(voie2, '#e8e8e8', true, 14 * v, -10 * v)].join('');
  };

  // Passage ponctuel : un véhicule s'arrête devant le bâtiment puis repart, ou une personne va jusqu'à la porte (et revient, ou entre)
  const camion = (x, y) => boite(x, y, 58, 24, 30, '#f4f4f4', 0, null, '#e8e8e8') + txtIso(x + 29, y + 24, 16, 'PCB EXPRESS', 3.4, '#2f8a3a')
    + boite(x + 58, y + 2, 18, 20, 20, '#2f8a3a') + boite(x + 64, y + 4, 10, 16, 8, '#bfe6ff', 12, '#2f8a3a') + bouton(x + 76, y + 6, 6, 1.6, '#ffe08a') + bouton(x + 76, y + 18, 6, 1.6, '#ffe08a');
  const passage = (e, genre) => {
    const bat = batiment(e);
    if (bat && ETAGE !== 'rdc') return '';
    const [x0, x1, voie, trottoir, porte, seuil] = bat ? [-400, 1640, DY + 804, DY + 788, 636, DY + 744] : [0, 804, 835, 822, 555, 660];
    if (genre === 'camion') {
      const arret = bat ? 300 : 500, [X, Y] = iso(x0, voie, 0), [Xa, Ya] = iso(arret, voie, 0), [X2, Y2] = iso(x1, voie, 0), l = n1(X - 32), t = n1(Y - 40);
      return `<div class="mobile ponctuel camion" style="left:${l}px;top:${t}px;--dx1:${n1(Xa - X)}px;--dy1:${n1(Ya - Y)}px;--dx2:${n1(X2 - X)}px;--dy2:${n1(Y2 - Y)}px;--t:${bat ? 14 : 9}s"><svg viewBox="${l} ${t} 120 90" width="120" height="90" aria-hidden="true">${camion(x0, voie)}</svg></div>`;
    }
    const xs = porte - (bat ? 260 : 220), [X, Y] = iso(xs, trottoir, 0), [Xc, Yc] = iso(porte, trottoir, 0), [Xp, Yp] = iso(porte, seuil, 0), l = n1(X - 16), t = n1(Y - 50);
    const habit = genre === 'client' ? ['#3a4a6a', 3] : ['#ffc94d', 1], colis = genre === 'client' ? boite(xs + 6, trottoir + 2, 6, 2, 6, '#5a3a22', 6) : boite(xs - 6, trottoir + 3, 12, 8, 8, '#c48a52', 10);
    return `<div class="mobile ponctuel ${genre}" style="left:${l}px;top:${t}px;--dx1:${n1(Xc - X)}px;--dy1:${n1(Yc - Y)}px;--dx2:${n1(Xp - X)}px;--dy2:${n1(Yp - Y)}px;--t:${genre === 'client' ? 7 : 8}s"><svg viewBox="${l} ${t} 32 58" width="32" height="58" aria-hidden="true">${personne(xs, trottoir, 0, habit[0], T, PEAUX[habit[1]], false, habit[1], 'marche') + colis}</svg></div>`;
  };
  // Point d'écran (centre du dessus d'un appareil, ou de l'écran d'un poste) : pour y poser un effet animé
  const pointEffet = (o, f, etablis) => {
    if (o.type === 'poste') return iso(o.x + 39, o.y + 9, 34);
    const [rw0, rd0, rh] = REEL[o.type] || [f.w, f.h, 20];
    const z = etablis.some(([ex, ey, ew, eh]) => ex <= o.x && ey <= o.y && o.x + f.w <= ex + ew + 1 && o.y + f.h <= ey + eh + 1) ? 20 : 0;
    return iso(o.x + f.w / 2, o.y + f.h / 2, z + Math.min(rh, 30) + (o.type === 'station' || o.type === 'micro' ? -2 : 2));
  };

  const etiquettes = (e, cat) => (batiment(e) ? etiquettesEtage(e, cat) : etiquette(556, 628, 'Garage') + etiquette(230, 640, 'Maison'));

  // ---------------------------------------------------------------- API utilisée par jeu.js
  const triees = (liste) => liste.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
  const svgEnveloppe = (contenu) => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${contenu}</svg>`;
  const batiment = (e) => e.locaux.includes('bureau');
  const defs = (e) => {
    SAISON = e.saison || 'printemps';
    const [h1, h2] = HERBE[SAISON] || HERBE.printemps;
    return DEFS.replace('fill="#7cc46a"/><circle cx="5" cy="6" r="1.6" fill="#68b357"/><circle cx="16" cy="15" r="1.6" fill="#68b357"/>',
      `fill="${h1}"/><circle cx="5" cy="6" r="1.6" fill="${h2}"/><circle cx="16" cy="15" r="1.6" fill="${h2}"/>`);
  };
  // hauteur d'un rectangle de sol : juste au-dessus de ce qu'il recouvre, en couches distinctes pour la carte graphique
  const coucheSol = (couches, x, y, w, h) => {
    const k = 1 + Math.max(0, ...couches.filter(([a, b, c, d]) => x < a + c && a < x + w && y < b + d && b < y + h).map((q) => q[4]));
    couches.push([x, y, w, h, k]);
    return k;
  };
  return {
    W, H,
    coucheSol, PEAUX, iso, versMonde, empreinte, figure, objet, profondeur,
    // Les volumes (pavés, boules, polygones, personnages…) dessinés pendant f, pour le rendu 3D
    capture: (f) => { CAPT.liste = []; CAPT.dedans = 0; try { f(); return CAPT.liste; } finally { CAPT.liste = null; } },
    // Étage du bâtiment à dessiner (le garage n'a qu'un niveau)
    etage: (k, cat) => { ETAGE = k; DY = k === 'garage' ? 0 : cat.etages[k].y0; },
    // Calque du fond : sol, murs du fond, mobilier fixe
    fond: (e, cat) => {
      const f = batiment(e) ? fondEtage(e, cat) : fondGarage(e, cat);
      return svgEnveloppe(defs(e) + sol(f.plat) + f.fond + triees(f.el));
    },
    // Motifs et dégradés de la saison : chaque dessin rendu à part (rendu.js) les embarque
    defs,
    // Calque de devant : façade basse, extérieur (au-dessus des objets)
    devant: (e, cat) => (SAISON = e.saison || 'printemps') && svgEnveloppe(triees(batiment(e) ? devantEtage(e, cat) : devantGarage())),
    // Noms des pièces et des lieux, écrits en texte net par-dessus le plan
    etiquettes: (e, cat) => svgEnveloppe(etiquettes(e, cat)),
    // Calque animé : voitures, bus et passants dans la rue, nuages aux étages
    rue: (e) => rue(e),
    pointEffet3: (o, f, etablis) => {  // comme pointEffet, en coordonnées du monde [x, y, hauteur], selon le mur du meuble
      const [w, dp] = o.cote === 'o' || o.cote === 'e' ? [f.h, f.w] : [f.w, f.h], rh = (REEL[o.type] || [f.w, f.h, 20])[2];
      const z = etablis.some(([ex, ey, ew, eh]) => ex <= o.x && ey <= o.y && o.x + w <= ex + ew + 1 && o.y + dp <= ey + eh + 1) ? 20 : 0;
      return [o.x + w / 2, o.y + dp / 2, z + Math.min(rh, 30) + (o.type === 'station' || o.type === 'micro' ? -2 : 2)];
    },
    // Chemin d'un personnage sur l'étage affiché : points de passage sans le départ
    trajet,
    // Mobilier fixe à trier avec les objets placés : [profondeur, svg]
    fixes: (e, cat) => (batiment(e) ? fixesEtage(e, cat) : fixesGarage(e, cat)),
    centre: (e) => iso(...(batiment(e) ? (ETAGE === 'r2' ? [880, DY + 360] : [650, DY + 380]) : [556, 524])),
    cadreMoral: (e) => (batiment(e) ? (ETAGE === 'r2' ? [440, DY + 10, 850, 740] : [10, DY + 10, 1280, 740]) : [430, 400, 250, 250]),
  };
})();
