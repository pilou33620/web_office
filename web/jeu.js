// Circuit Story — interface web (le moteur tourne côté serveur Python)
'use strict';

const $ = (s) => document.querySelector(s);
const DN = { e: 'Élec', m: 'Méca 3D', f: 'Firmware', c: 'CEM' };
const COURT = { e: 'élec', m: '3D', f: 'fw' };
const DC = { e: '#ffc94d', m: '#f08a6c', f: '#7cc0f2', c: '#b08af0' };
const PIECE = { labo: 'Labo élec', atelier: 'Atelier 3D', bureau: "Bureau d'études", cem: 'Labo CEM', cms: 'Ligne CMS' };
const PCT_BONUS = 6;  // % de production par point de matériel (moteur : _production)
const TITRES = { accueil: 'Tableau de bord', projets: 'Projets', equipe: 'Équipe', materiel: 'Matériel', locaux: 'Locaux', journal: 'Journal', societe: 'Société' };
const ABSENCE = { formation: 'En formation', conges: 'En congés', seminaire: 'Séminaire' };
const METEO_NOM = { soleil: 'soleil', pluie: 'pluie', neige: 'neige', canicule: 'canicule', orage: 'orage', brouillard: 'brouillard' };
const SAISON_NOM = { hiver: 'Hiver', printemps: 'Printemps', ete: 'Été', automne: 'Automne' };

let ETAT = null, CAT = null;
let onglet = 'accueil', vue = 'bureau', catMat = 'e';
let joue = false, vitesse = 'normal', minuteur = null, envoi = false, nbTrophees = null;
// Durée réelle d'une journée de jeu (ms) selon la vitesse choisie
const VITESSES = { lent: ['Lent', 16000], normal: ['Normal', 8000], rapide: ['Rapide', 3000], tresrapide: ['Très rapide', 1000] };
let amenage = false, selection = null, placement = null;  // mode aménagement, objet choisi, objet en cours de placement
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
// Emplacements debout (centre du personnage) par lieu, sur chaque carte
const SPOTS = {
  garage: {
    labo: [[470, 462], [520, 462], [600, 462], [620, 600]],
    reunion: [[136, 717], [184, 717], [160, 695], [160, 742], [220, 712], [250, 726]],
    terrasse: [[280, 262], [304, 280], [330, 262], [240, 290], [350, 290]],
  },
  batiment: {
    labo: [[100, 262], [100, 332], [100, 410], [150, 300], [160, 420], [110, 462]],
    atelier: [[70, 204], [120, 204], [184, 132], [184, 190]],
    cem: [[492, 210], [540, 210], [590, 210], [620, 150]],
    terrasse: [[690, 522], [730, 522], [700, 600], [740, 590], [680, 570], [762, 540]],
    salle: [[500, 570], [540, 592], [572, 570], [612, 612], [512, 632], [590, 632]],
    accueil: [[245, 611], [275, 611], [405, 611], [435, 611], [330, 560], [370, 560]],
    reunion: [[268, 320], [268, 346], [268, 372], [268, 398], [342, 320], [342, 346], [342, 372], [342, 398], [305, 300], [305, 436]],
  },
};
const PAROLES = ['Pause !', 'Bla bla', 'Ha ha !', 'Un café ?', 'Et ton week-end ?', 'T\'as vu le match ?', 'Trop drôle'];
const DEMANDES = ['Tu peux m\'aider ?', 'Regarde ce schéma', 'Une idée ?', 'Ça plante ici…'];

function corps(x) {
  return `<div class="anim"><svg viewBox="-17 -17 34 34" width="34" height="34" aria-hidden="true">${PLAN.perso(0, 0, esc(x.couleur), esc(x.cheveux), (x.id || 0) % 4, esc(x.peau || PLAN.PEAUX[0]))}</svg></div>`;
}

