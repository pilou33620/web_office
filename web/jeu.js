// Circuit Story — interface web (le moteur tourne côté serveur Python)
'use strict';

const $ = (s) => document.querySelector(s);
const DN = { e: 'Élec', m: 'Méca 3D', f: 'Firmware', c: 'CEM' };
const COURT = { e: 'élec', m: '3D', f: 'fw' };
const DC = { e: '#ffc94d', m: '#f08a6c', f: '#7cc0f2', c: '#b08af0' };
const PCT_BONUS = 6;  // % de production par point de matériel (moteur : _production)
const TITRES = { accueil: 'Tableau de bord', projets: 'Projets', equipe: 'Équipe', materiel: 'Matériel', locaux: 'Locaux', journal: 'Journal', societe: 'Société' };
const ABSENCE = { formation: 'En formation', conges: 'En congés', seminaire: 'Séminaire', burnout: 'Burn-out', maladie: 'Malade', naissance: 'Congé naissance' };
const METEO_NOM = { soleil: 'soleil', pluie: 'pluie', neige: 'neige', canicule: 'canicule', orage: 'orage', brouillard: 'brouillard' };
const SAISON_NOM = { hiver: 'Hiver', printemps: 'Printemps', ete: 'Été', automne: 'Automne' };

let ETAT = null, CAT = null;
let onglet = 'accueil', vue = 'bureau', catMat = 'e';
let joue = false, vitesse = 'normal', minuteur = null, envoi = false, nbTrophees = null;
// Durée réelle d'une journée de jeu (ms) selon la vitesse choisie
const VITESSES = { lent: ['Lent', 24000], normal: ['Normal', 18000], rapide: ['Rapide', 4500], tresrapide: ['Très rapide', 1500], demo: ['Démo', 3000] };
const DEMO = new URLSearchParams(location.search).has('demo');  // ouvert par demo.py : le pilote automatique joue
let pilotage = DEMO;
let amenage = false, selection = null, placement = null;  // mode aménagement, objet choisi, objet en cours de placement
let etage = 'garage', NB = {};  // étage affiché (le garage avant le déménagement), personnes par étage
const cache = {};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';
const dec = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
const tablette = () => window.matchMedia('(min-width: 900px)').matches;

// ---------------------------------------------------------------- plan (dessin dans plan.js)
const fiche = (type) => (type === 'poste' ? CAT.poste : CAT.materiel[type] || CAT.deco[type]);
const carte = () => (ETAT.locaux.includes('bureau') ? 'batiment' : 'garage');
// Pièces utilisables maintenant (carte courante, local loué)
const pieceDispo = (k) => { const pc = CAT.pieces[k]; return pc.carte === carte() && (!pc.local || ETAT.locaux.includes(pc.local)); };
// Étages du bâtiment : chacun dans sa bande de 1000 px du monde ; le garage est une carte à part
const ORDRE_ETAGES = ['r2', 'r1', 'rdc'];
const bande = (y) => Math.floor(y / 1000);
const etageDe = (y) => (carte() === 'garage' ? 'garage' : ORDRE_ETAGES.find((k) => bande(CAT.etages[k].y0) === bande(y)) || 'rdc');
const surEtage = (y) => etageDe(y) === etage;
const pieceDe = (o) => Object.keys(CAT.pieces).find((k) => { const pc = CAT.pieces[k], [x, y, w, h] = pc.rect; return pc.carte === carte() && o.x >= x && o.y >= y && o.x < x + w && o.y < y + h; });
// Pièce qui regroupe le plus d'appareils d'un domaine (là où l'on travaille, où s'affiche le bonus)
function pieceMateriel(dom) {
  const n = {};
  for (const o of ETAT.objets) { const m = CAT.materiel[o.type]; if (m && m.dom === dom) { const k = pieceDe(o); if (k) n[k] = (n[k] || 0) + 1; } }
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || (carte() === 'garage' ? 'garage' : dom === 'm' ? 'atelier' : 'labo');
}
// Emplacements debout (centre du personnage) par lieu, sur chaque carte
const SPOTS = {
  garage: {
    labo: [[524, 466], [625, 466], [620, 600], [470, 466]],  // devant l'établi, entre les écrans des bureaux (sinon caché derrière)
    reunion: [[136, 717], [184, 717], [160, 695], [160, 742], [220, 712], [250, 726]],
    terrasse: [[280, 262], [304, 280], [330, 262], [240, 290], [350, 290]],
  },
};
const PAROLES = ['Pause !', 'Bla bla', 'Ha ha !', 'Un café ?', 'Et ton week-end ?', 'T\'as vu le match ?', 'Trop drôle'];
const DEMANDES = ['Tu peux m\'aider ?', 'Regarde ce schéma', 'Une idée ?', 'Ça plante ici…'];

function corps(x, assis = false) {
  return `<div class="anim">${PLAN.figure(esc(x.couleur), esc(x.cheveux), esc(x.peau || PLAN.PEAUX[0]), x.id || 0, assis)}</div>`;
}

const sprite = (x) => `<div class="perso">${corps(x)}</div>`;  // portrait des listes (équipe, candidats)

