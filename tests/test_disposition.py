"""Disposition des meubles : adossés aux murs, écartés, portes dégagées, tout accessible, même bâtiment plein."""
import unittest

from moteur.donnees import COTE_POSTES, DECO, EMPLACEMENTS, MATERIEL, PIECES, PORTES
from moteur.jeu import ErreurJeu, Jeu


def plein(graine=5):
    j = Jeu(scenario="reprise", graine=graine, difficulte="facile", entreprise="Banc", directeur="Test")
    j.etat["argent"], j.etat["renommee"] = 10 ** 7, 30
    for m in MATERIEL:
        try:
            j.action("acheter", id=m)
        except ErreurJeu:
            pass
    for d, f in DECO.items():
        for _ in range(4 if f.get("multiple") else 1):
            try:
                j.action("poser", id=d)
            except ErreurJeu:
                pass
    while True:
        try:
            j.action("poser", id="poste")
        except ErreurJeu:
            return j


class TestDisposition(unittest.TestCase):
    def test_grille_des_bureaux_contre_les_murs(self):
        for x, y in EMPLACEMENTS["poste"]:
            c = COTE_POSTES[(x, y)]
            k = next(k for k, p in PIECES.items() if p["rect"][0] <= x < p["rect"][0] + p["rect"][2] and p["rect"][1] <= y < p["rect"][1] + p["rect"][3])
            px, py, pw, ph = PIECES[k]["rect"]
            d, w = (64, 76) if c in "oe" else (76, 64)
            dos = {"n": y - py, "s": py + ph - y - w, "o": x - px, "e": px + pw - x - d}[c]
            if k != "garage" or c != "e":  # au garage, ce bureau-là s'adosse à l'étagère
                self.assertLessEqual(dos, 2, (k, x, y, c))

    def test_batiment_plein(self):
        j = plein()
        par_piece = {}
        for o in j.etat["objets"]:
            par_piece.setdefault(j.piece_de(o), []).append(o)
        libres = lambda o: j.fiche(o["type"]).get("libre") and o["type"] != "tableau"
        for k, objets in par_piece.items():
            if k is None:
                continue
            self.assertTrue(j._accessible(k, [o for o in objets if not libres(o)]), f"{k} : un meuble n'est plus accessible")
            for o in objets:
                if libres(o):
                    continue
                r = j._rect(o)
                self.assertFalse(any(r[0] < q[0] + q[2] and q[0] < r[0] + r[2] and r[1] < q[1] + q[3] and q[1] < r[1] + r[3] for q in PORTES[k]) and o["type"] == "poste", f"{k} : bureau devant une porte")
        meubles = [o for o in j.etat["objets"] if not libres(o) and j.piece_de(o)]
        loin = []
        for o in meubles:
            k, c = j.piece_de(o), o.get("cote", "n")
            px, py, pw, ph = PIECES[k]["rect"]
            w, h = j._emprise(o["type"], c)
            dos = {"n": o["y"] - py, "s": py + ph - o["y"] - h, "o": o["x"] - px, "e": px + pw - o["x"] - w}[c]
            sur_etabli = any(ex <= o["x"] and ey <= o["y"] and o["x"] + w <= ex + ew and o["y"] + h <= ey + eh for ex, ey, ew, eh in [(520, 1546, 228, 44), (532, 1678, 220, 58), (440, 408, 232, 44)])
            if dos > 2 and not sur_etabli:
                loin.append((k, o["type"]))
        self.assertLessEqual(len(loin), len(meubles) // 10, f"meubles loin d'un mur : {loin}")

    def test_sauvegarde_ancienne_rangee_a_nouveau(self):
        j = Jeu(graine=3)
        etat = j.etat
        etat["version_plan"] = 9
        for o in etat["objets"]:
            o.pop("cote", None)
        Jeu(etat)
        self.assertTrue(all("cote" in o for o in etat["objets"]))


if __name__ == "__main__":
    unittest.main()
