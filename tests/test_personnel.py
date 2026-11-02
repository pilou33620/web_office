import json
import unittest

from moteur import ErreurJeu, Jeu
from moteur.donnees import COUT_ENTRETIEN, SENIORITES


class TestPersonnel(unittest.TestCase):
    def test_cv_cache_le_talent_et_les_traits(self):
        j = Jeu(graine=2)
        for c, vu in zip(j.etat["candidats"], j.vue()["candidats"]):
            self.assertEqual(vu["traits"], c["traits"][:1])
            self.assertEqual(vu["traits_caches"], len(c["traits"]) - 1)
            self.assertIsNone(vu["metier"][c["cachee"]])
            self.assertIsNone(vu["motivation"])
            self.assertEqual(vu["seniorite"], c["annonce"])
            for cle in ("cachee", "annonce", "connu"):
                self.assertNotIn(cle, vu)
        json.dumps(j.vue())

    def test_entretien_puis_specialiste(self):
        j = Jeu(graine=3)
        j.etat["argent"] = 50000
        c = j.etat["candidats"][0]
        j.action("entretien", id=c["id"])
        self.assertEqual(j.etat["argent"], 50000 - COUT_ENTRETIEN)
        vu = next(x for x in j.vue()["candidats"] if x["id"] == c["id"])
        self.assertEqual(vu["seniorite"], c["seniorite"])
        self.assertEqual(vu["motivation"], c["motivation"])
        self.assertIsNotNone(vu["indice"])
        with self.assertRaises(ErreurJeu):
            j.action("entretien", id=c["id"])
        avant = j.etat["argent"]
        j.action("specialiste", id=c["id"])
        self.assertEqual(j.etat["argent"], avant - j.cout_specialiste())
        vu = next(x for x in j.vue()["candidats"] if x["id"] == c["id"])
        self.assertEqual(vu["traits"], c["traits"])
        self.assertEqual(vu["metier"], c["metier"])
        with self.assertRaises(ErreurJeu):  # plus rien à découvrir : on ne paie pas pour rien
            j.action("specialiste", id=c["id"])

    def test_cv_gonfle_paye_au_prix_annonce(self):
        j = Jeu(graine=4)
        for _ in range(200):
            c = j._candidat()
            if c["poste"] != "Stagiaire" and not c["commercial"] and not c.get("role_propose"):  # commerciaux et chefs d'équipe : salaire à part
                self.assertEqual(c["salaire"], j.prix_marche(c, c["annonce"]))
                self.assertIn(c["annonce"] - c["seniorite"], (0, 1))

    def test_burnout_apres_surmenage(self):
        j = Jeu(graine=5)
        x = j.etat["employes"][0]
        x["fatigue"] = 50
        for _ in range(8):
            x["fatigue"] = 50
            j._jour_personnel()
        self.assertEqual((x["absence"], x["absent"]), ("burnout", 20))

    def test_entretien_annuel_promotion(self):
        j = Jeu(graine=6)
        j.etat["argent"] = 10 ** 6
        c = j.etat["candidats"][0]
        j.action("embaucher", id=c["id"])
        x = j.etat["employes"][-1]
        x.update(e=12, m=3, f=3, seniorite=1, annonce=1, prochain_entretien=0)
        j.etat["evenement"] = None
        j._jour_personnel()
        ev = j.etat["evenement"]
        self.assertEqual((ev["type"], ev["demande"]), ("entretien", "promotion"))
        salaire = x["salaire"]
        j.action("evenement", choix=0)
        self.assertEqual(x["seniorite"], 2)
        self.assertEqual(x["salaire"], salaire + SENIORITES[2]["prime"] - SENIORITES[1]["prime"])
        self.assertEqual(x["prochain_entretien"], 360)

    def test_affinites_decouvertes_en_travaillant(self):
        j = Jeu(graine=7)
        a, b = j.etat["employes"][0], dict(j.etat["employes"][0], id=999)
        j.etat["affinites"]["%d-999" % a["id"]] = -1
        self.assertAlmostEqual(j._affinites([a, b]), 0.95)
        self.assertIn("%d-999" % a["id"], j.etat["affinites_connues"])
        self.assertAlmostEqual(j._affinites([a, b], {"chef": b["id"]}), 0.975)  # un chef de projet suit le projet

    def test_ancienne_sauvegarde(self):
        j = Jeu(graine=8)
        etat = json.loads(json.dumps(j.etat))
        for x in etat["employes"]:
            x["trait"] = "rapide"
            for cle in ("traits", "metier", "cachee", "seniorite", "annonce", "motivation", "connu", "arrivee", "prochain_entretien"):
                x.pop(cle, None)
        for c in etat["candidats"]:
            c.pop("traits")
        k = Jeu(etat)
        self.assertEqual(k.etat["employes"][0]["traits"], ["rapide"])
        self.assertTrue(all("traits" in c for c in k.etat["candidats"]))
        k.avancer(40)
        json.dumps(k.vue())


if __name__ == "__main__":
    unittest.main()