const PERSOS = {};
function rendrePersos() {
  const e = ETAT, p = e.projets.length > 0, cont = $('#persos'), vus = new Set(), groupes = {};
  const duree = Math.min(1.2, VITESSES[vitesse][1] / 2000);
  const bat = carte() === 'batiment', salle = bat, S = bat ? spotsBatiment(e) : SPOTS.garage;
  const pos = {};
  const objs = Object.fromEntries(e.objets.map((o) => [o.id, o]));
  // devant chaque appareil, dans la pièce où l'on travaille l'élec ou la 3D
  const spots = { labo: [], atelier: [] };
  for (const o of e.objets) {
    const m = CAT.materiel[o.type], k = m && pieceDe(o);
    const lieu = k && bat && (k === pieceMateriel('e') ? 'labo' : k === pieceMateriel('m') ? 'atelier' : null);
    if (lieu) { const [x, , w] = CAT.pieces[k].rect; spots[lieu].push([Math.min(o.x + m.w + 12, x + w - 14), o.y + m.h / 2]); }
  }
  const baby = salle && e.objets.find((o) => o.type === 'babyfoot');
  if (baby) { const f = fiche('babyfoot'); spots.babyfoot = [[baby.x - 10, baby.y + f.h / 2], [baby.x + f.w + 10, baby.y + f.h / 2]]; }
  const SP = (lieu) => (spots[lieu] && spots[lieu].length ? spots[lieu].concat(S[lieu] || []) : S[lieu]);
  const placer = (emp) => {
    const v = vieBureau(emp, objs);
    if (v) return v;
    const mauvais = ['pluie', 'neige', 'orage'].includes(e.meteo);
    let lieu = emp.lieu;
    if (lieu === 'pause') lieu = salle ? 'salle' : mauvais ? (bat ? 'accueil' : 'bureau') : 'terrasse';
    if (lieu === 'fete') lieu = salle ? 'salle' : 'reunion';  // on fête à la cantine, sinon en salle de réunion
    if (lieu === 'salle' && spots.babyfoot && (groupes.babyfoot || 0) < 2) lieu = 'babyfoot';
    if (lieu !== 'babyfoot' && !(S[lieu] || spots[lieu])) lieu = 'bureau';
    let x, y;
    const esc_ = lieu === 'bureau' && ESCAPADES[emp.id];
    if (esc_) return { lieu: 'escapade', x: esc_.x, y: esc_.y, texte: esc_.texte };
    if (lieu === 'bureau') { const o = objs[emp.bureau] || { x: 452, y: 468 }; x = o.x + 38; y = o.y + 46; }
    else { const liste = SP(lieu), g = groupes[lieu] = (groupes[lieu] || 0) + 1; [x, y] = liste[(g - 1) % liste.length]; }
    return { lieu, x, y };
  };
  const presents = e.employes.filter((x) => !x.absent);
  for (const emp of presents) if (emp.lieu !== 'visite') pos[emp.id] = placer(emp);
  const maintenant = Date.now();
  FANTOMES = FANTOMES.filter((f) => maintenant < f.debut + (f.duree || 4500));
  for (const k in ARRIVEES) if (ARRIVEES[k].fin < maintenant) delete ARRIVEES[k];
  if (VISITE && VISITE.fin < maintenant) VISITE = null;
  if (REACTION && REACTION.fin < maintenant) REACTION = null;
  for (const emp of presents) {
    if (emp.lieu !== 'visite') continue;
    const cible = pos[emp.visite];
    // à côté du collègue qu'il vient voir, sinon à son propre bureau
    pos[emp.id] = cible ? { lieu: 'visite', x: cible.x + 22, y: cible.y + 4 } : placer({ ...emp, lieu: 'bureau' });
  }
  NB = {};
  // les fantômes : celui qui part avec son carton, le burn-out affalé à son bureau, le client en visite
  const fantomes = FANTOMES.filter((f) => maintenant >= f.debut).map((f) => {
    const t = maintenant - f.debut, sortie = ENTREES[carte() === 'batiment' ? etageDe(f.y) : 'garage'];
    const loin = !f.reste && t > (f.affale ? 2600 : 1200);
    return { emp: { ...f.emp, id: 'f' + f.emp.id }, lieu: 'vie', x: loin ? sortie[0] : f.x, y: loin ? sortie[1] : f.y, texte: f.texte, carton: f.carton, affale: f.affale && !loin };
  });
  for (const f of fantomes) pos[f.emp.id] = f;
  for (const emp of [...presents, ...fantomes.map((f) => f.emp)]) {
    if (!pos[emp.id] || pos[emp.id].cache) continue;
    const { lieu, x: cx, y: cy, texte } = pos[emp.id];
    NB[etageDe(cy)] = (NB[etageDe(cy)] || 0) + 1;
    if (!surEtage(cy)) continue;  // à un autre étage : retiré du plan affiché
    const [X, Y] = PLAN.iso(cx, cy, 0), x = Math.round(X - 18), y = Math.round(Y - 50);  // pieds de la figure au point du sol
    let t = '', c = '';
    const choc = REACTION && REACTION.ids.includes(emp.id);
    if (vue === 'moral' && emp.moral !== undefined) { t = emp.moral + ' %'; c = emp.moral >= 70 ? '#7be08a' : emp.moral >= 50 ? '#ffc94d' : '#ff8a7a'; }
    else if (joue && e.fete && emp.lieu === 'fete') { t = e.fete.type === 'anniv' ? (emp.nom === e.fete.nom ? 'Merci !' : 'Joyeux anniversaire !') : 'Santé !'; c = '#ffc94d'; }
    else if (choc) { t = ['Oh non !', 'Encore la CEM…', 'On reprend le routage'][emp.id % 3]; c = '#ffb3a8'; }
    else if (joue && lieu === 'reunion') { t = 'Réunion'; c = '#fff7e6'; }
    else if (joue && lieu === 'visite') { t = DEMANDES[(emp.id + e.jours_total) % DEMANDES.length]; c = '#fff7e6'; }
    else if (joue && texte) { t = texte; c = '#fff7e6'; }
    else if (joue && (lieu === 'escapade' || lieu === 'vie')) t = '';
    else if (joue && lieu === 'babyfoot') { t = (emp.id + e.jours_total) % 2 ? 'But !' : 'Allez !'; c = '#7be08a'; }
    else if (joue && p && 'emf'.includes(emp.tache || '_')) { t = emp.gain >= 0.05 ? `+${dec(emp.gain)} ${COURT[emp.tache]}` : `${COURT[emp.tache]}…`; c = DC[emp.tache]; }
    else if (joue && p && emp.tache === 'debug') { t = emp.gain >= 0.05 ? `−${dec(emp.gain)} bug` : 'Debug…'; c = '#ffb3a8'; }
    else if (joue && p && emp.tache === 'cem') { t = 'Attente CEM'; c = DC.c; }
    else if (joue && ['salle', 'terrasse', 'accueil'].includes(lieu)) { t = PAROLES[(emp.id + e.jours_total) % PAROLES.length]; c = '#fff7e6'; }
    else if (joue && !p) { t = 'zzz'; c = '#e8e8e8'; }
    const html = corps(emp, lieu === 'bureau') + (pos[emp.id].carton || (ARRIVEES[emp.id] && maintenant < ARRIVEES[emp.id].fin) ? CARTON : '') + (t ? `<div class="bulle${lieu === 'babyfoot' || lieu === 'visite' || lieu === 'escapade' || lieu === 'vie' ? ' parle' : ''}" style="background:${c}">${esc(t)}</div>` : '');
    let el = PERSOS[emp.id];
    if (!el) {
      el = PERSOS[emp.id] = document.createElement('div');
      el.className = 'perso';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el._x = x; el._y = y;
      cont.appendChild(el);
    }
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    if (el._x !== x || el._y !== y) {
      // il marche depuis là où il en est, en contournant les murs par les portes ; arrivé par l'escalier : pas de marche
      const cs = getComputedStyle(el), depart = PLAN.versMonde(parseFloat(cs.left) + 18, parseFloat(cs.top) + 50);
      if (el._anim) el._anim.cancel();
      el._x = x; el._y = y;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      const pts = [depart, ...PLAN.trajet(e, CAT, depart[0], depart[1], cx, cy)], long = [0];
      for (let k = 1; k < pts.length; k++) long.push(long[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const L = long[long.length - 1], dt = Math.min(4 * duree, Math.max(duree, L / 200));
      if (el._etage === etage && L > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el._anim = el.animate(pts.map(([a, b], k) => { const [X, Y] = PLAN.iso(a, b, 0); return { left: X - 18 + 'px', top: Y - 50 + 'px', offset: long[k] / L }; }), { duration: dt * 1000 });
        el.classList.add('marche');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('marche'), dt * 1000);
      }
    }
    el._etage = etage;
    const assis = lieu === 'bureau', d = Math.round(cx + cy);
    el.style.zIndex = 2 * d;  // les plus proches devant
    // par-dessus le personnage : copie, découpée à sa taille, de ce qui est devant lui (armoire, plante, bureau de la rangée suivante…)
    const devant = cache.elements.filter(([prof, , k]) => {
      const b = BOITES.get(k);
      return prof > cx + cy && b && b.x < x + 36 && x < b.x + b.width && b.y < y + 56 && y < b.y + b.height;
    });
    const masque = devant.length ? `<svg width="36" height="56" viewBox="${x} ${y} 36 56" xmlns="http://www.w3.org/2000/svg">${devant.map((v) => v[1]).join('')}</svg>` : '';
    if (el._masque !== masque) {
      el._masque = masque;
      if (!el._m) { el._m = document.createElement('div'); el._m.className = 'masque'; cont.appendChild(el._m); }
      el._m.innerHTML = masque;
    }
    Object.assign(el._m ? el._m.style : {}, { left: x + 'px', top: y + 'px', zIndex: 2 * d + 1 });
    const travaille = joue && (lieu === 'babyfoot' || (p && (assis || lieu === 'labo' || lieu === 'atelier' || lieu === 'cem' || lieu === 'visite') && emp.tache));
    el.classList.toggle('bob', !!travaille && emp.id % 2 === 0);
    el.classList.toggle('bob2', !!travaille && emp.id % 2 === 1);
    el.classList.toggle('secoue', !!choc);
    el.classList.toggle('affale', !!pos[emp.id].affale);
    vus.add(String(emp.id));
  }
  effetsMateriel(pos);
  for (const id of Object.keys(PERSOS)) if (!vus.has(id)) { PERSOS[id].remove(); if (PERSOS[id]._m) PERSOS[id]._m.remove(); delete PERSOS[id]; }
}

const CARTON = '<svg class="carton" viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M1 4 L8 1 L15 4 L15 10 L8 11.5 L1 10Z" fill="#c48a52" stroke="#2b1d14" stroke-width="1"/><path d="M1 4 L8 6 L15 4 M8 6 V11.5" fill="none" stroke="#2b1d14" stroke-width=".9"/></svg>';

// Gestes de métier : soudure, oscillo, impression 3D, fraisage, four, code qui défile sur les écrans ; fumée après un échec CEM ; confettis au pot
const EFFETS = new Map();
const TYPE_EFFET = { station: 'etincelles', micro: 'etincelles', oscillo: 'onde', spectre: 'onde', logique: 'onde', fdm: 'tete', resine: 'tete', cnc: 'copeaux', four: 'four' };
const DESSIN_EFFET = {
  etincelles: '<i></i><i></i><i></i><i></i>', copeaux: '<i></i><i></i><i></i>', tete: '<i></i>', four: '', code: '',
  onde: '<svg viewBox="0 0 16 8" width="16" height="8"><path d="M0 4 H3 L4 1 L6 7 L8 2 L10 6 L11 4 H16" fill="none" stroke="#7be08a" stroke-width="1.4"/></svg>',
  fumee: '<i></i><i></i><i></i>', confettis: '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>',
};
function effetsMateriel(pos) {
  const e = ETAT, voulus = new Map(), actif = joue && e.projets.length > 0;
  const labo = Object.values(pos).some((p) => p.lieu === 'labo' || p.lieu === 'cem'), atelier = Object.values(pos).some((p) => p.lieu === 'atelier');
  const etablis = CAT.etablis[carte()], objs = Object.fromEntries(e.objets.map((o) => [o.id, o]));
  if (actif) {
    for (const o of e.objets) {
      const t = TYPE_EFFET[o.type];
      if (!t || !surEtage(o.y) || !(CAT.materiel[o.type].dom === 'm' ? atelier : labo)) continue;
      voulus.set('o' + o.id, [t, ...PLAN.pointEffet(o, fiche(o.type), etablis)]);
    }
    for (const emp of e.employes) {
      const p = pos[emp.id], o = objs[emp.bureau];
      if (p && p.lieu === 'bureau' && emp.tache && o && surEtage(o.y)) voulus.set('p' + o.id, ['code', ...PLAN.pointEffet(o, CAT.poste, etablis)]);
    }
  }
  const laboIci = carte() === 'garage' || CAT.pieces[pieceMateriel('e')].etage === etage;
  if (REACTION && REACTION.fumee && laboIci) {
    const [x, y, w, h] = CAT.pieces[pieceMateriel('e')].rect;
    voulus.set('fumee', ['fumee', ...PLAN.iso(x + w / 2, y + h / 2, 40)]);
  }
  const fete = e.employes.filter((x) => x.lieu === 'fete' && pos[x.id] && !pos[x.id].cache && surEtage(pos[x.id].y)).map((x) => pos[x.id]);
  if (joue && e.fete && fete.length) {
    const cx = fete.reduce((t, p) => t + p.x, 0) / fete.length, cy = fete.reduce((t, p) => t + p.y, 0) / fete.length;
    voulus.set('confettis', ['confettis', ...PLAN.iso(cx, cy, 70)]);
  }
  for (const [k, el] of EFFETS) if (!voulus.has(k) || el._type !== voulus.get(k)[0]) { el.remove(); EFFETS.delete(k); }
  for (const [k, [t, X, Y]] of voulus) {
    let el = EFFETS.get(k);
    if (!el) {
      el = document.createElement('div');
      el.className = 'fx ' + t;
      el._type = t;
      el.innerHTML = DESSIN_EFFET[t];
      $('#effets').appendChild(el);
      EFFETS.set(k, el);
    }
    el.style.left = Math.round(X) + 'px';
    el.style.top = Math.round(Y) + 'px';
  }
}

// Petites escapades pendant que le temps tourne : un café, une question à un collègue, un passage au labo… puis retour au bureau
const ESCAPADES = {};
const PROPOS = { cafe: ['Un café ?', 'Pause café', 'Je reviens'], labo: ['Une mesure', 'Petit essai', 'Je soude ça', 'Au labo !'], reunion: ['Point rapide', 'On cale ça ?'] };
function escapades() {
  if (!ETAT || !joue || amenage || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (vieDeBureau() && momentJour(fractionJour()).act !== 'travail') return;
  const e = ETAT, maintenant = Date.now(), objs = Object.fromEntries(e.objets.map((o) => [o.id, o]));
  let change = false;
  for (const id in ESCAPADES) if (ESCAPADES[id].fin < maintenant) { delete ESCAPADES[id]; change = true; }
  const assis = e.employes.filter((x) => !x.absent && x.lieu === 'bureau' && objs[x.bureau] && surEtage(objs[x.bureau].y));
  const libres = assis.filter((x) => !ESCAPADES[x.id] && !PLANNING.ids[x.id]);
  if (libres.length && Object.keys(ESCAPADES).length < Math.max(1, assis.length / 3) && Math.random() < 0.75) {
    const emp = libres[Math.floor(Math.random() * libres.length)], bureau = objs[emp.bureau];
    const S = carte() === 'batiment' ? spotsBatiment(e) : SPOTS.garage;
    const cibles = [['labo', S.labo], ['labo', S.atelier], ['cafe', S.salle], ['cafe', S.accueil], ['cafe', S.terrasse], ['reunion', S.reunion]]
      .flatMap(([genre, l]) => (l || []).filter(([, y]) => etageDe(y) === etageDe(bureau.y)).map(([x, y]) => [genre, x, y]))
      .concat(assis.filter((x) => x !== emp).map((x) => ['visite', objs[x.bureau].x + 60, objs[x.bureau].y + 46]));
    if (cibles.length) {
      const [genre, x, y] = cibles[Math.floor(Math.random() * cibles.length)], l = genre === 'visite' ? DEMANDES : PROPOS[genre];
      ESCAPADES[emp.id] = { x, y, texte: l[Math.floor(Math.random() * l.length)], fin: maintenant + 3000 + Math.random() * 3000 };
      change = true;
    }
  }
  if (change) rendrePersos();
}
setInterval(escapades, 1500);

// ---------------------------------------------------------------- une journée de bureau : réunion du matin d'un service, cafés en groupe, déjeuner
// Chaque jour de jeu est une journée (8 h 30 → 18 h) ; seulement aux vitesses Lent et Normal, sinon tout irait trop vite pour être vu.
let debutJour = performance.now(), figee = 0;  // début du jour en cours ; avancée de la journée quand le temps est arrêté
const journee = () => {  // [début (part du jour), moment, heure affichée] ; la fin de journée suit les horaires de travail
  const fin = Math.max(16.6, 10 + (ETAT ? ETAT.heures : 8));
  return [[0, 'arrivee', 8.5], [0.08, 'reunion', 9], [0.24, 'travail', 9.75], [0.34, 'cafe', 10.5], [0.46, 'travail', 10.9],
    [0.52, 'dejeuner', 12], [0.75, 'travail', 13.6], [0.83, 'cafe', 15.75], [0.89, 'travail', 16.1], [0.92, 'depart', fin - 0.5], [1, 'fin', fin]];
};
const ESCALIERS = { rdc: [628, 402], r1: [659, 1380], r2: [656, 2381] };  // palier devant l'escalier de chaque étage
const ENTREES = { garage: [555, 700], rdc: [633, 768], r1: ESCALIERS.r1, r2: ESCALIERS.r2 };  // par où l'on arrive et l'on repart
const COULOIRS = { garage: [[455, 600], [660, 600]], rdc: [[700, 514], [1100, 514]], r1: [[360, 1246], [1240, 1246]], r2: [[660, 2248], [1080, 2248]] };
const SALLES = { rdc: 'atlas', r1: 'orion', r2: 'vega' };
const MOTS = {
  reunion: { e: ['Point HW', 'Les schémas ?', 'Et le routage ?'], m: ['Revue méca', 'Les plans 3D ?', 'Le boîtier ?'], f: ['Daily soft', 'Le sprint ?', 'Ça compile ?'] },
  cafe: ['Un café ?', 'Bla bla', 'Ha ha !', 'Et ton week-end ?', "T'as vu le match ?", 'Trop drôle'],
  dejeuner: ['Bon appétit !', 'Miam', "C'est quoi le menu ?", 'Une pizza ?', 'On mange où ?'],
};
let PLANNING = { cle: null, ids: {} };
const vieDeBureau = () => vitesse === 'lent' || vitesse === 'normal';
const fractionJour = () => (joue ? Math.min(0.999, (performance.now() - debutJour) / VITESSES[vitesse][1]) : figee);
function momentJour(f) {
  const J = journee(), i = J.findIndex((_, k) => f < J[k + 1][0]), [a, act, h] = J[i], [b, , h2] = J[i + 1];
  return { i, act, debut: a, fin: b, avance: (f - a) / (b - a), heure: h + (h2 - h) * (f - a) / (b - a) };
}
const texteHeure = () => { if (!vieDeBureau()) return ''; const h = momentJour(fractionJour()).heure; return ` · ${Math.floor(h)} h ${String(Math.floor((h % 1) * 12) * 5).padStart(2, '0')}`; };

function planifier(m) {
  const e = ETAT, cle = `${e.jours_total}|${m.i}|${vitesse}|${etage}`;
  if (PLANNING.cle === cle) return false;
  PLANNING = { cle, ids: {} };
  if (!vieDeBureau()) return true;
  let g = e.jours_total * 97 + m.i * 13 + 7;
  const hasard = () => { g = (g * 1103515245 + 12345) % 2147483648; return g / 2147483648; };  // le même programme à chaque affichage
  const pioche = (l) => l[Math.floor(hasard() * l.length)];
  const objs = Object.fromEntries(e.objets.map((o) => [o.id, o])), bat = carte() === 'batiment', S = bat ? spotsBatiment(e) : SPOTS.garage;
  // au déjeuner, tout le monde peut partir (même une réunion de phase s'arrête pour manger) ; sinon, ceux qui ne sont pas déjà en réunion
  const dispo = e.employes.filter((x) => !x.absent && objs[x.bureau] && x.lieu !== 'cem' && (m.act === 'dejeuner' || x.lieu !== 'reunion'));
  const etg = (x) => (bat ? etageDe(objs[x.bureau].y) : 'garage');
  if (m.act === 'arrivee' || m.act === 'depart') {  // chacun à son heure ; avec les heures sup, certains restent tard
    const reste = Math.min(0.85, Math.max(0, (e.heures - 8) / 4)) + (e.jours_total % 7 === 4 ? 0.25 : 0);
    for (const x of e.employes.filter((x) => !x.absent && objs[x.bureau])) {
      const [px, py] = ENTREES[etg(x)];
      PLANNING.ids[x.id] = { seuil: hasard() * 0.6, x: px + (x.id % 4) * 8, y: py, reste: m.act === 'depart' && hasard() < reste, sens: m.act };
    }
    if (m.act === 'depart' && e.jours_total % 7 === 4) lancerCourse(e, objs, etg);  // le vendredi soir…
    return true;
  }
  if (!(m.act in MOTS)) return true;
  const aller = (membres, spots, mots, part = 1) => membres.forEach((x, k) => {
    const [px, py] = spots[k % spots.length];
    PLANNING.ids[x.id] = { x: px + (k >= spots.length ? 12 : 0), y: py, texte: hasard() < part ? pioche(mots) : null, ailleurs: bat && etageDe(py) !== etg(x) };
  });
  if (m.act === 'reunion') {  // un service par jour, à tour de rôle, dans la salle de réunion de son étage
    const services = ['e', 'f', 'm'].map((d, k) => ['e', 'f', 'm'][(e.jours_total + k) % 3]);
    const d = services.find((d) => dispo.filter((x) => x.service === d).length >= 2);
    if (!d) return true;
    const membres = dispo.filter((x) => x.service === d), compte = {};
    for (const x of membres) compte[etg(x)] = (compte[etg(x)] || 0) + 1;
    const et = Object.keys(compte).sort((a, b) => compte[b] - compte[a])[0];  // l'étage où la plupart du service travaille
    aller(membres, bat ? S.piece(SALLES[et]) : S.reunion, MOTS.reunion[d], 0.6);
    const chef = membres.find((x) => x.role === 'resp_' + d) || membres[0];
    PLANNING.ids[chef.id].texte = 'Point du matin';
  } else if (m.act === 'cafe') {  // de petits groupes de collègues du même étage
    const etages = {};
    for (const x of dispo) if (hasard() < 0.6) (etages[etg(x)] = etages[etg(x)] || []).push(x);
    for (const [et, l] of Object.entries(etages)) {
      if (l.length < 2) continue;
      const tasse = e.objets.find((o) => o.type === 'cafe' && (!bat || etageDe(o.y) === et));
      const spots = tasse ? [[tasse.x - 14, tasse.y + 40], [tasse.x + 30, tasse.y + 46], [tasse.x + 8, tasse.y + 62], [tasse.x + 44, tasse.y + 20]]
        : !bat ? S.terrasse : et === 'r1' ? S.piece('cafet1') : et === 'r2' ? S.salle : S.accueil;
      aller(l, spots, MOTS.cafe, 0.5);
    }
  } else {  // déjeuner : presque tout le monde part manger, quelques-uns restent avec un sandwich
    const partent = dispo.filter(() => hasard() < 0.85);
    aller(partent, bat ? S.salle : S.terrasse, MOTS.dejeuner, 0.5);
    dispo.filter((x) => !partent.includes(x)).forEach((x) => { PLANNING.ids[x.id] = { reste: true, texte: hasard() < 0.5 ? 'Sandwich au bureau' : null }; });
  }
  return true;
}

// Position d'un employé selon le programme de la journée (null : rien de prévu, il suit sa journée de travail)
function vieBureau(emp, objs) {
  if (COURSE && COURSE.ids.includes(emp.id) && Date.now() < COURSE.fin) return { cache: true };
  const arr = ARRIVEES[emp.id];
  if (arr && Date.now() < arr.debut + 1800) { const [x, y] = ENTREES[etageDe(objs[emp.bureau].y)] || ENTREES.garage; return { lieu: 'vie', x, y, texte: 'Bonjour à tous !' }; }
  const vis = VISITE && VISITE.emp === emp.id && Date.now() < VISITE.fin;
  if (vis) return { lieu: 'vie', x: VISITE.x + 30, y: VISITE.y, texte: 'Bienvenue !' };
  const pl = PLANNING.ids[emp.id];
  if (!pl || emp.absent) return null;
  if (pl.sens) {  // arrivée du matin ou départ du soir
    const m = momentJour(fractionJour());
    if (pl.sens === 'arrivee') return m.avance < pl.seuil ? { cache: true } : m.avance < pl.seuil + 0.25 ? { lieu: 'vie', x: pl.x, y: pl.y, texte: null } : null;
    if (pl.reste || m.avance < pl.seuil) return null;
    return m.avance < pl.seuil + 0.3 ? { lieu: 'vie', x: pl.x, y: pl.y, texte: null } : { cache: true };
  }
  if (pl.reste) { const o = objs[emp.bureau]; return emp.lieu === 'bureau' ? { lieu: 'bureau', x: o.x + 38, y: o.y + 46, texte: pl.texte } : null; }
  const m = momentJour(fractionJour());
  if (pl.ailleurs && (m.avance < 0.22 || m.avance > 0.88)) {  // il passe par l'escalier de son étage avant de changer d'étage
    const [x, y] = ESCALIERS[etageDe(objs[emp.bureau].y)];
    return { lieu: 'vie', x: x + (emp.id % 3) * 10, y, texte: null };
  }
  return { lieu: 'vie', x: pl.x, y: pl.y, texte: pl.texte };
}

// Lumière selon l'heure : matin doux, soir orangé avec les lampes, nuit bleutée (sans horloge : selon les horaires)
function eclairage() {
  if (!vieDeBureau()) return ETAT.heures >= 12 ? 'nuit' : ETAT.heures >= 10 ? 'soir' : '';
  const h = momentJour(fractionJour()).heure;
  return h < 9 ? 'matin' : h >= 20.5 ? 'nuit' : h >= 18.5 ? 'soir' : '';
}

let FANTOMES = [], ARRIVEES = {}, VISITE = null, REACTION = null, COURSE = null;
const nouveauxTextes = (a, n) => { const k = n.journal.findIndex((x) => a.journal[0] && x.date === a.journal[0].date && x.texte === a.journal[0].texte); return n.journal.slice(0, k < 0 ? 4 : k).map((x) => x.texte); };
function observer(a, n) {
  if (!a || !n || a === n) return;
  const maintenant = Date.now(), objs = Object.fromEntries(n.objets.map((o) => [o.id, o])), textes = nouveauxTextes(a, n);
  if (n.argent - a.argent >= 100) gain(n.argent - a.argent);
  const ids = new Set(n.employes.map((x) => x.id));
  for (const x of a.employes) {
    if (ids.has(x.id)) continue;  // il est parti (démission, licenciement, débauchage, fin de stage) : avec son carton
    const o = a.objets.find((y) => y.id === x.bureau);
    if (o) FANTOMES.push({ emp: x, x: o.x + 38, y: o.y + 46, debut: maintenant, carton: true, texte: 'Au revoir…' });
  }
  const anciens = new Set(a.employes.map((x) => x.id));
  for (const x of n.employes) if (!anciens.has(x.id)) ARRIVEES[x.id] = { debut: maintenant, fin: maintenant + 7000 };
  for (const t of textes) {
    if (t.startsWith('Burn-out : ')) {
      const x = n.employes.find((y) => t.startsWith(`Burn-out : ${y.nom} `)), o = x && objs[x.bureau];
      if (o) FANTOMES.push({ emp: x, x: o.x + 38, y: o.y + 46, debut: maintenant, affale: true, texte: "Je n'en peux plus…" });
    }
    const cem = t.match(/^Échec aux tests CEM pour « (.+) »/);
    if (cem) { const p = n.projets.find((y) => y.nom === cem[1]); REACTION = { ids: p ? p.equipe : [], fin: maintenant + 5000, fumee: true }; }
    if (t.includes('reçu au stock')) passage('camion');
    if (/phase « Firmware et bring-up »/.test(t) && a.projets.some((p) => p.phases[p.phase] && p.phases[p.phase].attente && !p.phases[p.phase].essais)) passage('coursier');
    if (t.startsWith('Contrat signé avec ')) visite(n, objs);
  }
}
function passage(genre) {
  const html = PLAN.passage(ETAT, genre);
  if (!html || document.hidden) return;
  $('#rue').insertAdjacentHTML('beforeend', html);
  const el = $('#rue').lastElementChild;
  setTimeout(() => el.remove(), 15000);
}
function visite(n, objs) {  // le client arrive par la rue, puis s'installe en salle de réunion avec le commercial (ou un chef, ou vous)
  passage('client');
  const hote = n.employes.find((x) => x.commercial && !x.absent) || n.employes.find((x) => x.chef && !x.absent) || n.employes[0];
  const bat = carte() === 'batiment', o = objs[hote.bureau];
  const [x, y] = bat ? (spotsBatiment(n).piece(SALLES[etageDe(o.y)])[0]) : [520, 690];
  VISITE = { emp: hote.id, x, y, fin: Date.now() + 9000 };
  FANTOMES.push({ emp: { id: 9000 + n.jours_total, couleur: '#3a4a6a', cheveux: '#3a2a1a', peau: PLAN.PEAUX[3] }, x, y, debut: Date.now() + 2500, duree: 6500, reste: true, texte: 'Enchanté !' });
}
function gain(montant) {
  const ref = $('#argent').getBoundingClientRect(), el = document.createElement('div');
  el.className = 'gain';
  el.textContent = '+' + eur(montant);
  el.style.left = Math.round(ref.left + ref.width / 2) + 'px';
  el.style.top = Math.round(ref.bottom) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
// Course de fauteuils dans le couloir, le vendredi soir, entre ceux qui restent tard
function lancerCourse(e, objs, etg) {
  const ici = e.employes.filter((x) => !x.absent && objs[x.bureau] && etg(x) === (carte() === 'batiment' ? etage : 'garage'));
  if (ici.length < 2 || COURSE) return;
  const pilotes = ici.slice().sort((a, b) => (a.id * 7 + e.jours_total) % 5 - (b.id * 7 + e.jours_total) % 5).slice(0, 3);
  COURSE = { ids: pilotes.map((x) => x.id), fin: Date.now() + 8000 };
  const [[x1, y1], [x2, y2]] = COULOIRS[carte() === 'batiment' ? etage : 'garage'], [X1, Y1] = PLAN.iso(x1, y1, 0), [X2, Y2] = PLAN.iso(x2, y2, 0);
  $('#effets').insertAdjacentHTML('beforeend', pilotes.map((x, k) => `<div class="pilote" style="left:${Math.round(X1 - 18)}px;top:${Math.round(Y1 - 46 + k * 10)}px;--dx:${Math.round(X2 - X1)}px;--dy:${Math.round(Y2 - Y1)}px;--t:${(2.1 + k * 0.45).toFixed(2)}s;z-index:${1000 + k}">
    <svg class="fauteuil" viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="3" y="2" width="18" height="7" rx="2" fill="#3d3d3d" stroke="#2b1d14"/><path d="M12 9v4M6 14h12" stroke="#2b1d14" stroke-width="2"/></svg>
    ${corps(x, true)}<div class="bulle parle" style="background:#ffc94d">${k ? 'J\'arrive !' : 'Vroum !'}</div></div>`).join(''));
  setTimeout(() => { document.querySelectorAll('#effets .pilote').forEach((el) => el.remove()); COURSE = null; rendrePersos(); }, 8000);
}

// ---------------------------------------------------------------- mode démo : un pilote automatique joue, en accéléré avec des journées lentes
// Un jour sur cinq, chaque vendredi et chaque jour où il se passe quelque chose, la journée se joue en Normal pour voir la vie du bureau.
// seulement ce que le jour a apporté (pas les décisions du pilote), et pas deux journées lentes de suite pour un évènement
const MOMENTS = /livré à|Échec aux tests CEM|reçu au stock|Burn-out|phase « Firmware|est en vente/;
let dernierLent = -9;
const jourLent = (a, n) => {
  const lent = n.jours_total % 5 === 0 || n.jours_total % 7 === 4 || (n.jours_total - dernierLent >= 3 && nouveauxTextes(a, n).some((t) => MOMENTS.test(t)));
  if (lent) dernierLent = n.jours_total;
  return lent;
};
const MATERIEL_DEMO = ['multi', 'station', 'alim', 'stlink', 'oscillo', 'logique', 'jlink', 'four', 'fdm', 'micro', 'cao', 'ci', 'spectre'];
async function piloter() {
  const faire = async (genre, params = {}) => {
    try { const r = await api('/api/action', { genre, ...params }); observer(ETAT, r.etat); ETAT = r.etat; return r.ok; } catch (err) { return false; }
  };
  let e = ETAT;
  const charges = () => ETAT.loyer + ETAT.salaires + ETAT.frais_structure, reserve = () => 4 * charges();
  for (let k = 0; k < 4 && ETAT.evenement; k++) {  // comme un joueur prudent : oui à ce qui aide, non aux défis et aux dépenses quand la caisse est juste
    const ev = ETAT.evenement, serre = ETAT.argent < 6 * charges() && ['entretien', 'demission', 'debauche', 'obsolescence', 'salon', 'brevet'].includes(ev.type);
    if (ev.type === 'presse' || serre || !(await faire('evenement', { choix: 0 }))) await faire('evenement', { choix: ev.options.length - 1 });
  }
  if (ETAT.dernier_livre) { toast(`« ${ETAT.dernier_livre.nom} » livré : ${ETAT.dernier_livre.note}/10`, true); await faire('fermer_note'); }
  if (ETAT.bilan) await faire('fermer_bilan');
  if (ETAT.victoire && !ETAT.victoire.vue) await faire('fermer_victoire');
  if (ETAT.faillite || (ETAT.fin && !ETAT.fin.vue)) {  // on recommence une démo
    const r = await api('/api/nouvelle', { emplacement: 1, scenario: 'reprise', difficulte: 'facile', entreprise: 'Circuit Démo', directeur: 'Pilote automatique' }).catch(() => null);
    if (r && r.etat) ETAT = r.etat;
    return;
  }
  e = ETAT;
  if (e.places < e.capacite) {  // un contrat à la taille de l'équipe
    const offres = e.offres.filter((o) => !o.mega && !(o.requis && requisListe(o.requis).some((x) => !e.technos.includes(x) && !e.certifs.includes(x))));
    const o = offres.sort((a, b) => Math.abs(a.taille - 110 * e.employes.length) - Math.abs(b.taille - 110 * e.employes.length))[0];
    if (o) await faire('signer', { id: o.id });
  }
  for (const p of ETAT.projets) if (p.etape === 'debug' && p.defauts < 1) await faire('tests_cem', { id: p.id });
  e = ETAT;
  if (!e.locaux.includes('bureau') && e.employes.length >= 3 && e.argent > reserve() + CAT.locaux.bureau.prix + 10000) await faire('local', { id: 'bureau' });
  if (e.candidats.length && e.argent > reserve() + 20000 && e.employes.length < 3 + 2.5 * e.capacite) {
    if (e.postes_ouverts.length <= e.employes.length) await faire('poser', { id: 'poste' });
    const c = [...ETAT.candidats].sort((a, b) => (b.e + b.m + b.f) / b.salaire - (a.e + a.m + a.f) / a.salaire)[0];
    if (c) await faire('embaucher', { id: c.id });
  }
  e = ETAT;
  for (const prod of e.produits) {  // les lots au sous-traitant
    const encours = e.commandes.filter((c) => c.produit === prod.id_produit).reduce((t, c) => t + c.qte, 0);
    if (prod.stock + encours < 1.5 * prod.demande) await faire('commander', { id: prod.id_produit, qte: prod.demande * 4 >= 200 && e.stock_max - e.stock_total >= 200 ? 200 : 50 });
  }
  e = ETAT;
  if (e.jours_total % 30 === 12 && e.places < e.capacite && e.argent > reserve() + 15000 && e.employes.length >= 3) {
    const x = CAT.produits.find((x) => e.renommee >= x.rep_min && (!x.requis || e.technos.includes(x.requis)) && !x.innovation && !(x.id in e.gammes)
      && (!x.suite || x.suite in e.gammes) && ![...e.produits, ...e.projets].some((y) => y.id_produit === x.id));
    if (x) await faire('produit', { id: x.id });
  }
  e = ETAT;
  if (e.jours_total % 20 === 3 && e.argent > reserve() + 20000) {
    const m = MATERIEL_DEMO.find((m) => !e.materiel.includes(m));
    if (m) await faire('acheter', { id: m });
  }
  if (e.employes.length >= 6 && !e.employes.some((x) => x.chef)) {
    const x = e.employes.filter((x) => !x.fondateur && !x.stage).sort((a, b) => (b.e + b.m + b.f) - (a.e + a.m + a.f))[0];
    if (x) await faire('promouvoir', { id: x.id });
  }
  for (const x of ETAT.employes) if (!x.absent && x.fatigue >= 44) await faire('conges', { id: x.id });
}

let etapeVue = '';
setInterval(() => {
  if (!ETAT || !CAT) return;
  const m = momentJour(fractionJour()), detail = m.act === 'arrivee' || m.act === 'depart' ? Math.floor(m.avance * 20) : m.avance < 0.22 ? 0 : m.avance > 0.88 ? 2 : 1;
  const etape = `${m.i}|${detail}`, anime = FANTOMES.length || COURSE || Object.keys(ARRIVEES).length || VISITE || REACTION;
  const h = $('#heure');
  if (h) h.textContent = texteHeure();
  const lum = eclairage();
  if ($('#monde').dataset.soir !== lum) $('#monde').dataset.soir = lum;
  if (planifier(m) || etape !== etapeVue || anime) { etapeVue = etape; rendrePersos(); }
}, 400);

// Emplacements debout dans le bâtiment (centre du personnage) : grille libre de chaque pièce et de la terrasse du R2
function spotsBatiment(e) {
  const boites = e.objets.map((o) => { const f = fiche(o.type); return f && !f.libre ? [o.x, o.y, f.w, f.h] : null; }).filter(Boolean).concat(CAT.obstacles.batiment);
  const libre = (x, y) => !boites.some(([bx, by, bw, bh]) => x > bx - 10 && x < bx + bw + 10 && y > by - 10 && y < by + bh + 10);
  const grille = (k) => {
    const [x, y, w, h] = typeof k === 'string' ? CAT.pieces[k].rect : k, pts = [];
    for (let yy = y + 22; yy < y + h - 30; yy += 34) for (let xx = x + 20; xx < x + w - 16; xx += 34) if (libre(xx, yy)) pts.push([xx, yy]);
    return pts.length ? pts : [[x + w / 2, y + h / 2]];
  };
  return {
    labo: grille(pieceMateriel('e')), atelier: grille(pieceMateriel('m')), salle: grille('cantine'),
    accueil: grille('accueil'), terrasse: grille(CAT.dehors.r2[0]),
    reunion: grille('orion'),  // la salle du R1 : les bureaux y sont
    piece: grille,
  };
}
// Pastilles de la vue Productivité au garage : [domaine, x, y] (coordonnées du sol) ; dans le bâtiment, sur la pièce du matériel
const PUCES = [['f', 560, 376], ['e', 446, 376]];

const DESSINS = new Map();  // dessin SVG de chaque objet placé, recalculé seulement s'il bouge
const BOITES = new Map();  // contour à l'écran de chaque élément du plan
function rendreMonde() {
  const e = ETAT, h = [], svg = [];
  if (carte() === 'garage') etage = 'garage';
  else if (etage === 'garage') etage = etageDe((e.objets.find((o) => o.id === e.employes[0]?.bureau) || { y: CAT.etages.r1.y0 }).y);  // on vient d'emménager
  PLAN.etage(etage, CAT);
  const cle = carte() + '|' + etage + '|' + [...e.locaux].sort().join(',') + '|' + e.entreprise + '|' + e.saison;
  if (cache.decor !== cle) {
    const demenage = cache.decor && cache.decor.split('|').slice(0, 2).join('|') !== carte() + '|' + etage;
    cache.decor = cle;
    $('#statique').innerHTML = PLAN.fond(e, CAT);
    $('#devant').innerHTML = PLAN.devant(e, CAT);
    $('#rue').innerHTML = PLAN.rue(e);
    cache.fixes = PLAN.fixes(e, CAT);
    if (demenage) requestAnimationFrame(recentrer);
  }
  const occupes = {};
  for (const x of e.employes) occupes[x.bureau] = x;
  const etablis = CAT.etablis[carte()];
  const objets = e.objets.map((o) => [o, fiche(o.type)]).filter(([o, f]) => f && surEtage(o.y));
  const elements = cache.fixes.map(([prof, s], i) => [prof, s, `F${i}|${cle}`]);
  for (const [o, f] of objets) {
    const k = `${o.id}|${o.type}|${o.x}|${o.y}`;
    if (!DESSINS.has(k)) DESSINS.set(k, PLAN.objet(o, f, etablis));
    let titre = f.nom;
    if (o.type === 'poste') {
      const emp = occupes[o.id];
      titre = !emp ? 'Bureau libre' : emp.absent ? `${emp.nom} · ${ABSENCE[emp.absence] || 'absent'}` : `Bureau de ${emp.nom}`;
    }
    let extra = '';
    if (o.type in e.pannes) { const [X, Y] = PLAN.iso(o.x + f.w / 2, o.y + f.h / 2, 46); extra += `<circle cx="${X}" cy="${Y}" r="9" fill="#ff8a7a" stroke="#2b1d14" stroke-width="2"/><text x="${X}" y="${Y + 4}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="12" fill="#2b1d14">!</text>`; }
    if (amenage && selection === o.id) extra += `<polygon points="${PLAN.empreinte(o.x - 3, o.y - 3, f.w + 6, f.h + 6)}" fill="rgba(255,201,77,.25)" stroke="#ffc94d" stroke-width="3" stroke-dasharray="6 4"/>`;
    elements.push([PLAN.profondeur(o, f), `<g${amenage ? ` data-obj="${o.id}" class="cliquable"` : ''}><title>${esc(titre)}</title>${DESSINS.get(k)}${extra}</g>`, k + extra]);
  }
  if (DESSINS.size > 400) DESSINS.clear();  // anciens emplacements oubliés de temps en temps
  cache.elements = elements.sort((a, b) => a[0] - b[0]);
  svg.push(`<g class="elements">${elements.map((x) => `<g>${x[1]}</g>`).join('')}</g>`);
  if (placement) {
    // zones autorisées pour l'objet en cours de placement
    for (const k of fiche(placement.type).pieces) {
      if (!pieceDispo(k) || !surEtage(CAT.pieces[k].rect[1])) continue;
      const [x, y, w, hh] = CAT.pieces[k].rect;
      svg.push(`<polygon points="${PLAN.empreinte(x, y, w, hh)}" fill="rgba(123,224,138,.16)" stroke="rgba(47,138,58,.9)" stroke-width="2.5" stroke-dasharray="8 5"/>`);
    }
  }
  if (vue === 'moral') {
    const t = e.moral >= 70 ? '123,224,138' : e.moral >= 55 ? '255,201,77' : '255,138,122';
    svg.push(`<polygon points="${PLAN.cadreMoral(e)}" fill="rgba(${t},.25)"/>`);
  }
  h.push(`<svg class="couche" viewBox="0 0 ${PLAN.W} ${PLAN.H}" width="${PLAN.W}" height="${PLAN.H}" xmlns="http://www.w3.org/2000/svg">${svg.join('')}</svg>`);
  // carte d'emménagement posée sur le sol du garage (vue isométrique)
  const verrou = (lid, cx, cy) => {
    const l = CAT.locaux[lid], bloque = e.renommee < l.rep, [X, Y] = PLAN.iso(cx, cy, 0);
    return `<div class="verrou" style="left:${Math.round(X - 90)}px;top:${Math.round(Y - 62)}px">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#fff7e6" stroke-width="2.4"/><rect x="5" y="11" width="14" height="10" rx="2.5" fill="#ffc94d" stroke="#2b1d14" stroke-width="1.8"/></svg>
      <b>${esc(l.nom)}</b><small>${bloque ? `Renommée ${l.rep} requise` : `Loyer ${eur(l.loyer)} / mois`}</small>
      <button type="button" class="btn petit" data-act="local" data-id="${lid}" aria-label="${esc(l.nom)} · ${eur(l.prix)}" ${bloque || e.argent < l.prix ? 'disabled' : ''}>Emménager · ${eur(l.prix)}</button></div>`;
  };
  if (carte() === 'garage') h.push(verrou('bureau', 690, 190));
  if (vue === 'prod') {
    const b = e.bonus, puce = (d, x, y, texte) => { const [X, Y] = PLAN.iso(x, y, 0); h.push(`<div class="puce-prod" style="left:${Math.round(X)}px;top:${Math.round(Y)}px;background:${DC[d]}">${texte}</div>`); };
    const txt = (d) => `${DN[d]} +${b[d] * PCT_BONUS} %`;
    if (carte() === 'garage') for (const [d, x, y] of PUCES) puce(d, x, y, txt(d));
    else {
      const ou = [['e', pieceMateriel('e')], ['m', 'atelier'], ['f', pieceMateriel('f')], ['c', pieceMateriel('e')]];
      const empile = {};
      for (const [d, k] of ou) {
        if (!k || CAT.pieces[k].etage !== etage) continue;
        const [x, y] = CAT.pieces[k].rect, n = empile[k] = (empile[k] || 0) + 1;
        puce(d, x + 20, y + 10 + 24 * (n - 1), d === 'c' ? `Tests CEM +${Math.round(b.cem * 100)} %` : txt(d));
      }
    }
  }
  majHtml('#dyn', h.join(''));
  // contour à l'écran de chaque élément, mesuré une fois : sert à cacher les personnages qui passent derrière
  const gs = $('#dyn g.elements').children;
  cache.elements.forEach((x, i) => { if (!BOITES.has(x[2])) { const r = gs[i].getBBox(); if (r.width) BOITES.set(x[2], r); } });  // plan caché : rien mesuré
  if (BOITES.size > 600) BOITES.clear();
  rendrePersos();
}

// ---------------------------------------------------------------- zoom et déplacement du plan
let zoom = null;
const echelleMin = () => Math.min(1, $('#cadre').clientWidth / PLAN.W);
function appliquerZoom(s, cx = $('#cadre').clientWidth / 2, cy = $('#cadre').clientHeight / 2) {
  const cadre = $('#cadre'), ech = $('#echelle');
  s = Math.max(echelleMin(), Math.min(2, s));
  // le point du plan sous (cx, cy) reste sous le doigt
  const wx = zoom ? (cadre.scrollLeft + cx - ech.offsetLeft) / zoom : null, wy = zoom ? (cadre.scrollTop + cy - ech.offsetTop) / zoom : null;
  zoom = s;
  ech.style.width = PLAN.W * s + 'px';
  ech.style.height = PLAN.H * s + 'px';
  $('#monde').style.transform = `scale(${s})`;
  if (wx !== null) { cadre.scrollLeft = wx * s + ech.offsetLeft - cx; cadre.scrollTop = wy * s + ech.offsetTop - cy; }
}
function recentrer() {
  // centré sur l'équipe de l'étage affiché (sinon sur le milieu du plan) : sur téléphone, on voit tout de suite du monde
  const cadre = $('#cadre'), ech = $('#echelle'), objs = Object.fromEntries(ETAT.objets.map((o) => [o.id, o]));
  const bureaux = ETAT.employes.map((x) => objs[x.bureau]).filter((o) => o && surEtage(o.y));
  const moy = (k) => bureaux.reduce((t, o) => t + o[k], 0) / bureaux.length + 30;
  const [x, y] = bureaux.length ? PLAN.iso(moy('x'), moy('y'), 0) : PLAN.centre(ETAT);
  cadre.scrollLeft = x * zoom + ech.offsetLeft - cadre.clientWidth / 2;
  cadre.scrollTop = y * zoom + ech.offsetTop - (cadre.clientHeight - (tablette() ? 0 : 260)) / 2;  // sur téléphone, le bas est caché par la barre du temps
}

// ---------------------------------------------------------------- panneaux
const ligne = (o) => `<div class="ligne">${o.avatar || `<div class="pastille" style="background:${o.couleur || '#3a4535'}"></div>`}
  <div class="txt"><div class="t1">${o.t1}</div>${o.t2 ? `<div class="t2">${o.t2}</div>` : ''}${o.t3 ? `<div class="t3">${o.t3}</div>` : ''}${o.extra || ''}</div>${o.btn || ''}</div>`;
const bouton = (act, id, texte, actif = true, cls = '', attrs = '') => `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${esc(id)}" ${attrs} ${actif ? '' : 'disabled'}>${esc(texte)}</button>`;
const repartition = (t) => `Élec ${t.e} · Méca ${t.m} · Firmware ${t.f}`;
const aDecouvrir = (x) => x.traits_caches || Object.values(x.metier).includes(null) || !x.seniorite_sure || (!x.motivation && !x.fondateur);
// Séniorité, traits, compétences métier et motivation connus ; « ? » pour ce qui reste à découvrir
function profil(x) {
  const chip = (texte, titre = '', fond = '') => `<span class="chip" title="${esc(titre)}"${fond ? ` style="background:${fond};color:#2b1d14"` : ''}>${esc(texte)}</span>`;
  const sen = CAT.seniorites[x.seniorite].nom;
  let h = chip(x.seniorite_sure ? sen : `Se dit ${sen.toLowerCase()} ?`, x.seniorite_sure ? 'Séniorité vérifiée' : 'Annoncé sur le CV, à vérifier en entretien', '#bfe6ff');
  h += x.traits.map((t) => chip(CAT.traits[t].nom, CAT.traits[t].desc)).join('');
  if (x.traits_caches) h += chip(`${x.traits_caches} trait${x.traits_caches > 1 ? 's' : ''} ?`, 'Se découvre avec le temps ou grâce au spécialiste');
  if (x.indice) h += chip(`Semble ${CAT.traits[x.indice].nom.toLowerCase()}…`, "Impression d'entretien, pas toujours juste");
  h += Object.entries(x.metier).filter(([, n]) => n !== 0).map(([m, n]) => chip(n === null ? `${CAT.metiers[m].nom} ?` : `${CAT.metiers[m].nom} ${n}`, n === null ? 'Talent caché : le spécialiste le révèle' : CAT.metiers[m].desc)).join('');
  if (x.motivation) h += chip(`Tient à : ${CAT.motivations[x.motivation].nom.toLowerCase()}`, CAT.motivations[x.motivation].desc, x.satisfait === false ? '#ff8a7a' : x.satisfait ? '#7be08a' : '');
  if (x.amis && x.amis.length) h += chip(`Ami·e de ${x.amis.join(', ')}`, 'Travaillent mieux ensemble', '#7be08a');
  if (x.froid && x.froid.length) h += chip(`En froid avec ${x.froid.join(', ')}`, 'Moins efficaces ensemble ; un chef de projet apaise', '#ff8a7a');
  return `<div class="chips" style="margin-top:4px">${h}</div>`;
}
const requisListe = (r) => (!r ? [] : Array.isArray(r) ? r : [r]);
const nomRequis = (r) => requisListe(r).map((x) => (CAT.technos[x] || CAT.certifs[x] || { nom: x }).nom).join(' + ');
const etoiles = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const barre = (label, fait, besoin, couleur) => `<div class="barre-l"><span>${label}</span><div class="jauge"><i style="width:${Math.min(100, Math.round(100 * fait / Math.max(1, besoin)))}%;background:${couleur}"></i></div><span>${Math.floor(fait)} / ${besoin}</span></div>`;
const couleurNote = (n) => (n >= 7.5 ? '#7be08a' : n >= 5.5 ? '#ffc94d' : '#ff8a7a');

function etapeProjet(p) {
  if (p.etape === 'debug') return `Debug · ${dec(p.defauts)} défauts`;
  if (p.etape === 'cem') return `Tests CEM (${p.cem_jours} j)`;
  const ph = p.phases[p.phase];
  return ph.attente ? (ph.essais ? `Essais de qualification (${ph.attente} j)` : `Fabrication du proto (${ph.attente} j)`) : ph.nom;
}

function avancement(p) {
  let fait = 0, besoin = 0;
  for (const ph of p.phases) for (const d in ph.besoin) { fait += Math.min(ph.fait[d], ph.besoin[d]); besoin += ph.besoin[d]; }
  return besoin ? fait / besoin : 1;
}

function encartProjet(p) {
  const e = ETAT;
  const etapes = p.phases.map((_, i) => `<span class="${i < p.phase || p.etape !== 'travail' ? 'ok' : i === p.phase ? 'cours' : ''}"></span>`).join('') +
    `<span class="${p.etape === 'cem' ? 'cours' : ''}" title="Tests CEM"></span>`;
  const ph = p.phases[p.phase];
  const equipe = e.employes.filter((x) => p.equipe.includes(x.id)).map((x) => esc(x.nom)).join(', ') || 'personne pour le moment';
  const chefP = e.employes.find((x) => x.id === p.chef);
  const combos = p.combos_jour.map((c) => `<span class="chip" style="background:#b08af0;color:#2b1d14" title="${esc(CAT.combos[c].desc)}">${esc(CAT.combos[c].nom)}</span>`).join('');
  return `<div class="encart"><div class="t2" style="font-size:11px;font-weight:800;letter-spacing:1px;color:#a9b39a">${p.type === 'contrat' ? esc(p.client).toUpperCase() : 'PRODUIT MAISON'}</div>
    <h3>${esc(p.nom)}</h3><div class="etapes">${etapes}</div>
    <div class="chips"><span class="chip">${esc(etapeProjet(p))}</span>${p.type === 'contrat' ? `<span class="chip" style="${p.jours > p.delai ? 'background:#ff8a7a;color:#2b1d14' : ''}">Jour ${p.jours} / ${p.delai}</span>` : `<span class="chip">Jour ${p.jours}</span>`}
    <span class="chip" style="background:${couleurNote(p.note_estimee)};color:#2b1d14">Note estimée ${dec(p.note_estimee)}</span><span class="chip">${dec(p.defauts)} défauts</span></div>
    ${combos ? `<div class="chips">${combos}</div>` : ''}
    ${p.etape === 'travail' ? `<div class="barres">${Object.keys(ph.besoin).map((d) => barre(DN[d], ph.fait[d], ph.besoin[d], DC[d])).join('')}</div>` : ''}
    <div class="t2" style="font-size:13px;color:#b3bca5">Équipe du jour : ${equipe}</div>
    ${p.chef && chefP ? `<div class="t2" style="font-size:13px;color:#b3bca5">Chef de projet : ${esc(chefP.nom)} · suivi ${Math.round(p.suivi * 100)} %${p.suivi < 1 ? ' (il suit plusieurs projets)' : ''} · il compose l'équipe${p.type === 'contrat' ? ` · prime de ${eur(p.paie * 0.08 * p.suivi)} si livré à l'heure et bien noté` : ''}</div>` : ''}
    <div class="t2" style="font-size:13px;color:#b3bca5">Tests CEM : ${Math.round(p.proba_cem * 100)} % de réussite · labo externe ${eur(p.frais_cem)}, 3 jours</div>
    ${p.etape === 'travail' && ph.attente ? `<div class="t2" style="font-size:13px;color:#b3bca5">${ph.essais ? `Essais en étuve et sur pot vibrant : encore ${ph.attente} j.` : `Les PCB sont en fabrication : retour dans ${ph.attente} j.`} L'équipe en profite pour chasser les défauts.</div>` : ''}
    <div class="btns">${p.etape === 'debug' ? bouton('tests_cem', p.id, 'Passer aux tests CEM') : ''}${bouton('abandonner', p.id, 'Abandonner', true, 'secondaire petit')}</div></div>`;
}

function panneauProjets() {
  const e = ETAT, plein = e.places >= e.capacite;
  const plus = !e.locaux.includes('bureau') ? ' · emménagez dans le bâtiment pour en mener plus' : e.capacite < 6 ? ' · chaque chef de projet ajoute une place' : '';
  let h = `<div class="section">En cours · ${e.places} / ${e.capacite} place${e.capacite > 1 ? 's' : ''}${plus}</div>`;
  h += e.projets.map(encartProjet).join('') || '<div class="vide">Aucun projet : signez un contrat ci-dessous.</div>';
  h += `<div class="section">Appels d'offres · les clients attendent ${dec(e.attente_client)}/10</div>`;
  if (e.nb_commerciaux) h += `<label class="t2" style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px">Prospection
    <select class="choix" data-prospecter="1"><option value="">Tous secteurs</option>${Object.entries(CAT.secteurs).map(([k, s]) => `<option value="${k}" ${e.prospection === k ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
    <div class="t2" style="font-size:12px;color:#b3bca5">${e.nb_commerciaux} ${e.nb_commerciaux > 1 ? 'commerciaux' : 'commercial'} · offres +${Math.round(CAT.prime_commercial * 100) * Math.min(3, e.nb_commerciaux)} % mieux payées · négociation réussie ${Math.round(e.chance_commerciale * 100)} % (sinon le client part) · commission ${Math.round(CAT.commission * 100)} % des contrats signés par commercial</div>`;
  h += e.offres.length ? [...e.offres].sort((a, b) => (b.mega || 0) - (a.mega || 0) || (b.fidele || 0) - (a.fidele || 0)).map((o) => {
    const complet = e.places + (o.mega ? 2 : 1) > e.capacite;
    const equipe = o.equipe_min && e.employes.length < o.equipe_min;
    const secteur = CAT.secteurs[o.secteur] ? CAT.secteurs[o.secteur].nom + ' · ' : '';
    return ligne({
      couleur: o.mega ? '#ff9a4a' : o.fidele ? '#ffc94d' : '#7be08a',
      t1: (o.mega ? '<span class="badge mega">MÉGA-PROJET</span> ' : '') + esc(o.nom),
      t2: `${esc(secteur)}${esc(o.client)}${o.fidele ? ` <span class="fid" title="Client fidèle : projet plus gros, négociation plus facile">${etoiles(o.fidele)}</span>` : ''} · ${eur(o.paie)} · ${o.delai} j`,
      t3: `${repartition(o.total)} · expire dans ${o.expire} j${o.requis ? ' · ' + esc(nomRequis(o.requis)) : ''}${CAT.exigeants.includes(o.secteur) ? ' · qualification obligatoire' : ''}${o.mega ? ` · compte pour 2 projets · équipe de ${o.equipe_min} minimum` : ''}`,
      extra: e.nb_commerciaux && !o.negociee ? `<div class="btns"><span style="align-self:center;font-size:13px;color:#b3bca5">Négocier</span>${bouton('negocier', o.id, '+15 % payé', true, 'petit secondaire', 'data-cible="prix" aria-label="Négocier : 15 % de plus"')}${bouton('negocier', o.id, '+25 % de délai', true, 'petit secondaire', 'data-cible="delai" aria-label="Négocier : 25 % de délai en plus"')}</div>` : '',
      btn: bouton('sig-ouvrir', o.id, complet ? 'Complet' : equipe ? `${o.equipe_min} pers. requises` : 'Signer', !complet && !equipe, '', 'data-genre="signer"'),
    });
  }).join('') : '<div class="vide">Aucune offre pour le moment, patientez quelques jours.</div>';
  h += `<div class="section">Produits maison</div>`;
  h += CAT.produits.map((x) => {
    const avant = x.suite && CAT.produits.find((y) => y.id === x.suite);
    const sansV1 = avant && !(x.suite in e.gammes);
    const sansTech = x.requis && !e.technos.includes(x.requis);
    const idee = x.innovation && !e.roles_actifs.innov;
    const bloque = e.renommee < x.rep_min;
    const occupe = e.places >= e.capacite || [...e.produits, ...e.projets].some((y) => y.id_produit === x.id);
    const lance = x.id in e.gammes;
    const bonus = avant && !sansV1 ? Math.round(8 * Math.max(0, e.gammes[x.suite] - 6)) : 0;
    const total = { e: Math.round(x.taille * x.rep[0]), m: Math.round(x.taille * x.rep[1]), f: Math.round(x.taille * x.rep[2]) };
    const infos = [x.innovation ? "Idée du chargé d'innovation" : '', avant ? `Suite de « ${esc(avant.nom)} »${bonus ? ` · ventes +${bonus} %` : ''}` : '', x.requis ? esc(nomRequis(x.requis)) : '', lance ? `Déjà lancé (meilleure note ${dec(e.gammes[x.id])})` : ''].filter(Boolean).join(' · ');
    return ligne({
      couleur: lance ? '#7be08a' : '#b08af0', t1: esc(x.nom), t2: `Prototype ${eur(x.cout)} · jusqu'à ~${eur(x.potentiel * 0.5)}/mois`, t3: repartition(total) + (infos ? ' · ' + infos : ''),
      btn: bouton('sig-ouvrir', x.id, bloque ? `★ ${x.rep_min} requis` : sansV1 ? 'Après la v1' : sansTech ? 'Techno requise' : idee ? 'Innovation requise' : occupe ? 'Indisponible' : 'Lancer',
        !bloque && !sansV1 && !sansTech && !idee && !occupe && e.argent >= x.cout, '', 'data-genre="produit"'),
    });
  }).join('');
  if (e.produits.length) {
    const place = e.stock_max - e.stock_total;
    h += `<div class="section">En vente · stock ${e.stock_total} / ${e.stock_max} unités (commandes comprises)</div>
      <div class="t2" style="font-size:12px;color:#b3bca5;margin-top:4px">Fabriqués par lots chez le sous-traitant : un gros lot coûte moins cher par unité, mais les invendus restent sur les bras. Stockage ${dec(CAT.stockage)} € par unité et par mois.</div>`;
    h += e.produits.map((x) => {
      const cmd = e.commandes.filter((c) => c.produit === x.id_produit);
      const lots = Object.entries(CAT.lots).map(([q, [coef, j]]) => {
        const cout = Math.round(q * x.cout_unite * coef / 10) * 10;
        return bouton('commander', x.id_produit, `Lot ${q} · ${eur(cout)}`, Number(q) <= place && e.argent >= cout, 'petit secondaire', `data-qte="${q}" title="${j} jours de fabrication"`);
      }).join('');
      return ligne({
        couleur: couleurNote(x.note), t1: esc(x.nom),
        t2: `Note ${dec(x.note)}/10 · ${x.prix} € pièce (coût ${dec(x.cout_unite)} €) · demande ${x.demande} / mois · en stock ${x.stock}`,
        t3: `${cmd.length ? 'En fabrication : ' + cmd.map((c) => `${c.qte} (${c.jours} j${c.retard ? ', en retard' : ''})`).join(', ') + ' · ' : ''}Total encaissé ${eur(x.total)}`,
        extra: `<div class="btns">${lots}</div>`,
      });
    }).join('');
    h += `<div class="btns">${bouton('agrandir_stock', '', `Agrandir le stock +${CAT.agrandir_stock[1]} · ${eur(CAT.agrandir_stock[0])}`, e.locaux.includes('bureau') && e.argent >= CAT.agrandir_stock[0], 'petit secondaire')}</div>`;
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
  const H = CAT.horaires[e.heures];
  let h = `<div class="section">Horaires de travail</div><div class="onglets">${Object.keys(CAT.horaires).map((k) =>
    `<button type="button" data-act="horaires" data-heures="${k}" class="${String(e.heures) === k ? 'actif' : ''}" style="${String(e.heures) === k ? 'background:#ffc94d' : ''}">${k} h</button>`).join('')}</div>
    <div class="t2" style="font-size:13px;color:#b3bca5">${esc(H.nom)} · production ${H.prod >= 1 ? '+' : ''}${Math.round((H.prod - 1) * 100)} % · moral ${H.moral >= 0 ? '+' : ''}${H.moral} · fatigue ×${dec(H.fatigue)} · défauts ×${dec(H.defauts)}${H.salaire ? ` · heures sup +${Math.round(H.salaire * 100)} % de salaires` : ''}</div>`;
  h += `<div class="section">Vie d'équipe</div><div class="t2" style="font-size:13px;color:#b3bca5;margin-top:4px">Séminaire de 2 jours : moral +6 et fatigue effacée pour tous. Anniversaires et pots de livraison se fêtent tout seuls.</div>
    <div class="btns">${bouton('seminaire', '', e.seminaire_dans ? `Séminaire possible dans ${e.seminaire_dans} j` : `Organiser un séminaire · ${eur(e.cout_seminaire)}`, !e.seminaire_dans && e.argent >= e.cout_seminaire, 'petit')}</div>`;
  h += `<div class="section">Services et direction</div>` + ['e', 'm', 'f'].map((d) => {
    const s = e.services[d], resp = e.employes.find((x) => x.role === 'resp_' + d), seuil = CAT.service_sans_resp, r = CAT.roles['resp_' + d];
    const malus = s.resp == null && s.n > seuil ? Math.min(20, 4 * (s.n - seuil)) : 0;
    return ligne({
      couleur: DC[d], t1: `Service ${DN[d]} · ${s.n} personne${s.n > 1 ? 's' : ''}`,
      t2: resp ? `Responsable : ${esc(resp.nom)}${s.resp != null ? ' · production +8 % et moral +5 pour le service' : ' · inactif : il lui faut un bureau de responsable pour lui seul'}`
        : malus ? `Sans responsable : −${malus} % d'efficacité pour tout le service` : `Pas de responsable (indispensable au-delà de ${seuil} personnes)`,
      t3: `Responsable : ${r.min} en ${DN[d]}, bureau de responsable · +${eur(r.salaire)} / mois`,
    });
  }).join('') + [['dir_rd', 'Recherches 2× plus rapides et 25 % moins chères, note +0,2'], ['innov', 'Idées de produits exclusives, brevets, produits maison note +0,3']].map(([r, effet]) => {
    const x = e.employes.find((y) => y.role === r);
    return ligne({ couleur: '#b08af0', t1: CAT.roles[r].nom, t2: x ? `${esc(x.nom)}${x.role_actif ? '' : ' · inactif : son bureau doit être à la direction R&D'}` : `Poste vacant · ${CAT.roles[r].total} points de compétences requis, bureau à la direction R&D (R+1)`, t3: effet });
  }).join('');
  h += `<div class="section">Équipe · ${e.employes.length} / ${e.postes_ouverts.length} postes · moral ${e.moral} %</div>`;
  h += e.employes.map((x) => {
    const etat = x.absent ? `${x.formation ? 'Formation ' + DN[x.formation] : ABSENCE[x.absence] || 'Absent'} : retour dans ${x.absent} j` : x.stage ? `Stage gratuit : encore ${x.stage} j` : x.salaire ? eur(x.salaire) + ' / mois' : 'Gérant';
    const promu = !x.chef && !x.stage && x.e + x.m + x.f >= (x.traits.includes('leader') ? 10 : 14);
    const roles = Object.entries(CAT.roles).filter(([k, r]) => !x.role && !x.stage && !e.employes.some((y) => y.role === k) && (r.dom ? x[r.dom] >= r.min : x.e + x.m + x.f >= r.total));
    const btns = `<div class="btns">${['e', 'm', 'f'].map((d) => `<button type="button" class="btn petit secondaire" data-act="former" data-id="${x.id}" data-dom="${d}" ${x.absent || e.argent < x.cout_formation ? 'disabled' : ''}>Former ${DN[d]}</button>`).join('')}
      ${bouton('conges', x.id, 'Congés', !x.absent, 'petit secondaire')}${promu ? bouton('promouvoir', x.id, 'Promouvoir chef de projet', true, 'petit') : ''}${roles.map(([k, r]) => bouton('nommer', x.id, 'Nommer ' + r.nom, true, 'petit', `data-role="${k}"`)).join('')}${x.role ? bouton('nommer', x.id, 'Retirer le rôle', true, 'petit secondaire', 'data-role=""') : ''}${aDecouvrir(x) ? bouton('specialiste', x.id, `Spécialiste · ${eur(e.cout_specialiste)}`, e.argent >= e.cout_specialiste, 'petit secondaire') : ''}${x.fondateur ? '' : bouton('licencier', x.id, 'Licencier', true, 'petit secondaire')}</div>
      <div class="t2" style="font-size:12px">Formation : ${eur(x.cout_formation)}, ${10} jours, +2 dans le domaine</div>
      ${e.projets.length > 1 ? `<label class="t2" style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px">Projet
        <select class="choix" data-affecter="${x.id}"><option value="">Automatique</option>${e.projets.map((p) => `<option value="${p.id}" ${x.projet === p.id ? 'selected' : ''}>${esc(p.nom)} · ${esc(p.client || 'maison')}</option>`).join('')}</select></label>` : ''}`;
    return ligne({
      avatar: sprite(x), t1: `${esc(x.nom)} — ${esc(x.poste)}`, t2: repartition(x),
      t3: etat + (x.fondateur ? '' : ` · ${x.anciennete < 1 ? "moins d'un an" : Math.floor(x.anciennete) + ' an' + (x.anciennete >= 2 ? 's' : '')} dans la maison`),
      extra: `${profil(x)}<div class="chips" style="margin-top:4px"><span class="chip" style="background:${x.moral >= 70 ? '#7be08a' : x.moral >= 50 ? '#ffc94d' : '#ff8a7a'};color:#2b1d14">Moral ${x.moral} %</span><span class="chip">Fatigue ${Math.round(x.fatigue)}</span><span class="chip" title="Moral × conditions de travail × trait">Efficacité ${x.efficacite} %</span>${x.chef ? '<span class="chip" style="background:#ffc94d;color:#2b1d14" title="Suit des projets : une place de projet de plus, meilleure note, moins de retards et d\'erreurs">Chef de projet</span>' : ''}${x.commercial ? `<span class="chip" style="background:#7cc0f2;color:#2b1d14" title="Négocie les offres, prospecte un secteur ; touche une commission">Commercial·e</span>` : ''}${x.role ? `<span class="chip" style="background:${x.role_actif ? '#b08af0' : '#ff8a7a'};color:#2b1d14">${esc(CAT.roles[x.role].nom)}${x.role_actif ? '' : ' · inactif'}</span>` : ''}<span class="chip" title="Encadrement du service et bureau du service">Service ${DN[x.service]}${Math.round((x.facteur_service - 1) * 100) ? ` ${x.facteur_service > 1 ? '+' : '−'}${Math.abs(Math.round((x.facteur_service - 1) * 100))} %` : ''}</span>${x.piece ? `<span class="chip">${esc(CAT.pieces[x.piece].nom)}${CAT.pieces[x.piece].etage !== 'garage' ? ' · ' + esc(CAT.etages[CAT.pieces[x.piece].etage].nom) : ''}</span>` : ''}</div>${btns}`,
    });
  }).join('');
  h += `<div class="section">Candidats${libres ? '' : ' · placez un bureau de plus (Locaux) pour recruter'}</div>`;
  h += e.candidats.map((c) => {
    return ligne({
      avatar: sprite(c), t1: `${esc(c.nom)} — ${esc(c.poste)}`, t2: repartition(c),
      t3: `${eur(c.salaire)} / mois${c.role_propose ? ` · arrive comme ${esc(CAT.roles[c.role_propose].nom)}` : ''}${c.chef ? ' · chef de projet' : ''}${c.commercial ? ` · + commission de ${Math.round(CAT.commission * 100)} % sur les contrats` : ''}`,
      extra: `${profil(c)}<div class="btns">${c.entretien_fait ? '' : bouton('entretien', c.id, `Entretien · ${eur(CAT.cout_entretien)}`, e.argent >= CAT.cout_entretien, 'petit secondaire')}${aDecouvrir(c) ? bouton('specialiste', c.id, `Spécialiste · ${eur(e.cout_specialiste)}`, e.argent >= e.cout_specialiste, 'petit secondaire') : ''}</div>`,
      btn: bouton('embaucher', c.id, libres ? 'Embaucher' : 'Pas de bureau', libres > 0),
    });
  }).join('') || '<div class="vide">Nouveaux candidats le mois prochain.</div>';
  h += `<div class="section">Combos d'équipe</div>` + Object.entries(CAT.combos).map(([id, c]) => ligne({
    couleur: e.combos_vus.includes(id) ? '#b08af0' : '#3a4535', t1: esc(c.nom), t2: esc(c.desc),
  })).join('');
  return h;
}

