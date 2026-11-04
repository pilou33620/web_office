"""Banc du rendu 3D : garage, RDC, R1 et R2 s'ouvrent dans Chromium sans écran, la marche et les effets tournent, sans erreur.

    python tests/banc-rendu.py            (CAPTURE=dossier pour garder une image de chaque plan, ZOOM=1 pour la voir de près, PLANS=r1,r2 pour en choisir)

Sans serveur : une copie de web/ est ouverte en file://, l'API est simulée par l'état d'une vraie partie préparée par le moteur
(tout le matériel, la déco et les bureaux posés ; les actions renvoient cet état, figé). N'imprime qu'un bilan.
Sans Chromium sur le poste, le banc est sauté (pas en CI). Long sur une machine sans carte graphique : à lancer en arrière-plan.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
import serveur  # noqa: E402
from moteur.donnees import DECO, MATERIEL  # noqa: E402
from moteur.jeu import ErreurJeu, Jeu  # noqa: E402

navigateur = next((n for n in ("chromium", "chromium-browser", "google-chrome") if shutil.which(n)), None)
if not navigateur:
    print("SAUTÉ : pas de Chromium sur ce poste")
    sys.exit(0)

garage = Jeu(scenario="garage", graine=1, entreprise="Banc", directeur="Rendu")
batiment = Jeu(scenario="reprise", graine=1, difficulte="facile", entreprise="Banc", directeur="Rendu")
batiment.etat["argent"], batiment.etat["renommee"] = 10 ** 7, 30
for m in MATERIEL:
    try:
        batiment.action("acheter", id=m)
    except ErreurJeu:
        pass
for d, f in DECO.items():
    for _ in range(4 if f.get("multiple") else 1):
        try:
            batiment.action("poser", id=d)
        except ErreurJeu:
            pass
while True:
    try:
        batiment.action("poser", id="poste")
    except ErreurJeu:
        break
batiment.action("signer", id=batiment.vue()["offres"][0]["id"])  # un projet en cours : gestes de métier et bulles
for _ in range(2):
    batiment.action("avancer")
etats = {"garage": garage.vue(), "batiment": batiment.vue()}

tmp = Path(tempfile.mkdtemp())
web = tmp / "web"
shutil.copytree(RACINE / "web", web)
simulee = """<script>
window.onerror = (m, f, l) => console.log('BANC-ERREUR ' + m + ' ' + f + ':' + l);
window.addEventListener('unhandledrejection', (e) => console.log('BANC-ERREUR ' + ((e.reason && e.reason.stack) || e.reason)));
const Q = new URLSearchParams(location.search), PLAN_BANC = Q.get('plan'), BANC = %s, CAT_BANC = %s, ETAT_BANC = BANC[PLAN_BANC === 'garage' ? 'garage' : 'batiment'];
// témoin : canvas posé, partie affichée (un observateur, pas un minuteur : Chromium logiciel les affame)
new MutationObserver(() => { if (!window.BANC_OK && window.RENDU && document.querySelector('canvas.rendu') && document.querySelector('#date').textContent.length > 3) { window.BANC_OK = 1; console.log('BANC-TEMOIN ok');
  const cs = []; console.log('BANC-SOLS ' + [[0, 0, 100, 100], [10, 10, 10, 10], [200, 0, 10, 10], [100, 0, 10, 10], [12, 12, 2, 2]].map((r) => PLAN.coucheSol(cs, ...r)));
  const quitte = (act, avant) => { joue = false; rejouer = avant; const q = document.createElement('button'); q.dataset.act = act; document.body.append(q); q.click(); q.remove(); return joue; };
  console.log('BANC-LECTURE ' + [quitte('par-fermer', true), quitte('sig-annuler', true), quitte('par-fermer', false)]); joue = true; boucle();
  const cad = $('#cadre'), bouge = () => { const a = [cad.scrollLeft, cad.scrollTop]; deplacerPlan(0.1); return [cad.scrollLeft - a[0], cad.scrollTop - a[1]]; };
  const touche = (type, code, o = {}, cible = document.body) => cible.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...o }));
  appliquerZoom(1.5); cad.scrollLeft = cad.scrollTop = 300;
  const z0 = zoom; cad.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })); const zoomPlus = zoom > z0;
  touche('keydown', 'KeyD'); touche('keydown', 'KeyW'); const [dx, dy] = bouge(); touche('keyup', 'KeyD'); touche('keyup', 'KeyW');
  const lache = bouge().every((v) => v === 0);
  touche('keydown', 'KeyD', { ctrlKey: true }); const ctrl = bouge().every((v) => v === 0);
  const saisie = document.createElement('input'); document.body.append(saisie); touche('keydown', 'KeyD', {}, saisie); saisie.remove(); const champ = bouge().every((v) => v === 0);
  console.log('BANC-COMMANDES ' + [zoomPlus, dx > 0, dy < 0, lache, ctrl, champ]);
  if (PLAN_BANC !== 'garage') { etage = PLAN_BANC; rendre(); }
  const z = +Q.get('zoom'); appliquerZoom(z || 0.62); recentrer(); } })
  .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
