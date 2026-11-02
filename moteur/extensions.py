"""Extensions du moteur : choix techniques, R&D, certifications, SAV, négociation, concurrence, séries,
fournisseurs, prêts et investisseurs, carrières, vie d'équipe, météo, scénarios et difficulté."""
from .donnees import (CERTIFS, CHOIX_TECH, CONCURRENTS, DIFFICULTES, ENTRETIEN_CERTIF, FIDELITE_MAX, FOURNISSEURS, MEGA_PRIME,
                      MEGAS, METEO, MISSIONS, NB_MISSIONS_ACTIVES, NIVEAUX_FIDELITE, PRETS, PRIMES, PRODUITS, SAISONS, SCENARIOS,
                      SECTEURS, TAUX_PRET, TECHNOS, BREVET, IDEES_BREVET, NOM_DOMAINE, ROLES, AGRANDIR_STOCK, LOTS,
                      STOCK_BATIMENT, STOCK_GARAGE, STOCKAGE, INVESTISSEMENTS)

DUREE_GARANTIE = 120
DUREE_STAGE = 90
DELAI_SEMINAIRE = 180
CHANGEMENT_METEO = 0.2  # chance par jour que le temps change (en moyenne tous les 5 jours)


class ErreurJeu(Exception):
    """Action refusée ; le message est affiché au joueur."""


def borne(x, lo, hi):
    return max(lo, min(hi, x))


def requis_liste(requis):
    """Prérequis d'un contrat : aucun, un identifiant ou une liste d'identifiants."""
    return [] if not requis else [requis] if isinstance(requis, str) else list(requis)