function panneauMateriel() {
  const e = ETAT, b = e.bonus;
  let h = `<div class="onglets">${['e', 'm', 'f'].map((k) => `<button type="button" data-act="catmat" data-id="${k}" class="${catMat === k ? 'actif' : ''}" style="${catMat === k ? 'background:' + DC[k] : ''}">${DN[k]}</button>`).join('')}</div>`;
  const resume = `production +${b[catMat] * PCT_BONUS} % · debug +${b.debug} · tests CEM +${Math.round(b.cem * 100)} %`;
  h += `<div class="section">${DN[catMat]} · ${resume}</div><div class="t2" style="font-size:13px;color:#b3bca5;margin-top:4px">Choisissez « Placer », puis touchez le plan à l'endroit voulu.</div>`;
  h += Object.entries(CAT.materiel).filter(([, m]) => m.dom === catMat).map(([id, m]) => {
    const effets = [m.bonus && `+${m.bonus * PCT_BONUS} % ${DN[m.dom]}`, m.debug && `debug +${m.debug}`, m.cem && `CEM +${Math.round(m.cem * 100)} %`].filter(Boolean).join(' · ');
    const possede = e.materiel.includes(id);
    const local = !m.pieces.some((k) => !CAT.pieces[k].local || e.locaux.includes(CAT.pieces[k].local));
    return ligne({
      couleur: DC[m.dom], t1: esc(m.nom), t2: `${effets} · ${eur(m.prix)}`, t3: `${esc(CAT.pieces[m.piece].nom)}${m.pieces.filter((k) => k !== m.piece && k !== 'garage').map((k) => ' ou ' + esc(CAT.pieces[k].nom)).join('')}${id in e.pannes ? ` · en panne (${e.pannes[id]} j)` : ''}`,
      btn: bouton('placer', id, possede ? 'Installé' : local ? 'Local requis' : 'Placer', !possede && !local && e.argent >= m.prix),
    });
  }).join('');
  return h;
}

