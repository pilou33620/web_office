#!/usr/bin/python3
"""Serveur de Circuit Story : sert l'interface web et l'API JSON du moteur.

Usage : python3 serveur.py [--port 8793] [--local] [--sans-navigateur] [--sans-pause] [--sans-maj]
Mode démo : python3 demo.py (partie jouée toute seule, sauvegardes à part dans sauvegardes/demo).

PAS « /usr/bin/env python3 » en première ligne : sous Windows, py.exe ne
reconnaît que « /usr/bin/python3 » (voir REGLES-NOUVEAU-WEB-TOOL.md §3.4).
"""
import argparse
import http.server
import json
import os
import re
import shutil
import signal
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from pathlib import Path

import appairage
from moteur import ErreurJeu, Jeu
from moteur import donnees

RACINE = Path(__file__).resolve().parent
WEB = RACINE / "web"
DEMO = os.environ.get("CIRCUIT_STORY_DEMO") == "1"   # lancé par demo.py : le pilote automatique joue, vos sauvegardes ne sont pas touchées
DOSSIER = RACINE / "sauvegardes" / "demo" if DEMO else RACINE / "sauvegardes"
EMPLACEMENTS = (1, 2, 3)
VERROU = threading.Lock()
JOURS_ENTRE_SAUVEGARDES = 10   # en jeu, on n'écrit pas la carte SD à chaque jour simulé
SAUVE_JOUR = 0
NB_RECORDS = 10


def fichier_partie(n):
    return DOSSIER / f"partie_{n}.json"


def mettre_de_cote(fichier):
    """Renomme un fichier illisible au lieu de le laisser écraser par un état neuf."""
    i = 1
    while (abime := fichier.with_name(f"{fichier.stem}.abime{'' if i == 1 else f'-{i}'}.json")).exists():
        i += 1
    os.replace(fichier, abime)
    return abime


def lire_partie(n):
    try:
        jeu = Jeu(json.loads(fichier_partie(n).read_text(encoding="utf-8")))
        jeu.vue()  # vérifie aussi qu'elle s'affiche (catalogue changé par une mise à jour…)
        return jeu
    except FileNotFoundError:
        return None
    except Exception as exc:
        try:
            abime = mettre_de_cote(fichier_partie(n))
            print(f"[!] Sauvegarde {n} illisible ({type(exc).__name__}) : mise de côté dans {abime}", flush=True)
        except OSError as err:
            print(f"[!] Sauvegarde {n} illisible et impossible à mettre de côté : {err}", flush=True)
        return None


def sauver(jeu):
    global SAUVE_JOUR
    ecrire_json(fichier_partie(EMPLACEMENT), jeu.etat)
    SAUVE_JOUR = jeu.etat["jours_total"]


def ecrire_json(fichier, data):
    DOSSIER.mkdir(parents=True, exist_ok=True)
    tmp = fichier.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, fichier)  # écriture atomique : pas de fichier corrompu si coupure