class Extensions:
    # ------------------------------------------------------------------ mise en place
    def _init_extensions(self, scenario="garage", difficulte="normal"):
        e = self.etat
        if scenario not in SCENARIOS or difficulte not in DIFFICULTES:
            raise ErreurJeu("Scénario ou difficulté inconnu.")
        e.setdefault("scenario", scenario)
        e.setdefault("difficulte", difficulte)
        for cle, val in (("technos", []), ("certifs", []), ("recherches", []), ("garanties", []), ("series", []),
                         ("prets", []), ("fournisseur", "europe"), ("parts", 1.0), ("meteo", "soleil"), ("fete", None),
                         ("dernier_seminaire", -999), ("victoire", None), ("objectif", None), ("offre_serie", None), ("brevets", []),
                         ("commandes", []), ("stock_max", STOCK_GARAGE), ("prospection", None), ("investissements", {}), ("derniere_campagne", -999),
                         ("clients", {}), ("gammes", {}), ("missions", []), ("affinites", {}), ("affinites_connues", [])):
            e.setdefault(cle, val)
        st = e["stats"]
        for cle in ("megas", "suites", "series"):
            st.setdefault(cle, 0)
        st.setdefault("secteurs", {})
        st.setdefault("meilleure_note", max([h["note"] for h in e["historique"]], default=0))
        for prod in e["produits"]:  # anciennes sauvegardes : les produits en vente comptent pour les suites
            e["gammes"].setdefault(prod["id_produit"], prod["note"])
        if not e.get("concurrents"):
            e["concurrents"] = [{"nom": n, "renommee": r} for n, r in CONCURRENTS]
        for x in e["employes"]:
            self._completer_employe(x)
        e["candidats"] = [c if "traits" in c else self._candidat() for c in e["candidats"]]  # anciens CV, sans les nouveautés

    def _completer_employe(self, x):
        x.setdefault("anniv", [self.rng.randint(0, 11), self.rng.randint(1, 30)])
        x.setdefault("chef", False)
        x.setdefault("role", None)
        x.setdefault("stage", 0)
        x.setdefault("absence", None)
        self._completer_personnel(x)

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
        if "bureau" in e["locaux"]:
            self._replacer_objets()
            e["stock_max"] = STOCK_BATIMENT  # on reprend une société déjà installée dans le bâtiment
        for _ in range(sc.get("employes", 0)):
            c = self._candidat()
            libres = self.bureaux_libres()
            self._nouvel_employe(c, libres[0] if libres else self._ajouter_objet("poste", *self._place_auto("poste"))["id"])
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
        if "fpga" in self.etat["technos"]:
            b["debug"] += 1
        return b

    def _choix_effets(self, p, cle):
        return [CHOIX_TECH[k]["options"][v].get(cle) for k, v in p.get("choix", {}).items() if CHOIX_TECH[k]["options"][v].get(cle) is not None]

    def _note_bonus(self, p):
        e, actifs = self.etat, self.roles()["actifs"]
        n = sum(self._choix_effets(p, "note")) + 0.2 * ("ia" in e["technos"]) + 0.2 * ("iso" in e["certifs"])
        return n + 0.2 * ("dir_rd" in actifs) + 0.3 * ("innov" in actifs and p["type"] == "produit")

    def dg_actif(self):
        """Votre bureau (fondateur) est installé en direction générale."""
        return any(x.get("fondateur") and self.roles()["pieces"].get(x["id"]) == "dg" for x in self.etat["employes"])

    def prix_recherche(self, genre, f):
        return int(f["prix"] * (0.75 if genre == "tech" and "dir_rd" in self.roles()["actifs"] else 1))

    def montant_levee(self):
        return int((60000 + 15000 * self.etat["renommee"]) * (1.3 if self.dg_actif() else 1))

    def _cem_bonus(self, p):
        return sum(self._choix_effets(p, "cem"))

    def _facteur_defauts(self):
        e = self.etat
        f = FOURNISSEURS[e["fournisseur"]]["defauts"]
        return f * (0.85 if "iso" in e["certifs"] else 1) * (0.9 if "dfm" in e["technos"] else 1) * (0.95 if "secu" in e["technos"] else 1)

    def _facteur_proto(self, p):
        f = 1.0
        for x in self._choix_effets(p, "proto"):
            f *= x
        return f * FOURNISSEURS[self.etat["fournisseur"]]["proto"] * (0.7 if "dfm" in self.etat["technos"] else 1)

    def _facteur_paie(self, p):
        e = self.etat
        prime = max([PRIMES.get(x, 1) for x in requis_liste(p.get("requis"))], default=1)
        return (1.05 if "ce" in e["certifs"] else 1) * prime * DIFFICULTES[e["difficulte"]]["paie"]

    def mensualites(self):
        return sum(x["mensualite"] for x in self.etat["prets"])

    def dette(self):
        return sum(x["mensualite"] * x["mois"] for x in self.etat["prets"])

    def plafond_pret(self):
        return 20000 + 8000 * self.etat["renommee"]

    # ------------------------------------------------------------------ choix techniques et négociation
    def _choix_valides(self, choix):
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
        etapes = sum(CHOIX_TECH[k]["options"][v].get("cout_point", 0) for k, v in choix.items()) * base["taille"]
        return base, cout + int(round(etapes * (0.85 if self.chefs_projet() else 1), -1))  # le chef de projet pilote l'indus et la qualif

    def chance_negociation(self, prix, delai, fid=0):
        """Au prix et au délai affichés, le client signe à coup sûr ; demander plus est un pari (moins risqué avec un client fidèle)."""
        return round(borne(1 - 2.6 * (prix - 1) - 0.6 * (delai - 1) + 0.01 * self.etat["renommee"] + 0.05 * fid + 0.01 * self.meilleur_metier("commercial")
                           + (0.1 if self.dg_actif() else 0), 0.05, 1.0), 2)

    # ------------------------------------------------------------------ clients fidèles, méga-projets, suites
    def _client_fidele(self):
        """Un client fidèle (niveau 2 ou plus) qui revient, ou None."""
        fideles = [(nom, c) for nom, c in self.etat.get("clients", {}).items() if c["fid"] >= 2 and c.get("secteur")]
        if not fideles or self.rng.random() >= 0.35:
            return None
        return self.rng.choices(fideles, weights=[c["fid"] for _, c in fideles])[0]

    def _offre_mega(self):
        e, r = self.etat, self.rng
        acquis = set(e["technos"]) | set(e["certifs"])
        possibles = [m for m in MEGAS if m[3] <= e["renommee"] and set(m[4]) <= acquis]
        if not possibles:
            return None
        nom, mix, base, rmin, requis, secteur, equipe = r.choice(possibles)
        total = {d: round(base * r.uniform(0.9, 1.15) * part) for d, part in zip(("e", "m", "f"), mix)}
        taille = sum(total.values())
        return {"id": self._id(), "nom": nom, "client": r.choice(SECTEURS[secteur]["clients"]), "taille": taille, "total": total,
                "paie": int(round(taille * r.uniform(70, 80) * (1 + 0.01 * min(e["renommee"], 20)) * MEGA_PRIME, -3)),
                "delai": 60 + round(taille * 0.12), "gain": 1 + taille // 200, "expire": 60, "requis": list(requis),
                "secteur": secteur, "fidele": 0, "mega": True, "equipe_min": equipe}

    def bonus_suite(self, prod):
        """Une suite se vend mieux si le modèle précédent a plu (+8 % par point de note au-dessus de 6)."""
        note = self.etat["gammes"].get(prod.get("suite"), 0)
        return 1 + 0.08 * max(0, note - 6) if prod.get("suite") else 1

    # ------------------------------------------------------------------ R&D, certifications, prêts
    def _lancer_recherche(self, genre, rid):
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
        self._payer(self.prix_recherche(genre, f))
        e["recherches"].append({"genre": genre, "id": rid, "jours": f["jours"], "total": f["jours"]})
        self._log(f"{'Recherche' if genre == 'tech' else 'Audit'} lancé : {f['nom']} ({f['jours']} jours).", "info")

    def _ajouter_pret(self, montant):
        mensualite = int(round(montant * (1 + TAUX_PRET * 2) / 24))
        self.etat["prets"].append({"montant": montant, "mensualite": mensualite, "mois": 24})
        self.etat["argent"] += montant

    # ------------------------------------------------------------------ actions du joueur
    def _action_extension(self, genre, p):
        """Renvoie True si l'action a été traitée ici."""
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
            montant = self.montant_levee()
            e["argent"] += montant
            e["parts"] = 0.8
            self._log(f"Levée de fonds : +{montant:,} € contre 20 % du capital (score final ×0,8).".replace(",", " "), "bon")
        elif genre == "promouvoir":
            emp = self.employe(p.get("id"))
            if emp.get("chef"):
                raise ErreurJeu("Déjà chef de projet.")
            seuil = 10 if "leader" in emp["traits"] else 14
            if emp["e"] + emp["m"] + emp["f"] < seuil:
                raise ErreurJeu(f"Il faut {seuil} points de compétences au total pour devenir chef de projet.")
            if emp.get("stage"):
                raise ErreurJeu("Un stagiaire ne peut pas être promu.")
            emp["chef"] = True
            self._installer_fonction(emp, "cdp")
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
        elif genre == "commander":
            self._commander(p.get("id"), p.get("qte"))
        elif genre == "agrandir_stock":
            if not self.emmenage():
                raise ErreurJeu("Le stock s'agrandit dans le bâtiment : emménagez d'abord.")
            self._payer(AGRANDIR_STOCK[0])
            e["stock_max"] += AGRANDIR_STOCK[1]
            self._log(f"Stock agrandi : {e['stock_max']} unités.", "bon")
        elif genre == "negocier":
            self._negocier(p.get("id"), p.get("cible"))
        elif genre == "prospecter":
            if p.get("id") is not None and p.get("id") not in SECTEURS:
                raise ErreurJeu("Secteur inconnu.")
            if not self.commerciaux():
                raise ErreurJeu("Il faut des commerciaux pour prospecter.")
            e["prospection"] = p.get("id")
            self._log("Prospection : " + (SECTEURS[p["id"]]["nom"] if p.get("id") else "tous secteurs") + ".", "info")
        elif genre == "nommer":
            self._nommer(self.employe(p.get("id")), p.get("role"))
        elif genre == "investir":
            self._investir(p.get("id"))
        elif genre == "fermer_victoire":
            if e.get("victoire"):
                e["victoire"]["vue"] = True
        else:
            return False
        return True

    # ------------------------------------------------------------------ chaque jour
    # ------------------------------------------------------------------ produits : sous-traitant, lots, stock
    # ------------------------------------------------------------------ investissements de fin de partie
    def a_investi(self, iid):
        return self.etat["investissements"].get(iid, 0)

    def prix_investissement(self, iid):
        inv, n = INVESTISSEMENTS[iid], self.a_investi(iid)
        if iid == "campagne":
            return int(inv["prix"] * (1 + 0.5 * n))
        if iid == "rachat":
            return inv["prix"] + inv["par_rep"] * max(c["renommee"] for c in self.etat["concurrents"])
        return inv["prix"]

    def _investir(self, iid):
        e = self.etat
        inv = INVESTISSEMENTS.get(iid)
        if not inv:
            raise ErreurJeu("Investissement inconnu.")
        if not self.emmenage():
            raise ErreurJeu("Les investissements se font depuis le bâtiment : emménagez d'abord.")
        if e["renommee"] < inv["rep"]:
            raise ErreurJeu(f"Renommée {inv['rep']} requise.")
        if iid in ("formation", "filiale") and self.a_investi(iid):
            raise ErreurJeu("Déjà fait.")
        if iid == "campagne" and e["jours_total"] - e["derniere_campagne"] < 360:
            raise ErreurJeu("Une campagne nationale par an au plus.")
        if iid == "rachat" and (self.a_investi(iid) >= 2 or len(e["concurrents"]) < 2):
            raise ErreurJeu("Deux rachats au plus : il reste toujours un concurrent.")
        prix = self.prix_investissement(iid)
        self._payer(prix)
        e["investissements"][iid] = self.a_investi(iid) + 1
        if iid == "campagne":
            e["derniere_campagne"] = e["jours_total"]
            e["renommee"] += 2
            self._log(f"Campagne de communication nationale (−{prix:_} €) : renommée +2.".replace("_", " "), "bon")
        elif iid == "rachat":
            c = max(e["concurrents"], key=lambda c: c["renommee"])
            e["concurrents"].remove(c)
            e["renommee"] += 3
            self._log(f"Vous rachetez {c['nom']} (−{prix:_} €) : un concurrent de moins, renommée +3.".replace("_", " "), "bon")
        else:
            self._log(f"{inv['nom']} : c'est fait ! (−{prix:_} €)".replace("_", " "), "bon")

    def stock_total(self):
        e = self.etat
        return sum(x["stock"] for x in e["produits"]) + sum(c["qte"] for c in e["commandes"])

    def _commander(self, pid, qte):
        e = self.etat
        prod = next((x for x in e["produits"] if x["id_produit"] == pid), None)
        if not prod:
            raise ErreurJeu("Produit introuvable.")
        if qte not in LOTS:
            raise ErreurJeu("Taille de lot inconnue.")
        if self.stock_total() + qte > e["stock_max"]:
            raise ErreurJeu(f"Stock trop petit : {e['stock_max']} unités en tout (commandes en cours comprises).")
        coef, jours = LOTS[qte]
        cout = int(round(qte * prod["cout_unite"] * coef, -1))
        self._payer(cout)
        jours += 3 * FOURNISSEURS[e["fournisseur"]]["jours"]
        e["commandes"].append({"produit": pid, "nom": prod["nom"], "qte": qte, "jours": jours, "retard": False})
        self._log(f"Lot de {qte} « {prod['nom']} » commandé au sous-traitant (−{cout:_} €, {jours} jours).".replace("_", " "), "info")

    def _lots_du_jour(self):
        """Fabrication chez le sous-traitant, retards possibles, contrôle à réception (mieux fait avec la qualification)."""
        e, r = self.etat, self.rng
        for c in list(e["commandes"]):
            c["jours"] -= 1
            if c["jours"] > 0:
                continue
            prod = next((x for x in e["produits"] if x["id_produit"] == c["produit"]), None)
            if not c["retard"] and r.random() < 0.15 * (0.5 if self.chefs_projet() else 1):
                c["retard"], c["jours"] = True, r.randint(5, 12)
                self._log(f"Le sous-traitant prend du retard sur le lot « {c['nom']} » ({c['jours']} jours de plus).", "mauvais")
                continue
            e["commandes"].remove(c)
            if not prod:
                continue
            defaut = r.random() < prod["defaut_lot"] * FOURNISSEURS[e["fournisseur"]]["defauts"]
            if defaut and r.random() < min(0.95, 0.5 + 0.06 * self.meilleur_metier("qualif")):
                e["commandes"].append({**c, "jours": 15, "retard": True})
                self._log(f"Contrôle à réception : lot « {c['nom']} » défectueux, renvoyé au sous-traitant qui le refait.", "mauvais")
                continue
            prod["stock"] += c["qte"]
            if defaut:
                prod["note"] = max(1, round(prod["note"] - 0.4, 1))
                prod["demande"] = max(1, round(prod["demande"] * 0.85))
                self._log(f"Lot « {c['nom']} » défectueux passé au contrôle : retours clients, la réputation du produit baisse.", "mauvais")
            else:
                self._log(f"Lot de {c['qte']} « {c['nom']} » reçu au stock.", "info")

    def _ventes_du_mois(self):
        """Ventes limitées au stock, pannes remboursées, invendus liquidés en fin de vie ; renvoie (ventes, frais de stockage)."""
        e = self.etat
        frais = int(round(STOCKAGE * sum(x["stock"] for x in e["produits"])))
        total = 0
        for prod in list(e["produits"]):
            vendus = min(prod["stock"], prod["demande"])
            net = int(round(vendus * prod["prix"] * (1 - prod["pannes"])))
            if vendus < prod["demande"] and prod["mois"]:
                self._log(f"Rupture de stock : « {prod['nom']} » a manqué {prod['demande'] - vendus} ventes.", "mauvais")
            prod["stock"] -= vendus
            prod["total"] += net
            prod["mois"] += 1
            prod["demande"] = int(prod["demande"] * 0.9)
            prod["ventes"] = prod["demande"] * prod["prix"]
            total += net
            if prod["demande"] < 3 and not any(c["produit"] == prod["id_produit"] for c in e["commandes"]):
                reste = int(round(prod["stock"] * prod["cout_unite"] * 0.3))
                if prod["stock"]:
                    self._log(f"Fin de vie de « {prod['nom']} » : {prod['stock']} invendus soldés (+{reste:,} €).".replace(",", " "), "info")
                total += reste
                e["produits"].remove(prod)
        return total, frais

    def _negocier(self, oid, cible):
        """Un commercial renégocie une offre : plus d'argent ou plus de délai, au risque de perdre le client."""
        e = self.etat
        o = next((x for x in e["offres"] if x["id"] == oid), None)
        if not o:
            raise ErreurJeu("Cette offre n'est plus disponible.")
        if cible not in ("prix", "delai"):
            raise ErreurJeu("Paramètres invalides.")
        com = self.commerciaux()
        if not com:
            raise ErreurJeu("Il faut des commerciaux pour négocier.")
        if o.get("negociee"):
            raise ErreurJeu("Offre déjà négociée.")
        o["negociee"] = True
        if self.rng.random() < self.chance_commerciale():
            if cible == "prix":
                o["paie"] = int(round(o["paie"] * 1.15, -2))
            else:
                o["delai"] = round(o["delai"] * 1.25)
            self._log(f"Négociation réussie sur « {o['nom']} » : " + (f"{o['paie']:,} €".replace(",", " ") if cible == "prix" else f"{o['delai']} jours") + ".", "bon")
        else:
            e["offres"].remove(o)
            self._log(f"Négociation ratée : {o['client']} se tourne vers la concurrence pour « {o['nom']} ».", "mauvais")

    def chance_commerciale(self):
        return round(min(0.9, 0.45 + 0.05 * max([self.metier(x, "commercial") for x in self.commerciaux()], default=0)), 2)

    def _nommer(self, emp, role):
        """Donne (ou retire, role=None) un rôle : responsable de service, directeur R&D ou chargé d'innovation."""
        paye = not emp.get("fondateur") and not emp.get("stage")
        if role is None:
            if not emp.get("role"):
                raise ErreurJeu("Aucun rôle à retirer.")
            if paye:
                emp["salaire"] = max(0, emp["salaire"] - ROLES[emp["role"]]["salaire"])
            self._log(f"{emp['nom']} quitte son poste de {ROLES[emp['role']]['nom']}.", "info")
            emp["role"] = None
            emp["humeur"] = max(-8, emp["humeur"] - 4)  # rendu à la nomination : pas d'humeur gratuite en boucle
            return
        r = ROLES.get(role) if isinstance(role, str) else None
        if not r:
            raise ErreurJeu("Rôle inconnu.")
        if emp.get("stage"):
            raise ErreurJeu("Un stagiaire ne peut pas être promu.")
        if emp.get("role"):
            raise ErreurJeu(f"{emp['nom']} a déjà un rôle.")
        if any(x.get("role") == role for x in self.etat["employes"]):
            raise ErreurJeu(f"Il y a déjà un·e {r['nom']}.")
        if "dom" in r and emp[r["dom"]] < r["min"]:
            raise ErreurJeu(f"Il faut {r['min']} en {NOM_DOMAINE[r['dom']]}.")
        if "total" in r and emp["e"] + emp["m"] + emp["f"] < r["total"]:
            raise ErreurJeu(f"Il faut {r['total']} points de compétences au total.")
        self._installer(emp, r["genre"])
        emp["role"] = role
        if paye:
            emp["salaire"] += r["salaire"]
        emp["humeur"] = min(8, emp["humeur"] + 4)
        self._log(f"{emp['nom']} devient {r['nom']} !", "bon")

    def _debut_jour_extensions(self):
        e, r = self.etat, self.rng
        saison = SAISONS[e["mois"]]
        # le temps dure plusieurs jours (un tirage quotidien faisait clignoter la pluie) ; nouveau tirage au changement de saison
        if e["meteo"] not in METEO[saison] or r.random() < CHANGEMENT_METEO:
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
            rech["jours"] -= 2 if rech["genre"] == "tech" and "dir_rd" in self.roles()["actifs"] else 1
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
                cout = int(round((500 + 400 * g["defauts"]) * (0.5 if self.emmenage() else 1), -1))  # atelier SAV du bâtiment
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
        if e["renommee"] >= 10 and not any(o.get("mega") for o in e["offres"]) and r.random() < 0.012:
            mega = self._offre_mega()
            if mega:
                e["offres"].append(mega)
                self._log(f"Méga-projet en vue : « {mega['nom']} » pour {mega['client']} !", "bon")
        for x in list(e["employes"]):
            if x.get("stage"):
                x["stage"] -= 1
                if x["stage"] <= 0:
                    if e["evenement"]:
                        x["stage"] = 1  # on attend que l'évènement en cours soit réglé
                    else:
                        salaire = 900 + 230 * (x["e"] + x["m"] + x["f"])
                        e["evenement"] = {"type": "fin_stage", "titre": "Fin de stage", "employe": x["id"], "salaire": salaire,
                                          "texte": f"Le stage de {x['nom']} se termine. L'embaucher ?",
                                          "options": [f"L'embaucher ({salaire:,} €/mois)".replace(",", " "), "Lui dire au revoir"]}
        if e.get("offre_serie") and not e["evenement"]:
            s = e.pop("offre_serie")
            e["evenement"] = {"type": "serie", "titre": "Commande de série", "serie": s,
                              "texte": f"{s['client']} veut produire « {s['nom']} » en série pendant {s['mois']} mois. Vous touchez une marge sur chaque lot.",
                              "options": [f"Accepter (~{s['marge']:,} €/mois)".replace(",", " "), "Décliner"]}
        self._lots_du_jour()
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
                recettes += int(s["marge"] * f["serie"] * s.get("indus", 1) * (1 + 0.04 * self.meilleur_metier("indus")))
            s["mois"] -= 1
            if s["mois"] <= 0:
                e["series"].remove(s)
                self._log(f"Fin de la production en série de « {s['nom']} ».", "info")
        if recettes:
            morceaux.append(f"séries +{recettes:,} €".replace(",", " "))
        brevets = sum(b["revenu"] for b in e["brevets"])
        for b in list(e["brevets"]):
            b["mois"] -= 1
            if b["mois"] <= 0:
                e["brevets"].remove(b)
                self._log(f"Le brevet « {b['nom']} » arrive à échéance.", "info")
        if brevets:
            recettes += brevets
            morceaux.append(f"brevets +{brevets:,} €".replace(",", " "))
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
        st = e["stats"]
        st["meilleure_note"] = max(st["meilleure_note"], note)
        if p["type"] == "produit":
            e["gammes"][p["id_produit"]] = max(e["gammes"].get(p["id_produit"], 0), note)
            if any(x["id"] == p["id_produit"] and x.get("suite") for x in PRODUITS):
                st["suites"] += 1
        else:
            if p.get("secteur"):
                st["secteurs"][p["secteur"]] = st["secteurs"].get(p["secteur"], 0) + 1
            if p.get("mega"):
                st["megas"] += 1
            if p.get("client"):
                c = e["clients"].setdefault(p["client"], {"secteur": p.get("secteur"), "fid": 0, "livres": 0})
                ecart = note - self.attente_client()
                avant = c["fid"]
                c["fid"] = borne(c["fid"] + (2 if ecart >= 1.5 else 1 if ecart >= 0 else -2 if ecart < -1 else 0), 0, FIDELITE_MAX)
                c["livres"] += 1
                if c["fid"] >= 3 > avant:
                    self._log(f"{p['client']} devient un client fidèle : il reviendra avec de plus gros projets.", "bon")
        ni, nq = self._niveau(p, "indus"), self._niveau(p, "qualif")
        qi, qq = self.qualite_etape("indus", "indus"), self.qualite_etape("qualif", "qualif")
        # défauts vus par le client : l'indus et la qualif en évitent ; sans indus, un gros projet en laisse passer plus
        reel = p["defauts"] * (1 - 0.35 * ni * qi) * (1 - 0.35 * nq * qq) * (1.3 if not ni and p["taille"] >= 250 else 1)
        if p["type"] == "contrat" and reel >= 0.3:
            e["garanties"].append({"nom": p["nom"], "client": p["client"], "defauts": round(reel, 1), "jours": DUREE_GARANTIE})
        if note >= 7:
            e["pot"] = True
        # un projet industrialisé est plus souvent produit en série, avec une meilleure marge
        if p["type"] == "contrat" and note >= 7 and len(e["series"]) < 4 and r.random() < 0.35 + 0.1 * ni:
            e["offre_serie"] = {"nom": p["nom"], "client": p["client"], "mois": r.randint(6, 18),
                                "marge": int(round(p["paie"] * 0.04 * note / 8, -1)), "indus": round(1 + 0.3 * ni * qi, 2)}

    def _evenements_extensions(self, possibles):
        e, r = self.etat, self.rng
        stars = [x for x in e["employes"] if not x.get("fondateur") and not x.get("stage") and x["e"] + x["m"] + x["f"] >= 12
                 and r.random() >= self.fidelite(x)]  # les fidèles n'écoutent même pas
        if stars:
            x = r.choice(stars)
            c = max(e["concurrents"], key=lambda c: c["renommee"])
            possibles.append({"type": "debauche", "titre": "Tentative de débauchage", "employe": x["id"],
                              "texte": f"{c['nom']} propose un pont d'or à {x['nom']}.",
                              "options": ["Contre-offre (+15 % de salaire)", "Le laisser partir"]})
        if self.bureaux_libres():
            possibles.append({"type": "stage", "titre": "Stagiaire d'école d'ingénieurs",
                              "texte": "Une école propose un stagiaire gratuit pendant 3 mois.",
                              "options": ["L'accueillir", "Pas maintenant"]})
        if "innov" in self.roles()["actifs"] and len(e["brevets"]) < 3:  # 3 brevets actifs au plus
            idee = r.choice(IDEES_BREVET)
            possibles.append({"type": "brevet", "titre": "Idée brevetable", "idee": idee,
                              "texte": f"Votre chargé·e d'innovation a une idée : « {idee} ». Un brevet rapporterait des licences pendant 3 ans.",
                              "options": [f"Déposer le brevet (−{BREVET['cout']:,} €)".replace(",", " "), "Laisser tomber"]})
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
                e["stats"]["series"] += 1
        elif t == "debauche":
            x = next((y for y in e["employes"] if y["id"] == ev["employe"]), None)
            if x and choix == 0:
                x["salaire"] = int(round(x["salaire"] * 1.15, -1))
                x["humeur"] = min(8, x["humeur"] + 3)
            elif x:
                e["employes"].remove(x)
                self._log(f"{x['nom']} part chez la concurrence.", "mauvais")
        elif t == "stage" and choix == 0:
            libres = self.bureaux_libres()
            if libres:
                c = self._candidat()
                self._nouvel_employe(c, libres[0], poste="Stagiaire d'école", salaire=0, humeur=2, stage=DUREE_STAGE, seniorite=0, annonce=0,
                                     e=max(1, c["e"] // 2), m=max(0, c["m"] // 2), f=max(1, c["f"] // 2))
                self._log(f"{c['nom']} arrive en stage pour 3 mois.", "bon")
        elif t == "fin_stage":
            x = next((y for y in e["employes"] if y["id"] == ev["employe"]), None)
            if x and choix == 0:
                x.update(stage=0, salaire=ev["salaire"], poste="Ingé junior")
            elif x:
                e["employes"].remove(x)
                self._log(f"Fin de stage pour {x['nom']}. Bonne route !", "info")
        elif t == "brevet":
            if choix == 0:
                self._payer(BREVET["cout"])
                revenu = int(round(self.rng.randint(*BREVET["revenu"]), -1))
                e["brevets"].append({"nom": ev["idee"], "revenu": revenu, "mois": BREVET["mois"]})
                e["renommee"] += 1
                self._log(f"Brevet déposé : « {ev['idee']} » (+{revenu} €/mois de licences, renommée +1).", "bon")
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

    # ------------------------------------------------------------------ missions
    def _mesure(self, cle):
        e, st = self.etat, self.etat["stats"]
        if cle.startswith("secteur:"):
            return st["secteurs"].get(cle[8:], 0)
        if cle.startswith("local:"):
            return int(cle[6:] in e["locaux"])
        return {"livres": st["livres"], "employes": len(e["employes"]), "produits": st["produits_lances"],
                "technos": len(e["technos"]), "certifs": len(e["certifs"]), "renommee": e["renommee"],
                "fideles": sum(1 for c in e["clients"].values() if c["fid"] >= 3), "series": st["series"],
                "suites": st["suites"], "megas": st["megas"], "note": st["meilleure_note"], "indus": st.get("indus", 0),
                "qualif": st.get("qualif_produit", 0), "chefs": len([x for x in e["employes"] if x.get("chef")])}[cle]

    def missions_actives(self):
        faites = set(self.etat["missions"])
        return [m for m in MISSIONS if m[0] not in faites][:NB_MISSIONS_ACTIVES]

    def _verifier_missions(self):
        e = self.etat
        for mid, texte, cle, seuil, argent, rep in self.missions_actives():
            if self._mesure(cle) >= seuil:
                e["missions"].append(mid)
                self._encaisser(argent)
                e["renommee"] += rep
                gain = f"+{argent:,} €".replace(",", " ") + (f", renommée +{rep}" if rep else "")
                self._log(f"Mission accomplie : {texte} ({gain}).", "trophee")

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
        v["classement"] = sorted([{"nom": e["entreprise"], "renommee": e["renommee"], "vous": True}] +
                                 [dict(c) for c in e["concurrents"]], key=lambda c: -c["renommee"])
        v["prix_investissements"] = {k: self.prix_investissement(k) for k in INVESTISSEMENTS}
        v["mensualites"] = self.mensualites()
        v["dette"] = self.dette()
        v["plafond_pret"] = self.plafond_pret()
        v["saison"] = SAISONS[e["mois"]]
        v["progres_objectif"] = self.progres_objectif()
        v["seminaire_dans"] = max(0, DELAI_SEMINAIRE - (e["jours_total"] - e["dernier_seminaire"]))
        v["cout_seminaire"] = 1000 + 300 * len([x for x in e["employes"] if not x["absent"]])
        v["levee_possible"] = self.montant_levee()
        v["bonus_nego"] = 0.1 if self.dg_actif() else 0
        v["stock_total"] = self.stock_total()
        v["chance_commerciale"] = self.chance_commerciale()
        v["nb_commerciaux"] = len(self.commerciaux())
        v["qualite_indus"], v["qualite_qualif"] = self.qualite_etape("indus", "indus"), self.qualite_etape("qualif", "qualif")
        v["missions_actives"] = [{"id": m[0], "texte": m[1], "progres": min(self._mesure(m[2]), m[3]), "seuil": m[3],
                                  "argent": m[4], "renommee": m[5]} for m in self.missions_actives()]
        v["clients_top"] = [{"nom": nom, "secteur": SECTEURS.get(c.get("secteur"), {}).get("nom", ""), "fid": c["fid"],
                             "niveau": NIVEAUX_FIDELITE[c["fid"]], "livres": c["livres"]}
                            for nom, c in sorted(e["clients"].items(), key=lambda x: (-x[1]["fid"], -x[1]["livres"]))[:8]]
        return v