function panneauLocaux() {
  const e = ETAT;
  const libres = e.postes_ouverts.length - e.employes.length;
  let h = `<div class="btns" style="margin-top:6px">${bouton('amenage', '', amenage ? "Quitter le mode aménagement" : 'Déplacer ou revendre des objets', true, 'secondaire')}</div>`;
  h += `<div class="section">Mobilier</div>` + ligne({
    couleur: '#d0955a', t1: 'Bureau de travail', t2: `${eur(CAT.poste.prix)} · un poste par employé`,
    t3: `${e.postes_ouverts.length} bureau${e.postes_ouverts.length > 1 ? 'x' : ''}, ${libres} libre${libres > 1 ? 's' : ''}`,
    btn: bouton('placer', 'poste', 'Placer', e.argent >= CAT.poste.prix),
  });
  const l = CAT.locaux.bureau, fait = e.locaux.includes('bureau');
  h += `<div class="section">Bâtiment</div>` + ligne({
    couleur: fait ? '#7be08a' : '#efc488', t1: esc(l.nom), t2: fait ? 'Tout le bâtiment est à vous : grandissez en embauchant.' : esc(l.desc), t3: `${eur(l.prix)} · loyer ${eur(l.loyer)} / mois`,
    btn: bouton('local', 'bureau', fait ? 'Emménagé' : e.renommee < l.rep ? `★ ${l.rep} requis` : 'Emménager', !fait && e.renommee >= l.rep && e.argent >= l.prix, 'petit'),
  });
  if (fait) {
    const nb = (f) => e.employes.filter((x) => x.piece && CAT.pieces[x.piece].fonction === f).length;
    const pct = (q) => `qualité ${Math.round(q * 100)} %`;
    h += `<div class="section">Pièces utiles</div>` + [
      ['cdp', `${nb('cdp')} chef${nb('cdp') > 1 ? 's' : ''} de projet installé${nb('cdp') > 1 ? 's' : ''} : leur bonus y est 50 % plus fort`],
      ['indus', `Industrialisation : ${pct(e.qualite_indus)} · installez-y le bureau d'un employé doué en indus`],
      ['qualif', `Essais et qualification : ${pct(e.qualite_qualif)} · installez-y un employé doué en qualif`],
      ['reception', 'Contrôle des lots du sous-traitant : un bon qualiticien repère les lots défectueux'],
      ['opensp', `${e.nb_commerciaux} ${e.nb_commerciaux > 1 ? 'commerciaux' : 'commercial'} : négociation, prospection, une offre de plus chacun (3 au plus)`],
      ['cantine', 'Moral +5 et meilleure récupération de la fatigue'],
      ['rd', "Bureaux du directeur R&D et du chargé·e d'innovation"],
      ['dg', 'Votre bureau ici : négociation +10 % et levée de fonds +30 %'],
    ].map(([k, t]) => ligne({ couleur: '#efc488', t1: `${esc(CAT.pieces[k].nom)} · ${esc(CAT.etages[CAT.pieces[k].etage].nom)}`, t2: t, btn: bouton('voir', k, 'Voir', true, 'petit secondaire', `aria-label="Voir ${esc(CAT.pieces[k].nom)} sur le plan"`) })).join('');
  }
  h += `<div class="section">Aménagement · moral ${e.moral} %</div>`;
  h += Object.entries(CAT.deco).map(([id, d]) => {
    const fait = e.deco.includes(id) && !d.multiple;
    const local = !d.global && !d.pieces.some((k) => !CAT.pieces[k].local || e.locaux.includes(CAT.pieces[k].local));
    const ou = d.global ? 'Amélioration de tous les locaux' : d.pieces.length < Object.keys(CAT.pieces).length ? 'Pièces : ' + d.pieces.map((k) => CAT.pieces[k].nom).join(', ') : '';
    const n = e.objets.filter((o) => o.type === id).length;
    return ligne({
      couleur: '#7be08a', t1: esc(d.nom) + (n > 1 ? ` ×${n}` : ''), t2: `Moral +${d.moral} · ${eur(d.prix)}`, t3: [d.effet, ou].filter(Boolean).join(' · '),
      btn: bouton(d.global ? 'deco' : 'placer', id, fait ? 'Installé' : local ? 'Local requis' : d.global ? 'Acheter' : 'Placer', !fait && !local && e.argent >= d.prix),
    });
  }).join('');
  h += `<div class="section">Conditions de travail · productivité ×${dec(e.facteur_conditions)}</div>` + (e.conditions.length
    ? e.conditions.map((c) => ligne({ couleur: c.pct > 0 ? '#7be08a' : c.pct < 0 ? '#ff8a7a' : '#a9b39a', t1: esc(c.nom), t2: `${c.pct > 0 ? '+' : ''}${c.pct} % de productivité` })).join('')
    : '<div class="vide">Aucun bonus ni malus pour le moment.</div>');
  h += `<div class="section">Charges mensuelles</div><div class="stat" style="margin-top:8px"><span>Loyer</span><b>${eur(e.loyer)}</b><span>Salaires</span><b>${eur(e.salaires)}</b><span>Frais de structure</span><b>${eur(e.frais_structure)}</b></div>`;
  return h;
}

