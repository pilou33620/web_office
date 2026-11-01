// Circuit Story — interface web (le moteur tourne côté serveur Python)
'use strict';

const $ = (s) => document.querySelector(s);
const DN = { e: 'Élec', m: 'Méca 3D', f: 'Firmware', c: 'CEM' };
const COURT = { e: 'élec', m: '3D', f: 'fw' };
const DC = { e: '#ffc94d', m: '#f08a6c', f: '#7cc0f2', c: '#b08af0' };
const PIECE = { labo: 'Labo élec', atelier: 'Atelier 3D', bureau: "Bureau d'études", cem: 'Labo CEM' };
const TITRES = { accueil: 'Tableau de bord', projets: 'Projets', equipe: 'Équipe', materiel: 'Matériel', locaux: 'Locaux', journal: 'Journal' };

let ETAT = null, CAT = null;
let onglet = 'accueil', vue = 'bureau', catMat = 'e';
let joue = false, vitesse = 1, minuteur = null, envoi = false;
const cache = {};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';
const dec = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
const tablette = () => window.matchMedia('(min-width: 900px)').matches;

// ---------------------------------------------------------------- plan du bâtiment
// Postes : 0-1 garage, 2-5 bureau agrandi, 6-9 open space
const POSTES = [[34, 96], [147, 96], [260, 96], [34, 182], [147, 182], [260, 182], [26, 690], [108, 690], [26, 790], [108, 790]];
// x, y, l, h, fond, rayon, l. intérieur, h. intérieur, couleur intérieur, rayon intérieur
const POS = {
  multi: [30, 278, 28, 36, '#ffc94d', 6, 16, 9, '#bfe3a8', 2],
  station: [30, 326, 28, 36, '#3d3d3d', 6, 12, 12, '#ff6b5a', 6],
  alim: [28, 374, 32, 32, '#4a4a4a', 6, 20, 7, '#7be08a', 2],
  oscillo: [26, 420, 36, 44, '#e8e8e0', 6, 24, 18, '#1f4a6e', 3],
  micro: [28, 476, 32, 36, '#d8dde3', 16, 14, 14, '#3a4a5e', 7],
  sonde: [30, 526, 28, 30, '#b08af0', 6, 8, 14, '#ffc94d', 3],
  four: [110, 284, 74, 56, '#9aa1a8', 8, 54, 22, '#ff9a4a', 4],
  spectre: [110, 372, 74, 44, '#dfe3e8', 8, 40, 22, '#215a3a', 3],
  fdm: [214, 274, 46, 46, '#3d3d3d', 8, 22, 22, '#ffc94d', 4],
  resine: [270, 276, 38, 42, '#f4f4f4', 9, 24, 24, '#ff9a4a', 6],
  cao: [214, 344, 100, 36, '#d0955a', 6, 58, 10, '#2a3a56', 3],
  cnc: [216, 430, 140, 100, '#8d96a1', 10, 98, 60, '#c9ced4', 5],
  stlink: [30, 34, 20, 20, '#4a8ad8', 5, 6, 6, '#ffc94d', 3],
  logique: [58, 34, 34, 20, '#3d3d3d', 5, 22, 4, '#7be08a', 2],
  jlink: [100, 34, 28, 20, '#2b2b2b', 5, 6, 6, '#ff9a4a', 3],
  ci: [136, 32, 40, 24, '#2b3442', 4, 30, 4, '#7be08a', 2],
  banc: [184, 32, 90, 24, '#6a7d92', 5, 58, 10, '#1f4a6e', 3],
  esd: [220, 816, 40, 40, '#ffc94d', 8, 16, 16, '#3d3d3d', 8],
  chambre: [214, 648, 144, 130, '#5a6a7a', 10, 120, 104, 'repeating-conic-gradient(#2f3a46 0 25%, #46566a 0 50%) 0 0/16px 16px', 6],
};
const DECO_POS = {
  plantes: [[340, 196, 30, 30, 'plante'], [156, 586, 28, 28, 'plante'], [336, 586, 30, 30, 'plante']],
  tableau: [[294, 32, 68, 24, '#ffffff', 4, 44, 4, '#4a8ad8', 2]],
  cafe: [[346, 64, 20, 28, '#3d3d3d', 5, 6, 6, '#ff6b5a', 3]],
  clim: [[60, 19, 44, 12, '#f4f4f4', 4, 34, 3, '#b8d8e8', 2], [250, 19, 44, 12, '#f4f4f4', 4, 34, 3, '#b8d8e8', 2]],
  canape: [[24, 852, 84, 38, '#6aa8f0', 10, 70, 16, '#8cc0ff', 6]],
  babyfoot: [[120, 846, 62, 48, '#7a5236', 6, 48, 34, '#5cb84c', 3]],
  eclairage: [[96, 142, 14, 14, 'lampe'], [210, 142, 14, 14, 'lampe'], [322, 142, 14, 14, 'lampe'], [120, 470, 14, 14, 'lampe'], [280, 400, 14, 14, 'lampe'], [96, 760, 14, 14, 'lampe']],
  isolation: [[19, 66, 7, 150, '#8a6bd1', 3, 3, 130, '#a88cf0', 2], [364, 66, 7, 150, '#8a6bd1', 3, 3, 130, '#a88cf0', 2], [19, 660, 7, 200, '#8a6bd1', 3, 3, 180, '#a88cf0', 2]],
};
// Emplacements debout (coin haut-gauche du personnage) par pièce
const SPOTS = {
  labo: [[72, 284], [72, 352], [72, 424], [116, 440], [146, 500], [72, 500]],
  atelier: [[262, 322], [318, 326], [232, 386], [300, 390], [240, 540], [300, 540]],
  cem: [[228, 782], [290, 786], [322, 830], [250, 836]],
  pause: [[236, 926], [276, 932], [316, 926], [256, 960], [300, 958], [196, 944]],
  reunion: [[56, 918], [152, 918], [56, 954], [152, 954], [104, 900], [104, 972], [196, 934], [18, 936], [196, 966], [18, 966]],
};
const PAROLES = ['Pause !', 'Bla bla', 'Ha ha !', 'Un café ?', 'Et ton week-end ?'];
const PIECES_VERROU = {
  atelier: [197, 258, 175, 364],
  openspace: [18, 628, 175, 274],
  cem: [197, 628, 175, 274],
};

