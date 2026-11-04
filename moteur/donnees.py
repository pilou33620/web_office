"""Catalogues du jeu : matériel, aménagement, locaux, traits, contrats, produits."""

DOMAINES = ("e", "m", "f")
NOM_DOMAINE = {"e": "Élec", "m": "Méca 3D", "f": "Firmware"}

# Deux cartes : le garage du fondateur au départ, puis le bâtiment de bureaux (local « bureau » = déménagement).
# Le bâtiment a trois étages ; chacun occupe sa bande du monde (y0), l'interface en montre un à la fois.
# Le garage et le RDC se recouvrent mais ne servent jamais ensemble (cartes exclusives).
ETAGES = {
    "rdc": {"nom": "RDC", "y0": 0, "w": 1300, "h": 880},
    "r1": {"nom": "R1", "y0": 1000, "w": 1300, "h": 770},
    "r2": {"nom": "R2", "y0": 2000, "w": 840, "h": 720},
}


def _p(etage, nom, x, y, w, h, local, genre="bureau", **extra):
    return {"nom": nom, "rect": (x, y + ETAGES[etage]["y0"], w, h), "local": local, "carte": "batiment", "etage": etage,
            "genre": genre, **extra}


# Pièces : intérieur utilisable (coordonnées du monde, en px), entrée côté rue en bas ; tout s'ouvre à l'emménagement.
# fonction : pièce où s'installent les gens d'un métier (bureau indus, labo de qualif, chefs de projet, commerciaux)
# genre : bureau (postes de travail), res (bureau individuel de responsable), rd (direction R&D), dg (direction générale),
# reunion, bulle, cantine, cafet, labo, atelier, sav, stock, etuves, indus, reception, accueil ; service : domaine du service
PIECES = {
    "garage":      {"nom": "Garage", "rect": (440, 408, 232, 232), "local": None, "carte": "garage", "etage": "garage", "genre": "garage"},
    # RDC
    "supply":       _p("rdc", "Supply chain", 1128, 274, 146, 170, "bureau"),
    "sav":          _p("rdc", "SAV", 980, 274, 98, 206, "bureau", "sav"),
    "stock":        _p("rdc", "Stock", 24, 26, 402, 710, "bureau", "stock"),
    "stock2":       _p("rdc", "Stock", 436, 26, 422, 254, "bureau", "stock"),
    "atlas":        _p("rdc", "Salle Atlas", 1088, 26, 186, 238, "bureau", "reunion"),
    "reception":    _p("rdc", "Contrôle réception", 868, 26, 210, 178, "bureau", "reception"),
    "labo_indus":   _p("rdc", "Ligne pilote", 1128, 454, 146, 282, "bureau", "indus"),
    "atelier":      _p("rdc", "Atelier", 1028, 550, 90, 186, "bureau", "atelier"),
    "etuves":       _p("rdc", "Étuves", 680, 550, 338, 186, "bureau", "etuves"),
    "accueil":      _p("rdc", "Accueil", 436, 490, 234, 246, "bureau", "accueil"),
    # R1 (les pièces sans nom sur le plan accueillent la direction R&D et les responsables)
    "rd":           _p("r1", "Direction R&D", 1076, 26, 198, 150, "bureau", "rd"),
    "res1":         _p("r1", "Responsable", 24, 222, 154, 130, "bureau", "res"),
    "res2":         _p("r1", "Responsable", 32, 362, 146, 130, "bureau", "res"),
    "res3":         _p("r1", "Responsable", 1116, 318, 158, 126, "bureau", "res"),
    "orion":        _p("r1", "Salle Orion", 1132, 186, 142, 122, "bureau", "reunion"),
    "cdp":          _p("r1", "Chefs de projet", 1132, 454, 142, 282, "bureau", fonction="cdp"),
    "fw1":          _p("r1", "Firmware 1", 796, 546, 270, 190, "bureau", service="f"),
    "meca":         _p("r1", "Méca", 328, 546, 150, 190, "bureau", service="m"),
    "fw2":          _p("r1", "Firmware 2", 340, 26, 286, 186, "bureau", service="f"),
    "qualif":       _p("r1", "Labo de qualification", 32, 546, 286, 190, "bureau", fonction="qualif"),
    "bulle1":       _p("r1", "Bulle", 248, 282, 82, 94, "bureau", "bulle"),
    "bulle2":       _p("r1", "Bulle", 248, 386, 82, 98, "bureau", "bulle"),
    "cafet1":       _p("r1", "Coin café", 948, 282, 118, 202, "bureau", "cafet"),
    "hw":           _p("r1", "HW", 796, 26, 270, 186, "bureau", service="e"),
    "labo":         _p("r1", "Laboratoire", 488, 546, 298, 190, "bureau", "labo"),
    "dt":           _p("r1", "DT", 636, 26, 150, 186, "bureau"),
    "indus":        _p("r1", "Bureau indus", 24, 26, 306, 186, "bureau", fonction="indus"),
    # R2
    "vega":         _p("r2", "Salle Véga", 1080, 24, 194, 330, "bureau", "reunion"),
    "cantine":      _p("r2", "Salle de pause", 872, 364, 198, 370, "bureau", "cantine"),
    "opensp":       _p("r2", "Commerciaux", 1080, 364, 194, 370, "bureau", fonction="commerciaux"),
    "bulle3":       _p("r2", "Bulle", 872, 280, 134, 74, "bureau", "bulle"),
    "lyra":         _p("r2", "Salle Lyra", 564, 24, 198, 190, "bureau", "reunion"),
    "direction":    _p("r2", "Responsable", 772, 24, 90, 190, "bureau", "res"),
    "dg":           _p("r2", "Direction générale", 872, 24, 198, 190, "bureau", "dg"),
}
# Pièces où poser un poste, dans l'ordre de remplissage ; bureaux individuels et direction : seulement à la main
TRAVAIL = ["garage", "hw", "fw1", "meca", "fw2", "supply", "cdp", "qualif", "dt", "indus", "opensp",
           "res1", "res2", "res3", "direction", "rd", "dg"]
# Ordre de placement automatique de la déco (toutes les pièces)
INTERIEUR = ["garage", "hw", "fw1", "meca", "fw2", "supply", "cdp", "qualif", "dt", "indus", "opensp", "accueil", "cantine", "cafet1",
             "labo", "atelier", "rd", "dg", "res1", "res2", "res3", "direction", "atlas", "orion", "vega", "lyra",
             "sav", "stock", "stock2", "etuves", "labo_indus", "reception", "bulle1", "bulle2", "bulle3"]
