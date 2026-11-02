// Circuit Story — dessin du plan en vue isométrique (façon Game Dev Story), à partir des coordonnées du moteur (vue de dessus).
// Trois calques : fond (sol, murs du fond, mobilier fixe), objets (triés par profondeur), devant (façade basse, extérieur).
// Pas de filtre de flou (trop lourd sur Raspberry Pi) : ombres translucides et dégradés à la place.
'use strict';

const PLAN = (() => {
  const C = Math.cos(Math.PI / 6), S = 0.5, OX = 790, OY = 80, W = 1560, H = 980;
  const T = '#2b1d14';
  const n1 = (v) => Math.round(v * 10) / 10;
  const iso = (x, y, z = 0) => [OX + (x - y) * C, OY + (x + y) * S - z];
  const versMonde = (X, Y) => { const a = (X - OX) / C, b = (Y - OY) / S; return [(b + a) / 2, (b - a) / 2]; };
  const pts = (...p) => p.map((q) => iso(...q).map(n1).join(',')).join(' ');
  const poly = (points, f, sw = 1.2) => `<polygon points="${points}" fill="${f}"${sw ? ` stroke="${T}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nuance = (c, k) => {
    if (!c.startsWith('#')) return c;
    let h = c.slice(1);
    if (h.length === 3) h = [...h].map((ch) => ch + ch).join('');
    return '#' + [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
  };
  // Pavé : face avant (+y, à gauche à l'écran), face droite (+x), dessus
  const boite = (x, y, w, dp, h, c, z = 0, haut = null, face = null, sw = 1.2) =>
    poly(pts([x, y + dp, z], [x + w, y + dp, z], [x + w, y + dp, z + h], [x, y + dp, z + h]), face || nuance(c, 0.82), sw)
    + poly(pts([x + w, y, z], [x + w, y + dp, z], [x + w, y + dp, z + h], [x + w, y, z + h]), nuance(c, 0.64), sw)
    + poly(pts([x, y, z + h], [x + w, y, z + h], [x + w, y + dp, z + h], [x, y + dp, z + h]), haut || nuance(c, 1.08), sw);
  const faceAvant = (x, y, dp, z0, u0, u1, v0, v1, f, sw = 0.8) => poly(pts([x + u0, y + dp + 0.3, z0 + v0], [x + u1, y + dp + 0.3, z0 + v0], [x + u1, y + dp + 0.3, z0 + v1], [x + u0, y + dp + 0.3, z0 + v1]), f, sw);
  const faceDroite = (x, y, w, z0, u0, u1, v0, v1, f, sw = 0.8) => poly(pts([x + w + 0.3, y + u0, z0 + v0], [x + w + 0.3, y + u1, z0 + v0], [x + w + 0.3, y + u1, z0 + v1], [x + w + 0.3, y + u0, z0 + v1]), f, sw);
  const dessus = (x, y, z, u0, u1, v0, v1, f, sw = 0.8) => poly(pts([x + u0, y + v0, z], [x + u1, y + v0, z], [x + u1, y + v1, z], [x + u0, y + v1, z]), f, sw);
  const bouton = (x, y, z, r, f) => { const [X, Y] = iso(x, y, z); return `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${r}" fill="${f}" stroke="${T}" stroke-width=".7"/>`; };
  const cable = (a, b, c = '#3d3d3d', w = 1.3, creux = 6) => { const [x1, y1] = iso(...a), [x2, y2] = iso(...b); return `<path d="M${n1(x1)} ${n1(y1)} Q${n1((x1 + x2) / 2)} ${n1(Math.max(y1, y2) + creux)} ${n1(x2)} ${n1(y2)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`; };
  const reflet = (x, y, w, dp, z) => poly(pts([x, y, z], [x + w, y, z], [x + w, y + dp, z], [x, y + dp, z]), 'url(#i-reflet)', 0);
  const ombre = (x, y, w, dp, d = 4) => poly(pts([x + d, y + d, 0], [x + w + d, y + d, 0], [x + w + d, y + dp + d, 0], [x + d, y + dp + d, 0]), 'rgba(20,14,8,.2)', 0);
  const boule = (x, y, z, r, c) => { const [X, Y] = iso(x, y, z), [, Ys] = iso(x, y, 0); return `<ellipse cx="${n1(X + 3)}" cy="${n1(Ys + 2)}" rx="${n1(r * 1.1)}" ry="${n1(r * 0.55)}" fill="rgba(20,14,8,.18)"/><circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(r)}" fill="${c}" stroke="${T}" stroke-width="1.4"/><circle cx="${n1(X - r * 0.3)}" cy="${n1(Y - r * 0.3)}" r="${n1(r * 0.4)}" fill="rgba(255,255,255,.25)"/>`; };
  const txtIso = (x, y, z, texte, taille, f, police = 'monospace') => { const [X, Y] = iso(x, y, z); return `<text x="${n1(X)}" y="${n1(Y)}" text-anchor="middle" font-family="${police}" font-weight="800" font-size="${taille}" fill="${f}">${texte}</text>`; };
  const boiteBois = (x, y, w, dp, h, z = 0, c = '#c48a52') => {
    let s = boite(x, y, w, dp, h, c, z, 'url(#i-bois)');
    for (let k = 1; k < 3; k++) { const [a, b] = iso(x + 3, y + dp * k / 3, z + h), [c2, d] = iso(x + w - 3, y + dp * k / 3, z + h); s += `<line x1="${n1(a)}" y1="${n1(b)}" x2="${n1(c2)}" y2="${n1(d)}" stroke="#a8703f" stroke-width=".6" opacity=".7"/>`; }
    return s;
  };
  const boiteMetal = (x, y, w, dp, h, c, z = 0, face = null) => boite(x, y, w, dp, h, c, z, null, face) + reflet(x, y, w, dp, z + h);
  const etiquette = (x, y, texte) => { const [X, Y] = iso(x, y, 0), l = 6.4 * texte.length + 16; return `<rect x="${n1(X - l / 2)}" y="${n1(Y - 9)}" width="${n1(l)}" height="17" rx="8.5" fill="rgba(27,33,26,.82)"/><text x="${n1(X)}" y="${n1(Y + 3)}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="10.5" fill="#f6f4ea">${esc(texte)}</text>`; };
  const bulle = (x, y, z, texte, c = '#fff7e6') => { const [X, Y] = iso(x, y, z), l = 6.2 * texte.length + 12; return `<rect x="${n1(X - l / 2)}" y="${n1(Y - 14)}" width="${n1(l)}" height="16" rx="8" fill="${c}" stroke="${T}" stroke-width="1.5"/><text x="${n1(X)}" y="${n1(Y - 2.5)}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="10" fill="${T}">${esc(texte)}</text>`; };
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
<pattern id="i-hachures" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#9aa39a"/><rect width="5" height="12" fill="#8a938a"/></pattern>
<pattern id="i-pyramides" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#2f3a46"/><path d="M0 0 L5 5 L10 0 M0 10 L5 5 L10 10" stroke="#46566a" stroke-width="1.5" fill="none"/></pattern>
<linearGradient id="i-bois" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2b277"/><stop offset=".6" stop-color="#cf9a5e"/><stop offset="1" stop-color="#b8814a"/></linearGradient>
<linearGradient id="i-ecran" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#3b78b8"/></linearGradient>
<radialGradient id="i-reflet" cx=".3" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<radialGradient id="i-halo"><stop offset="0" stop-color="#fff2c0" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c0" stop-opacity="0"/></radialGradient>
<radialGradient id="i-soir"><stop offset="0" stop-color="#ffd68c" stop-opacity=".6"/><stop offset="1" stop-color="#ffd68c" stop-opacity=".15"/></radialGradient>
<linearGradient id="i-soleil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8" stop-opacity=".6"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
<linearGradient id="i-soleil-d" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff4c8" stop-opacity=".55"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
</defs>`;
  // Sol : le plan de dessus projeté par une matrice (motifs de sol réutilisés tels quels)
  const sol = (contenu) => `<g transform="matrix(${n1(C * 1e4) / 1e4},${S},${-n1(C * 1e4) / 1e4},${S},${OX},${OY})">${contenu}</g>`;

  // ---------------------------------------------------------------- personnages
  const PEAUX = ['#f6cfa6', '#eab994', '#c98e5e', '#a86b45', '#f8d8b8', '#7a4a2e'];
  // Personnage en volume posé en (x, y, z) ; pose : debout, marche, telephone, portable ; assis : sur une chaise
  const personne = (x, y, z, haut, cheveux, peau, assis = false, i = 0, pose = 'debout') => {
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
  // Figure seule (calque des personnages) : SVG de 36x56, les pieds en (18, 50)
  const figure = (haut, cheveux, peau, i, assis = false) => {
    const [X0, Y0] = iso(0, 0, 0);
    return `<svg viewBox="-18 -50 36 56" width="36" height="56" aria-hidden="true"><g transform="translate(${n1(-X0)},${n1(-Y0)})">${personne(0, 0, assis ? 4 : 0, haut, cheveux, peau, assis, i)}</g></svg>`;
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
  const arbre = (x, y, r = 22, espece = 0) => {
    if (espece === 1) return boite(x - 3, y - 3, 6, 6, 10, '#7a5236') + boule(x, y, 22, r * 0.9, '#2f6e3a') + boule(x, y, 34, r * 0.65, '#3f8a4a') + boule(x, y, 44, r * 0.4, '#4f9a5a');
    let s = boite(x - 3, y - 3, 6, 6, 18, '#7a5236') + boule(x, y, 30, r, '#3e8f33') + boule(x - r * 0.3, y, 38, r * 0.6, '#4fa043');
    if (espece === 2) for (let k = 0; k < 9; k++) { const a = k * 2.399, d = r * 0.7 * Math.sqrt((k + 0.5) / 9), [X, Y] = iso(x + Math.cos(a) * d, y + Math.sin(a) * d, 34 + (k % 3) * 3); s += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="2" fill="${k % 2 ? '#ffffff' : '#ffb3d1'}"/>`; }
    return s;
  };
  const voiture = (x, y, c, horizontal = true) => {
    const [w, dp] = horizontal ? [56, 28] : [28, 56];
    return ombre(x, y, w, dp) + boite(x, y, w, dp, 10, c) + boite(x + (horizontal ? 14 : 3), y + (horizontal ? 3 : 14), w - (horizontal ? 24 : 6), dp - (horizontal ? 6 : 24), 9, '#bfe6ff', 10, c)
      + bouton(x + (horizontal ? w : 6), y + (horizontal ? 6 : dp), 6, 1.6, '#ffe08a') + bouton(x + (horizontal ? w : 22), y + (horizontal ? 22 : dp), 6, 1.6, '#ffe08a');
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
    v.push([150 + 846, voiture(150, 838, '#ffc94d')], [560 + 860, voiture(560, 856, '#4a8ad8')]);
    v.push([330 + 852, boite(330, 842, 110, 22, 22, '#2e8b57', 0, null, '#3a9b67') + faceAvant(330, 842, 22, 0, 6, 104, 10, 18, '#bfe6ff', 0.6)]);  // bus
    [[240, '#ef6f9a', 'marche', 1], [420, '#6aa8f0', 'telephone', 0], [720, '#b08af0', 'marche', 2]].forEach(([px, c, pose, i]) => v.push([px + 822, personne(px, 822, 0, c, T, PEAUX[i + 1], false, i, pose)]));
    v.push([760 + 810, boite(760, 812, 60, 12, 26, 'rgba(191,230,255,.55)', 0, null, 'rgba(191,230,255,.4)') + boite(764, 816, 52, 4, 6, '#8a5a36')]);  // abribus
    v.push([60 + 816, boite(58, 814, 6, 6, 12, '#d9534f') + bouton(61, 817, 13, 2.5, '#d9534f')]);  // borne incendie
    return v;
  };

  // ---------------------------------------------------------------- carte du bâtiment
  const BX = 40, BY = 60, B = 600, P = 170, C2 = 40, I = B - 2 * P - 2 * C2;
  const SOLS = { atelier: [0, 0, P, P, 'beton', 'atelier'], plateau: [P, 0, B - 2 * P, P, 'moquette', 'plateau'], cem: [B - P, 0, P, P, 'lino', 'cem'],
    labo: [0, P, P, B - 2 * P, 'vert', 'bureau'], openspace: [B - P, P, P, B - 2 * P, 'bleue', 'openspace'], etudes: [0, B - P, P, P, 'parquet', 'bureau'],
    accueil: [P, B - P, B - 2 * P, P, 'carrelage', 'bureau'], pause: [B - P, B - P, P, P, 'chaud', 'pause'], reunion: [P + C2, P + C2, 110, I, 'parquet', 'bureau'],
    wc: [P + C2 + 110, P + C2, I - 110, 90, 'carrelage', 'bureau'], serveur: [P + C2 + 110, P + C2 + 90, I - 110, I - 90, 'beton', 'bureau'] };
  const NOMS = { atelier: 'Atelier 3D', plateau: 'Plateau R&D', cem: 'Labo CEM', labo: 'Labo élec', openspace: 'Open space', etudes: "Bureau d'études",
    accueil: 'Accueil', pause: 'Salle de pause', reunion: 'Réunion', wc: 'Sanitaires', serveur: 'Serveurs' };
  // Portes dans les murs intérieurs (repère du bâtiment) : [x, y, horizontale]
  const PORTES = [[P, P - 50, false], [P + (B - 2 * P) / 2 - 18, P, true], [B - P, P - 50, false], [P, P + (B - 2 * P) / 2 - 18, false], [B - P, P + (B - 2 * P) / 2 - 18, false],
    [P, B - P + 14, false], [P + (B - 2 * P) / 2 - 18, B - P, true], [B - P, B - P + 14, false], [P + C2 + 110, P + C2 + I / 2 - 18, false]];
  const ouvert = (e, local) => e.locaux.includes(local);

  const fondBatiment = (e, cat) => {
    let plat = `<rect x="0" y="0" width="860" height="900" fill="url(#i-herbe)"/>` + rueEtTrottoir();
    plat += `<rect x="${BX + P + 40}" y="${BY + B + 8}" width="${B - 2 * P - 80}" height="${810 - BY - B - 8}" fill="url(#i-pave)"/>`;
    plat += `<rect x="${BX + B - P + 30}" y="${BY + B + 14}" width="330" height="128" rx="6" fill="#6e7378"/>` + Array.from({ length: 9 }, (_, k) => `<rect x="${BX + B - P + 40 + k * 36}" y="${BY + B + 20}" width="2" height="54" fill="#f4f1e8"/>`).join('');
    plat += `<rect x="${BX + B - P + 44}" y="${BY + B + 30}" width="26" height="30" fill="#4a8ad8"/><rect x="${BX + 10}" y="${BY + B + 16}" width="${P - 10}" height="104" rx="24" fill="#68b357"/>`;
    plat += `<rect x="${BX}" y="${BY}" width="${B}" height="${B}" fill="url(#i-couloir)"/>`;
    for (const [k, [x, y, w, h, motif, local]] of Object.entries(SOLS)) {
      const X = BX + x, Y = BY + y;
      if (!ouvert(e, local)) { plat += `<rect x="${X}" y="${Y}" width="${w}" height="${h}" fill="url(#i-hachures)"/>`; continue; }
      plat += `<rect x="${X}" y="${Y}" width="${w}" height="${h}" fill="url(#i-${motif})"/>`;
      let soleil = '';
      for (let f = 0; f < 9; f++) {
        const fx = BX + 18 + f * 64, fy = BY + 18 + f * 64;
        if (y === 0 && X + 4 < fx && fx < X + w - 40) soleil += `<polygon points="${fx},${Y} ${fx + 36},${Y} ${fx + 64},${Y + 80} ${fx + 28},${Y + 80}" fill="url(#i-soleil)"/>`;
        if (x === 0 && Y + 4 < fy && fy < Y + h - 40) soleil += `<polygon points="${X},${fy} ${X},${fy + 36} ${X + 80},${fy + 64} ${X + 80},${fy + 28}" fill="url(#i-soleil-d)"/>`;
      }
      plat += `<g class="soleil">${soleil}<rect x="${X}" y="${Y}" width="${w}" height="${h}" fill="url(#i-reflet)"/></g>`;
      plat += `<circle cx="${X + w / 2}" cy="${Y + h / 2}" r="${Math.round(Math.min(w, h) * 0.45)}" fill="url(#i-halo)"/><g class="lum-soir"><rect x="${X}" y="${Y}" width="${w}" height="${h}" fill="url(#i-soir)"/></g>`;
      if (k === 'accueil') plat += `<rect x="${X + 40}" y="${Y + 92}" width="${w - 80}" height="44" rx="6" fill="#c0392b" opacity=".85"/><rect x="${X + 46}" y="${Y + 98}" width="${w - 92}" height="32" rx="4" fill="none" stroke="#ffc94d" stroke-width="2" stroke-dasharray="6 4"/>`;
    }
    if (ouvert(e, 'pause')) plat += `<rect x="${BX + B + 16}" y="${BY + B - 166}" width="130" height="150" rx="8" fill="url(#i-parquet)"/>`;
    if (ouvert(e, 'cms')) plat += `<rect x="680" y="120" width="150" height="380" fill="url(#i-beton)"/><rect x="${BX + B}" y="280" width="40" height="44" fill="url(#i-couloir)"/>`;
    else plat += `<rect x="680" y="120" width="150" height="380" fill="url(#i-hachures)" opacity=".7"/>`;
    // murs du fond avec fenêtres à stores et décoration
    let fond = murFond(BX, BY, B, 70, '#c9a77e', true) + murFond(BX, BY, B, 70, '#b8946a', false);
    for (let k = 0; k < 8; k++) {
      const u = BX + 58 + k * 64, m = k % 4;
      if (m === 0) fond += faceAvant(u, BY - 8, 8, 0, -1, 12, 34, 46, '#7a5236', 1) + faceAvant(u, BY - 8, 8, 0, 1, 10, 36, 44, ['#ffc94d', '#ef6f9a', '#7be08a'][k % 3], 0.6);
      else if (m === 1) { const [X, Y] = iso(u + 5, BY, 50); fond += `<ellipse cx="${n1(X)}" cy="${n1(Y)}" rx="5" ry="6" fill="#ffffff" stroke="${T}" stroke-width="1.2"/><path d="M${n1(X)} ${n1(Y)} v-4 M${n1(X)} ${n1(Y)} l3 1" stroke="${T}" stroke-width="1"/>`; }
      else if (m === 2) fond += faceAvant(u, BY - 8, 8, 0, -2, 13, 22, 50, '#ffffff', 1) + faceAvant(u, BY - 8, 8, 0, 0, 11, 40, 46, '#4a8ad8', 0) + faceAvant(u, BY - 8, 8, 0, 0, 7, 30, 36, '#ffb3d1', 0);
      else fond += faceAvant(u, BY - 8, 8, 0, 0, 11, 28, 46, '#3d6a8a', 1) + faceAvant(u, BY - 8, 8, 0, 2, 9, 31, 38, '#ffe08a', 0);
      fond += faceAvant(u, BY - 8, 8, 0, 4, 7, 8, 11, '#f4f1e8', 0.5);  // prise électrique
    }
    for (let k = 0; k < 8; k++) {
      const v = BY + 58 + k * 64;
      if (k % 3 === 0) fond += faceDroite(BX - 8, v, 8, 0, -1, 12, 34, 46, '#7a5236', 1) + faceDroite(BX - 8, v, 8, 0, 1, 10, 36, 44, ['#b08af0', '#ffc94d'][k % 2], 0.6);
      else if (k % 3 === 1) fond += faceDroite(BX - 8, v, 8, 0, 0, 11, 28, 46, '#2e8b57', 1) + faceDroite(BX - 8, v, 8, 0, 2, 9, 40, 44, '#ffffff', 0);
    }
    // volumes triés : murs intérieurs (percés de portes), mobilier fixe
    const el = [];
    const segs = [];
    for (const [x, y, w, h] of Object.values(SOLS)) { const X = BX + x, Y = BY + y; segs.push([X + w, Y, X + w, Y + h], [X, Y + h, X + w, Y + h]); }
    const restants = [];
    for (const [x1, y1, x2, y2] of segs) {
      if (x1 === BX + B && x2 === BX + B) continue;
      if (y1 === BY + B && y2 === BY + B) continue;
      const porte = PORTES.find(([px, py, horiz]) => (horiz ? y1 === y2 && Math.abs(BY + py - y1) < 1 && BX + px >= x1 && BX + px + 36 <= x2 : x1 === x2 && Math.abs(BX + px - x1) < 1 && BY + py >= y1 && BY + py + 36 <= y2));
      if (!porte) { restants.push([x1, y1, x2, y2]); continue; }
      const [px, py, horiz] = porte;
      if (horiz) {
        restants.push([x1, y1, BX + px, y1], [BX + px + 36, y1, x2, y1]);
        el.push([BX + px + BY + py + 16, boite(BX + px, BY + py - 1, 2, 30, 26, '#d8c0a0') + boite(BX + px - 2, BY + py - 3, 40, 6, 2, '#a8703f', 30)]);
      } else {
        restants.push([x1, y1, x1, BY + py], [x1, BY + py + 36, x1, y2]);
        el.push([BX + px + BY + py + 16, boite(BX + px - 1, BY + py, 30, 2, 26, '#d8c0a0') + boite(BX + px - 3, BY + py - 2, 6, 40, 2, '#a8703f', 30)]);
      }
    }
    el.push(...murs(restants, 14, '#d8c0a0'));
    // accueil : banque, écran, réceptionniste, canapés, table basse, plantes
    const ax = BX + P, ay = BY + B - P;
    let accueil = ombre(ax + 64, ay + 40, 132, 26) + boite(ax + 64, ay + 40, 132, 26, 22, '#8a5a36', 0, 'url(#i-bois)') + boite(ax + 64, ay + 40, 132, 4, 30, '#7a5236');
    accueil += faceAvant(ax + 64, ay + 40, 26, 0, 40, 92, 8, 16, '#ffc94d', 1) + txtIso(ax + 130, ay + 66, 10.5, esc(String(e.entreprise || '').toUpperCase().slice(0, 14)), 4.2, T);
    accueil += boite(ax + 104, ay + 44, 24, 3, 14, '#1f2a3a', 22, null, 'url(#i-ecran)') + boite(ax + 140, ay + 48, 8, 6, 3, '#3d3d3d', 22) + plantePot(ax + 180, ay + 44, 14, 14, 'plantes');
    el.push([ax + ay + 120, accueil], [ax + ay + 112, personne(ax + 130, ay + 30, 0, '#ef6f9a', '#e0703a', PEAUX[4], true, 1)]);
    for (const cx of [ax + 14, ax + B - 2 * P - 92]) el.push([cx + ay + 160, canape(cx, ay + 100, 76, 26)]);
    el.push([ax + ay + 240, boiteBois(ax + 108, ay + 104, 44, 22, 10, 0, '#c48a52') + dessus(ax + 108, ay + 104, 10.1, 6, 18, 5, 15, '#ffffff') + dessus(ax + 108, ay + 104, 10.2, 24, 36, 7, 15, '#ef6f9a')]);
    el.push([ax + 40 + ay + 118, personne(ax + 40, ay + 118, 6, '#3d3d3d', '#9a9a9a', PEAUX[1], true, 0, 'portable')]);
    el.push([ax + 8 + ay + 140, plantePot(ax + 4, ay + 130, 22, 22, 'ficus')], [ax + B - 2 * P + ay + 130, plantePot(ax + B - 2 * P - 24, ay + 128, 20, 20, 'plantes')]);
    // salle de réunion : table, chaises, écran mural
    const rx = BX + P + C2, ry = BY + P + C2;
    el.push([rx + ry + 2, boite(rx + 20, ry - 2, 70, 3, 26, '#1f2a3a', 20, null, 'url(#i-ecran)')]);
    el.push([rx + ry + 140, ombre(rx + 30, ry + 30, 50, I - 60) + boiteBois(rx + 30, ry + 30, 50, I - 60, 4, 14) + boite(rx + 52, ry + 80, 6, 6, 14, '#7a5236') + dessus(rx + 30, ry + 30, 18.1, 18, 32, 50, 58, '#2a3a56') + dessus(rx + 30, ry + 30, 18.1, 8, 18, 20, 30, '#ffffff')]);
    for (let k = 0; k < 5; k++) {
      el.push([rx + ry + 20 + 44 + k * 26, boite(rx + 10, ry + 40 + k * 26, 12, 12, 8, '#3d3d3d') + boite(rx + 8, ry + 40 + k * 26, 3, 12, 16, '#3d3d3d', 4)]);
      el.push([rx + ry + 100 + 44 + k * 26, boite(rx + 88, ry + 40 + k * 26, 12, 12, 8, '#3d3d3d') + boite(rx + 99, ry + 40 + k * 26, 3, 12, 16, '#3d3d3d', 4)]);
    }
    // serveurs, sanitaires
    const sx = BX + P + C2 + 110, sy = BY + P + C2 + 90;
    for (let k = 0; k < 2; k++) {
      let baie = boite(sx + 6 + k * 26, sy + 8, 22, 22, 50, '#2b3442', 0, '#3d4a5c');
      for (let j = 0; j < 8; j++) baie += faceAvant(sx + 6 + k * 26, sy + 8, 22, 0, 2, 20, 4 + j * 5.5, 8 + j * 5.5, '#3d4a5c', 0.5) + bouton(sx + 24 + k * 26, sy + 30, 6 + j * 5.5, 0.8, ['#7be08a', '#ffc94d', '#7be08a', '#ff6b5a'][j % 4]);
      el.push([sx + sy + 20 + k * 26, baie]);
    }
    const wx = BX + P + C2 + 110, wy = BY + P + C2;
    for (let k = 0; k < 2; k++) el.push([wx + wy + 20 + k * 28, boite(wx + 8 + k * 28, wy + 6, 16, 22, 12, '#ffffff', 0, '#f4f8fb') + boite(wx + 8 + k * 28, wy + 4, 16, 4, 22, '#ffffff')]);
    el.push([wx + wy + 80, boite(wx + 6, wy + 68, 50, 14, 20, '#ffffff') + boite(wx + 14, wy + 70, 10, 8, 2, '#bfe6ff', 20) + boite(wx + 34, wy + 70, 10, 8, 2, '#bfe6ff', 20)]);
    // couloir : fontaine, extincteur, panneau d'affichage, portemanteau, plantes
    el.push([BX + P + C2 + 4 + BY + B - P - 30, boite(BX + P + C2 + 4, BY + B - P - 30, 14, 14, 28, '#e8e8e0') + boite(BX + P + C2 + 5, BY + B - P - 29, 12, 12, 12, '#8fd4ff', 28)]);
    el.push([BX + B - P - C2 - 20 + BY + P + 8, boite(BX + B - P - C2 - 20, BY + P + 6, 6, 6, 18, '#d9534f') + boite(BX + B - P - C2 - 26, BY + P + 4, 20, 3, 10, '#d9534f', 30)]);
    el.push([BX + P + 6 + BY + P + C2 + 80, boite(BX + P + 4, BY + P + C2 + 60, 3, 40, 26, '#c9a26a', 14) + ['#ffffff', '#ffe08a', '#ffb3d1', '#bfe6ff'].map((c, k) => faceDroite(BX + P + 4, BY + P + C2 + 60, 3, 14, 3 + k * 9, 9 + k * 9, 6, 20, c, 0.4)).join('')]);
    el.push([BX + B - P - 26 + BY + B - P - C2 + 20, boite(BX + B - P - 27, BY + B - P - C2 + 19, 2, 2, 40, '#7a5236') + boule(BX + B - P - 30, BY + B - P - C2 + 16, 36, 3, '#d9534f') + boule(BX + B - P - 22, BY + B - P - C2 + 17, 38, 3, '#4a8ad8')]);
    for (const [px, py, es] of [[BX + P + 16, BY + P + 16, 'ficus'], [BX + B - P - 30, BY + P + 4, 'plantes']]) el.push([px + py + 10, plantePot(px - 8, py - 8, 20, 20, es)]);
    // hangar : mur du fond, convoyeur, rayonnages garnis, camion à quai
    if (ouvert(e, 'cms')) {
      fond += boite(680, 112, 150, 8, 60, '#7d8792');
      el.push([700 + 70, boite(710, 66, 70, 34, 26, '#e8e8e8') + boite(762, 70, 16, 26, 22, '#4a8ad8')]);
    }
    return { plat, fond, el };
  };
  // Mobilier fixe des pièces qui reçoivent aussi des objets : trié avec eux par profondeur
  const fixesBatiment = (e, cat) => {
    const out = [];
    for (const [bx, by, bw, bh] of cat.etablis.batiment) out.push([-5e3, boite(bx, by, bw, bh, 20, '#4f93b8', 0, '#5aa0c8') + boite(bx, by, 4, bh, 8, '#4f93b8', 20)]);  // toujours derrière ce qu'on y pose
    const [cuisine, hangar] = cat.obstacles.batiment;
    if (ouvert(e, 'pause')) {
      const [cx, cy, cw, ch] = cuisine;
      let k2 = boite(cx, cy, cw - 30, ch - 6, 22, '#d8d0c0', 0, '#ece6da') + boite(cx + 6, cy + 4, 20, 14, 0.5, '#9aa1a8', 22) + boite(cx + 34, cy + 4, 12, 10, 14, '#3d3d3d', 22);
      k2 += boite(cx + 52, cy + 4, 20, 12, 10, '#e8e8e0', 22, null, '#1f2a3a') + boite(cx + 80, cy + 6, 6, 6, 6, '#ef6f9a', 22) + boite(cx + 92, cy + 6, 8, 5, 7, '#7be08a', 22);
      for (let k = 0; k < 3; k++) k2 += faceAvant(cx, cy, ch - 6, 0, 4 + k * 40, 38 + k * 40, 3, 19, '#c8bea8', 0.6);
      out.push([cx + cy + ch - 30, k2], [cx + cw - 28 + cy, boiteMetal(cx + cw - 28, cy, 28, ch, 46, '#f4f4f4') + faceAvant(cx + cw - 28, cy, ch, 0, 2, 4, 20, 40, '#9aa1a8', 0.5)]);
    }
    if (ouvert(e, 'cms')) {
      const [hx, hy, hw, hh] = hangar;
      for (let k = 0; k < Math.floor(hh / 30); k++) out.push([hx + 8 + hy + k * 30 + 15, boite(hx, hy + k * 30, 16, 30, 10, '#3d3d3d', 0, '#2e8b57') + boite(hx + 2, hy + k * 30 + 10, 12, 10, 3, '#2e8b57', 10)]);  // convoyeur en tronçons
      for (let k = 0; k < Math.floor(hh / 90); k++) {
        let r = boite(hx + 20, hy + 4 + k * 90, hw - 22, 72, 40, '#c48a52');
        for (let j = 0; j < 3; j++) r += boite(hx + 24, hy + 8 + k * 90 + j * 22, hw - 30, 18, 12, '#d8b07a', 6 + (j % 2) * 14);
        out.push([hx + hw / 2 + hy + 40 + k * 90, r]);
      }
    }
    return out;
  };
  const devantBatiment = (e) => {
    const v = rueVolumes();
    v.push(...murs([[BX, BY + B, BX + B / 2 - 34, BY + B], [BX + B / 2 + 34, BY + B, BX + B, BY + B], [BX + B, BY, BX + B, BY + B]], 18, '#c9a77e'));
    v.push([BX + B / 2 + BY + B, boite(BX + B / 2 - 32, BY + B - 2, 2, 4, 30, '#9aa1a8') + boite(BX + B / 2 + 30, BY + B - 2, 2, 4, 30, '#9aa1a8') + boite(BX + B / 2 - 32, BY + B - 2, 64, 4, 3, '#9aa1a8', 30)]);
    if (ouvert(e, 'cms')) v.push(...murs([[830, 120, 830, 500], [680, 500, 830, 500]], 16, '#7d8792'));
    if (ouvert(e, 'pause')) {
      const tx = BX + B + 16, ty = BY + B - 166;
      v.push([tx + ty + 100, boite(tx + 30, ty + 34, 32, 32, 16, '#f4f1e8') + boite(tx + 44, ty + 48, 4, 4, 30, '#9aa1a8', 16) + boule(tx + 46, ty + 50, 50, 26, '#ff8f7a')]);
      v.push([tx + ty + 80, boite(tx + 10, ty + 40, 12, 12, 8, '#7a5236') + boite(tx + 70, ty + 40, 12, 12, 8, '#7a5236')]);
      v.push([tx + 110 + ty + 20, plantePot(tx + 100, ty + 10, 20, 20, 'plantes')], [tx + 110 + ty + 126, plantePot(tx + 100, ty + 116, 20, 20, 'ficus')]);
    }
    // parvis : vélos, banc, jardinières, totem ; parking ; arbres et haie de devant ; un employé qui arrive
    ['#d9534f', '#4a8ad8', '#ffc94d'].forEach((c, k) => v.push([BX + P + 46 + k * 14 + BY + B + 130, velo(BX + P + 46 + k * 14, BY + B + 118, c)]));
    v.push([BX + B - P - 60 + BY + B + 124, boiteBois(BX + B - P - 60, BY + B + 118, 46, 10, 3, 8, '#8a5a36') + boite(BX + B - P - 56, BY + B + 120, 3, 6, 8, '#3d3d3d') + boite(BX + B - P - 22, BY + B + 120, 3, 6, 8, '#3d3d3d')]);
    for (const jx of [BX + B / 2 - 70, BX + B / 2 + 46]) {
      let j = boite(jx, BY + B + 46, 24, 14, 10, '#8a8f94');
      ['#ef6f9a', '#ffc94d', '#b08af0'].forEach((c, k) => { j += boule(jx + 5 + k * 7, BY + B + 53, 13, 3, c); });
      v.push([jx + BY + B + 60, j]);
    }
    v.push([BX + P + 10 + BY + B + 50, boite(BX + P + 10, BY + B + 40, 8, 18, 40, '#2b3442') + faceAvant(BX + P + 10, BY + B + 40, 18, 0, 1, 7, 10, 34, '#ffc94d', 0.6)]);
    [[1, '#d9534f'], [2, '#ffc94d'], [4, '#7be08a'], [5, '#e8e8e8'], [7, '#3d3d3d']].forEach(([k, c]) => v.push([BX + B - P + 43 + k * 36 + BY + B + 58, voiture(BX + B - P + 43 + k * 36, BY + B + 18, c, false)]));
    for (const [ax, ay, r, es] of [[660, 690, 18, 0], [150, 760, 18, 2], [40, 740, 20, 1], [BX + 130, BY + B + 90, 16, 2]]) v.push([ax + ay, arbre(ax, ay, r, es)]);
    for (let k = 0; k < 5; k++) v.push([BX + 20 + k * 30 + BY + B + 18, boule(BX + 20 + k * 30, BY + B + 20, 6, 7, '#4fa043')]);
    return v;
  };

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
    v.push([gx + 125 + gy + gw, boite(gx + 50, gy + gw - 2, 150, 4, 4, '#9aa1a8', 52)]);
    v.push([540 + 728, voiture(540, 700, '#4a8ad8', false)], [760 + 420, arbre(760, 420, 22, 0)]);
    v.push([720 + 715, boite(720, 700, 22, 14, 14, '#d9534f', 30) + boite(729, 705, 4, 4, 30, '#3d3d3d')]);
    for (let k = 0; k < 6; k++) v.push([700 + k * 16 + 778, boule(700 + k * 16, 778, 6, 7, '#4fa043')]);
    v.push([300 + 760, personne(300, 760, 0, '#7be08a', '#5a3a22', PEAUX[0], false, 1) + bulle(300, 760, 50, 'Bon courage !')]);
    return v;
  };

  const etiquettes = (e) => {
    if (!batiment(e)) return etiquette(556, 628, 'Garage') + etiquette(230, 640, 'Maison');
    let s = '';
    for (const [k, [x, y, w, h, , local]] of Object.entries(SOLS)) s += etiquette(BX + x + w / 2, BY + y + h - 14, NOMS[k] + (e.locaux.includes(local) ? '' : ' · à louer'));
    return s + (e.locaux.includes('cms') ? etiquette(755, 480, 'Ligne de production CMS') : '');
  };

  // ---------------------------------------------------------------- API utilisée par jeu.js
  const triees = (liste) => liste.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
  const svgEnveloppe = (contenu) => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${contenu}</svg>`;
  const batiment = (e) => e.locaux.includes('bureau');
  return {
    W, H, PEAUX, iso, versMonde, empreinte, figure, objet, profondeur,
    // Calque du fond : sol, murs du fond, mobilier fixe
    fond: (e, cat) => {
      const f = batiment(e) ? fondBatiment(e, cat) : fondGarage(e, cat);
      return svgEnveloppe(DEFS + sol(f.plat) + f.fond + triees(f.el));
    },
    // Calque de devant : façade basse, extérieur (au-dessus des objets, sous les personnages)
    devant: (e) => svgEnveloppe(triees(batiment(e) ? devantBatiment(e) : devantGarage()) + etiquettes(e)),
    // Mobilier fixe à trier avec les objets placés : [profondeur, svg]
    fixes: (e, cat) => (batiment(e) ? fixesBatiment(e, cat) : fixesGarage(e, cat)),
    centre: (e) => iso(...(batiment(e) ? [380, 380] : [556, 524])),
    cadreMoral: (e) => (batiment(e) ? empreinte(BX - 10, BY - 10, B + 20, B + 20) : empreinte(430, 400, 250, 250)),
  };
})();