function construireStatique() {
  const haie = Array.from({ length: 28 }, (_, i) =>
    `<div class="a" style="left:${i * 14 - 2}px;top:${i % 2 ? 1 : 3}px;width:17px;height:17px;border-radius:50%;border:2px solid #24401f;background:${i % 3 ? '#4fa043' : '#5cb84c'}"></div>`).join('');
  $('#statique').innerHTML = haie + `
    <div class="a" style="left:-4px;top:1010px;width:398px;height:30px;background:#5d6266;border-top:3px solid #2b1d14;border-bottom:3px solid #2b1d14"></div>
    <div class="a" style="left:0;top:1023px;width:390px;height:3px;background:repeating-linear-gradient(90deg,#ffe08a 0 18px,transparent 18px 30px)"></div>
    <div class="a ol" style="left:14px;top:914px;width:362px;height:90px;border-radius:10px;background:repeating-linear-gradient(0deg,#c99a63 0 13px,#b8884f 13px 15px);box-shadow:0 4px 0 rgba(0,0,0,.2)"></div>
    <div class="a ol" style="left:92px;top:938px;width:56px;height:40px;border-radius:50%;background:#f4f1e8;box-shadow:0 4px 0 rgba(0,0,0,.25)"></div>
    <div class="a ol" style="left:226px;top:984px;width:120px;height:14px;border-radius:6px;background:#7a5236"></div>
    <div class="a ol" style="left:340px;top:924px;width:26px;height:26px;border-radius:50%;background:#5cb84c;box-shadow:inset -4px -4px 0 #3e8f33"></div>
    <div class="etiq-piece" style="left:24px;top:984px">Terrasse</div>
    <div class="a" style="left:10px;top:18px;width:370px;height:892px;border:3px solid #2b1d14;border-radius:12px;background:#7a5236;box-shadow:0 8px 0 rgba(0,0,0,.22)"></div>
    <div class="piece" style="left:18px;top:26px;width:354px;height:226px;background:repeating-linear-gradient(90deg,#efc488 0 16px,#e2b277 16px 18px)"></div>
    <div class="piece" style="left:18px;top:258px;width:175px;height:364px;background-color:#d3ebe2;background-image:linear-gradient(#b8d8cc 2px,transparent 2px),linear-gradient(90deg,#b8d8cc 2px,transparent 2px);background-size:24px 24px"></div>
    <div class="piece" style="left:197px;top:258px;width:175px;height:364px;background-color:#ddd5c6;background-image:radial-gradient(#cbc2b1 2px,transparent 2.5px);background-size:16px 16px"></div>
    <div class="piece" style="left:18px;top:628px;width:175px;height:274px;background-color:#a9c7e8;background-image:radial-gradient(#97b8dc 3px,transparent 3.5px);background-size:20px 20px"></div>
    <div class="piece" style="left:197px;top:628px;width:175px;height:274px;background-color:#e9eef2;background-image:linear-gradient(#d4dde4 2px,transparent 2px),linear-gradient(90deg,#d4dde4 2px,transparent 2px);background-size:30px 30px"></div>
    <div class="a" style="left:90px;top:248px;width:34px;height:14px;background:#e2b277"></div>
    <div class="a" style="left:270px;top:248px;width:34px;height:14px;background:#e2b277"></div>
    <div class="a" style="left:189px;top:420px;width:12px;height:34px;background:#d3ebe2"></div>
    <div class="a" style="left:64px;top:618px;width:32px;height:14px;background:#d3ebe2"></div>
    <div class="a" style="left:270px;top:618px;width:32px;height:14px;background:#ddd5c6"></div>
    <div class="a" style="left:64px;top:898px;width:32px;height:14px;background:#a9c7e8"></div>
    <div class="a ol" style="left:24px;top:31px;width:342px;height:26px;border-radius:7px;background:#a8703f;box-shadow:inset 0 -5px 0 #8a5a30,0 3px 0 rgba(0,0,0,.2)"></div>
    <div class="a ol" style="left:23px;top:266px;width:44px;height:348px;border-radius:7px;background:#4f93b8;box-shadow:inset -5px 0 0 #3b7596"></div>
    <div class="etiq-piece" style="left:24px;top:230px">Bureau d'études</div>
    <div class="etiq-piece" style="left:72px;top:596px">Labo élec</div>
    <div class="etiq-piece" style="left:204px;top:596px">Atelier 3D</div>
    <div class="etiq-piece" style="left:24px;top:878px">Open space</div>
    <div class="etiq-piece" style="left:204px;top:878px">Labo CEM</div>`;
}