window.fetch = async (u) => new Response(JSON.stringify(u.includes('catalogue') ? CAT_BANC : u.includes('parties') ? { actuelle: 1, parties: [], records: [] }
  : u.includes('/api/action') || u.includes('/api/nouvelle') ? { ok: true, etat: ETAT_BANC } : ETAT_BANC), { headers: { 'Content-Type': 'application/json' } });
</script>
""" % (json.dumps(etats, ensure_ascii=False), json.dumps(serveur.CATALOGUE, ensure_ascii=False))
page = (web / "index.html").read_text(encoding="utf-8").replace('<script src="plan.js"></script>', simulee + '<script src="plan.js"></script>')
page = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>', '', page)  # hors ligne, la feuille de polices bloquerait les scripts
(web / "banc.html").write_text(page, encoding="utf-8")

COMMANDES = "BANC-COMMANDES true,true,true,true,true,true"
capture = os.environ.get("CAPTURE")
ignorer = ("WebGPU", "favicon", "fonts.googleapis", "fonts.gstatic")
base = [navigateur, "--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--allow-file-access-from-files", "--enable-logging=stderr", "--v=0"]
fautes = lambda journal: [l for l in journal.splitlines() if "CONSOLE" in l and any(m in l for m in ("BANC-ERREUR", "Error", "Uncaught", "Failed", "blocked")) and not any(i in l for i in ignorer)]
echecs = 0
plans = os.environ.get("PLANS", "garage,rdc,r1,r2").split(",")
for nom in plans:
    image = str(Path(capture) / ("jeu3d-%s.png" % nom)) if capture else str(tmp / "rendu.png")
    journal = subprocess.run(base + ["--user-data-dir=" + str(tmp / ("profil-" + nom)), "--window-size=1280,860", "--timeout=70000", "--screenshot=" + image,
                                     "file://%s/banc.html?demo&plan=%s&zoom=%s" % (web, nom, os.environ.get("ZOOM", ""))], capture_output=True, text=True, timeout=200).stderr
    erreurs = fautes(journal)
    if erreurs or "BANC-TEMOIN ok" not in journal or "BANC-SOLS 1,2,1,1,3" not in journal or "BANC-LECTURE true,true,false" not in journal or COMMANDES not in journal or not Path(image).is_file():
        echecs += 1
        print("ECHEC %s : %d erreur(s)%s" % (nom, len(erreurs), ("" if "BANC-TEMOIN ok" in journal else ", plan non affiché") + ("" if "BANC-SOLS 1,2,1,1,3" in journal else ", couches de sol fausses") + ("" if "BANC-LECTURE true,true,false" in journal else ", ne démarre pas en lecture") + ("" if COMMANDES in journal else ", molette ou ZQSD en panne")))
        for l in erreurs[:4]:
            print("  " + l.split("] ", 1)[-1][:240])

# Marche et effets, sur une petite page en temps virtuel : un chemin de 20 s, puis un rafraîchissement vers la même cible sans chemin (comme rendrePersos) :
# le personnage doit être en route, pas arrivé ; fumée, confettis, gestes et météo tournent sans erreur
(web / "effets.html").write_text("""<!doctype html><html><body style="margin:0">
<main id="zone" style="position:relative;width:480px;height:300px"><div id="cadre" style="position:absolute;inset:0;overflow:hidden"><div id="echelle" style="position:relative;width:1960px;height:1220px"><div id="bulles"></div></div></div></main>
<script>
window.onerror = (m, f, l) => console.log('BANC-ERREUR ' + m + ' ' + f + ':' + l);
window.addEventListener('unhandledrejection', (e) => console.log('BANC-ERREUR ' + ((e.reason && e.reason.stack) || e.reason)));
</script>
<script src="plan.js"></script>
<script type="importmap">{ "imports": { "three": "./vendor/three/build/three.module.min.js", "three/addons/": "./vendor/three/addons/" } }</script>
<script type="module" src="rendu.js"></script>
<script type="module">
const $ = (s) => document.querySelector(s);
await RENDU.init($('#zone'), $('#cadre'), $('#echelle'), $('#bulles'));
RENDU.ambiance({ meteo: 'orage', saison: 'printemps', dehors: true, soir: 'nuit' });
RENDU.effets(new Map(['etincelles', 'onde', 'tete', 'four', 'copeaux', 'fumee', 'confettis'].map((t, k) => [t, [t, 200 + k * 30, 200, 20]])));
RENDU.course([{ figure: { couleur: '#d9534f', cheveux: '#111', peau: '#f6cfa6', i: 1, assis: true, pose: 'debout' }, x1: 200, y1: 300, x2: 400, y2: 300, t: 2 }]);
const F = { couleur: '#3a7bc8', cheveux: '#2b1d14', peau: '#f6cfa6', i: 2, assis: false, pose: 'debout' }, perso = (o) => RENDU.persos([{ id: 't', figure: F, cote: null, anim: '', ...o }]);
let n = 0, t0 = 0, vu = false;
const image = () => {
  n++;
  if (n === 1) perso({ x: 20, y: 280, carton: true, bulle: { texte: 'Bonjour', couleur: '#fff7e6' } });
  if (n === 2) { perso({ x: 460, y: 280, chemin: [[460, 280]], duree: 20 }); t0 = performance.now(); }
  if (n === 3) perso({ x: 460, y: 280 });
  if (!vu && n > 3 && performance.now() - t0 > 1000) { vu = true; const [x] = RENDU.position('t'); console.log('BANC-MARCHE ' + (x > 20.5 && x < 459 ? 'en-route' : 'x=' + Math.round(x))); RENDU.passage('camion'); }
  if (vu && performance.now() - t0 > 2500) console.log('BANC-EFFETS ok'); else requestAnimationFrame(image);
};
requestAnimationFrame(image);
</script></body></html>""", encoding="utf-8")
journal = subprocess.run(base + ["--user-data-dir=" + str(tmp / "profil-effets"), "--window-size=480,300", "--virtual-time-budget=6000", "--screenshot=" + str(tmp / "effets.png"),
                                 "file://%s/effets.html" % web], capture_output=True, text=True, timeout=200).stderr
erreurs = fautes(journal)
if erreurs or "BANC-EFFETS ok" not in journal or "BANC-MARCHE en-route" not in journal:
    echecs += 1
    print("ECHEC effets : %d erreur(s)%s%s" % (len(erreurs), "" if "BANC-EFFETS ok" in journal else ", effets non joués", "" if "BANC-MARCHE en-route" in journal else ", la marche est coupée"))
    for l in erreurs[:4]:
        print("  " + l.split("] ", 1)[-1][:240])
shutil.rmtree(tmp, ignore_errors=True)
if echecs:
    sys.exit(1)
print("OK : %d plans affichés, marche et effets, aucune erreur" % len(plans) + (" ; captures dans " + capture if capture else ""))