function rechercheLigne(genre, id, f, acquis) {
  const e = ETAT, cours = e.recherches.find((r) => r.id === id);
  const occupe = e.recherches.some((r) => r.genre === genre);
  const requis = f.requis && !acquis.includes(f.requis);
  const act = genre === 'tech' ? 'recherche' : 'certifier';
  let btn;
  if (acquis.includes(id)) btn = bouton(act, id, genre === 'tech' ? 'Maîtrisée' : 'Obtenue', false, 'petit');
  else if (cours) btn = bouton(act, id, `${cours.total - cours.jours} / ${cours.total} j`, false, 'petit');
  const directeur = genre === 'tech' && e.roles_actifs.dir_rd, prix = directeur ? Math.floor(f.prix * 0.75) : f.prix, jours = directeur ? Math.ceil(f.jours / 2) : f.jours;
  if (!btn) btn = bouton(act, id, requis ? 'Prérequis' : occupe ? 'Patientez' : 'Lancer', !requis && !occupe && e.argent >= prix, 'petit');
  return ligne({ couleur: acquis.includes(id) ? '#7be08a' : '#b08af0', t1: esc(f.nom), t2: `${esc(f.desc)}`, t3: `${eur(prix)} · ${jours} jours${f.requis ? ' · après ' + esc((CAT.technos[f.requis] || CAT.certifs[f.requis]).nom) : ''}`, btn });
}