function objet(p, cls = '') {
  if (p[4] === 'lampe') return `<div class="a" style="left:${p[0]}px;top:${p[1]}px;width:${p[2]}px;height:${p[3]}px;border-radius:50%;border:2px solid #2b1d14;background:#fff3a0;box-shadow:0 0 0 8px rgba(255,240,150,.35),0 0 0 18px rgba(255,240,150,.15);z-index:5"></div>`;
  if (p[4] === 'plante') return `<div class="objet plante ${cls}" style="left:${p[0]}px;top:${p[1]}px;width:${p[2]}px;height:${p[3]}px"><i></i></div>`;
  return `<div class="objet ${cls}" style="left:${p[0]}px;top:${p[1]}px;width:${p[2]}px;height:${p[3]}px;background:${p[4]};border-radius:${p[5]}px"><i style="width:${p[6]}px;height:${p[7]}px;background:${p[8]};border-radius:${p[9]}px"></i></div>`;
}

function corps(x) {
  const triste = (x.moral ?? 70) < 45;
  return `<div class="anim"><div class="corps" style="background:${esc(x.couleur)}"></div>` +
    `<div class="tete" style="background:${esc(x.peau)}"><i class="oeil g"></i><i class="oeil d"></i><i class="bouche${triste ? ' triste' : ''}"></i></div>` +
    `<div class="cheveux" style="background:${esc(x.cheveux)}"></div></div>`;
}
const sprite = (x) => `<div class="perso">${corps(x)}</div>`;

// Personnages : éléments conservés d'un jour à l'autre pour animer leurs déplacements
const PERSOS = {};
function rendrePersos() {
  const e = ETAT, p = e.projet, cont = $('#persos'), vus = new Set(), groupes = {};
  const duree = Math.min(0.9, 0.7 / vitesse);
  for (const emp of e.employes) {
    if (emp.absent) continue;
    const lieu = SPOTS[emp.lieu] ? emp.lieu : 'bureau';
    let x, y;
    if (lieu === 'bureau') { const [dx, dy] = POSTES[emp.bureau]; x = dx + 21; y = dy - 34; }
    else { const g = groupes[lieu] = (groupes[lieu] || 0) + 1; [x, y] = SPOTS[lieu][(g - 1) % SPOTS[lieu].length]; }
    let t = '', c = '';
    if (vue === 'moral') { t = emp.moral + ' %'; c = emp.moral >= 70 ? '#7be08a' : emp.moral >= 50 ? '#ffc94d' : '#ff8a7a'; }
    else if (joue && lieu === 'reunion') { t = 'Réunion'; c = '#fff7e6'; }
    else if (joue && p && 'emf'.includes(emp.tache || '_')) { t = `+${dec(emp.gain)} ${COURT[emp.tache]}`; c = DC[emp.tache]; }
    else if (joue && p && emp.tache === 'debug') { t = `−${dec(emp.gain)} bug`; c = '#ffb3a8'; }
    else if (joue && p && emp.tache === 'cem') { t = 'CEM…'; c = DC.c; }
    else if (joue && lieu === 'pause') { t = PAROLES[(emp.id + e.jours_total) % PAROLES.length]; c = '#fff7e6'; }
    else if (joue && !p) { t = 'zzz'; c = '#e8e8e8'; }
    const html = corps(emp) + (t ? `<div class="bulle" style="background:${c}">${esc(t)}</div>` : '');
    let el = PERSOS[emp.id];
    if (!el) {
      el = PERSOS[emp.id] = document.createElement('div');
      el.className = 'perso';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el._x = x; el._y = y;
      cont.appendChild(el);
    }
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.style.transitionDuration = duree + 's';
    if (el._x !== x || el._y !== y) {
      el._x = x; el._y = y;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.classList.add('marche');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('marche'), duree * 1000);
    }
    const assis = lieu === 'bureau';
    el.style.zIndex = assis ? 2 : 4;
    const travaille = joue && p && (assis || lieu === 'labo' || lieu === 'atelier' || lieu === 'cem') && emp.tache;
    el.classList.toggle('bob', !!travaille && emp.id % 2 === 0);
    el.classList.toggle('bob2', !!travaille && emp.id % 2 === 1);
    vus.add(String(emp.id));
  }
  for (const id of Object.keys(PERSOS)) if (!vus.has(id)) { PERSOS[id].remove(); delete PERSOS[id]; }
}

