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
        self.assertEqual(j.postes_ouverts(), [0, 1])

    def test_contrat_complet(self):
        j = Jeu(graine=2)
        offre = min(j.etat["offres"], key=lambda o: o["taille"])
        j.action("signer", id=offre["id"])
        argent = j.etat["argent"]
        for _ in range(400):
            if j.etat["evenement"]:
                j.action("evenement", choix=0)
            p = j.etat["projet"]
            if p is None:
                break
            if p["etape"] == "debug" and p["defauts"] < 1:
                j.action("tests_cem")
            j.action("avancer")
        self.assertIsNone(j.etat["projet"])
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

    def test_postes_et_locaux(self):
        j = Jeu(graine=4)
        j.etat["argent"] = 100000
        j.action("embaucher", id=j.etat["candidats"][0]["id"])
        with self.assertRaises(ErreurJeu):
            j.action("embaucher", id=j.etat["candidats"][0]["id"])
        j.action("local", id="bureau")
        j.action("embaucher", id=j.etat["candidats"][0]["id"])
        self.assertEqual(sorted(x["bureau"] for x in j.etat["employes"]), [0, 1, 2])
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
            j._evenement()
            ev = j.etat["evenement"]
            vus.add(ev["type"])
            j.action("evenement", choix=len(ev["options"]) - 1)
            self.assertIsNone(j.etat["evenement"])
        self.assertTrue({"penurie", "salon", "panne", "subvention", "recommandation"} <= vus)

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
                    j.action("evenement", choix=r.randrange(len(e["evenement"]["options"])))
                if not e["projet"] and e["offres"]:
                    j.action("signer", id=e["offres"][0]["id"])
                if e["projet"] and e["projet"]["etape"] == "debug" and e["projet"]["defauts"] < 2:
                    j.action("tests_cem")
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