function panneauSociete() {
  const e = ETAT;
  let h = '';
  const obj = e.progres_objectif;
  if (obj) h += `<div class="encart"><h3>${esc(obj.scenario)}</h3><div class="t2" style="font-size:14px">${esc(obj.texte)}</div><div class="t2" style="font-size:13px;color:#b3bca5">${e.victoire ? esc(e.victoire.texte) : `Encore ${obj.mois_restants} mois`}</div></div>`;
  h += `<div class="section">Recherche et technologies</div>` + Object.entries(CAT.technos).map(([id, f]) => rechercheLigne('tech', id, f, e.technos)).join('');
  h += `<div class="section">Certifications · entretien ${eur(CAT.entretien_certif)} / mois chacune</div>` + Object.entries(CAT.certifs).map(([id, f]) => rechercheLigne('certif', id, f, e.certifs)).join('');
  h += `<div class="section">Fournisseur de composants</div>` + Object.entries(CAT.fournisseurs).map(([id, f]) => ligne({
    couleur: e.fournisseur === id ? '#ffc94d' : '#3a4535', t1: esc(f.nom), t2: esc(f.desc),
    btn: bouton('fournisseur', id, e.fournisseur === id ? 'Actuel' : 'Choisir', e.fournisseur !== id, 'petit'),
  })).join('');
  h += `<div class="section">Finances</div><div class="stat" style="margin-top:8px"><span>Dette restante</span><b>${eur(e.dette)}</b><span>Mensualités</span><b>${eur(e.mensualites)}</b><span>Plafond bancaire</span><b>${eur(e.plafond_pret)}</b><span>Capital détenu</span><b>${Math.round(e.parts * 100)} %</b></div>
    <div class="btns">${CAT.prets.map((m) => bouton('emprunter', '', `Emprunter ${eur(m)}`, e.dette + m * 1.12 <= e.plafond_pret * 1.12, 'petit secondaire', `data-montant="${m}"`)).join('')}${e.prets.length ? bouton('rembourser', '', 'Rembourser par anticipation', true, 'petit') : ''}</div>
    <div class="t2" style="font-size:12px;color:#b3bca5;margin-top:4px">Remboursement sur 24 mois, taux 6 % par an.</div>`;
  h += ligne({ couleur: '#b08af0', t1: 'Levée de fonds', t2: e.parts < 1 ? 'Déjà réalisée' : `+${eur(e.levee_possible)} contre 20 % du capital (score final ×0,8)`, t3: e.renommee < 5 ? 'Renommée 5 requise' : '',
    btn: bouton('lever', '', 'Lever', e.parts >= 1 && e.renommee >= 5, 'petit') });
  h += `<div class="section">Investissements de fin de partie</div>` + Object.entries(CAT.investissements).map(([k, inv]) => {
    const n = e.investissements[k] || 0, prix = e.prix_investissements[k], fort = [...e.concurrents].sort((a, b) => b.renommee - a.renommee)[0];
    const attente = k === 'campagne' ? 360 - (e.jours_total - e.derniere_campagne) : 0;
    const bloque = !e.locaux.includes('bureau') ? "Après l'emménagement" : e.renommee < inv.rep ? `★ ${inv.rep} requis`
      : (k === 'formation' || k === 'filiale') && n ? 'Fait' : k === 'rachat' && (n >= 2 || e.concurrents.length < 2) ? 'Plus possible'
      : attente > 0 ? `Dans ${attente} j` : '';
    const suivi = k === 'campagne' && n ? ` · ${n} faite${n > 1 ? 's' : ''}` : k === 'rachat' ? ` · ${n} / 2 · cible : ${esc(fort.nom)} (renommée ${fort.renommee})` : '';
    return ligne({ couleur: n ? '#7be08a' : '#b08af0', t1: esc(inv.nom), t2: esc(inv.desc), t3: eur(prix) + suivi,
      btn: bouton('investir', k, bloque || 'Investir', !bloque && e.argent >= prix, 'petit') });
  }).join('');
  h += `<div class="section">Production en série</div>` + (e.series.length ? e.series.map((x) => ligne({ couleur: '#7be08a', t1: esc(x.nom), t2: `${esc(x.client)} · ~${eur(x.marge)} / mois`, t3: `Encore ${x.mois} mois` })).join('')
    : '<div class="vide">Livrez de beaux projets (7/10 ou plus) : certains clients commandent ensuite une série.</div>');
  h += `<div class="section">Brevets · 3 au plus</div>` + (e.brevets.length ? e.brevets.map((x) => ligne({ couleur: '#ffc94d', t1: esc(x.nom), t2: `Licences ${eur(x.revenu)} / mois`, t3: `Encore ${x.mois} mois` })).join('')
    : `<div class="vide">Nommez un·e chargé·e d'innovation (direction R&D) : ses idées peuvent être brevetées.</div>`);
  h += `<div class="section">Garanties en cours</div>` + (e.garanties.length ? e.garanties.map((g) => ligne({ couleur: '#ff8a7a', t1: esc(g.nom), t2: `${esc(g.client)} · ${dec(g.defauts)} défauts livrés`, t3: `Garantie encore ${g.jours} j` })).join('')
    : '<div class="vide">Aucun projet livré avec des défauts : pas de risque de retour SAV.</div>');
  h += `<div class="section">Clients</div>` + (e.clients_top.length ? e.clients_top.map((c) => ligne({
    couleur: c.fid >= 3 ? '#ffc94d' : '#3a4535', t1: `${esc(c.nom)} <span class="fid">${etoiles(c.fid)}</span>`, t2: `${esc(c.niveau)}${c.secteur ? ' · ' + esc(c.secteur) : ''}`,
    t3: `${c.livres} projet${c.livres > 1 ? 's' : ''} livré${c.livres > 1 ? 's' : ''}`,
  })).join('') + '<div class="t2" style="font-size:12px;color:#b3bca5;margin-top:4px">Une note au-dessus de l\'attente rend un client plus fidèle : il revient avec des projets plus gros et négocie plus facilement.</div>'
    : '<div class="vide">Livrez vos premiers contrats : les clients satisfaits reviendront.</div>');
  h += `<div class="section">Concurrence</div>` + e.classement.map((c, i) => ligne({ couleur: c.vous ? '#ffc94d' : '#3a4535', t1: `${i + 1}. ${esc(c.nom)}`, t2: `Renommée ${c.renommee}` })).join('');
  return h;
}

function panneauJournal(limite) {
  const j = ETAT.journal.slice(0, limite).map((x) => `<div class="journal-l ${x.genre}"><span class="d">${esc(x.date)}</span><span class="t">${esc(x.texte)}</span></div>`).join('');
  return j + `<div class="btns" style="margin-top:16px">${bouton('parties', '', 'Parties et sauvegardes', true, 'secondaire petit')}</div>`;
}

function chipsTrophees(e) {
  return `<div class="chips" style="margin-top:8px">${Object.entries(CAT.trophees).map(([id, t]) => {
    const ok = e.trophees.includes(id);
    return `<span class="chip" style="${ok ? 'background:#ffc94d;color:#2b1d14' : 'opacity:.6'}" title="${esc(t.desc)}">${ok ? '★ ' : ''}${esc(t.nom)}</span>`;
  }).join('')}</div>`;
}
function panneauAccueil() {
  const e = ETAT;
  return `<div class="encart"><div class="stat">
    <span>Trésorerie</span><b>${eur(e.argent)}</b>
    <span>Année</span><b>${e.annee_jeu} / 20</b>
    <span>Charges / mois</span><b>${eur(e.loyer + e.salaires + e.frais_structure)}</b>
    <span>Chiffre d'affaires total</span><b>${eur(e.stats.ca)}</b>
    <span>Contrats livrés</span><b>${e.stats.livres}</b>
    <span>Produits lancés</span><b>${e.stats.produits_lances}</b>
    <span>Équipe</span><b>${e.employes.length} personne${e.employes.length > 1 ? 's' : ''}</b>
    <span>Moral</span><b>${e.moral} %</b></div></div>
    <div class="section">Missions · ${e.missions.length} / ${CAT.nb_missions}</div>
    ${e.missions_actives.length ? e.missions_actives.map((m) => ligne({
      couleur: '#ffc94d', t1: esc(m.texte), t2: `Récompense ${eur(m.argent)}${m.renommee ? ` · renommée +${m.renommee}` : ''}`,
      extra: `<div class="jauge" style="margin-top:4px"><i style="width:${Math.round(100 * m.progres / m.seuil)}%;background:#ffc94d"></i></div><div class="t3">${dec(m.progres)} / ${m.seuil}</div>`,
    })).join('') : '<div class="vide">Toutes les missions sont accomplies. Bravo !</div>'}
    <div class="section">Trophées · ${e.trophees.length} / ${Object.keys(CAT.trophees).length}</div>
    ${chipsTrophees(e)}
    ${e.bilans.length ? `<div class="section">Bilans annuels</div>` + e.bilans.slice(-5).reverse().map((b) => ligne({
      couleur: b.benefice >= 0 ? '#7be08a' : '#ff8a7a', t1: `Année ${b.annee}`, t2: `CA ${eur(b.ca)} · bénéfice ${eur(b.benefice)} · impôt ${eur(b.impot)}`,
      t3: `${b.livres} livraison${b.livres > 1 ? 's' : ''}${b.note_moy ? ' · note moyenne ' + dec(b.note_moy) : ''}`,
    })).join('') : ''}
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
  $('#date').innerHTML = `${esc(e.date)}<span id="heure">${texteHeure()}</span><small>${esc(e.entreprise)} · ${SAISON_NOM[e.saison]} · ${METEO_NOM[e.meteo] || ''}</small>`;
  const monde = $('#monde');
  monde.dataset.saison = e.saison;
  monde.dataset.meteo = e.meteo;
  monde.dataset.soir = eclairage();
  monde.dataset.dehors = carte() === 'garage' || etage === 'rdc' ? '1' : '';  // feuilles et pétales seulement quand on voit le jardin
  $('#rep').textContent = e.renommee;
  $('#argent').textContent = eur(e.argent);
  $('#argent').classList.toggle('negatif', e.argent < 0);
  $('#conditions').hidden = vue !== 'prod';
  majHtml('#conditions', `<b>Conditions de travail ×${dec(e.facteur_conditions)}</b>` + (e.conditions.length
    ? e.conditions.map((c) => `<div class="l"><span>${esc(c.nom)}</span><span style="color:${c.pct > 0 ? '#7be08a' : c.pct < 0 ? '#ff8a7a' : '#d6dccb'}">${c.pct > 0 ? '+' : ''}${c.pct} %</span></div>`).join('')
    : '<div class="l"><span>Rien de particulier</span></div>'));
  majHtml('#vues', [['bureau', 'Bureau'], ['prod', 'Productivité'], ['moral', 'Moral']].map(([k, l]) =>
    `<button type="button" data-act="vue" data-id="${k}" class="${vue === k ? 'actif' : ''}">${l}</button>`).join(''));
  majHtml('#carte-projet', e.projets.length
    ? e.projets.map((p) => `<div class="haut"><span class="nomp">${esc(p.nom)}</span><small style="${p.type === 'contrat' && p.jours > p.delai ? 'color:#ff8a7a' : ''}">${p.type === 'contrat' ? `j ${p.jours}/${p.delai}` : 'produit'}</small></div>
       <small style="text-align:left">${esc(etapeProjet(p))} · note ~${dec(p.note_estimee)}${p.combos_jour.length ? ' · combo !' : ''}</small>
       ${e.projets.length === 1 && p.etape === 'travail' ? `<div class="barres">${Object.keys(p.phases[p.phase].besoin).map((d) => barre(DN[d], p.phases[p.phase].fait[d], p.phases[p.phase].besoin[d], DC[d])).join('')}</div>`
         : `<div class="jauge"><i style="width:${Math.round(100 * avancement(p))}%;background:#7be08a"></i></div>`}`).join('')
    : `<span class="nomp">Aucun projet en cours</span><small style="text-align:left">Le temps passe, les charges aussi.</small><span style="color:#ffc94d;font-weight:800;font-size:13px">Voir les contrats →</span>`);
  if (nbTrophees !== null && e.trophees.length > nbTrophees) toast('Trophée : ' + CAT.trophees[e.trophees[e.trophees.length - 1]].nom + ' !', true);
  nbTrophees = e.trophees.length;
  const j = e.journal[0] || { date: '', texte: '' };
  majHtml('#bandeau', `<span class="d">${esc(j.date)}</span><span class="t">${esc(j.texte)}</span>`);
  majHtml('#temps', `<button type="button" data-act="temps" data-id="pause" class="${joue ? '' : 'actif'}" aria-pressed="${!joue}" aria-label="Pause"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg></button>`
    + (pilotage ? `<button type="button" data-act="demo" class="actif" aria-pressed="true" title="Reprendre la main">Démo</button>` : '')
    + Object.entries(VITESSES).filter(([k]) => k !== 'demo').map(([k, [nom]]) => `<button type="button" data-act="temps" data-id="${k}" class="${joue && vitesse === k ? 'actif' : ''}" aria-pressed="${joue && vitesse === k}">${nom}</button>`).join(''));
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('actif', b.dataset.id === onglet || (onglet === 'journal' && b.dataset.id === 'accueil')));
  $('#panneau').classList.toggle('ouvert', onglet !== 'accueil');
  $('#titre-panneau').textContent = TITRES[onglet];
  const contenu = { accueil: panneauAccueil, projets: panneauProjets, equipe: panneauEquipe, materiel: panneauMateriel, locaux: panneauLocaux, journal: () => panneauJournal(40), societe: panneauSociete }[onglet]();
  majHtml('#contenu-panneau', contenu);
  rendreMonde();
  const focus = document.activeElement?.closest?.('#etages [data-id]')?.dataset.id;
  $('#etages').hidden = carte() === 'garage';
  majHtml('#etages', ORDRE_ETAGES.map((k) => `<button type="button" data-act="etage" data-id="${k}" class="${etage === k ? 'actif' : ''}" aria-pressed="${etage === k}" aria-label="${esc(CAT.etages[k].nom)} : ${NB[k] || 0} personne${(NB[k] || 0) > 1 ? 's' : ''}">${esc(CAT.etages[k].nom)}${NB[k] ? `<small aria-hidden="true">${NB[k]}</small>` : ''}</button>`).join(''));
  if (focus) $(`#etages [data-id="${focus}"]`)?.focus();  // le compteur change : on garde le focus clavier
  rendreModale();
  rendreAmenagement();
}