function rendreMonde() {
  const e = ETAT, h = [];
  const p = e.projet;
  for (const id of e.materiel) if (POS[id]) h.push(objet(POS[id], id in e.pannes ? 'panne' : ''));
  for (const id of e.deco) for (const part of DECO_POS[id] || []) h.push(objet(part));
  for (const [lid, [x, y, w, hh]] of Object.entries(PIECES_VERROU)) {
    if (e.locaux.includes(lid)) continue;
    const l = CAT.locaux[lid];
    const bloque = e.renommee < l.rep;
    h.push(`<div class="verrou" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px">
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#fff7e6" stroke-width="2.4"/><rect x="5" y="11" width="14" height="10" rx="2.5" fill="#ffc94d" stroke="#2b1d14" stroke-width="1.8"/></svg>
      <b>${esc(l.nom)}</b><small>${bloque ? `Renommée ${l.rep} requise` : 'Local à louer'}</small>
      <button type="button" class="btn petit" data-act="local" data-id="${lid}" ${bloque || e.argent < l.prix ? 'disabled' : ''}>Louer · ${eur(l.prix)}</button></div>`);
  }
  const occupes = {};
  for (const x of e.employes) occupes[x.bureau] = x;
  POSTES.forEach(([x, y], i) => {
    if (!e.postes_ouverts.includes(i)) {
      if (i < 6) h.push(`<button type="button" class="poste-libre" style="left:${x}px;top:${y - 22}px" data-act="onglet" data-id="locaux" aria-label="Poste verrouillé : agrandir le bureau"></button>`);
      return;
    }
    if (e.deco.includes('sieges')) h.push(`<div class="a" style="left:${x + 18}px;top:${y - 22}px;width:40px;height:30px;border:2.5px solid #2b1d14;border-radius:12px 12px 4px 4px;background:#3a5a8a;z-index:1"></div>`);
  });
  POSTES.forEach(([x, y], i) => {
    if (!e.postes_ouverts.includes(i)) return;
    const emp = occupes[i];
    const travaille = emp && !emp.absent && (emp.lieu || 'bureau') === 'bureau' && joue && p;
    const ecran = !emp ? '#2b3442' : travaille ? '#8fe0ff' : '#5a7a9a';
    const nom = !emp ? 'Libre' : emp.absent ? (emp.formation ? 'En formation' : 'En congés') : emp.nom;
    if (emp && !emp.absent) emp.lieu = emp.lieu || 'bureau';
    h.push(`<div class="bureau-meuble" style="left:${x}px;top:${y}px"><div class="ecran"><i style="background:${ecran}"></i></div><div class="clavier"></div><div class="nom">${esc(nom)}</div></div>`);
  });
  if (vue === 'prod') {
    const b = e.bonus;
    h.push(`<div class="puce-prod" style="left:186px;top:226px;background:${DC.f}">Firmware +${b.f * 10} %</div>`);
    h.push(`<div class="puce-prod" style="left:72px;top:556px;background:${DC.e}">Élec +${b.e * 10} %</div>`);
    if (e.locaux.includes('atelier')) h.push(`<div class="puce-prod" style="left:232px;top:556px;background:${DC.m}">Méca 3D +${b.m * 10} %</div>`);
    h.push(`<div class="puce-prod" style="left:214px;top:842px;background:${DC.c}">CEM +${Math.round(b.cem * 100)} %</div>`);
  }
  if (vue === 'moral') {
    const t = e.moral >= 70 ? '123,224,138' : e.moral >= 55 ? '255,201,77' : '255,138,122';
    h.push(`<div class="a" style="left:10px;top:18px;width:370px;height:892px;border-radius:12px;background:rgba(${t},.25);pointer-events:none"></div>`);
  }
  majHtml('#dyn', h.join(''));
  rendrePersos();
}

// ---------------------------------------------------------------- panneaux
const ligne = (o) => `<div class="ligne">${o.avatar || `<div class="pastille" style="background:${o.couleur || '#3a4535'}"></div>`}
  <div class="txt"><div class="t1">${o.t1}</div>${o.t2 ? `<div class="t2">${o.t2}</div>` : ''}${o.t3 ? `<div class="t3">${o.t3}</div>` : ''}${o.extra || ''}</div>${o.btn || ''}</div>`;
const bouton = (act, id, texte, actif = true, cls = '', attrs = '') => `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${esc(id)}" ${attrs} ${actif ? '' : 'disabled'}>${esc(texte)}</button>`;
const repartition = (t) => `Élec ${t.e} · Méca ${t.m} · Firmware ${t.f}`;
const barre = (label, fait, besoin, couleur) => `<div class="barre-l"><span>${label}</span><div class="jauge"><i style="width:${Math.min(100, Math.round(100 * fait / Math.max(1, besoin)))}%;background:${couleur}"></i></div><span>${Math.floor(fait)} / ${besoin}</span></div>`;
const couleurNote = (n) => (n >= 7.5 ? '#7be08a' : n >= 5.5 ? '#ffc94d' : '#ff8a7a');

function etapeProjet(p) {
  if (p.etape === 'debug') return `Debug · ${dec(p.defauts)} défauts`;
  if (p.etape === 'cem') return `Tests CEM (${p.cem_jours} j)`;
  return p.phases[p.phase].nom;
}