const PERSOS = {};
function rendrePersos() {
  const e = ETAT, p = e.projets.length > 0, cont = $('#persos'), vus = new Set(), groupes = {};
  const duree = Math.min(1.2, VITESSES[vitesse][1] / 2000);
  const salle = e.locaux.includes('pause'), S = SPOTS[carte()];
  const pos = {};
  const objs = Object.fromEntries(e.objets.map((o) => [o.id, o]));
  // devant chaque appareil du labo, de l'atelier et du labo CEM
  const spots = { labo: [], atelier: [], cem: [] };
  for (const o of e.objets) {
    const m = CAT.materiel[o.type];
    if (!m) continue;
    const k = Object.keys(spots).find((cle) => { const [x, y, w, hh] = CAT.pieces[cle].rect; return o.x >= x && o.y >= y && o.x < x + w && o.y < y + hh; });
    if (k) { const [x, , w] = CAT.pieces[k].rect; spots[k].push([Math.min(o.x + m.w + 12, x + w - 14), o.y + m.h / 2]); }
  }
  const baby = salle && e.objets.find((o) => o.type === 'babyfoot');
  if (baby) { const f = fiche('babyfoot'); spots.babyfoot = [[baby.x - 10, baby.y + f.h / 2], [baby.x + f.w + 10, baby.y + f.h / 2]]; }
  const SP = (lieu) => (spots[lieu] && spots[lieu].length ? spots[lieu].concat(S[lieu] || []) : S[lieu]);
  const placer = (emp) => {
    const mauvais = ['pluie', 'neige', 'orage'].includes(e.meteo);
    let lieu = emp.lieu;
    if (lieu === 'pause') lieu = salle ? 'salle' : carte() === 'batiment' ? 'accueil' : mauvais ? 'bureau' : 'terrasse';
    if (lieu === 'fete') lieu = salle ? 'salle' : 'reunion';  // on fête à la salle de pause, sinon autour de la table
    if (lieu === 'salle' && spots.babyfoot && (groupes.babyfoot || 0) < 2) lieu = 'babyfoot';
    if (lieu !== 'babyfoot' && !(S[lieu] || spots[lieu])) lieu = 'bureau';
    let x, y;
    if (lieu === 'bureau') { const o = objs[emp.bureau] || { x: 452, y: 468 }; x = o.x + 38; y = o.y + 46; }
    else { const liste = SP(lieu), g = groupes[lieu] = (groupes[lieu] || 0) + 1; [x, y] = liste[(g - 1) % liste.length]; }
    return { lieu, x, y };
  };
  const presents = e.employes.filter((x) => !x.absent);
  for (const emp of presents) if (emp.lieu !== 'visite') pos[emp.id] = placer(emp);
  for (const emp of presents) {
    if (emp.lieu !== 'visite') continue;
    const cible = pos[emp.visite];
    // à côté du collègue qu'il vient voir, sinon à son propre bureau
    pos[emp.id] = cible ? { lieu: 'visite', x: cible.x + 22, y: cible.y + 4 } : placer({ ...emp, lieu: 'bureau' });
  }
  for (const emp of presents) {
    const { lieu, x: cx, y: cy } = pos[emp.id];
    const x = cx - 17, y = cy - 17;
    let t = '', c = '';
    if (vue === 'moral') { t = emp.moral + ' %'; c = emp.moral >= 70 ? '#7be08a' : emp.moral >= 50 ? '#ffc94d' : '#ff8a7a'; }
    else if (joue && e.fete && emp.lieu === 'fete') { t = e.fete.type === 'anniv' ? (emp.nom === e.fete.nom ? 'Merci !' : 'Joyeux anniversaire !') : 'Santé !'; c = '#ffc94d'; }
    else if (joue && lieu === 'reunion') { t = 'Réunion'; c = '#fff7e6'; }
    else if (joue && lieu === 'visite') { t = DEMANDES[(emp.id + e.jours_total) % DEMANDES.length]; c = '#fff7e6'; }
    else if (joue && lieu === 'babyfoot') { t = (emp.id + e.jours_total) % 2 ? 'But !' : 'Allez !'; c = '#7be08a'; }
    else if (joue && p && 'emf'.includes(emp.tache || '_')) { t = `+${dec(emp.gain)} ${COURT[emp.tache]}`; c = DC[emp.tache]; }
    else if (joue && p && emp.tache === 'debug') { t = `−${dec(emp.gain)} bug`; c = '#ffb3a8'; }
    else if (joue && p && emp.tache === 'cem') { t = 'CEM…'; c = DC.c; }
    else if (joue && ['salle', 'terrasse', 'accueil'].includes(lieu)) { t = PAROLES[(emp.id + e.jours_total) % PAROLES.length]; c = '#fff7e6'; }
    else if (joue && !p) { t = 'zzz'; c = '#e8e8e8'; }
    const html = corps(emp) + (t ? `<div class="bulle${lieu === 'babyfoot' || lieu === 'visite' ? ' parle' : ''}" style="background:${c}">${esc(t)}</div>` : '');
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
    const travaille = joue && (lieu === 'babyfoot' || (p && (assis || lieu === 'labo' || lieu === 'atelier' || lieu === 'cem' || lieu === 'visite') && emp.tache));
    el.classList.toggle('bob', !!travaille && emp.id % 2 === 0);
    el.classList.toggle('bob2', !!travaille && emp.id % 2 === 1);
    vus.add(String(emp.id));
  }
  for (const id of Object.keys(PERSOS)) if (!vus.has(id)) { PERSOS[id].remove(); delete PERSOS[id]; }
}