function rendreAmenagement() {
  const ban = $('#placement');
  const o = selection && ETAT.objets.find((x) => x.id === selection);
  if (selection && !o) selection = null;
  let h = '';
  if (placement) {
    const f = fiche(placement.type);
    h = `<b>${placement.id ? 'Déplacer' : 'Placer'} : ${esc(f.nom)}</b><p>Touchez le plan à l'endroit voulu (zones en pointillés).${placement.id ? '' : ' Prix : ' + eur(f.prix) + '.'}</p>
      <div class="btns">${bouton('placer-fin', '', 'Terminer', true, 'petit secondaire')}</div>`;
  } else if (amenage && o) {
    const f = fiche(o.type);
    h = `<b>${esc(f.nom)}</b><p>Revente : ${eur(Math.floor(f.prix / 2))}</p>
      <div class="btns">${bouton('deplacer-sel', '', 'Déplacer', true, 'petit')}${bouton('vendre', o.id, 'Revendre', true, 'petit secondaire')}${bouton('amenage', '', 'Terminer', true, 'petit secondaire')}</div>`;
  } else if (amenage) {
    h = `<b>Mode aménagement</b><p>Touchez un bureau, un appareil ou un objet pour le déplacer ou le revendre.</p>
      <div class="btns">${bouton('onglet', 'locaux', 'Acheter des objets', true, 'petit')}${bouton('amenage', '', 'Terminer', true, 'petit secondaire')}</div>`;
  }
  ban.hidden = !h;
  $('#zone').classList.toggle('amenage', !!h);
  majHtml('#placement', h);
  $('.outils [data-act="amenage"]').classList.toggle('actif', amenage);
  $('#fantome').hidden = !placement;
}

// Validation locale (le serveur revalide) : même règles que le moteur
function validePlace(type, x, y, ignorer) {
  const f = fiche(type);
  const piece = f.pieces.find((k) => { const [px, py, pw, ph] = CAT.pieces[k].rect; return pieceDispo(k) && px <= x && py <= y && x + f.w <= px + pw && y + f.h <= py + ph; });
  if (!piece) return false;
  if (f.libre) return true;
  const chevauche = (ax, ay, aw, ah) => x < ax + aw && ax < x + f.w && y < ay + ah && ay < y + f.h;
  if (!CAT.materiel[type] && CAT.etablis[carte()].some(([ex, ey, ew, eh]) => chevauche(ex, ey, ew, eh))) return false;
  if (CAT.obstacles[carte()].some(([ex, ey, ew, eh]) => chevauche(ex, ey, ew, eh))) return false;
  return !ETAT.objets.some((o) => { const g = fiche(o.type); return o.id !== ignorer && !g.libre && chevauche(o.x, o.y, g.w, g.h); });
}

// Point du sol (coordonnées du moteur) sous le doigt, coin de l'objet calé sur la grille
function pointMonde(ev) {
  const r = $('#monde').getBoundingClientRect(), s = r.width / PLAN.W, f = fiche(placement.type), g = CAT.grille;
  const [x, y] = PLAN.versMonde((ev.clientX - r.left) / s, (ev.clientY - r.top) / s);
  return [Math.round((x - f.w / 2) / g) * g, Math.round((y - f.h / 2) / g) * g];
}

function majFantome(ev) {
  if (!placement) return;
  const [x, y] = pointMonde(ev), f = fiche(placement.type), el = $('#fantome');
  el.querySelector('polygon').setAttribute('points', PLAN.empreinte(x, y, f.w, f.h));
  el.classList.toggle('invalide', !validePlace(placement.type, x, y, placement.id));
}

function rendreModale() {
  const e = ETAT;
  let h = '';
  if (parties) {
    h = modaleParties();
  } else if (e.faillite) {
    h = `<h2 id="modale-titre">Faillite</h2><p>La banque a fermé le compte de ${esc(e.entreprise)} après ${e.jours_total} jours d'activité et ${e.stats.livres} contrats livrés.</p>${bouton('nouvelle-directe', '', 'Nouvelle partie')}`;
  } else if (e.evenement) {
    const ev = e.evenement;
    h = `<h2 id="modale-titre">${esc(ev.titre)}</h2><p>${esc(ev.texte)}</p>` +
      ev.options.map((o, i) => `<button type="button" class="btn ${i ? 'secondaire' : ''}" data-act="evenement" data-choix="${i}">${esc(o)}</button>`).join('');
  } else if (e.victoire && !e.victoire.vue) {
    h = `<h2 id="modale-titre">${e.victoire.ok ? 'Objectif atteint !' : 'Objectif manqué'}</h2><p>${esc(e.victoire.texte)}</p>${bouton('fermer_victoire', '', 'Continuer')}`;
  } else if (e.fin && !e.fin.vue) {
    const f = e.fin;
    h = `<h2 id="modale-titre">20 ans d'activité !</h2><p>${esc(f.entreprise || e.entreprise)}, dirigée par ${esc(f.directeur || '')}, entre dans l'histoire.</p>
      <div class="note-geante" style="background:#ffc94d;width:auto;height:auto;border-radius:22px;padding:14px 22px;font-size:26px">${esc(f.titre)}<small>score ${f.score.toLocaleString('fr-FR')}</small></div>
      <div class="stat"><span>Chiffre d'affaires cumulé</span><b>${eur(f.ca)}</b><span>Contrats livrés</span><b>${f.livres}</b>
      <span>Note moyenne</span><b>${dec(f.note_moy)}</b><span>Renommée</span><b>${f.renommee}</b><span>Trophées</span><b>${f.trophees}</b></div>
      ${bouton('fermer_fin', '', 'Continuer à jouer')}${bouton('nouvelle-directe', '', 'Nouvelle partie', true, 'secondaire')}`;
  } else if (e.bilan) {
    const b = e.bilan;
    h = `<h2 id="modale-titre">Bilan de l'année ${b.annee}</h2>
      <div class="stat"><span>Chiffre d'affaires</span><b>${eur(b.ca)}</b><span>Charges et investissements</span><b>${eur(b.charges)}</b>
      <span>Bénéfice</span><b style="color:${b.benefice >= 0 ? '#7be08a' : '#ff8a7a'}">${eur(b.benefice)}</b><span>Impôt (${Math.round(CAT.difficultes[e.difficulte].impot * 100)} %)</span><b>${eur(b.impot)}</b>
      <span>Livraisons</span><b>${b.livres}</b><span>Note moyenne</span><b>${b.note_moy ? dec(b.note_moy) : '—'}</b>
      <span>Renommée gagnée</span><b>${b.renommee >= 0 ? '+' : ''}${b.renommee}</b><span>Équipe</span><b>${b.employes}</b><span>Trésorerie</span><b>${eur(b.tresorerie)}</b></div>
      ${bouton('fermer_bilan', '', 'Continuer')}`;
  } else if (e.dernier_livre) {
    const d = e.dernier_livre;
    h = `<h2 id="modale-titre">${esc(d.nom)}</h2><p>${d.type === 'contrat' ? 'Note du client' : 'Note de la presse spécialisée'} · ${esc(d.client)}</p>
      <div class="note-geante" style="background:${couleurNote(d.note)}">${dec(d.note)}<small>/ 10</small></div>
      <p style="text-align:center;font-weight:700">« ${esc(d.avis)} »</p>
      ${d.montant ? `<p style="text-align:center">Solde encaissé : <b>${eur(d.montant)}</b></p>` : '<p style="text-align:center">Le produit est en vente : les revenus arrivent chaque début de mois.</p>'}
      ${bouton('fermer_note', '', 'Continuer')}`;
  }
  if (!h && signature) h = modaleSignature();
  const etaitCachee = $('#modale').hidden;
  $('#modale').hidden = !h;
  $('#app').inert = !!h;  // le clavier reste dans la modale
  majHtml('#modale-contenu', h);
  if (h && etaitCachee) $('#modale-contenu button')?.focus();
}

const chanceNego = (prix, delai, fid = 0) => Math.max(0.05, Math.min(1, 1 - 2.6 * (prix - 1) - 0.6 * (delai - 1) + 0.01 * ETAT.renommee + 0.05 * fid + (ETAT.bonus_nego || 0)));
function modaleSignature() {
  const e = ETAT, sg = signature;
  const cible = sg.genre === 'signer' ? e.offres.find((o) => o.id === sg.id) : CAT.produits.find((x) => x.id === sg.id);
  if (!cible) { signature = null; return ''; }
  const exigeant = sg.genre === 'signer' && CAT.exigeants.includes(cible.secteur);
  const groupe = (cat, cle, val, options, desc) => `<div class="section" style="margin-top:6px">${esc(cat)}</div><div class="onglets">${Object.entries(options).map(([k, o]) => {
    const manque = o.requis && !e.technos.includes(o.requis) && !e.certifs.includes(o.requis) && (CAT.technos[o.requis] || CAT.certifs[o.requis]).nom;
    const bloque = manque || (exigeant && cle === 'qualif' && k === 'aucune');
    return `<button type="button" data-act="sig-opt" data-cle="${cle}" data-id="${k}" class="${val === k ? 'actif' : ''}" style="${val === k ? 'background:#ffc94d' : ''}" ${bloque ? 'disabled' : ''}${manque ? ` title="Il faut : ${esc(manque)}"` : ''}>${esc(o.nom || o)}${manque ? `<br><small>🔒 ${esc(manque)}</small>` : ''}</button>`;
  }).join('')}</div>${desc ? `<p style="font-size:13px">${esc(desc)}</p>` : ''}`;
  let h = `<h2 id="modale-titre">${esc(cible.nom)}</h2><p>${sg.genre === 'signer' ? `${esc(cible.client)} · ${eur(cible.paie)} · ${cible.delai} j` : `Produit maison · prototype ${eur(cible.cout)}`}</p>`;
  if (cible.mega) h += `<p style="font-size:13px"><b>Méga-projet</b> : occupe 2 places de projet pendant ${cible.delai} jours, payé 25 % de plus.</p>`;
  if (cible.fidele) h += `<p style="font-size:13px">Client fidèle ${etoiles(cible.fidele)} : il accepte plus facilement vos conditions.</p>`;
  const sansMeca = sg.genre === 'signer' ? cible.total.m === 0 : cible.rep[1] === 0;
  const base0 = sg.genre === 'signer' ? cible.total : { e: Math.round(cible.taille * cible.rep[0]), m: Math.round(cible.taille * cible.rep[1]), f: Math.round(cible.taille * cible.rep[2]) };
  for (const [cle, cat] of Object.entries(CAT.choix_tech)) {
    if (cle === 'boitier' && sansMeca) { h += `<div class="section" style="margin-top:6px">${esc(cat.nom)}</div><p style="font-size:13px">Pas de partie mécanique sur ce projet.</p>`; continue; }
    h += groupe(cat.nom, cle, sg.tech[cle], cat.options, cat.options[sg.tech[cle]].desc);
  }
  // qui fait chaque étape : l'équipe ou un prestataire (seulement les étapes présentes sur ce projet)
  const presentes = { f: base0.f > 0, m: !sansMeca, indus: sg.tech.indus !== 'aucune', qualif: sg.tech.qualif !== 'aucune' };
  const presta = Object.fromEntries(Object.keys(CAT.prestataires).map((k) => [k, presentes[k] ? sg.presta[k] : 'interne']));
  h += `<div class="section" style="margin-top:10px">Qui fait le travail ?</div>`;
  for (const [cle, cat] of Object.entries(CAT.prestataires)) {
    if (presentes[cle]) h += groupe(cat.nom, 'presta-' + cle, presta[cle], cat.options, cat.options[presta[cle]].desc);
  }
  // même calcul que le moteur (_appliquer_choix) : points après les choix × coût par point, −15 % avec un chef de projet
  const opts = Object.entries(sg.tech).filter(([k]) => !(k === 'boitier' && sansMeca)).map(([k, v]) => CAT.choix_tech[k].options[v]);
  const pts = Object.fromEntries(['e', 'm', 'f'].map((d) => [d, opts.reduce((x, o) => (d in o ? Math.round(x * o[d]) : x), base0[d])]));
  const points = pts.e + pts.m + pts.f;
  const chefs = e.employes.some((x) => x.chef);
  const offre = (k) => CAT.prestataires[k].options[presta[k]];
  const etapes = Math.round(['indus', 'qualif'].reduce((t, k) => t + (CAT.choix_tech[k].options[sg.tech[k]].cout_point || 0) * offre(k).prix, 0) * points * (chefs ? 0.85 : 1) / 10) * 10;
  const dev = Math.round(['f', 'm'].reduce((t, d) => t + (offre(d).prix_point || 0) * pts[d], 0) / 10) * 10, moule = opts.reduce((t, o) => t + (o.cout || 0), 0);
  const details = [moule && `moule ${eur(moule)}`, etapes && `indus et qualification ${eur(etapes)}${chefs ? ', −15 % grâce au chef de projet' : ''}`, dev && `prestataires ${eur(dev)}`].filter(Boolean);
  if (etapes + moule + dev) h += `<p style="font-size:13px">Payé à la signature : <b>${eur(etapes + moule + dev)}</b> (${details.join(' · ')})</p>`;
  if (exigeant) h += `<p style="font-size:13px">Marché exigeant : une qualification est obligatoire.</p>`;
  if (sg.genre === 'signer') {
    const ch = chanceNego(Number(sg.prix), Number(sg.delai), cible.fidele || 0);
    h += groupe('Prix demandé', 'prix', sg.prix, CAT.prix_proposes) + groupe('Délai proposé', 'delai', sg.delai, CAT.delais_proposes);
    h += `<p><b>${eur(cible.paie * Number(sg.prix))}</b> en ${Math.max(8, Math.round(cible.delai * Number(sg.delai)))} jours · chance que le client accepte : <b style="color:${ch >= 0.99 ? '#7be08a' : ch >= 0.6 ? '#ffc94d' : '#ff8a7a'}">${Math.round(ch * 100)} %</b></p>`;
  }
  return h + bouton('sig-ok', '', sg.genre === 'signer' ? 'Signer' : 'Lancer le développement') + bouton('sig-annuler', '', 'Annuler', true, 'secondaire');
}
const AIDE = [
  ['Projets', "Signez un contrat (acompte de 30 %), puis lancez le temps. Schéma, routage PCB et 3D, prototype, firmware, debug puis tests CEM."],
  ['Note du client', "Les défauts et le retard font baisser la note sur 10. Elle fixe le solde payé et la renommée gagnée."],
  ['Clients fidèles', "Une note au-dessus de l'attente fidélise le client (★). Il revient avec des projets de son secteur plus gros, et négocie plus facilement."],
  ['Méga-projets', "Dès 10 de renommée, de rares projets géants apparaissent : ils occupent deux places, demandent une grande équipe et plusieurs technos."],
  ['Produits maison', "Lancez vos produits, puis leurs suites : une v2 se vend d'autant mieux que la v1 a été bien notée. Une fois en vente, commandez des lots au sous-traitant (Projets › En vente) : un gros lot coûte moins cher par unité mais risque de rester en stock. Un lot peut arriver en retard ou défectueux ; le contrôle à réception le repère mieux avec un bon qualiticien."],
  ['Indus et qualification', "À la signature, deux étapes optionnelles et payantes, pour la carte ou le produit fini. L'industrialisation baisse le coût unitaire, les défauts en série et les retours. La qualification (essais en température et vibrations) améliore la note, réduit les pannes et est obligatoire pour l'auto, l'aéro, le médical et le spatial. Installez un employé doué au Bureau indus ou au Labo de qualification pour mieux les réussir."],
  ['Prestataires', "À la signature, pour le firmware, la méca, l'indus et la qualif : en interne (gratuit ou moins cher, mais ça occupe l'équipe, et l'indus et la qualif sont moins efficaces sans spécialiste), un freelance ou un labo low-cost (prix moyen, qualité variable) ou un bureau d'études ou un labo accrédité (cher, rapide et sûr). Un prestataire avance de son côté sans occuper l'équipe."],
  ['Options avancées', "Certaines options de signature (8 et 12 couches, FPGA, 4G, boîtier blindé ou étanche, USB-C, composants auto, aéro ou spatiaux…) se débloquent avec une techno ou une certification : le cadenas indique laquelle."],
  ['Chefs et commerciaux', "Les chefs de projet suivent plusieurs projets : une place de projet de plus chacun, ils composent eux-mêmes l'équipe (le meilleur spécialiste libre de chaque domaine), meilleure note, moins de retard et de surcoûts, prime du client si le projet est livré à l'heure et bien noté ; leur effet baisse avec le nombre de projets suivis. Les responsables d'équipe font produire et progresser leur service et évitent les pertes de coordination. Les commerciaux rendent les offres mieux payées, les négocient, prospectent le secteur choisi et touchent une commission."],
  ['Missions', "Trois missions sont proposées à la fois sur le tableau de bord. Chacune rapporte une prime, parfois de la renommée."],
  ['Équipe', "Chaque employé a des compétences (Élec, Méca 3D, Firmware) et des compétences métier, une séniorité, plusieurs traits, une motivation, un moral et une fatigue. Le CV ne dit pas tout : l'entretien et le spécialiste en révèlent plus, le reste se découvre avec le temps. Gare au burn-out, et soignez les entretiens annuels."],
  ['Conditions de travail', "Décoration, café, climatisation, isolation et horaires changent la production (vue Productivité)."],
  ['Matériel et locaux', "Le matériel accélère le travail et réduit les défauts. Quittez le garage pour le bâtiment de bureaux (onglets RDC, R1, R2 à gauche du plan) : tout le bâtiment est ouvert d'un coup, vous grandissez ensuite en embauchant. Nommez des responsables de service, un directeur R&D et un chargé d'innovation dans Équipe."],
  ['Plan', "Sur téléphone, faites glisser le plan au doigt et pincez pour zoomer. Les boutons + / − / ⌖ zooment et recentrent. En vitesse Lent ou Normal, suivez la journée de bureau : réunion du matin, cafés, déjeuner à midi."],
  ['Aménagement', "Le bouton en haut à gauche permet de placer, déplacer ou revendre bureaux, appareils et décoration."],
  ['Société', "Recherche, certifications, fournisseurs, prêts et levée de fonds débloquent de meilleurs contrats. En fin de partie, investissez : campagne nationale, centre de formation, filiale, rachat d'un concurrent."],
  ['Argent', "Loyer, salaires et frais tombent chaque mois, l'impôt chaque année. Sous −5 000 €, c'est la faillite."],
  ['Fin de partie', "Au bout de 20 ans, un score et un titre. Les 10 meilleurs scores restent dans les records."],
];
function modaleParties() {
  const pa = parties;
  const retour = bouton('par-menu', '', 'Retour', true, 'secondaire');
  if (pa.etape === 'menu') {
    const cur = pa.liste.find((x) => x.emplacement === pa.actuelle);
    return `<h2 id="modale-titre" class="logo">Circuit Story</h2><p>Le bureau d'études électronique dont vous êtes le patron.</p>
      ${cur && cur.existe ? bouton('par-fermer', '', `Continuer · ${cur.entreprise}`) : ''}
      ${bouton('par-liste', 'nouvelle', 'Nouvelle partie', true, cur && cur.existe ? 'secondaire' : '')}
      ${bouton('par-liste', 'charger', 'Charger une partie', pa.liste.some((x) => x.existe), 'secondaire')}
      ${bouton('par-etape', 'aide', 'Comment jouer', true, 'secondaire')}
      ${bouton('par-etape', 'records', 'Trophées et records', true, 'secondaire')}`;
  }
  if (pa.etape === 'aide') {
    return `<h2 id="modale-titre">Comment jouer</h2>` + AIDE.map(([t, x]) => `<p><b>${t}.</b> ${x}</p>`).join('') + retour;
  }
  if (pa.etape === 'records') {
    const rec = pa.records.filter((r) => r && typeof r === 'object');
    return `<h2 id="modale-titre">Trophées et records</h2>
      <div class="section">Trophées de la partie · ${ETAT.trophees.length} / ${Object.keys(CAT.trophees).length}</div>
      ${chipsTrophees(ETAT)}
      <div class="section">Meilleurs scores</div>` +
      (rec.length ? rec.map((r, i) => `<div class="encart"><h3>${i + 1}. ${esc(r.entreprise)} · ${Number(r.score).toLocaleString('fr-FR')}</h3>
        <div class="t2" style="font-size:13px">${esc(r.titre)} · ${esc(r.directeur)} · ${esc(r.date)}</div></div>`).join('')
        : '<p>Aucune partie de 20 ans terminée pour l\'instant.</p>') + retour;
  }
  if (pa.etape === 'nouvelle') {
    return `<h2 id="modale-titre">Nouvelle partie · emplacement ${pa.emplacement}</h2>
      <label class="champ">Nom de l'entreprise<input data-champ="entreprise" maxlength="30" autocomplete="off" placeholder="Mon bureau d'études" value="${esc(pa.entreprise)}"></label>
      <label class="champ">Nom du directeur<input data-champ="directeur" maxlength="30" autocomplete="off" placeholder="Vous" value="${esc(pa.directeur)}"></label>
      <p style="font-size:13px">Les noms ne pourront plus être changés.</p>
      <div class="section">Scénario</div>${Object.entries(CAT.scenarios).map(([k, sc]) => `<button type="button" class="btn ${pa.scenario === k ? '' : 'secondaire'}" data-act="par-scen" data-id="${k}" style="text-align:left;padding:8px 12px">${esc(sc.nom)}<br><span style="font-weight:600;font-size:12px">${esc(sc.desc)}</span></button>`).join('')}
      <div class="section">Difficulté</div><div class="onglets">${Object.entries(CAT.difficultes).map(([k, d]) => `<button type="button" data-act="par-diff" data-id="${k}" class="${pa.difficulte === k ? 'actif' : ''}" style="${pa.difficulte === k ? 'background:#ffc94d' : ''}">${esc(d.nom)}</button>`).join('')}</div>
      ${bouton('par-commencer', '', 'Commencer')}${bouton('par-retour', '', 'Retour', true, 'secondaire')}`;
  }
  const titre = { nouvelle: 'Nouvelle partie', charger: 'Charger une partie' }[pa.mode] || 'Parties';
  return `<h2 id="modale-titre">${titre}</h2>` + pa.liste.filter((x) => pa.mode !== 'charger' || x.existe).map((x) => `<div class="encart"><h3>Emplacement ${x.emplacement}${x.existe ? ' · ' + esc(x.entreprise) : ''}${x.emplacement === pa.actuelle ? ' · en cours' : ''}</h3>
      ${x.existe ? `<div class="t2" style="font-size:13px">${esc(x.scenario)} · ${esc(x.difficulte)} · année ${x.annee} · ${eur(x.argent)} · renommée ${x.renommee}${x.faillite ? ' · faillite' : ''}</div>` : '<div class="t2" style="font-size:13px">Vide</div>'}
      <div class="btns">${pa.mode !== 'nouvelle' && x.existe && x.emplacement !== pa.actuelle ? bouton('par-charger', x.emplacement, 'Charger', true, 'petit') : ''}${pa.mode !== 'charger' ? bouton('par-nouvelle', x.emplacement, 'Nouvelle partie ici', true, 'petit secondaire') : ''}</div></div>`).join('') +
    (pa.mode ? retour : bouton('par-fermer', '', 'Fermer', true, 'secondaire'));
}
async function ouvrirMenu(etape, mode) {
  joue = false;
  try {
    const r = await api('/api/parties');
    parties = { liste: r.parties, actuelle: r.actuelle, records: r.records, etape, mode, scenario: 'garage', difficulte: 'normal', entreprise: '', directeur: '' };
  } catch (err) { toast(err.message); }
  rendre();
}
let signature = null, parties = null;

