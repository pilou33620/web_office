// Circuit Story — dessin du plan vu de dessus en SVG : décor des deux cartes (garage, bâtiment), objets placés, personnages.
// Pas de filtre de flou (trop lourd sur Raspberry Pi) : ombres décalées et dégradés à la place.
'use strict';

const PLAN = (() => {
  const T = '#2b1d14';
  const n1 = (v) => Math.round(v * 10) / 10;
  const R = (x, y, w, h, f, rx = 0, sw = 0, extra = '') => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${rx}" fill="${f}"${sw ? ` stroke="${T}" stroke-width="${sw}"` : ''} ${extra}/>`;
  const Cc = (x, y, r, f, sw = 0) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${f}"${sw ? ` stroke="${T}" stroke-width="${sw}"` : ''}/>`;
  const L = (x1, y1, x2, y2, c, w = 2) => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const ombre = (x, y, w, h, rx = 4, d = 4) => R(x + d, y + d, w, h, 'rgba(20,14,8,.22)', rx);
  const ombreRonde = (x, y, r, d = 3) => Cc(x + d, y + d, r, 'rgba(20,14,8,.22)');
  const txt = (x, y, s, taille = 12, f = '#f6f4ea', poids = 800, police = 'Nunito, sans-serif') =>
    `<text x="${n1(x)}" y="${n1(y)}" text-anchor="middle" font-family="${police}" font-weight="${poids}" font-size="${taille}" fill="${f}">${s}</text>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const etiquette = (cx, y, texte) => { const l = 6.6 * texte.length + 18; return R(cx - l / 2, y - 11, l, 18, 'rgba(27,33,26,.85)', 9) + txt(cx, y + 2, esc(texte), 11); };

  const DEFS = `<defs>
<pattern id="p-herbe" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#7cc46a"/><circle cx="5" cy="6" r="1.6" fill="#68b357"/><circle cx="16" cy="15" r="1.6" fill="#68b357"/></pattern>
<pattern id="p-parquet" width="40" height="12" patternUnits="userSpaceOnUse"><rect width="40" height="12" fill="#e6b980"/><rect width="40" height="1.5" fill="#cf9f63"/><rect x="18" width="1.5" height="12" fill="#cf9f63"/></pattern>
<pattern id="p-carrelage" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#ece6da"/><rect width="20" height="1.2" fill="#d4ccbc"/><rect width="1.2" height="20" fill="#d4ccbc"/></pattern>
<pattern id="p-chaud" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#f3c9a8"/><rect width="11" height="11" fill="#e8b48e"/><rect x="11" y="11" width="11" height="11" fill="#e8b48e"/></pattern>
<pattern id="p-moquette" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#cdb894"/><circle cx="5" cy="5" r="1" fill="#bba67f"/></pattern>
<pattern id="p-bleue" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#a9c7e8"/><circle cx="5" cy="5" r="1.1" fill="#93b5db"/></pattern>
<pattern id="p-lino" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#e9eef2"/><rect width="30" height="1.2" fill="#d4dde4"/><rect width="1.2" height="30" fill="#d4dde4"/></pattern>
<pattern id="p-vert" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#d3ebe2"/><rect width="24" height="1.2" fill="#b8d8cc"/><rect width="1.2" height="24" fill="#b8d8cc"/></pattern>
<pattern id="p-beton" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#d6d3cc"/><circle cx="6" cy="8" r="1.2" fill="#c2beb5"/><circle cx="18" cy="19" r="1.5" fill="#c2beb5"/></pattern>
<pattern id="p-couloir" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#efe6d2"/><rect width="40" height="1" fill="#e0d5bd"/><rect width="1" height="40" fill="#e0d5bd"/></pattern>
<pattern id="p-hachures" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#9aa39a"/><rect width="5" height="12" fill="#8a938a"/></pattern>
<pattern id="p-pyramides" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#2f3a46"/><path d="M0 0 L7 7 L14 0 M0 14 L7 7 L14 14" stroke="#46566a" stroke-width="2" fill="none"/></pattern>
<pattern id="p-pave" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#cfc8b8"/><rect width="16" height="1" fill="#bdb5a3"/><rect x="8" width="1" height="16" fill="#bdb5a3"/></pattern>
<pattern id="p-tuiles" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#b5543c"/><path d="M0 12 q6 -8 12 0 q6 -8 12 0" fill="none" stroke="#9c4632" stroke-width="2"/></pattern>
<pattern id="p-touches" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#f2f2ea"/><rect width="2" height="2" fill="#d4d4c8"/></pattern>
<linearGradient id="g-bois" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcaa6e"/><stop offset=".55" stop-color="#c48a52"/><stop offset="1" stop-color="#ad7440"/></linearGradient>
<linearGradient id="g-bois-clair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d2a0"/><stop offset="1" stop-color="#d8ad72"/></linearGradient>
<linearGradient id="g-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset=".5" stop-color="#b9c0c7"/><stop offset="1" stop-color="#dfe4e8"/></linearGradient>
<linearGradient id="g-sombre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d6773"/><stop offset="1" stop-color="#36404b"/></linearGradient>
<linearGradient id="g-ecran" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc0f2"/><stop offset="1" stop-color="#3b78b8"/></linearGradient>
<linearGradient id="g-soleil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8" stop-opacity=".55"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
<linearGradient id="g-soleil-d" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff4c8" stop-opacity=".5"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
<linearGradient id="g-soleil-g" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff4c8" stop-opacity=".5"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>
<radialGradient id="g-halo"><stop offset="0" stop-color="#ffe6a0" stop-opacity=".8"/><stop offset=".45" stop-color="#ffd27a" stop-opacity=".3"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
<radialGradient id="g-halo-froid"><stop offset="0" stop-color="#e8f4ff" stop-opacity=".65"/><stop offset="1" stop-color="#e8f4ff" stop-opacity="0"/></radialGradient>
<radialGradient id="g-piece-soir"><stop offset="0" stop-color="#ffd68c" stop-opacity=".55"/><stop offset="1" stop-color="#ffd68c" stop-opacity=".12"/></radialGradient>
<radialGradient id="g-reflet" cx=".3" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>`;

  // ---------------------------------------------------------------- petits éléments
  const chaise = (x, y, c = '#3d3d3d', haut = true) => {
    let s = ombreRonde(x, y, 9);
    for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + k * 2 * Math.PI / 5; s += L(x, y, x + 10 * Math.cos(a), y + 10 * Math.sin(a), '#555'); }
    s += Cc(x, y, 7.5, c, 1.5) + Cc(x - 2, y - 2, 3.5, 'rgba(255,255,255,.18)');
    return s + R(x - 9, y + (haut ? 7 : -12), 18, 5, c, 2.5, 1.5) + R(x - 10, y - 4, 3, 8, c, 1.5, 1) + R(x + 7, y - 4, 3, 8, c, 1.5, 1);
  };
  const PEAUX = ['#f6cfa6', '#eab994', '#c98e5e', '#a86b45', '#f8d8b8', '#7a4a2e'];
  // Personnage vu de dessus, centré en (x, y)
  const perso = (x, y, haut = '#6aa8f0', cheveux = '#5a3a22', style = 0, peau = PEAUX[0], laptop = false) => {
    let s = ombreRonde(x, y + 2, 9, 2);
    s += `<ellipse cx="${x}" cy="${y + 2}" rx="10" ry="6.5" fill="${haut}" stroke="${T}" stroke-width="1.5"/><ellipse cx="${x}" cy="${y + 1}" rx="6" ry="3" fill="rgba(255,255,255,.18)"/>`;
    s += Cc(x - 10, y + 4, 2.6, peau, 1) + Cc(x + 10, y + 4, 2.6, peau, 1);
    if (style === 1) s += `<ellipse cx="${x}" cy="${y - 1}" rx="6.5" ry="7.5" fill="${cheveux}" stroke="${T}" stroke-width="1.2"/>`;
    s += Cc(x, y - 3, 5.2, peau, 1.4);
    const calotte = `<path d="M${x - 5.2} ${y - 3} a5.2 5.2 0 0 1 10.4 0 q-5.2 -2.4 -10.4 0z" fill="${cheveux}"/>`;
    if (style === 0) s += calotte;
    else if (style === 1) s += `<path d="M${x - 5.2} ${y - 3.5} a5.2 5.2 0 0 1 10.4 0 q-5.2 -1.5 -10.4 0z" fill="${cheveux}"/>`;
    else if (style === 2) s += calotte + Cc(x, y - 9.5, 2.8, cheveux, 1);
    else s += `<path d="M${x - 5.2} ${y - 3} a5.2 5.2 0 0 1 10.4 0z" fill="${haut}" stroke="${T}" stroke-width="1"/>` + R(x - 3, y - 2.5, 6, 2.5, haut, 1);
    if (laptop) s += R(x - 7, y + 6, 14, 9, 'url(#g-sombre)', 1.5, 1) + R(x - 5.5, y + 7.5, 11, 5, 'url(#g-ecran)', 1);
    return s;
  };
  // Bureau dans son emprise 76x64 : meuble en haut, chaise en bas (l'employé s'assoit en (x+38, y+46))
  const poste = (x, y, ecran = 'url(#g-ecran)', papier = true, mug = true) => {
    const bx = x + 7, by = y + 2;
    let s = ombre(bx, by, 62, 32, 4, 5) + R(bx, by, 62, 32, 'url(#g-bois)', 4, 2) + R(bx + 2, by + 2, 58, 3, 'rgba(255,255,255,.25)', 2);
    s += `<path d="M${bx + 31} ${by + 8} q8 -8 20 -6" fill="none" stroke="#3d3d3d" stroke-width="1.2"/>` + R(bx + 27, by + 10, 8, 3, '#3d3d3d', 1);
    s += R(bx + 16, by + 4, 30, 7, '#1f2a3a', 2, 1.5) + R(bx + 18, by + 5.5, 26, 4, ecran, 1);
    s += R(bx + 17, by + 20, 22, 6, 'url(#p-touches)', 1.5, 1) + R(bx + 43, by + 19, 9, 7, '#3a4a5e', 2) + Cc(bx + 47.5, by + 22.5, 2, '#e8e8e0');
    if (papier) s += `<rect x="${bx + 4}" y="${by + 9}" width="10" height="13" fill="#ffffff" stroke="#c8c0b0" stroke-width=".8" transform="rotate(-8 ${bx + 9} ${by + 15})"/>`;
    s += mug ? Cc(bx + 56, by + 9, 3.2, '#ef6f9a', 1) + Cc(bx + 56, by + 9, 1.8, '#5a3a22') : Cc(bx + 56, by + 9, 3, '#6a7480', 1);
    return s + chaise(x + 38, y + 48);
  };
  const plante = (x, y, r = 10, espece = 0) => {
    let s = ombreRonde(x, y, r) + Cc(x, y, r * 0.62, '#b5543c', 1.5) + Cc(x, y, r * 0.5, '#5a3a22');
    if (espece === 0) for (const [dx, dy, rr, c] of [[0, 0, 1, '#3e8f33'], [-0.4, -0.3, 0.55, '#4fa043'], [0.35, -0.35, 0.5, '#5cb84c'], [0.3, 0.35, 0.45, '#3e8f33'], [-0.35, 0.35, 0.45, '#6cc45a']]) s += Cc(x + dx * r, y + dy * r, rr * r * 0.8, c, rr === 1 ? 1 : 0);
    else if (espece === 1) for (let k = 0; k < 6; k++) s += `<ellipse cx="${x}" cy="${n1(y - r * 0.55)}" rx="${n1(r * 0.32)}" ry="${n1(r * 0.62)}" fill="${k % 2 ? '#3e8f33' : '#2f7a28'}" stroke="${T}" stroke-width=".8" transform="rotate(${k * 60} ${x} ${y})"/>`;
    else if (espece === 2) for (let k = 0; k < 8; k++) s += `<path d="M${x} ${y} q${n1(r * 0.3)} ${n1(-r * 0.5)} 0 ${n1(-r * 1.1)}" fill="none" stroke="${k % 2 ? '#5cb84c' : '#3e8f33'}" stroke-width="3" stroke-linecap="round" transform="rotate(${k * 45} ${x} ${y})"/>`;
    else s += Cc(x, y, r * 0.55, '#5aa04a', 1.2) + Cc(x - r * 0.35, y - r * 0.2, r * 0.25, '#6cb85a', 1) + Cc(x + r * 0.3, y + r * 0.15, r * 0.2, '#6cb85a', 1) + Cc(x, y - r * 0.1, r * 0.12, '#ff8fb1');
    return s;
  };
  const arbre = (x, y, r = 26, espece = 0) => {
    let s = `<ellipse cx="${x + 8}" cy="${y + 10}" rx="${r}" ry="${n1(r * 0.85)}" fill="rgba(20,14,8,.22)"/>`;
    if (espece === 1) {
      const pts = (ra, rb, d = 0) => Array.from({ length: 16 }, (_, k) => { const rr = k % 2 ? rb : ra, a = k * Math.PI / 8 + d; return `${n1(x + rr * Math.cos(a))},${n1(y + rr * Math.sin(a))}`; }).join(' ');
      return s + `<polygon points="${pts(r, r * 0.6)}" fill="#2f6e3a" stroke="${T}" stroke-width="2"/><polygon points="${pts(r * 0.6, r * 0.35, 0.2)}" fill="#3f8a4a"/>` + Cc(x, y, r * 0.12, '#5aa860');
    }
    s += Cc(x, y, r, '#3e8f33', 2.5) + Cc(x - r * 0.25, y - r * 0.25, r * 0.62, '#4fa043') + Cc(x - r * 0.4, y - r * 0.4, r * 0.3, '#6cc45a') + Cc(x + r * 0.42, y + r * 0.3, r * 0.24, '#2f7a28');
    if (espece === 2) for (let k = 0; k < 11; k++) { const a = k * 2.399, d = r * 0.78 * Math.sqrt((k + 0.5) / 11); s += Cc(x + d * Math.cos(a), y + d * Math.sin(a), 2.2, k % 2 ? '#ffffff' : '#ffb3d1'); }
    return s;
  };
  const haie = (x, y, w, h = 16) => { let s = R(x + 3, y + 4, w, h, 'rgba(20,14,8,.18)', h / 2) + R(x, y, w, h, '#3e8f33', h / 2, 2); for (let k = 0; k < Math.floor(w / 14); k++) s += Cc(x + 8 + k * 14, y + h / 2 - 2, 4, '#5cb84c'); return s; };
  const voiture = (x, y, c, horizontal = false) => horizontal
    ? ombre(x, y, 58, 30, 9) + R(x, y, 58, 30, c, 9, 2) + R(x + 13, y + 4, 12, 22, '#bfe6ff', 3, 1) + R(x + 40, y + 5, 9, 20, '#bfe6ff', 3, 1) + R(x + 27, y + 7, 11, 16, 'url(#g-reflet)', 2) + R(x + 54, y + 4, 3, 5, '#ffe08a', 1) + R(x + 54, y + 21, 3, 5, '#ffe08a', 1)
    : ombre(x, y, 30, 58, 9) + R(x, y, 30, 58, c, 9, 2) + R(x + 4, y + 13, 22, 12, '#bfe6ff', 3, 1) + R(x + 5, y + 40, 20, 9, '#bfe6ff', 3, 1) + R(x + 7, y + 27, 16, 11, 'url(#g-reflet)', 2) + R(x + 4, y + 1, 5, 3, '#ffe08a', 1) + R(x + 21, y + 1, 5, 3, '#ffe08a', 1);
  const poubelle = (x, y) => ombreRonde(x, y, 5) + Cc(x, y, 5, 'url(#g-metal)', 1.3) + Cc(x, y, 3, '#6a7480');
  const cadre = (x, y, w = 18, h = 12, art = 0) => { const c = [['#ffc94d', '#4a8ad8'], ['#ef6f9a', '#7be08a'], ['#b08af0', '#ffe08a']][art % 3]; return R(x, y, w, h, '#7a5236', 1, 1.2) + R(x + 2, y + 2, w - 4, h - 4, c[0]) + Cc(x + w * 0.65, y + h * 0.45, h * 0.22, c[1]) + `<path d="M${x + 2} ${y + h - 2} l${n1(w * 0.3)} ${n1(-h * 0.4)} l${n1(w * 0.3)} ${n1(h * 0.4)}z" fill="#3e8f33"/>`; };
  const horloge = (x, y) => Cc(x, y, 6, '#ffffff', 1.5) + `<path d="M${x} ${y} v-4 M${x} ${y} h3" stroke="${T}" stroke-width="1.2"/>`;
  const lampe = (x, y, r = 5) => Cc(x, y, r + 14, 'url(#g-halo)') + Cc(x, y, r, '#fff2c8', 1.2) + Cc(x, y, r * 0.45, '#ffd27a');
  // Ouverture dans un mur avec battant et arc d'ouverture
  const porte = (x, y, horizontale, o = 36, sens = 1) => {
    const r = o * 0.9;
    if (horizontale) return R(x, y - 4, o, 8, '#e4d7bd') + `<path d="M${x} ${y + sens * r} A${r} ${r} 0 0 ${sens > 0 ? 1 : 0} ${x + r} ${y}" fill="none" stroke="#8a6a4a" stroke-width="1.5" stroke-dasharray="3 2"/>` + L(x, y, x, y + sens * r, '#7a5236', 3);
    return R(x - 4, y, 8, o, '#e4d7bd') + `<path d="M${x + sens * r} ${y} A${r} ${r} 0 0 ${sens > 0 ? 1 : 0} ${x} ${y + r}" fill="none" stroke="#8a6a4a" stroke-width="1.5" stroke-dasharray="3 2"/>` + L(x, y, x + sens * r, y, '#7a5236', 3);
  };

  // ---------------------------------------------------------------- objets placés (emprise w x h en (x, y))
  const appareil = (x, y, w, h, corps, ecran, detail = '') => ombre(x, y, w, h, 5) + R(x, y, w, h, corps, 5, 2) + R(x + 3, y + 3, w - 6, 3, 'rgba(255,255,255,.3)', 2) + (ecran ? R(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.36, ecran, 2, 1) : '') + detail;
  const DESSINS = {
    multi: (x, y, w, h) => appareil(x, y, w, h, '#ffc94d', '#c8e6b0', Cc(x + w / 2, y + h * 0.72, 5, '#3d3d3d', 1) + L(x + w / 2, y + h * 0.72, x + w / 2 + 3, y + h * 0.65, '#ffffff', 1.2)),
    station: (x, y, w, h) => appareil(x, y, w, h, '#3d3d3d', '', Cc(x + w / 2, y + h * 0.35, 6, '#ff6b5a', 1) + L(x + w * 0.3, y + h * 0.75, x + w * 0.85, y + h * 0.9, '#9aa1a8', 2)),
    alim: (x, y, w, h) => appareil(x, y, w, h, '#4a4a4a', '#1a1a1a', txt(x + w / 2, y + h * 0.48, '12.0', 6, '#7be08a') + Cc(x + w * 0.3, y + h * 0.78, 3, '#d9534f') + Cc(x + w * 0.7, y + h * 0.78, 3, '#3d3d3d', 1)),
    micro: (x, y, w, h) => appareil(x, y, w, h, '#d8dde3', '', Cc(x + w / 2, y + h / 2, w * 0.28, '#3a4a5e', 1.5) + Cc(x + w / 2, y + h / 2, w * 0.12, '#8fe0ff')),
    oscillo: (x, y, w, h) => appareil(x, y, w, h, '#e8e8e0', '#1f4a6e', `<path d="M${x + w * 0.18} ${y + h * 0.38} q${w * 0.1} ${-h * 0.12} ${w * 0.2} 0 t${w * 0.2} 0 t${w * 0.2} 0" fill="none" stroke="#7be08a" stroke-width="1.5"/>` + [0, 1, 2, 3].map((k) => Cc(x + w * (0.2 + k * 0.2), y + h * 0.8, 2.2, ['#ffc94d', '#8fe0ff', '#ef6f9a', '#7be08a'][k], 0.8)).join('')),
    sonde: (x, y, w, h) => appareil(x, y, w, h, '#b08af0', '', Cc(x + w * 0.35, y + h * 0.45, 6, 'none', 2) + Cc(x + w * 0.7, y + h * 0.55, 4, 'none', 2)),
    four: (x, y, w, h) => appareil(x, y, w, h, 'url(#g-metal)', '#ff9a4a', R(x + w * 0.15, y + h * 0.66, w * 0.7, h * 0.14, '#5a6a7a', 2) + [0, 1, 2].map((k) => R(x + w * (0.22 + k * 0.2), y + h * 0.3, w * 0.1, h * 0.12, '#2e8b57', 1)).join('')),
    spectre: (x, y, w, h) => appareil(x, y, w, h, '#dfe3e8', '#215a3a', `<path d="M${x + w * 0.18} ${y + h * 0.5} l${w * 0.15} 0 l${w * 0.05} ${-h * 0.2} l${w * 0.05} ${h * 0.2} l${w * 0.3} 0" fill="none" stroke="#ffe08a" stroke-width="1.5"/>` + Cc(x + w * 0.8, y + h * 0.78, 4, '#3d3d3d', 1)),
    fdm: (x, y, w, h) => appareil(x, y, w, h, '#3d3d3d', '', R(x + 6, y + 6, w - 12, h - 12, '#9aa1a8', 3) + R(x + w * 0.35, y + h * 0.35, w * 0.3, h * 0.3, '#ffc94d', 2, 1) + Cc(x + w - 8, y + 8, 4, '#ef6f9a', 1)),
    resine: (x, y, w, h) => appareil(x, y, w, h, '#f4f4f4', '', R(x + 6, y + 6, w - 12, h - 12, 'rgba(255,154,74,.55)', 6, 1) + R(x + w * 0.35, y + h * 0.35, w * 0.3, h * 0.3, '#ff9a4a', 2)),
    cao: (x, y, w, h) => appareil(x, y, w, h, 'url(#g-bois)', '', R(x + 8, y + 4, 30, 14, '#1f2a3a', 2, 1) + R(x + 10, y + 6, 26, 10, 'url(#g-ecran)', 1) + R(x + 44, y + 4, 30, 14, '#1f2a3a', 2, 1) + R(x + 46, y + 6, 26, 10, '#d0955a', 1) + R(x + 30, y + h - 12, 24, 7, 'url(#p-touches)', 1, 1)),
    cnc: (x, y, w, h) => appareil(x, y, w, h, '#8d96a1', '', R(x + 8, y + 8, w - 16, h - 26, '#c9ced4', 5) + R(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.25, '#e8e8e0', 3, 1) + L(x + 8, y + h * 0.42, x + w - 8, y + h * 0.42, '#5a6a7a', 3) + R(x + 8, y + h - 14, 30, 8, '#3d3d3d', 2) + Cc(x + w - 16, y + h - 10, 4, '#d9534f', 1)),
    stlink: (x, y, w, h) => appareil(x, y, w, h, '#4a8ad8', '', Cc(x + w / 2, y + h / 2, 3, '#ffc94d')),
    logique: (x, y, w, h) => appareil(x, y, w, h, '#3d3d3d', '', [0, 1, 2, 3, 4].map((k) => L(x + 6 + k * 5, y + h - 4, x + 6 + k * 5, y + h + 4, ['#d9534f', '#ffc94d', '#7be08a', '#4a8ad8', '#ffffff'][k], 1)).join('') + R(x + 5, y + 5, w - 10, 4, '#7be08a', 1)),
    jlink: (x, y, w, h) => appareil(x, y, w, h, '#2b2b2b', '', Cc(x + w / 2, y + h / 2, 3, '#ff9a4a')),
    ci: (x, y, w, h) => appareil(x, y, w, h, '#2b3442', '', [0, 1, 2].map((k) => R(x + 4, y + 4 + k * 6, w - 8, 4, '#3d4a5c', 1) + Cc(x + w - 7, y + 6 + k * 6, 1.4, k === 1 ? '#ffc94d' : '#7be08a')).join('')),
    banc: (x, y, w, h) => appareil(x, y, w, h, '#6a7d92', '', R(x + 6, y + 5, w * 0.3, h - 10, '#1f4a6e', 2, 1) + [0, 1, 2, 3].map((k) => R(x + w * 0.45 + k * 10, y + 7, 7, h - 14, '#2e8b57', 1)).join('')),
    esd: (x, y, w, h) => appareil(x, y, w, h, '#ffc94d', '', Cc(x + w / 2, y + h / 2, w * 0.25, '#3d3d3d', 1.5) + `<path d="M${x + w / 2 - 3} ${y + h / 2 - 6} l5 6 l-4 0 l5 7" fill="none" stroke="#ffc94d" stroke-width="1.5"/>`),
    chambre: (x, y, w, h) => ombre(x, y, w, h, 8) + R(x, y, w, h, '#5a6a7a', 8, 2.5) + R(x + 8, y + 8, w - 16, h - 22, 'url(#p-pyramides)', 4) + `<path d="M${x + w / 2} ${y + h * 0.35} l-10 28 M${x + w / 2} ${y + h * 0.35} l10 28 M${x + w / 2} ${y + h * 0.35} l0 28" stroke="#ffc94d" stroke-width="3"/>` + Cc(x + w / 2, y + h * 0.33, 5, '#ffc94d', 1.5) + R(x + w - 34, y + h - 12, 24, 6, '#9aa1a8', 2, 1.5),
    pickplace: (x, y, w, h) => appareil(x, y, w, h, '#c9ced4', '', R(x + 6, y + 10, w - 12, h - 40, 'rgba(191,230,255,.6)', 3, 1) + L(x + 8, y + h * 0.35, x + w - 8, y + h * 0.35, '#3d3d3d', 3) + R(x + w * 0.4, y + h * 0.28, 10, 12, '#ffc94d', 2, 1) + [0, 1, 2].map((k) => Cc(x + 12 + k * 16, y + h - 18, 6, ['#ef6f9a', '#6aa8f0', '#7be08a'][k], 1)).join('')),
    rayonx: (x, y, w, h) => appareil(x, y, w, h, '#5a6a7a', '#1a1a1a', `<path d="M${x + w / 2 - 6} ${y + h * 0.3} l12 8 M${x + w / 2 + 6} ${y + h * 0.3} l-12 8" stroke="#7be08a" stroke-width="1.5"/>` + R(x + w / 2 - 10, y + h - 16, 20, 8, '#ffc94d', 2, 1)),
    aoi: (x, y, w, h) => appareil(x, y, w, h, '#e8e8e0', '#4a8ad8', Cc(x + w / 2, y + h * 0.75, 5, '#3d3d3d', 1) + Cc(x + w / 2, y + h * 0.75, 2, '#8fe0ff')),
    plantes: (x, y, w, h) => plante(x + w / 2, y + h / 2, w * 0.42, 0),
    ficus: (x, y, w, h) => plante(x + w / 2, y + h / 2, w * 0.45, 1),
    tableau: (x, y, w, h) => R(x, y, w, h, '#ffffff', 2, 1.5) + `<path d="M${x + 6} ${y + h / 2} q6 -4 10 0 t10 0" fill="none" stroke="#4a8ad8" stroke-width="1.5"/>` + R(x + w - 16, y + 3, 8, h - 6, '#ffe08a', 1),
    cafe: (x, y, w, h) => appareil(x, y, w, h, '#3d3d3d', '', Cc(x + w / 2, y + h * 0.35, 3, '#ff6b5a') + Cc(x + w / 2, y + h * 0.72, 3.5, '#ffffff', 1)),
    fontaine: (x, y, w, h) => ombreRonde(x + w / 2, y + h / 2, w / 2) + Cc(x + w / 2, y + h / 2, w / 2, '#bfe6ff', 1.5) + Cc(x + w / 2, y + h / 2, w / 4, '#4a8ad8'),
    distrib: (x, y, w, h) => appareil(x, y, w, h, '#d9534f', '', R(x + 4, y + 4, w * 0.6, h - 8, 'rgba(191,230,255,.7)', 2, 1) + [0, 1, 2].map((k) => Cc(x + 8 + k * 6, y + h / 2, 2, ['#ffc94d', '#7be08a', '#ef6f9a'][k])).join('')),
    clim: (x, y, w, h) => R(x, y, w, h, '#f4f4f4', 3, 1.5) + [0, 1, 2, 3].map((k) => L(x + 4 + k * (w - 8) / 3, y + h - 3, x + 4 + k * (w - 8) / 3, y + h - 3, '#b8d8e8')).join('') + R(x + 4, y + h - 4, w - 8, 2, '#b8d8e8'),
    biblio: (x, y, w, h) => ombre(x, y, w, h, 2) + R(x, y, w, h, 'url(#g-bois)', 2, 1.5) + Array.from({ length: Math.floor((w - 4) / 6) }, (_, k) => R(x + 3 + k * 6, y + 3, 5, h - 6, ['#ef6f9a', '#6aa8f0', '#ffc94d', '#7be08a', '#b08af0'][k % 5], 0.8)).join(''),
    armoire: (x, y, w, h) => appareil(x, y, w, h, 'url(#g-metal)', '', Array.from({ length: 6 }, (_, k) => R(x + 4 + (k % 3) * ((w - 8) / 3), y + 4 + Math.floor(k / 3) * ((h - 8) / 2), (w - 8) / 3 - 2, (h - 8) / 2 - 2, ['#ef6f9a', '#6aa8f0', '#ffc94d'][k % 3], 1)).join('')),
    imprimante: (x, y, w, h) => appareil(x, y, w, h, 'url(#g-metal)', '', R(x + 4, y + 4, w - 8, 4, '#3d3d3d', 1) + R(x + 6, y - 4, w - 12, 6, '#ffffff', 0.5, 0.6)),
    table: (x, y, w, h) => ombre(x, y, w, h, h / 2) + R(x, y, w, h, 'url(#g-bois-clair)', h / 2, 2) + chaise(x - 6, y + h / 2, '#3d3d3d') + chaise(x + w + 6, y + h / 2, '#3d3d3d'),
    aquarium: (x, y, w, h) => ombre(x, y, w, h, 4) + R(x, y, w, h, '#5ccfc4', 4, 2) + R(x + 3, y + 3, w - 6, h - 6, '#8fe0ff', 3) + `<path d="M${x + w * 0.3} ${y + h / 2} l6 -3 l0 6z" fill="#ff9a4a"/>` + `<path d="M${x + w * 0.65} ${y + h * 0.4} l-5 -2 l0 5z" fill="#ffc94d"/>` + L(x + 6, y + h - 4, x + 6, y + 6, '#2e8b57', 2),
    lampe: (x, y, w) => lampe(x + w / 2, y + w / 2, w * 0.3),
    poster: (x, y, w, h) => cadre(x, y, w, h, 1),
    tapis: (x, y, w, h) => R(x, y, w, h, '#b08af0', 10, 1.5) + R(x + 6, y + 6, w - 12, h - 12, 'none', 6, 0, 'stroke="#d8c0ff" stroke-width="2" stroke-dasharray="4 3"'),
    canape: (x, y, w, h) => ombre(x, y, w, h, 10) + R(x, y, w, h, '#6aa8f0', 10, 2) + R(x + 4, y + 4, w - 8, 10, '#8cc0ff', 5) + R(x + 6, y + 15, (w - 16) / 2, h - 20, '#7ab4f6', 4, 1) + R(x + w / 2 + 2, y + 15, (w - 16) / 2, h - 20, '#7ab4f6', 4, 1),
    babyfoot: (x, y, w, h) => ombre(x, y, w, h, 5) + R(x, y, w, h, '#7a5236', 5, 2) + R(x + 5, y + 5, w - 10, h - 10, '#5cb84c', 3) + [0, 1, 2, 3].map((k) => L(x + 10 + k * (w - 20) / 3, y - 3, x + 10 + k * (w - 20) / 3, y + h + 3, '#9aa1a8', 2)).join('') + Cc(x + w / 2, y + h / 2, 2.5, '#ffffff', 1),
    arcade: (x, y, w, h) => appareil(x, y, w, h, '#3a2a5a', '#7be08a', Cc(x + w * 0.3, y + h * 0.75, 2.5, '#d9534f') + Cc(x + w * 0.6, y + h * 0.75, 2, '#ffc94d') + Cc(x + w * 0.75, y + h * 0.78, 2, '#4a8ad8')),
  };
  const objet = (type, x, y, w, h) => (DESSINS[type] || ((a, b, c, d) => appareil(a, b, c, d, '#9aa1a8', '')))(x, y, w, h);

  // ---------------------------------------------------------------- décor : rue et extérieur commun
  const W = 860, H = 900, BX = 40, BY = 60, B = 600, P = 170, C = 40, I = B - 2 * P - 2 * C;
  const HX = 680, HY = 120, HW = 150, HH = 380;
  const rue = () => {
    let s = R(0, 0, W, H, 'url(#p-herbe)') + R(0, H - 66, W, 50, '#565b60', 0, 3) + `<line x1="0" y1="${H - 41}" x2="${W}" y2="${H - 41}" stroke="#ffe08a" stroke-width="3" stroke-dasharray="20 14"/>`;
    for (let k = 0; k < 6; k++) s += R(BX + B / 2 - 40 + k * 14, H - 62, 8, 42, '#f4f1e8');
    s += R(0, H - 90, W, 24, 'url(#p-pave)');
    for (const lx of [120, 470, 790]) s += `<g class="lum-soir">${Cc(lx, H - 78, 50, 'url(#g-halo)')}</g>` + Cc(lx, H - 78, 6, '#3d3d3d', 1.5) + Cc(lx, H - 78, 3, '#ffe08a');
    for (const mx of [90, 640]) s += Cc(mx, H - 30, 6, '#4a4f54', 1.2);
    return s + voiture(150, H - 62, '#ffc94d', true) + voiture(560, H - 39, '#4a8ad8', true);
  };

  // ---------------------------------------------------------------- carte du garage
  const carteGarage = (e) => {
    let s = rue();
    s += R(40, 120, 780, 7, '#c99a63') + R(40, 120, 7, 680, '#c99a63') + R(813, 120, 7, 680, '#c99a63');
    for (let k = 0; k < 40; k++) s += R(42 + k * 19.5, 116, 4, 14, '#a8703f');
    s += R(80, 312, 320, 380, 'rgba(20,14,8,.22)', 8) + R(70, 300, 320, 380, 'url(#p-tuiles)', 8, 4) + L(70, 490, 390, 490, T, 5);
    s += R(300, 340, 36, 30, '#8a5a36', 3, 2) + R(306, 346, 24, 18, '#3d3d3d', 2);
    s += R(110, 682, 180, 70, 'url(#p-parquet)', 4, 3) + Cc(160, 717, 16, '#f4f1e8', 2) + chaise(136, 717, '#7a5236') + chaise(184, 717, '#7a5236') + etiquette(230, 494, 'Maison');
    s += R(100, 160, 240, 110, '#68b357', 18);
    for (let k = 0; k < 4; k++) { s += R(116 + k * 34, 176, 24, 78, '#8a5a36', 4); for (let j = 0; j < 4; j++) s += Cc(128 + k * 34, 186 + j * 16, 5, '#5cb84c'); }
    s += L(270, 180, 270, 250, T, 3) + L(320, 180, 320, 250, T, 3) + R(266, 176, 58, 6, '#7a5236', 2) + R(286, 210, 18, 8, '#d9534f', 2, 1.5);
    for (const [ax, ay, ar, es] of [[60, 90, 28, 0], [700, 230, 30, 2], [760, 420, 22, 1], [470, 200, 24, 0]]) s += arbre(ax, ay, ar, es);
    // le garage : murs, sol, établi (avec panneau à outils), étagère de composants, carton, vélo
    const gx = 430, gy = 400, gw = 250, gh = 250;
    s += R(gx + 10, gy + 12, gw, gh, 'rgba(20,14,8,.22)', 8) + R(gx, gy, gw, gh, '#6b4a31', 8, 4) + R(gx + 8, gy + 8, gw - 16, gh - 16, 'url(#p-beton)');
    s += ombre(440, 408, 232, 40, 4) + R(440, 408, 232, 40, '#a8703f', 4, 2) + R(442, 410, 228, 5, '#8a5a36', 2);
    for (let k = 0; k < 9; k++) s += R(448 + k * 24, 409, k % 2 ? 4 : 10, 5, ['#9aa1a8', '#d9534f', '#3d3d3d'][k % 3], 1);
    s += ombre(636, 468, 32, 112, 3) + R(636, 468, 32, 112, '#8a5a36', 3, 2);
    ['#ef6f9a', '#6aa8f0', '#ffc94d', '#7be08a', '#b08af0', '#ff9a4a'].forEach((c, k) => { s += R(640, 473 + k * 18, 24, 13, c, 2, 1); });
    s += R(gx + 196, gy + gh - 52, 30, 26, '#d8b07a', 3, 1.5) + L(gx + 196, gy + gh - 39, gx + 226, gy + gh - 39, '#a8803a');
    s += `<g class="soleil"><polygon points="${gx + 50},${gy + 238} ${gx + 200},${gy + 238} ${gx + 220},${gy + 170} ${gx + 30},${gy + 170}" fill="url(#g-soleil)" transform="rotate(180 ${gx + 125} ${gy + 204})"/></g>`;
    s += `<g class="lum-soir">${R(gx + 10, gy + 10, gw - 20, gh - 20, 'url(#g-piece-soir)', 8)}</g>` + lampe(gx + 125, gy + 120, 4);
    s += R(gx + 50, gy + gh - 4, 150, 10, '#9aa1a8', 2, 2) + R(gx + 50, gy + gh + 6, 150, H - 90 - gy - gh - 6, 'url(#p-pave)') + voiture(gx + 110, gy + gh + 50, '#4a8ad8');
    s += R(720, 700, 22, 30, '#d9534f', 4, 2) + R(729, 730, 4, 30, '#3d3d3d') + haie(700, 770, 100);
    return s;
  };

  // ---------------------------------------------------------------- carte du bâtiment
  // Pièces dessinées : clé -> [x, y, w, h (repère du bâtiment), nom, sol, local, porte [x, y, horizontale, sens]]
  const PIECES = {
    atelier: [0, 0, P, P, 'Atelier 3D', 'url(#p-beton)', 'atelier', [P, P - 50, false, -1]],
    plateau: [P, 0, B - 2 * P, P, 'Plateau R&D', 'url(#p-moquette)', 'plateau', [P + (B - 2 * P) / 2 - 18, P, true, -1]],
    cem: [B - P, 0, P, P, 'Labo CEM', 'url(#p-lino)', 'cem', [B - P, P - 50, false, 1]],
    labo: [0, P, P, B - 2 * P, 'Labo élec', 'url(#p-vert)', 'bureau', [P, P + (B - 2 * P) / 2 - 18, false, -1]],
    openspace: [B - P, P, P, B - 2 * P, 'Open space', 'url(#p-bleue)', 'openspace', [B - P, P + (B - 2 * P) / 2 - 18, false, 1]],
    etudes: [0, B - P, P, P, "Bureau d'études", 'url(#p-parquet)', 'bureau', [P, B - P + 14, false, -1]],
    accueil: [P, B - P, B - 2 * P, P, 'Accueil', 'url(#p-carrelage)', 'bureau', [P + (B - 2 * P) / 2 - 18, B - P, true, 1]],
    pause: [B - P, B - P, P, P, 'Salle de pause', 'url(#p-chaud)', 'pause', [B - P, B - P + 14, false, 1]],
    reunion: [P + C, P + C, 110, I, 'Réunion', 'url(#p-parquet)', 'bureau', [P + C, P + C + I / 2 - 18, false, 1]],
    wc: [P + C + 110, P + C, I - 110, 90, 'Sanitaires', 'url(#p-carrelage)', 'bureau', [P + C + 110 + (I - 110) / 2 - 14, P + C + 90, true, -1]],
    serveur: [P + C + 110, P + C + 90, I - 110, I - 90, 'Serveurs', 'url(#p-beton)', 'bureau', [P + C + 110 + (I - 110) / 2 - 14, P + C + 90, true, 1]],
  };
  // Mobilier fixe des pièces sans placement libre (et de la cuisine)
  const FIXES = {
    accueil: (x, y, w, h, e) => {
      let s = R(x + w / 2 - 66, y + 4, 132, 7, '#ffc94d', 2, 1.5) + txt(x + w / 2, y + 22, esc(String(e.entreprise || '').toUpperCase().slice(0, 22)), 10, T, 800, 'Fredoka, sans-serif');
      s += `<path d="M${x + w / 2 - 66} ${y + 70} q66 -40 132 0 l0 16 q-66 -32 -132 0z" fill="#7a5236" stroke="${T}" stroke-width="2"/><path d="M${x + w / 2 - 60} ${y + 72} q60 -34 120 0" fill="none" stroke="#a8703f" stroke-width="3"/>`;
      s += R(x + w / 2 + 14, y + 52, 18, 8, '#1f2a3a', 2, 1) + chaise(x + w / 2, y + 42, '#3d3d3d', false);
      for (const cx of [x + 16, x + w - 92]) s += ombre(cx, y + 100, 76, 26, 10) + R(cx, y + 100, 76, 26, '#6aa8f0', 10, 2) + R(cx + 4, y + 104, 68, 8, '#8cc0ff', 4);
      s += ombre(x + w / 2 - 22, y + 104, 44, 22, 6) + R(x + w / 2 - 22, y + 104, 44, 22, 'url(#g-bois)', 6, 2) + R(x + w / 2 - 14, y + 108, 12, 9, '#ffffff', 1) + R(x + w / 2 + 2, y + 110, 12, 9, '#ef6f9a', 1);
      s += R(x + w / 2 - 28, y + h - 10, 56, 8, '#c0392b', 2) + R(x + 8, y + 36, 40, 50, '#bfe6ff', 4, 2) + R(x + 14, y + 44, 10, 12, '#2e8b57', 1) + R(x + 30, y + 60, 12, 10, '#ffc94d', 1);
      return s + plante(x + 16, y + 18, 9, 0) + plante(x + w - 16, y + 18, 9, 2) + plante(x + w - 16, y + 80, 11, 1) + lampe(x + w / 2 - 50, y + 60, 3) + lampe(x + w / 2 + 50, y + 60, 3);
    },
    reunion: (x, y, w, h) => {
      let s = R(x + 4, y + 4, w - 8, 6, '#1f2a3a', 2, 1) + ombre(x + 24, y + 30, w - 48, h - 60, 26) + R(x + 24, y + 30, w - 48, h - 60, 'url(#g-bois)', 26, 2) + R(x + 30, y + 36, w - 60, h - 72, 'rgba(255,255,255,.12)', 22);
      for (let k = 0; k < 5; k++) s += chaise(x + 12, y + 44 + k * 26) + chaise(x + w - 12, y + 44 + k * 26);
      return s + R(x + w / 2 - 8, y + h / 2 - 6, 16, 12, '#2a3a56', 2);
    },
    wc: (x, y, w, h) => {
      let s = '';
      for (let k = 0; k < 2; k++) s += L(x + 32 + k * 28, y, x + 32 + k * 28, y + 40, T, 3) + `<ellipse cx="${x + 16 + k * 28}" cy="${y + 18}" rx="8" ry="11" fill="#ffffff" stroke="${T}" stroke-width="2"/>` + R(x + 9 + k * 28, y + 2, 14, 5, '#ffffff', 2, 1.5);
      return s + R(x + 4, y + h - 22, w - 8, 16, '#ffffff', 4, 2) + Cc(x + 16, y + h - 14, 4, '#bfe6ff', 1) + Cc(x + 40, y + h - 14, 4, '#bfe6ff', 1);
    },
    serveur: (x, y, w, h) => {
      let s = '';
      for (let k = 0; k < 2; k++) {
        const xx = x + 6 + k * 26;
        s += ombre(xx, y + 8, 22, 54, 3) + R(xx, y + 8, 22, 54, '#2b3442', 3, 2);
        for (let j = 0; j < 6; j++) s += R(xx + 4, y + 13 + j * 8, 14, 5, '#3d4a5c', 1) + Cc(xx + 16, y + 15.5 + j * 8, 1.5, ['#7be08a', '#ffc94d', '#7be08a', '#ff6b5a', '#7be08a', '#7be08a'][j]);
      }
      return s + R(x + 6, y + h - 12, w - 12, 7, '#d8dde3', 2, 1.5);
    },
    pause: (x, y, w) => {
      let s = ombre(x + 2, y + 2, w - 4, 24, 4) + R(x + 2, y + 2, w - 4, 24, '#d8d0c0', 4, 2);
      s += R(x + 8, y + 5, 22, 16, '#9aa1a8', 3, 1) + Cc(x + 19, y + 13, 5, '#bfe6ff', 1) + R(x + 38, y + 4, 16, 18, '#3d3d3d', 3, 1) + Cc(x + 46, y + 10, 2.5, '#ff6b5a');
      s += R(x + 60, y + 4, 22, 16, '#e8e8e0', 3, 1) + R(x + 62, y + 6, 14, 10, '#1f2a3a', 1);
      return s + R(x + w - 30, y + 2, 26, 26, '#f4f4f4', 3, 2) + R(x + w - 26, y + 14, 3, 10, '#9aa1a8');
    },
    labo: (x, y, w, h) => ombre(x, y, 36, h, 5) + R(x, y, 36, h, '#4f93b8', 5, 2) + R(x + 4, y + 4, 28, h - 8, '#5aa0c8', 3),
  };
  const FENETRES = Array.from({ length: 9 }, (_, k) => k);
  const carteBatiment = (e) => {
    const loues = new Set(e.locaux);
    let s = rue();
    // parvis, totem, jardin, parking, vélos, banc, arbres
    s += R(BX + P + 40, BY + B + 8, B - 2 * P - 80, H - 90 - BY - B - 8, 'url(#p-pave)');
    s += R(BX + P + 10, BY + B + 40, 18, 36, '#2b3442', 3, 2) + R(BX + P + 13, BY + B + 44, 12, 22, '#ffc94d', 2);
    s += R(BX + 10, BY + B + 16, P - 10, 104, '#68b357', 24) + haie(BX + 10, BY + B + 16, P - 10);
    for (const [fx, fy, c] of [[BX + 40, BY + B + 70, '#ef6f9a'], [BX + 70, BY + B + 84, '#ffc94d'], [BX + 100, BY + B + 66, '#b08af0']]) s += Cc(fx, fy, 4, c) + Cc(fx + 8, fy + 4, 4, c) + Cc(fx + 2, fy + 9, 4, c);
    s += arbre(BX + 130, BY + B + 90, 20, 2);
    const px = BX + B - P + 30;
    s += R(px, BY + B + 14, W - px - 20, 128, '#6e7378', 6, 3);
    for (let k = 0; k < 9; k++) s += L(px + 10 + k * 36, BY + B + 20, px + 10 + k * 36, BY + B + 74, '#f4f1e8');
    s += R(px + 14, BY + B + 30, 26, 30, '#4a8ad8', 3);
    for (const [k, c] of [[1, '#d9534f'], [2, '#ffc94d'], [4, '#7be08a'], [5, '#e8e8e8'], [7, '#3d3d3d']]) s += voiture(px + 13 + k * 36, BY + B + 18, c);
    s += txt(px + (W - px - 20) / 2, BY + B + 126, 'PARKING', 14, '#f4f1e8', 600, 'Fredoka, sans-serif');
    ['#d9534f', '#4a8ad8', '#ffc94d', '#7be08a'].forEach((c, k) => { s += L(BX + P + 46 + k * 12, BY + B + 120, BX + P + 46 + k * 12, BY + B + 140, c, 3); });
    s += R(BX + B - P - 60, BY + B + 118, 46, 10, '#8a5a36', 3, 1.5) + poubelle(BX + B - P - 70, BY + B + 136);
    for (const jx of [BX + B / 2 - 70, BX + B / 2 + 46]) s += ombre(jx, BY + B + 46, 24, 14, 3) + R(jx, BY + B + 46, 24, 14, '#8a8f94', 3, 1.5) + [0, 1, 2].map((k) => Cc(jx + 5 + k * 7, BY + B + 53, 3, ['#ef6f9a', '#ffc94d', '#b08af0'][k])).join('');
    for (const [ax, ay, ar, es] of [[BX - 6, BY - 30, 30, 1], [W - 36, 40, 26, 1], [BX + B + 30, BY + B - 10, 18, 0], [24, BY + 300, 22, 0]]) s += arbre(ax, ay, ar, es);
    // bâtiment : ombre, murs, couloir
    s += R(BX, BY + 2, B + 20, B + 20, 'rgba(20,14,8,.25)', 12) + R(BX - 10, BY - 10, B + 20, B + 20, '#6b4a31', 12, 3) + R(BX - 6, BY - 6, B + 12, B + 12, '#8a5f3f', 9);
    s += R(BX, BY, B, B, 'url(#p-couloir)');
    for (const [k, [x, y, w, h, nom, sol, local, prt]] of Object.entries(PIECES)) {
      const X = BX + x, Y = BY + y, ouvert = loues.has(local);
      s += R(X + 3, Y + 3, w - 6, h - 6, ouvert ? sol : 'url(#p-hachures)', 0, 0, 'stroke="#4a3424" stroke-width="6"');
      if (!ouvert) continue;
      if (FIXES[k] && k !== 'labo') s += FIXES[k](X + 6, Y + 6, w - 12, h - 12, e);
      const [dx, dy, horiz, sens] = prt;
      s += porte(BX + dx, BY + dy, horiz, k === 'wc' || k === 'serveur' ? 30 : 36, sens);
      // lumière : soleil sous les fenêtres le jour, éclairage chaud le soir
      let soleil = '';
      for (const f of FENETRES) {
        const fx = BX + 22 + f * 64, fy = BY + 22 + f * 64;
        if (y === 0 && X + 6 < fx && fx < X + w - 40) soleil += `<polygon points="${fx},${Y + 4} ${fx + 36},${Y + 4} ${fx + 60},${Y + 74} ${fx + 24},${Y + 74}" fill="url(#g-soleil)"/>`;
        if (x === 0 && Y + 6 < fy && fy < Y + h - 40) soleil += `<polygon points="${X + 4},${fy} ${X + 4},${fy + 36} ${X + 74},${fy + 60} ${X + 74},${fy + 24}" fill="url(#g-soleil-d)"/>`;
        if (x + w === B && Y + 6 < fy && fy < Y + h - 40) soleil += `<polygon points="${X + w - 4},${fy} ${X + w - 4},${fy + 36} ${X + w - 74},${fy + 60} ${X + w - 74},${fy + 24}" fill="url(#g-soleil-g)"/>`;
      }
      s += `<g class="soleil">${soleil}${R(X + 6, Y + 6, w - 12, h - 12, 'url(#g-reflet)')}</g><g class="lum-soir">${R(X + 6, Y + 6, w - 12, h - 12, 'url(#g-piece-soir)', 6)}</g>`;
      if (!['wc', 'serveur', 'cem'].includes(k)) s += y !== 0 ? cadre(X + 12, Y + 6, 16, 10, nom.length) + horloge(k === 'pause' ? X + w / 2 : X + w - 30, Y + 11) : cadre(X + w / 2 - 9, Y + h - 16, 18, 10, nom.length);
      if (e.deco.includes('eclairage')) s += lampe(X + w / 2, Y + h / 2, 3);
      if (e.deco.includes('isolation')) s += R(X + 6, Y + 6, w - 12, h - 12, 'none', 4, 0, 'stroke="#a88cf0" stroke-width="3" stroke-dasharray="8 4"');
    }
    s += FIXES.labo(BX + 8, BY + P + 6, 0, B - 2 * P - 12);
    // couloir : plantes, fontaine, extincteur, panneau d'affichage, portemanteau, sortie, plafonniers
    s += plante(BX + P + 16, BY + P + 16, 9, 1) + plante(BX + B - P - 16, BY + B - P - 16, 9, 0) + plante(BX + B - P - 16, BY + P + 16, 9, 2);
    s += R(BX + P + C + 4, BY + B - P - 30, 18, 22, '#bfe6ff', 4, 1.5) + R(BX + B - P - C - 30, BY + P + 8, 22, 14, '#d9534f', 3, 1.5);
    s += R(BX + B / 2 - 12, BY + B - P - C + 4, 24, 8, '#2e8b57', 2, 1) + txt(BX + B / 2, BY + B - P - C + 10.5, 'SORTIE', 5.5);
    s += R(BX + P + 6, BY + P + C + 60, 6, 40, '#c9a26a', 1, 1) + ['#ffffff', '#ffe08a', '#ffb3d1', '#bfe6ff'].map((c, k) => R(BX + P + 7, BY + P + C + 63 + k * 9, 4, 6, c, 0.5)).join('');
    s += Cc(BX + B - P - 26, BY + B - P - C + 20, 6, '#8a5a36', 1.2) + Cc(BX + B - P - 30, BY + B - P - C + 16, 3, '#d9534f') + Cc(BX + B - P - 22, BY + B - P - C + 17, 3, '#4a8ad8');
    for (const [lx, ly] of [[BX + P + 20, BY + B / 2], [BX + B - P - 20, BY + B / 2], [BX + B / 2, BY + P + 20], [BX + B / 2, BY + B - P - 20]]) s += Cc(lx, ly, 22, 'url(#g-halo-froid)') + Cc(lx, ly, 3, '#ffffff', 0.8);
    // fenêtres et entrée
    for (const f of FENETRES) for (const [fx, fy, fw, fh] of [[BX + 22 + f * 64, BY - 9, 36, 7], [BX - 9, BY + 22 + f * 64, 7, 36], [BX + B + 2, BY + 22 + f * 64, 7, 36]]) s += R(fx, fy, fw, fh, '#bfe6ff', 1, 0, 'stroke="#4a3424" stroke-width="1.5"') + `<g class="lum-soir">${R(fx - 6, fy - 6, fw + 12, fh + 12, 'rgba(255,214,140,.55)', 6)}</g>`;
    s += R(BX + B / 2 - 32, BY + B - 3, 64, 14, '#bfe6ff', 2, 2) + L(BX + B / 2, BY + B - 3, BX + B / 2, BY + B + 11, T, 2) + txt(BX + B / 2, BY + B + 34, 'ENTRÉE', 14, T, 600, 'Fredoka, sans-serif');
    // terrasse (avec la salle de pause)
    if (loues.has('pause')) {
      const tx = BX + B + 16, ty = BY + B - 166;
      s += R(tx + 4, ty + 6, 130, 150, 'rgba(20,14,8,.22)', 8) + R(tx, ty, 130, 150, 'url(#p-parquet)', 8, 3);
      s += Cc(tx + 46, ty + 50, 18, '#f4f1e8', 2) + chaise(tx + 20, ty + 50, '#7a5236') + chaise(tx + 72, ty + 50, '#7a5236') + Cc(tx + 46, ty + 50, 26, 'rgba(255,107,90,.45)', 2) + Cc(tx + 46, ty + 50, 3, T);
      s += plante(tx + 110, ty + 20, 10, 2) + plante(tx + 110, ty + 126, 10, 0) + etiquette(tx + 65, ty + 140, 'Terrasse');
    }
    // hangar de production
    if (loues.has('cms')) {
      s += R(HX + 8, HY + 10, HW, HH, 'rgba(20,14,8,.25)', 8) + R(HX, HY, HW, HH, '#4f5a66', 8, 3) + R(HX + 8, HY + 8, HW - 16, HH - 16, 'url(#p-beton)');
      s += R(752, 128, 16, 364, '#3d3d3d', 3, 1.5);
      for (let k = 0; k < 11; k++) s += R(754, 134 + k * 32, 12, 10, '#2e8b57', 1);
      for (let k = 0; k < 4; k++) s += R(772, 132 + k * 90, 48, 72, '#c48a52', 3, 1.5) + R(776, 136 + k * 90, 40, 30, '#d8b07a', 2) + R(776, 170 + k * 90, 40, 30, '#d8b07a', 2);
      s += R(HX + 30, HY - 4, 90, 10, '#ffc94d', 2, 2) + ombre(HX + 40, HY - 50, 70, 34, 6) + R(HX + 40, HY - 50, 70, 34, '#e8e8e8', 6, 2) + R(HX + 92, HY - 46, 16, 26, '#4a8ad8', 3, 1.5);
      s += R(BX + B + 10, HY + 160, HX - BX - B - 10, 44, 'url(#p-couloir)', 0, 3) + R(BX + B + 10, HY + 160, HX - BX - B - 10, 6, '#bfe6ff');
      s += `<g class="lum-soir">${R(HX + 8, HY + 8, HW - 16, HH - 16, 'rgba(220,235,255,.25)', 6)}</g>`;
    } else {
      s += R(HX, HY, HW, HH, 'url(#p-hachures)', 8, 3, 'stroke-dasharray="10 6"');
    }
    return s;
  };

  // Étiquettes des pièces, dessinées au-dessus des objets
  const etiquettes = (e) => {
    if (!e.locaux.includes('bureau')) return etiquette(556, 632, 'Garage');
    let s = '';
    for (const [k, [x, y, w, h, nom, , local]] of Object.entries(PIECES)) if (e.locaux.includes(local)) s += etiquette(BX + x + w / 2, BY + y + h - 16, nom);
    if (e.locaux.includes('cms')) s += etiquette(HX + HW / 2, HY + HH - 20, 'Ligne de production CMS');
    return s;
  };

  return {
    W, H, DEFS, perso, poste, objet, etiquettes, PEAUX,
    decor: (e) => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DEFS}${e.locaux.includes('bureau') ? carteBatiment(e) : carteGarage(e)}</svg>`,
    // Zone du plan à montrer en premier (recentrage)
    centre: (e) => (e.locaux.includes('bureau') ? [380, 380] : [556, 524]),
    cadreMoral: (e) => (e.locaux.includes('bureau') ? [BX - 10, BY - 10, B + 20, B + 20] : [430, 400, 250, 250]),
  };
})();
