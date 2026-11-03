"""Banc du rendu : le plan s'ouvre dans Chromium sans écran (garage, puis bâtiment en mode démo) et la page ne lève aucune erreur.

    python tests/banc-rendu.py            (CAPTURE=dossier pour garder une image de chaque plan, ZOOM=2 pour la voir de près)

Sans serveur : une copie de web/ est ouverte en file://, l'API est simulée par l'état d'une vraie partie préparée par le moteur
(les actions renvoient cet état, figé). N'imprime qu'un bilan. Sans Chromium sur le poste, le banc est sauté (pas en CI).
"""
import json
import re
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
import serveur  # noqa: E402
from moteur.jeu import Jeu  # noqa: E402

navigateur = next((n for n in ("chromium", "chromium-browser", "google-chrome") if shutil.which(n)), None)
if not navigateur:
    print("SAUTÉ : pas de Chromium sur ce poste")
    sys.exit(0)

garage = Jeu(scenario="garage", graine=1, entreprise="Banc", directeur="Rendu")
batiment = Jeu(scenario="reprise", graine=1, difficulte="facile", entreprise="Banc", directeur="Rendu")
batiment.action("signer", id=batiment.vue()["offres"][0]["id"])  # un projet en cours : gestes de métier et bulles
for _ in range(3):
    batiment.action("avancer")
etats = {"garage": garage.vue(), "batiment": batiment.vue()}

tmp = Path(tempfile.mkdtemp())
web = tmp / "web"
shutil.copytree(RACINE / "web", web)
simulee = """<script>
window.onerror = (m, f, l) => console.log('BANC-ERREUR ' + m + ' ' + f + ':' + l);
window.addEventListener('unhandledrejection', (e) => console.log('BANC-ERREUR ' + ((e.reason && e.reason.stack) || e.reason)));
// témoin : module chargé, canvas posé, partie affichée (un observateur, pas un minuteur : Chromium logiciel les affame)
new MutationObserver(() => { if (!window.BANC_OK && window.RENDU && document.querySelector('canvas.rendu') && document.querySelector('#date').textContent.length > 3) { window.BANC_OK = 1; console.log('BANC-TEMOIN true,true,true'); const z = +new URLSearchParams(location.search).get('zoom'); if (z) { appliquerZoom(z); recentrer(); } } })
  .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
const BANC = %s, CAT_BANC = %s, ETAT_BANC = BANC[new URLSearchParams(location.search).get('carte')];
window.fetch = async (u) => new Response(JSON.stringify(u.includes('catalogue') ? CAT_BANC : u.includes('parties') ? { actuelle: 1, parties: [], records: [] }
  : u.includes('/api/action') || u.includes('/api/nouvelle') ? { ok: true, etat: ETAT_BANC } : ETAT_BANC), { headers: { 'Content-Type': 'application/json' } });
</script>
""" % (json.dumps(etats, ensure_ascii=False), json.dumps(serveur.CATALOGUE, ensure_ascii=False))
page = (web / "index.html").read_text(encoding="utf-8").replace('<script src="plan.js"></script>', simulee + '<script src="plan.js"></script>')
page = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>', '', page)  # hors ligne, la feuille de polices bloquerait les scripts
(web / "banc.html").write_text(page, encoding="utf-8")

capture = os.environ.get("CAPTURE")
ignorer = ("WebGPU", "favicon", "fonts.googleapis", "fonts.gstatic")
echecs = 0
for carte in ("garage", "batiment"):
    image = str(Path(capture) / ("rendu-%s.png" % carte)) if capture else str(tmp / "rendu.png")
    journal = subprocess.run([navigateur, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                              "--user-data-dir=" + str(tmp / "profil"), "--enable-logging=stderr", "--v=0", "--window-size=1280,860", "--timeout=9000",
                              "--screenshot=" + image, "file://%s/banc.html?demo&carte=%s&zoom=%s" % (web, carte, os.environ.get("ZOOM", ""))], capture_output=True, text=True, timeout=120).stderr
    erreurs = [l for l in journal.splitlines() if "CONSOLE" in l and any(m in l for m in ("BANC-ERREUR", "Error", "Uncaught", "Failed", "blocked")) and not any(i in l for i in ignorer)]
    temoin = "BANC-TEMOIN true,true,true" in journal  # module chargé, canvas posé, partie affichée
    if erreurs or not temoin or not Path(image).is_file():
        echecs += 1
        print("ECHEC %s : %d erreur(s)%s%s" % (carte, len(erreurs), "" if temoin else ", plan non affiché", "" if Path(image).is_file() else ", pas d'image"))
        for l in erreurs[:5]:
            print("  " + l.split("] ", 1)[-1][:220])
shutil.rmtree(tmp, ignore_errors=True)
if echecs:
    sys.exit(1)
print("OK : garage et bâtiment affichés, aucune erreur" + (" ; captures dans " + capture if capture else ""))
