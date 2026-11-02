import json
import unittest

from moteur import ErreurJeu, Jeu
from moteur.donnees import CONTRATS, SCENARIOS


def jour(j, n=1):
    for _ in range(n):
        j.etat["evenement"] = None
        j.etat.pop("dernier_livre", None)
        j.etat.pop("bilan", None)
        j._jour()


class TestExtensions(unittest.TestCase):
    def test_choix_techniques(self):
        j = Jeu(graine=1)
        o = dict(j.etat["offres"][0], total={"e": 40, "m": 20, "f": 40}, taille=100)
        j.etat["offres"][0] = o
        argent = j.etat["argent"]
        j.action("signer", id=o["id"], tech={"couches": "6", "mcu": "esp32", "boitier": "injection"})
        p = j.etat["projets"][0]
        self.assertEqual(p["total"], {"e": 40, "m": 25, "f": 34})
        self.assertEqual(j.etat["argent"], argent - 3000 + p["acompte"])
        self.assertAlmostEqual(j._note_bonus(p), 0.7)
        with self.assertRaises(ErreurJeu):
            j.action("signer", id=j.etat["offres"][0]["id"], tech={"mcu": "nrf"})  # BLE requis

    def test_negociation(self):
        j = Jeu(graine=2)
        self.assertEqual(j.chance_negociation(1.0, 1.0), 1.0)
        self.assertLess(j.chance_negociation(1.3, 1.2), 0.5)
        j.etat["argent"] = 100000
        j.action("local", id="bureau")
        perdus = gagnes = 0
        for _ in range(30):
            if not j.etat["offres"]:
                j.etat["offres"].append(j._offre())
            n = len(j.etat["projets"])
            j.etat["projets"].clear()
            j.action("signer", id=j.etat["offres"][0]["id"], prix="1.3")
            if j.etat["projets"]:
                gagnes += 1
                self.assertEqual(j.etat["projets"][0]["paie"] % 10, 0)
            else:
                perdus += 1
        self.assertGreater(perdus, 0)
        self.assertGreater(gagnes, 0)

    def test_recherche_et_certifications(self):
        j = Jeu(graine=3)
        j.etat["argent"] = 200000
        with self.assertRaises(ErreurJeu):
            j.action("recherche", id="ia")  # BLE d'abord
        j.action("recherche", id="ble")
        with self.assertRaises(ErreurJeu):
            j.action("recherche", id="rf")  # une à la fois
        j.action("certifier", id="ce")
        jour(j, 30)
        self.assertIn("ble", j.etat["technos"])
        self.assertIn("ce", j.etat["certifs"])
        self.assertEqual(j.bonus()["f"], 2)  # ST-Link + BLE
        j.etat["renommee"] = 20
        requis = {j._offre()["requis"] for _ in range(300)}
        self.assertIn("ble", requis)
        self.assertNotIn("rf", requis)

    def test_sav_et_series(self):
        j = Jeu(graine=4)
        p = j._creer_projet({"nom": "Carte", "client": "DomoSud", "taille": 100, "total": {"e": 60, "m": 0, "f": 40}, "paie": 9000}, "contrat")
        p["defauts"] = 50.0
        j.etat["argent"] = 100000
        j.rng.random = lambda: 0.0  # tout arrive
        j._apres_livraison(p, 8.0, 5000)
        self.assertEqual(len(j.etat["garanties"]), 1)
        self.assertIsNotNone(j.etat["offre_serie"])
        j._fin_jour_extensions()
        self.assertEqual(j.etat["evenement"]["type"], "sav")
        argent = j.etat["argent"]
        j.action("evenement", choix=0)
        self.assertLess(j.etat["argent"], argent)
        j._fin_jour_extensions()
        self.assertEqual(j.etat["evenement"]["type"], "serie")
        j.action("evenement", choix=0)
        self.assertEqual(len(j.etat["series"]), 1)
        del j.rng.random

    def test_series_rapportent(self):
        j = Jeu(graine=5)
        j.etat["series"].append({"nom": "X", "client": "Y", "mois": 2, "marge": 1000})
        rec, _, _, _ = j._mois_extensions()
        self.assertEqual(rec, 1000)
        j._mois_extensions()
        self.assertEqual(j.etat["series"], [])

    def test_fournisseur_et_proto(self):
        j = Jeu(graine=6)
        p = j._creer_projet({"nom": "x", "taille": 100, "total": {"e": 50, "m": 20, "f": 30}}, "contrat")
        j.etat["projets"].append(p)
        j.action("fournisseur", id="asie")
        p["phase"] = 2
        j._entrer_phase(p)
        self.assertEqual(p["phases"][2]["attente"], 6)
        self.assertEqual(p["phases"][2]["cout"], 240)
        j.etat["argent"] = 100000
        j.etat["prets"].append({"montant": 24000, "mensualite": 1120, "mois": 24})
        argent, charges = j.etat["argent"], j.etat["exercice"]["charges"]
        _, dep, _, capital = j._mois_extensions()
        self.assertEqual((capital, dep), (1000, 120))  # seuls les intérêts sont des charges
        j.action("rembourser")
        self.assertEqual(j.etat["argent"], argent - 23000)

    def test_prets_et_levee(self):
        j = Jeu(graine=7)
        argent = j.etat["argent"]
        j.action("emprunter", montant=10000)
        self.assertEqual(j.etat["argent"], argent + 10000)
        self.assertEqual(j.mensualites(), 467)
        with self.assertRaises(ErreurJeu):
            j.action("emprunter", montant=25000)  # plafond 20 000 € à renommée 0
        with self.assertRaises(ErreurJeu):
            j.action("lever")
        j.etat["renommee"] = 6
        j.action("lever")
        self.assertEqual(j.etat["parts"], 0.8)
        j.etat["prets"][0]["mois"] = 1
        j._mois_extensions()
        self.assertEqual(j.etat["prets"], [])

    def test_chef_seminaire_stage(self):
        j = Jeu(graine=8)
        j.etat["argent"] = 100000
        fondateur = j.etat["employes"][0]
        with self.assertRaises(ErreurJeu):
            j.action("promouvoir", id=fondateur["id"])  # 11 points seulement
        fondateur["e"] = 8
        j.action("promouvoir", id=fondateur["id"])
        self.assertTrue(fondateur["chef"])
        self.assertEqual(j._mult_chef({"chef": fondateur["id"], "suivi": 1}), 1.06)
        j.action("seminaire")
        self.assertEqual(fondateur["absence"], "seminaire")
        with self.assertRaises(ErreurJeu):
            j.action("seminaire")
        jour(j, 2)
        self.assertIsNone(fondateur["absence"])
        j.etat["evenement"] = {"type": "stage", "titre": "x", "texte": "x", "options": ["a", "b"]}
        j.action("evenement", choix=0)
        stagiaire = j.etat["employes"][-1]
        self.assertEqual((stagiaire["salaire"], stagiaire["stage"]), (0, 90))
        stagiaire["stage"] = 1
        j.etat["evenement"] = None
        j._fin_jour_extensions()
        self.assertEqual(j.etat["evenement"]["type"], "fin_stage")
        j.action("evenement", choix=0)
        self.assertGreater(stagiaire["salaire"], 0)

    def test_anniversaire_et_meteo(self):
        j = Jeu(graine=9)
        f = j.etat["employes"][0]
        f["anniv"] = [j.etat["mois"], j.etat["jour"] + 1]
        jour(j)
        self.assertEqual(j.etat["fete"]["type"], "anniv")
        self.assertEqual(f["lieu"], "fete")
        meteos, changements, hier = set(), 0, j.etat["meteo"]
        for _ in range(400):
            jour(j)
            meteos.add(j.etat["meteo"])
            changements += j.etat["meteo"] != hier
            hier = j.etat["meteo"]
        self.assertTrue({"soleil", "pluie", "neige"} <= meteos)
        self.assertLess(changements, 120)  # le temps dure plusieurs jours, il ne clignote pas d'un jour à l'autre

    def test_scenarios_et_difficulte(self):
        for sc in SCENARIOS:
            for diff in ("facile", "normal", "difficile"):
                j = Jeu(graine=10, scenario=sc, difficulte=diff)
                jour(j, 5)
                json.dumps(j.vue())
        j = Jeu(graine=11, scenario="reprise", difficulte="normal")
        self.assertEqual(len(j.etat["employes"]), 4)
        self.assertEqual(len(j.etat["prets"]), 1)
        j = Jeu(graine=12, scenario="iot")
        j.etat["stats"]["produits_lances"] = 4
        j._verifier_objectif()
        self.assertTrue(j.etat["victoire"]["ok"])
        self.assertTrue(j.en_pause())
        j.action("fermer_victoire")
        self.assertFalse(j.en_pause())
        with self.assertRaises(ErreurJeu):
            Jeu(scenario="inconnu")
        j = Jeu(graine=13, difficulte="difficile")
        j.etat["exercice"]["ca"] = 30000
        j.etat["jours_total"] = 359
        jour(j)
        self.assertEqual(j.etat["bilans"][-1]["impot"], round((30000 - j.etat["bilans"][-1]["charges"]) * 0.33, -1))

    def test_clients_fideles(self):
        j = Jeu(graine=40)
        o = j.etat["offres"][0]
        p = j._creer_projet(o, "contrat")
        p.update(client="DomoSud", secteur="maison")
        for _ in range(3):
            j._apres_livraison(p, 10, 0)  # notes largement au-dessus de l'attente : +2 par livraison
        c = j.etat["clients"]["DomoSud"]
        self.assertEqual((c["fid"], c["livres"]), (5, 3))
        self.assertEqual(j.etat["stats"]["secteurs"]["maison"], 3)
        j._apres_livraison(p, 1, 0)
        self.assertEqual(c["fid"], 3)  # une très mauvaise note fait reculer
        offres = [j._offre() for _ in range(200)]
        fideles = [x for x in offres if x["fidele"]]
        self.assertTrue(fideles and all(x["client"] == "DomoSud" and x["secteur"] == "maison" for x in fideles))
        self.assertGreater(j.chance_negociation(1.3, 1.0, fid=3), j.chance_negociation(1.3, 1.0))

    def test_mega_projet(self):
        j = Jeu(graine=41)
        e = j.etat
        e["renommee"], e["technos"], e["argent"] = 12, ["moteur", "rf"], 100000
        mega = j._offre_mega()
        self.assertEqual((mega["nom"], mega["equipe_min"]), ("Flotte de drones de livraison", 6))
        e["offres"].append(mega)
        with self.assertRaises(ErreurJeu):
            j.action("signer", id=mega["id"])  # équipe trop petite
        for _ in range(5):
            j._nouvel_employe(j._candidat(), None)
        for x in e["employes"]:
            x["chef"] = False  # un chef de projet ajouterait une place
        with self.assertRaises(ErreurJeu):
            j.action("signer", id=mega["id"])  # 2 places nécessaires, le garage n'en a qu'une
        e["locaux"].append("bureau")
        j.action("signer", id=mega["id"])
        self.assertEqual((j.places_occupees(), e["projets"][0]["mega"]), (2, True))
        with self.assertRaises(ErreurJeu):
            j.action("signer", id=e["offres"][0]["id"])  # complet
        j._apres_livraison(e["projets"][0], 8, 0)
        self.assertEqual(e["stats"]["megas"], 1)

    def test_suites_de_produits(self):
        j = Jeu(graine=42)
        e = j.etat
        e["renommee"], e["argent"] = 5, 100000
        with self.assertRaises(ErreurJeu):
            j.action("produit", id="meteo2")  # la v1 d'abord
        with self.assertRaises(ErreurJeu):
            j.action("produit", id="chargeur")  # USB-C requis
        e["gammes"]["meteo"] = 9
        j.action("produit", id="meteo2")
        self.assertEqual(e["projets"][0]["potentiel"], round(7500 * 1.24))
        j._apres_livraison(e["projets"][0], 8, 0)
        self.assertEqual((e["stats"]["suites"], e["gammes"]["meteo2"]), (1, 8))

    def test_missions(self):
        j = Jeu(graine=43)
        e = j.etat
        self.assertEqual([m["id"] for m in j.vue()["missions_actives"]], ["m_premier", "m_equipe2", "m_bureau"])
        argent = e["argent"]
        e["stats"]["livres"] = 1
        e["locaux"].append("bureau")
        j._verifier_missions()
        self.assertEqual(e["missions"], ["m_premier", "m_bureau"])
        self.assertEqual(e["argent"], argent + 2500)
        self.assertEqual(j.vue()["missions_actives"][0]["id"], "m_equipe2")
        ancien = json.loads(json.dumps(e))
        for cle in ("clients", "gammes", "missions"):
            ancien.pop(cle)
        for cle in ("megas", "suites", "series", "secteurs", "meilleure_note"):
            ancien["stats"].pop(cle)
        json.dumps(Jeu(ancien).vue())  # ancienne sauvegarde : complétée sans erreur

    def test_contrats_requis_existent(self):
        from moteur.donnees import CERTIFS, MEGAS, MISSIONS, PRODUITS, SECTEURS, TECHNOS
        from moteur.extensions import requis_liste
        connus = set(TECHNOS) | set(CERTIFS)
        for c in CONTRATS + MEGAS:
            self.assertTrue(set(requis_liste(c[4])) <= connus, c[0])
            self.assertIn(c[5], SECTEURS, c[0])
        self.assertEqual([c[3] for c in CONTRATS], sorted(c[3] for c in CONTRATS))  # tirage pondéré par l'ordre
        ids = {p["id"] for p in PRODUITS}
        for p in PRODUITS:
            self.assertTrue(p.get("suite") in ids | {None} and p.get("requis") in set(TECHNOS) | {None}, p["id"])
        j = Jeu(graine=1)
        for m in MISSIONS:
            j._mesure(m[2])  # chaque mesure de mission existe


if __name__ == "__main__":
    unittest.main()