// Pièce à louer -> pièce du plan où afficher le verrou
const VERROUS = { atelier: 'atelier', plateau: 'plateau', cem: 'cem', openspace: 'openspace', pause: 'pause', cms: 'cms' };
// Pastilles de la vue Productivité : [domaine, carte, x, y]
const PUCES = [['f', 'garage', 560, 376], ['e', 'garage', 446, 376], ['e', 'batiment', 90, 242], ['f', 'batiment', 54, 502], ['m', 'batiment', 54, 74], ['c', 'batiment', 482, 74]];

function rendreMonde() {
  const e = ETAT, h = [], svg = [];
  const cle = carte() + '|' + [...e.locaux].sort().join(',') + '|' + e.deco.filter((d) => d === 'eclairage' || d === 'isolation').sort().join(',') + '|' + e.entreprise;
  if (cache.decor !== cle) {
    const demenage = cache.decor && cache.decor.split('|')[0] !== carte();
    cache.decor = cle;
    $('#statique').innerHTML = PLAN.decor(e);
    if (demenage) requestAnimationFrame(recentrer);
  }
  const p = e.projets.length > 0;
  const occupes = {};
  for (const x of e.employes) occupes[x.bureau] = x;
  const tries = [...e.objets].sort((a, b) => (b.type === 'tapis') - (a.type === 'tapis'));  // les tapis dessous
  for (const o of tries) {
    const f = fiche(o.type);
    if (!f) continue;
    let dessin, titre = f.nom;
    if (o.type === 'poste') {
      const emp = occupes[o.id];
      const travaille = emp && !emp.absent && (emp.lieu || 'bureau') === 'bureau' && joue && p;
      dessin = PLAN.poste(o.x, o.y, !emp ? '#2b3442' : travaille ? 'url(#g-ecran)' : '#5a7a9a', !!emp, !!emp && emp.id % 2 === 0);
      titre = !emp ? 'Bureau libre' : emp.absent ? `${emp.nom} · ${ABSENCE[emp.absence] || 'absent'}` : `Bureau de ${emp.nom}`;
    } else {
      dessin = PLAN.objet(o.type, o.x, o.y, f.w, f.h);
    }
    const panne = o.type in e.pannes ? `<g class="panne"><circle cx="${o.x + f.w}" cy="${o.y}" r="9" fill="#ff8a7a" stroke="#2b1d14" stroke-width="2"/><text x="${o.x + f.w}" y="${o.y + 4}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="12" fill="#2b1d14">!</text></g>` : '';
    const choisi = amenage && selection === o.id ? `<rect x="${o.x - 3}" y="${o.y - 3}" width="${f.w + 6}" height="${f.h + 6}" rx="6" fill="rgba(255,201,77,.2)" stroke="#ffc94d" stroke-width="3" stroke-dasharray="6 4"/>` : '';
    svg.push(`<g${amenage ? ` data-obj="${o.id}" class="cliquable"` : ''}><title>${esc(titre)}</title>${dessin}${panne}${choisi}</g>`);
  }
  svg.push(PLAN.etiquettes(e));
  if (placement) {
    // zones autorisées pour l'objet en cours de placement
    for (const k of fiche(placement.type).pieces) {
      if (!pieceDispo(k)) continue;
      const [x, y, w, hh] = CAT.pieces[k].rect;
      svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" fill="rgba(123,224,138,.14)" stroke="rgba(47,138,58,.9)" stroke-width="2.5" stroke-dasharray="8 5"/>`);
    }
  }
  if (vue === 'moral') {
    const t = e.moral >= 70 ? '123,224,138' : e.moral >= 55 ? '255,201,77' : '255,138,122', [x, y, w, hh] = PLAN.cadreMoral(e);
    svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="12" fill="rgba(${t},.25)"/>`);
  }
  h.push(`<svg class="couche" viewBox="0 0 ${PLAN.W} ${PLAN.H}" width="${PLAN.W}" height="${PLAN.H}" xmlns="http://www.w3.org/2000/svg">${svg.join('')}</svg>`);
  const verrou = (lid, [x, y, w, hh]) => {
    const l = CAT.locaux[lid], bloque = e.renommee < l.rep;
    return `<div class="verrou" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px">
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#fff7e6" stroke-width="2.4"/><rect x="5" y="11" width="14" height="10" rx="2.5" fill="#ffc94d" stroke="#2b1d14" stroke-width="1.8"/></svg>
      <b>${esc(l.nom)}</b><small>${bloque ? `Renommée ${l.rep} requise` : 'Local à louer'}</small>
      <button type="button" class="btn petit" data-act="local" data-id="${lid}" ${bloque || e.argent < l.prix ? 'disabled' : ''}>Louer · ${eur(l.prix)}</button></div>`;
  };
  if (carte() === 'garage') h.push(verrou('bureau', [560, 150, 250, 170]));
  else for (const [lid, k] of Object.entries(VERROUS)) if (!e.locaux.includes(lid)) h.push(verrou(lid, CAT.pieces[k].rect));
  if (vue === 'prod') {
    const b = e.bonus;
    for (const [d, c, x, y] of PUCES) {
      if (c !== carte() || (d === 'm' && !e.locaux.includes('atelier')) || (d === 'c' && !e.locaux.includes('cem'))) continue;
      h.push(`<div class="puce-prod" style="left:${x}px;top:${y}px;background:${DC[d]}">${d === 'c' ? `CEM +${Math.round(b.cem * 100)} %` : `${DN[d]} +${b[d] * PCT_BONUS} %`}</div>`);
    }
  }
  majHtml('#dyn', h.join(''));
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
  const cadre = $('#cadre'), ech = $('#echelle'), [x, y] = PLAN.centre(ETAT);
  cadre.scrollLeft = x * zoom + ech.offsetLeft - cadre.clientWidth / 2;
  cadre.scrollTop = y * zoom + ech.offsetTop - cadre.clientHeight / 2;
}

// ---------------------------------------------------------------- panneaux
const ligne = (o) => `<div class="ligne">${o.avatar || `<div class="pastille" style="background:${o.couleur || '#3a4535'}"></div>`}
  <div class="txt"><div class="t1">${o.t1}</div>${o.t2 ? `<div class="t2">${o.t2}</div>` : ''}${o.t3 ? `<div class="t3">${o.t3}</div>` : ''}${o.extra || ''}</div>${o.btn || ''}</div>`;
const bouton = (act, id, texte, actif = true, cls = '', attrs = '') => `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${esc(id)}" ${attrs} ${actif ? '' : 'disabled'}>${esc(texte)}</button>`;
const repartition = (t) => `Élec ${t.e} · Méca ${t.m} · Firmware ${t.f}`;
const requisListe = (r) => (!r ? [] : Array.isArray(r) ? r : [r]);
const nomRequis = (r) => requisListe(r).map((x) => (CAT.technos[x] || CAT.certifs[x] || { nom: x }).nom).join(' + ');
const etoiles = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const barre = (label, fait, besoin, couleur) => `<div class="barre-l"><span>${label}</span><div class="jauge"><i style="width:${Math.min(100, Math.round(100 * fait / Math.max(1, besoin)))}%;background:${couleur}"></i></div><span>${Math.floor(fait)} / ${besoin}</span></div>`;
const couleurNote = (n) => (n >= 7.5 ? '#7be08a' : n >= 5.5 ? '#ffc94d' : '#ff8a7a');

function etapeProjet(p) {
  if (p.etape === 'debug') return `Debug · ${dec(p.defauts)} défauts`;
  if (p.etape === 'cem') return `Tests CEM (${p.cem_jours} j)`;
  const ph = p.phases[p.phase];
  return ph.attente ? `Fabrication du proto (${ph.attente} j)` : ph.nom;
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
  const combos = p.combos_jour.map((c) => `<span class="chip" style="background:#b08af0;color:#2b1d14" title="${esc(CAT.combos[c].desc)}">${esc(CAT.combos[c].nom)}</span>`).join('');
  return `<div class="encart"><div class="t2" style="font-size:11px;font-weight:800;letter-spacing:1px;color:#a9b39a">${p.type === 'contrat' ? esc(p.client).toUpperCase() : 'PRODUIT MAISON'}</div>
    <h3>${esc(p.nom)}</h3><div class="etapes">${etapes}</div>
    <div class="chips"><span class="chip">${esc(etapeProjet(p))}</span>${p.type === 'contrat' ? `<span class="chip" style="${p.jours > p.delai ? 'background:#ff8a7a;color:#2b1d14' : ''}">Jour ${p.jours} / ${p.delai}</span>` : `<span class="chip">Jour ${p.jours}</span>`}
    <span class="chip" style="background:${couleurNote(p.note_estimee)};color:#2b1d14">Note estimée ${dec(p.note_estimee)}</span><span class="chip">${dec(p.defauts)} défauts</span></div>
    ${combos ? `<div class="chips">${combos}</div>` : ''}
    ${p.etape === 'travail' ? `<div class="barres">${Object.keys(ph.besoin).map((d) => barre(DN[d], ph.fait[d], ph.besoin[d], DC[d])).join('')}</div>` : ''}
    <div class="t2" style="font-size:13px;color:#b3bca5">Équipe du jour : ${equipe}</div>
    <div class="t2" style="font-size:13px;color:#b3bca5">Tests CEM : ${Math.round(p.proba_cem * 100)} % de réussite${p.frais_cem ? ` · labo externe ${eur(p.frais_cem)}` : ' · labo interne gratuit'}</div>
    ${p.etape === 'travail' && ph.attente ? `<div class="t2" style="font-size:13px;color:#b3bca5">Les PCB sont en fabrication : retour dans ${ph.attente} j. L'équipe en profite pour chasser les défauts.</div>` : ''}
    <div class="btns">${p.etape === 'debug' ? bouton('tests_cem', p.id, 'Passer aux tests CEM') : ''}${bouton('abandonner', p.id, 'Abandonner', true, 'secondaire petit')}</div></div>`;
}

function panneauProjets() {
  const e = ETAT, plein = e.places >= e.capacite;
  let h = `<div class="section">En cours · ${e.places} / ${e.capacite} place${e.capacite > 1 ? 's' : ''}${e.capacite < 4 ? ' · agrandissez pour en mener plus' : ''}</div>`;
  h += e.projets.map(encartProjet).join('') || '<div class="vide">Aucun projet : signez un contrat ci-dessous.</div>';
  h += `<div class="section">Appels d'offres · les clients attendent ${dec(e.attente_client)}/10</div>`;
  h += e.offres.length ? [...e.offres].sort((a, b) => (b.mega || 0) - (a.mega || 0) || (b.fidele || 0) - (a.fidele || 0)).map((o) => {
    const complet = e.places + (o.mega ? 2 : 1) > e.capacite;
    const equipe = o.equipe_min && e.employes.length < o.equipe_min;
    const secteur = CAT.secteurs[o.secteur] ? CAT.secteurs[o.secteur].nom + ' · ' : '';
    return ligne({
      couleur: o.mega ? '#ff9a4a' : o.fidele ? '#ffc94d' : '#7be08a',
      t1: (o.mega ? '<span class="badge mega">MÉGA-PROJET</span> ' : '') + esc(o.nom),
      t2: `${esc(secteur)}${esc(o.client)}${o.fidele ? ` <span class="fid" title="Client fidèle : projet plus gros, négociation plus facile">${etoiles(o.fidele)}</span>` : ''} · ${eur(o.paie)} · ${o.delai} j`,
      t3: `${repartition(o.total)} · expire dans ${o.expire} j${o.requis ? ' · ' + esc(nomRequis(o.requis)) : ''}${o.mega ? ` · compte pour 2 projets · équipe de ${o.equipe_min} minimum` : ''}`,
      btn: bouton('sig-ouvrir', o.id, complet ? 'Complet' : equipe ? `${o.equipe_min} pers. requises` : 'Signer', !complet && !equipe, '', 'data-genre="signer"'),
    });
  }).join('') : '<div class="vide">Aucune offre pour le moment, patientez quelques jours.</div>';
  h += `<div class="section">Produits maison</div>`;
  h += CAT.produits.map((x) => {
    const avant = x.suite && CAT.produits.find((y) => y.id === x.suite);
    const sansV1 = avant && !(x.suite in e.gammes);
    const sansTech = x.requis && !e.technos.includes(x.requis);
    const bloque = e.renommee < x.rep_min;
    const occupe = e.places >= e.capacite || [...e.produits, ...e.projets].some((y) => y.id_produit === x.id);
    const lance = x.id in e.gammes;
    const bonus = avant && !sansV1 ? Math.round(8 * Math.max(0, e.gammes[x.suite] - 6)) : 0;
    const total = { e: Math.round(x.taille * x.rep[0]), m: Math.round(x.taille * x.rep[1]), f: Math.round(x.taille * x.rep[2]) };
    const infos = [avant ? `Suite de « ${esc(avant.nom)} »${bonus ? ` · ventes +${bonus} %` : ''}` : '', x.requis ? esc(nomRequis(x.requis)) : '', lance ? `Déjà lancé (meilleure note ${dec(e.gammes[x.id])})` : ''].filter(Boolean).join(' · ');
    return ligne({
      couleur: lance ? '#7be08a' : '#b08af0', t1: esc(x.nom), t2: `Prototype ${eur(x.cout)} · jusqu'à ~${eur(x.potentiel * 0.5)}/mois`, t3: repartition(total) + (infos ? ' · ' + infos : ''),
      btn: bouton('sig-ouvrir', x.id, bloque ? `★ ${x.rep_min} requis` : sansV1 ? 'Après la v1' : sansTech ? 'Techno requise' : occupe ? 'Indisponible' : 'Lancer',
        !bloque && !sansV1 && !sansTech && !occupe && e.argent >= x.cout, '', 'data-genre="produit"'),
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
  const H = CAT.horaires[e.heures];
  let h = `<div class="section">Horaires de travail</div><div class="onglets">${Object.keys(CAT.horaires).map((k) =>
    `<button type="button" data-act="horaires" data-heures="${k}" class="${String(e.heures) === k ? 'actif' : ''}" style="${String(e.heures) === k ? 'background:#ffc94d' : ''}">${k} h</button>`).join('')}</div>
    <div class="t2" style="font-size:13px;color:#b3bca5">${esc(H.nom)} · production ${H.prod >= 1 ? '+' : ''}${Math.round((H.prod - 1) * 100)} % · moral ${H.moral >= 0 ? '+' : ''}${H.moral} · fatigue ×${dec(H.fatigue)} · défauts ×${dec(H.defauts)}${H.salaire ? ` · heures sup +${Math.round(H.salaire * 100)} % de salaires` : ''}</div>`;
  h += `<div class="section">Vie d'équipe</div><div class="t2" style="font-size:13px;color:#b3bca5;margin-top:4px">Séminaire de 2 jours : moral +6 et fatigue effacée pour tous. Anniversaires et pots de livraison se fêtent tout seuls.</div>
    <div class="btns">${bouton('seminaire', '', e.seminaire_dans ? `Séminaire possible dans ${e.seminaire_dans} j` : `Organiser un séminaire · ${eur(e.cout_seminaire)}`, !e.seminaire_dans && e.argent >= e.cout_seminaire, 'petit')}</div>`;
  h += `<div class="section">Équipe · ${e.employes.length} / ${e.postes_ouverts.length} postes · moral ${e.moral} %</div>`;
  h += e.employes.map((x) => {
    const t = CAT.traits[x.trait];
    const etat = x.absent ? `${x.formation ? 'Formation ' + DN[x.formation] : ABSENCE[x.absence] || 'Absent'} : retour dans ${x.absent} j` : x.stage ? `Stage gratuit : encore ${x.stage} j` : x.salaire ? eur(x.salaire) + ' / mois' : 'Gérant';
    const promu = !x.chef && !x.stage && x.e + x.m + x.f >= 14;
    const btns = `<div class="btns">${['e', 'm', 'f'].map((d) => `<button type="button" class="btn petit secondaire" data-act="former" data-id="${x.id}" data-dom="${d}" ${x.absent || e.argent < x.cout_formation ? 'disabled' : ''}>Former ${DN[d]}</button>`).join('')}
      ${bouton('conges', x.id, 'Congés', !x.absent, 'petit secondaire')}${promu ? bouton('promouvoir', x.id, 'Promouvoir chef de projet', true, 'petit') : ''}${x.fondateur ? '' : bouton('licencier', x.id, 'Licencier', true, 'petit secondaire')}</div>
      <div class="t2" style="font-size:12px">Formation : ${eur(x.cout_formation)}, ${10} jours, +2 dans le domaine</div>
      ${e.projets.length > 1 ? `<label class="t2" style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px">Projet
        <select class="choix" data-affecter="${x.id}"><option value="">Automatique</option>${e.projets.map((p) => `<option value="${p.id}" ${x.projet === p.id ? 'selected' : ''}>${esc(p.nom)} · ${esc(p.client || 'maison')}</option>`).join('')}</select></label>` : ''}`;
    return ligne({
      avatar: sprite(x), t1: `${esc(x.nom)} — ${esc(x.poste)}`, t2: repartition(x),
      t3: etat,
      extra: `<div class="chips" style="margin-top:4px"><span class="chip" title="${esc(t.desc)}">${esc(t.nom)}</span><span class="chip" style="background:${x.moral >= 70 ? '#7be08a' : x.moral >= 50 ? '#ffc94d' : '#ff8a7a'};color:#2b1d14">Moral ${x.moral} %</span><span class="chip">Fatigue ${Math.round(x.fatigue)}</span><span class="chip" title="Moral × conditions de travail × trait">Efficacité ${x.efficacite} %</span>${x.chef ? '<span class="chip" style="background:#ffc94d;color:#2b1d14" title="+8 % de production et moins de défauts pour son équipe">Chef de projet</span>' : ''}</div>${btns}`,
    });
  }).join('');
  h += `<div class="section">Candidats${libres ? '' : ' · placez un bureau de plus (Locaux) pour recruter'}</div>`;
  h += e.candidats.map((c) => {
    const t = CAT.traits[c.trait];
    return ligne({
      avatar: sprite(c), t1: `${esc(c.nom)} — ${esc(c.poste)}`, t2: repartition(c), t3: `${eur(c.salaire)} / mois`,
      extra: `<div class="chips" style="margin-top:4px"><span class="chip" title="${esc(t.desc)}">${esc(t.nom)} · ${esc(t.desc)}</span></div>`,
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
  let h = `<div class="onglets">${['e', 'm', 'f', 'c'].map((k) => `<button type="button" data-act="catmat" data-id="${k}" class="${catMat === k ? 'actif' : ''}" style="${catMat === k ? 'background:' + DC[k] : ''}">${DN[k]}</button>`).join('')}</div>`;
  const resume = catMat === 'c' ? `chance aux tests +${Math.round(b.cem * 100)} %` : `production +${b[catMat] * PCT_BONUS} % · debug +${b.debug}`;
  h += `<div class="section">${DN[catMat]} · ${resume}</div><div class="t2" style="font-size:13px;color:#b3bca5;margin-top:4px">Choisissez « Placer », puis touchez le plan à l'endroit voulu.</div>`;
  h += Object.entries(CAT.materiel).filter(([, m]) => m.dom === catMat).map(([id, m]) => {
    const effets = [m.bonus && `+${m.bonus * PCT_BONUS} % ${DN[m.dom]}`, m.debug && `debug +${m.debug}`, m.cem && `CEM +${Math.round(m.cem * 100)} %`].filter(Boolean).join(' · ');
    const possede = e.materiel.includes(id);
    const local = !m.pieces.some((k) => !CAT.pieces[k].local || e.locaux.includes(CAT.pieces[k].local));
    return ligne({
      couleur: DC[m.dom], t1: esc(m.nom), t2: `${effets} · ${eur(m.prix)}`, t3: `${PIECE[m.piece]}${id in e.pannes ? ` · en panne (${e.pannes[id]} j)` : ''}`,
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
  h += `<div class="section">Agrandissements</div>`;
  h += Object.entries(CAT.locaux).map(([id, l]) => {
    const fait = e.locaux.includes(id), bloque = e.renommee < l.rep;
    return ligne({
      couleur: '#efc488', t1: esc(l.nom), t2: `${esc(l.desc)} · ${eur(l.prix)}`, t3: `Loyer +${eur(l.loyer)} / mois`,
      btn: bouton('local', id, fait ? 'Fait' : bloque ? `★ ${l.rep} requis` : 'Louer', !fait && !bloque && e.argent >= l.prix),
    });
  }).join('');
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
  else btn = bouton(act, id, requis ? 'Prérequis' : occupe ? 'Patientez' : 'Lancer', !requis && !occupe && e.argent >= f.prix, 'petit');
  return ligne({ couleur: acquis.includes(id) ? '#7be08a' : '#b08af0', t1: esc(f.nom), t2: `${esc(f.desc)}`, t3: `${eur(f.prix)} · ${f.jours} jours${f.requis ? ' · après ' + esc((CAT.technos[f.requis] || CAT.certifs[f.requis]).nom) : ''}`, btn });
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
  h += `<div class="section">Production en série</div>` + (e.series.length ? e.series.map((x) => ligne({ couleur: '#7be08a', t1: esc(x.nom), t2: `${esc(x.client)} · ~${eur(x.marge)} / mois`, t3: `Encore ${x.mois} mois` })).join('')
    : '<div class="vide">Livrez de beaux projets (7/10 ou plus) : certains clients commandent ensuite une série.</div>');
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
  $('#date').innerHTML = `${esc(e.date)}<small>${esc(e.entreprise)} · ${SAISON_NOM[e.saison]} · ${METEO_NOM[e.meteo] || ''}</small>`;
  const monde = $('#monde');
  monde.dataset.saison = e.saison;
  monde.dataset.meteo = e.meteo;
  monde.dataset.soir = e.heures >= 12 ? 'nuit' : e.heures >= 10 ? 'soir' : '';
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
    + Object.entries(VITESSES).map(([k, [nom]]) => `<button type="button" data-act="temps" data-id="${k}" class="${joue && vitesse === k ? 'actif' : ''}" aria-pressed="${joue && vitesse === k}">${nom}</button>`).join(''));
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('actif', b.dataset.id === onglet || (onglet === 'journal' && b.dataset.id === 'accueil')));
  $('#panneau').classList.toggle('ouvert', onglet !== 'accueil');
  $('#titre-panneau').textContent = TITRES[onglet];
  const contenu = { accueil: panneauAccueil, projets: panneauProjets, equipe: panneauEquipe, materiel: panneauMateriel, locaux: panneauLocaux, journal: () => panneauJournal(40), societe: panneauSociete }[onglet]();
  majHtml('#contenu-panneau', contenu);
  rendreMonde();
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

function pointMonde(ev) {
  const r = $('#monde').getBoundingClientRect(), s = r.width / PLAN.W, f = fiche(placement.type), g = CAT.grille;
  return [Math.round(((ev.clientX - r.left) / s - f.w / 2) / g) * g, Math.round(((ev.clientY - r.top) / s - f.h / 2) / g) * g];
}

function majFantome(ev) {
  if (!placement) return;
  const [x, y] = pointMonde(ev), f = fiche(placement.type), el = $('#fantome');
  Object.assign(el.style, { left: x + 'px', top: y + 'px', width: f.w + 'px', height: f.h + 'px' });
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

const chanceNego = (prix, delai, fid = 0) => Math.max(0.05, Math.min(1, 1 - 2.6 * (prix - 1) - 0.6 * (delai - 1) + 0.01 * ETAT.renommee + 0.05 * fid));
function modaleSignature() {
  const e = ETAT, sg = signature;
  const cible = sg.genre === 'signer' ? e.offres.find((o) => o.id === sg.id) : CAT.produits.find((x) => x.id === sg.id);
  if (!cible) { signature = null; return ''; }
  const groupe = (cat, cle, val, options, desc) => `<div class="section" style="margin-top:6px">${esc(cat)}</div><div class="onglets">${Object.entries(options).map(([k, o]) => {
    const bloque = o.requis && !e.technos.includes(o.requis);
    return `<button type="button" data-act="sig-opt" data-cle="${cle}" data-id="${k}" class="${val === k ? 'actif' : ''}" style="${val === k ? 'background:#ffc94d' : ''}" ${bloque ? 'disabled' : ''}>${esc(o.nom || o)}</button>`;
  }).join('')}</div>${desc ? `<p style="font-size:13px">${esc(desc)}</p>` : ''}`;
  let h = `<h2 id="modale-titre">${esc(cible.nom)}</h2><p>${sg.genre === 'signer' ? `${esc(cible.client)} · ${eur(cible.paie)} · ${cible.delai} j` : `Produit maison · prototype ${eur(cible.cout)}`}</p>`;
  if (cible.mega) h += `<p style="font-size:13px"><b>Méga-projet</b> : occupe 2 places de projet pendant ${cible.delai} jours, payé 25 % de plus.</p>`;
  if (cible.fidele) h += `<p style="font-size:13px">Client fidèle ${etoiles(cible.fidele)} : il accepte plus facilement vos conditions.</p>`;
  const sansMeca = sg.genre === 'signer' ? cible.total.m === 0 : cible.rep[1] === 0;
  for (const [cle, cat] of Object.entries(CAT.choix_tech)) {
    if (cle === 'boitier' && sansMeca) { h += `<div class="section" style="margin-top:6px">${esc(cat.nom)}</div><p style="font-size:13px">Pas de partie mécanique sur ce projet.</p>`; continue; }
    h += groupe(cat.nom, cle, sg.tech[cle], cat.options, cat.options[sg.tech[cle]].desc);
  }
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
  ['Produits maison', "Lancez vos produits, puis leurs suites : une v2 se vend d'autant mieux que la v1 a été bien notée."],
  ['Missions', "Trois missions sont proposées à la fois sur le tableau de bord. Chacune rapporte une prime, parfois de la renommée."],
  ['Équipe', "Chaque employé a des compétences (Élec, Méca 3D, Firmware), un trait, un moral et une fatigue. Formez-les, envoyez-les en congés."],
  ['Conditions de travail', "Décoration, café, climatisation, isolation et horaires changent la production (vue Productivité)."],
  ['Matériel et locaux', "Le matériel accélère le travail et réduit les défauts. Quittez le garage pour le bâtiment, puis louez ses pièces une à une : plus de projets en parallèle, jusqu'au hangar de production."],
  ['Plan', "Sur téléphone, faites glisser le plan au doigt et pincez pour zoomer. Les boutons + / − / ⌖ zooment et recentrent."],
  ['Aménagement', "Le bouton en haut à gauche permet de placer, déplacer ou revendre bureaux, appareils et décoration."],
  ['Société', "Recherche, certifications, fournisseurs, prêts et levée de fonds débloquent de meilleurs contrats."],
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
        ETAT = r.etat;
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
    case 'placer': joue = false; placement = { type: id }; amenage = true; selection = null; if (!tablette()) onglet = 'accueil'; return rendre();
    case 'placer-fin': placement = null; return rendre();
    case 'deplacer-sel': { const o = ETAT.objets.find((x) => x.id === selection); if (o) placement = { type: o.type, id: o.id }; return rendre(); }
    case 'vendre':
      if (!confirm('Revendre cet objet à moitié prix ?')) return;
      selection = null;
      break;
    case 'catmat': catMat = id; return rendre();
    case 'temps':
      if (id === 'pause') joue = false;
      else { joue = true; vitesse = id; }
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
      signature = { genre: b.dataset.genre, id, tech, prix: '1.0', delai: '1.0' };
      return rendre();
    }
    case 'sig-opt': {
      const cle = b.dataset.cle;
      if (cle === 'prix' || cle === 'delai') signature[cle] = brut; else signature.tech[cle] = brut;
      return rendre();
    }
    case 'sig-annuler': signature = null; return rendre();
    case 'sig-ok': {
      const sg = signature;
      signature = null;
      return agir(sg.genre, sg.genre === 'signer' ? { id: sg.id, prix: sg.prix, delai: sg.delai, tech: sg.tech } : { id: sg.id, tech: sg.tech });
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
  $('#monde').insertAdjacentHTML('beforeend', '<div id="fantome" class="fantome" hidden></div>');
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
  ouvrirMenu('menu');  // écran titre à chaque ouverture
}

demarrer();
