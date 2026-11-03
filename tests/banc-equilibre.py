"""Banc d'équilibre : parties automatiques avec une stratégie de joueur raisonnable, bilan court à la fin de chaque année.

Usage : python3 tests/banc-equilibre.py [--moteur DOSSIER] [--graines 20] [--ans 3] [--prix 1.0]
--moteur : dossier qui contient le paquet « moteur » à tester (par défaut : ce dépôt), pour comparer avec une ancienne version.
"""
import argparse
import random
import statistics
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--moteur", default=str(Path(__file__).resolve().parent.parent))
ap.add_argument("--graines", type=int, default=20)
ap.add_argument("--ans", type=int, default=3)
ap.add_argument("--prix", default="1.0", help="prix des devis envoyés (nouveau moteur)")
ap.add_argument("--prod", type=float, help="production gardée pendant la prospection (nouveau moteur)")
ap.add_argument("--offres", type=int, help="demandes spontanées (NB_OFFRES, nouveau moteur)")
ap.add_argument("--marge", type=int, default=1, help="on prospecte tant qu'il y a moins de capacité + marge projets en vue")
args = ap.parse_args()
sys.path.insert(0, args.moteur)
from moteur import ErreurJeu, Jeu  # noqa: E402

COMMERCE = hasattr(Jeu, "prospecteurs")
if COMMERCE and args.prod is not None:
    import moteur.commerce
    moteur.commerce.PROD_PROSPECTION = args.prod
if COMMERCE and args.offres is not None:
    import moteur.jeu
    moteur.jeu.NB_OFFRES = args.offres
SECTEURS_FACILES = ["maison", "industrie", "agri", "energie", "loisirs"]  # sans qualification ni techno exigée au départ
devis = {"gagnes": 0, "perdus": 0}
if COMMERCE:
    decider = Jeu._decider_devis

    def compter(self, d):
        avant = sum(bool(o.get("gagne")) for o in self.etat["offres"])
        decider(self, d)
        devis["gagnes" if sum(bool(o.get("gagne")) for o in self.etat["offres"]) > avant else "perdus"] += 1
    Jeu._decider_devis = compter


def essayer(j, genre, **p):
    try:
        j.action(genre, **p)
        return True
    except ErreurJeu:
        return False


def prospecter(j, r):
    e = j.etat
    en_vue = len(e["offres"]) + len(e["pistes"]) + len(e["devis"]) + len(e["prospections"])
    for x in j.prospecteurs():
        if j.en_prospection(x) or en_vue >= j.capacite_projets() + args.marge:  # assez de travail en vue
            continue
        en_vue += 1
        if j.salon_du_mois() and e["argent"] > 15000 and j.capacite_projets() >= 2:  # au garage, un seul projet : inutile
            canal = "salon"
        elif e["argent"] > 5000 and not e["offres"]:
            canal = "demarchage"
        else:
            canal = r.choice(["plateformes", "reseaux"])
        essayer(j, "prospecter", canal=canal, qui=x["id"], secteur=r.choice(SECTEURS_FACILES))
    for o in list(e["pistes"]):
        essayer(j, "devis", id=o["id"], prix=args.prix, delai="1.0")


def partie(graine):
    j, r = Jeu(graine=graine), random.Random(graine)
    annees, vides, tel = [], 0, 0
    for jour in range(1, args.ans * 360 + 1):
        e = j.etat
        if e["faillite"]:
            annees += [None] * (args.ans - len(annees))
            break
        if e["evenement"]:
            n = len(e["evenement"]["options"])
            any(essayer(j, "evenement", choix=c) for c in range(n))
        for cle in ("bilan", "dernier_livre"):
            e.pop(cle, None)
        if COMMERCE:
            prospecter(j, r)
        for o in sorted(e["offres"], key=lambda o: (not o.get("gagne"), not o.get("reservee"))):
            if j.places_occupees() >= j.capacite_projets():
                break
            essayer(j, "signer", id=o["id"], tech={"qualif": "carte"})
        for p in list(e["projets"]):
            if p["etape"] == "debug" and p["defauts"] < 2:
                essayer(j, "tests_cem", id=p["id"])
        if e["argent"] > 30000:
            essayer(j, "local", id="bureau")
        if e["argent"] > 25000 and e["candidats"]:
            essayer(j, "embaucher", id=e["candidats"][0]["id"])
        vides += not e["projets"]
        tel += COMMERCE and any(pr["qui"] == e["employes"][0]["id"] for pr in e["prospections"])
        j.action("avancer")
        if jour % 360 == 0:
            rang = 1 + sum(c["renommee"] > e["renommee"] for c in e["concurrents"])
            annees.append({"argent": e["argent"], "rep": e["renommee"], "livres": e["stats"]["livres"], "equipe": len(e["employes"]),
                           "vide": vides / jour, "rang": rang, "tel": tel / jour, "rivaux": max(c["renommee"] for c in e["concurrents"])})
    return annees


res = [partie(g) for g in range(args.graines)]
med = lambda v: statistics.median(v) if v else float("nan")  # noqa: E731
print(f"{'nouveau' if COMMERCE else 'ancien'} moteur · {args.graines} parties" + (f" · devis à {args.prix} · prod {args.prod} · marge {args.marge} · offres {args.offres}" if COMMERCE else ""))
print("an | faillites | trésorerie méd. | renommée | livrés | équipe | fondateur prospecte | rang | rival max")
for a in range(args.ans):
    ok = [x[a] for x in res if x[a]]
    print(f"{a + 1:>2} | {args.graines - len(ok):>9} | {med([x['argent'] for x in ok]):>15,.0f} | {med([x['rep'] for x in ok]):>8} | {med([x['livres'] for x in ok]):>6} |"
          f" {med([x['equipe'] for x in ok]):>6} | {med([x['tel'] for x in ok]):>18.0%} | {med([x['rang'] for x in ok]):>7} | {med([x['rivaux'] for x in ok]):>9}".replace(",", " "))
if COMMERCE and sum(devis.values()):
    print(f"devis : {devis['gagnes']} gagnés / {sum(devis.values())} ({devis['gagnes'] / sum(devis.values()):.0%})")
