import unittest

from moteur import ErreurJeu, Jeu
from moteur.donnees import CANAUX

from tests.test_batiment import employe, toujours


def piste(j, rivaux=()):
    o = {**j._offre(), "canal": "plateformes", "expire": 5, "rivaux": list(rivaux)}
    j.etat["pistes"].append(o)
    return o


class TestCommerce(unittest.TestCase):
    def test_quatre_rivaux_et_anciennes_parties(self):
        j = Jeu(graine=1)
        self.assertEqual(len(j.etat["concurrents"]), 4)
        e = j.etat
        e["concurrents"] = [{"nom": "ElectroConcept", "renommee": 4}, {"nom": "Volta Ingénierie", "renommee": 12}]
        e.pop("rivaux_v2")
        e["prospection"] = "maison"
        copie = Jeu(e)
        self.assertEqual([c["nom"] for c in copie.etat["concurrents"]], ["ElectroConcept", "Volta Ingénierie", "Onde & Signal"])
        self.assertEqual(copie.etat["concurrents"][0]["equipe"], 2)
        self.assertNotIn("prospection", copie.etat)

    def test_fondateur_prospecte(self):
        j = Jeu(graine=2)
        moi = j.etat["employes"][0]
        avant = j._production(moi, "e", j.bonus())
        j.action("prospecter", canal="reseaux", qui=moi["id"])
        self.assertAlmostEqual(j._production(moi, "e", j.bonus()), avant / 2)  # mi-temps au téléphone
        with self.assertRaises(ErreurJeu):
            j.action("prospecter", canal="plateformes", qui=moi["id"])  # une prospection à la fois
        nb = len(j.etat["offres"])
        toujours(j, 0.0)
        for _ in range(CANAUX["reseaux"]["jours"]):
            j._jour_commerce()
        del j.rng.random
        self.assertFalse(j.etat["prospections"])
        reservees = [o for o in j.etat["offres"] if o.get("reservee")]
        self.assertEqual(len(j.etat["offres"]) - nb, len(reservees))
        self.assertTrue(reservees and all(o["canal"] == "reseaux" for o in reservees))

    def test_canaux_contraints(self):
        j = Jeu(graine=3)
        moi = j.etat["employes"][0]["id"]
        with self.assertRaises(ErreurJeu):
            j.action("prospecter", canal="demarchage", qui=moi)  # sans secteur
        with self.assertRaises(ErreurJeu):
            j.action("prospecter", canal="inconnu", qui=moi)
        with self.assertRaises(ErreurJeu):
            j.action("prospecter", canal="reseaux", qui=9999)
        j.etat["mois"] = 1
        with self.assertRaises(ErreurJeu):
            j.action("prospecter", canal="salon", qui=moi)  # pas de salon en février
        j.etat["mois"], argent = 2, j.etat["argent"]
        j.action("prospecter", canal="salon", qui=moi)
        self.assertEqual(argent - j.etat["argent"], CANAUX["salon"]["cout"])
        self.assertIsNone(j.salon_du_mois())  # un seul salon par mois
        j.etat["argent"] = -1000
        com = employe(j, e=2, commercial=True)
        j.action("prospecter", canal="plateformes", qui=com["id"])  # gratuit : possible même dans le rouge

    def test_devis_gagne_sans_rival(self):
        j = Jeu(graine=4)
        o = piste(j)
        with self.assertRaises(ErreurJeu):
            j.action("devis", id=o["id"], prix="0.5")
        j.action("devis", id=o["id"], prix="1.1", delai="0.8")
        for _ in range(4):
            j._jour_commerce()
        gagne = next(x for x in j.etat["offres"] if x.get("gagne"))
        self.assertEqual((gagne["paie"], gagne["delai"]), (int(round(o["paie"] * 1.1, -2)), max(8, round(o["delai"] * 0.8))))
        j.action("signer", id=gagne["id"], prix="1.3")  # prix fixé par le devis : la demande est ignorée
        self.assertEqual(j.etat["projets"][0]["paie"], gagne["paie"])

    def test_devis_perdu_trop_cher(self):
        j = Jeu(graine=5)
        o = piste(j, rivaux=["ElectroConcept"])
        j.action("devis", id=o["id"], prix="1.2", delai="1.0")
        avant = j.etat["concurrents"][0]["gagnes"]
        for _ in range(4):
            j._jour_commerce()
        self.assertFalse(any(x.get("gagne") for x in j.etat["offres"]))
        self.assertEqual(j.etat["concurrents"][0]["gagnes"], avant + 1)
        self.assertIn("trop cher", j.etat["journal"][0]["texte"])

    def test_rival_grandit(self):
        j = Jeu(graine=6)
        c = j.etat["concurrents"][0]
        rep, eq = c["renommee"], c["equipe"]
        for _ in range(8):
            j._rival_gagne(c)
        self.assertEqual((c["renommee"], c["equipe"]), (rep + 1, eq + 1))


if __name__ == "__main__":
    unittest.main()
