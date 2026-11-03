import json
import random
import unittest

from moteur import ErreurJeu, Jeu


class TestJeu(unittest.TestCase):
    def test_depart(self):
        j = Jeu(graine=1)
        self.assertEqual(j.etat["argent"], 15000)
        self.assertEqual(len(j.etat["employes"]), 1)
        self.assertEqual(len(j.etat["offres"]), 3)  # demandes spontanées ; le reste se prospecte
        self.assertEqual(len(j.postes_ouverts()), 2)
        self.assertEqual(sorted(j.etat["materiel"]), ["multi", "station", "stlink"])

    def test_contrat_complet(self):
        j = Jeu(graine=2)
        offre = min(j.etat["offres"], key=lambda o: o["taille"])
        j.action("signer", id=offre["id"])
        argent = j.etat["argent"]
        for _ in range(400):
            if j.etat["evenement"]:
                j.action("evenement", choix=0)
            if not j.etat["projets"]:
                break
            p = j.etat["projets"][0]
            if p["etape"] == "debug" and p["defauts"] < 1:
                j.action("tests_cem", id=p["id"])
            j.action("avancer")
        self.assertEqual(j.etat["projets"], [])
        self.assertEqual(j.etat["stats"]["livres"], 1)
        self.assertTrue(1 <= j.etat["historique"][0]["note"] <= 10)
        self.assertNotEqual(j.etat["argent"], argent)

    def test_fin_de_mois(self):
        j = Jeu(graine=3)
        j.etat["evenement"] = None
        argent = j.etat["argent"]
        for _ in range(30):
            j._jour()
            j.etat["evenement"] = None
        self.assertEqual(j.etat["jour"], 1)
        self.assertEqual(j.etat["argent"], argent - j.loyer())  # seul le fondateur, sans salaire
        self.assertEqual(j.etat["exercice"]["charges"], j.loyer())

    def test_postes_et_locaux(self):
        j = Jeu(graine=4)
        j.etat["argent"] = 100000
        j.action("embaucher", id=j.etat["candidats"][0]["id"])
        with self.assertRaises(ErreurJeu):
            j.action("embaucher", id=j.etat["candidats"][0]["id"])
        j.action("poser", id="poste")  # placement automatique d'un bureau de plus
        j.action("embaucher", id=j.etat["candidats"][0]["id"])
        self.assertEqual(len({x["bureau"] for x in j.etat["employes"]}), 3)
        with self.assertRaises(ErreurJeu):
            j.action("acheter", id="fdm")
        with self.assertRaises(ErreurJeu):
            j.action("local", id="atelier")  # il faut d'abord emménager dans le bâtiment
        j.action("local", id="bureau")  # tout le bâtiment s'ouvre, atelier compris
        j.action("acheter", id="fdm")
        self.assertEqual(j.bonus()["m"], 2)
        with self.assertRaises(ErreurJeu):
            j.action("local", id="fw2")  # plus de pièces à louer une par une

    def test_tresorerie_insuffisante(self):
        j = Jeu(graine=5)
        j.etat["argent"] = 100
        with self.assertRaises(ErreurJeu):
            j.action("acheter", id="spectre")
        self.assertEqual(j.etat["argent"], 100)

    def test_formation(self):
        j = Jeu(graine=6)
        fondateur = j.etat["employes"][0]
        m = fondateur["m"]
        j.action("former", id=fondateur["id"], dom="m")
        for _ in range(10):
            j._jour()
            j.etat["evenement"] = None
        self.assertEqual(fondateur["m"], m + 2)

    def test_evenements(self):
        j = Jeu(graine=7)
        j.etat["renommee"] = 3
        j.etat["stats"]["livres"] = 3
        j.etat["materiel"].append("oscillo")
        j.action("signer", id=j.etat["offres"][0]["id"])
        vus = set()
        for _ in range(200):
            j.etat["derniers_ev"] = {}
            j.etat["argent"] = 100000
            j._evenement()
            ev = j.etat["evenement"]
            vus.add(ev["type"])
            j.action("evenement", choix=len(ev["options"]) - 1)
            self.assertIsNone(j.etat["evenement"])
        self.assertTrue({"penurie", "salon", "panne", "subvention", "recommandation"} <= vus)

    def test_conditions_de_travail(self):
        j = Jeu(graine=11)
        j.etat["meteo"] = "canicule"
        _, f = j.conditions()
        self.assertAlmostEqual(f, 0.85)
        j.etat["deco"] += ["clim", "sieges"]
        _, f = j.conditions()
        self.assertAlmostEqual(f, 1.08)

    def test_deplacements(self):
        j = Jeu(graine=12)
        j.etat["argent"] = 50000
        j.action("local", id="bureau")
        j.action("signer", id=j.etat["offres"][0]["id"])
        lieux = set()
        for _ in range(40):
            j.etat["evenement"] = None
            j.etat.pop("dernier_livre", None)
            j._jour()
            lieux.add(j.etat["employes"][0]["lieu"])
        self.assertIn("reunion", lieux)
        self.assertTrue(lieux <= {"bureau", "labo", "atelier", "pause", "reunion", "visite"})
        self.assertGreater(len(lieux), 2)

    def test_abandon_rend_acompte(self):
        j = Jeu(graine=13)
        j.action("signer", id=j.etat["offres"][0]["id"])
        j.action("abandonner")
        self.assertEqual(j.etat["argent"], 15000)

    def test_produit_unique_et_parametres(self):
        j = Jeu(graine=14)
        j.etat["renommee"] = 5
        j.etat["produits"].append({"nom": "x", "id_produit": "meteo", "note": 7, "ventes": 900, "mois": 0, "total": 0})
        with self.assertRaises(ErreurJeu):
            j.action("produit", id="meteo")
        for mauvais in ({"jours": 1e999}, {"jours": "3"}, {"id": [1]}):
            with self.assertRaises(ErreurJeu):
                j.action("avancer" if "jours" in mauvais else "signer", **mauvais)

    def test_evenements_espaces(self):
        j = Jeu(graine=15)
        j.etat["renommee"], j.etat["argent"] = 3, 100000
        j._evenement()
        premier = j.etat["evenement"]["type"]
        j.action("evenement", choix=len(j.etat["evenement"]["options"]) - 1)
        for _ in range(30):
            j._evenement()
            if j.etat["evenement"]:
                self.assertNotEqual(j.etat["evenement"]["type"], premier)
                j.action("evenement", choix=len(j.etat["evenement"]["options"]) - 1)

    def test_projets_en_parallele_et_affectation(self):
        j = Jeu(graine=16)
        j.etat["argent"] = 100000
        j.action("signer", id=j.etat["offres"][0]["id"])
        with self.assertRaises(ErreurJeu):
            j.action("signer", id=j.etat["offres"][0]["id"])  # garage : un seul projet
        j.action("local", id="bureau")
        j.action("signer", id=j.etat["offres"][0]["id"])
        self.assertEqual(len(j.etat["projets"]), 2)
        j.action("embaucher", id=j.etat["candidats"][0]["id"])
        cible = j.etat["projets"][1]["id"]
        j.action("affecter", id=j.etat["employes"][1]["id"], projet=cible)
        j.etat["evenement"] = None
        j._jour()
        self.assertIn(j.etat["employes"][1]["id"], j.etat["projets"][1]["equipe"])
        j.action("affecter", id=j.etat["employes"][1]["id"], projet=None)
        with self.assertRaises(ErreurJeu):
            j.action("affecter", id=j.etat["employes"][1]["id"], projet=99999)

    def test_salle_de_pause_et_visites(self):
        j = Jeu(graine=21)
        j.etat["argent"], j.etat["renommee"] = 100000, 2
        moral = j.moral_global()
        j.action("local", id="bureau")
        self.assertEqual(j.moral_global(), moral + 5)  # salle de pause du bâtiment
        j.action("deco", id="babyfoot")
        j.action("embaucher", id=j.etat["candidats"][0]["id"])
        j.action("signer", id=j.etat["offres"][0]["id"])
        visites = 0
        for _ in range(80):
            j.etat["evenement"] = None
            j.etat.pop("dernier_livre", None)
            j._jour()
            for x in j.etat["employes"]:
                if x["lieu"] == "visite":
                    visites += 1
                    self.assertNotEqual(x["visite"], x["id"])
        self.assertGreater(visites, 0)

    def test_fabrication_prototype(self):
        j = Jeu(graine=22)
        p = j._creer_projet({"nom": "x", "taille": 100, "total": {"e": 50, "m": 20, "f": 30}}, "contrat")
        noms = [ph["nom"] for ph in p["phases"]]
        self.assertEqual(noms.index("Fabrication du prototype"), 2)
        j.etat["projets"].append(p)
        p["phase"] = 2
        argent = j.etat["argent"]
        j._entrer_phase(p)
        self.assertEqual(p["phases"][2]["attente"], 4)
        self.assertEqual(j.etat["argent"], argent - 400)
        for _ in range(4):
            self.assertEqual(p["phase"], 2)
            j._travailler(p, j.etat["employes"], j.bonus())
        self.assertEqual(p["phase"], 3)

    def test_horaires(self):
        j = Jeu(graine=17)
        base = j.efficacite(j.etat["employes"][0])
        j.action("horaires", heures=10)
        self.assertGreater(j.efficacite(j.etat["employes"][0]), base * 0.95)
        self.assertLess(j.moral_global(), 60)
        with self.assertRaises(ErreurJeu):
            j.action("horaires", heures=11)

    def test_combos(self):
        j = Jeu(graine=18)
        p = j._creer_projet({"nom": "x", "taille": 100, "total": {"e": 40, "m": 30, "f": 30}}, "contrat")
        equipe = [dict(j.etat["employes"][0], id=i, e=a, m=b, f=c, traits=[t])
                  for i, (a, b, c, t) in enumerate([(9, 0, 0, "perfectionniste"), (0, 6, 0, "debug"), (0, 0, 6, "rapide"), (1, 1, 1, "rapide")])]
        self.assertEqual(set(j._combos(p, equipe)) & {"trio", "qualite", "mentor"}, {"trio", "qualite", "mentor"})

    def test_bilan_annuel_et_fin(self):
        j = Jeu(graine=19)
        j.etat["exercice"]["ca"] = 50000
        j.etat["jours_total"] = 359
        j.etat["evenement"] = None
        argent = j.etat["argent"]
        j._jour()
        self.assertEqual(j.etat["bilan"]["impot"], 12500)
        self.assertLess(j.etat["argent"], argent)
        j.action("avancer")
        self.assertEqual(j.etat["jours_total"], 360)  # en pause tant que le bilan n'est pas fermé
        j.action("fermer_bilan")
        j.etat["jours_total"] = 20 * 360 - 1
        j.etat["evenement"] = None
        j._jour()
        self.assertIn("titre", j.etat["fin"])

    def test_noms_entreprise_et_directeur(self):
        j = Jeu(graine=30, entreprise="  Ohm   Sweet Ohm ", directeur="Ada")
        self.assertEqual(j.etat["entreprise"], "Ohm Sweet Ohm")
        self.assertEqual(j.etat["employes"][0]["nom"], "Ada")
        self.assertIn("Ohm Sweet Ohm", [c["nom"] for c in j.vue()["classement"]])
        fin = j.score_final()
        self.assertEqual((fin["entreprise"], fin["directeur"]), ("Ohm Sweet Ohm", "Ada"))
        d = Jeu(graine=30, entreprise="   ", directeur=None)
        self.assertEqual((d.etat["entreprise"], d.etat["employes"][0]["nom"]), ("Mon bureau d'études", "Vous"))
        for mauvais in ("x" * 31, "a\nb", 42, ["liste"]):
            with self.assertRaises(ErreurJeu):
                Jeu(entreprise=mauvais)
        ancien = json.loads(json.dumps(j.etat))
        ancien.pop("entreprise")
        self.assertEqual(Jeu(ancien).vue()["entreprise"], "Votre bureau")

    def test_migration_v1(self):
        j = Jeu(graine=20)
        j.action("signer", id=j.etat["offres"][0]["id"])
        ancien = json.loads(json.dumps(j.etat))
        ancien["projet"] = ancien.pop("projets")[0]
        for cle in ("heures", "trophees", "bilans", "exercice", "combos_vus"):
            ancien.pop(cle)
        nouveau = Jeu(ancien)
        self.assertEqual(len(nouveau.etat["projets"]), 1)
        nouveau.action("avancer", jours=3)
        json.dumps(nouveau.vue())

    def test_amenagement_libre(self):
        from moteur.donnees import PIECES
        def bien_places(j):
            dispo = j.pieces_dispo()
            for o in j.etat["objets"]:
                f = j.fiche(o["type"])
                self.assertTrue(any(PIECES[k]["rect"][0] <= o["x"] and PIECES[k]["rect"][1] <= o["y"]
                                    and o["x"] + f["w"] <= PIECES[k]["rect"][0] + PIECES[k]["rect"][2]
                                    and o["y"] + f["h"] <= PIECES[k]["rect"][1] + PIECES[k]["rect"][3] for k in dispo), o)
            postes = {o["id"] for o in j.etat["objets"] if o["type"] == "poste"}
            self.assertTrue(all(x["bureau"] in postes for x in j.etat["employes"]))
        j = Jeu(graine=23)
        j.etat["argent"], j.etat["renommee"] = 100000, 2
        hx, hy = PIECES["hw"]["rect"][:2]
        hx, hy = hx + 24 - hx % 4, hy + 116 - hy % 4  # une place libre du bureau HW, sur la grille
        self.assertEqual(j.carte(), "garage")
        bien_places(j)
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="poste", x=hx, y=hy)  # bureau HW (R1) : il faut d'abord emménager
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="poste", x=452, y=468)  # déjà occupé par le bureau de départ
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="poste", x=592, y=480)  # sur l'étagère du garage (mobilier fixe)
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="canape", x=440, y=580)  # canapé : cantine uniquement
        with self.assertRaises(ErreurJeu):
            j.action("local", id="cantine")  # il faut d'abord emménager
        j.action("local", id="bureau")  # déménagement : tout le garage est replacé dans le bâtiment
        self.assertEqual(j.carte(), "batiment")
        bien_places(j)
        j.action("poser", id="poste", x=hx - 1, y=hy - 1)
        poste = j.etat["objets"][-1]
        self.assertEqual((poste["x"], poste["y"]), (hx, hy))  # calé sur la grille
        self.assertEqual(j.piece_de(poste), "hw")
        j.action("deplacer", id=poste["id"], x=hx + 80, y=hy)
        self.assertEqual(poste["x"], hx + 80)
        j.action("poser", id="plantes")
        j.action("poser", id="plantes")
        self.assertEqual(j.etat["deco"].count("plantes"), 1)
        j.action("poser", id="tapis", x=hx + 30, y=hy - 50)  # au sol : ne gêne rien
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="plantes", x=PIECES["cantine"]["rect"][0] + 10, y=PIECES["cantine"]["rect"][1] + 8)  # sur la cuisine de la cantine (mobilier fixe)
        j.action("acheter", id="oscillo")
        oscillo = next(o for o in j.etat["objets"] if o["type"] == "oscillo")
        with self.assertRaises(ErreurJeu):
            j.action("acheter", id="oscillo")
        argent = j.etat["argent"]
        j.action("vendre", id=oscillo["id"])
        self.assertNotIn("oscillo", j.etat["materiel"])
        self.assertEqual(j.etat["argent"], argent + 1400)
        occupe = j.etat["employes"][0]["bureau"]
        with self.assertRaises(ErreurJeu):
            j.action("vendre", id=occupe)
        bien_places(j)

    def test_rangement_postes_et_salle_de_pause(self):
        """Postes sur la grille prévue, cantine disposée (canapé, baby-foot, jeux contre le mur), même après des achats de déco."""
        from moteur.donnees import EMPLACEMENTS
        j = Jeu(graine=31)
        e = j.etat
        e["argent"], e["renommee"] = 10 ** 6, 30
        j.action("local", id="bureau")
        for d in ("table", "biblio", "armoire", "imprimante", "plantes", "ficus"):
            j.action("poser", id=d)
        for d in ("canape", "babyfoot", "arcade", "distrib", "fontaine", "aquarium", "cafe"):
            j.action("poser", id=d)
            o = e["objets"][-1]
            self.assertEqual((o["x"], o["y"]), EMPLACEMENTS[d][0], d)
        while True:
            try:
                j.action("poser", id="poste")
            except ErreurJeu:
                break
        grille = set(EMPLACEMENTS["poste"])
        self.assertTrue(all((o["x"], o["y"]) in grille for o in e["objets"] if o["type"] == "poste"))
        self.assertEqual(sum(o["type"] == "poste" for o in e["objets"]), sum(1 for x, y in grille if not (440 <= x < 672 and 408 <= y < 640)))

    def test_tout_tient_dans_le_batiment(self):
        """Quel que soit l'ordre d'achat, chaque appareil trouve sa place et les bureaux gardent leurs 18 postes."""
        from moteur.donnees import MATERIEL
        for g in range(8):
            j = Jeu(graine=g)
            e = j.etat
            e["argent"], e["renommee"] = 10 ** 7, 30
            j.action("local", id="bureau")
            mats = [m for m in MATERIEL if m not in e["materiel"]]
            random.Random(g).shuffle(mats)
            for m in mats:
                j.action("acheter", id=m)
            while True:
                try:
                    j.action("poser", id="poste")
                except ErreurJeu:
                    break
            from moteur.donnees import EMPLACEMENTS
            grille = [p for p in EMPLACEMENTS["poste"] if not (440 <= p[0] < 672 and 408 <= p[1] < 640)]
            self.assertEqual(sum(o["type"] == "poste" for o in e["objets"]), len(grille), f"graine {g}")

    def test_sauvegarde_json(self):
        j = Jeu(graine=8)
        j.action("signer", id=j.etat["offres"][0]["id"])
        j.action("avancer", jours=5)
        copie = Jeu(json.loads(json.dumps(j.etat)))
        copie.action("avancer", jours=5)
        self.assertGreaterEqual(copie.etat["jours_total"], 5)

    def test_faillite(self):
        j = Jeu(graine=9)
        j.etat["argent"] = -4900
        j.etat["jour"] = 30
        j.action("avancer")
        self.assertTrue(j.etat["faillite"])
        with self.assertRaises(ErreurJeu):
            j.action("acheter", id="alim")

    def test_partie_longue_automatique(self):
        """Joue 3 ans avec une stratégie simple : le moteur ne doit jamais planter."""
        for graine in range(5):
            j, r = Jeu(graine=graine), random.Random(graine)
            for _ in range(3 * 360):
                e = j.etat
                if e["faillite"]:
                    break
                if e["evenement"]:
                    n = len(e["evenement"]["options"])
                    for choix in [r.randrange(n)] + list(range(n)):  # au hasard, sinon la première option abordable
                        try:
                            j.action("evenement", choix=choix)
                            break
                        except ErreurJeu:
                            pass
                for cle in ("bilan", "dernier_livre"):
                    e.pop(cle, None)
                if not e["prospections"] and j.prospecteurs():
                    j.action("prospecter", canal=r.choice(["plateformes", "reseaux"]), qui=j.prospecteurs()[0]["id"])
                for piste in list(e["pistes"]):
                    j.action("devis", id=piste["id"], prix=r.choice(["0.95", "1.0"]), delai="1.0")
                if len(e["projets"]) < j.capacite_projets() and e["offres"]:
                    j.action("signer", id=e["offres"][0]["id"])
                for p in list(e["projets"]):
                    if p["etape"] == "debug" and p["defauts"] < 2:
                        j.action("tests_cem", id=p["id"])
                if r.random() < 0.01:
                    j.action("horaires", heures=r.choice([6, 7, 8, 9, 10, 12]))
                for genre, ident in (("local", "bureau"), ("embaucher", None), ("acheter", "oscillo"), ("deco", "cafe")):
                    if e["argent"] > 25000:
                        try:
                            j.action(genre, id=ident or (e["candidats"][0]["id"] if e["candidats"] else 0))
                        except ErreurJeu:
                            pass
                j.action("avancer")
                json.dumps(j.vue())
            self.assertGreater(j.etat["stats"]["livres"], 0, f"graine {graine}")


if __name__ == "__main__":
    unittest.main()
