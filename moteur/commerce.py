"""Commerce : prospection par canaux (plateformes, réseaux, démarchage, salons), pistes, devis mis en concurrence avec les rivaux."""
from .donnees import CANAUX, CONCURRENTS, DEVIS_DELAIS, DEVIS_PRIX, SALONS, SECTEURS
from .extensions import ErreurJeu

STYLES = {c["nom"]: c for c in CONCURRENTS}
STYLE_NEUTRE = {"style": "", "prix": 1.0, "delai": 1.0, "secteurs": []}
PROD_PROSPECTION = 0.5  # part de sa production que garde celui qui prospecte
RAISONS = {"prix": "trop cher", "delai": "délai trop long", "renommee": "pas assez connu"}


def rival(c):
    """Un rival en début de partie (état qui évolue : renommée, équipe, contrats gagnés)."""
    return {"nom": c["nom"], "renommee": c["renommee"], "equipe": c["equipe"], "gagnes": 0}


class Commerce:
    def _init_commerce(self):
        e = self.etat
        for cle in ("pistes", "devis", "prospections"):
            e.setdefault(cle, [])
        e.pop("prospection", None)  # ancien secteur visé par les commerciaux : remplacé par le démarchage
        for c in e["concurrents"]:
            c.setdefault("equipe", STYLES.get(c["nom"], {}).get("equipe", 3))
            c.setdefault("gagnes", 0)
        if not e.get("rivaux_v2"):  # anciennes parties : le quatrième rival arrive
            e["rivaux_v2"] = True
            noms = {c["nom"] for c in e["concurrents"]}
            e["concurrents"] += [rival(c) for c in CONCURRENTS if c["nom"] not in noms and c["nom"] == "Onde & Signal"]

    # ------------------------------------------------------------------ prospection
    def prospecteurs(self):
        """Le fondateur et les commerciaux présents."""
        return [x for x in self.etat["employes"] if (x.get("fondateur") or x.get("commercial")) and not x["absent"]]

    def en_prospection(self, emp):
        return any(pr["qui"] == emp["id"] for pr in self.etat["prospections"])

    def facteur_prospection(self, emp):
        return PROD_PROSPECTION if self.en_prospection(emp) else 1

    def salon_du_mois(self):
        """Nom du salon de ce mois-ci s'il n'est pas déjà fait, sinon None."""
        e = self.etat
        return SALONS.get(e["mois"]) if e.get("dernier_salon") != f"{e['annee']}-{e['mois']}" else None

    def _prospecter(self, p):
        e = self.etat
        k = p.get("canal")
        if k not in CANAUX:
            raise ErreurJeu("Canal de prospection inconnu.")
        qui = next((x for x in self.prospecteurs() if x["id"] == p.get("qui")), None)
        if not qui:
            raise ErreurJeu("Seuls le fondateur et les commerciaux présents prospectent.")
        if self.en_prospection(qui):
            raise ErreurJeu(f"{qui['nom']} prospecte déjà.")
        secteur = p.get("secteur") if k == "demarchage" else None
        if k == "demarchage" and secteur not in SECTEURS:
            raise ErreurJeu("Choisissez le secteur à démarcher.")
        salon = self.salon_du_mois()
        if k == "salon" and not salon:
            raise ErreurJeu("Pas de salon ce mois-ci.")
        if CANAUX[k]["cout"]:  # les canaux gratuits restent ouverts même dans le rouge
            self._payer(CANAUX[k]["cout"])
        if k == "salon":
            e["dernier_salon"] = f"{e['annee']}-{e['mois']}"
        e["prospections"].append({"canal": k, "qui": qui["id"], "jours": CANAUX[k]["jours"], "secteur": secteur})
        quoi = salon if k == "salon" else CANAUX[k]["nom"] + (f" ({SECTEURS[secteur]['nom']})" if secteur else "")
        self._log(f"{qui['nom']} prospecte : {quoi}, {CANAUX[k]['jours']} jours.", "info")

    def _fin_prospection(self, pr, qui):
        e, r, c = self.etat, self.rng, CANAUX[pr["canal"]]
        reussite = c["reussite"] + 0.05 * self.metier(qui, "commercial") + (0.03 * min(10, e["renommee"]) if pr["canal"] == "reseaux" else 0)
        n = sum(r.random() < min(0.95, reussite) for _ in range(r.randint(*c["pistes"])))
        for _ in range(n):
            o = {**self._offre(bonus_rep=c["bonus_rep"], secteur=pr["secteur"]), "canal": pr["canal"]}
            if c["devis"]:
                o["expire"] = r.randint(4, 7)
                o["rivaux"] = [x["nom"] for x in e["concurrents"] if r.random() < min(0.7, c["rivaux"] + 0.03 * x["equipe"])]
                e["pistes"].append(o)
            else:
                o["expire"], o["reservee"] = r.randint(5, 8), True
                e["offres"].append(o)
        if pr["canal"] == "salon":
            e["renommee"] += 1
        suite = "à chiffrer dans Commerce" if c["devis"] else "réservée(s) pour vous dans Projets"
        self._log(f"Prospection de {qui['nom']} : " + (f"{n} piste(s) {suite}." if n else "aucune piste cette fois."), "bon" if n else "info")

    # ------------------------------------------------------------------ devis
    def _envoyer_devis(self, p):
        e = self.etat
        o = next((x for x in e["pistes"] if x["id"] == p.get("id")), None)
        if not o:
            raise ErreurJeu("Cette piste n'est plus disponible.")
        prix, delai = str(p.get("prix", "1.0")), str(p.get("delai", "1.0"))
        if prix not in DEVIS_PRIX or delai not in DEVIS_DELAIS:
            raise ErreurJeu("Paramètres invalides.")
        e["pistes"].remove(o)
        e["devis"].append({**o, "prix": prix, "delai_devis": delai, "reponse": self.rng.randint(2, 4)})
        self._log(f"Devis envoyé à {o['client']} pour « {o['nom']} » : réponse dans quelques jours.", "info")

    def _decider_devis(self, d):
        """Le client compare votre devis à ceux des rivaux consultés : prix, délai, renommée (et un peu de hasard)."""
        e, r = self.etat, self.rng
        moi = {"prix": -2.6 * (float(d["prix"]) - 1), "delai": -0.6 * (float(d["delai_devis"]) - 1),
               "renommee": 0.02 * e["renommee"] + 0.01 * self.meilleur_metier("commercial")}
        meilleur, score, parts = None, sum(moi.values()) + r.uniform(-0.2, 0.2), None
        for c in e["concurrents"]:
            if c["nom"] not in d["rivaux"]:
                continue  # pas consulté, ou racheté entre-temps
            s = STYLES.get(c["nom"], STYLE_NEUTRE)
            lui = {"prix": -2.6 * (s["prix"] - 1), "delai": -0.6 * (s["delai"] - 1),
                   "renommee": 0.02 * c["renommee"] + (0.15 if d["secteur"] in s["secteurs"] else 0)}
            sc = sum(lui.values()) + r.uniform(-0.2, 0.2)
            if sc > score:
                meilleur, score, parts = c, sc, lui
        if not meilleur and r.random() >= self.chance_negociation(float(d["prix"]), float(d["delai_devis"]), d.get("fidele", 0)):
            self._log(f"Devis refusé : {d['client']} trouve « {d['nom']} » trop cher pour son budget.", "mauvais")
            return
        if meilleur:
            k = min(moi, key=lambda k: moi[k] - parts[k])
            self._rival_gagne(meilleur)
            self._log(f"Devis perdu : {meilleur['nom']} remporte « {d['nom']} » ({RAISONS[k] if moi[k] - parts[k] < -0.05 else 'de peu'}).", "mauvais")
            return
        o = {k: v for k, v in d.items() if k not in ("prix", "delai_devis", "reponse", "rivaux")}
        o.update(paie=int(round(d["paie"] * float(d["prix"]), -2)), delai=max(8, round(d["delai"] * float(d["delai_devis"]))), expire=10, gagne=True)
        e["offres"].append(o)
        self._log(f"Devis accepté par {o['client']} : « {o['nom']} », à signer dans Projets.", "bon")

    def _rival_gagne(self, c):
        """Un rival qui vous prend des marchés grandit : renommée et équipe tous les huit."""
        c["gagnes"] = c.get("gagnes", 0) + 1
        if c["gagnes"] % 8 == 0:
            c["renommee"] += 1
            c["equipe"] = c.get("equipe", 3) + 1

    # ------------------------------------------------------------------ tour de jeu, actions, vue
    def _jour_commerce(self):
        e = self.etat
        for pr in list(e["prospections"]):
            pr["jours"] -= 1
            if pr["jours"] <= 0:
                e["prospections"].remove(pr)
                qui = next((x for x in e["employes"] if x["id"] == pr["qui"]), None)
                if qui:  # parti entre-temps : rien
                    self._fin_prospection(pr, qui)
        for o in list(e["pistes"]):
            o["expire"] -= 1
            if o["expire"] <= 0:
                e["pistes"].remove(o)
        for d in list(e["devis"]):
            d["reponse"] -= 1
            if d["reponse"] <= 0:
                e["devis"].remove(d)
                self._decider_devis(d)

    def _action_commerce(self, genre, p):
        if genre == "prospecter":
            self._prospecter(p)
        elif genre == "devis":
            self._envoyer_devis(p)
        else:
            return False
        return True

    def vue_commerce(self, v):
        e = self.etat
        salon = self.salon_du_mois()
        v["canaux"] = {k: {**c, "salon": salon if k == "salon" else None, "dispo": k != "salon" or bool(salon)} for k, c in CANAUX.items()}
        v["prochain_salon"] = next((SALONS[m % 12] for m in range(e["mois"] + 1, e["mois"] + 13) if m % 12 in SALONS), None)
        v["prospecteurs"] = [{"id": x["id"], "nom": x["nom"], "commercial": self.metier(x, "commercial"), "occupe": self.en_prospection(x)}
                             for x in self.prospecteurs()]
        v["devis_prix"], v["devis_delais"] = DEVIS_PRIX, DEVIS_DELAIS
        for x in v["employes"]:
            x["prospecte"] = self.en_prospection(x)
        for c in v["classement"]:
            c["style"] = "" if c.get("vous") else STYLES.get(c["nom"], STYLE_NEUTRE)["style"]
        return v
