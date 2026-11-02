import json
import unittest

from moteur import ErreurJeu, Jeu
from moteur.donnees import DOMAINES, LOCAUX, MISSIONS, PIECES, TECHNOS


def employe(j, **comp):
    """Ajoute un employé avec un bureau posé automatiquement."""
    bureau = j._ajouter_objet("poste", *j._place_auto("poste"))["id"]
    x = j._nouvel_employe(j._candidat(), bureau, **{"e": 0, "m": 0, "f": 0, "stage": 0, "salaire": 2000, "chef": False,
                                                     "commercial": False, "role_propose": None, **comp})
    j._roles = None
    return x


def riche(graine, rep=10, emmenage=True):
    j = Jeu(graine=graine)
    j.etat["argent"], j.etat["renommee"] = 10 ** 6, rep
    if emmenage:
        j.action("local", id="bureau")
    return j


def toujours(j, valeur):
    j.rng.random = lambda: valeur  # tirages forcés (retirés avec del j.rng.random)


class TestBatiment(unittest.TestCase):
    def test_tout_ouvert(self):
        self.assertEqual(list(LOCAUX), ["bureau"])
        self.assertTrue(all(p["local"] == "bureau" for k, p in PIECES.items() if k != "garage"))
        j = riche(1, emmenage=False)
        self.assertEqual((j.capacite_projets(), j.nb_offres()), (1, 4))
        moral = j.moral_global()
        j.action("local", id="bureau")
        self.assertEqual(set(j.pieces_dispo()), set(PIECES) - {"garage"})
        self.assertEqual((j.capacite_projets(), j.nb_offres(), j.moral_global()), (2, 5, moral + 5))
        self.assertEqual(j.etat["stock_max"], 1000)
        employe(j, e=6, chef=True)
        self.assertEqual(j.capacite_projets(), 3)
        employe(j, e=2, commercial=True)
        self.assertEqual(j.nb_offres(), 6)

    def test_investissements(self):
        j = riche(20, rep=7, emmenage=False)
        with self.assertRaises(ErreurJeu):
            j.action("investir", id="formation")  # depuis le bâtiment seulement
        j.action("local", id="bureau")
        with self.assertRaises(ErreurJeu):
            j.action("investir", id="formation")  # renommée 8 requise
        j.etat["renommee"], j.etat["argent"] = 12, 10 ** 7
        x = employe(j, e=4)
        cout = j.cout_formation(x)
        j.action("investir", id="formation")
        self.assertEqual(j.cout_formation(x), int(cout * 0.5))
        with self.assertRaises(ErreurJeu):
            j.action("investir", id="formation")  # une seule fois
        capacite, offres, loyer = j.capacite_projets(), j.nb_offres(), j.loyer()
        j.action("investir", id="filiale")
        self.assertEqual((j.capacite_projets(), j.nb_offres(), j.loyer()), (capacite + 1, offres + 2, loyer + 5000))
        argent = j.etat["argent"]
        j.action("investir", id="campagne")
        self.assertEqual((argent - j.etat["argent"], j.etat["renommee"]), (100000, 14))
        with self.assertRaises(ErreurJeu):
            j.action("investir", id="campagne")  # une par an
        j.etat["derniere_campagne"] -= 360
        self.assertEqual(j.prix_investissement("campagne"), 150000)
        fort = max(j.etat["concurrents"], key=lambda c: c["renommee"])
        self.assertEqual(j.prix_investissement("rachat"), 200000 + 40000 * fort["renommee"])
        j.action("investir", id="rachat")
        j.action("investir", id="rachat")
        self.assertNotIn(fort, j.etat["concurrents"])
        self.assertEqual((len(j.etat["concurrents"]), j.etat["renommee"]), (1, 20))
        with self.assertRaises(ErreurJeu):
            j.action("investir", id="rachat")  # il reste toujours un concurrent
        for _ in range(40):
            j._jour()  # la concurrence restante fonctionne toujours (vol d'offres, débauchage)

    def test_reprise_stock_du_batiment(self):
        self.assertEqual(Jeu(graine=19, scenario="reprise").etat["stock_max"], 1000)

    def test_anciennes_parties_pas_reprises(self):
        etat = json.loads(json.dumps(Jeu(graine=2).etat))
        etat["version_plan"] = 5
        with self.assertRaises(ErreurJeu):
            Jeu(etat)

    def test_responsable_de_service(self):
        j = riche(3)
        elec = [employe(j, e=6 + i, f=1) for i in range(5)]  # avec le fondateur (élec), le service compte 6 personnes
        self.assertAlmostEqual(j.facteur_service(elec[0]), 0.92 * 1.05)  # bureau HW, sans responsable
        with self.assertRaises(ErreurJeu):
            j.action("nommer", id=elec[0]["id"], role="resp_e")  # 6 en élec : il faut 8
        chef = elec[-1]
        salaire = chef["salaire"]
        j.action("nommer", id=chef["id"], role="resp_e")
        self.assertEqual(PIECES[j.piece_de(j.objet(chef["bureau"]))]["genre"], "res")
        self.assertEqual(chef["salaire"], salaire + 800)
        membre = elec[0]
        self.assertTrue(j.encadre(membre))
        self.assertAlmostEqual(j.facteur_service(membre), 1.08 * 1.05)
        self.assertEqual(j._coordination(membre, {"suivi": 0}, [membre] * 8), 1.0)  # le responsable coordonne son service
        from moteur.donnees import SENIORITES
        membre["xp"]["e"] = 0
        j._experience(membre, "e", 10)
        attendu = 10 * SENIORITES[membre["seniorite"]]["xp"] * (1.3 if "ambitieux" in membre["traits"] else 1) * 1.25  # formation plus rapide
        self.assertAlmostEqual(membre["xp"]["e"], attendu)
        b = j.objet(chef["bureau"])
        j.action("poser", id="poste", x=b["x"], y=b["y"] + 66)  # un 2e bureau dans la pièce : plus individuel
        self.assertNotIn("resp_e", j.roles()["actifs"])
        j.action("nommer", id=chef["id"], role=None)
        self.assertEqual(chef["salaire"], salaire)

    def test_chef_d_equipe_embauche(self):
        j = riche(4)
        c = j._candidat()
        c.update(e=9, role_propose="resp_e", poste="Chef d'équipe Élec")
        x = j._nouvel_employe(c, j._ajouter_objet("poste", *j._place_auto("poste"))["id"])
        self.assertEqual(x["role"], "resp_e")
        j._roles = None
        self.assertIn("resp_e", j.roles()["actifs"])

    def test_chefs_de_projet(self):
        j = riche(5)
        a, b = employe(j, e=6, chef=True), employe(j, e=6, chef=True)
        self.assertEqual(PIECES[j.piece_de(j.objet(a["bureau"]))].get("fonction"), "cdp")
        for t in (300, 200, 100):
            p = j._creer_projet({"nom": "x", "client": "c", "taille": t, "total": {"e": t, "m": 0, "f": 0}, "paie": t * 70}, "contrat")
            j.etat["projets"].append(p)
        j._suivi_chefs()
        suivis = sorted(p["suivi"] for p in j.etat["projets"])
        self.assertEqual(suivis, [0.707, 0.707, 1.0])  # un chef suit 2 projets, l'autre 1 : l'effet baisse avec la charge
        p = j.etat["projets"][0]
        self.assertGreater(j._mult_chef(p), 1)
        self.assertGreater(j.note(p), j.note({**p, "suivi": 0}))
        seul = {**p, "suivi": 0}
        self.assertAlmostEqual(j._coordination(employe(j, f=4), seul, [None] * 6), 0.91)

    def test_delais_selon_renommee(self):
        for rep in (0, 3, 7, 20):
            diviseur = 1 + 0.3 * min(max(0, rep - 3), 8)  # 1 ; 1 ; 2,2 ; 3,4
            j = Jeu(graine=18)
            j.etat["renommee"] = rep
            for _ in range(10):
                o = j._offre()
                t = o["taille"]
                self.assertEqual(o["delai"], max(12, round((14 + t * (0.5 - min(0.3, t / 1500))) / diviseur)))

    def test_progression_salaire(self):
        j = riche(17)
        x = employe(j, e=3)
        salaire = x["salaire"]
        x["xp"]["e"] = 60 + 6 * 3 ** 2  # juste au seuil du point suivant
        j._experience(x, "e", 0)
        self.assertEqual((x["e"], x["salaire"]), (4, salaire + 115))  # un point gagné en travaillant : la moitié du prix du marché

    def test_chef_compose_l_equipe(self):
        j = riche(14)
        employe(j, e=6, chef=True)
        fw = employe(j, f=9)
        meca = employe(j, m=9)
        suivi = j._creer_projet({"nom": "suivi", "client": "c", "taille": 100, "total": {"e": 0, "m": 50, "f": 50}, "paie": 7000}, "contrat")
        gros = j._creer_projet({"nom": "gros", "client": "c", "taille": 900, "total": {"e": 300, "m": 300, "f": 300}, "paie": 60000}, "contrat")
        for p in (suivi, gros):
            p["phases"] = [{"nom": "x", "besoin": dict(p["total"]), "fait": {d: 0.0 for d in p["total"]}}]
            j.etat["projets"].append(p)
        for _ in range(3):
            employe(j, m=1, f=1)["projet"] = suivi["id"]  # trois débutants affectés d'office au petit projet
        j._suivi_chefs()
        gros["chef"] = None  # le chef ne suit que le petit projet
        equipes = j._repartir()
        ids = {x["id"] for x in equipes[suivi["id"]]}
        self.assertTrue({fw["id"], meca["id"]} <= ids)  # il a pris le meilleur firmware et le meilleur méca libres
        suivi["chef"] = None
        equipes = j._repartir()
        self.assertFalse({fw["id"], meca["id"]} <= {x["id"] for x in equipes[suivi["id"]]})  # sans chef, le petit projet est jugé plein : ils partent sur le gros

    def test_prime_du_client(self):
        j = riche(15)
        payes = []
        for chef in (None, 1):
            p = j._creer_projet({"nom": "x", "client": "c", "taille": 100, "total": {"e": 100, "m": 0, "f": 0}, "paie": 10000}, "contrat")
            p.update(chef=chef, suivi=1.0 if chef else 0, defauts=0, jours=10, delai=40)
            j.etat["projets"].append(p)
            argent = j.etat["argent"]
            j._terminer(p)
            payes.append(j.etat["argent"] - argent)
        self.assertGreater(payes[1], payes[0])  # note un peu meilleure et prime de 8 % du contrat

    def test_commerciaux_offres_mieux_payees(self):
        sans, avec = riche(16), riche(16)
        for _ in range(3):
            employe(avec, e=1, commercial=True)
        for j in (sans, avec):
            j.rng.seed(3)
            j.etat["moyenne"] = [j._offre() for _ in range(40)]
        ratio = sum(o["paie"] / o["taille"] for o in avec.etat["moyenne"]) / sum(o["paie"] / o["taille"] for o in sans.etat["moyenne"])
        self.assertGreater(ratio, 1.08)

    def test_indus_et_qualif(self):
        j = riche(6)
        o = dict(j.etat["offres"][0], secteur="industrie", taille=100, total={"e": 60, "m": 20, "f": 20}, paie=8000)
        j.etat["offres"][0] = o
        argent = j.etat["argent"]
        j.action("signer", id=o["id"], tech={"indus": "produit", "qualif": "produit"})
        p = j.etat["projets"][0]
        noms = [ph["nom"] for ph in p["phases"]]
        self.assertIn("Industrialisation du produit", noms)
        self.assertEqual(p["phases"][-1]["essais"], 7)
        self.assertEqual(argent - j.etat["argent"], (6 + 5) * 100 - p["acompte"])
        exigeant = dict(j.etat["offres"][0], secteur="aero")
        j.etat["offres"][0] = exigeant
        with self.assertRaises(ErreurJeu):
            j.action("signer", id=exigeant["id"], tech={"qualif": "aucune"})  # l'aéro exige une qualification
        # garanties : l'indus et la qualif évitent les défauts chez le client
        q = {**p, "defauts": 10.0, "taille": 300}
        j._apres_livraison(q, 7.0, 0)
        avec = j.etat["garanties"][-1]["defauts"]
        j._apres_livraison({**q, "choix": {}}, 7.0, 0)
        self.assertLess(avec, j.etat["garanties"][-1]["defauts"])
        # séries : plus fréquentes (35 % + 10 % par niveau d'indus) et mieux margées avec l'indus
        toujours(j, 0.5)
        j.etat["offre_serie"] = None
        j._apres_livraison({**q, "choix": {}}, 8.0, 0)
        self.assertIsNone(j.etat["offre_serie"])
        j._apres_livraison(q, 8.0, 0)
        del j.rng.random
        self.assertEqual(j.etat["offre_serie"]["indus"], round(1 + 0.3 * 2 * j.qualite_etape("indus", "indus"), 2))

    def test_lots_stock_et_ventes(self):
        j = riche(7, emmenage=False)
        p = j._creer_projet({"nom": "Station", "taille": 110, "total": {"e": 50, "m": 30, "f": 30}, "potentiel": 4500, "id_produit": "meteo"}, "produit")
        p["choix"] = {}
        j.etat["projets"].append(p)
        j._terminer(p)
        prod = j.etat["produits"][0]
        self.assertEqual((prod["stock"], prod["prix"]), (0, 75))
        with self.assertRaises(ErreurJeu):
            j.action("commander", id="meteo", qte=500)  # garage : 200 unités de stock
        argent = j.etat["argent"]
        j.action("commander", id="meteo", qte=50)
        self.assertEqual(argent - j.etat["argent"], int(round(50 * prod["cout_unite"], -1)))
        toujours(j, 0.99)  # pas de retard, pas de défaut
        for _ in range(20):
            j._lots_du_jour()
        del j.rng.random
        self.assertEqual(prod["stock"], 50)
        demande = prod["demande"]
        ventes, frais = j._ventes_du_mois()
        self.assertEqual(frais, 15)  # 50 unités × 0,30 €
        self.assertEqual(prod["stock"], 50 - min(50, demande))
        self.assertEqual(ventes, int(round(min(50, demande) * 75 * (1 - prod["pannes"]))))

    def test_controle_reception(self):
        j = riche(8)
        j.etat["produits"].append({"nom": "X", "id_produit": "x", "note": 7, "prix": 50, "stock": 0, "mois": 0, "total": 0,
                                   "demande": 40, "cout_unite": 25, "defaut_lot": 1.0, "pannes": 0.04, "ventes": 2000})
        j.etat["commandes"].append({"produit": "x", "nom": "X", "qte": 100, "jours": 1, "retard": True})
        toujours(j, 0.0)  # lot défectueux et repéré
        j._lots_du_jour()
        del j.rng.random
        self.assertEqual((j.etat["commandes"][0]["jours"], j.etat["produits"][0]["stock"]), (15, 0))  # renvoyé au sous-traitant

    def test_commerciaux(self):
        j = riche(9)
        o = j.etat["offres"][0]
        with self.assertRaises(ErreurJeu):
            j.action("negocier", id=o["id"], cible="prix")  # pas de commercial
        employe(j, e=2, commercial=True)
        paie = o["paie"]
        toujours(j, 0.0)
        j.action("negocier", id=o["id"], cible="prix")
        self.assertEqual(o["paie"], int(round(paie * 1.15, -2)))
        with self.assertRaises(ErreurJeu):
            j.action("negocier", id=o["id"], cible="delai")  # une seule fois par offre
        j.action("prospecter", id="maison")
        offres = [j._offre() for _ in range(20)]
        del j.rng.random
        self.assertTrue(all(x["secteur"] == "maison" for x in offres if not x["fidele"]))
        autre = j.etat["offres"][1]
        toujours(j, 0.999)
        j.action("negocier", id=autre["id"], cible="delai")  # ratée : le client part
        del j.rng.random
        self.assertNotIn(autre, j.etat["offres"])
        employe(j, e=2, commercial=True)
        argent = j.etat["argent"]
        j.action("signer", id=o["id"], tech={"qualif": "carte"} if o["secteur"] in ("mobilite", "aero", "medical", "spatial") else {})
        pr = j.etat["projets"][0]
        self.assertEqual(argent - j.etat["argent"], int(round(pr["paie"] * 0.06 * 2, -1)) - pr["acompte"])  # 6 % par commercial

    def test_direction_rd_innovation_brevets(self):
        j = riche(10)
        directeur = employe(j, e=8, m=6, f=7)
        inventeur = employe(j, e=5, m=4, f=4)
        with self.assertRaises(ErreurJeu):
            j.action("produit", id="eolienne")  # idée réservée au chargé d'innovation
        j.action("nommer", id=directeur["id"], role="dir_rd")
        j.action("nommer", id=inventeur["id"], role="innov")
        self.assertEqual({j.piece_de(j.objet(x["bureau"])) for x in (directeur, inventeur)}, {"rd"})
        argent = j.etat["argent"]
        j.action("recherche", id="ble")
        self.assertEqual(argent - j.etat["argent"], int(TECHNOS["ble"]["prix"] * 0.75))
        possibles = []
        j._evenements_extensions(possibles)
        j.etat["evenement"] = next(x for x in possibles if x["type"] == "brevet")
        j.action("evenement", choix=0)
        self.assertEqual(len(j.etat["brevets"]), 1)

    def test_direction_generale(self):
        j = riche(11)
        chance, levee = j.chance_negociation(1.2, 1.0), j.montant_levee()
        fondateur = j.etat["employes"][0]
        x, y = PIECES["dg"]["rect"][:2]
        j.action("deplacer", id=fondateur["bureau"], x=x + 8, y=y + 8)
        self.assertTrue(j.dg_actif())
        self.assertAlmostEqual(j.chance_negociation(1.2, 1.0), chance + 0.1)
        self.assertEqual(j.montant_levee(), int(levee * 1.3))

    def test_missions_toutes_mesurables(self):
        j = riche(12)
        for mid, _, cle, *_ in MISSIONS:
            self.assertIsInstance(j._mesure(cle), int, mid)
            if cle.startswith("local:"):
                self.assertIn(cle[6:], LOCAUX, mid)

    def test_services_dans_la_vue(self):
        j = riche(13, emmenage=False)
        v = j.vue()
        self.assertEqual(set(v["services"]), set(DOMAINES))
        self.assertEqual(v["employes"][0]["piece"], "garage")


if __name__ == "__main__":
    unittest.main()