// ---------------------------------------------------------------- échanges serveur
async function api(chemin, corps) {
  const r = await fetch(chemin, corps ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WEB_OFFICE': '1' }, body: JSON.stringify(corps) } : {});
  if (!r.ok) throw new Error('Serveur injoignable');
  return r.json();
}

function toast(texte, ok = false) {
  const t = $('#toast');
  t.textContent = texte;
  t.classList.toggle('ok', ok);
  t.hidden = false;
  clearTimeout(toast.m);
  toast.m = setTimeout(() => { t.hidden = true; }, 2600);
}

async function agir(genre, params = {}) {
  try {
    const avant = ETAT.projets.length;
    const r = await api('/api/action', { genre, ...params });
    observer(ETAT, r.etat);
    ETAT = r.etat;
    if (!r.ok) toast(r.erreur);
    else if (genre === 'signer' && ETAT.projets.length === avant) toast(ETAT.journal[0].texte);  // négociation perdue
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
        const avant = ETAT;
        observer(ETAT, r.etat);
        ETAT = r.etat;
        if (pilotage) { const lent = jourLent(avant, ETAT); await piloter(); vitesse = lent ? 'normal' : 'demo'; }
        debutJour = performance.now();
      } catch (err) {
        joue = false;
        toast(err.message);
      }
      envoi = false;
      if (ETAT.evenement || ETAT.faillite || ETAT.dernier_livre || ETAT.bilan || (ETAT.fin && !ETAT.fin.vue) || (ETAT.victoire && !ETAT.victoire.vue) || signature || parties) joue = false;
      rendre();
    }
    boucle();
  }, VITESSES[vitesse][1]);
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
    case 'zoom':
      if (id === 'centre') return recentrer();
      return appliquerZoom(zoom * (id === 'plus' ? 1.25 : 0.8));
    case 'amenage': joue = false; amenage = !amenage; selection = null; placement = null; if (!tablette()) onglet = 'accueil'; return rendre();
    case 'placer': {
      joue = false; placement = { type: id }; amenage = true; selection = null;
      if (!tablette()) onglet = 'accueil';
      // on montre l'étage d'une pièce où l'objet peut aller
      const ok = fiche(id).pieces.filter(pieceDispo);
      if (carte() === 'batiment' && ok.length && !ok.some((k) => CAT.pieces[k].etage === etage)) { etage = CAT.pieces[ok[0]].etage; rendre(); recentrer(); }
      return rendre();
    }
    case 'etage': etage = id; rendre(); return recentrer();
    case 'voir': {
      if (!tablette()) onglet = 'accueil';
      etage = CAT.pieces[id].etage;
      rendre();
      const [x, y, w, hh] = CAT.pieces[id].rect, [X, Y] = PLAN.iso(x + w / 2, y + hh / 2, 0), cadre = $('#cadre'), ech = $('#echelle');
      cadre.scrollLeft = X * zoom + ech.offsetLeft - cadre.clientWidth / 2;
      cadre.scrollTop = Y * zoom + ech.offsetTop - cadre.clientHeight / 2;
      return;
    }
    case 'placer-fin': placement = null; return rendre();
    case 'deplacer-sel': { const o = ETAT.objets.find((x) => x.id === selection); if (o) placement = { type: o.type, id: o.id }; return rendre(); }
    case 'vendre':
      if (!confirm('Revendre cet objet à moitié prix ?')) return;
      selection = null;
      break;
    case 'catmat': catMat = id; return rendre();
    case 'demo': pilotage = false; figee = fractionJour(); joue = false; toast('Démo arrêtée : à vous de jouer !', true); return rendre();
    case 'temps':
      pilotage = false;
      if (id === 'pause') { figee = fractionJour(); joue = false; }
      else { if (!joue) debutJour = performance.now() - figee * VITESSES[id][1]; joue = true; vitesse = id; }
      rendre(); return boucle();
    case 'menu': return ouvrirMenu('menu');
    case 'nouvelle-directe': return ouvrirMenu('liste', 'nouvelle');
    case 'parties': return ouvrirMenu('liste');
    case 'par-fermer': parties = null; return rendre();
    case 'par-menu': parties.etape = 'menu'; parties.mode = undefined; return rendre();
    case 'par-liste': parties.etape = 'liste'; parties.mode = id; return rendre();
    case 'par-etape': parties.etape = id; return rendre();
    case 'par-nouvelle': parties.etape = 'nouvelle'; parties.emplacement = id; return rendre();
    case 'par-retour': parties.etape = 'liste'; return rendre();
    case 'par-scen': parties.scenario = id; return rendre();
    case 'par-diff': parties.difficulte = id; return rendre();
    case 'par-charger':
    case 'par-commencer': {
      const existe = act === 'par-commencer' && parties.liste.find((x) => x.emplacement === parties.emplacement).existe;
      if (existe && !confirm('Écraser la partie de cet emplacement ?')) return;
      const r = await (act === 'par-charger' ? api('/api/charger', { emplacement: id }) : api('/api/nouvelle', { emplacement: parties.emplacement, scenario: parties.scenario, difficulte: parties.difficulte, entreprise: parties.entreprise, directeur: parties.directeur })).catch((err) => ({ ok: false, erreur: err.message }));
      if (r.etat) ETAT = r.etat;
      if (!r.ok) return toast(r.erreur);
      parties = null; amenage = false; placement = null; selection = null;
      onglet = tablette() ? 'projets' : 'accueil';
      return rendre();
    }
    case 'sig-ouvrir': {
      joue = false;
      const tech = Object.fromEntries(Object.entries(CAT.choix_tech).map(([k, c]) => [k, c.defaut]));
      const o = b.dataset.genre === 'signer' && ETAT.offres.find((x) => x.id === id);
      if (o && CAT.exigeants.includes(o.secteur)) tech.qualif = 'carte';
      const presta = Object.fromEntries(Object.keys(CAT.prestataires).map((k) => [k, 'interne']));
      signature = { genre: b.dataset.genre, id, tech, presta, prix: '1.0', delai: '1.0' };
      return rendre();
    }
    case 'sig-opt': {
      const cle = b.dataset.cle;
      if (cle === 'prix' || cle === 'delai') signature[cle] = brut;
      else if (cle.startsWith('presta-')) signature.presta[cle.slice(7)] = brut;
      else signature.tech[cle] = brut;
      return rendre();
    }
    case 'sig-annuler': signature = null; return rendre();
    case 'sig-ok': {
      const sg = signature;
      signature = null;
      return agir(sg.genre, sg.genre === 'signer' ? { id: sg.id, prix: sg.prix, delai: sg.delai, tech: sg.tech, presta: sg.presta } : { id: sg.id, tech: sg.tech, presta: sg.presta });
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
  if (b.dataset.heures) params.heures = Number(b.dataset.heures);
  if (b.dataset.montant) params.montant = Number(b.dataset.montant);
  if (b.dataset.role !== undefined) params.role = b.dataset.role || null;
  if (b.dataset.qte) params.qte = Number(b.dataset.qte);
  if (b.dataset.cible) params.cible = b.dataset.cible;
  await agir(act, params);
});

// Plan : placer, déplacer, choisir un objet
$('#cadre').addEventListener('pointermove', majFantome);
$('#cadre').addEventListener('click', async (ev) => {
  if (ev.target.closest('[data-act]')) return;
  if (placement) {
    const [x, y] = pointMonde(ev);
    const pl = placement;
    const r = await api('/api/action', pl.id ? { genre: 'deplacer', id: pl.id, x, y } : { genre: 'poser', id: pl.type, x, y }).catch((err) => ({ ok: false, erreur: err.message }));
    if (r.etat) ETAT = r.etat;
    if (!r.ok) toast(r.erreur);
    else if (pl.id || !(pl.type === 'poste' || fiche(pl.type).multiple)) placement = null;  // on peut enchaîner bureaux et objets multiples
    return rendre();
  }
  if (amenage) {
    const cible = ev.target.closest('[data-obj]');
    selection = cible ? Number(cible.dataset.obj) : null;
    rendre();
  }
});

document.addEventListener('input', (ev) => {
  const c = ev.target.closest('[data-champ]');
  if (c && parties) parties[c.dataset.champ] = c.value;
});

document.addEventListener('change', (ev) => {
  const sel = ev.target.closest('[data-affecter]');
  if (sel) agir('affecter', { id: Number(sel.dataset.affecter), projet: sel.value ? Number(sel.value) : null });
  if (ev.target.closest('[data-prospecter]')) agir('prospecter', { id: ev.target.value || null });
});

// Pincer pour zoomer (téléphone), Ctrl + molette (ordinateur)
let pince = null;
const ecart = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
$('#cadre').addEventListener('touchstart', (ev) => { if (ev.touches.length === 2) pince = { d: ecart(ev.touches), s: zoom }; }, { passive: true });
$('#cadre').addEventListener('touchmove', (ev) => {
  if (!pince || ev.touches.length !== 2) return;
  ev.preventDefault();
  const r = $('#cadre').getBoundingClientRect(), [a, b] = ev.touches;
  appliquerZoom(pince.s * ecart(ev.touches) / pince.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
}, { passive: false });
$('#cadre').addEventListener('touchend', (ev) => { if (ev.touches.length < 2) pince = null; });
$('#cadre').addEventListener('wheel', (ev) => {
  if (!ev.ctrlKey) return;
  ev.preventDefault();
  const r = $('#cadre').getBoundingClientRect();
  appliquerZoom(zoom * (ev.deltaY < 0 ? 1.12 : 0.89), ev.clientX - r.left, ev.clientY - r.top);
}, { passive: false });

async function demarrer() {
  $('#dyn').insertAdjacentHTML('afterend', '<div id="devant"></div><div id="rue"></div><div id="effets"></div>');
  $('#ambiance').insertAdjacentHTML('beforebegin', '<div id="saison"></div>');  // feuilles d'automne, pétales de printemps  // façade basse et extérieur, puis la rue animée : devant les objets, sous les personnages
  $('#monde').insertAdjacentHTML('beforeend', `<div id="fantome" class="fantome" hidden><svg viewBox="0 0 ${PLAN.W} ${PLAN.H}" width="${PLAN.W}" height="${PLAN.H}"><polygon points=""/></svg></div>`);
  $('#monde').style.width = PLAN.W + 'px';
  $('#monde').style.height = PLAN.H + 'px';
  appliquerZoom(tablette() ? $('#cadre').clientWidth / PLAN.W : 0.8);
  window.addEventListener('resize', () => appliquerZoom(zoom));
  if (tablette()) onglet = 'projets';
  try {
    [CAT, ETAT] = await Promise.all([api('/api/catalogue'), api('/api/etat')]);
  } catch (err) {
    toast('Impossible de joindre le serveur du jeu.');
    return;
  }
  rendre();
  recentrer();
  if (DEMO) { joue = true; vitesse = 'normal'; rendre(); boucle(); toast('Mode démo : la partie se joue toute seule. Le bouton « Démo » vous rend la main.', true); }
  else ouvrirMenu('menu');  // écran titre à chaque ouverture
}

demarrer();
