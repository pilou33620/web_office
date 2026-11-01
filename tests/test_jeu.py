import json
import random
import unittest

from moteur import ErreurJeu, Jeu


class TestJeu(unittest.TestCase):
    def test_depart(self):
        j = Jeu(graine=1)
        self.assertEqual(j.etat["argent"], 15000)
        self.assertEqual(len(j.etat["employes"]), 1)
        self.assertEqual(len(j.etat["offres"]), 4)
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
        j.action("local", id="atelier")
        j.action("acheter", id="fdm")
        self.assertEqual(j.bonus()["m"], 2)
        with self.assertRaises(ErreurJeu):
            j.action("local", id="openspace")  # renommée 3 requise

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
        j.action("local", id="atelier")
        j.action("signer", id=j.etat["offres"][0]["id"])
        lieux = set()
        for _ in range(40):
            j.etat["evenement"] = None
            j.etat.pop("dernier_livre", None)
            j._jour()
            lieux.add(j.etat["employes"][0]["lieu"])
        self.assertIn("reunion", lieux)
        self.assertTrue(lieux <= {"bureau", "labo", "atelier", "cem", "pause", "reunion", "visite"})
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
        j.etat["argent"], j.etat["renommee"] = 100000, 1
        moral = j.moral_global()
        j.action("local", id="pause")
        self.assertEqual(j.moral_global(), moral + 5)
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
        equipe = [dict(j.etat["employes"][0], id=i, e=a, m=b, f=c, trait=t)
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
        j = Jeu(graine=23)
        j.etat["argent"] = 100000
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="poste", x=300, y=100)  # partie droite : bureau agrandi pas loué
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="poste", x=34, y=66)  # déjà occupé par le bureau de départ
        with self.assertRaises(ErreurJeu):
            j.action("poser", id="canape", x=30, y=300)  # canapé : salle de pause ou open space uniquement
        j.action("local", id="bureau")
        j.action("poser", id="poste", x=272, y=150)
        poste = j.etat["objets"][-1]
        self.assertEqual((poste["x"], poste["y"]), (272, 152))  # calé sur la grille
        j.action("deplacer", id=poste["id"], x=272, y=72)
        self.assertEqual(poste["y"], 72)
        j.action("poser", id="plantes")
        j.action("poser", id="plantes")
        self.assertEqual(j.etat["deco"].count("plantes"), 1)
        j.action("poser", id="tapis", x=40, y=140)  # au sol : ne gêne rien
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

    def test_migration_v2_vers_v3(self):
        j = Jeu(graine=24)
        ancien = json.loads(json.dumps(j.etat))
        ancien.pop("objets")
        ancien["employes"][0]["bureau"] = 0
        ancien["locaux"] = ["bureau"]
        ancien["materiel"].append("oscillo")
        ancien["deco"] = ["cafe", "sieges"]
        nouveau = Jeu(ancien)
        self.assertEqual(len(nouveau.postes_ouverts()), 6)
        self.assertIn(nouveau.etat["employes"][0]["bureau"], nouveau.postes_ouverts())
        self.assertEqual({o["type"] for o in nouveau.etat["objets"]} - {"poste"}, {"multi", "station", "stlink", "oscillo", "cafe"})
        nouveau.action("avancer", jours=3)
        json.dumps(nouveau.vue())

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
                    try:
                        j.action("evenement", choix=r.randrange(len(e["evenement"]["options"])))
                    except ErreurJeu:
                        j.action("evenement", choix=len(e["evenement"]["options"]) - 1)
                for cle in ("bilan", "dernier_livre"):
                    e.pop(cle, None)
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
