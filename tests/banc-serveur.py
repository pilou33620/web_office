"""Banc du serveur : ce qu'il sert, ce qu'il refuse, sans réseau.

    python tests/banc-serveur.py

Démarre le serveur en mémoire sur un port libre de 127.0.0.1, sauvegardes dans un dossier temporaire.
"""
import http.client
import json
import os
import sys
import tempfile
import threading
from pathlib import Path

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
import serveur  # noqa: E402

serveur.Gestionnaire.log_message = lambda *a: None      # bilan court seulement
tmp = tempfile.TemporaryDirectory()
serveur.DOSSIER = Path(tmp.name)
serveur.JEU = serveur.Jeu()

srv = serveur.Serveur(("127.0.0.1", 0), serveur.Gestionnaire)
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]


def requete(chemin, hote=None, methode="GET", corps=None, entetes=None):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
    c.putrequest(methode, chemin, skip_host=True)
    c.putheader("Host", hote or "127.0.0.1:%d" % PORT)
    for k, v in (entetes or {}).items():
        c.putheader(k, v)
    if corps is not None and "Content-Length" not in (entetes or {}):
        c.putheader("Content-Length", str(len(corps)))
    c.endheaders()
    if corps:
        c.send(corps)
    r = c.getresponse()
    lu = r.read()
    c.close()
    return r.status, lu, r


def action(corps, entetes=None):
    return requete("/api/action", methode="POST", corps=corps, entetes={"X-WEB_OFFICE": "1", **(entetes or {})})


essais = echecs = 0


def verifier(nom, obtenu, attendu):
    global essais, echecs
    essais += 1
    if obtenu != attendu:
        echecs += 1
        print("ECHEC %s : attendu %r, obtenu %r" % (nom, attendu, obtenu))


# --- Fichiers servis et refusés ---------------------------------------------
for chemin, attendu in [
    ("/", 200), ("/index.html", 200), ("/jeu.js", 200), ("/plan.js", 200), ("/rendu.js", 200), ("/style.css", 200),
    ("/vendor/three/build/three.module.min.js", 200), ("/vendor/three/addons/postprocessing/GTAOPass.js", 200),
    ("/vendor/../serveur.py", 404), ("/vendor/%2e%2e/serveur.py", 404), ("/vendor/.cache", 404), ("/vendor/", 404),
    ("/api/etat", 200), ("/api/catalogue", 200), ("/api/parties", 200),
    ("/.git/config", 404), ("/.gitignore", 404), ("/serveur.py", 404), ("/appairage.py", 404),
    ("/../serveur.py", 404), ("/%2e%2e/serveur.py", 404), ("/.env", 404), ("/README.md", 404),
    ("/moteur/jeu.py", 404), ("/sauvegardes/partie_1.json", 404), ("/tests/banc-serveur.py", 404),
    ("/web/index.html", 404), ("/api/inconnue", 404),
]:
    verifier("GET " + chemin, requete(chemin)[0], attendu)
verifier("HEAD /.git/config", requete("/.git/config", methode="HEAD")[0], 404)
verifier("Host étranger", requete("/", "piege.example:8793")[0], 403)
verifier("Host étranger sur l'API", requete("/api/etat", "piege.example:8793")[0], 403)
verifier("Host IP locale", requete("/", "192.168.1.20:8793")[0], 200)
_, _, r = requete("/")
verifier("en-têtes", (r.getheader("X-Frame-Options"), r.getheader("X-Content-Type-Options"), r.getheader("Cache-Control"),
                      "frame-ancestors 'self'" in (r.getheader("Content-Security-Policy") or "")),
         ("SAMEORIGIN", "nosniff", "no-store, max-age=0", True))
verifier("type de jeu.js", requete("/jeu.js")[2].getheader("Content-Type"), "text/javascript; charset=utf-8")
verifier("type de three.js", requete("/vendor/three/build/three.module.min.js")[2].getheader("Content-Type"), "text/javascript; charset=utf-8")