function panneauProjets() {
  const e = ETAT, p = e.projet;
  let h = '';
  if (p) {
    const etapes = p.phases.map((_, i) => `<span class="${i < p.phase || p.etape !== 'travail' ? 'ok' : i === p.phase ? 'cours' : ''}"></span>`).join('') +
      `<span class="${p.etape === 'cem' ? 'cours' : ''}" title="Tests CEM"></span>`;
    const ph = p.phases[p.phase];
    h += `<div class="encart"><div class="t2" style="font-size:11px;font-weight:800;letter-spacing:1px;color:#a9b39a">EN COURS · ${p.type === 'contrat' ? esc(p.client).toUpperCase() : 'PRODUIT MAISON'}</div>
      <h3>${esc(p.nom)}</h3><div class="etapes">${etapes}</div>
      <div class="chips"><span class="chip">${esc(etapeProjet(p))}</span>${p.type === 'contrat' ? `<span class="chip" style="${p.jours > p.delai ? 'background:#ff8a7a;color:#2b1d14' : ''}">Jour ${p.jours} / ${p.delai}</span>` : `<span class="chip">Jour ${p.jours}</span>`}
      <span class="chip" style="background:${couleurNote(p.note_estimee)};color:#2b1d14">Note estimée ${dec(p.note_estimee)}</span><span class="chip">${dec(p.defauts)} défauts</span></div>
      ${p.etape === 'travail' ? `<div class="barres">${Object.keys(ph.besoin).map((d) => barre(DN[d], ph.fait[d], ph.besoin[d], DC[d])).join('')}</div>` : ''}
      <div class="t2" style="font-size:13px;color:#b3bca5">Tests CEM : ${Math.round(p.proba_cem * 100)} % de réussite${p.frais_cem ? ` · labo externe ${eur(p.frais_cem)}` : ' · labo interne gratuit'}</div>
      <div class="btns">${p.etape === 'debug' ? bouton('tests_cem', '', 'Passer aux tests CEM') : ''}${bouton('abandonner', '', 'Abandonner', true, 'secondaire petit')}</div></div>`;
  }
  h += `<div class="section">Appels d'offres</div>`;
  h += e.offres.length ? e.offres.map((o) => ligne({
    couleur: '#7be08a', t1: esc(o.nom), t2: `${esc(o.client)} · ${eur(o.paie)} · ${o.delai} j`,
    t3: `${repartition(o.total)} · expire dans ${o.expire} j`, btn: bouton('signer', o.id, p ? 'Occupé' : 'Signer', !p),
  })).join('') : '<div class="vide">Aucune offre pour le moment, patientez quelques jours.</div>';
  h += `<div class="section">Produits maison</div>`;
  h += CAT.produits.map((x) => {
    const bloque = e.renommee < x.rep_min;
    const total = { e: Math.round(x.taille * x.rep[0]), m: Math.round(x.taille * x.rep[1]), f: Math.round(x.taille * x.rep[2]) };
    return ligne({
      couleur: '#b08af0', t1: esc(x.nom), t2: `Prototype ${eur(x.cout)} · jusqu'à ~${eur(x.potentiel * 2)}/mois`, t3: repartition(total),
      btn: bouton('produit', x.id, bloque ? `★ ${x.rep_min} requis` : p ? 'Occupé' : 'Lancer', !bloque && !p && e.argent >= x.cout),
    });
  }).join('');
  if (e.produits.length) {
    h += `<div class="section">En vente</div>` + e.produits.map((x) => ligne({
      couleur: couleurNote(x.note), t1: esc(x.nom), t2: `Note ${dec(x.note)}/10 · ${eur(x.ventes)} le mois prochain`, t3: `Total encaissé ${eur(x.total)}`,
    })).join('');
  }
  if (e.historique.length) {
    h += `<div class="section">Historique</div>` + e.historique.slice(0, 12).map((x) => ligne({
      couleur: couleurNote(x.note), t1: esc(x.nom), t2: `${esc(x.client)} · ${x.jours} j${x.montant ? ' · ' + eur(x.montant) : ''}`, t3: `${dec(x.note)}/10 — ${esc(x.avis)}`,
    })).join('');
  }
  return h;
}

