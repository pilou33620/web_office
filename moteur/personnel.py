"""Personnel : séniorité, traits multiples, compétences métier, motivations, affinités, fidélité, burn-out,
vie perso, entretiens annuels et découverte progressive des candidats (CV, entretien, spécialiste)."""
from .donnees import (CHEVEUX, COULEURS, COUT_ENTRETIEN, DOMAINES, JOURS_AN, METIERS, MOTIVATIONS, NOM_DOMAINE, PEAUX, POSTES,
                      PRENOMS, ROLES, SALAIRE_BASE, SALAIRE_POINT, SENIORITES, TRAITS)
from .extensions import ErreurJeu, borne

MULTIPLICATIFS = ("vitesse", "defauts", "detection", "fatigue")  # les autres effets de traits s'additionnent
PRIX_METIER = 120  # €/mois par point de compétence métier
DUREE_BURNOUT = 20
SEUIL_SURMENAGE = 8  # jours de suite à 45 de fatigue ou plus avant le burn-out


def paire(a, b):
    return f"{min(a, b)}-{max(a, b)}"


class Personnel:
    # ------------------------------------------------------------------ caractéristiques
    def _trait(self, emp, cle):
        mult = cle in MULTIPLICATIFS
        v = 1.0 if mult else 0.0
        for t in emp["traits"]:
            x = TRAITS[t].get(cle)
            if x is not None:
                v = v * x if mult else v + x
        return v

    def metier(self, emp, m):
        return emp["metier"][m] + 3 * (m == "commercial" and "negociateur" in emp["traits"]) + 2 * (m == "qualif" and "rigoureux" in emp["traits"])

    def meilleur_metier(self, m):
        return max([self.metier(x, m) for x in self.etat["employes"] if not x["absent"]], default=0)

    @staticmethod
    def seniorite_possible(x):
        somme = x["e"] + x["m"] + x["f"]
        return max(i for i, s in enumerate(SENIORITES) if somme >= s["points"])

    def prix_marche(self, x, seniorite=None):
        sen = x["seniorite"] if seniorite is None else seniorite
        return SALAIRE_BASE + SALAIRE_POINT * (x["e"] + x["m"] + x["f"]) + PRIX_METIER * sum(x["metier"].values()) + SENIORITES[sen]["prime"]

    def anciennete(self, x):
        return (self.etat["jours_total"] - x["arrivee"]) / JOURS_AN

    def satisfait(self, x):
        e, m = self.etat, x.get("motivation")
        if m == "salaire":
            return x["salaire"] >= self.prix_marche(x)
        if m == "ambiance":
            return self.moral_global() >= 70
        if m == "projets":
            return any(p["type"] == "produit" or p.get("mega") or p["taille"] >= 300 for p in e["projets"])
        if m == "formation":
            return e["jours_total"] - x["derniere_formation"] < JOURS_AN
        if m == "horaires":
            return e["heures"] <= 8
        return True

    def fidelite(self, x):
        """Chance qu'un employé ignore une offre de la concurrence."""
        return min(0.7, 0.12 * self.anciennete(x) + 0.15 * self.satisfait(x))

    def cout_specialiste(self):
        return 2500 + 300 * self.etat["renommee"]

    # ------------------------------------------------------------------ recrutement
    def _candidat(self):
        rep, r = self.etat["renommee"], self.rng
        stagiaire = r.random() < 0.15
        if stagiaire:
            profil, total = {"nom": "Stagiaire", "poids": {"e": 0.4, "m": 0.3, "f": 0.3}}, r.uniform(2, 4)
        else:
            profil, total = r.choice(POSTES), min(24, r.uniform(4, 7) + rep * 0.7)
        poids = profil["poids"]
        stats = {d: max(0, round(total * poids[d] + r.uniform(-0.6, 0.6))) for d in DOMAINES}
        if sum(stats.values()) < 2:
            stats[max(poids, key=poids.get)] += 2
        metier = {m: r.randint(1, 2) if r.random() < 0.3 else 0 for m in METIERS}
        if profil.get("metier"):
            metier[profil["metier"]] = max(2, round(total * 0.45 + r.uniform(-1, 1)))
        cachee = r.choice(list(METIERS))
        metier[cachee] += r.randint(2, 5)  # talent caché : ni le CV ni l'entretien ne le montrent
        c = {"id": self._id(), "nom": r.choice(PRENOMS), "poste": profil["nom"], **stats, "metier": metier, "cachee": cachee,
             "traits": r.sample(sorted(TRAITS), 3 if r.random() < 0.3 else 2), "motivation": r.choice(list(MOTIVATIONS)),
             "connu": {"traits": 1, "cachee": False, "motivation": False, "seniorite": False, "indice": None},
             "couleur": r.choice(COULEURS), "cheveux": r.choice(CHEVEUX), "peau": r.choice(PEAUX)}
        if not stagiaire and rep >= 3 and r.random() < 0.12:  # un chef d'équipe expérimenté, embauché pour encadrer un service
            d = r.choice(DOMAINES)
            c[d] = max(c[d], 8 + r.randint(0, 2))
            c.update(poste=f"Chef d'équipe {NOM_DOMAINE[d]}", role_propose=f"resp_{d}")
        c["chef"], c["commercial"] = bool(profil.get("chef")), bool(profil.get("commercial"))
        c["seniorite"] = 0 if stagiaire else self.seniorite_possible(c)
        c["annonce"] = min(3, c["seniorite"] + 1) if not stagiaire and r.random() < 0.3 else c["seniorite"]  # CV parfois gonflé
        c["salaire"] = 600 if stagiaire else self.prix_marche(c, c["annonce"])  # on paie ce que le CV annonce
        if c["commercial"]:
            c["salaire"] = int(round(c["salaire"] * 0.6, -1))  # fixe plus faible : le reste en commission sur les contrats
        if c.get("role_propose"):
            c["salaire"] += ROLES[c["role_propose"]]["salaire"]
        return c

    def _completer_personnel(self, x):
        """Champs du personnel ; une ancienne sauvegarde garde ses employés, tout connus."""
        e = self.etat
        if "traits" not in x:
            x["traits"] = [x.get("trait", "endurant")]
        x.pop("trait", None)
        x.setdefault("metier", {m: 0 for m in METIERS})
        x.setdefault("cachee", None)
        x.setdefault("seniorite", self.seniorite_possible(x))
        x.setdefault("annonce", x["seniorite"])
        x.setdefault("motivation", None if x.get("fondateur") else self.rng.choice(list(MOTIVATIONS)))
        x.setdefault("connu", {"traits": len(x["traits"]), "cachee": True, "motivation": True, "seniorite": True, "indice": None})
        x.setdefault("arrivee", e["jours_total"])
        x.setdefault("prochain_entretien", x["arrivee"] + JOURS_AN)
        x.setdefault("surmenage", 0)
        x.setdefault("derniere_formation", -999)

    def _arrivee(self, emp):
        """Nouvel employé : affinités tirées avec chacun des collègues (découvertes en travaillant ensemble)."""
        aff = self.etat["affinites"]
        for x in self.etat["employes"]:
            if x is not emp:
                t = self.rng.random()
                if t < 0.25:
                    aff[paire(x["id"], emp["id"])] = 1 if t < 0.15 else -1

    def _reveler(self, x, tout=False):
        """Découvre une caractéristique cachée (ou toutes) ; renvoie son libellé, ou None s'il n'y a plus rien à découvrir."""
        k = x["connu"]
        trouve = []
        while True:
            if k["traits"] < len(x["traits"]):
                trouve.append(TRAITS[x["traits"][k["traits"]]]["nom"].lower())
                k["traits"] += 1
            elif not k["cachee"] and x["cachee"]:
                k["cachee"] = True
                trouve.append(f"doué en {METIERS[x['cachee']]['nom'].lower()}")
            elif not k["seniorite"]:
                k["seniorite"] = True
                trouve.append(SENIORITES[x["seniorite"]]["nom"].lower())
            elif not k["motivation"] and x.get("motivation"):
                k["motivation"] = True
                trouve.append(f"motivé par {MOTIVATIONS[x['motivation']]['nom'].lower()}")
            else:
                break
            if not tout:
                break
        if k["traits"] == len(x["traits"]):
            k["indice"] = None
        return ", ".join(trouve) or None

    def _action_personnel(self, genre, p):
        """Renvoie True si l'action a été traitée ici."""
        e = self.etat
        if genre == "entretien":
            c = next((x for x in e["candidats"] if x["id"] == p.get("id")), None)
            if not c:
                raise ErreurJeu("Candidat introuvable.")
            k = c["connu"]
            if k["seniorite"] and k["motivation"]:
                raise ErreurJeu("Entretien déjà passé.")
            self._payer(COUT_ENTRETIEN)
            k["seniorite"] = k["motivation"] = True
            caches = c["traits"][k["traits"]:]
            if caches:  # une impression, juste trois fois sur quatre
                faux = [t for t in sorted(TRAITS) if t not in c["traits"]]
                k["indice"] = self.rng.choice(caches) if self.rng.random() < 0.75 else self.rng.choice(faux)
            self._log(f"Entretien avec {c['nom']} : {SENIORITES[c['seniorite']]['nom'].lower()}, motivé par {MOTIVATIONS[c['motivation']]['nom'].lower()}.", "info")
        elif genre == "specialiste":
            x = next((y for y in e["candidats"] + e["employes"] if y["id"] == p.get("id")), None)
            if not x:
                raise ErreurJeu("Personne introuvable.")
            if not self._reveler(dict(x, connu=dict(x["connu"])), tout=True):
                raise ErreurJeu(f"On sait déjà tout de {x['nom']}.")
            self._payer(self.cout_specialiste())
            self._log(f"Le cabinet de recrutement a cerné {x['nom']} : {self._reveler(x, tout=True)}.", "info")
        else:
            return False
        return True

    # ------------------------------------------------------------------ au travail
    def _contexte(self, emp, p, equipe):
        """Effet du contexte sur la vitesse : chef présent, taille de l'équipe, pression du délai."""
        t, f = emp["traits"], 1.0
        chef = bool(p.get("chef")) and p["chef"] != emp["id"]  # un chef de projet suit ce projet
        if "autonome" in t and not chef:
            f *= 1.08
        if "encadrement" in t:
            f *= 1.1 if chef else 0.85
        if "solitaire" in t:
            f *= 1.1 if len(equipe) <= 2 else 0.9 if len(equipe) >= 4 else 1.0
        if "stresse" in t and self._sous_pression(p):
            f *= 0.85
        return f

    @staticmethod
    def _sous_pression(p):
        return p["type"] == "contrat" and p["delai"] - p["jours"] < 10

    def _facteur_defauts_emp(self, emp, p):
        return self._trait(emp, "defauts") * SENIORITES[emp["seniorite"]]["defauts"] * (1.2 if "stresse" in emp["traits"] and self._sous_pression(p) else 1.0)

    def _affinites(self, equipe, p=None):
        """Les collègues qui s'entendent travaillent mieux ensemble ; un chef de projet apaise les conflits."""
        e, f = self.etat, 1.0
        chef = bool(p and p.get("chef"))
        for i, a in enumerate(equipe):
            for b in equipe[i + 1:]:
                k = paire(a["id"], b["id"])
                v = e["affinites"].get(k)
                if not v:
                    continue
                if k not in e["affinites_connues"]:
                    e["affinites_connues"].append(k)
                    self._log(f"{a['nom']} et {b['nom']} " + ("s'entendent à merveille." if v > 0 else "ne se supportent pas…"), "bon" if v > 0 else "mauvais")
                f *= 1.03 if v > 0 else 0.975 if chef else 0.95
        return f

    def _mult_chef(self, p):
        """Bonus du chef de projet qui suit ce projet : sa gestion, son leadership, son bureau ; partagé entre ses projets."""
        c = next((x for x in self.etat["employes"] if x["id"] == p.get("chef")), None)
        if not c:
            return 1.0
        return 1 + (0.06 + 0.01 * self.metier(c, "gestion")) * (1.5 if "leader" in c["traits"] else 1) \
            * (1.5 if self.roles()["pieces"].get(c["id"]) == "cdp" else 1) * p.get("suivi", 0)

    # ------------------------------------------------------------------ chaque jour, chaque mois
    def _jour_personnel(self):
        e, r = self.etat, self.rng
        for x in e["employes"]:
            if x["absent"]:
                continue
            x["surmenage"] = x["surmenage"] + 1 if x["fatigue"] >= 45 else max(0, x["surmenage"] - 1)
            if x["surmenage"] >= SEUIL_SURMENAGE:
                x.update(absent=DUREE_BURNOUT, absence="burnout", surmenage=0, humeur=borne(x["humeur"] - 4, -8, 8))
                self._log(f"Burn-out : {x['nom']} est arrêté {DUREE_BURNOUT} jours. Trop de fatigue trop longtemps.", "mauvais")
            elif r.random() < 0.0015:
                x.update(absent=r.randint(2, 5), absence="maladie")
                self._log(f"{x['nom']} est malade, arrêt de {x['absent']} jours.", "info")
        if not e["evenement"]:
            for x in e["employes"]:
                if not x.get("fondateur") and not x.get("stage") and e["jours_total"] >= x["prochain_entretien"]:
                    x["prochain_entretien"] += JOURS_AN
                    e["evenement"] = self._entretien(x)
                    break

    def _mois_personnel(self):
        for x in self.etat["employes"]:
            if not x.get("fondateur") and not x.get("stage"):
                x["humeur"] = borne(x["humeur"] + (1 if self.satisfait(x) else -1), -8, 8)
            if self.rng.random() < 0.25:
                trouve = self._reveler(x)
                if trouve:
                    self._log(f"On apprend à connaître {x['nom']} : {trouve}.", "info")

    def _entretien(self, x):
        cible, nom = x["seniorite"] + 1, x["nom"]
        ev = {"type": "entretien", "titre": f"Entretien annuel de {nom}", "employe": x["id"]}
        if cible < len(SENIORITES) and self.seniorite_possible(x) >= cible:
            hausse = SENIORITES[cible]["prime"] - SENIORITES[x["seniorite"]]["prime"]
            statut = SENIORITES[cible]["nom"].lower()
            return {**ev, "demande": "promotion", "hausse": hausse, "texte": f"{nom} estime mériter le statut {statut}.",
                    "options": [f"Le passer {statut} (+{hausse} €/mois)", "Pas cette année"]}
        if x["motivation"] == "salaire" or "ambitieux" in x["traits"]:
            hausse = int(round(x["salaire"] * 0.06, -1))
            return {**ev, "demande": "augmentation", "hausse": hausse, "texte": f"{nom} demande une augmentation de 6 %.",
                    "options": [f"Accepter (+{hausse} €/mois)", "Refuser"]}
        if x["motivation"] == "formation" and not x["absent"]:
            cout = self.cout_formation(x)
            return {**ev, "demande": "formation", "cout": cout, "texte": f"{nom} aimerait suivre une formation cette année.",
                    "options": [f"L'envoyer en formation (−{cout:,} €)".replace(",", " "), "Plus tard"]}
        return {**ev, "demande": "point", "texte": f"Bilan de l'année avec {nom} : tout va bien.", "options": ["Le féliciter"]}

    def _evenements_personnel(self, possibles):
        presents = [x for x in self.etat["employes"] if not x["absent"] and not x.get("stage")]
        if presents:
            x = self.rng.choice(presents)
            possibles.append({"type": "naissance", "titre": "Heureux évènement", "employe": x["id"],
                              "texte": f"{x['nom']} va être parent ! Dix jours de congé à prévoir.",
                              "options": ["Félicitations !", f"Offrir un cadeau de l'équipe (−300 €)"]})

    def _resoudre_personnel(self, ev, choix):
        """Renvoie True si l'évènement a été traité ici."""
        t = ev["type"]
        if t not in ("entretien", "naissance"):
            return False
        x = next((y for y in self.etat["employes"] if y["id"] == ev["employe"]), None)
        if not x:
            return True
        if t == "naissance":
            if choix == 1:
                self._payer(300)
                x["humeur"] = borne(x["humeur"] + 4, -8, 8)
            if not x["absent"]:
                x.update(absent=10, absence="naissance")
            return True
        d = ev["demande"]
        if choix == 1:  # refus
            x["humeur"] = borne(x["humeur"] - (6 if "ambitieux" in x["traits"] else 3), -8, 8)
            return True
        if d in ("promotion", "augmentation"):
            x["salaire"] += ev["hausse"]
            x["humeur"] = borne(x["humeur"] + 3, -8, 8)
            if d == "promotion":
                x["seniorite"] = x["annonce"] = x["seniorite"] + 1
                x["connu"]["seniorite"] = True
                self._log(f"{x['nom']} passe {SENIORITES[x['seniorite']]['nom'].lower()} !", "bon")
        elif d == "formation":
            self._payer(ev["cout"])
            x["humeur"] = borne(x["humeur"] + 2, -8, 8)
            if not x["absent"]:
                dom = max(DOMAINES, key=lambda k: x[k])
                x.update(absent=10, absence="formation", formation=dom, derniere_formation=self.etat["jours_total"])
        else:
            x["humeur"] = borne(x["humeur"] + 2, -8, 8)
        return True

    # ------------------------------------------------------------------ vue (ce qu'on ne sait pas reste caché)
    def _public(self, x):
        k = x["connu"]
        v = {**x, "traits": x["traits"][:k["traits"]], "traits_caches": len(x["traits"]) - k["traits"],
             "metier": {m: None if m == x["cachee"] and not k["cachee"] else n for m, n in x["metier"].items()},
             "motivation": x.get("motivation") if k["motivation"] else None, "seniorite": x["seniorite"] if k["seniorite"] else x["annonce"],
             "seniorite_sure": k["seniorite"], "entretien_fait": k["seniorite"] and k["motivation"], "indice": k["indice"]}
        for cle in ("cachee", "annonce", "connu"):
            v.pop(cle)
        return v

    def vue_personnel(self, v):
        e = self.etat
        noms = {x["id"]: x["nom"] for x in e["employes"]}
        v["candidats"] = [self._public(c) for c in e["candidats"]]
        emps = []
        for x, vx in zip(e["employes"], v["employes"]):
            pub = {**vx, **self._public(x), "anciennete": round(self.anciennete(x), 1), "satisfait": self.satisfait(x) if x["connu"]["motivation"] else None}
            amis, froid = [], []
            for k in e["affinites_connues"]:
                a, b = map(int, k.split("-"))
                autre = b if a == x["id"] else a if b == x["id"] else None
                if autre in noms:
                    (amis if e["affinites"][k] > 0 else froid).append(noms[autre])
            pub["amis"], pub["froid"] = amis, froid
            emps.append(pub)
        v["employes"] = emps
        v["cout_specialiste"] = self.cout_specialiste()
        return v
