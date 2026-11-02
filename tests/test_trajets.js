// Trajets des personnages : entre toutes les pièces d'un étage (et le parvis, la terrasse), aucun tronçon ne traverse une cloison : on passe par les portes.
// Lancement : node tests/test_trajets.js (n'imprime qu'un bilan)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');

const racine = path.join(__dirname, '..');
const CAT = JSON.parse(execFileSync('python3', ['-c',
  'import json; from moteur import donnees as d; print(json.dumps({"pieces": d.PIECES, "coques": d.COQUES, "communs": d.COMMUNS, "etages": d.ETAGES, "cloisons": d.CLOISONS, "ouvertures": d.OUVERTURES, "dehors": d.DEHORS}))'], { cwd: racine }));
// les murs intérieurs ne sont pas exportés : on les expose pour le test seulement
const source = fs.readFileSync(path.join(racine, 'web/plan.js'), 'utf8').replace('return {\n    W, H,', 'return {\n    cloisonsEtage, W, H,');
const ctx = {};
vm.runInNewContext(source + '\nthis.PLAN = PLAN;', ctx);
const PLAN = ctx.PLAN, E = { locaux: ['bureau'] };

const croise = ([ax, ay], [bx, by], [cx, cy, dx, dy]) => {  // croisement franc de deux segments
  const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  return o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0;
};
let n = 0, fautes = 0, droits = 0;
for (const et of Object.keys(CAT.etages)) {
  PLAN.etage(et, CAT);
  const murs = PLAN.cloisonsEtage(CAT).restants;
  const centres = Object.values(CAT.pieces).filter((p) => p.etage === et).map((p) => p.rect).concat(CAT.dehors[et]).map(([x, y, w, h]) => [x + w / 2, y + h / 2]);
  for (const a of centres) for (const b of centres) {
    if (a === b) continue;
    const pts = [a, ...PLAN.trajet(E, CAT, a[0], a[1], b[0], b[1])];
    n++;
    if (pts.length === 2 && murs.some((m) => croise(a, b, m))) droits++;  // repli tout droit : pas de chemin trouvé
    for (let k = 1; k < pts.length; k++) { const m = murs.find((m) => croise(pts[k - 1], pts[k], m)); if (m) { fautes++; if (process.env.DETAIL) console.log(et, JSON.stringify(pts[k - 1]), JSON.stringify(pts[k]), JSON.stringify(m)); break; } }
  }
}
console.log(`trajets : ${n} testés, ${fautes} traversent un mur, ${droits} sans chemin`);
process.exit(fautes ? 1 : 0);