def lire_records():
    fichier = DOSSIER / "records.json"
    try:
        records = json.loads(fichier.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            raise ValueError("pas une liste")
        return records
    except FileNotFoundError:
        return []
    except (OSError, ValueError) as exc:
        try:
            print(f"[!] Records illisibles ({exc}) : mis de côté dans {mettre_de_cote(fichier)}", flush=True)
        except OSError:
            pass
        return []


def noter_record(jeu):
    """Ajoute le score de fin de partie aux meilleurs scores de toujours, une seule fois par partie."""
    fin = jeu.etat.get("fin")
    if not fin or fin.get("record"):
        return
    nouveau = {k: fin.get(k) for k in ("entreprise", "directeur", "score", "titre")}
    nouveau["date"] = time.strftime("%d/%m/%Y")
    records = sorted(lire_records() + [nouveau], key=lambda r: -r.get("score", 0) if isinstance(r, dict) else 0)
    try:
        ecrire_json(DOSSIER / "records.json", records[:NB_RECORDS])
        fin["record"] = True
    except OSError as exc:
        print(f"[!] Record non enregistré : {exc}", flush=True)   # nouvel essai à la prochaine action


def resume_partie(n):
    jeu = lire_partie(n)
    if not jeu:
        return {"emplacement": n, "existe": False}
    v = jeu.vue()
    return {"emplacement": n, "existe": True, "entreprise": v["entreprise"], "date": v["date"], "argent": v["argent"], "annee": v["annee_jeu"],
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
if DEMO:  # chaque démo repart d'une société déjà installée, pour voir tout de suite la vie du bureau
    EMPLACEMENT, JEU = 1, Jeu(scenario="reprise", difficulte="facile", entreprise="Circuit Démo", directeur="Pilote automatique")
CATALOGUE = {
    "materiel": donnees.MATERIEL, "deco": donnees.DECO, "locaux": donnees.LOCAUX, "traits": donnees.TRAITS,
    "produits": donnees.PRODUITS, "domaines": donnees.NOM_DOMAINE,
    "horaires": donnees.HORAIRES, "combos": donnees.COMBOS, "trophees": donnees.TROPHEES,
    "pieces": donnees.PIECES, "etablis": donnees.ETABLIS, "obstacles": donnees.OBSTACLES, "poste": donnees.POSTE, "grille": donnees.GRILLE,
    "choix_tech": donnees.CHOIX_TECH, "prix_proposes": donnees.PRIX_PROPOSES, "delais_proposes": donnees.DELAIS_PROPOSES,
    "technos": donnees.TECHNOS, "certifs": donnees.CERTIFS, "fournisseurs": donnees.FOURNISSEURS, "prets": donnees.PRETS,
    "scenarios": donnees.SCENARIOS, "difficultes": donnees.DIFFICULTES, "entretien_certif": donnees.ENTRETIEN_CERTIF,
    "secteurs": donnees.SECTEURS, "nb_missions": len(donnees.MISSIONS),
    "metiers": donnees.METIERS, "seniorites": donnees.SENIORITES, "motivations": donnees.MOTIVATIONS, "cout_entretien": donnees.COUT_ENTRETIEN,
    "etages": donnees.ETAGES, "coques": donnees.COQUES, "communs": donnees.COMMUNS, "cloisons": donnees.CLOISONS,
    "ouvertures": donnees.OUVERTURES, "dehors": donnees.DEHORS, "meubles": donnees.MEUBLES,
    "roles": donnees.ROLES, "kickoff": donnees.KICKOFF, "brevet": donnees.BREVET, "service_sans_resp": donnees.SERVICE_SANS_RESP,
    "exigeants": donnees.EXIGEANTS, "lots": donnees.LOTS, "agrandir_stock": donnees.AGRANDIR_STOCK, "stockage": donnees.STOCKAGE,
    "commission": donnees.COMMISSION, "prime_commercial": donnees.PRIME_COMMERCIAL,
    "investissements": donnees.INVESTISSEMENTS,
}


# Ce que la page charge, et rien d'autre de web/
STATIQUE = re.compile(r"^/(?:index\.html|jeu\.js|plan\.js|style\.css)?$")
CORPS_MAX = 10_000
GARDE = appairage.Garde("WEB_OFFICE", actif=False)   # remplacé dans main() selon --local


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    timeout = 60
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def parse_request(self):
        # Host, Internet, TLS, jeton : avant tout traitement de la requête
        return super().parse_request() and GARDE.filtrer(self)

    def _json(self, code, data):
        corps = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def send_head(self):
        # GET et HEAD passent tous deux par ici
        if not STATIQUE.match(urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)):
            self.send_error(404, "File not found")
            return None
        return super().send_head()

    def do_GET(self):
        chemin = urllib.parse.urlsplit(self.path).path
        if chemin == "/api/etat":
            with VERROU:
                try:
                    return self._json(200, JEU.vue())
                except Exception:
                    return self._json(500, {"ok": False, "erreur": "Erreur interne."})
        if chemin == "/api/catalogue":
            return self._json(200, CATALOGUE)
        if chemin == "/api/parties":
            with VERROU:
                return self._json(200, {"actuelle": EMPLACEMENT, "parties": [resume_partie(n) for n in EMPLACEMENTS],
                                        "records": lire_records()})
        return super().do_GET()

    def do_POST(self):
        global JEU, EMPLACEMENT
        if self.headers.get("X-WEB_OFFICE") != "1":
            return self._json(403, {"ok": False, "erreur": "Requête refusée."})
        try:
            taille = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            taille = -1
        if not 0 <= taille <= CORPS_MAX:
            self.close_connection = True
            return self._json(413, {"ok": False, "erreur": "Requête trop grande."})
        try:
            data = json.loads(self.rfile.read(taille) or b"{}")
            if not isinstance(data, dict):
                raise ValueError
        except ValueError:
            return self._json(400, {"ok": False, "erreur": "JSON invalide."})
        chemin = urllib.parse.urlsplit(self.path).path
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
                        jeu = Jeu(scenario=data.get("scenario", "garage"), difficulte=data.get("difficulte", "normal"),
                                  entreprise=data.get("entreprise"), directeur=data.get("directeur"))
                    except (ErreurJeu, TypeError) as ex:
                        return self._json(200, {"ok": False, "erreur": str(ex) if isinstance(ex, ErreurJeu) else "Paramètres invalides.", "etat": JEU.vue()})
                sauver(JEU)
                JEU, EMPLACEMENT = jeu, n
                sauver(JEU)
                (DOSSIER / "emplacement.txt").write_text(str(EMPLACEMENT), encoding="utf-8")
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
            noter_record(JEU)
            if genre != "avancer" or JEU.en_pause() or JEU.etat["jours_total"] - SAUVE_JOUR >= JOURS_ENTRE_SAUVEGARDES:
                sauver(JEU)
            return self._json(200, {"ok": erreur is None, "erreur": erreur, "etat": JEU.vue()})


    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Content-Security-Policy", "frame-ancestors 'self'")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, format, *args):
        # Le jeu fait une requête par jour simulé : les réussites ne remplissent pas le journal
        if (len(args) > 1 and str(args[1]) in ("200", "204", "304")) or format.startswith("Request timed out"):
            return
        super().log_message("%s", appairage.masquer(format % args))

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError):
            self.close_connection = True       # client parti : pas une erreur