assert sorted(INTERIEUR) == sorted(PIECES)
assert sorted(TRAVAIL) == sorted(k for k, p in PIECES.items() if p["genre"] in ("garage", "bureau", "res", "rd", "dg"))
# Murs extérieurs (rectangles dont l'union fait l'étage ; le R2 a une terrasse et l'escalier qui dépasse sur le toit),
# parties communes non louables, cloisons intérieures [x1, y1, x2, y2] (un trou = une porte), ouvertures dans les murs
# extérieurs (entrée, portes de la terrasse) et lieux dehors où l'on peut aller (parvis, terrasse), par étage
COQUES = {"rdc": [(20, 20, 1260, 720)], "r1": [(20, 1020, 1260, 720)], "r2": [(448, 2276, 112, 208), (560, 2020, 720, 464), (768, 2484, 512, 256)]}
COMMUNS = {
    "rdc": [("escalier", 432, 336, 164, 148), ("technique", 432, 276, 128, 60), ("wc", 668, 276, 164, 208), ("wc", 832, 276, 92, 60), ("douches", 832, 336, 92, 148)],
    "r1": [("technique", 336, 1296, 112, 100), ("cagibi", 336, 1396, 112, 92), ("escalier", 448, 1276, 184, 212), ("wc", 692, 1276, 176, 212), ("cagibi", 868, 1380, 76, 108)],
    "r2": [("escalier", 448, 2276, 180, 208), ("wc", 688, 2276, 180, 208)],
}
CLOISONS = {
    "rdc": [(864, 20, 864, 208), (1084, 20, 1084, 208), (832, 208, 864, 208), (1084, 208, 1124, 208), (1124, 208, 1124, 224), (976, 268, 976, 448), (976, 268, 1084, 268), (1084, 268, 1084, 484), (1124, 268, 1280, 268), (432, 276, 432, 516), (432, 276, 880, 276), (560, 276, 560, 336), (668, 276, 668, 352), (832, 276, 832, 484), (924, 276, 924, 484), (432, 336, 560, 336), (832, 336, 924, 336), (668, 392, 668, 484), (1124, 448, 1124, 504), (1124, 448, 1280, 448), (432, 484, 596, 484), (676, 484, 832, 484), (832, 484, 880, 484), (1024, 484, 1084, 484), (676, 544, 676, 740), (676, 544, 924, 544), (976, 544, 1024, 544), (1024, 544, 1024, 740), (1060, 544, 1124, 544), (1124, 544, 1124, 740), (432, 552, 432, 740)],
    "r1": [(336, 1020, 336, 1216), (632, 1020, 632, 1216), (792, 1020, 792, 1216), (1072, 1020, 1072, 1216), (1128, 1180, 1280, 1180), (20, 1216, 184, 1216), (184, 1216, 184, 1312), (244, 1216, 336, 1216), (516, 1216, 632, 1216), (676, 1216, 792, 1216), (944, 1216, 1072, 1216), (1128, 1216, 1128, 1312), (244, 1276, 244, 1312), (244, 1276, 336, 1276), (336, 1276, 336, 1488), (448, 1276, 448, 1488), (448, 1276, 632, 1276), (692, 1276, 868, 1276), (692, 1276, 692, 1356), (868, 1276, 868, 1488), (944, 1276, 944, 1488), (944, 1276, 980, 1276), (1028, 1276, 1072, 1276), (1072, 1276, 1072, 1488), (336, 1296, 360, 1296), (396, 1296, 448, 1296), (1128, 1312, 1280, 1312), (244, 1344, 244, 1416), (28, 1356, 184, 1356), (244, 1380, 336, 1380), (868, 1380, 944, 1380), (184, 1396, 184, 1488), (336, 1396, 448, 1396), (692, 1432, 692, 1488), (244, 1448, 244, 1488), (1112, 1448, 1280, 1448), (1128, 1448, 1128, 1540), (244, 1488, 280, 1488), (336, 1488, 408, 1488), (448, 1488, 632, 1488), (692, 1488, 868, 1488), (868, 1488, 904, 1488), (944, 1488, 980, 1488), (1028, 1488, 1072, 1488), (28, 1496, 184, 1496), (244, 1540, 324, 1540), (324, 1540, 324, 1740), (360, 1540, 484, 1540), (484, 1540, 484, 1740), (516, 1540, 752, 1540), (792, 1540, 792, 1740), (944, 1540, 1072, 1540), (1072, 1540, 1072, 1740)],
    "r2": [(768, 2020, 768, 2220), (868, 2020, 868, 2220), (1076, 2020, 1076, 2220), (560, 2220, 724, 2220), (796, 2220, 868, 2220), (904, 2220, 1076, 2220), (560, 2276, 628, 2276), (688, 2276, 868, 2276), (688, 2276, 688, 2328), (868, 2276, 868, 2484), (868, 2276, 972, 2276), (1012, 2276, 1012, 2360), (868, 2360, 1028, 2360), (1076, 2360, 1076, 2524), (1136, 2360, 1280, 2360), (688, 2412, 688, 2484), (688, 2484, 868, 2484), (1076, 2588, 1076, 2632), (1076, 2696, 1076, 2740)],
}
OUVERTURES = {"rdc": [(596, 740, 676, 740)], "r1": [], "r2": [(768, 2536, 768, 2572), (628, 2484, 688, 2484)]}
DEHORS = {"rdc": [(560, 740, 148, 48)], "r1": [], "r2": [(560, 2484, 208, 256)]}
# Mobilier fixe des pièces : rien ne peut y être posé ; plan.js le dessine d'après son type
MEUBLES = {
    "garage": [("etagere", 636, 468, 32, 112)],
    "batiment": [("cuisine", 878, 2364, 186, 30), ("comptoir", 470, 600, 130, 26), ("ligne", 1236, 460, 34, 264), ("etuve", 702, 550, 214, 34),
                 ("rayonnage_v", 30, 30, 48, 664), ("rayonnage_v", 182, 30, 48, 664), ("rayonnage_v", 236, 30, 48, 664),
                 ("rayonnage_v", 380, 280, 40, 440)]
                + [("table_reunion", x + w // 2 - min(110, w - 60) // 2, y + h // 2 - min(70, h - 40) // 2 - 6, min(110, w - 60), min(70, h - 40))
                   for x, y, w, h in (PIECES[k]["rect"] for k in ("atlas", "orion", "vega", "lyra"))],
}
OBSTACLES = {c: [m[1:] for m in liste] for c, liste in MEUBLES.items()}
# Établis fixes : ni bureau ni déco dessus (le petit matériel, lui, peut y être posé)
ETABLIS = {"garage": [(440, 408, 232, 44)], "batiment": [(520, 1546, 228, 44), (532, 1678, 220, 58)]}
GRILLE = 4


# Portes de chaque pièce : les trous des cloisons autour d'elle (rien ne se pose sur 44 devant) ; le garage s'ouvre sur l'allée
PROFONDEUR_PORTE, ECART_MEUBLES = 44, 18


def _portes(k):
    pc = PIECES[k]
    if pc["carte"] == "garage":
        return [(476, 596, 158, PROFONDEUR_PORTE)]
    x, y, w, h = pc["rect"]
    murs, coques, zones = CLOISONS[pc["etage"]], COQUES[pc["etage"]], []

    def trous(lo, hi, occ):
        res, c = [], lo
        for a, b in sorted(occ):
            if a - c > 16:
                res.append((c, a))
            c = max(c, b)
        if hi - c > 16:
            res.append((c, hi))
        return res
    horiz = lambda yy: [(min(a, c), max(a, c)) for a, b, c, d in murs if b == d and abs(b - yy) <= 14]
    vert = lambda xx: [(min(b, d), max(b, d)) for a, b, c, d in murs if a == c and abs(a - xx) <= 14]
    bord_h = lambda yy: any(abs(cy - yy) <= 14 or abs(cy + ch - yy) <= 14 for _, cy, _, ch in coques)
    bord_v = lambda xx: any(abs(cx - xx) <= 14 or abs(cx + cw - xx) <= 14 for cx, _, cw, _ in coques)
    if not bord_h(y):
        zones += [(a - 4, y, b - a + 8, PROFONDEUR_PORTE) for a, b in trous(x, x + w, horiz(y))]
    if not bord_h(y + h):
        zones += [(a - 4, y + h - PROFONDEUR_PORTE, b - a + 8, PROFONDEUR_PORTE) for a, b in trous(x, x + w, horiz(y + h))]
    if not bord_v(x):
        zones += [(x, a - 4, PROFONDEUR_PORTE, b - a + 8) for a, b in trous(y, y + h, vert(x))]
    if not bord_v(x + w):
        zones += [(x + w - PROFONDEUR_PORTE, a - 4, PROFONDEUR_PORTE, b - a + 8) for a, b in trous(y, y + h, vert(x + w))]
    return zones


PORTES = {k: _portes(k) for k in PIECES}
# Murs où s'alignent les bureaux de chaque pièce de travail (n : mur du haut, s : du bas, o : gauche, e : droite) ; par défaut haut et bas
MURS_POSTES = {"cdp": "ne", "opensp": "oe", "meca": "s"}
COTE_POSTES = {}  # (x, y) d'un emplacement de bureau -> mur auquel il est adossé


def _grille_postes(k):
    """Bureaux adossés aux murs de la pièce, écartés, sans gêner les portes ni le mobilier fixe."""
    x, y, w, h = PIECES[k]["rect"]
    carte = PIECES[k]["carte"]
    fixes = [r for r in OBSTACLES[carte] + ETABLIS[carte] if x < r[0] + r[2] and r[0] < x + w and y < r[1] + r[3] and r[1] < y + h]
    croise = lambda a, b, m=0: a[0] < b[0] + b[2] + m and b[0] < a[0] + a[2] + m and a[1] < b[1] + b[3] + m and b[1] < a[1] + a[3] + m
    pris, slots = [], []
    for c in MURS_POSTES.get(k, "ns"):
        hor = c in "ns"
        u, fin = (x + 1, x + w) if hor else (y + 1, y + h)
        while u + 76 <= fin:
            px = u if hor else (x + 1 if c == "o" else x + w - 65)
            py = u if not hor else (y + 1 if c == "n" else y + h - 65)
            r = (px + 7, py, 62, 58) if c == "n" else (px + 7, py + 6, 62, 58) if c == "s" else (px, py + 7, 58, 62) if c == "o" else (px + 6, py + 7, 58, 62)
            if any(croise(r, q) for q in PORTES[k]) or any(croise(r, q, ECART_MEUBLES) for q in fixes + pris):
                u += 1
                continue
            pris.append(r)
            slots.append((px, py))
            COTE_POSTES[(px, py)] = c
            u += 76
    return slots


# Garage : deux bureaux au mur de gauche, un au mur du bas à côté de la porte, un dos à l'étagère ; aucun face à l'établi
_POSTES_GARAGE = [(441, 456, "o"), (441, 540, "o"), (596, 575, "s"), (572, 470, "e")]
COTE_POSTES.update({(x, y): c for x, y, c in _POSTES_GARAGE})

# Emplacements prévus du rangement automatique, essayés avant la règle générale : type -> [(x, y), ...]
# Postes : une grille par pièce de travail (pas les bureaux individuels ni la direction) ; la déco ne s'y pose pas d'elle-même.
EMPLACEMENTS = {
    "poste": [(x, y) for x, y, _ in _POSTES_GARAGE] + [p for k in TRAVAIL if PIECES[k]["genre"] == "bureau" for p in _grille_postes(k)],
    # salle de pause du R2 : cuisine contre le mur du haut, canapé en bas, baby-foot au centre, jeux et boissons contre les murs
    "canape": [(960, 2668)], "babyfoot": [(946, 2518)], "cafe": [(1040, 2400)], "arcade": [(878, 2400)],
    "distrib": [(878, 2438)], "fontaine": [(878, 2472)], "aquarium": [(880, 2674)],
}

# Poste de travail : l'emprise inclut la chaise et la place de l'employé devant le meuble
POSTE = {"nom": "Bureau de travail", "prix": 400, "w": 76, "h": 64, "pieces": TRAVAIL}

# Matériel : bonus de production (6 % par point), debug (détection des défauts), cem (chance aux tests)
# w, h : taille sur le plan (le rangement automatique choisit l'emplacement)
_FW = ["garage", "labo"] + [k for k in TRAVAIL if PIECES[k]["genre"] == "bureau"]  # le labo d'abord : outils firmware sur l'établi
MATERIEL = {
    # Labo électronique (préqualif CEM pour les sondes et l'analyseur)
    "multi":    {"nom": "Multimètre", "dom": "e", "prix": 150, "bonus": 1, "piece": "labo", "w": 28, "h": 36},
    "station":  {"nom": "Station de soudage", "dom": "e", "prix": 300, "bonus": 1, "piece": "labo", "w": 28, "h": 36},
    "alim":     {"nom": "Alimentation de labo", "dom": "e", "prix": 450, "bonus": 1, "piece": "labo", "w": 32, "h": 32},
    "micro":    {"nom": "Microscope de soudure", "dom": "e", "prix": 1800, "bonus": 1, "debug": 1, "piece": "labo", "w": 32, "h": 36},
    "oscillo":  {"nom": "Oscilloscope 4 voies", "dom": "e", "prix": 2800, "bonus": 2, "debug": 1, "piece": "labo", "w": 36, "h": 44},
    "sonde":    {"nom": "Sondes champ proche", "dom": "e", "prix": 1200, "bonus": 0, "cem": 0.10, "piece": "labo", "pieces": ["labo", "reception"], "w": 28, "h": 30},
    "four":     {"nom": "Four de refusion", "dom": "e", "prix": 6500, "bonus": 3, "piece": "labo", "w": 74, "h": 56},
    "spectre":  {"nom": "Analyseur de spectre", "dom": "e", "prix": 14000, "bonus": 2, "cem": 0.10, "piece": "labo", "pieces": ["labo", "reception"], "w": 74, "h": 44},
    # Atelier méca / 3D (l'atelier du RDC est petit : aussi dans le bureau Méca du R1)
    "fdm":      {"nom": "Imprimante 3D FDM", "dom": "m", "prix": 650, "bonus": 2, "piece": "atelier", "pieces": ["atelier", "meca"], "w": 46, "h": 46},
    "resine":   {"nom": "Imprimante résine", "dom": "m", "prix": 2400, "bonus": 2, "piece": "atelier", "pieces": ["atelier", "meca"], "w": 38, "h": 42},
    "cao":      {"nom": "Poste CAO 3D + licence", "dom": "m", "prix": 3500, "bonus": 3, "piece": "atelier", "pieces": ["atelier", "meca"], "w": 84, "h": 32},
    "cnc":      {"nom": "Fraiseuse CNC", "dom": "m", "prix": 16000, "bonus": 4, "piece": "atelier", "pieces": ["atelier", "meca"], "w": 88, "h": 72},
    # Firmware (établi du labo, ou bureaux)
    "stlink":   {"nom": "Programmateur ST-Link", "dom": "f", "prix": 40, "bonus": 1, "piece": "hw", "pieces": _FW, "w": 20, "h": 20},
    "logique":  {"nom": "Analyseur logique", "dom": "f", "prix": 350, "bonus": 1, "debug": 1, "piece": "hw", "pieces": _FW, "w": 34, "h": 20},
    "jlink":    {"nom": "Sonde J-Link", "dom": "f", "prix": 950, "bonus": 2, "debug": 1, "piece": "hw", "pieces": _FW, "w": 28, "h": 20},
    "ci":       {"nom": "Serveur d'intégration continue", "dom": "f", "prix": 2200, "bonus": 2, "debug": 1, "piece": "hw", "pieces": _FW, "w": 40, "h": 24},
    "banc":     {"nom": "Banc de test automatisé", "dom": "f", "prix": 9000, "bonus": 2, "debug": 2, "piece": "hw", "pieces": _FW, "w": 90, "h": 24},
}
for _m in MATERIEL.values():
    _m.setdefault("pieces", [_m["piece"]])
    if _m["piece"] == "labo" and "garage" not in _m["pieces"]:
        _m["pieces"] = ["garage"] + _m["pieces"]  # avant le déménagement, le labo tient dans le garage
MATERIEL_DEPART = ["multi", "station", "stlink"]

# Aménagement. Effet (moral, prod) compté une fois par type, même avec plusieurs exemplaires.
# global : amélioration sans objet à poser ; multiple : plusieurs exemplaires possibles ; libre : mural ou au sol, ne gêne rien
DECO = {
    "plantes":  {"nom": "Plante verte", "prix": 180, "moral": 5, "w": 28, "h": 28, "multiple": True},
    "ficus":    {"nom": "Ficus", "prix": 350, "moral": 2, "w": 36, "h": 36, "multiple": True},
    "tableau":  {"nom": "Tableau blanc", "prix": 250, "moral": 3, "w": 68, "h": 12, "libre": True},
    "cafe":     {"nom": "Machine à café", "prix": 600, "moral": 7, "w": 20, "h": 28},
    "fontaine": {"nom": "Fontaine à eau", "prix": 300, "moral": 2, "w": 18, "h": 22, "multiple": True},
    "distrib":  {"nom": "Distributeur de snacks", "prix": 700, "moral": 3, "w": 30, "h": 24},
    "clim":     {"nom": "Climatisation", "prix": 2500, "moral": 4, "w": 44, "h": 12, "libre": True, "effet": "Supprime le malus en cas de canicule"},
    "biblio":   {"nom": "Bibliothèque de datasheets", "prix": 800, "moral": 1, "prod": 2, "w": 64, "h": 16, "effet": "+2 % de productivité"},
    "armoire":  {"nom": "Armoire à composants", "prix": 1200, "moral": 0, "prod": 3, "w": 44, "h": 22, "effet": "+3 % de productivité"},
    "imprimante": {"nom": "Imprimante de bureau", "prix": 400, "moral": 0, "prod": 1, "w": 28, "h": 22, "effet": "+1 % de productivité"},
    "table":    {"nom": "Table de réunion", "prix": 1500, "moral": 2, "prod": 2, "w": 72, "h": 44, "effet": "+2 % de productivité"},
    "aquarium": {"nom": "Aquarium", "prix": 900, "moral": 4, "w": 40, "h": 24},
    "lampe":    {"nom": "Lampadaire", "prix": 150, "moral": 1, "w": 16, "h": 16, "multiple": True},
    "poster":   {"nom": "Affiche de circuit vintage", "prix": 120, "moral": 1, "w": 30, "h": 10, "multiple": True, "libre": True},
    "tapis":    {"nom": "Tapis", "prix": 200, "moral": 1, "w": 60, "h": 40, "multiple": True, "libre": True},
    "canape":   {"nom": "Canapé", "prix": 900, "moral": 6, "w": 90, "h": 36, "pieces": ["cantine"]},
    "babyfoot": {"nom": "Baby-foot", "prix": 1200, "moral": 8, "w": 54, "h": 44, "pieces": ["cantine"]},
    "arcade":   {"nom": "Borne d'arcade", "prix": 2000, "moral": 6, "w": 30, "h": 30, "pieces": ["cantine"]},
    "sieges":   {"nom": "Sièges ergonomiques", "prix": 1500, "moral": 3, "prod": 8, "global": True, "effet": "+8 % de productivité"},
    "eclairage": {"nom": "Éclairage LED", "prix": 800, "moral": 2, "prod": 4, "global": True, "effet": "+4 % de productivité"},
    "isolation": {"nom": "Isolation phonique", "prix": 3000, "moral": 2, "global": True, "effet": "Supprime le malus de bruit"},
}
for _d in DECO.values():
    _d.setdefault("pieces", INTERIEUR)

# Le seul local à louer : l'emménagement dans le bâtiment, qui ouvre tous les étages
LOCAUX = {
    "bureau": {"nom": "Emménager dans le bâtiment", "desc": "Les trois étages s'ouvrent : tout le garage déménage, on grandit ensuite en embauchant", "prix": 8000, "loyer": 900, "rep": 0, "etage": "r1", "piece": "hw"},
}
LOYER_BASE = 400
KICKOFF = 0.05  # part d'une phase faite d'avance grâce à la réunion de lancement (salles de réunion du bâtiment)

# Rôles : responsables de service (bureau individuel), direction R&D et innovation (bureau R&D)
ROLES = {
    "resp_e": {"nom": "Responsable Élec", "dom": "e", "min": 8, "salaire": 800, "genre": "res"},
    "resp_m": {"nom": "Responsable Méca", "dom": "m", "min": 8, "salaire": 800, "genre": "res"},
    "resp_f": {"nom": "Responsable Firmware", "dom": "f", "min": 8, "salaire": 800, "genre": "res"},
    "dir_rd": {"nom": "Directeur·rice R&D", "total": 20, "salaire": 1500, "genre": "rd"},
    "innov":  {"nom": "Chargé·e d'innovation", "total": 12, "salaire": 700, "genre": "rd"},
}
SERVICE_SANS_RESP = 4  # au-delà, un service sans responsable perd en efficacité
BREVET = {"cout": 3000, "mois": 36, "revenu": (400, 900)}
IDEES_BREVET = ["Antenne imprimée auto-accordée", "Algorithme de recharge rapide", "Connecteur magnétique étanche",
                "Capteur capacitif sans contact", "Boîtier clipsable sans vis", "Bootloader sécurisé sans fil",
                "Dissipateur imprimé en 3D", "Filtre CEM intégré au PCB"]


TRAITS = {
    "perfectionniste": {"nom": "Perfectionniste", "desc": "Moins de défauts, un peu plus lent", "vitesse": 0.9, "defauts": 0.5},
    "rapide":   {"nom": "Rapide", "desc": "Travaille vite mais laisse plus de défauts", "vitesse": 1.25, "defauts": 1.5},
    "creatif":  {"nom": "Créatif", "desc": "Améliore la note finale des projets", "qualite": 0.3},
    "sociable": {"nom": "Sociable", "desc": "Remonte le moral de l'équipe", "moral": 4},
    "raleur":   {"nom": "Râleur", "desc": "Efficace mais plombe l'ambiance", "vitesse": 1.1, "moral": -5},
    "debug":    {"nom": "Chasseur de bugs", "desc": "Trouve deux fois plus de défauts", "detection": 2.0},
    "endurant": {"nom": "Endurant", "desc": "Se fatigue deux fois moins vite", "fatigue": 0.5},
    "leader":   {"nom": "Leader", "desc": "Chef de projet dès 10 points de compétences ; son bonus de chef est 50 % plus fort"},
    "pedagogue": {"nom": "Pédagogue", "desc": "Ses coéquipiers apprennent 50 % plus vite"},
    "negociateur": {"nom": "Négociateur", "desc": "Commercial +3 : meilleures offres et négociations"},
    "rigoureux": {"nom": "Rigoureux", "desc": "Moins de défauts, Qualification +2", "defauts": 0.8},
    "autonome": {"nom": "Autonome", "desc": "+8 % de vitesse sans chef de projet sur son projet"},
    "encadrement": {"nom": "Besoin d'encadrement", "desc": "−15 % sans chef de projet sur son projet, +10 % avec"},
    "stresse":  {"nom": "Stressé", "desc": "Perd ses moyens quand la date de livraison approche (−15 %, plus de défauts)"},
    "distrait": {"nom": "Distrait", "desc": "Un peu plus rapide mais beaucoup plus de défauts", "vitesse": 1.05, "defauts": 1.35},
    "solitaire": {"nom": "Solitaire", "desc": "+10 % dans une petite équipe (2 ou moins), −10 % dans une grande (4 ou plus)"},
    "ambitieux": {"nom": "Ambitieux", "desc": "Apprend 30 % plus vite mais réclame des promotions"},
}
# Compétences métier, en plus d'Élec, Méca et Firmware (elles serviront aussi aux bureaux du bâtiment)
METIERS = {
    "logiciel":   {"nom": "Logiciel", "desc": "+3 % de production en firmware par point"},
    "indus":      {"nom": "Industrialisation", "desc": "Marge des séries +4 % par point (le meilleur de l'équipe)"},
    "qualif":     {"nom": "Qualification", "desc": "Chance aux tests CEM +1,5 % par point (le meilleur de l'équipe)"},
    "commercial": {"nom": "Commercial", "desc": "Offres mieux payées (+1,5 %) et négociation plus sûre (+1 %) par point (le meilleur)"},
    "gestion":    {"nom": "Gestion", "desc": "Un chef de projet donne +6 % de production à son équipe, plus 1 % par point"},
}
# Séniorité : apprentissage, défauts, prime de salaire mensuelle, points de compétences (élec + méca + firmware) pour y accéder
SENIORITES = [
    {"nom": "Junior", "xp": 1.4, "defauts": 1.25, "prime": 0, "points": 0},
    {"nom": "Confirmé", "xp": 1.0, "defauts": 1.0, "prime": 200, "points": 6},
    {"nom": "Senior", "xp": 0.8, "defauts": 0.85, "prime": 500, "points": 11},
    {"nom": "Expert", "xp": 0.6, "defauts": 0.7, "prime": 900, "points": 16},
]
MOTIVATIONS = {
    "salaire":   {"nom": "Le salaire", "desc": "Content s'il est payé au moins au prix du marché"},
    "ambiance":  {"nom": "L'ambiance", "desc": "Content quand le moral de l'équipe dépasse 70 %"},
    "projets":   {"nom": "Les beaux projets", "desc": "Content quand un produit maison ou un gros projet est en cours"},
    "formation": {"nom": "Se former", "desc": "Content s'il a été formé dans l'année"},
    "horaires":  {"nom": "Ses horaires", "desc": "Content tant qu'on ne dépasse pas 8 h par jour"},
}
COUT_ENTRETIEN = 300
SALAIRE_BASE, SALAIRE_POINT = 800, 230  # €/mois : base et prix d'un point de compétence
HAUSSE_POINT = 115  # €/mois par point gagné en travaillant : la moitié du prix du marché (sinon les salaires dépassent le chiffre d'affaires en fin de partie)
JOURS_AN = 360

PRENOMS = ["Léa", "Hugo", "Inès", "Sami", "Marc", "Chloé", "Yanis", "Camille", "Lucas", "Nora", "Théo",
           "Emma", "Rayan", "Julie", "Maël", "Sarah", "Nathan", "Zoé", "Karim", "Manon", "Bastien", "Elsa",
           "Antoine", "Lina", "Quentin", "Jade", "Mathis", "Anaïs", "Victor", "Amina"]
COULEURS = ["#6aa8f0", "#f08a6c", "#b08af0", "#7be08a", "#ffc94d", "#ef6f9a", "#5ccfc4", "#e8e8e8", "#ff9a4a"]
CHEVEUX = ["#2b1d14", "#5a3a22", "#e0703a", "#f2d06b", "#1a1a1a", "#9a9a9a", "#8a4a2a", "#c76b9e"]
PEAUX = ["#f8d8b8", "#f6cfa6", "#eab994", "#c98e5e", "#a86b45", "#7a4a2e"]

# Profils de recrutement : poids de répartition des compétences
COMMISSION = 0.06  # part de chaque contrat signé reversée à chaque commercial (leur salaire fixe ×0,6)
PRIME_COMMERCIAL = 0.02  # offres mieux payées : +2 % par commercial (3 au plus), en plus de la compétence commerciale
PRIME_CHEF = 0.08  # prime du client : 8 % du contrat suivi par un chef de projet, livré à l'heure et bien noté (× suivi)
POSTES = [
    {"nom": "Technicien·ne élec", "poids": {"e": 0.7, "m": 0.1, "f": 0.2}},
    {"nom": "Dessinateur·rice 3D", "poids": {"e": 0.05, "m": 0.85, "f": 0.1}},
    {"nom": "Dév firmware", "poids": {"e": 0.15, "m": 0.0, "f": 0.85}},
    {"nom": "Ingé hardware", "poids": {"e": 0.6, "m": 0.05, "f": 0.35}},
    {"nom": "Ingé mécatronique", "poids": {"e": 0.3, "m": 0.5, "f": 0.2}},
    {"nom": "Dév logiciel", "poids": {"e": 0.05, "m": 0.0, "f": 0.6}, "metier": "logiciel"},
    {"nom": "Ingé industrialisation", "poids": {"e": 0.35, "m": 0.35, "f": 0.05}, "metier": "indus"},
    {"nom": "Technicien·ne qualification", "poids": {"e": 0.5, "m": 0.15, "f": 0.1}, "metier": "qualif"},
    {"nom": "Ingé commercial·e", "poids": {"e": 0.25, "m": 0.05, "f": 0.1}, "metier": "commercial", "commercial": True},
    {"nom": "Ingé chef de projet", "poids": {"e": 0.3, "m": 0.15, "f": 0.25}, "metier": "gestion", "chef": True},
]

# Secteurs : chaque client appartient à un secteur ; les clients bien servis reviennent (fidélité)
SECTEURS = {
    "industrie": {"nom": "Industrie", "clients": ["Rail Services", "Port Atlantique", "MécaPrécis", "Usines du Lot"]},
    "maison":    {"nom": "Maison connectée", "clients": ["DomoSud", "BatiSmart", "Atelier Bois et Co", "HabitaZen"]},
    "energie":   {"nom": "Énergie", "clients": ["EnergiPlus", "SolarFerme", "Watt'Elle", "Hydro Garonne"]},
    "agri":      {"nom": "Agriculture", "clients": ["AgriTech Gironde", "Vignobles Connectés", "Brasserie du Bassin", "Huîtres du Cap"]},
    "mobilite":  {"nom": "Mobilité", "clients": ["VéloMotion", "TramLine", "AutoNova", "Scoot'Atlantique"]},
    "loisirs":   {"nom": "Grand public", "clients": ["LudoKit", "SonoLab", "Océane Robotics", "FitPulse"]},
    "medical":   {"nom": "Médical", "clients": ["MedNova", "CardioSense", "Clinique du Parc", "OrthoTech"]},
    "aero":      {"nom": "Aéro et drones", "clients": ["Aéro Systèmes", "AvioNav", "DroneWorks", "Héli Sud"]},
    "telecom":   {"nom": "Télécoms", "clients": ["TéléRéseaux", "FibreOuest", "NetBox", "OndeCom"]},
    "spatial":   {"nom": "Spatial", "clients": ["Orbital Sud", "AstroLab", "StarTrack", "Lune & Co"]},
}
FIDELITE_MAX = 5
NIVEAUX_FIDELITE = ["Nouveau client", "Client", "Client régulier", "Client fidèle", "Client fidèle", "Partenaire"]

# Modèles de contrats : nom, répartition e/m/f, taille de base, renommée minimale,
# technologie ou certification requise (None, un identifiant ou un tuple d'identifiants), secteur
CONTRATS = [
    ("Carte LED pour enseigne", (0.75, 0.0, 0.25), 40, 0, None, "industrie"),
    ("Lampe de vélo rechargeable", (0.6, 0.2, 0.2), 45, 0, None, "mobilite"),
    ("Carte relais domotique", (0.7, 0.05, 0.25), 50, 0, None, "maison"),
    ("Jouet lumineux", (0.5, 0.3, 0.2), 50, 0, None, "loisirs"),
    ("Minuterie de four industriel", (0.65, 0.1, 0.25), 55, 0, None, "industrie"),
    ("Interface capteur industriel", (0.7, 0.1, 0.2), 60, 0, None, "industrie"),
    ("Compteur d'eau d'irrigation", (0.55, 0.2, 0.25), 60, 0, None, "agri"),
    ("Sonde de cuve à vin", (0.5, 0.25, 0.25), 70, 0, None, "agri"),
    ("Thermostat connecté", (0.4, 0.3, 0.3), 90, 0, None, "maison"),
    ("Capteur d'humidité du sol", (0.5, 0.2, 0.3), 100, 1, None, "agri"),
    ("Bracelet connecté", (0.35, 0.35, 0.3), 110, 1, "ble", "loisirs"),
    ("Enceinte Bluetooth", (0.45, 0.3, 0.25), 120, 1, "ble", "loisirs"),
    ("Boîtier domotique Zigbee", (0.35, 0.35, 0.3), 120, 1, "ble", "maison"),
    ("Pilulier connecté", (0.35, 0.35, 0.3), 120, 2, "ble", "medical"),
    ("Serrure connectée", (0.35, 0.35, 0.3), 130, 2, "ble", "maison"),
    ("Afficheur de quai de gare", (0.55, 0.2, 0.25), 130, 2, None, "industrie"),
    ("Chargeur de batterie lithium", (0.6, 0.15, 0.25), 140, 2, "hv", "energie"),
    ("Station de recharge pour vélos", (0.55, 0.25, 0.2), 160, 2, "hv", "mobilite"),
    ("Ruche connectée", (0.4, 0.3, 0.3), 140, 3, "rf", "agri"),
    ("Capteur LoRa agricole", (0.4, 0.2, 0.4), 150, 3, "rf", "agri"),
    ("Chargeur USB-C 100 W", (0.65, 0.2, 0.15), 180, 3, "usb", "loisirs"),
    ("Compteur électrique communicant", (0.5, 0.15, 0.35), 200, 3, "ce", "energie"),
    ("Tensiomètre de poignet", (0.4, 0.3, 0.3), 200, 4, "ce", "medical"),
    ("Passerelle Ethernet industrielle", (0.5, 0.1, 0.4), 220, 4, "eth", "industrie"),
    ("Onduleur solaire", (0.6, 0.2, 0.2), 230, 4, "hv", "energie"),
    ("Contrôleur de trottinette", (0.45, 0.2, 0.35), 240, 4, "moteur", "mobilite"),
    ("Contrôleur moteur BLDC", (0.45, 0.1, 0.45), 260, 5, "moteur", "industrie"),
    ("Box internet", (0.5, 0.2, 0.3), 300, 5, "eth", "telecom"),
    ("Tracker GPS pour flotte", (0.4, 0.2, 0.4), 240, 6, "rf", "mobilite"),
    ("Tableau de bord de scooter", (0.45, 0.25, 0.3), 280, 6, "usb", "mobilite"),
    ("Caméra intelligente", (0.35, 0.2, 0.45), 320, 7, "ia", "industrie"),
    ("Routeur 4G de chantier", (0.5, 0.2, 0.3), 360, 7, "cell", "telecom"),
    ("Capteur sous-marin de port", (0.45, 0.35, 0.2), 340, 7, "rf", "industrie"),
    ("Borne de recharge pour voiture", (0.55, 0.25, 0.2), 420, 8, ("hv", "ce"), "energie"),
    ("Carte de vision FPGA", (0.55, 0.05, 0.4), 400, 8, "fpga", "industrie"),
    ("Module radio 2,4 GHz", (0.55, 0.15, 0.3), 380, 9, "rf", "telecom"),
    ("Robot de cueillette", (0.35, 0.35, 0.3), 450, 9, ("moteur", "ia"), "agri"),
    ("Instrument médical portable", (0.4, 0.3, 0.3), 500, 10, "medical", "medical"),
    ("Radar de recul", (0.55, 0.15, 0.3), 500, 10, ("rf", "auto"), "mobilite"),
    ("Capteur de gaz pour raffinerie", (0.5, 0.3, 0.2), 550, 11, "atex", "industrie"),
    ("Coffre de clés chiffrées", (0.45, 0.15, 0.4), 520, 11, "secu", "telecom"),
    ("Calculateur pour drone", (0.4, 0.2, 0.4), 650, 12, "moteur", "aero"),
    ("Pompe à insuline", (0.4, 0.3, 0.3), 600, 12, ("medical", "ble"), "medical"),
    ("Calculateur d'aide à la conduite", (0.45, 0.1, 0.45), 650, 12, "auto", "mobilite"),
    ("Station de base 5G", (0.55, 0.15, 0.3), 700, 13, ("cell", "fpga"), "telecom"),
    ("Équipement avionique", (0.5, 0.2, 0.3), 700, 14, "aero", "aero"),
    ("Défibrillateur automatique", (0.45, 0.3, 0.25), 800, 15, "medical", "medical"),
    ("Charge utile de CubeSat", (0.5, 0.25, 0.25), 900, 16, ("spatial", "espace"), "spatial"),
    ("Pilotage de réseau électrique", (0.5, 0.1, 0.4), 850, 16, ("hv", "secu"), "energie"),
    ("Radio logicielle militaire", (0.5, 0.15, 0.35), 900, 17, ("fpga", "rf"), "telecom"),
    ("Calculateur de moteur d'avion", (0.45, 0.2, 0.35), 1000, 18, ("aero", "moteur"), "aero"),
    ("Train autonome", (0.4, 0.2, 0.4), 950, 18, ("auto", "secu"), "mobilite"),
    ("Ordinateur de bord de satellite", (0.5, 0.15, 0.35), 1100, 20, ("spatial", "espace"), "spatial"),
    ("Implant médical sans fil", (0.4, 0.3, 0.3), 1000, 22, ("medical", "ble"), "medical"),
]

# Méga-projets : rares, énormes, payés 25 % de plus ; comptent pour deux projets en parallèle
# nom, répartition, taille de base, renommée minimale, prérequis, secteur, équipe minimale
MEGAS = [
    ("Flotte de drones de livraison", (0.4, 0.25, 0.35), 1600, 10, ("moteur", "rf"), "aero", 6),
    ("Usine 4.0 clé en main", (0.45, 0.25, 0.3), 1800, 11, ("eth", "moteur"), "industrie", 7),
    ("Réseau électrique intelligent régional", (0.5, 0.1, 0.4), 2000, 13, ("hv", "secu"), "energie", 8),
    ("Ligne de métro automatique", (0.4, 0.2, 0.4), 2400, 15, ("auto", "secu"), "mobilite", 9),
    ("Robot chirurgical", (0.4, 0.3, 0.3), 2600, 17, ("medical", "moteur"), "medical", 10),
    ("Constellation de nanosatellites", (0.5, 0.2, 0.3), 3000, 18, ("spatial", "espace"), "spatial", 10),
    ("Cockpit d'avion régional", (0.45, 0.2, 0.35), 2800, 19, ("aero", "fpga"), "aero", 10),
]
MEGA_PRIME = 1.25

PRIMES = {"medical": 1.3, "aero": 1.4, "auto": 1.25, "atex": 1.2, "espace": 1.5}

# Choix techniques faits à la signature d'un projet
CHOIX_TECH = {
    "couches": {"nom": "Couches du PCB", "defaut": "4", "options": {
        "2": {"nom": "2 couches", "desc": "Proto −40 % et 1 jour de moins, CEM plus difficile", "proto": 0.6, "jours": -1, "cem": -0.08},
        "4": {"nom": "4 couches", "desc": "Le bon compromis"},
        "6": {"nom": "6 couches", "desc": "Proto ×2,5 et 2 jours de plus, CEM facile, note +0,2", "proto": 2.5, "jours": 2, "cem": 0.10, "note": 0.2},
        "8": {"nom": "8 couches HDI", "desc": "Proto ×4 et 3 jours de plus, CEM très facile, note +0,3", "proto": 4, "jours": 3, "cem": 0.15, "note": 0.3, "requis": "rf"},
        "12": {"nom": "12 couches", "desc": "Proto ×6 et 4 jours de plus, CEM +0,2, note +0,4", "proto": 6, "jours": 4, "cem": 0.20, "note": 0.4, "requis": "fpga"},
    }},
    "mcu": {"nom": "Microcontrôleur", "defaut": "stm32", "options": {
        "stm32": {"nom": "STM32", "desc": "Polyvalent et bien connu"},
        "esp32": {"nom": "ESP32", "desc": "Wi-Fi intégré : firmware −15 %, CEM plus délicate", "f": 0.85, "cem": -0.05},
        "nrf": {"nom": "nRF52", "desc": "BLE basse conso : firmware +15 %, note +0,3", "f": 1.15, "note": 0.3, "requis": "ble"},
        "4g": {"nom": "Module 4G", "desc": "Connecté partout : firmware −10 %, CEM plus délicate, note +0,3", "f": 0.9, "cem": -0.05, "note": 0.3, "requis": "cell"},
        "secu": {"nom": "MCU sécurisé", "desc": "Élément sécurisé : firmware +10 %, défauts −10 %, note +0,2", "f": 1.1, "defauts": 0.9, "note": 0.2, "requis": "secu"},
        "fpga": {"nom": "FPGA", "desc": "Firmware +30 %, note +0,4", "f": 1.3, "note": 0.4, "requis": "fpga"},
    }},
    "boitier": {"nom": "Boîtier", "defaut": "usine", "options": {
        "impression": {"nom": "Impression 3D", "desc": "Méca −30 %, note −0,3", "m": 0.7, "note": -0.3},
        "usine": {"nom": "Usiné", "desc": "Solide et standard"},
        "injection": {"nom": "Moule d'injection", "desc": "Moule 3 000 €, méca +25 %, note +0,5", "m": 1.25, "note": 0.5, "cout": 3000},
        "blinde": {"nom": "Blindé", "desc": "Boîtier métal : méca +20 %, CEM +0,10, note +0,2", "m": 1.2, "cem": 0.10, "note": 0.2, "requis": "rf"},
        "ip67": {"nom": "Étanche IP67", "desc": "Moule 2 000 €, méca +30 %, note +0,4", "m": 1.3, "note": 0.4, "cout": 2000, "requis": "dfm"},
    }},
    "alim": {"nom": "Alimentation", "defaut": "standard", "options": {
        "standard": {"nom": "Standard", "desc": "Régulateurs classiques"},
        "usbc": {"nom": "USB-C PD", "desc": "Électronique +10 %, note +0,2", "e": 1.1, "note": 0.2, "requis": "usb"},
        "isolee": {"nom": "Puissance isolée", "desc": "Électronique +20 %, note +0,3", "e": 1.2, "note": 0.3, "requis": "hv"},
    }},
    # « requis » : une techno ou une certification
    "composants": {"nom": "Grade des composants", "defaut": "commercial", "options": {
        "commercial": {"nom": "Commercial", "desc": "Composants du catalogue standard"},
        "auto": {"nom": "Automobile AEC-Q", "desc": "Proto ×1,5, défauts −10 %, note +0,3", "proto": 1.5, "defauts": 0.9, "note": 0.3, "requis": "auto"},
        "aero": {"nom": "Aéronautique", "desc": "Proto ×2, défauts −15 %, note +0,4", "proto": 2, "defauts": 0.85, "note": 0.4, "requis": "aero"},
        "spatial": {"nom": "Spatial durci", "desc": "Proto ×4, défauts −25 %, note +0,6", "proto": 4, "defauts": 0.75, "note": 0.6, "requis": "spatial"},
    }},
    "fabrication": {"nom": "Fabrication", "defaut": "standard", "options": {
        "standard": {"nom": "Sans relecture", "desc": "Le routage part tel quel chez le fabricant"},
        "dfm": {"nom": "Relecture DFM", "desc": "Électronique +5 %, défauts −20 %", "e": 1.05, "defauts": 0.8, "requis": "dfm"},
    }},
    # étapes optionnelles et payantes entre le prototype et la série (bureau indus et labo de qualification, au R1)
    "indus": {"nom": "Industrialisation", "defaut": "aucune", "options": {
        "aucune": {"nom": "Aucune", "desc": "Moins cher ; sur un gros projet, plus de défauts en série et de retours"},
        "carte": {"nom": "Carte", "desc": "Coût unitaire −15 %, défauts et retours −40 %, séries plus fréquentes et rentables", "cout_point": 3, "indus": 1},
        "produit": {"nom": "Produit fini", "desc": "Carte, logiciel et boîtier : coût unitaire −30 %, défauts et retours −70 %, encore plus de séries", "cout_point": 6, "indus": 2},
    }},
    "qualif": {"nom": "Qualification", "defaut": "aucune", "options": {
        "aucune": {"nom": "Aucune", "desc": "Pas d'essais : interdit aux marchés exigeants (auto, aéro, médical, spatial)"},
        "carte": {"nom": "Carte", "desc": "4 jours d'essais (température, vibrations) : note +0,3, pannes −40 %", "cout_point": 3, "qualif": 1, "note": 0.3},
        "produit": {"nom": "Produit fini", "desc": "7 jours : qualification complète, note +0,5, pannes −70 %", "cout_point": 5, "qualif": 2, "note": 0.5},
    }},
}
# Qui fait le travail : l'équipe (gratuit) ou un prestataire payé à la signature, qui avance sans occuper l'équipe.
# Firmware et méca : prix par point et rythme (points par jour sur un projet de 150 points, proportionnel au-delà).
# Indus et qualif : « prix » multiplie le coût de l'étape ; « qualite » (min, max) remplace celle de l'équipe.
_DEV = {
    "interne": {"nom": "En interne", "desc": "Gratuit : fait par l'équipe (vous au début)"},
    "freelance": {"nom": "Freelance", "desc": "≈ 35 € par point, avance sans occuper l'équipe ; défauts +30 %", "prix_point": 35, "rythme": 4, "defauts": 1.3},
    "be": {"nom": "Bureau d'études", "desc": "≈ 55 € par point, plus rapide ; défauts −30 %", "prix_point": 55, "rythme": 7, "defauts": 0.7},
}
PRESTATAIRES = {
    "f": {"nom": "Firmware", "options": _DEV},
    "m": {"nom": "Mécanique", "options": _DEV},
    "indus": {"nom": "Industrialisation", "options": {
        "interne": {"nom": "En interne", "desc": "Prix ÷3, travail fait par l'équipe : 60 % d'efficacité sans spécialiste au Bureau indus", "prix": 1 / 3},
        "freelance": {"nom": "Freelance", "desc": "Prix normal, fait dehors, efficacité 70 à 90 %", "prix": 1, "qualite": (0.7, 0.9), "rythme": 4},
        "be": {"nom": "Bureau d'études", "desc": "Prix ×1,5, fait dehors, efficacité 100 %", "prix": 1.5, "qualite": (1, 1), "rythme": 7},
    }},
    "qualif": {"nom": "Qualification", "options": {
        "interne": {"nom": "En interne", "desc": "Prix ÷3, essais 50 % plus longs, risque de devoir les refaire (moins avec un spécialiste au Labo)", "prix": 1 / 3, "duree": 1.5},
        "lowcost": {"nom": "Labo low-cost", "desc": "Prix normal, efficacité 70 à 90 %, petit risque d'essais à refaire", "prix": 1, "qualite": (0.7, 0.9)},
        "labo": {"nom": "Labo accrédité", "desc": "Prix ×1,5, efficacité 100 %, jamais d'essais à refaire", "prix": 1.5, "qualite": (1, 1)},
    }},
}
EXIGEANTS = ("mobilite", "aero", "medical", "spatial")  # secteurs qui exigent une qualification
# Produits maison : fabriqués par lots chez un sous-traitant, stockés au RDC, puis vendus
LOTS = {50: (1.0, 15), 200: (0.85, 25), 500: (0.7, 35)}  # unités : coefficient sur le coût unitaire, jours de fabrication
STOCK_GARAGE, STOCK_BATIMENT = 200, 1000  # unités
AGRANDIR_STOCK = (5000, 1000)  # prix, unités en plus
STOCKAGE = 0.3  # € par unité et par mois
# Investissements de fin de partie : de grosses dépenses qui rapportent (onglet Société)
INVESTISSEMENTS = {
    "campagne": {"nom": "Campagne de communication nationale", "desc": "Renommée +2. Une par an, chacune 50 % plus chère que la précédente.", "prix": 100000, "rep": 8},
    "formation": {"nom": "Centre de formation interne", "desc": "Toute l'équipe progresse 25 % plus vite ; formations à moitié prix.", "prix": 250000, "rep": 8},
    "filiale": {"nom": "Filiale à Toulouse", "desc": "Une place de projet et deux appels d'offres de plus ; loyer +5 000 € par mois.", "prix": 600000, "rep": 10, "loyer": 5000},
    "rachat": {"nom": "Racheter un concurrent", "desc": "Le concurrent le plus connu disparaît du marché et vous apporte sa renommée (+3). Deux rachats au plus ; le prix suit sa renommée.", "prix": 200000, "par_rep": 40000, "rep": 10},
}
# Négociation : prix et délai proposés au client (multiplicateurs)
PRIX_PROPOSES = {"1.0": "Prix affiché", "1.1": "+10 %", "1.2": "+20 %", "1.3": "+30 %"}
DELAIS_PROPOSES = {"0.8": "−20 %", "1.0": "Délai affiché", "1.2": "+20 %"}
# Rivaux : style de devis (prix et délai proposés par rapport au budget du client), secteurs de prédilection, renommée et équipe de départ
CONCURRENTS = [
    {"nom": "ElectroConcept", "style": "Petits prix", "prix": 0.95, "delai": 1.05, "secteurs": [], "renommee": 3, "equipe": 2},
    {"nom": "Circuits du Sud-Ouest", "style": "Rapide", "prix": 1.0, "delai": 0.85, "secteurs": ["industrie", "agri"], "renommee": 6, "equipe": 4},
    {"nom": "Volta Ingénierie", "style": "Haut de gamme", "prix": 1.12, "delai": 1.0, "secteurs": ["medical", "aero", "spatial"], "renommee": 10, "equipe": 8},
    {"nom": "Onde & Signal", "style": "Spécialiste radio et objets connectés", "prix": 1.0, "delai": 1.0, "secteurs": ["maison", "telecom", "loisirs"], "renommee": 5, "equipe": 3},
]

# Prospection : coût, durée (jours), pistes tentées (min, max), réussite de base de chaque piste (+5 % par point de commercial),
# renommée en plus pour choisir les contrats, devis mis en concurrence (sinon le client réserve la piste), chance de base qu'un rival réponde
CANAUX = {
    "plateformes": {"nom": "Plateformes et sites d'appels d'offres", "desc": "Petits projets publiés en ligne : rapide et gratuit, mais les rivaux répondent souvent.",
                    "cout": 0, "jours": 2, "pistes": (2, 3), "reussite": 0.7, "bonus_rep": 0, "devis": True, "rivaux": 0.25},
    "reseaux": {"nom": "Réseaux sociaux / LinkedIn", "desc": "Publications et messages : le client vous réserve la piste quelques jours. Mieux avec de la renommée.",
                "cout": 0, "jours": 3, "pistes": (1, 2), "reussite": 0.5, "bonus_rep": 0, "devis": False},
    "demarchage": {"nom": "Démarchage d'entreprises", "desc": "Appeler et visiter les entreprises d'un secteur : un projet plus gros, réservé pour vous.",
                   "cout": 400, "jours": 4, "pistes": (1, 2), "reussite": 0.55, "bonus_rep": 2, "devis": False},
    "salon": {"nom": "Salon professionnel", "desc": "Un stand pendant trois jours : beaucoup de pistes mises en concurrence, et de la renommée.",
              "cout": 3000, "jours": 3, "pistes": (3, 5), "reussite": 0.75, "bonus_rep": 1, "devis": True, "rivaux": 0.15},
}
SALONS = {2: "Salon des objets connectés", 5: "Salon de l'électronique embarquée", 9: "Salon de l'industrie du futur"}  # mois (0 = janvier)
DEVIS_PRIX = {"0.85": "−15 %", "0.95": "−5 %", "1.0": "Budget du client", "1.1": "+10 %", "1.2": "+20 %"}
DEVIS_DELAIS = {"0.8": "−20 %", "1.0": "Délai demandé", "1.2": "+20 %"}

TECHNOS = {
    "ble":    {"nom": "Bluetooth Low Energy", "prix": 4000, "jours": 30, "desc": "Objets connectés et nRF52 ; firmware +10 %"},
    "rf":     {"nom": "Radiofréquence", "prix": 8000, "jours": 45, "desc": "Radio, LoRa et GPS ; tests CEM +5 %"},
    "hv":     {"nom": "Électronique de puissance", "prix": 7000, "jours": 40, "desc": "Chargeurs et onduleurs"},
    "moteur": {"nom": "Contrôle moteur", "prix": 9000, "jours": 45, "desc": "Contrôleurs BLDC et drones"},
    "dfm":    {"nom": "Conception pour la fabrication", "prix": 6000, "jours": 30, "desc": "Prototypes −30 %, défauts −10 %"},
    "ia":     {"nom": "IA embarquée", "prix": 15000, "jours": 60, "requis": "ble", "desc": "Caméras intelligentes ; note +0,2"},
    "usb":    {"nom": "USB-C Power Delivery", "prix": 5000, "jours": 30, "desc": "Chargeurs et tableaux de bord"},
    "eth":    {"nom": "Ethernet industriel", "prix": 6000, "jours": 35, "desc": "Passerelles, box internet, usines"},
    "cell":   {"nom": "Réseaux 4G et 5G", "prix": 14000, "jours": 60, "requis": "rf", "desc": "Routeurs et stations de base"},
    "fpga":   {"nom": "FPGA et traitement du signal", "prix": 16000, "jours": 60, "desc": "Vision, radio logicielle ; debug +1"},
    "secu":   {"nom": "Cybersécurité embarquée", "prix": 12000, "jours": 50, "desc": "Réseaux électriques, trains ; défauts −5 %"},
    "spatial": {"nom": "Électronique durcie spatiale", "prix": 30000, "jours": 120, "requis": "fpga", "desc": "Satellites (avec la certification ECSS)"},
}
CERTIFS = {
    "ce":      {"nom": "Marquage CE maîtrisé", "prix": 3000, "jours": 20, "desc": "Paie des contrats +5 %"},
    "iso":     {"nom": "ISO 9001", "prix": 10000, "jours": 60, "desc": "Défauts −15 %, note +0,2"},
    "medical": {"nom": "ISO 13485 (médical)", "prix": 18000, "jours": 90, "requis": "iso", "desc": "Dispositifs médicaux, payés 30 % de plus"},
    "aero":    {"nom": "EN 9100 (aéronautique)", "prix": 25000, "jours": 120, "requis": "iso", "desc": "Avionique, payée 40 % de plus"},
    "auto":    {"nom": "IATF 16949 (automobile)", "prix": 20000, "jours": 90, "requis": "iso", "desc": "Électronique automobile, payée 25 % de plus"},
    "atex":    {"nom": "ATEX (zones explosives)", "prix": 12000, "jours": 60, "requis": "ce", "desc": "Capteurs pour l'industrie lourde, payés 20 % de plus"},
    "espace":  {"nom": "ECSS (spatial)", "prix": 40000, "jours": 150, "requis": "iso", "desc": "Satellites, payés 50 % de plus"},
}
ENTRETIEN_CERTIF = 150  # € par mois et par certification (audits de suivi)

FOURNISSEURS = {
    "europe": {"nom": "Distributeur européen", "desc": "Fiable, prix standard", "proto": 1.0, "jours": 0, "defauts": 1.0, "serie": 1.0, "risque": 0.0},
    "asie":   {"nom": "Grossiste asiatique", "desc": "Protos −40 %, +2 jours, risque de contrefaçons et de ruptures", "proto": 0.6, "jours": 2, "defauts": 1.08, "serie": 1.1, "risque": 0.05},
    "local":  {"nom": "Fabricant local premium", "desc": "Protos +30 %, 1 jour de moins, moins de défauts", "proto": 1.3, "jours": -1, "defauts": 0.9, "serie": 0.95, "risque": 0.0},
}
PRETS = [10000, 25000, 50000]
TAUX_PRET = 0.06  # par an, sur 24 mois

SCENARIOS = {
    "garage":  {"nom": "Le garage", "desc": "Partir de zéro, seul avec 15 000 €. Objectif libre : 20 ans pour devenir une légende."},
    "iot":     {"nom": "Startup IoT", "desc": "Vous maîtrisez déjà le BLE. Objectif : lancer 4 produits maison en 2 ans.",
                "argent": 25000, "technos": ["ble"], "renommee": 1, "objectif": {"type": "produits", "n": 4, "ans": 2}},
    "aero":    {"nom": "Sous-traitant aéro", "desc": "Certifié ISO 9001 dès le départ. Objectif : obtenir l'EN 9100 et 12 de renommée en 4 ans.",
                "argent": 40000, "certifs": ["iso"], "renommee": 3, "objectif": {"type": "aero", "n": 12, "ans": 4}},
    "reprise": {"nom": "Reprise d'entreprise", "desc": "Vous rachetez un bureau de 4 personnes… et son prêt de 60 000 €. Objectif : 300 000 € de trésorerie en 4 ans, prêt remboursé.",
                "argent": 20000, "employes": 3, "locaux": ["bureau"], "pret": 60000, "objectif": {"type": "tresorerie", "n": 300000, "ans": 4}},
}
DIFFICULTES = {
    "facile":    {"nom": "Détente", "argent": 1.6, "impot": 0.15, "attente": -0.5, "paie": 1.1},
    "normal":    {"nom": "Normal", "argent": 1.0, "impot": 0.25, "attente": 0.0, "paie": 1.0},
    "difficile": {"nom": "Expert", "argent": 0.6, "impot": 0.33, "attente": 1.0, "paie": 0.82},
}
SAISONS = ["hiver", "hiver", "printemps", "printemps", "printemps", "ete", "ete", "ete", "automne", "automne", "automne", "hiver"]
METEO = {  # probabilités par saison
    "hiver": {"soleil": 0.4, "pluie": 0.3, "neige": 0.3},
    "printemps": {"soleil": 0.65, "pluie": 0.35},
    "ete": {"soleil": 0.6, "canicule": 0.3, "orage": 0.1},
    "automne": {"soleil": 0.45, "pluie": 0.45, "brouillard": 0.1},
}

# Produits propres : nom, répartition, taille, coût de prototypage, ventes mensuelles potentielles, renommée
PRODUITS = [
    {"id": "meteo", "nom": "Station météo connectée", "rep": (0.45, 0.3, 0.25), "taille": 110, "cout": 3000, "potentiel": 4500, "rep_min": 1},
    {"id": "pedale", "nom": "Pédale d'effet guitare", "rep": (0.6, 0.25, 0.15), "taille": 130, "cout": 3500, "potentiel": 5500, "rep_min": 2},
    {"id": "synth", "nom": "Synthétiseur modulaire", "rep": (0.6, 0.25, 0.15), "taille": 160, "cout": 4500, "potentiel": 6500, "rep_min": 3},
    {"id": "serre", "nom": "Contrôleur de serre", "rep": (0.4, 0.25, 0.35), "taille": 180, "cout": 5000, "potentiel": 7500, "rep_min": 3},
    {"id": "meteo2", "nom": "Station météo Pro", "rep": (0.45, 0.25, 0.3), "taille": 170, "cout": 5000, "potentiel": 7500, "rep_min": 3, "suite": "meteo"},
    {"id": "chargeur", "nom": "Chargeur USB-C 140 W", "rep": (0.65, 0.25, 0.1), "taille": 170, "cout": 6000, "potentiel": 8500, "rep_min": 4, "requis": "usb"},
    {"id": "pedale2", "nom": "Pédale multi-effets", "rep": (0.55, 0.2, 0.25), "taille": 210, "cout": 6000, "potentiel": 9000, "rep_min": 4, "suite": "pedale"},
    {"id": "robot", "nom": "Robot éducatif", "rep": (0.35, 0.35, 0.3), "taille": 300, "cout": 9000, "potentiel": 13000, "rep_min": 5},
    {"id": "montre", "nom": "Montre de sport", "rep": (0.35, 0.35, 0.3), "taille": 260, "cout": 8000, "potentiel": 12000, "rep_min": 5, "requis": "ble"},
    {"id": "lora", "nom": "Module LoRa grand public", "rep": (0.5, 0.15, 0.35), "taille": 260, "cout": 7000, "potentiel": 11000, "rep_min": 6},
    {"id": "carte3d", "nom": "Carte mère d'imprimante 3D", "rep": (0.55, 0.1, 0.35), "taille": 240, "cout": 7000, "potentiel": 10500, "rep_min": 6},
    {"id": "serre2", "nom": "Serre autonome", "rep": (0.4, 0.3, 0.3), "taille": 290, "cout": 9000, "potentiel": 13500, "rep_min": 6, "suite": "serre"},
    {"id": "trott", "nom": "Kit trottinette électrique", "rep": (0.45, 0.3, 0.25), "taille": 340, "cout": 11000, "potentiel": 16000, "rep_min": 7, "requis": "moteur"},
    {"id": "robot2", "nom": "Robot éducatif 2", "rep": (0.35, 0.35, 0.3), "taille": 420, "cout": 13000, "potentiel": 19000, "rep_min": 8, "suite": "robot"},
    {"id": "camera", "nom": "Caméra animalière IA", "rep": (0.35, 0.25, 0.4), "taille": 380, "cout": 12000, "potentiel": 18000, "rep_min": 8, "requis": "ia"},
    {"id": "drone", "nom": "Contrôleur de vol open source", "rep": (0.45, 0.15, 0.4), "taille": 480, "cout": 15000, "potentiel": 22000, "rep_min": 9},
    {"id": "montre2", "nom": "Montre de sport GPS", "rep": (0.35, 0.3, 0.35), "taille": 400, "cout": 13000, "potentiel": 19500, "rep_min": 9, "suite": "montre"},
    {"id": "lora2", "nom": "Passerelle LoRa maison", "rep": (0.5, 0.15, 0.35), "taille": 380, "cout": 11000, "potentiel": 17000, "rep_min": 9, "suite": "lora"},
    {"id": "batterie", "nom": "Batterie domestique", "rep": (0.6, 0.25, 0.15), "taille": 600, "cout": 22000, "potentiel": 30000, "rep_min": 11, "requis": "hv"},
    {"id": "sdr", "nom": "Radio logicielle amateur", "rep": (0.55, 0.1, 0.35), "taille": 560, "cout": 20000, "potentiel": 27000, "rep_min": 12, "requis": "fpga"},
    {"id": "robot3", "nom": "Robot éducatif 3", "rep": (0.35, 0.35, 0.3), "taille": 600, "cout": 20000, "potentiel": 28000, "rep_min": 12, "suite": "robot2"},
    {"id": "drone2", "nom": "Autopilote de drone pro", "rep": (0.45, 0.15, 0.4), "taille": 700, "cout": 25000, "potentiel": 34000, "rep_min": 13, "suite": "drone"},
    # idées du chargé d'innovation : il faut l'avoir nommé
    {"id": "eolienne", "nom": "Capteur prédictif pour éoliennes", "rep": (0.4, 0.15, 0.45), "taille": 360, "cout": 12000, "potentiel": 18000, "rep_min": 6, "innovation": True},
    {"id": "patch", "nom": "Patch de santé connecté", "rep": (0.4, 0.3, 0.3), "taille": 420, "cout": 14000, "potentiel": 22000, "rep_min": 8, "innovation": True},
]

# Phases d'un projet : part des points de chaque domaine
PHASES = [
    ("Schéma et architecture", {"e": 0.35, "m": 0.2, "f": 0.15}),
    ("Routage PCB et pièces 3D", {"e": 0.4, "m": 0.65, "f": 0.05}),
    ("Firmware et bring-up", {"e": 0.25, "m": 0.15, "f": 0.8}),
]

MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

# Horaires de travail (heures par jour) : productivité, moral, fatigue, défauts, surcoût salarial (heures sup)
HORAIRES = {
    6:  {"nom": "6 h · mi-temps confort", "prod": 0.80, "moral": 8, "fatigue": 0.5, "defauts": 0.9, "salaire": 0.0},
    7:  {"nom": "7 h · semaine de 35 h", "prod": 0.92, "moral": 4, "fatigue": 0.75, "defauts": 0.95, "salaire": 0.0},
    8:  {"nom": "8 h · horaires classiques", "prod": 1.0, "moral": 0, "fatigue": 1.0, "defauts": 1.0, "salaire": 0.0},
    9:  {"nom": "9 h · on pousse un peu", "prod": 1.10, "moral": -4, "fatigue": 1.35, "defauts": 1.05, "salaire": 0.03},
    10: {"nom": "10 h · rush", "prod": 1.18, "moral": -9, "fatigue": 1.8, "defauts": 1.15, "salaire": 0.06},
    12: {"nom": "12 h · crunch", "prod": 1.26, "moral": -18, "fatigue": 2.8, "defauts": 1.4, "salaire": 0.12},
}

# Combos d'équipe sur un projet
COMBOS = {
    "trio":    {"nom": "Équipe complète", "desc": "Un spécialiste (5+) dans chaque domaine du projet : +10 % de production, note +0,4"},
    "qualite": {"nom": "Duo qualité", "desc": "Un perfectionniste et un chasseur de bugs : 30 % de défauts en moins"},
    "mentor":  {"nom": "Mentorat", "desc": "Un expert (9+) et un junior : le junior progresse deux fois plus vite"},
    "soudee":  {"nom": "Équipe soudée", "desc": "4 personnes ou plus, toutes avec un moral de 65 % ou plus : +5 % de production"},
}

DUREE_PARTIE_ANS = 20
TROPHEES = {
    "premier_contrat": {"nom": "Premier client", "desc": "Livrer un premier contrat"},
    "note_9":          {"nom": "Travail d'orfèvre", "desc": "Obtenir une note de 9 ou plus"},
    "note_10":         {"nom": "Perfection", "desc": "Obtenir 10/10"},
    "sans_faute":      {"nom": "Sans faute", "desc": "Livrer un gros contrat (300+) sans échec CEM avec 8 ou plus"},
    "equipe_6":        {"nom": "Ça s'agrandit", "desc": "Avoir 6 employés"},
    "equipe_10":       {"nom": "Plateau complet", "desc": "Avoir 10 employés"},
    "parallele":       {"nom": "Chef d'orchestre", "desc": "Mener 3 projets en même temps"},
    "trio":            {"nom": "Dream team", "desc": "Activer le combo Équipe complète"},
    "siege":           {"nom": "Siège social", "desc": "Installer votre bureau en direction générale"},
    "trois_produits":  {"nom": "Fabricant", "desc": "Lancer 3 produits maison"},
    "produit_star":    {"nom": "Produit star", "desc": "Un produit maison noté 8,5 ou plus"},
    "vingt_contrats":  {"nom": "Habitué des appels d'offres", "desc": "Livrer 20 contrats"},
    "renommee_10":     {"nom": "Connu dans la région", "desc": "Atteindre 10 de renommée"},
    "renommee_25":     {"nom": "Référence nationale", "desc": "Atteindre 25 de renommée"},
    "cent_mille":      {"nom": "Coussin de sécurité", "desc": "Avoir 100 000 € en trésorerie"},
    "million":         {"nom": "Millionnaire", "desc": "Avoir 1 000 000 € en trésorerie"},
    "batiment_b":      {"nom": "Tout l'immeuble", "desc": "Avoir des bureaux occupés aux trois étages"},
    "usine":           {"nom": "On industrialise !", "desc": "Industrialiser un produit fini"},
    "partenaire":      {"nom": "Partenaire de confiance", "desc": "Un client atteint le niveau Partenaire"},
    "gamme":           {"nom": "Gamme complète", "desc": "Lancer la suite d'un de vos produits"},
    "mega":            {"nom": "Démesure", "desc": "Livrer un méga-projet"},
    "cinquante":       {"nom": "Usine à projets", "desc": "Livrer 50 contrats"},
    "dix_missions":    {"nom": "Ambitieux", "desc": "Accomplir 10 missions"},
    "toutes_missions": {"nom": "Mission accomplie", "desc": "Accomplir toutes les missions"},
}
# Missions : une suite d'objectifs ; les 3 premiers non accomplis sont proposés
# (id, texte, mesure, seuil, récompense en €, renommée gagnée) ; mesure "secteur:x" = contrats livrés dans ce secteur
MISSIONS = [
    ("m_premier", "Livrer votre premier contrat", "livres", 1, 1000, 0),
    ("m_equipe2", "Embaucher un premier employé", "employes", 2, 1000, 0),
    ("m_bureau", "Emménager dans le bâtiment", "local:bureau", 1, 1500, 0),
    ("m_livres5", "Livrer 5 contrats", "livres", 5, 2500, 1),
    ("m_note8", "Obtenir une note de 8 ou plus", "note", 8, 2000, 0),
    ("m_produit", "Lancer un produit maison", "produits", 1, 2500, 0),
    ("m_techno", "Maîtriser une technologie", "technos", 1, 3000, 0),
    ("m_rep3", "Atteindre 3 de renommée", "renommee", 3, 3000, 0),
    ("m_equipe4", "Avoir une équipe de 4 personnes", "employes", 4, 4000, 0),
    ("m_maison", "Livrer 3 contrats Maison connectée", "secteur:maison", 3, 4000, 0),
    ("m_fidele", "Rendre un client fidèle", "fideles", 1, 5000, 1),
    ("m_certif", "Obtenir une certification", "certifs", 1, 5000, 0),
    ("m_livres15", "Livrer 15 contrats", "livres", 15, 8000, 0),
    ("m_openspace", "Industrialiser un projet", "indus", 1, 6000, 0),
    ("m_agri", "Livrer 4 contrats Agriculture", "secteur:agri", 4, 7000, 0),
    ("m_serie", "Décrocher une production en série", "series", 1, 6000, 0),
    ("m_suite", "Lancer la suite d'un produit", "suites", 1, 8000, 0),
    ("m_rep8", "Atteindre 8 de renommée", "renommee", 8, 10000, 0),
    ("m_equipe8", "Avoir une équipe de 8 personnes", "employes", 8, 10000, 0),
    ("m_energie", "Livrer 4 contrats Énergie", "secteur:energie", 4, 12000, 0),
    ("m_technos4", "Maîtriser 4 technologies", "technos", 4, 15000, 0),
    ("m_plateau", "Avoir un chef de projet", "chefs", 1, 15000, 0),
    ("m_note9", "Obtenir une note de 9 ou plus", "note", 9, 12000, 0),
    ("m_fideles3", "Avoir 3 clients fidèles", "fideles", 3, 15000, 0),
    ("m_mobilite", "Livrer 5 contrats Mobilité", "secteur:mobilite", 5, 18000, 0),
    ("m_livres40", "Livrer 40 contrats", "livres", 40, 25000, 1),
    ("m_produits6", "Lancer 6 produits maison", "produits", 6, 20000, 0),
    ("m_medical", "Livrer 3 contrats Médical", "secteur:medical", 3, 25000, 0),
    ("m_cms", "Qualifier un produit fini", "qualif", 1, 30000, 0),
    ("m_rep15", "Atteindre 15 de renommée", "renommee", 15, 30000, 0),
    ("m_mega", "Livrer un méga-projet", "megas", 1, 50000, 2),
    ("m_certifs4", "Obtenir 4 certifications", "certifs", 4, 40000, 0),
    ("m_telecom", "Livrer 4 contrats Télécoms", "secteur:telecom", 4, 40000, 0),
    ("m_equipe15", "Avoir une équipe de 15 personnes", "employes", 15, 40000, 0),
    ("m_aero", "Livrer 3 contrats Aéro et drones", "secteur:aero", 3, 50000, 0),
    ("m_note10", "Obtenir 10/10", "note", 10, 40000, 1),
    ("m_fideles6", "Avoir 6 clients fidèles", "fideles", 6, 50000, 0),
    ("m_spatial", "Livrer un contrat Spatial", "secteur:spatial", 1, 80000, 1),
    ("m_megas3", "Livrer 3 méga-projets", "megas", 3, 120000, 2),
    ("m_livres100", "Livrer 100 contrats", "livres", 100, 150000, 2),
]
NB_MISSIONS_ACTIVES = 3

TITRES_FIN = [(15000, "Bricoleur du dimanche"), (35000, "Petit bureau d'études"), (60000, "PME reconnue"),
              (95000, "Référence nationale"), (10 ** 9, "Légende de l'électronique")]