function panneauEquipe() {
  const e = ETAT;
  const libres = e.postes_ouverts.length - e.employes.length;
  let h = `<div class="section">Équipe · ${e.employes.length} / ${e.postes_ouverts.length} postes · moral ${e.moral} %</div>`;
  h += e.employes.map((x) => {
    const t = CAT.traits[x.trait];
    const etat = x.absent ? `${x.formation ? 'Formation ' + DN[x.formation] : 'Congés'} : retour dans ${x.absent} j` : x.salaire ? eur(x.salaire) + ' / mois' : 'Gérant';
    const btns = `<div class="btns">${['e', 'm', 'f'].map((d) => `<button type="button" class="btn petit secondaire" data-act="former" data-id="${x.id}" data-dom="${d}" ${x.absent || e.argent < x.cout_formation ? 'disabled' : ''}>Former ${DN[d]}</button>`).join('')}
      ${bouton('conges', x.id, 'Congés', !x.absent, 'petit secondaire')}${x.fondateur ? '' : bouton('licencier', x.id, 'Licencier', true, 'petit secondaire')}</div>
      <div class="t2" style="font-size:12px">Formation : ${eur(x.cout_formation)}, ${10} jours, +2 dans le domaine</div>`;
    return ligne({
      avatar: sprite(x), t1: `${esc(x.nom)} — ${esc(x.poste)}`, t2: repartition(x),
      t3: etat,
      extra: `<div class="chips" style="margin-top:4px"><span class="chip" title="${esc(t.desc)}">${esc(t.nom)}</span><span class="chip" style="background:${x.moral >= 70 ? '#7be08a' : x.moral >= 50 ? '#ffc94d' : '#ff8a7a'};color:#2b1d14">Moral ${x.moral} %</span><span class="chip">Fatigue ${Math.round(x.fatigue)}</span><span class="chip" title="Moral × conditions de travail × trait">Efficacité ${x.efficacite} %</span></div>${btns}`,
    });
  }).join('');
  h += `<div class="section">Candidats${libres ? '' : ' · agrandissez les locaux pour recruter'}</div>`;
  h += e.candidats.map((c) => {
    const t = CAT.traits[c.trait];
    return ligne({
      avatar: sprite(c), t1: `${esc(c.nom)} — ${esc(c.poste)}`, t2: repartition(c), t3: `${eur(c.salaire)} / mois`,
      extra: `<div class="chips" style="margin-top:4px"><span class="chip" title="${esc(t.desc)}">${esc(t.nom)} · ${esc(t.desc)}</span></div>`,
      btn: bouton('embaucher', c.id, libres ? 'Embaucher' : 'Pas de poste', libres > 0),
    });
  }).join('') || '<div class="vide">Nouveaux candidats le mois prochain.</div>';
  return h;
}

function panneauMateriel() {
  const e = ETAT, b = e.bonus;
  let h = `<div class="onglets">${['e', 'm', 'f', 'c'].map((k) => `<button type="button" data-act="catmat" data-id="${k}" class="${catMat === k ? 'actif' : ''}" style="${catMat === k ? 'background:' + DC[k] : ''}">${DN[k]}</button>`).join('')}</div>`;
  const resume = catMat === 'c' ? `chance aux tests +${Math.round(b.cem * 100)} %` : `production +${b[catMat] * 10} % · debug +${b.debug}`;
  h += `<div class="section">${DN[catMat]} · ${resume}</div>`;
  h += Object.entries(CAT.materiel).filter(([, m]) => m.dom === catMat).map(([id, m]) => {
    const effets = [m.bonus && `+${m.bonus * 10} % ${DN[m.dom]}`, m.debug && `debug +${m.debug}`, m.cem && `CEM +${Math.round(m.cem * 100)} %`].filter(Boolean).join(' · ');
    const possede = e.materiel.includes(id);
    const local = (m.piece === 'atelier' || m.piece === 'cem') && !e.locaux.includes(m.piece);
    return ligne({
      couleur: DC[m.dom], t1: esc(m.nom), t2: `${effets} · ${eur(m.prix)}`, t3: `${PIECE[m.piece]}${id in e.pannes ? ` · en panne (${e.pannes[id]} j)` : ''}`,
      btn: bouton('acheter', id, possede ? 'Installé' : local ? 'Local requis' : 'Acheter', !possede && !local && e.argent >= m.prix),
    });
  }).join('');
  return h;
}

function panneauLocaux() {
  const e = ETAT;
  let h = `<div class="section">Agrandissements</div>`;
  h += Object.entries(CAT.locaux).map(([id, l]) => {
    const fait = e.locaux.includes(id), bloque = e.renommee < l.rep;
    return ligne({
      couleur: '#efc488', t1: esc(l.nom), t2: `${esc(l.desc)} · ${eur(l.prix)}`, t3: `Loyer +${eur(l.loyer)} / mois`,
      btn: bouton('local', id, fait ? 'Fait' : bloque ? `★ ${l.rep} requis` : 'Louer', !fait && !bloque && e.argent >= l.prix),
    });
  }).join('');
  h += `<div class="section">Aménagement · moral ${e.moral} %</div>`;
  h += Object.entries(CAT.deco).map(([id, d]) => {
    const fait = e.deco.includes(id), local = d.piece && !e.locaux.includes(d.piece);
    return ligne({
      couleur: '#7be08a', t1: esc(d.nom), t2: `Moral +${d.moral} · ${eur(d.prix)}`, t3: [d.effet, d.piece && "Dans l'open space"].filter(Boolean).join(' · '),
      btn: bouton('deco', id, fait ? 'Installé' : local ? 'Open space requis' : 'Acheter', !fait && !local && e.argent >= d.prix),
    });
  }).join('');
  h += `<div class="section">Conditions de travail · productivité ×${dec(e.facteur_conditions)}</div>` + (e.conditions.length
    ? e.conditions.map((c) => ligne({ couleur: c.pct > 0 ? '#7be08a' : c.pct < 0 ? '#ff8a7a' : '#a9b39a', t1: esc(c.nom), t2: `${c.pct > 0 ? '+' : ''}${c.pct} % de productivité` })).join('')
    : '<div class="vide">Aucun bonus ni malus pour le moment.</div>');
  h += `<div class="section">Charges mensuelles</div><div class="stat" style="margin-top:8px"><span>Loyer</span><b>${eur(e.loyer)}</b><span>Salaires</span><b>${eur(e.salaires)}</b></div>`;
  return h;
}

