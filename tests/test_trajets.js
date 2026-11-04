// Trajets des personnages : aucun tronçon ne traverse une cloison ni un objet, sur une partie réelle remplie (matériel, déco, bureaux) et au garage ; chaque siège et chaque pièce restent atteignables.
// Lancement : node tests/test_trajets.js (n'imprime qu'un bilan ; DETAIL=1 pour le détail des fautes)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');

const racine = path.join(__dirname, '..');
const donnees = JSON.parse(execFileSync('python3', ['-c', `
import json
from moteur import donnees as d
from moteur.jeu import ErreurJeu, Jeu
g = Jeu(scenario="garage", graine=1, entreprise="T", directeur="T")
b = Jeu(scenario="reprise", graine=1, difficulte="facile", entreprise="T", directeur="T")
for j in (g, b):
    j.etat["argent"], j.etat["renommee"] = 10 ** 7, 30
    for m in d.MATERIEL:
        try: j.action("acheter", id=m)
        except ErreurJeu: pass
    for x, f in d.DECO.items():
        for _ in range(4 if f.get("multiple") else 1):
            try: j.action("poser", id=x)
            except ErreurJeu: pass
    while True:
        try: j.action("poser", id="poste")
        except ErreurJeu: break
print(json.dumps({"cat": {"pieces": d.PIECES, "coques": d.COQUES, "communs": d.COMMUNS, "etages": d.ETAGES, "cloisons": d.CLOISONS, "ouvertures": d.OUVERTURES, "dehors": d.DEHORS,
  "poste": d.POSTE, "materiel": d.MATERIEL, "deco": d.DECO, "obstacles": d.OBSTACLES, "etablis": d.ETABLIS}, "garage": g.etat["objets"], "batiment": b.etat["objets"], "locaux": b.etat["locaux"]}))
`], { cwd: racine, maxBuffer: 1 << 26 }));
const CAT = donnees.cat;
// les murs intérieurs ne sont pas exportés : on les expose pour le test seulement
const source = fs.readFileSync(path.join(racine, 'web/plan.js'), 'utf8').replace('return {\n    W, H,', 'return {\n    cloisonsEtage, W, H,');
const ctx = {};
vm.runInNewContext(source + '\nthis.PLAN = PLAN;', ctx);
const PLAN = ctx.PLAN;

const croise = ([ax, ay], [bx, by], [cx, cy, dx, dy]) => {  // croisement franc de deux segments
  const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  return o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0;
};
const rectObjet = (o) => { const f = o.type === 'poste' ? CAT.poste : CAT.materiel[o.type] || CAT.deco[o.type], t = o.cote === 'o' || o.cote === 'e'; return [o.x, o.y, t ? f.h : f.w, t ? f.w : f.h]; };
const dansRect = ([x, y, w, h], px, py) => px > x && px < x + w && py > y && py < y + h;
let n = 0, fautes = 0, sans = 0, debout = 0;
const faute = (...m) => { fautes++; if (process.env.DETAIL) console.log(...m); };

function verifie(E, murs, rects, a, b, propres) {
  const pts = [a, ...PLAN.trajet(E, CAT, a[0], a[1], b[0], b[1])];
  n++;
  if (pts.length === 1) { sans++; if (process.env.DETAIL) console.log('sans chemin', a, b); return; }
  for (let k = 1; k < pts.length; k++) {
    const [p, q] = [pts[k - 1], pts[k]], m = murs.find((m) => croise(p, q, m));
    if (m) faute('mur', a, b, m);
    const L = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]));
    for (let u = 0; u <= L; u++) {
      const x = p[0] + (q[0] - p[0]) * u / (L || 1), y = p[1] + (q[1] - p[1]) * u / (L || 1), r = rects.find((r) => dansRect(r, x, y) && !propres.some((c) => dansRect(r, c[0], c[1])));
      if (r) { faute('objet', a, b, r); break; }
    }
  }
}
// propres : le bureau d'un siège de départ ou d'arrivée peut être longé pour s'y asseoir ; le point de départ ou d'arrivée « dans » un objet est replacé avant
function carte(E, murs, rects, sieges, lieux) {
  const libres = lieux.map(([x, y]) => PLAN.pointLibre(E, CAT, x, y));
  for (const p of libres) if (rects.some((r) => dansRect(r, p[0], p[1]))) { debout++; if (process.env.DETAIL) console.log('debout dans un objet', p); }
  for (const a of libres) for (const b of libres) if (a !== b) verifie(E, murs, rects, a, b, []);
  for (const s of sieges) for (const b of libres) { verifie(E, murs, rects, s, b, [s]); verifie(E, murs, rects, b, s, [s]); }
}
const debouts = (l) => l.filter((o) => { const f = o.type === 'poste' ? CAT.poste : CAT.materiel[o.type] || CAT.deco[o.type]; return f && !f.libre; });