class Serveur(socketserver.ThreadingTCPServer):
    # SO_REUSEADDR laisserait sous Windows deux serveurs partager un port
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


class ServeurDoublePile(Serveur):
    """IPv4 et IPv6 sur la même socket (Tailscale fd7a::) quand le système le permet."""
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except AttributeError as exc:
            raise OSError("IPV6_V6ONLY absent : pas de double pile") from exc
        super().server_bind()


def ipv4_libre(port):
    """Sous Windows, une socket double pile se lie même si l'IPv4 du port est déjà pris."""
    if os.name != "nt":
        return True
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def adresse_locale():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))     # aucun paquet n'est envoyé
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def ouvrir_serveur(hote, port, essais):
    """Le premier port libre à partir de `port`."""
    derniere = OSError("aucun port essayé")
    piles = [(ServeurDoublePile, "::"), (Serveur, hote)] if hote == "0.0.0.0" else [(Serveur, hote)]
    for p in range(port, port + essais):
        if hote == "0.0.0.0" and not ipv4_libre(p):
            derniere = OSError(f"l'IPv4 du port {p} est déjà pris")
            continue
        for classe, h in piles:
            try:
                return classe((h, p), Gestionnaire), p
            except OSError as e:
                derniere = e
    raise derniere


def verifier_et_appliquer_maj(dossier_racine=None):
    """Recherche les mises a jour sur GitHub via Git et les applique si disponible.

    Renvoie True si une mise a jour a ete telechargee et appliquee avec succes
    (necessitant un redemarrage du script pour executer le code a jour), ou False
    si l'outil est deja a jour, hors-ligne, ou dans l'impossibilite d'appliquer
    la mise a jour sans intervention manuelle.
    """
    racine = dossier_racine or RACINE
    # Git doit etre disponible dans l'environnement
    if not shutil.which("git"):
        return False

    # Le dossier doit etre un depot Git
    dossier_git = os.path.join(racine, ".git")
    if not os.path.isdir(dossier_git):
        res_test = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=racine, capture_output=True, text=True
        )
        if res_test.returncode != 0:
            return False

    print("[*] Recherche de mises a jour sur GitHub...")
    env_git = os.environ.copy()
    env_git["GIT_TERMINAL_PROMPT"] = "0"

    try:
        fetch = subprocess.run(
            ["git", "fetch", "--quiet", "origin"],
            cwd=racine, capture_output=True, text=True, timeout=10, env=env_git
        )
        if fetch.returncode != 0:
            print("[!] Impossible de contacter GitHub (hors ligne ou depot distant inaccessible).")
            print("[*] Demarrage normal de l'outil...")
            return False
    except subprocess.TimeoutExpired:
        print("[!] Delai de recherche de mise a jour depasse (reseau lent ou indisponible).")
        print("[*] Demarrage normal de l'outil...")
        return False
    except Exception as exc:                           # noqa: BLE001
        print("[!] Echec de la recherche de mise a jour : %s" % exc)
        print("[*] Demarrage normal de l'outil...")
        return False

    # Determination de la branche amont (upstream) ou repli sur origin/main
    upstream = "@{u}"
    res_up = subprocess.run(
        ["git", "rev-parse", "--verify", "@{u}"],
        cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
    )
    if res_up.returncode != 0:
        res_main = subprocess.run(
            ["git", "rev-parse", "--verify", "origin/main"],
            cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
        )
        if res_main.returncode == 0:
            upstream = "origin/main"
        else:
            # Aucune branche amont connue
            return False

    # Nombre de commits distants en attente de recuperation
    res_count = subprocess.run(
        ["git", "rev-list", "HEAD..%s" % upstream, "--count"],
        cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
    )
    if res_count.returncode != 0:
        return False

    try:
        nb_commits = int(res_count.stdout.strip())
    except ValueError:
        return False

    if nb_commits <= 0:
        print("[*] Le logiciel est a jour.")
        return False

    print()
    print("=" * 60)
    print("MISE A JOUR DISPONIBLE (%d nouveau(x) commit(s) sur GitHub)" % nb_commits)
    print("=" * 60)
    print("  Application de la mise a jour en cours...")

    # Detection de modifications locales non commitees dans les fichiers suivis
    st_res = subprocess.run(
        ["git", "status", "--porcelain", "-uno"],
        cwd=racine, capture_output=True, text=True, timeout=5, env=env_git
    )
    dirty = bool(st_res.stdout.strip())
    stashed = False
    if dirty:
        print("  Modifications locales detectees : mise en reserve temporaire...")
        stash_res = subprocess.run(
            ["git", "stash", "push", "-m", "Auto-stash WEB_OFFICE avant mise a jour"],
            cwd=racine, capture_output=True, text=True, timeout=10, env=env_git
        )
        stashed = (stash_res.returncode == 0)

    # --ff-only : on n'applique que la suite exacte de ce qu'on a. Un historique
    # distant reecrit (force-push) ou divergent est refuse, jamais fusionne en
    # silence dans le code qu'on va executer.
    # Un pull trop long (reseau lent, carte SD) levait TimeoutExpired : le
    # serveur ne demarrait pas et la reserve n'etait jamais reappliquee.
    try:
        pull = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=racine, capture_output=True, text=True, timeout=120, env=env_git
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        pull = subprocess.CompletedProcess(["git", "pull"], 1, "",
                                           "git pull interrompu (%s)" % exc)

    if stashed:
        print("  Restauration des modifications locales...")
        pop = subprocess.run(
            ["git", "stash", "pop"],
            cwd=racine, capture_output=True, text=True, timeout=10, env=env_git
        )
        # Un « pop » en conflit laisse les modifications dans la reserve (et
        # des marqueurs de conflit dans les fichiers) : le taire, c'etait
        # laisser croire qu'elles etaient perdues.
        if pop.returncode != 0:
            err = pop.stderr.strip() or pop.stdout.strip()
            print("[!] Vos modifications locales n'ont pas pu etre reappliquees"
                  " automatiquement :")
            print("    %s" % err)
            print("    Elles sont conservees dans la reserve Git : voir"
                  " « git stash list », puis « git stash pop » une fois le"
                  " conflit resolu.")

    if pull.returncode != 0:
        err = pull.stderr.strip() or pull.stdout.strip()
        print("[!] Echec de l'application de la mise a jour : %s" % err)
        print("[*] Poursuite avec la version actuelle...")
        return False

    print()
    print("=" * 60)
    print("MISE A JOUR APPLIQUEE AVEC SUCCES")
    print("=" * 60)
    print("  Redemarrage automatique de l'outil...")
    print("=" * 60)
    print()
    return True