function panneauJournal(limite) {
  const j = ETAT.journal.slice(0, limite).map((x) => `<div class="journal-l ${x.genre}"><span class="d">${esc(x.date)}</span><span class="t">${esc(x.texte)}</span></div>`).join('');
  return j + `<div class="btns" style="margin-top:16px">${bouton('nouvelle', '', 'Nouvelle partie', true, 'secondaire petit')}</div>`;
}

function panneauAccueil() {
  const e = ETAT;
  return `<div class="encart"><div class="stat">
    <span>Trésorerie</span><b>${eur(e.argent)}</b>
    <span>Charges / mois</span><b>${eur(e.loyer + e.salaires)}</b>
    <span>Chiffre d'affaires total</span><b>${eur(e.stats.ca)}</b>
    <span>Contrats livrés</span><b>${e.stats.livres}</b>
    <span>Produits lancés</span><b>${e.stats.produits_lances}</b>
    <span>Équipe</span><b>${e.employes.length} personne${e.employes.length > 1 ? 's' : ''}</b>
    <span>Moral</span><b>${e.moral} %</b></div></div>
    <div class="section">Journal</div>${panneauJournal(12)}`;
}

// ---------------------------------------------------------------- rendu général
function majHtml(sel, html) {
  if (cache[sel] === html) return;
  cache[sel] = html;
  $(sel).innerHTML = html;
}

function rendre() {
  const e = ETAT;
  if (!e || !CAT) return;
  $('#date').textContent = e.date;
  $('#rep').textContent = e.renommee;
  $('#argent').textContent = eur(e.argent);
  $('#argent').classList.toggle('negatif', e.argent < 0);
  $('#conditions').hidden = vue !== 'prod';
  majHtml('#conditions', `<b>Conditions de travail ×${dec(e.facteur_conditions)}</b>` + (e.conditions.length
    ? e.conditions.map((c) => `<div class="l"><span>${esc(c.nom)}</span><span style="color:${c.pct > 0 ? '#7be08a' : c.pct < 0 ? '#ff8a7a' : '#d6dccb'}">${c.pct > 0 ? '+' : ''}${c.pct} %</span></div>`).join('')
    : '<div class="l"><span>Rien de particulier</span></div>'));
  majHtml('#vues', [['bureau', 'Bureau'], ['prod', 'Productivité'], ['moral', 'Moral']].map(([k, l]) =>
    `<button type="button" data-act="vue" data-id="${k}" class="${vue === k ? 'actif' : ''}">${l}</button>`).join(''));
  const p = e.projet;
  majHtml('#carte-projet', p
    ? `<div class="haut"><span class="nomp">${esc(p.nom)}</span><small style="${p.type === 'contrat' && p.jours > p.delai ? 'color:#ff8a7a' : ''}">${p.type === 'contrat' ? `j ${p.jours}/${p.delai}` : 'produit'}</small></div>
       <small style="text-align:left">${esc(etapeProjet(p))} · note ~${dec(p.note_estimee)}</small>
       ${p.etape === 'travail' ? `<div class="barres">${Object.keys(p.phases[p.phase].besoin).map((d) => barre(DN[d], p.phases[p.phase].fait[d], p.phases[p.phase].besoin[d], DC[d])).join('')}</div>` : ''}`
    : `<span class="nomp">Aucun projet en cours</span><small style="text-align:left">Le temps passe, les charges aussi.</small><span style="color:#ffc94d;font-weight:800;font-size:13px">Voir les contrats →</span>`);
  const j = e.journal[0] || { date: '', texte: '' };
  majHtml('#bandeau', `<span class="d">${esc(j.date)}</span><span class="t">${esc(j.texte)}</span>`);
  $('#vitesse').textContent = vitesse + '×';
  $('#lecture').setAttribute('aria-label', joue ? 'Pause' : 'Lecture');
  majHtml('#lecture', joue
    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>'
    : '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>');
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('actif', b.dataset.id === onglet || (onglet === 'journal' && b.dataset.id === 'accueil')));
  $('#panneau').classList.toggle('ouvert', onglet !== 'accueil');
  $('#titre-panneau').textContent = TITRES[onglet];
  const contenu = { accueil: panneauAccueil, projets: panneauProjets, equipe: panneauEquipe, materiel: panneauMateriel, locaux: panneauLocaux, journal: () => panneauJournal(40) }[onglet]();
  majHtml('#contenu-panneau', contenu);
  rendreMonde();
  rendreModale();
}

