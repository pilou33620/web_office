"""Extensions du moteur : choix techniques, R&D, certifications, SAV, négociation, concurrence, séries,
fournisseurs, prêts et investisseurs, carrières, vie d'équipe, météo, scénarios et difficulté."""
from .donnees import (CERTIFS, CHOIX_TECH, CONCURRENTS, DIFFICULTES, ENTRETIEN_CERTIF, FOURNISSEURS, METEO, PRETS,
                      PRIMES, SAISONS, SCENARIOS, TAUX_PRET, TECHNOS)

DUREE_GARANTIE = 120
DUREE_STAGE = 90
DELAI_SEMINAIRE = 180


def _borne(x, lo, hi):
    return max(lo, min(hi, x))


class Extensions:
    # ------------------------------------------------------------------ mise en place
    def _init_extensions(self, scenario="garage", difficulte="normal"):
        e = self.etat
        if scenario not in SCENARIOS or difficulte not in DIFFICULTES:
            from .jeu import ErreurJeu
            raise ErreurJeu("Scénario ou difficulté inconnu.")
        e.setdefault("scenario", scenario)
        e.setdefault("difficulte", difficulte)
        for cle, val in (("technos", []), ("certifs", []), ("recherches", []), ("garanties", []), ("series", []),
                         ("prets", []), ("fournisseur", "europe"), ("parts", 1.0), ("meteo", "soleil"), ("fete", None),
                         ("dernier_seminaire", -999), ("victoire", None), ("objectif", None), ("offre_serie", None)):
            e.setdefault(cle, val)
        if not e.get("concurrents"):
            e["concurrents"] = [{"nom": n, "renommee": r} for n, r in CONCURRENTS]
        for x in e["employes"]:
            self._completer_employe(x)

    def _completer_employe(self, x):
        x.setdefault("anniv", [self.rng.randint(0, 11), self.rng.randint(1, 30)])
        x.setdefault("chef", False)
        x.setdefault("stage", 0)
        x.setdefault("absence", None)

    def _appliquer_scenario(self):
        e = self.etat
        sc, diff = SCENARIOS[e["scenario"]], DIFFICULTES[e["difficulte"]]
        e["argent"] = int(sc.get("argent", 15000) * diff["argent"])
        e["renommee"] = sc.get("renommee", 0)
        e["technos"] = list(sc.get("technos", []))
        e["certifs"] = list(sc.get("certifs", []))
        e["objectif"] = sc.get("objectif")
        for lid in sc.get("locaux", []):
            e["locaux"].append(lid)
        for _ in range(sc.get("employes", 0)):
            c = self._candidat()
            libres = [b for b in self.postes_ouverts() if b not in {x["bureau"] for x in e["employes"]}]
            bureau = libres[0] if libres else self._ajouter_objet("poste", *self._place_auto("poste"))["id"]
            e["employes"].append({**c, "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 0, "absent": 0,
                                  "formation": None, "bureau": bureau, "fondateur": False, "tache": None, "gain": 0, "projet": None})
            self._completer_employe(e["employes"][-1])
        if sc.get("pret"):
            self._ajouter_pret(sc["pret"])
        e["exercice"] = self._exercice_vide()
        if e["scenario"] != "garage":
            self._log(f"Scénario « {sc['nom']} » : {sc['desc']}", "info")

    # ------------------------------------------------------------------ effets cumulés
    def _mod_bonus(self, b):
        if "ble" in self.etat["technos"]:
            b["f"] += 1
        if "rf" in self.etat["technos"]:
            b["cem"] += 0.05
        return b

    def _choix_effets(self, p, cle):
        return [CHOIX_TECH[k]["options"][v].get(cle) for k, v in p.get("choix", {}).items() if CHOIX_TECH[k]["options"][v].get(cle) is not None]

    def _note_bonus(self, p):
        e = self.etat
        return sum(self._choix_effets(p, "note")) + 0.2 * ("ia" in e["technos"]) + 0.2 * ("iso" in e["certifs"])

    def _cem_bonus(self, p):
        return sum(self._choix_effets(p, "cem"))

    def _facteur_defauts(self):
        e = self.etat
        f = FOURNISSEURS[e["fournisseur"]]["defauts"]
        return f * (0.85 if "iso" in e["certifs"] else 1) * (0.9 if "dfm" in e["technos"] else 1)

    def _facteur_proto(self, p):
        f = 1.0
        for x in self._choix_effets(p, "proto"):
            f *= x
        return f * FOURNISSEURS[self.etat["fournisseur"]]["proto"] * (0.7 if "dfm" in self.etat["technos"] else 1)

    def _facteur_paie(self, p):
        e = self.etat
        return (1.05 if "ce" in e["certifs"] else 1) * PRIMES.get(p.get("requis"), 1) * DIFFICULTES[e["difficulte"]]["paie"]

    def _mult_chef(self, actifs):
        return 1.08 if any(x.get("chef") for x in actifs) else 1.0

    def mensualites(self):
        return sum(x["mensualite"] for x in self.etat["prets"])

    def dette(self):
        return sum(x["mensualite"] * x["mois"] for x in self.etat["prets"])

    def plafond_pret(self):
        return 20000 + 8000 * self.etat["renommee"]

    # ------------------------------------------------------------------ choix techniques et négociation
    def _choix_valides(self, choix):
        from .jeu import ErreurJeu
        choix = choix if isinstance(choix, dict) else {}
        res = {}
        for k, cat in CHOIX_TECH.items():
            v = choix.get(k, cat["defaut"])
            opt = cat["options"].get(v)
            if not opt:
                raise ErreurJeu("Choix technique invalide.")
            if opt.get("requis") and opt["requis"] not in self.etat["technos"]:
                raise ErreurJeu(f"{opt['nom']} : il faut d'abord maîtriser {TECHNOS[opt['requis']]['nom']}.")
            res[k] = v
        return res

    def _appliquer_choix(self, base, choix):
        """Modifie les points à produire selon les choix ; renvoie le coût immédiat (moule d'injection)."""
        total = dict(base["total"])
        cout = 0
        for k, v in choix.items():
            opt = CHOIX_TECH[k]["options"][v]
            for d in ("e", "m", "f"):
                if d in opt:
                    total[d] = round(total[d] * opt[d])
            cout += opt.get("cout", 0)
        if base["total"]["m"] == 0 and choix.get("boitier") != CHOIX_TECH["boitier"]["defaut"]:
            choix["boitier"] = CHOIX_TECH["boitier"]["defaut"]  # pas de méca : le choix du boîtier ne s'applique pas
            return self._appliquer_choix(base, choix)
        base = {**base, "total": total, "taille": sum(total.values())}
        return base, cout

    def chance_negociation(self, prix, delai):
        """Au prix et au délai affichés, le client signe à coup sûr ; demander plus est un pari."""
        return round(_borne(1 - 2.6 * (prix - 1) - 0.6 * (delai - 1) + 0.01 * self.etat["renommee"], 0.05, 1.0), 2)

    # ------------------------------------------------------------------ R&D, certifications, prêts
    def _lancer_recherche(self, genre, rid):
        from .jeu import ErreurJeu
        e = self.etat
        cat, acquis = (TECHNOS, e["technos"]) if genre == "tech" else (CERTIFS, e["certifs"])
        f = cat.get(rid)
        if not f:
            raise ErreurJeu("Inconnu.")
        if rid in acquis:
            raise ErreurJeu("Déjà acquis.")
        if any(r["genre"] == genre for r in e["recherches"]):
            raise ErreurJeu("Une seule recherche de ce type à la fois." if genre == "tech" else "Un seul audit à la fois.")
        if f.get("requis") and f["requis"] not in (e["technos"] if genre == "tech" else e["certifs"]):
            raise ErreurJeu(f"Il faut d'abord : {cat[f['requis']]['nom']}.")
        self._payer(f["prix"])
        e["recherches"].append({"genre": genre, "id": rid, "jours": f["jours"], "total": f["jours"]})
        self._log(f"{'Recherche' if genre == 'tech' else 'Audit'} lancé : {f['nom']} ({f['jours']} jours).", "info")

    def _ajouter_pret(self, montant):
        mensualite = int(round(montant * (1 + TAUX_PRET * 2) / 24))
        self.etat["prets"].append({"montant": montant, "mensualite": mensualite, "mois": 24})
        self.etat["argent"] += montant

    # ------------------------------------------------------------------ actions du joueur
    def _action_extension(self, genre, p):
        """Renvoie True si l'action a été traitée ici."""
        from .jeu import ErreurJeu
        e = self.etat
        if genre == "recherche":
            self._lancer_recherche("tech", p.get("id"))
        elif genre == "certifier":
            self._lancer_recherche("certif", p.get("id"))
        elif genre == "fournisseur":
            if p.get("id") not in FOURNISSEURS:
                raise ErreurJeu("Fournisseur inconnu.")
            e["fournisseur"] = p["id"]
            self._log(f"Nouveau fournisseur : {FOURNISSEURS[p['id']]['nom']}.", "info")
        elif genre == "emprunter":
            m = p.get("montant")
            if m not in PRETS:
                raise ErreurJeu("Montant inconnu.")
            if self.dette() + m * (1 + TAUX_PRET * 2) > self.plafond_pret() * (1 + TAUX_PRET * 2):
                raise ErreurJeu(f"La banque refuse : plafond d'endettement {self.plafond_pret():,} € (selon la renommée).".replace(",", " "))
            self._ajouter_pret(m)
            self._log(f"Prêt de {m:,} € accordé sur 24 mois.".replace(",", " "), "info")
        elif genre == "rembourser":
            if not e["prets"]:
                raise ErreurJeu("Aucun prêt en cours.")
            reste = sum(x["montant"] // 24 * x["mois"] for x in e["prets"])  # capital restant, sans les intérêts futurs
            if e["argent"] < reste:
                raise ErreurJeu("Trésorerie insuffisante pour rembourser.")
            e["argent"] -= reste
            e["prets"] = []
            self._log(f"Prêts remboursés par anticipation (−{reste:,} €).".replace(",", " "), "bon")
        elif genre == "lever":
            if e["parts"] < 1:
                raise ErreurJeu("Vous avez déjà ouvert votre capital.")
            if e["renommee"] < 5:
                raise ErreurJeu("Les investisseurs attendent 5 de renommée.")
            montant = 60000 + 15000 * e["renommee"]
            e["argent"] += montant
            e["parts"] = 0.8
            self._log(f"Levée de fonds : +{montant:,} € contre 20 % du capital (score final ×0,8).".replace(",", " "), "bon")
        elif genre == "promouvoir":
            emp = self.employe(p.get("id"))
            if emp.get("chef"):
                raise ErreurJeu("Déjà chef de projet.")
            if emp["e"] + emp["m"] + emp["f"] < 14:
                raise ErreurJeu("Il faut 14 points de compétences au total pour devenir chef de projet.")
            if emp.get("stage"):
                raise ErreurJeu("Un stagiaire ne peut pas être promu.")
            emp["chef"] = True
            if not emp.get("fondateur"):
                emp["salaire"] += 600
            emp["humeur"] = min(8, emp["humeur"] + 4)
            self._log(f"{emp['nom']} devient chef de projet !", "bon")
        elif genre == "seminaire":
            if e["jours_total"] - e["dernier_seminaire"] < DELAI_SEMINAIRE:
                raise ErreurJeu("Un séminaire tous les 6 mois maximum.")
            presents = [x for x in e["employes"] if not x["absent"]]
            self._payer(1000 + 300 * len(presents))
            for x in presents:
                x["absent"], x["absence"], x["fatigue"] = 2, "seminaire", 0
                x["humeur"] = min(8, x["humeur"] + 6)
            e["dernier_seminaire"] = e["jours_total"]
            self._log("Séminaire d'équipe : deux jours au vert, tout le monde revient regonflé.", "bon")
        elif genre == "fermer_victoire":
            if e.get("victoire"):
                e["victoire"]["vue"] = True
        else:
            return False
        return True

    # ------------------------------------------------------------------ chaque jour
    def _debut_jour_extensions(self):
        e, r = self.etat, self.rng
        saison = SAISONS[e["mois"]]
        tirage, cumul = r.random(), 0.0
        for nom, pr in METEO[saison].items():
            cumul += pr
            if tirage < cumul:
                e["meteo"] = nom
                break
        e["fete"] = None
        if e.get("pot"):
            e["fete"] = {"type": "pot"}
            e.pop("pot")
            for x in e["employes"]:
                x["humeur"] = min(8, x["humeur"] + 2)
        for x in e["employes"]:
            if x.get("anniv") == [e["mois"], e["jour"]] and not x["absent"]:
                e["fete"] = {"type": "anniv", "nom": x["nom"]}
                x["humeur"] = min(8, x["humeur"] + 4)
                self._log(f"Joyeux anniversaire {x['nom']} ! Gâteau pour tout le monde.", "bon")

    def _fin_jour_extensions(self):
        e, r = self.etat, self.rng
        for rech in list(e["recherches"]):
            rech["jours"] -= 1
            if rech["jours"] <= 0:
                e["recherches"].remove(rech)
                if rech["genre"] == "tech":
                    e["technos"].append(rech["id"])
                    self._log(f"Nouvelle technologie maîtrisée : {TECHNOS[rech['id']]['nom']} !", "bon")
                else:
                    e["certifs"].append(rech["id"])
                    self._log(f"Certification obtenue : {CERTIFS[rech['id']]['nom']} !", "bon")
        for g in list(e["garanties"]):
            g["jours"] -= 1
            if g["jours"] <= 0:
                e["garanties"].remove(g)
            elif not e["evenement"] and r.random() < g["defauts"] * 0.003:
                e["garanties"].remove(g)
                cout = int(round(500 + 400 * g["defauts"], -1))
                e["evenement"] = {"type": "sav", "titre": "Retour SAV",
                                  "texte": f"{g['client']} signale des pannes sur « {g['nom']} », encore sous garantie.",
                                  "options": [f"Corriger gratuitement (−{cout:,} €)".replace(",", " "), "Refuser la prise en charge (renommée −2)"],
                                  "cout": cout}
        fort = max(c["renommee"] for c in e["concurrents"])
        for o in list(e["offres"]):
            if r.random() < 0.004 + 0.0008 * fort:  # plus la concurrence est connue, plus elle rafle de marchés
                c = r.choices(e["concurrents"], weights=[1 + c["renommee"] for c in e["concurrents"]])[0]
                e["offres"].remove(o)
                self._log(f"{c['nom']} remporte l'appel d'offres « {o['nom']} ».", "info")
        for x in list(e["employes"]):
            if x.get("stage"):
                x["stage"] -= 1
                if x["stage"] <= 0:
                    if e["evenement"]:
                        x["stage"] = 1  # on attend que l'évènement en cours soit réglé
                    else:
                        salaire = int(round(900 + 230 * (x["e"] + x["m"] + x["f"]), -1))
                        e["evenement"] = {"type": "fin_stage", "titre": "Fin de stage", "employe": x["id"], "salaire": salaire,
                                          "texte": f"Le stage de {x['nom']} se termine. L'embaucher ?",
                                          "options": [f"L'embaucher ({salaire:,} €/mois)".replace(",", " "), "Lui dire au revoir"]}
        if e.get("offre_serie") and not e["evenement"]:
            s = e.pop("offre_serie")
            e["evenement"] = {"type": "serie", "titre": "Commande de série", "serie": s,
                              "texte": f"{s['client']} veut produire « {s['nom']} » en série pendant {s['mois']} mois. Vous touchez une marge sur chaque lot.",
                              "options": [f"Accepter (~{s['marge']:,} €/mois)".replace(",", " "), "Décliner"]}
        self._verifier_objectif()

    def _mois_extensions(self):
        """Renvoie (recettes, dépenses, texte) du mois pour les séries, prêts et certifications."""
        e, r = self.etat, self.rng
        recettes, depenses, morceaux = 0, 0, []
        f = FOURNISSEURS[e["fournisseur"]]
        for s in list(e["series"]):
            if r.random() < f["risque"]:
                self._log(f"Rupture de composants : pas de lot ce mois-ci pour « {s['nom']} ».", "mauvais")
            else:
                recettes += int(s["marge"] * f["serie"])
            s["mois"] -= 1
            if s["mois"] <= 0:
                e["series"].remove(s)
                self._log(f"Fin de la production en série de « {s['nom']} ».", "info")
        if recettes:
            morceaux.append(f"séries +{recettes:,} €".replace(",", " "))
        capital = 0
        for pret in list(e["prets"]):
            part_capital = pret["montant"] // 24
            capital += part_capital
            depenses += pret["mensualite"] - part_capital  # seuls les intérêts sont des charges déductibles
            pret["mois"] -= 1
            if pret["mois"] <= 0:
                e["prets"].remove(pret)
                self._log(f"Prêt de {pret['montant']:,} € entièrement remboursé.".replace(",", " "), "bon")
        if capital:
            morceaux.append(f"prêts −{capital + depenses:,} €".replace(",", " "))
        certifs = ENTRETIEN_CERTIF * len(e["certifs"])
        if certifs:
            depenses += certifs
            morceaux.append(f"audits −{certifs:,} €".replace(",", " "))
        for c in e["concurrents"]:
            c["renommee"] += r.choice([0, 0, 0, 1])
        return recettes, depenses, morceaux, capital

    # ------------------------------------------------------------------ livraisons et évènements
    def _apres_livraison(self, p, note, montant):
        e, r = self.etat, self.rng
        if p["type"] == "contrat" and p["defauts"] >= 0.3:
            e["garanties"].append({"nom": p["nom"], "client": p["client"], "defauts": round(p["defauts"], 1), "jours": DUREE_GARANTIE})
        if note >= 7:
            e["pot"] = True
        if p["type"] == "contrat" and note >= 7 and len(e["series"]) < 4 and r.random() < 0.35:
            e["offre_serie"] = {"nom": p["nom"], "client": p["client"], "mois": r.randint(6, 18),
                                "marge": int(round(p["paie"] * 0.06 * note / 8, -1))}

    def _evenements_extensions(self, possibles):
        e, r = self.etat, self.rng
        stars = [x for x in e["employes"] if not x.get("fondateur") and not x.get("stage") and x["e"] + x["m"] + x["f"] >= 12]
        if stars:
            x = r.choice(stars)
            c = max(e["concurrents"], key=lambda c: c["renommee"])
            possibles.append({"type": "debauche", "titre": "Tentative de débauchage", "employe": x["id"],
                              "texte": f"{c['nom']} propose un pont d'or à {x['nom']}.",
                              "options": ["Contre-offre (+15 % de salaire)", "Le laisser partir"]})
        libres = [b for b in self.postes_ouverts() if b not in {x["bureau"] for x in e["employes"]}]
        if libres:
            possibles.append({"type": "stage", "titre": "Stagiaire d'école d'ingénieurs",
                              "texte": "Une école propose un stagiaire gratuit pendant 3 mois.",
                              "options": ["L'accueillir", "Pas maintenant"]})
        if e["series"]:
            s = r.choice(e["series"])
            cout = int(round(2000 + s["marge"] * 2, -1))
            possibles.append({"type": "obsolescence", "titre": "Composant obsolète", "serie": s["nom"],
                              "texte": f"Un composant clé de « {s['nom']} » n'est plus fabriqué.",
                              "options": [f"Redessiner la carte (−{cout:,} €)".replace(",", " "), "Arrêter la série"], "cout": cout})

    def _resoudre_extension(self, ev, choix):
        """Renvoie True si l'évènement a été traité ici."""
        e = self.etat
        t = ev["type"]
        if t == "sav":
            if choix == 0:
                self._payer(ev["cout"])
            else:
                e["renommee"] = max(0, e["renommee"] - 2)
        elif t == "serie":
            if choix == 0:
                e["series"].append(dict(ev["serie"]))
        elif t == "debauche":
            x = next((y for y in e["employes"] if y["id"] == ev["employe"]), None)
            if x and choix == 0:
                x["salaire"] = int(round(x["salaire"] * 1.15, -1))
                x["humeur"] = min(8, x["humeur"] + 3)
            elif x:
                e["employes"].remove(x)
                self._log(f"{x['nom']} part chez la concurrence.", "mauvais")
        elif t == "stage" and choix == 0:
            libres = [b for b in self.postes_ouverts() if b not in {x["bureau"] for x in e["employes"]}]
            if libres:
                c = self._candidat()
                c.update(poste="Stagiaire d'école", salaire=0, e=max(1, c["e"] // 2), m=max(0, c["m"] // 2), f=max(1, c["f"] // 2))
                e["employes"].append({**c, "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 2, "absent": 0, "formation": None,
                                      "bureau": libres[0], "fondateur": False, "tache": None, "gain": 0, "projet": None})
                self._completer_employe(e["employes"][-1])
                e["employes"][-1]["stage"] = DUREE_STAGE
                self._log(f"{c['nom']} arrive en stage pour 3 mois.", "bon")
        elif t == "fin_stage":
            x = next((y for y in e["employes"] if y["id"] == ev["employe"]), None)
            if x and choix == 0:
                x.update(stage=0, salaire=ev["salaire"], poste="Ingé junior")
            elif x:
                e["employes"].remove(x)
                self._log(f"Fin de stage pour {x['nom']}. Bonne route !", "info")
        elif t == "obsolescence":
            s = next((y for y in e["series"] if y["nom"] == ev["serie"]), None)
            if s and choix == 0:
                self._payer(ev["cout"])
            elif s:
                e["series"].remove(s)
        else:
            return False
        return True

    # ------------------------------------------------------------------ objectifs de scénario
    def _verifier_objectif(self):
        e = self.etat
        obj = e.get("objectif")
        if not obj or e.get("victoire"):
            return
        t = obj["type"]
        if t == "produits":
            ok = e["stats"]["produits_lances"] >= obj["n"]
        elif t == "aero":
            ok = "aero" in e["certifs"] and e["renommee"] >= obj["n"]
        else:
            ok = e["argent"] >= obj["n"] and not e["prets"]
        if ok:
            e["victoire"] = {"ok": True, "vue": False, "texte": f"Objectif du scénario « {SCENARIOS[e['scenario']]['nom']} » atteint !"}
            self._log(e["victoire"]["texte"], "trophee")
        elif e["jours_total"] >= obj["ans"] * 360:
            e["victoire"] = {"ok": False, "vue": False, "texte": "Le délai du scénario est écoulé sans atteindre l'objectif. Vous pouvez continuer à jouer."}
            self._log(e["victoire"]["texte"], "mauvais")

    def progres_objectif(self):
        e = self.etat
        obj = e.get("objectif")
        if not obj:
            return None
        t = obj["type"]
        if t == "produits":
            txt = f"Produits lancés : {e['stats']['produits_lances']} / {obj['n']}"
        elif t == "aero":
            txt = f"EN 9100 : {'oui' if 'aero' in e['certifs'] else 'non'} · renommée {e['renommee']} / {obj['n']}"
        else:
            txt = f"Trésorerie {int(e['argent']):,} / {obj['n']:,} € · prêts restants : {len(e['prets'])}".replace(",", " ")
        reste = max(0, obj["ans"] * 360 - e["jours_total"]) // 30
        return {"texte": txt, "mois_restants": reste, "scenario": SCENARIOS[e["scenario"]]["nom"]}

    def vue_extensions(self, v):
        e = self.etat
        v["classement"] = sorted([{"nom": "Votre bureau", "renommee": e["renommee"], "vous": True}] +
                                 [dict(c) for c in e["concurrents"]], key=lambda c: -c["renommee"])
        v["mensualites"] = self.mensualites()
        v["dette"] = self.dette()
        v["plafond_pret"] = self.plafond_pret()
        v["saison"] = SAISONS[e["mois"]]
        v["progres_objectif"] = self.progres_objectif()
        v["seminaire_dans"] = max(0, DELAI_SEMINAIRE - (e["jours_total"] - e["dernier_seminaire"]))
        v["cout_seminaire"] = 1000 + 300 * len([x for x in e["employes"] if not x["absent"]])
        v["levee_possible"] = 60000 + 15000 * e["renommee"]
        return v
