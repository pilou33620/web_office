#!/usr/bin/env python3
"""Serveur de Circuit Story : sert l'interface web et l'API JSON du moteur.

Usage : python3 serveur.py [--port 8095] [--hote 0.0.0.0]
"""
import argparse
import json
import mimetypes
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from moteur import ErreurJeu, Jeu
from moteur import donnees

RACINE = Path(__file__).resolve().parent
WEB = RACINE / "web"
DOSSIER = RACINE / "sauvegardes"
EMPLACEMENTS = (1, 2, 3)
VERROU = threading.Lock()


def fichier_partie(n):
    return DOSSIER / f"partie_{n}.json"


def lire_partie(n):
    try:
        jeu = Jeu(json.loads(fichier_partie(n).read_text(encoding="utf-8")))
        jeu.vue()  # sauvegarde abîmée ou d'une ancienne version : on la considère absente
        return jeu
    except Exception:
        return None


def sauver(jeu):
    DOSSIER.mkdir(exist_ok=True)
    tmp = fichier_partie(EMPLACEMENT).with_suffix(".tmp")
    tmp.write_text(json.dumps(jeu.etat, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, fichier_partie(EMPLACEMENT))  # écriture atomique : pas de sauvegarde corrompue si coupure
    (DOSSIER / "emplacement.txt").write_text(str(EMPLACEMENT), encoding="utf-8")


def resume_partie(n):
    jeu = lire_partie(n)
    if not jeu:
        return {"emplacement": n, "existe": False}
    v = jeu.vue()
    return {"emplacement": n, "existe": True, "date": v["date"], "argent": v["argent"], "annee": v["annee_jeu"],
            "renommee": v["renommee"], "scenario": donnees.SCENARIOS[v["scenario"]]["nom"],
            "difficulte": donnees.DIFFICULTES[v["difficulte"]]["nom"], "faillite": v["faillite"]}


# Ancienne sauvegarde unique -> emplacement 1
if (DOSSIER / "partie.json").exists() and not fichier_partie(1).exists():
    os.replace(DOSSIER / "partie.json", fichier_partie(1))
try:
    EMPLACEMENT = int((DOSSIER / "emplacement.txt").read_text(encoding="utf-8"))
    assert EMPLACEMENT in EMPLACEMENTS
except (OSError, ValueError, AssertionError):
    EMPLACEMENT = 1
JEU = lire_partie(EMPLACEMENT) or Jeu()
CATALOGUE = {
    "materiel": donnees.MATERIEL, "deco": donnees.DECO, "locaux": donnees.LOCAUX, "traits": donnees.TRAITS,
    "produits": donnees.PRODUITS, "domaines": donnees.NOM_DOMAINE,
    "horaires": donnees.HORAIRES, "combos": donnees.COMBOS, "trophees": donnees.TROPHEES,
    "pieces": donnees.PIECES, "etablis": donnees.ETABLIS, "poste": donnees.POSTE, "grille": donnees.GRILLE,
    "choix_tech": donnees.CHOIX_TECH, "prix_proposes": donnees.PRIX_PROPOSES, "delais_proposes": donnees.DELAIS_PROPOSES,
    "technos": donnees.TECHNOS, "certifs": donnees.CERTIFS, "fournisseurs": donnees.FOURNISSEURS, "prets": donnees.PRETS,
    "scenarios": donnees.SCENARIOS, "difficultes": donnees.DIFFICULTES, "entretien_certif": donnees.ENTRETIEN_CERTIF,
}


class Gestionnaire(BaseHTTPRequestHandler):
    def _json(self, code, data):
        corps = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        chemin = self.path.split("?")[0]
        if chemin == "/api/etat":
            with VERROU:
                try:
                    return self._json(200, JEU.vue())
                except Exception as ex:
                    return self._json(500, {"ok": False, "erreur": f"Erreur interne : {ex}"})
        if chemin == "/api/catalogue":
            return self._json(200, CATALOGUE)
        if chemin == "/api/parties":
            with VERROU:
                return self._json(200, {"actuelle": EMPLACEMENT, "parties": [resume_partie(n) for n in EMPLACEMENTS]})
        fichier = (WEB / (chemin.lstrip("/") or "index.html")).resolve()
        if WEB not in fichier.parents or not fichier.is_file():
            self.send_error(404)
            return
        corps = fichier.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(fichier.name)[0] or "application/octet-stream") + "; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_POST(self):
        global JEU, EMPLACEMENT
        try:
            taille = int(self.headers.get("Content-Length", 0))
            if taille > 10_000:
                return self._json(413, {"ok": False, "erreur": "Requête trop grande."})
            data = json.loads(self.rfile.read(taille) or b"{}")
            if not isinstance(data, dict):
                raise ValueError
        except ValueError:
            return self._json(400, {"ok": False, "erreur": "JSON invalide."})
        chemin = self.path.split("?")[0]
        with VERROU:
            if chemin in ("/api/nouvelle", "/api/charger"):
                n = data.get("emplacement", EMPLACEMENT)
                if type(n) is not int or n not in EMPLACEMENTS:
                    return self._json(200, {"ok": False, "erreur": "Emplacement inconnu.", "etat": JEU.vue()})
                if chemin == "/api/charger":
                    jeu = lire_partie(n)
                    if not jeu:
                        return self._json(200, {"ok": False, "erreur": "Emplacement vide.", "etat": JEU.vue()})
                else:
                    try:
                        jeu = Jeu(scenario=data.get("scenario", "garage"), difficulte=data.get("difficulte", "normal"))
                    except (ErreurJeu, TypeError) as ex:
                        return self._json(200, {"ok": False, "erreur": str(ex) if isinstance(ex, ErreurJeu) else "Paramètres invalides.", "etat": JEU.vue()})
                sauver(JEU)
                JEU, EMPLACEMENT = jeu, n
                sauver(JEU)
                return self._json(200, {"ok": True, "etat": JEU.vue()})
            if chemin != "/api/action":
                return self._json(404, {"ok": False, "erreur": "Route inconnue."})
            genre = data.pop("genre", "")
            try:
                JEU.action(genre, **data)
                erreur = None
            except ErreurJeu as ex:
                erreur = str(ex)
            except (TypeError, ValueError, OverflowError, KeyError):
                erreur = "Paramètres invalides."
            sauver(JEU)
            return self._json(200, {"ok": erreur is None, "erreur": erreur, "etat": JEU.vue()})

    def log_message(self, *args):
        pass  # silence : le jeu fait une requête par jour simulé


def main():
    ap = argparse.ArgumentParser(description="Circuit Story")
    ap.add_argument("--port", type=int, default=8095)
    ap.add_argument("--hote", default="0.0.0.0")
    a = ap.parse_args()
    print(f"Circuit Story : http://localhost:{a.port}")
    ThreadingHTTPServer((a.hote, a.port), Gestionnaire).serve_forever()


if __name__ == "__main__":
    main()