function rendreModale() {
  const e = ETAT;
  let h = '';
  if (e.faillite) {
    h = `<h2 id="modale-titre">Faillite</h2><p>La banque a fermé le compte de votre bureau d'études après ${e.jours_total} jours d'activité et ${e.stats.livres} contrats livrés.</p>${bouton('nouvelle-directe', '', 'Nouvelle partie')}`;
  } else if (e.evenement) {
    const ev = e.evenement;
    h = `<h2 id="modale-titre">${esc(ev.titre)}</h2><p>${esc(ev.texte)}</p>` +
      ev.options.map((o, i) => `<button type="button" class="btn ${i ? 'secondaire' : ''}" data-act="evenement" data-choix="${i}">${esc(o)}</button>`).join('');
  } else if (e.dernier_livre) {
    const d = e.dernier_livre;
    h = `<h2 id="modale-titre">${esc(d.nom)}</h2><p>${d.type === 'contrat' ? 'Note du client' : 'Note de la presse spécialisée'} · ${esc(d.client)}</p>
      <div class="note-geante" style="background:${couleurNote(d.note)}">${dec(d.note)}<small>/ 10</small></div>
      <p style="text-align:center;font-weight:700">« ${esc(d.avis)} »</p>
      ${d.montant ? `<p style="text-align:center">Solde encaissé : <b>${eur(d.montant)}</b></p>` : '<p style="text-align:center">Le produit est en vente : les revenus arrivent chaque début de mois.</p>'}
      ${bouton('fermer_note', '', 'Continuer')}`;
  }
  const etaitCachee = $('#modale').hidden;
  $('#modale').hidden = !h;
  $('#app').inert = !!h;  // le clavier reste dans la modale
  majHtml('#modale-contenu', h);
  if (h && etaitCachee) $('#modale-contenu button')?.focus();
}

// ---------------------------------------------------------------- échanges serveur
async function api(chemin, corps) {
  const r = await fetch(chemin, corps ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) } : {});
  if (!r.ok) throw new Error('Serveur injoignable');
  return r.json();
}

function toast(texte) {
  const t = $('#toast');
  t.textContent = texte;
  t.hidden = false;
  clearTimeout(toast.m);
  toast.m = setTimeout(() => { t.hidden = true; }, 2600);
}

async function agir(genre, params = {}) {
  try {
    const r = await api('/api/action', { genre, ...params });
    ETAT = r.etat;
    if (!r.ok) toast(r.erreur);
    else if ((genre === 'signer' || genre === 'produit') && !tablette()) onglet = 'accueil';  // retour au plan pour lancer le temps
  } catch (err) {
    toast(err.message);
  }
  rendre();
}

function boucle() {
  clearTimeout(minuteur);
  if (!joue) return;
  minuteur = setTimeout(async () => {
    if (!envoi) {
      envoi = true;
      try {
        const r = await api('/api/action', { genre: 'avancer' });
        ETAT = r.etat;
      } catch (err) {
        joue = false;
        toast(err.message);
      }
      envoi = false;
      if (ETAT.evenement || ETAT.faillite || ETAT.dernier_livre) joue = false;
      rendre();
    }
    boucle();
  }, 800 / vitesse);
}

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  const brut = b.dataset.id;
  const id = brut && /^\d+$/.test(brut) ? Number(brut) : brut;
  switch (act) {
    case 'onglet':
      onglet = onglet === id && !tablette() ? 'accueil' : id;
      if (onglet === 'accueil' && !tablette()) onglet = 'accueil';
      return rendre();
    case 'vue': vue = id; return rendre();
    case 'catmat': catMat = id; return rendre();
    case 'vitesse': vitesse = vitesse === 1 ? 2 : vitesse === 2 ? 4 : 1; rendre(); return boucle();
    case 'lecture': joue = !joue; rendre(); return boucle();
    case 'nouvelle':
      if (!confirm('Recommencer une nouvelle partie ? La partie en cours sera perdue.')) return;
    // fallthrough
    case 'nouvelle-directe': {
      joue = false;
      try {
        const r = await api('/api/nouvelle', {});
        ETAT = r.etat;
      } catch (err) {
        toast(err.message);
      }
      onglet = tablette() ? 'projets' : 'accueil';
      return rendre();
    }
    case 'abandonner':
      if (!confirm('Abandonner ce projet ? Un contrat abandonné coûte 1 point de renommée.')) return;
      break;
    case 'licencier':
      if (!confirm('Licencier cette personne ? Indemnité : un mois de salaire.')) return;
      break;
    default:
  }
  const params = {};
  if (id !== undefined && id !== '') params.id = id;
  if (b.dataset.dom) params.dom = b.dataset.dom;
  if (b.dataset.choix !== undefined) params.choix = Number(b.dataset.choix);
  await agir(act, params);
});

function ajusterEchelle() {
  const w = $('#cadre').clientWidth;
  const s = Math.min(2, w / 390);
  $('#echelle').style.width = 390 * s + 'px';
  $('#echelle').style.height = 1046 * s + 'px';
  $('#monde').style.transform = `scale(${s})`;
}

async function demarrer() {
  construireStatique();
  ajusterEchelle();
  window.addEventListener('resize', ajusterEchelle);
  if (tablette()) onglet = 'projets';
  try {
    [CAT, ETAT] = await Promise.all([api('/api/catalogue'), api('/api/etat')]);
  } catch (err) {
    toast('Impossible de joindre le serveur du jeu.');
    return;
  }
  rendre();
}

demarrer();