def redemarrer_application(argv=None):
    """Relance le processus actuel avec les memes arguments apres une mise a jour."""
    env = os.environ.copy()
    env["WEB_OFFICE_DEJA_MAJ"] = "1"
    cmd = [sys.executable, os.path.abspath(__file__)] + (sys.argv[1:] if argv is None else list(argv))
    try:
        if os.name == "nt":
            # Sous Windows, subprocess.call permet de conserver la fenetre console
            # ouverte (en particulier lors d'un lancement par double-clic).
            code = subprocess.call(cmd, env=env)
            os._exit(code)
        else:
            # Sous Unix / macOS, execv remplace l'image du processus courant
            os.execv(sys.executable, cmd)
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as exc:                           # noqa: BLE001
        print("[!] Erreur lors du redemarrage automatique : %s" % exc)
        print("[*] Poursuite avec le processus actuel...")



def main():
    ap = argparse.ArgumentParser(description="Circuit Story")
    ap.add_argument("--port", type=int, default=8793, help="port d'écoute (8793 par défaut)")
    ap.add_argument("--local", action="store_true", help="n'écouter que sur 127.0.0.1")
    ap.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    ap.add_argument("--sans-pause", action="store_true", help="ne pas attendre de touche à l'arrêt")
    ap.add_argument("--sans-maj", dest="verifier_maj", action="store_false", default=True,
                    help="ne pas vérifier les mises à jour GitHub au démarrage")
    args = ap.parse_args()
    # shortcut: pause seulement sous Windows (double-clic) ; WEB_3D détecte finement la console, à reprendre si gênant
    interactif = not args.sans_pause and os.name == "nt" and sys.stdin.isatty()

    def attendre():
        if interactif:
            try:
                input("\nAppuyez sur Entrée pour fermer…")
            except EOFError:
                pass

    if args.verifier_maj and os.environ.get("WEB_OFFICE_DEJA_MAJ") != "1":
        if verifier_et_appliquer_maj(str(RACINE)):
            redemarrer_application()

    hote = "127.0.0.1" if args.local else "0.0.0.0"
    global GARDE
    GARDE = appairage.Garde("WEB_OFFICE", actif=not args.local)
    try:
        serveur, port = ouvrir_serveur(hote, args.port, 10)
    except OSError as e:
        print(f"Aucun port libre entre {args.port} et {args.port + 9} : {e}", file=sys.stderr, flush=True)
        attendre()
        return 1

    GARDE.brancher(serveur)             # en mode réseau : HTTPS sur le même port
    url = f"http://127.0.0.1:{port}/" + ("?demo=1" if DEMO else "")
    print("Circuit Story" + (" — mode démo : la partie se joue toute seule" if DEMO else ""), flush=True)
    print(f"  adresse : {url}", flush=True)
    if port != args.port:
        print(f"  (le port {args.port} était occupé)", flush=True)
    if not args.local:
        print(f"  réseau  : {GARDE.adresse(adresse_locale(), port)}   (téléphone, autre poste)", flush=True)
        if appairage.ip_tailscale():
            print(f"  tailscale : {GARDE.adresse(appairage.ip_tailscale(), port)}", flush=True)
        print("            l'autre appareil demande une fois le code d'appairage ci-dessous", flush=True)
        GARDE.annoncer()
    print("  Ctrl+C pour arrêter.\n", flush=True)

    if not args.sans_navigateur:
        webbrowser.open(url)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))   # arrêt par web_launcher : passe par le finally
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.", flush=True)
    finally:
        serveur.server_close()
        with VERROU:
            sauver(JEU)   # les derniers jours joués depuis la dernière sauvegarde
    attendre()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