// les repères de jeu.js, relus à la source
const jeu = fs.readFileSync(path.join(racine, 'web/jeu.js'), 'utf8'), repere = (nom) => JSON.parse(new RegExp(`const ${nom} = (\\{.*?\\});`).exec(jeu)[1].replace(/(\w+):/g, '"$1":'));
const ESCALIERS = repere('ESCALIERS');
const E = { locaux: donnees.locaux, objets: donnees.batiment };
for (const et of Object.keys(CAT.etages)) {
  PLAN.etage(et, CAT);
  const y0 = CAT.etages[et].y0, surEtage = (y) => y >= y0 && y < y0 + 1000;
  const objets = debouts(E.objets).filter((o) => surEtage(o.y));
  const rects = [...objets.map(rectObjet), ...CAT.obstacles.batiment.filter((r) => surEtage(r[1])), ...CAT.etablis.batiment.filter((r) => surEtage(r[1])), ...CAT.communs[et].map((c) => c.slice(1))];
  const lieux = Object.values(CAT.pieces).filter((p) => p.etage === et).map((p) => p.rect).concat(CAT.dehors[et]).map(([x, y, w, h]) => [x + w / 2, y + h / 2]);
  carte(E, PLAN.cloisonsEtage(CAT).restants, rects, objets.filter((o) => o.type === 'poste').map((o) => PLAN.siege(o)), [...lieux, ESCALIERS[et]]);
}
// le garage : l'entrée, l'établi, le salon de jardin (le point au milieu de la table est replacé), la pelouse derrière la maison
const G = { locaux: [], objets: donnees.garage };
PLAN.etage('garage', CAT);
const [gx, gy, gw] = [430, 400, 250], mursGarage = [[gx, gy, gx + gw, gy], [gx, gy, gx, gy + gw], [gx + gw, gy, gx + gw, gy + gw], [gx, gy + gw, gx + 50, gy + gw], [gx + 200, gy + gw, gx + gw, gy + gw]];
const objetsG = debouts(G.objets);
carte(G, mursGarage, [[70, 300, 320, 380], [540, 700, 28, 56], [146, 703, 28, 28], ...objetsG.map(rectObjet), ...CAT.obstacles.garage, ...CAT.etablis.garage],
  objetsG.filter((o) => o.type === 'poste').map((o) => PLAN.siege(o)), [[510, 700], [524, 466], [160, 717], [280, 262], [350, 290]]);

// la course de fauteuils du vendredi (jeu.js) : les couloirs sont libres dans le bâtiment rempli
for (const [et, [[x1, y1], [x2, y2]]] of Object.entries(repere('COULOIRS'))) {
  if (et === 'garage') continue;  // dans un garage plein, un bureau peut barrer : pas de course ce soir-là
  PLAN.etage(et, CAT);
  for (const k of [0, 1, 2]) if (!PLAN.ligneLibre(E, CAT, [x1, y1 + k * 12], [x2, y2 + k * 12])) faute('couloir barré', et, k);
}

console.log(`trajets : ${n} testés, ${fautes} traversent un mur ou un objet, ${sans} sans chemin, ${debout} debout dans un objet`);
process.exit(fautes || sans || debout ? 1 : 0);