# --- POST : en-tête maison, taille, JSON ------------------------------------
verifier("POST sans X-WEB_OFFICE", requete("/api/action", methode="POST", corps=b"{}")[0], 403)
verifier("POST trop grand", action(b"{}", {"Content-Length": "999999"})[0], 413)
verifier("POST Content-Length invalide", action(b"{}", {"Content-Length": "abc"})[0], 413)
verifier("POST JSON invalide", action(b"{pas du json")[0], 400)
verifier("POST JSON non objet", action(b"[1, 2]")[0], 400)
statut, corps, _ = action(json.dumps({"genre": "inconnu"}).encode())
verifier("action inconnue : refus propre", (statut, json.loads(corps)["ok"]), (200, False))
statut, corps, _ = requete("/api/nouvelle", methode="POST", corps=b'{"emplacement": 2}', entetes={"X-WEB_OFFICE": "1"})
verifier("nouvelle partie", (statut, json.loads(corps)["ok"]), (200, True))
verifier("sauvegarde dans le dossier des données", (Path(tmp.name) / "partie_2.json").is_file(), True)
statut, corps, _ = requete("/api/charger", methode="POST", corps=b'{"emplacement": 9}', entetes={"X-WEB_OFFICE": "1"})
verifier("emplacement inconnu", json.loads(corps)["ok"], False)

# Le temps qui passe n'écrit pas la sauvegarde à chaque jour simulé, seulement tous les 10 jours
(Path(tmp.name) / "partie_2.json").unlink()
action(json.dumps({"genre": "avancer"}).encode())
verifier("1 jour joué : pas d'écriture", (Path(tmp.name) / "partie_2.json").exists(), False)
action(json.dumps({"genre": "avancer", "jours": 9}).encode())
verifier("10 jours joués : sauvegarde écrite", (Path(tmp.name) / "partie_2.json").is_file(), True)

# Une sauvegarde illisible (ici un matériel retiré du catalogue) est mise de côté, jamais écrasée
abimee = json.loads((Path(tmp.name) / "partie_2.json").read_text(encoding="utf-8"))
abimee["materiel"].append("appareil_disparu")
texte = json.dumps(abimee)
(Path(tmp.name) / "partie_3.json").write_text(texte, encoding="utf-8")
statut, corps, _ = requete("/api/charger", methode="POST", corps=b'{"emplacement": 3}', entetes={"X-WEB_OFFICE": "1"})
verifier("sauvegarde illisible : refus de la charger", json.loads(corps)["ok"], False)
verifier("sauvegarde illisible : mise de côté intacte",
         (Path(tmp.name) / "partie_3.abime.json").read_text(encoding="utf-8") == texte, True)
statut, corps, _ = requete("/api/nouvelle", methode="POST", corps=b'{"emplacement": 3}', entetes={"X-WEB_OFFICE": "1"})
verifier("nouvelle partie à sa place : la copie reste", (Path(tmp.name) / "partie_3.abime.json").is_file(), True)

# Noms choisis à la création, visibles dans la liste des parties
corps_nouvelle = json.dumps({"emplacement": 1, "entreprise": "Ohm Sweet Ohm", "directeur": "Ada"}).encode()
statut, corps, _ = requete("/api/nouvelle", methode="POST", corps=corps_nouvelle, entetes={"X-WEB_OFFICE": "1"})
verifier("nouvelle partie nommée", json.loads(corps)["etat"]["entreprise"], "Ohm Sweet Ohm")
statut, corps, _ = requete("/api/nouvelle", methode="POST", corps=json.dumps({"emplacement": 1, "entreprise": "x" * 31}).encode(), entetes={"X-WEB_OFFICE": "1"})
verifier("nom trop long refusé", json.loads(corps)["ok"], False)
statut, corps, _ = requete("/api/parties")
parties = json.loads(corps)
verifier("liste : nom de l'entreprise", parties["parties"][0]["entreprise"], "Ohm Sweet Ohm")
verifier("liste : records vides au départ", parties["records"], [])

# Fin de partie : le score entre une seule fois dans les records, triés et limités à 10
for score in range(12):
    j = serveur.Jeu(entreprise=f"Société {score}", directeur="Ada")
    j.etat["fin"] = {**j.score_final(), "score": score}
    serveur.noter_record(j)
    serveur.noter_record(j)
records = serveur.lire_records()
verifier("records : 10 au plus, sans doublon", len(records), 10)
verifier("records : meilleur en tête", (records[0]["score"], records[0]["entreprise"], records[0]["directeur"]), (11, "Société 11", "Ada"))
(Path(tmp.name) / "records.json").write_text("{abîmé", encoding="utf-8")
verifier("records illisibles : liste vide", serveur.lire_records(), [])
verifier("records illisibles : mis de côté", (Path(tmp.name) / "records.abime.json").is_file(), True)

srv.shutdown()
print("OK (%d vérifications)" % essais if not echecs else "%d ECHEC(S) sur %d" % (echecs, essais))
sys.exit(1 if echecs else 0)
