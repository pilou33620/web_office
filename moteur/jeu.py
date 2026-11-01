"""Moteur de Circuit Story : simulation jour par jour d'un bureau d'études électronique."""
import random

from .donnees import (CHEVEUX, CLIENTS, CONTRATS, COULEURS, DECO, DOMAINES, LOCAUX, LOYER_BASE, MATERIEL,
                      MATERIEL_DEPART, MOIS, NOM_DOMAINE, PEAUX, PHASES, POSTES, POSTES_BUREAU, POSTES_GARAGE,
                      POSTES_OPENSPACE, PRENOMS, PRODUITS, TRAITS)

JOURS_MOIS = 30
SEUIL_FAILLITE = -5000
NB_OFFRES = 4
NB_CANDIDATS = 4
DUREE_CEM = 3
DUREE_FORMATION = 10
DUREE_CONGES = 5


class ErreurJeu(Exception):
    """Action refusée ; le message est affiché au joueur."""


def borne(x, lo, hi):
    return max(lo, min(hi, x))


class Jeu:
    def __init__(self, etat=None, graine=None):
        self.rng = random.Random(graine)
        if etat is None:
            self.etat = {}
            self._nouvel_etat()
        else:
            self.etat = etat

    # ------------------------------------------------------------------ création
    def _nouvel_etat(self):
        self.etat.update({
            "version": 1, "jour": 1, "mois": 8, "annee": 2026, "jours_total": 0,
            "argent": 15000, "renommee": 0, "prochain_id": 1,
            "locaux": [], "materiel": list(MATERIEL_DEPART), "deco": [], "pannes": {},
            "employes": [], "candidats": [], "offres": [], "projet": None, "produits": [],
            "evenement": None, "journal": [], "historique": [], "faillite": False,
            "stats": {"livres": 0, "ca": 0, "produits_lances": 0},
        })
        self.etat["employes"].append({
            "id": self._id(), "nom": "Vous", "poste": "Fondateur · ingé élec", "e": 5, "m": 2, "f": 4,
            "trait": "endurant", "salaire": 0, "couleur": "#ffc94d", "cheveux": "#5a3a22", "peau": "#f6cfa6",
            "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 3, "absent": 0, "formation": None,
            "bureau": 0, "fondateur": True, "tache": None, "gain": 0,
        })
        for _ in range(NB_CANDIDATS):
            self.etat["candidats"].append(self._candidat())
        for _ in range(NB_OFFRES):
            self.etat["offres"].append(self._offre())
        self._log("Bienvenue ! Vous êtes seul dans votre garage : signez un premier contrat dans Projets.", "info")

    def _id(self):
        self.etat["prochain_id"] += 1
        return self.etat["prochain_id"] - 1

    def _candidat(self):
        rep = self.etat["renommee"]
        r = self.rng
        if r.random() < 0.15:
            poste, poids, total = "Stagiaire", {"e": 0.4, "m": 0.3, "f": 0.3}, r.uniform(2, 4)
        else:
            p = r.choice(POSTES)
            poste, poids, total = p["nom"], p["poids"], min(24, r.uniform(4, 7) + rep * 0.7)
        stats = {d: max(0, round(total * poids[d] + r.uniform(-0.6, 0.6))) for d in DOMAINES}
        if sum(stats.values()) < 2:
            stats[max(poids, key=poids.get)] += 2
        somme = sum(stats.values())
        salaire = 600 if poste == "Stagiaire" else int(round(800 + 230 * somme, -1))
        return {
            "id": self._id(), "nom": r.choice(PRENOMS), "poste": poste, **stats,
            "trait": r.choice(list(TRAITS)), "salaire": salaire, "couleur": r.choice(COULEURS),
            "cheveux": r.choice(CHEVEUX), "peau": r.choice(PEAUX),
        }

    def _offre(self, bonus_rep=0):
        rep = self.etat["renommee"] + bonus_rep
        r = self.rng
        eligibles = [c for c in CONTRATS if c[3] <= rep]
        nom, mix, base, rmin = r.choices(eligibles, weights=range(1, len(eligibles) + 1))[0]
        taille = round(base * (1 + 0.04 * min(10, max(0, rep - rmin))) * r.uniform(0.85, 1.2))
        total = {d: round(taille * part) for d, part in zip(DOMAINES, mix)}
        taille = sum(total.values())
        return {
            "id": self._id(), "nom": nom, "client": r.choice(CLIENTS), "taille": taille, "total": total,
            "paie": int(round(taille * r.uniform(74, 90) * (1 + 0.03 * min(rep, 20)), -2)),
            "delai": 14 + round(taille * (0.5 - min(0.3, taille / 1500))),
            "gain": 1 + taille // 200, "expire": r.randint(18, 40),
        }

    # ------------------------------------------------------------------ calculs
    def _log(self, texte, genre="info"):
        e = self.etat
        e["journal"].insert(0, {"date": f"{e['jour']} {MOIS[e['mois']]}", "texte": texte, "genre": genre})
        del e["journal"][40:]

    def employe(self, eid):
        for emp in self.etat["employes"]:
            if emp["id"] == eid:
                return emp
        raise ErreurJeu("Employé introuvable.")

    def postes_ouverts(self):
        p = list(POSTES_GARAGE)
        if "bureau" in self.etat["locaux"]:
            p += POSTES_BUREAU
        if "openspace" in self.etat["locaux"]:
            p += POSTES_OPENSPACE
        return p

    def materiel_actif(self):
        return [m for m in self.etat["materiel"] if m not in self.etat["pannes"]]

    def bonus(self):
        b = {"e": 0, "m": 0, "f": 0, "debug": 0, "cem": 0.0}
        for mid in self.materiel_actif():
            m = MATERIEL[mid]
            if m["dom"] in b:
                b[m["dom"]] += m["bonus"]
            b["debug"] += m.get("debug", 0)
            b["cem"] += m.get("cem", 0)
        return b

    def moral_global(self):
        e = self.etat
        m = 60 + sum(DECO[d]["moral"] for d in e["deco"])
        m += sum(TRAITS[x["trait"]].get("moral", 0) for x in e["employes"])
        m -= max(0, len(e["employes"]) - 4) * 1.5
        return borne(m, 20, 95)

    def moral(self, emp):
        return borne(self.moral_global() - emp["fatigue"] / 2 + emp["humeur"], 5, 100)

    def conditions(self):
        """Conditions de travail : facteurs (libellé, %) et multiplicateur appliqué à toute la production."""
        e = self.etat
        n = len([x for x in e["employes"] if not x["absent"]])
        f = [(DECO[d]["nom"], DECO[d]["prod"]) for d in e["deco"] if DECO[d].get("prod")]
        if "cafe" in e["deco"]:
            f.append(("Pauses café", 3))
        if e["mois"] in (5, 6, 7):
            f.append(("Canicule, mais climatisé", 0) if "clim" in e["deco"] else ("Canicule sans climatisation", -15))
        if n > 4 and "isolation" not in e["deco"]:
            f.append(("Bruit, pas d'isolation phonique", -2 * (n - 4)))
        if n >= 2 and "bureau" not in e["locaux"]:
            f.append(("Garage exigu", -5))
        total = borne(1 + sum(x[1] for x in f) / 100, 0.6, 1.4)
        return [{"nom": a, "pct": b} for a, b in f], total

    def efficacite(self, emp):
        trait = TRAITS[emp["trait"]]
        return borne(self.moral(emp) / 70, 0.4, 1.4) * self.conditions()[1] * trait.get("vitesse", 1.0)

    def loyer(self):
        return LOYER_BASE + sum(LOCAUX[l]["loyer"] for l in self.etat["locaux"])

    def salaires(self):
        return sum(x["salaire"] for x in self.etat["employes"])

    def _production(self, emp, dom, bon):
        if emp[dom] <= 0:
            return 0.0
        return emp[dom] * self.efficacite(emp) * (1 + 0.1 * bon[dom])

    def _detection(self, emp, bon):
        trait = TRAITS[emp["trait"]]
        fm = borne(self.moral(emp) / 70, 0.4, 1.4) * self.conditions()[1]
        return (emp["e"] + emp["f"]) / 2 * fm * 0.2 * (1 + 0.15 * bon["debug"]) * trait.get("detection", 1.0)

    def frais_cem(self, p):
        base = 600 + p["taille"] * 5
        if "cem" in self.etat["locaux"] and "chambre" in self.materiel_actif():
            return 0
        if "cem" in self.etat["locaux"]:
            return base // 2
        return base

    def proba_cem(self, p):
        bon = self.bonus()
        norm = p["defauts"] / max(1, p["taille"] / 40)
        pr = 0.6 + bon["cem"] - min(0.25, p["taille"] / 2000) - 0.04 * norm + 0.2 * p["echecs_cem"]
        return round(borne(pr, 0.1, 0.95), 2)

    def note(self, p):
        bon = self.bonus()
        n = 7.5 + min(1.0, (bon["e"] + bon["m"] + bon["f"]) / 25)
        n += min(1.5, p["qualite"] / max(1, p["taille"]) * 3)
        n -= p["defauts"] / max(1, p["taille"] / 40) * 0.9
        n -= 0.6 * p["echecs_cem"]
        if p["type"] == "contrat" and p["jours"] > p["delai"]:
            n -= min(3, 0.12 * (p["jours"] - p["delai"]))
        return round(borne(n, 1, 10), 1)

    # ------------------------------------------------------------------ projets
    def _creer_projet(self, base, genre):
        phases = []
        for nom, parts in PHASES:
            besoin = {d: round(base["total"][d] * parts[d]) for d in DOMAINES if round(base["total"][d] * parts[d]) > 0}
            if besoin:
                phases.append({"nom": nom, "besoin": besoin, "fait": {d: 0.0 for d in besoin}})
        return {
            "type": genre, "nom": base["nom"], "client": base.get("client", ""), "taille": base["taille"],
            "total": base["total"], "paie": base.get("paie", 0), "delai": base.get("delai", 0),
            "gain": base.get("gain", 0), "potentiel": base.get("potentiel", 0), "id_produit": base.get("id_produit"),
            "phases": phases, "phase": 0, "etape": "travail", "defauts": 0.0, "qualite": 0.0,
            "jours": 0, "cem_jours": 0, "echecs_cem": 0,
        }

    def _lancer_cem(self, p):
        frais = self.frais_cem(p)
        self.etat["argent"] -= frais
        p["etape"], p["cem_jours"] = "cem", DUREE_CEM
        cout = f" (labo externe : −{frais:,} €)".replace(",", " ") if frais else ""
        self._log(f"Tests CEM lancés pour « {p['nom']} »{cout}.", "info")

    def _travailler(self, p, bon):
        actifs = [x for x in self.etat["employes"] if x["absent"] == 0]
        if p["etape"] == "travail":
            ph = p["phases"][p["phase"]]
            for emp in actifs:
                reste = {d: ph["besoin"][d] - ph["fait"][d] for d in ph["besoin"]}
                doms = [d for d, r in reste.items() if r > 1e-6 and emp[d] > 0]
                if doms:
                    d = max(doms, key=lambda k: emp[k])
                    pts = min(self._production(emp, d, bon), reste[d])
                    ph["fait"][d] += pts
                    trait = TRAITS[emp["trait"]]
                    p["defauts"] += pts * 0.07 * trait.get("defauts", 1.0)
                    p["qualite"] += pts * trait.get("qualite", 0.0)
                    emp["tache"], emp["gain"] = d, round(pts, 1)
                    self._experience(emp, d, pts)
                else:
                    retire = min(p["defauts"], self._detection(emp, bon))
                    p["defauts"] -= retire
                    emp["tache"], emp["gain"] = "debug", round(retire, 1)
            p["defauts"] *= 1 - min(0.3, 0.015 * (1 + 0.5 * bon["debug"]))
            if all(ph["fait"][d] >= ph["besoin"][d] - 1e-6 for d in ph["besoin"]):
                if p["phase"] + 1 < len(p["phases"]):
                    p["phase"] += 1
                    self.etat["reunion"] = True
                    self._log(f"« {p['nom']} » : phase « {p['phases'][p['phase']]['nom']} ».", "info")
                elif p["defauts"] >= 0.5:
                    p["etape"] = "debug"
                    self._log(f"« {p['nom']} » : place au debug. Passez aux tests CEM quand vous voulez.", "info")
                else:
                    self._lancer_cem(p)
        elif p["etape"] == "debug":
            for emp in actifs:
                retire = min(p["defauts"], self._detection(emp, bon))
                p["defauts"] -= retire
                emp["tache"], emp["gain"] = "debug", round(retire, 1)
                self._experience(emp, "f" if emp["f"] >= emp["e"] else "e", retire)
            if p["defauts"] < 0.3:
                p["defauts"] = 0.0
                self._log(f"Plus aucun défaut connu sur « {p['nom']} » : direction les tests CEM.", "bon")
                self._lancer_cem(p)
        elif p["etape"] == "cem":
            for emp in actifs:
                emp["tache"], emp["gain"] = "cem", 0
            p["cem_jours"] -= 1
            if p["cem_jours"] <= 0:
                if self.rng.random() < self.proba_cem(p):
                    self._terminer(p)
                else:
                    p["echecs_cem"] += 1
                    besoin = max(6, round(p["total"]["e"] * 0.12))
                    p["phases"].append({"nom": "Correction CEM", "besoin": {"e": besoin}, "fait": {"e": 0.0}})
                    p["phase"] = len(p["phases"]) - 1
                    p["etape"] = "travail"
                    self._log(f"Échec aux tests CEM pour « {p['nom']} » : il faut corriger le routage.", "mauvais")

    def _terminer(self, p):
        e = self.etat
        note = self.note(p)
        if p["type"] == "contrat":
            paie = int(round(p["paie"] * (0.6 + 0.05 * note), -1)) - p.get("acompte", 0)
            gain = -1 if note < 4 else max(0, round(p["gain"] * note / 8))
            e["argent"] += paie
            e["renommee"] = max(0, e["renommee"] + gain)
            e["stats"]["ca"] += paie
            e["stats"]["livres"] += 1
            self._log(f"« {p['nom']} » livré à {p['client']} : note {note}/10, +{paie:,} €, renommée {gain:+d}.".replace(",", " "), "bon")
            e["historique"].insert(0, {"nom": p["nom"], "client": p["client"], "note": note, "montant": paie,
                                       "jours": p["jours"], "type": "contrat", "avis": self._avis(note)})
        else:
            ventes = int(2 * p["potentiel"] * (note / 10) ** 2 * (1 + e["renommee"] / 25))
            e["produits"].append({"nom": p["nom"], "id_produit": p["id_produit"], "note": note, "ventes": ventes, "mois": 0, "total": 0})
            e["stats"]["produits_lances"] += 1
            if note >= 8:
                e["renommee"] += 1
            self._log(f"« {p['nom']} » est en vente ! Note de la presse : {note}/10.", "bon")
            e["historique"].insert(0, {"nom": p["nom"], "client": "Produit maison", "note": note, "montant": 0,
                                       "jours": p["jours"], "type": "produit", "avis": self._avis(note)})
        del e["historique"][30:]
        e["projet"] = None
        e["dernier_livre"] = e["historique"][0]

    def _avis(self, note):
        if note >= 9:
            return "Travail exceptionnel, on vous confie la suite !"
        if note >= 7.5:
            return "Très bon travail, client satisfait."
        if note >= 6:
            return "Correct, quelques retouches à prévoir."
        if note >= 4:
            return "Décevant : trop de défauts ou de retard."
        return "Inacceptable. Ce client ne reviendra pas."

    def _experience(self, emp, dom, pts):
        emp["xp"][dom] += pts
        seuil = 60 + 15 * emp[dom]
        if emp["xp"][dom] >= seuil and emp[dom] < 15:
            emp["xp"][dom] -= seuil
            emp[dom] += 1
            if not emp.get("fondateur"):
                emp["salaire"] += 120
            self._log(f"{emp['nom']} progresse en {NOM_DOMAINE[dom]} ({emp[dom]}).", "bon")

    # ------------------------------------------------------------------ temps
    def avancer(self, jours=1):
        for _ in range(max(1, min(30, int(jours)))):
            if self.etat["evenement"] or self.etat["faillite"]:
                break
            self._jour()

    def _jour(self):
        e = self.etat
        e["jour"] += 1
        e["jours_total"] += 1
        if e["jour"] > JOURS_MOIS:
            e["jour"] = 1
            e["mois"] += 1
            if e["mois"] > 11:
                e["mois"], e["annee"] = 0, e["annee"] + 1
            self._debut_mois()
        bon = self.bonus()
        for emp in e["employes"]:
            emp["tache"], emp["gain"] = None, 0
        p = e["projet"]
        if p:
            p["jours"] += 1
            self._travailler(p, bon)
            if p is e["projet"] and p["type"] == "contrat" and p["jours"] == p["delai"] + 1:
                self._log(f"Retard sur « {p['nom']} » : la note client va baisser.", "mauvais")
        for emp in e["employes"]:
            self._placer(emp, e["projet"])
        e.pop("reunion", None)
        for emp in e["employes"]:
            trait = TRAITS[emp["trait"]]
            if emp["absent"] > 0:
                emp["absent"] -= 1
                emp["fatigue"] = max(0, emp["fatigue"] - 3)
                if emp["absent"] == 0 and emp["formation"]:
                    d = emp["formation"]
                    emp[d] = min(15, emp[d] + 2)
                    emp["formation"] = None
                    self._log(f"{emp['nom']} revient de formation : {NOM_DOMAINE[d]} {emp[d]}.", "bon")
            elif emp["tache"]:
                emp["fatigue"] = min(50, emp["fatigue"] + 1.2 * trait.get("fatigue", 1.0))
            else:
                emp["fatigue"] = max(0, emp["fatigue"] - 3)
        for pid in list(e["pannes"]):
            e["pannes"][pid] -= 1
            if e["pannes"][pid] <= 0:
                del e["pannes"][pid]
                self._log(f"{MATERIEL[pid]['nom']} réparé.", "info")
        for o in e["offres"]:
            o["expire"] -= 1
        e["offres"] = [o for o in e["offres"] if o["expire"] > 0]
        if len(e["offres"]) < NB_OFFRES and self.rng.random() < 0.15:
            e["offres"].append(self._offre())
        if e["jours_total"] > 10 and self.rng.random() < 1 / 18:
            self._evenement()
        if e["argent"] < SEUIL_FAILLITE:
            e["faillite"] = True
            self._log("Faillite : la banque ferme le compte.", "mauvais")

    def _placer(self, emp, p):
        """Choisit la pièce où l'employé passe la journée (pour l'animation du plan)."""
        e, r, t = self.etat, self.rng, emp["tache"]
        if emp["absent"]:
            emp["lieu"] = None
            return
        if e.get("reunion"):
            lieu = "reunion"
        elif t == "e":
            premiere = p and p["etape"] == "travail" and p["phase"] == 0
            lieu = "labo" if not premiere and r.random() < 0.6 else "bureau"
        elif t == "m":
            lieu = "atelier" if "atelier" in e["locaux"] and r.random() < 0.65 else "bureau"
        elif t == "f":
            lieu = "labo" if r.random() < 0.25 else "bureau"
        elif t == "debug":
            lieu = "labo" if r.random() < 0.5 else "bureau"
        elif t == "cem":
            lieu = "cem" if "cem" in e["locaux"] and r.random() < 0.35 else ("pause" if r.random() < 0.3 else "bureau")
        else:
            lieu = "pause" if r.random() < 0.6 else "bureau"
        # inertie : même tâche, on reste souvent au même endroit (déplacements moins frénétiques)
        if emp.get("lieu") not in (None, "reunion") and lieu != "reunion" and emp.get("tache_prec") == t and r.random() < 0.6:
            lieu = emp["lieu"]
        emp["lieu"], emp["tache_prec"] = lieu, t

    def _debut_mois(self):
        e = self.etat
        loyer, sal = self.loyer(), self.salaires()
        ventes = 0
        for prod in e["produits"]:
            ventes += prod["ventes"]
            prod["total"] += prod["ventes"]
            prod["mois"] += 1
            prod["ventes"] = int(prod["ventes"] * 0.9)
        e["produits"] = [x for x in e["produits"] if x["ventes"] >= 100]
        e["argent"] += ventes - loyer - sal
        e["stats"]["ca"] += ventes
        texte = f"Fin de mois : loyer −{loyer:,} €, salaires −{sal:,} €".replace(",", " ")
        if ventes:
            texte += f", ventes +{ventes:,} €".replace(",", " ")
        self._log(texte + ".", "info")
        while len(e["offres"]) < NB_OFFRES:
            e["offres"].append(self._offre())
        for _ in range(2):
            if e["candidats"]:
                e["candidats"].pop(0)
        while len(e["candidats"]) < NB_CANDIDATS:
            e["candidats"].append(self._candidat())
        for emp in e["employes"]:
            emp["humeur"] = borne(emp["humeur"] + self.rng.randint(-2, 2), -8, 8)
        if e["argent"] < 0:
            self._log("Trésorerie négative ! Sous −5 000 €, c'est la faillite.", "mauvais")

    # ------------------------------------------------------------------ évènements
    def _evenement(self):
        e, r = self.etat, self.rng
        p = e["projet"]
        possibles = []
        if p and p["etape"] == "travail":
            cout = 400 + p["taille"] * 6
            possibles.append({"type": "penurie", "titre": "Pénurie de composants",
                              "texte": f"Le microcontrôleur de « {p['nom']} » est en rupture chez tous les distributeurs.",
                              "options": [f"Acheter chez un broker (−{cout:,} €)".replace(",", " "),
                                          "Re-concevoir avec un équivalent (plus long, plus de défauts)"],
                              "cout": cout})
        if p and p["type"] == "contrat" and p["etape"] == "travail" and p["delai"] - p["jours"] > 15:
            possibles.append({"type": "presse", "titre": "Client pressé",
                              "texte": f"{p['client']} veut avancer la livraison de 7 jours, contre 20 % de plus.",
                              "options": ["Accepter le défi", "Refuser poliment"]})
        if e["renommee"] >= 1 and e["argent"] > 5000:
            possibles.append({"type": "salon", "titre": "Salon professionnel",
                              "texte": "Un stand se libère au salon de l'électronique embarquée.",
                              "options": ["Exposer (−3 000 €)", "Ne pas y aller"]})
        cassables = [m for m in self.materiel_actif() if MATERIEL[m]["prix"] >= 1000]
        if cassables:
            mid = r.choice(cassables)
            rep = MATERIEL[mid]["prix"] * 15 // 100
            possibles.append({"type": "panne", "titre": "Panne de matériel",
                              "texte": f"{MATERIEL[mid]['nom']} vient de tomber en panne.",
                              "options": [f"Réparer tout de suite (−{rep:,} €)".replace(",", " "),
                                          "Attendre la pièce (15 jours sans l'appareil)"],
                              "materiel": mid, "cout": rep})
        if e["renommee"] >= 2:
            possibles.append({"type": "subvention", "titre": "Subvention innovation",
                              "texte": "La région finance les PME innovantes. Le dossier est lourd.",
                              "options": ["Monter le dossier (+4 000 €, équipe fatiguée)", "Pas le temps"]})
        mecontents = [x for x in e["employes"] if not x.get("fondateur") and self.moral(x) < 35]
        if mecontents:
            emp = r.choice(mecontents)
            possibles.append({"type": "demission", "titre": "Menace de démission",
                              "texte": f"{emp['nom']} n'en peut plus et pense à partir.",
                              "options": ["Augmenter son salaire (+300 €/mois)", "Le laisser partir"],
                              "employe": emp["id"]})
        if e["stats"]["livres"] >= 2 and r.random() < 0.3:
            possibles.append({"type": "recommandation", "titre": "Bouche-à-oreille",
                              "texte": "Un ancien client vous recommande à son réseau.", "options": ["Merci !"]})
        vus = e.setdefault("derniers_ev", {})
        possibles = [x for x in possibles if e["jours_total"] - vus.get(x["type"], -999) >= 60]
        if possibles:
            e["evenement"] = r.choice(possibles)
            vus[e["evenement"]["type"]] = e["jours_total"]

    def _resoudre(self, choix):
        e = self.etat
        ev = e["evenement"]
        if not ev:
            raise ErreurJeu("Aucun évènement en attente.")
        if not 0 <= choix < len(ev["options"]):
            raise ErreurJeu("Choix invalide.")
        t, p = ev["type"], e["projet"]
        if t == "penurie" and p:
            if choix == 0:
                self._payer(ev["cout"])
            else:
                ph = p["phases"][p["phase"]]
                ph["besoin"]["e"] = ph["besoin"].get("e", 0) + round(p["taille"] * 0.08)
                ph["fait"].setdefault("e", 0.0)
                p["defauts"] += p["taille"] * 0.03
        elif t == "presse" and p and choix == 0:
            p["delai"] -= 7
            p["paie"] = int(p["paie"] * 1.2)
        elif t == "salon" and choix == 0:
            self._payer(3000)
            e["renommee"] += 1
            e["offres"] = e["offres"][:NB_OFFRES] + [self._offre(bonus_rep=2) for _ in range(2)]
        elif t == "panne":
            if choix == 0:
                self._payer(ev["cout"])
            else:
                e["pannes"][ev["materiel"]] = 15
        elif t == "subvention" and choix == 0:
            e["argent"] += 4000
            for x in e["employes"]:
                x["fatigue"] = min(50, x["fatigue"] + 8)
        elif t == "demission":
            emp = next((x for x in e["employes"] if x["id"] == ev["employe"]), None)
            if emp and choix == 0:
                emp["salaire"] += 300
                emp["humeur"] = 8
            elif emp:
                e["employes"].remove(emp)
                self._log(f"{emp['nom']} a quitté l'équipe.", "mauvais")
        elif t == "recommandation":
            e["renommee"] += 1
        e["evenement"] = None
        self._log(f"{ev['titre']} : {ev['options'][choix]}.", "info")

    # ------------------------------------------------------------------ actions du joueur
    def action(self, genre, **p):
        e = self.etat
        for cle in ("jours", "choix"):
            if cle in p and (isinstance(p[cle], bool) or not isinstance(p[cle], int)):
                raise ErreurJeu("Paramètres invalides.")
        if "id" in p and (isinstance(p["id"], bool) or not isinstance(p["id"], (int, str))):
            raise ErreurJeu("Paramètres invalides.")
        if e["faillite"] and genre != "avancer":
            raise ErreurJeu("La société est en faillite.")
        if genre == "avancer":
            self.avancer(p.get("jours", 1))
        elif genre == "evenement":
            self._resoudre(p.get("choix", 0))
        elif genre == "fermer_note":
            e.pop("dernier_livre", None)
        elif genre == "signer":
            if e["projet"]:
                raise ErreurJeu("Un projet est déjà en cours.")
            o = next((x for x in e["offres"] if x["id"] == p.get("id")), None)
            if not o:
                raise ErreurJeu("Cette offre n'est plus disponible.")
            e["offres"].remove(o)
            e["projet"] = self._creer_projet(o, "contrat")
            e["reunion"] = True
            acompte = int(round(o["paie"] * 0.3, -1))
            e["projet"]["acompte"] = acompte
            e["argent"] += acompte
            e["stats"]["ca"] += acompte
            self._log(f"Contrat signé avec {o['client']} : « {o['nom']} » (acompte +{acompte:,} €).".replace(",", " "), "info")
        elif genre == "produit":
            if e["projet"]:
                raise ErreurJeu("Un projet est déjà en cours.")
            prod = next((x for x in PRODUITS if x["id"] == p.get("id")), None)
            if not prod or e["renommee"] < prod["rep_min"]:
                raise ErreurJeu("Produit indisponible.")
            if any(x.get("id_produit") == prod["id"] for x in e["produits"]):
                raise ErreurJeu("Ce produit est déjà en vente.")
            self._payer(prod["cout"])
            total = {d: round(prod["taille"] * part) for d, part in zip(DOMAINES, prod["rep"])}
            base = {"nom": prod["nom"], "taille": sum(total.values()), "total": total,
                    "potentiel": prod["potentiel"], "id_produit": prod["id"]}
            e["projet"] = self._creer_projet(base, "produit")
            e["reunion"] = True
            self._log(f"Développement de votre produit « {prod['nom']} » lancé.", "info")
        elif genre == "tests_cem":
            pr = e["projet"]
            if not pr or pr["etape"] != "debug":
                raise ErreurJeu("Le projet n'est pas en phase de debug.")
            self._lancer_cem(pr)
        elif genre == "abandonner":
            pr = e["projet"]
            if not pr:
                raise ErreurJeu("Aucun projet en cours.")
            if pr["type"] == "contrat":
                e["renommee"] = max(0, e["renommee"] - 1)
                e["argent"] -= pr.get("acompte", 0)  # l'acompte est rendu au client
                e["stats"]["ca"] -= pr.get("acompte", 0)
            e["projet"] = None
            self._log(f"Projet « {pr['nom']} » abandonné.", "mauvais")
        elif genre == "embaucher":
            c = next((x for x in e["candidats"] if x["id"] == p.get("id")), None)
            if not c:
                raise ErreurJeu("Candidat introuvable.")
            libres = [b for b in self.postes_ouverts() if b not in {x["bureau"] for x in e["employes"]}]
            if not libres:
                raise ErreurJeu("Plus de poste libre : agrandissez les locaux.")
            e["candidats"].remove(c)
            e["employes"].append({**c, "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 0, "absent": 0,
                                  "formation": None, "bureau": libres[0], "fondateur": False, "tache": None, "gain": 0})
            self._log(f"{c['nom']} rejoint l'équipe ({c['poste']}).", "bon")
        elif genre == "licencier":
            emp = self.employe(p.get("id"))
            if emp.get("fondateur"):
                raise ErreurJeu("Vous ne pouvez pas vous licencier vous-même.")
            self._payer(emp["salaire"])
            e["employes"].remove(emp)
            self._log(f"{emp['nom']} quitte la société (indemnité −{emp['salaire']:,} €).".replace(",", " "), "info")
        elif genre == "former":
            emp = self.employe(p.get("id"))
            d = p.get("dom")
            if d not in DOMAINES:
                raise ErreurJeu("Domaine inconnu.")
            if emp["absent"]:
                raise ErreurJeu(f"{emp['nom']} est déjà absent.")
            self._payer(self.cout_formation(emp))
            emp["absent"], emp["formation"] = DUREE_FORMATION, d
            self._log(f"{emp['nom']} part {DUREE_FORMATION} jours en formation {NOM_DOMAINE[d]}.", "info")
        elif genre == "conges":
            emp = self.employe(p.get("id"))
            if emp["absent"]:
                raise ErreurJeu(f"{emp['nom']} est déjà absent.")
            emp["absent"] = DUREE_CONGES
            self._log(f"{emp['nom']} part {DUREE_CONGES} jours en congés.", "info")
        elif genre == "acheter":
            mid = p.get("id")
            m = MATERIEL.get(mid)
            if not m or mid in e["materiel"]:
                raise ErreurJeu("Matériel indisponible.")
            if m["piece"] in ("atelier", "cem") and m["piece"] not in e["locaux"]:
                raise ErreurJeu(f"Il faut d'abord louer le {'Labo CEM' if m['piece'] == 'cem' else 'local atelier'}.")
            self._payer(m["prix"])
            e["materiel"].append(mid)
            self._log(f"{m['nom']} installé.", "bon")
        elif genre == "deco":
            did = p.get("id")
            d = DECO.get(did)
            if not d or did in e["deco"]:
                raise ErreurJeu("Aménagement indisponible.")
            if d.get("piece") and d["piece"] not in e["locaux"]:
                raise ErreurJeu("Il faut d'abord louer l'open space.")
            self._payer(d["prix"])
            e["deco"].append(did)
            self._log(f"{d['nom']} installé : le moral remonte.", "bon")
        elif genre == "local":
            lid = p.get("id")
            l = LOCAUX.get(lid)
            if not l or lid in e["locaux"]:
                raise ErreurJeu("Local indisponible.")
            if e["renommee"] < l["rep"]:
                raise ErreurJeu(f"Renommée {l['rep']} requise.")
            self._payer(l["prix"])
            e["locaux"].append(lid)
            self._log(f"{l['nom']} : c'est fait ! Loyer +{l['loyer']} €/mois.", "bon")
        else:
            raise ErreurJeu(f"Action inconnue : {genre}")

    def cout_formation(self, emp):
        return 1200 + 150 * (emp["e"] + emp["m"] + emp["f"])

    def _payer(self, montant):
        if self.etat["argent"] < montant:
            raise ErreurJeu("Trésorerie insuffisante.")
        self.etat["argent"] -= montant

    # ------------------------------------------------------------------ vue pour l'interface
    def vue(self):
        e = self.etat
        v = dict(e)
        v["date"] = f"{e['jour']} {MOIS[e['mois']]} {e['annee'] % 100:02d}"
        v["moral"] = round(self.moral_global())
        v["bonus"] = self.bonus()
        v["loyer"] = self.loyer()
        v["salaires"] = self.salaires()
        v["postes_ouverts"] = self.postes_ouverts()
        v["employes"] = [{**x, "moral": round(self.moral(x)), "cout_formation": self.cout_formation(x),
                          "efficacite": round(100 * self.efficacite(x))} for x in e["employes"]]
        v["conditions"], v["facteur_conditions"] = self.conditions()
        if e["projet"]:
            p = e["projet"]
            v["projet"] = {**p, "note_estimee": self.note(p), "proba_cem": self.proba_cem(p), "frais_cem": self.frais_cem(p)}
        return v
