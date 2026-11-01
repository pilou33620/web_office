"""Moteur de Circuit Story : simulation jour par jour d'un bureau d'études électronique."""
import random

from .donnees import (ANCIENS_POSTES, CHEVEUX, CLIENTS, COMBOS, CONTRATS, COULEURS, DECO, DOMAINES, DUREE_PARTIE_ANS,
                      ETABLIS, GRILLE, HORAIRES, LOCAUX, LOYER_BASE, MATERIEL, MATERIEL_DEPART, MOIS, NOM_DOMAINE, PEAUX,
                      PHASES, PIECES, POSTE, POSTES, POSTES_DEPART, PRENOMS, PRODUITS, TITRES_FIN, TRAITS, TROPHEES)

JOURS_MOIS = 30
JOURS_AN = 360
SEUIL_FAILLITE = -5000
NB_OFFRES = 4
NB_CANDIDATS = 4
DUREE_CEM = 3
DUREE_FORMATION = 10
DUREE_CONGES = 5
TAUX_IMPOT = 0.25


class ErreurJeu(Exception):
    """Action refusée ; le message est affiché au joueur."""


def borne(x, lo, hi):
    return max(lo, min(hi, x))


def entier(v):
    return isinstance(v, int) and not isinstance(v, bool)


class Jeu:
    def __init__(self, etat=None, graine=None):
        self.rng = random.Random(graine)
        if etat is None:
            self.etat = {}
            self._nouvel_etat()
        else:
            self.etat = etat
            self._migrer()

    # ------------------------------------------------------------------ création
    def _nouvel_etat(self):
        self.etat.update({
            "version": 2, "jour": 1, "mois": 8, "annee": 2026, "jours_total": 0,
            "argent": 15000, "renommee": 0, "prochain_id": 1, "heures": 8,
            "locaux": [], "materiel": list(MATERIEL_DEPART), "deco": [], "pannes": {},
            "employes": [], "candidats": [], "offres": [], "projets": [], "produits": [],
            "evenement": None, "journal": [], "historique": [], "faillite": False,
            "stats": {"livres": 0, "ca": 0, "produits_lances": 0},
            "trophees": [], "bilans": [], "combos_vus": [], "objets": [],
        })
        self.etat["exercice"] = self._exercice_vide()
        bureaux = [self._ajouter_objet("poste", x, y)["id"] for x, y in POSTES_DEPART]
        for mid in MATERIEL_DEPART:
            self._ajouter_objet(mid, *MATERIEL[mid]["pos"])
        self.etat["employes"].append({
            "id": self._id(), "nom": "Vous", "poste": "Fondateur · ingé élec", "e": 5, "m": 2, "f": 4,
            "trait": "endurant", "salaire": 0, "couleur": "#ffc94d", "cheveux": "#5a3a22", "peau": "#f6cfa6",
            "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 3, "absent": 0, "formation": None,
            "bureau": bureaux[0], "fondateur": True, "tache": None, "gain": 0, "projet": None,
        })
        for _ in range(NB_CANDIDATS):
            self.etat["candidats"].append(self._candidat())
        for _ in range(NB_OFFRES):
            self.etat["offres"].append(self._offre())
        self._log("Bienvenue ! Vous êtes seul dans votre garage : signez un premier contrat dans Projets.", "info")

    def _migrer(self):
        """Met à niveau une sauvegarde de la version 1 (un seul projet, sans horaires ni trophées)."""
        e = self.etat
        if "projets" not in e:
            p = e.pop("projet", None)
            e["projets"] = []
            if p:
                p["id"] = self._id()
                e["projets"].append(p)
        for cle, val in (("heures", 8), ("trophees", []), ("bilans", []), ("combos_vus", [])):
            e.setdefault(cle, val)
        e.setdefault("exercice", self._exercice_vide())
        for p in e["projets"]:
            for cle, val in (("combos", {}), ("combos_jour", []), ("equipe", [])):
                p.setdefault(cle, val)
        for x in e["employes"]:
            x.setdefault("projet", None)
        if "objets" not in e:
            self._migrer_v3()
        e["version"] = 3

    def _migrer_v3(self):
        """v2 -> v3 : postes fixes et matériel/déco sans position deviennent des objets placés."""
        e = self.etat
        e["objets"] = []
        ouverts = [0, 1] + ([2, 3, 4, 5] if "bureau" in e["locaux"] else []) + ([6, 7, 8, 9] if "openspace" in e["locaux"] else [])
        ids = {i: self._ajouter_objet("poste", *ANCIENS_POSTES[i])["id"] for i in ouverts}
        for x in e["employes"]:
            x["bureau"] = ids.get(x["bureau"]) or next(i for i in ids.values() if i not in {y["bureau"] for y in e["employes"]})
        for mid in e["materiel"]:
            self._ajouter_objet(mid, *MATERIEL[mid]["pos"])
        for did in e["deco"]:
            if not DECO[did].get("global"):
                try:
                    self._ajouter_objet(did, *self._place_auto(did))
                except ErreurJeu:
                    pass  # pièce non louée ou pleine : l'effet reste acquis, l'objet n'apparaît pas

    def _exercice_vide(self):
        return {"ca": 0, "charges": 0, "livres": 0, "notes": [], "rep0": self.etat.get("renommee", 0)}

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
            "paie": int(round(taille * r.uniform(68, 82) * (1 + 0.01 * min(rep, 20)), -2)),
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

    def projet(self, pid):
        projets = self.etat["projets"]
        if pid is None and len(projets) == 1:
            return projets[0]
        for p in projets:
            if p["id"] == pid:
                return p
        raise ErreurJeu("Projet introuvable.")

    def postes_ouverts(self):
        return [o["id"] for o in self.etat["objets"] if o["type"] == "poste"]

    # ------------------------------------------------------------------ aménagement libre
    @staticmethod
    def fiche(genre):
        if genre == "poste":
            return POSTE
        fiche = MATERIEL.get(genre) or DECO.get(genre)
        if not fiche or fiche.get("global"):
            raise ErreurJeu("Objet inconnu.")
        return fiche

    def pieces_dispo(self):
        return [k for k, p in PIECES.items() if p["local"] is None or p["local"] in self.etat["locaux"]]

    def _verifier_place(self, genre, x, y, ignorer=None):
        """Renvoie la pièce où l'objet tient entièrement ; refuse les chevauchements."""
        if not (entier(x) and entier(y)):
            raise ErreurJeu("Paramètres invalides.")
        f = self.fiche(genre)
        w, h = f["w"], f["h"]
        dispo = self.pieces_dispo()
        piece = None
        for k in f["pieces"]:
            px, py, pw, ph = PIECES[k]["rect"]
            if px <= x and py <= y and x + w <= px + pw and y + h <= py + ph:
                piece = k
                break
        if piece is None:
            noms = ", ".join(PIECES[k]["nom"] for k in f["pieces"])
            raise ErreurJeu(f"{f['nom']} : à placer entièrement dans {noms}.")
        if piece not in dispo:
            raise ErreurJeu(f"Il faut d'abord louer : {LOCAUX[PIECES[piece]['local']]['nom']}.")
        if f.get("libre"):
            return piece
        if genre not in MATERIEL and any(x < ex + ew and ex < x + w and y < ey + eh and ey < y + h for ex, ey, ew, eh in ETABLIS):
            raise ErreurJeu("Pas sur l'établi : seul le petit matériel peut y être posé.")
        for o in self.etat["objets"]:
            if o["id"] == ignorer:
                continue
            g = self.fiche(o["type"])
            if g.get("libre"):
                continue
            if x < o["x"] + g["w"] and o["x"] < x + w and y < o["y"] + g["h"] and o["y"] < y + h:
                raise ErreurJeu("La place est déjà prise.")
        return piece

    def _place_auto(self, genre):
        f = self.fiche(genre)
        for k in f["pieces"]:
            if k not in self.pieces_dispo():
                continue
            px, py, pw, ph = PIECES[k]["rect"]
            for y in range(py + 4, py + ph - f["h"] + 1, 8):
                for x in range(px + 4, px + pw - f["w"] + 1, 8):
                    try:
                        self._verifier_place(genre, x, y)
                        return x, y
                    except ErreurJeu:
                        pass
        raise ErreurJeu(f"Plus de place libre pour : {f['nom']}.")

    def _ajouter_objet(self, genre, x, y):
        o = {"id": self._id(), "type": genre, "x": x, "y": y}
        self.etat["objets"].append(o)
        return o

    def _poser(self, genre, x=None, y=None):
        e = self.etat
        f = self.fiche(genre)
        if genre in MATERIEL and genre in e["materiel"]:
            raise ErreurJeu(f"{f['nom']} : déjà installé.")
        if genre in DECO and genre in e["deco"] and not f.get("multiple"):
            raise ErreurJeu(f"{f['nom']} : vous en avez déjà un.")
        if x is None or y is None:
            x, y = self._place_auto(genre)
        else:
            x, y = round(x / GRILLE) * GRILLE if entier(x) else x, round(y / GRILLE) * GRILLE if entier(y) else y
        self._verifier_place(genre, x, y)
        self._payer(f["prix"])
        self._ajouter_objet(genre, x, y)
        if genre in MATERIEL:
            e["materiel"].append(genre)
        elif genre in DECO and genre not in e["deco"]:
            e["deco"].append(genre)
        self._log(f"{f['nom']} installé.", "bon")

    def objet(self, oid):
        o = next((x for x in self.etat["objets"] if x["id"] == oid), None)
        if not o:
            raise ErreurJeu("Objet introuvable.")
        return o

    def capacite_projets(self):
        return 1 + ("bureau" in self.etat["locaux"]) + ("openspace" in self.etat["locaux"])

    def horaires(self):
        return HORAIRES[self.etat["heures"]]

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
        m = 60 + sum(DECO[d]["moral"] for d in e["deco"]) + self.horaires()["moral"] + 5 * ("pause" in e["locaux"])
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
        if e["heures"] != 8:
            f.append((f"Horaires : {e['heures']} h par jour", round((self.horaires()["prod"] - 1) * 100)))
        if e["mois"] in (5, 6, 7):
            f.append(("Canicule, mais climatisé", 0) if "clim" in e["deco"] else ("Canicule sans climatisation", -15))
        if n > 4 and "isolation" not in e["deco"]:
            f.append(("Bruit, pas d'isolation phonique", -2 * (n - 4)))
        if n >= 2 and "bureau" not in e["locaux"]:
            f.append(("Garage exigu", -5))
        total = borne(1 + sum(x[1] for x in f) / 100, 0.6, 1.5)
        return [{"nom": a, "pct": b} for a, b in f], total

    def efficacite(self, emp):
        trait = TRAITS[emp["trait"]]
        return borne(self.moral(emp) / 70, 0.4, 1.4) * self.conditions()[1] * trait.get("vitesse", 1.0)

    def loyer(self):
        return LOYER_BASE + sum(LOCAUX[l]["loyer"] for l in self.etat["locaux"])

    def frais_structure(self):
        """Comptable, assurances, licences logicielles… : croît plus vite que l'effectif (coordination)."""
        n = len([x for x in self.etat["employes"] if not x.get("fondateur")])
        return 400 * n + 50 * n * n

    def salaires(self):
        return int(round(sum(x["salaire"] for x in self.etat["employes"]) * (1 + self.horaires()["salaire"])))

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
        if p["combos"].get("trio", 0) >= max(1, p["jours"]) / 2:
            n += 0.4
        if p["type"] == "contrat" and p["jours"] > p["delai"]:
            n -= min(3, 0.12 * (p["jours"] - p["delai"]))
        return round(borne(n, 1, 10), 1)

    def attente_client(self):
        """Plus la société est connue, plus les clients sont exigeants (frein à l'emballement de fin de partie)."""
        return 6 + min(3, self.etat["renommee"] / 10)

    # ------------------------------------------------------------------ argent
    def _encaisser(self, montant):
        e = self.etat
        e["argent"] += montant
        e["stats"]["ca"] += montant
        e["exercice"]["ca"] += montant

    def _depenser(self, montant):
        self.etat["argent"] -= montant
        self.etat["exercice"]["charges"] += montant

    def _payer(self, montant):
        if self.etat["argent"] < montant:
            raise ErreurJeu("Trésorerie insuffisante.")
        self._depenser(montant)

    # ------------------------------------------------------------------ projets
    def _creer_projet(self, base, genre):
        phases = []
        for nom, parts in PHASES:
            besoin = {d: round(base["total"][d] * parts[d]) for d in DOMAINES if round(base["total"][d] * parts[d]) > 0}
            if besoin:
                phases.append({"nom": nom, "besoin": besoin, "fait": {d: 0.0 for d in besoin}})
            if nom == PHASES[1][0]:
                # les PCB partent en fabrication : on attend le retour du fournisseur (durée fixée à l'entrée)
                phases.append({"nom": "Fabrication du prototype", "besoin": {}, "fait": {}, "attente": None})
        return {
            "id": self._id(), "type": genre, "nom": base["nom"], "client": base.get("client", ""),
            "taille": base["taille"], "total": base["total"], "paie": base.get("paie", 0), "delai": base.get("delai", 0),
            "gain": base.get("gain", 0), "potentiel": base.get("potentiel", 0), "id_produit": base.get("id_produit"),
            "phases": phases, "phase": 0, "etape": "travail", "defauts": 0.0, "qualite": 0.0,
            "jours": 0, "cem_jours": 0, "echecs_cem": 0, "combos": {}, "combos_jour": [], "equipe": [],
        }

    def _verifier_capacite(self):
        if len(self.etat["projets"]) >= self.capacite_projets():
            raise ErreurJeu(f"Vous menez déjà {self.capacite_projets()} projet(s) : agrandissez les locaux pour en mener plus.")

    def _entrer_phase(self, p):
        ph = p["phases"][p["phase"]]
        if "attente" in ph and ph["attente"] is None:
            maison = "four" in self.materiel_actif()  # avec un four de refusion, on assemble soi-même : plus rapide et moins cher
            ph["attente"] = 2 if maison else 4
            ph["cout"] = int(round((200 + p["taille"] * 2) * (0.5 if maison else 1), -1))
            self._depenser(ph["cout"])
            ou = "assemblé au labo" if maison else "chez le fabricant"
            self._log(f"« {p['nom']} » : prototype {ou} (−{ph['cout']:,} €, {ph['attente']} jours).".replace(",", " "), "info")
        else:
            self._log(f"« {p['nom']} » : phase « {ph['nom']} ».", "info")

    def _lancer_cem(self, p):
        frais = self.frais_cem(p)
        self._depenser(frais)
        p["etape"], p["cem_jours"] = "cem", DUREE_CEM
        cout = f" (labo externe : −{frais:,} €)".replace(",", " ") if frais else ""
        self._log(f"Tests CEM lancés pour « {p['nom']} »{cout}.", "info")

    def _utilite(self, emp, p):
        if p["etape"] == "travail":
            ph = p["phases"][p["phase"]]
            return max([emp[d] for d in ph["besoin"] if ph["besoin"][d] - ph["fait"][d] > 1e-6] or [0])
        if p["etape"] == "debug":
            return (emp["e"] + emp["f"]) / 4
        return 0

    def _repartir(self):
        """Affecte chaque employé présent à un projet : son affectation fixe, sinon là où il est le plus utile."""
        e = self.etat
        equipes = {p["id"]: [] for p in e["projets"]}
        if not equipes:
            return equipes
        for emp in e["employes"]:
            if emp["absent"]:
                continue
            if emp.get("projet") in equipes:
                equipes[emp["projet"]].append(emp)
                continue
            meilleur = max(e["projets"], key=lambda p: self._utilite(emp, p) / (1 + 0.25 * len(equipes[p["id"]])))
            equipes[meilleur["id"]].append(emp)
        return equipes

    def _combos(self, p, equipe):
        actifs = []
        doms = [d for d in DOMAINES if p["total"][d] > 0]
        pris = set()
        for d in doms:
            expert = next((x for x in equipe if x[d] >= 5 and x["id"] not in pris), None)
            if not expert:
                break
            pris.add(expert["id"])
        else:
            if len(doms) >= 2:
                actifs.append("trio")
        traits = {x["trait"] for x in equipe}
        if {"perfectionniste", "debug"} <= traits:
            actifs.append("qualite")
        if any(x[d] >= 9 for x in equipe for d in DOMAINES) and any(x["e"] + x["m"] + x["f"] <= 6 for x in equipe):
            actifs.append("mentor")
        if len(equipe) >= 4 and all(self.moral(x) >= 65 for x in equipe):
            actifs.append("soudee")
        return actifs

    def _travailler(self, p, actifs, bon):
        e = self.etat
        combos = self._combos(p, actifs)
        p["combos_jour"], p["equipe"] = combos, [x["id"] for x in actifs]
        for c in combos:
            p["combos"][c] = p["combos"].get(c, 0) + 1
            if c not in e["combos_vus"]:
                e["combos_vus"].append(c)
                self._log(f"Combo débloqué sur « {p['nom']} » : {COMBOS[c]['nom']} !", "bon")
        mult = (1.1 if "trio" in combos else 1.0) * (1.05 if "soudee" in combos else 1.0)
        taux_defauts = 0.07 * self.horaires()["defauts"] * (0.7 if "qualite" in combos else 1.0)
        for emp in actifs:
            emp["projet_jour"] = p["id"]
        if p["etape"] == "travail":
            ph = p["phases"][p["phase"]]
            if ph.get("attente"):
                ph["attente"] -= 1
            for emp in actifs:
                reste = {d: ph["besoin"][d] - ph["fait"][d] for d in ph["besoin"]}
                doms = [d for d, r in reste.items() if r > 1e-6 and emp[d] > 0]
                if doms:
                    d = max(doms, key=lambda k: emp[k])
                    pts = min(self._production(emp, d, bon) * mult, reste[d])
                    ph["fait"][d] += pts
                    trait = TRAITS[emp["trait"]]
                    p["defauts"] += pts * taux_defauts * trait.get("defauts", 1.0)
                    p["qualite"] += pts * trait.get("qualite", 0.0)
                    emp["tache"], emp["gain"] = d, round(pts, 1)
                    junior = "mentor" in combos and emp["e"] + emp["m"] + emp["f"] <= 6
                    self._experience(emp, d, pts * (2 if junior else 1))
                else:
                    retire = min(p["defauts"], self._detection(emp, bon))
                    p["defauts"] -= retire
                    emp["tache"], emp["gain"] = "debug", round(retire, 1)
            p["defauts"] *= 1 - min(0.3, 0.015 * (1 + 0.5 * bon["debug"]))
            if not ph.get("attente") and all(ph["fait"][d] >= ph["besoin"][d] - 1e-6 for d in ph["besoin"]):
                if p["phase"] + 1 < len(p["phases"]):
                    p["phase"] += 1
                    e["reunion"] = True
                    self._entrer_phase(p)
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
            facteur = borne(1 + 0.1 * (note - self.attente_client()), 0.5, 1.25)
            paie = int(round(p["paie"] * facteur, -1)) - p.get("acompte", 0)
            ecart = note - self.attente_client()
            gain = -1 if ecart < -2 else max(0, round(p["gain"] * ecart / 2 + (0.5 if ecart >= 0 else 0)))
            self._encaisser(paie)
            e["renommee"] = max(0, e["renommee"] + gain)
            e["stats"]["livres"] += 1
            e["exercice"]["livres"] += 1
            self._log(f"« {p['nom']} » livré à {p['client']} : note {note}/10, +{paie:,} €, renommée {gain:+d}.".replace(",", " "), "bon")
            e["historique"].insert(0, {"nom": p["nom"], "client": p["client"], "note": note, "montant": paie,
                                       "jours": p["jours"], "type": "contrat", "avis": self._avis(note)})
            if p["taille"] >= 300 and p["echecs_cem"] == 0 and note >= 8:
                self._trophee("sans_faute")
        else:
            ventes = int(2 * p["potentiel"] * (note / 10) ** 2 * (1 + e["renommee"] / 25))
            e["produits"].append({"nom": p["nom"], "id_produit": p["id_produit"], "note": note, "ventes": ventes, "mois": 0, "total": 0})
            e["stats"]["produits_lances"] += 1
            if note >= 8:
                e["renommee"] += 1
            self._log(f"« {p['nom']} » est en vente ! Note de la presse : {note}/10.", "bon")
            e["historique"].insert(0, {"nom": p["nom"], "client": "Produit maison", "note": note, "montant": 0,
                                       "jours": p["jours"], "type": "produit", "avis": self._avis(note)})
        e["exercice"]["notes"].append(note)
        del e["historique"][30:]
        e["projets"].remove(p)
        for x in e["employes"]:
            if x.get("projet") == p["id"]:
                x["projet"] = None
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
                emp["salaire"] = int(round(emp["salaire"] * 1.08 + 50, -1))  # chaque progrès se négocie
            self._log(f"{emp['nom']} progresse en {NOM_DOMAINE[dom]} ({emp[dom]}).", "bon")

    # ------------------------------------------------------------------ trophées, bilans, fin
    def _trophee(self, tid):
        e = self.etat
        if tid not in e["trophees"]:
            e["trophees"].append(tid)
            self._log(f"Trophée débloqué : {TROPHEES[tid]['nom']} !", "trophee")

    def _verifier_trophees(self):
        e = self.etat
        notes = [h["note"] for h in e["historique"]]
        conditions = {
            "premier_contrat": e["stats"]["livres"] >= 1,
            "note_9": any(n >= 9 for n in notes),
            "note_10": any(n >= 10 for n in notes),
            "equipe_6": len(e["employes"]) >= 6,
            "equipe_10": len(e["employes"]) >= 10,
            "parallele": len(e["projets"]) >= 3,
            "trio": "trio" in e["combos_vus"],
            "labo_cem": "cem" in e["locaux"],
            "trois_produits": e["stats"]["produits_lances"] >= 3,
            "produit_star": any(h["type"] == "produit" and h["note"] >= 8.5 for h in e["historique"]),
            "vingt_contrats": e["stats"]["livres"] >= 20,
            "renommee_10": e["renommee"] >= 10,
            "renommee_25": e["renommee"] >= 25,
            "cent_mille": e["argent"] >= 100_000,
            "million": e["argent"] >= 1_000_000,
        }
        for tid, ok in conditions.items():
            if ok:
                self._trophee(tid)

    def _bilan(self):
        e = self.etat
        x = e["exercice"]
        benefice = x["ca"] - x["charges"]
        impot = int(round(max(0, benefice) * TAUX_IMPOT, -1))
        e["argent"] -= impot
        an = e["jours_total"] // JOURS_AN
        bilan = {
            "annee": an, "ca": x["ca"], "charges": x["charges"], "benefice": benefice, "impot": impot,
            "livres": x["livres"], "note_moy": round(sum(x["notes"]) / len(x["notes"]), 1) if x["notes"] else None,
            "renommee": e["renommee"] - x["rep0"], "employes": len(e["employes"]), "tresorerie": e["argent"],
        }
        e["bilans"].append(bilan)
        e["bilan"] = bilan
        e["exercice"] = self._exercice_vide()
        self._log(f"Bilan de l'année {an} : bénéfice {benefice:,} €, impôt −{impot:,} €.".replace(",", " "), "info")
        if an >= DUREE_PARTIE_ANS and "fin" not in e:
            e["fin"] = self.score_final()

    def score_final(self):
        e = self.etat
        notes = [h["note"] for h in e["historique"]]
        moy = sum(notes) / len(notes) if notes else 0
        score = round(e["stats"]["ca"] / 1000 + e["renommee"] * 40 + len(e["trophees"]) * 150 + moy * 100)
        titre = next(t for seuil, t in TITRES_FIN if score < seuil)
        return {"score": score, "titre": titre, "vue": False, "ca": e["stats"]["ca"], "livres": e["stats"]["livres"],
                "renommee": e["renommee"], "trophees": len(e["trophees"]), "note_moy": round(moy, 1)}

    # ------------------------------------------------------------------ temps
    def en_pause(self):
        e = self.etat
        return bool(e["evenement"] or e["faillite"] or e.get("bilan") or (e.get("fin") and not e["fin"]["vue"]))

    def avancer(self, jours=1):
        for _ in range(max(1, min(30, int(jours)))):
            if self.en_pause():
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
            emp["tache"], emp["gain"], emp["projet_jour"] = None, 0, None
        equipes = self._repartir()
        for p in list(e["projets"]):
            p["jours"] += 1
            self._travailler(p, equipes[p["id"]], bon)
            if p in e["projets"] and p["type"] == "contrat" and p["jours"] == p["delai"] + 1:
                self._log(f"Retard sur « {p['nom']} » : la note client va baisser.", "mauvais")
        par_id = {p["id"]: p for p in e["projets"]}
        for emp in e["employes"]:
            self._placer(emp, par_id.get(emp["projet_jour"]))
        e.pop("reunion", None)
        h = self.horaires()
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
                emp["fatigue"] = min(50, emp["fatigue"] + 1.2 * trait.get("fatigue", 1.0) * h["fatigue"])
            else:
                emp["fatigue"] = max(0, emp["fatigue"] - (5 if "pause" in e["locaux"] else 3))
        for pid in list(e["pannes"]):
            e["pannes"][pid] -= 1
            if e["pannes"][pid] <= 0:
                del e["pannes"][pid]
                self._log(f"{MATERIEL[pid]['nom']} réparé.", "info")
        for o in e["offres"]:
            o["expire"] -= 1
        e["offres"] = [o for o in e["offres"] if o["expire"] > 0]
        if len(e["offres"]) < NB_OFFRES + len(e["projets"]) and self.rng.random() < 0.15:
            e["offres"].append(self._offre())
        if e["jours_total"] > 10 and self.rng.random() < 1 / 18:
            self._evenement()
        self._verifier_trophees()
        if e["jours_total"] % JOURS_AN == 0:
            self._bilan()
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
            lieu = "pause" if r.random() < 0.75 else "bureau"
        emp["visite"] = None
        if t in ("e", "m", "f", "debug") and lieu != "reunion" and r.random() < 0.12:
            # va demander conseil au collègue le plus fort du domaine, sur le même projet
            dom = "f" if t == "debug" else t
            collegues = [x for x in e["employes"] if x is not emp and not x["absent"] and x.get("projet_jour") == emp.get("projet_jour")]
            if collegues:
                expert = max(collegues, key=lambda x: x[dom])
                emp["visite"] = expert["id"]
                if expert[dom] > emp[dom]:
                    self._experience(emp, dom, expert[dom] - emp[dom])  # on apprend en demandant conseil
                emp["lieu"], emp["tache_prec"] = "visite", t
                return
        # inertie : même tâche, on reste souvent au même endroit (déplacements moins frénétiques)
        if emp.get("lieu") not in (None, "reunion", "visite") and lieu != "reunion" and emp.get("tache_prec") == t and r.random() < 0.6:
            lieu = emp["lieu"]
        emp["lieu"], emp["tache_prec"] = lieu, t

    def _debut_mois(self):
        e = self.etat
        loyer, sal, frais = self.loyer(), self.salaires(), self.frais_structure()
        ventes = 0
        for prod in e["produits"]:
            ventes += prod["ventes"]
            prod["total"] += prod["ventes"]
            prod["mois"] += 1
            prod["ventes"] = int(prod["ventes"] * 0.9)
        e["produits"] = [x for x in e["produits"] if x["ventes"] >= 100]
        self._encaisser(ventes)
        self._depenser(loyer + sal + frais)
        texte = f"Fin de mois : loyer −{loyer:,} €, salaires −{sal:,} €".replace(",", " ")
        if frais:
            texte += f", frais de structure −{frais:,} €".replace(",", " ")
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
        en_travail = [p for p in e["projets"] if p["etape"] == "travail"]
        possibles = []
        if en_travail:
            p = r.choice(en_travail)
            cout = 400 + p["taille"] * 6
            possibles.append({"type": "penurie", "titre": "Pénurie de composants", "projet": p["id"],
                              "texte": f"Le microcontrôleur de « {p['nom']} » est en rupture chez tous les distributeurs.",
                              "options": [f"Acheter chez un broker (−{cout:,} €)".replace(",", " "),
                                          "Re-concevoir avec un équivalent (plus long, plus de défauts)"],
                              "cout": cout})
        presses = [p for p in en_travail if p["type"] == "contrat" and p["delai"] - p["jours"] > 15]
        if presses:
            p = r.choice(presses)
            possibles.append({"type": "presse", "titre": "Client pressé", "projet": p["id"],
                              "texte": f"{p['client']} veut avancer la livraison de « {p['nom']} » de 7 jours, contre 20 % de plus.",
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
        if e["heures"] >= 10 and e["employes"][1:]:
            possibles.append({"type": "greve", "titre": "Ras-le-bol général",
                              "texte": f"L'équipe ne supporte plus les journées de {e['heures']} h.",
                              "options": ["Revenir à 8 h par jour", "Tenir bon (moral en baisse)"]})
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
        t = ev["type"]
        p = next((x for x in e["projets"] if x["id"] == ev.get("projet")), None)
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
            self._encaisser(4000)
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
        elif t == "greve":
            if choix == 0:
                e["heures"] = 8
            else:
                for x in e["employes"]:
                    x["humeur"] = borne(x["humeur"] - 4, -8, 8)
        elif t == "recommandation":
            e["renommee"] += 1
        e["evenement"] = None
        self._log(f"{ev['titre']} : {ev['options'][choix]}.", "info")

    # ------------------------------------------------------------------ actions du joueur
    def action(self, genre, **p):
        e = self.etat
        for cle in ("jours", "choix", "heures"):
            if cle in p and not entier(p[cle]):
                raise ErreurJeu("Paramètres invalides.")
        if "id" in p and not (entier(p["id"]) or isinstance(p["id"], str)):
            raise ErreurJeu("Paramètres invalides.")
        if "projet" in p and not (p["projet"] is None or entier(p["projet"])):
            raise ErreurJeu("Paramètres invalides.")
        if e["faillite"] and genre != "avancer":
            raise ErreurJeu("La société est en faillite.")
        if genre == "avancer":
            self.avancer(p.get("jours", 1))
        elif genre == "evenement":
            self._resoudre(p.get("choix", 0))
        elif genre == "fermer_note":
            e.pop("dernier_livre", None)
        elif genre == "fermer_bilan":
            e.pop("bilan", None)
        elif genre == "fermer_fin":
            if e.get("fin"):
                e["fin"]["vue"] = True
        elif genre == "signer":
            self._verifier_capacite()
            o = next((x for x in e["offres"] if x["id"] == p.get("id")), None)
            if not o:
                raise ErreurJeu("Cette offre n'est plus disponible.")
            e["offres"].remove(o)
            pr = self._creer_projet(o, "contrat")
            e["projets"].append(pr)
            e["reunion"] = True
            pr["acompte"] = int(round(o["paie"] * 0.3, -1))
            self._encaisser(pr["acompte"])
            self._log(f"Contrat signé avec {o['client']} : « {o['nom']} » (acompte +{pr['acompte']:,} €).".replace(",", " "), "info")
        elif genre == "produit":
            self._verifier_capacite()
            prod = next((x for x in PRODUITS if x["id"] == p.get("id")), None)
            if not prod or e["renommee"] < prod["rep_min"]:
                raise ErreurJeu("Produit indisponible.")
            if any(x.get("id_produit") == prod["id"] for x in e["produits"] + e["projets"]):
                raise ErreurJeu("Ce produit est déjà en vente ou en développement.")
            self._payer(prod["cout"])
            total = {d: round(prod["taille"] * part) for d, part in zip(DOMAINES, prod["rep"])}
            base = {"nom": prod["nom"], "taille": sum(total.values()), "total": total,
                    "potentiel": prod["potentiel"], "id_produit": prod["id"]}
            e["projets"].append(self._creer_projet(base, "produit"))
            e["reunion"] = True
            self._log(f"Développement de votre produit « {prod['nom']} » lancé.", "info")
        elif genre == "tests_cem":
            pr = self.projet(p.get("id"))
            if pr["etape"] != "debug":
                raise ErreurJeu("Le projet n'est pas en phase de debug.")
            self._lancer_cem(pr)
        elif genre == "abandonner":
            pr = self.projet(p.get("id"))
            if pr["type"] == "contrat":
                e["renommee"] = max(0, e["renommee"] - 1)
                self._encaisser(-pr.get("acompte", 0))  # l'acompte est rendu au client
            e["projets"].remove(pr)
            for x in e["employes"]:
                if x.get("projet") == pr["id"]:
                    x["projet"] = None
            self._log(f"Projet « {pr['nom']} » abandonné.", "mauvais")
        elif genre == "affecter":
            emp = self.employe(p.get("id"))
            cible = p.get("projet")
            if cible is not None:
                self.projet(cible)
            emp["projet"] = cible
        elif genre == "horaires":
            h = p.get("heures")
            if h not in HORAIRES:
                raise ErreurJeu("Horaires inconnus.")
            e["heures"] = h
            self._log(f"Nouveaux horaires : {HORAIRES[h]['nom']}.", "info")
        elif genre == "embaucher":
            c = next((x for x in e["candidats"] if x["id"] == p.get("id")), None)
            if not c:
                raise ErreurJeu("Candidat introuvable.")
            libres = [b for b in self.postes_ouverts() if b not in {x["bureau"] for x in e["employes"]}]
            if not libres:
                raise ErreurJeu("Plus de bureau libre : achetez-en un dans Locaux.")
            e["candidats"].remove(c)
            e["employes"].append({**c, "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 0, "absent": 0,
                                  "formation": None, "bureau": libres[0], "fondateur": False, "tache": None,
                                  "gain": 0, "projet": None})
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
        elif genre in ("acheter", "deco", "poser"):
            ident = p.get("id")
            if genre == "acheter" and ident not in MATERIEL:
                raise ErreurJeu("Matériel indisponible.")
            if DECO.get(ident, {}).get("global"):
                if ident in e["deco"]:
                    raise ErreurJeu("Déjà installé.")
                self._payer(DECO[ident]["prix"])
                e["deco"].append(ident)
                self._log(f"{DECO[ident]['nom']} installé.", "bon")
            else:
                self._poser(ident, p.get("x"), p.get("y"))
        elif genre == "deplacer":
            o = self.objet(p.get("id"))
            x, y = p.get("x"), p.get("y")
            if entier(x) and entier(y):
                x, y = round(x / GRILLE) * GRILLE, round(y / GRILLE) * GRILLE
            self._verifier_place(o["type"], x, y, ignorer=o["id"])
            o["x"], o["y"] = x, y
        elif genre == "vendre":
            o = self.objet(p.get("id"))
            if o["type"] == "poste":
                if any(x["bureau"] == o["id"] for x in e["employes"]):
                    raise ErreurJeu("Ce bureau est occupé.")
            f = self.fiche(o["type"])
            e["objets"].remove(o)
            if o["type"] in MATERIEL:
                e["materiel"].remove(o["type"])
                e["pannes"].pop(o["type"], None)
            elif not any(x["type"] == o["type"] for x in e["objets"]):
                e["deco"].remove(o["type"])
            reprise = f["prix"] // 2
            self._encaisser(reprise)
            self._log(f"{f['nom']} revendu (+{reprise:,} €).".replace(",", " "), "info")
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
        self._verifier_trophees()

    def cout_formation(self, emp):
        return 1200 + 150 * (emp["e"] + emp["m"] + emp["f"])

    # ------------------------------------------------------------------ vue pour l'interface
    def vue(self):
        e = self.etat
        v = dict(e)
        v["date"] = f"{e['jour']} {MOIS[e['mois']]} {e['annee'] % 100:02d}"
        v["moral"] = round(self.moral_global())
        v["bonus"] = self.bonus()
        v["loyer"] = self.loyer()
        v["salaires"] = self.salaires()
        v["frais_structure"] = self.frais_structure()
        v["postes_ouverts"] = self.postes_ouverts()
        v["capacite"] = self.capacite_projets()
        v["annee_jeu"] = e["jours_total"] // JOURS_AN + 1
        v["attente_client"] = round(self.attente_client(), 1)
        v["employes"] = [{**x, "moral": round(self.moral(x)), "cout_formation": self.cout_formation(x),
                          "efficacite": round(100 * self.efficacite(x))} for x in e["employes"]]
        v["conditions"], v["facteur_conditions"] = self.conditions()
        v["projets"] = [{**p, "note_estimee": self.note(p), "proba_cem": self.proba_cem(p), "frais_cem": self.frais_cem(p)}
                        for p in e["projets"]]
        return v
