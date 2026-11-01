"""Catalogues du jeu : matériel, aménagement, locaux, traits, contrats, produits."""

DOMAINES = ("e", "m", "f")
NOM_DOMAINE = {"e": "Élec", "m": "Méca 3D", "f": "Firmware"}

# Pièces du plan (coordonnées du monde, en px) et local qu'il faut louer pour les utiliser
PIECES = {
    "garage":    {"nom": "Garage", "rect": (18, 26, 228, 226), "local": None},
    "bureau":    {"nom": "Bureau agrandi", "rect": (246, 26, 126, 226), "local": "bureau"},
    "labo":      {"nom": "Labo élec", "rect": (18, 258, 175, 364), "local": None},
    "atelier":   {"nom": "Atelier 3D", "rect": (197, 258, 175, 364), "local": "atelier"},
    "openspace": {"nom": "Open space", "rect": (18, 628, 175, 274), "local": "openspace"},
    "cem":       {"nom": "Labo CEM", "rect": (197, 628, 175, 274), "local": "cem"},
    "pause":     {"nom": "Salle de pause", "rect": (18, 912, 174, 184), "local": "pause"},
}
INTERIEUR = list(PIECES)
TRAVAIL = ["garage", "bureau", "openspace"]
# Établis fixes : ni bureau ni déco dessus (le petit matériel, lui, peut y être posé)
ETABLIS = [(24, 31, 342, 26), (23, 266, 44, 348)]
GRILLE = 4

# Poste de travail : l'emprise inclut la chaise et la place de l'employé au-dessus du meuble
POSTE = {"nom": "Bureau de travail", "prix": 400, "w": 76, "h": 64, "pieces": TRAVAIL}
POSTES_DEPART = [(34, 66), (147, 66)]

# Matériel : bonus de production (10 % par point), debug (détection des défauts), cem (chance aux tests)
# w, h : taille sur le plan ; pos : emplacement par défaut (achat automatique, anciennes sauvegardes)
_FW = ["garage", "bureau", "labo", "openspace"]
MATERIEL = {
    # Labo électronique
    "multi":    {"nom": "Multimètre", "dom": "e", "prix": 150, "bonus": 1, "piece": "labo", "w": 28, "h": 36, "pos": (30, 278)},
    "station":  {"nom": "Station de soudage", "dom": "e", "prix": 300, "bonus": 1, "piece": "labo", "w": 28, "h": 36, "pos": (30, 326)},
    "alim":     {"nom": "Alimentation de labo", "dom": "e", "prix": 450, "bonus": 1, "piece": "labo", "w": 32, "h": 32, "pos": (28, 374)},
    "micro":    {"nom": "Microscope de soudure", "dom": "e", "prix": 1800, "bonus": 1, "debug": 1, "piece": "labo", "w": 32, "h": 36, "pos": (28, 476)},
    "oscillo":  {"nom": "Oscilloscope 4 voies", "dom": "e", "prix": 2800, "bonus": 2, "debug": 1, "piece": "labo", "w": 36, "h": 44, "pos": (26, 420)},
    "sonde":    {"nom": "Sondes champ proche", "dom": "e", "prix": 1200, "bonus": 0, "cem": 0.10, "piece": "labo", "w": 28, "h": 30, "pos": (30, 526)},
    "four":     {"nom": "Four de refusion", "dom": "e", "prix": 6500, "bonus": 3, "piece": "labo", "w": 74, "h": 56, "pos": (110, 284)},
    "spectre":  {"nom": "Analyseur de spectre", "dom": "e", "prix": 14000, "bonus": 2, "cem": 0.10, "piece": "labo", "w": 74, "h": 44, "pos": (110, 372)},
    # Atelier méca / 3D
    "fdm":      {"nom": "Imprimante 3D FDM", "dom": "m", "prix": 650, "bonus": 2, "piece": "atelier", "w": 46, "h": 46, "pos": (214, 274)},
    "resine":   {"nom": "Imprimante résine", "dom": "m", "prix": 2400, "bonus": 2, "piece": "atelier", "w": 38, "h": 42, "pos": (270, 276)},
    "cao":      {"nom": "Poste CAO 3D + licence", "dom": "m", "prix": 3500, "bonus": 3, "piece": "atelier", "w": 100, "h": 36, "pos": (214, 344)},
    "cnc":      {"nom": "Fraiseuse CNC", "dom": "m", "prix": 16000, "bonus": 4, "piece": "atelier", "w": 140, "h": 100, "pos": (216, 430)},
    # Firmware (établi du bureau, ou labo)
    "stlink":   {"nom": "Programmateur ST-Link", "dom": "f", "prix": 40, "bonus": 1, "piece": "bureau", "pieces": _FW, "w": 20, "h": 20, "pos": (30, 34)},
    "logique":  {"nom": "Analyseur logique", "dom": "f", "prix": 350, "bonus": 1, "debug": 1, "piece": "bureau", "pieces": _FW, "w": 34, "h": 20, "pos": (58, 34)},
    "jlink":    {"nom": "Sonde J-Link", "dom": "f", "prix": 950, "bonus": 2, "debug": 1, "piece": "bureau", "pieces": _FW, "w": 28, "h": 20, "pos": (100, 34)},
    "ci":       {"nom": "Serveur d'intégration continue", "dom": "f", "prix": 2200, "bonus": 2, "debug": 1, "piece": "bureau", "pieces": _FW, "w": 40, "h": 24, "pos": (136, 32)},
    "banc":     {"nom": "Banc de test automatisé", "dom": "f", "prix": 9000, "bonus": 2, "debug": 2, "piece": "bureau", "pieces": _FW, "w": 90, "h": 24, "pos": (184, 32)},
    # Labo CEM
    "esd":      {"nom": "Générateur ESD", "dom": "c", "prix": 3500, "bonus": 0, "cem": 0.08, "piece": "cem", "w": 40, "h": 40, "pos": (220, 816)},
    "chambre":  {"nom": "Chambre CEM de pré-conformité", "dom": "c", "prix": 22000, "bonus": 0, "cem": 0.25, "piece": "cem", "w": 144, "h": 130, "pos": (214, 648)},
}
for _m in MATERIEL.values():
    _m.setdefault("pieces", [_m["piece"]])
MATERIEL_DEPART = ["multi", "station", "stlink"]

# Aménagement. Effet (moral, prod) compté une fois par type, même avec plusieurs exemplaires.
# global : amélioration sans objet à poser ; multiple : plusieurs exemplaires possibles ; libre : mural ou au sol, ne gêne rien
DECO = {
    "plantes":  {"nom": "Plante verte", "prix": 180, "moral": 5, "w": 28, "h": 28, "multiple": True, "pos": (340, 196)},
    "ficus":    {"nom": "Ficus", "prix": 350, "moral": 2, "w": 36, "h": 36, "multiple": True},
    "tableau":  {"nom": "Tableau blanc", "prix": 250, "moral": 3, "w": 68, "h": 12, "libre": True, "pos": (294, 60)},
    "cafe":     {"nom": "Machine à café", "prix": 600, "moral": 7, "w": 20, "h": 28, "pos": (346, 64)},
    "fontaine": {"nom": "Fontaine à eau", "prix": 300, "moral": 2, "w": 18, "h": 22, "multiple": True},
    "distrib":  {"nom": "Distributeur de snacks", "prix": 700, "moral": 3, "w": 30, "h": 24},
    "clim":     {"nom": "Climatisation", "prix": 2500, "moral": 4, "w": 44, "h": 12, "libre": True, "effet": "Supprime le malus de canicule (juin à août)", "pos": (60, 20)},
    "biblio":   {"nom": "Bibliothèque de datasheets", "prix": 800, "moral": 1, "prod": 2, "w": 64, "h": 16, "effet": "+2 % de productivité"},
    "armoire":  {"nom": "Armoire à composants", "prix": 1200, "moral": 0, "prod": 3, "w": 44, "h": 22, "effet": "+3 % de productivité"},
    "imprimante": {"nom": "Imprimante de bureau", "prix": 400, "moral": 0, "prod": 1, "w": 28, "h": 22, "effet": "+1 % de productivité"},
    "table":    {"nom": "Table de réunion", "prix": 1500, "moral": 2, "prod": 2, "w": 72, "h": 44, "effet": "+2 % de productivité"},
    "aquarium": {"nom": "Aquarium", "prix": 900, "moral": 4, "w": 40, "h": 24},
    "lampe":    {"nom": "Lampadaire", "prix": 150, "moral": 1, "w": 16, "h": 16, "multiple": True},
    "poster":   {"nom": "Affiche de circuit vintage", "prix": 120, "moral": 1, "w": 30, "h": 10, "multiple": True, "libre": True},
    "tapis":    {"nom": "Tapis", "prix": 200, "moral": 1, "w": 60, "h": 40, "multiple": True, "libre": True},
    "canape":   {"nom": "Canapé", "prix": 900, "moral": 6, "w": 90, "h": 36, "pieces": ["pause", "openspace"], "pos": (26, 1028)},
    "babyfoot": {"nom": "Baby-foot", "prix": 1200, "moral": 8, "w": 54, "h": 44, "pieces": ["pause", "openspace"], "pos": (100, 960)},
    "arcade":   {"nom": "Borne d'arcade", "prix": 2000, "moral": 6, "w": 30, "h": 30, "pieces": ["pause", "openspace"]},
    "sieges":   {"nom": "Sièges ergonomiques", "prix": 1500, "moral": 3, "prod": 8, "global": True, "effet": "+8 % de productivité"},
    "eclairage": {"nom": "Éclairage LED", "prix": 800, "moral": 2, "prod": 4, "global": True, "effet": "+4 % de productivité"},
    "isolation": {"nom": "Isolation phonique", "prix": 3000, "moral": 2, "global": True, "effet": "Supprime le malus de bruit"},
}
for _d in DECO.values():
    _d.setdefault("pieces", INTERIEUR)

# Locaux : prix d'achat, loyer mensuel ajouté, renommée requise
LOCAUX = {
    "bureau":    {"nom": "Agrandir le bureau d'études", "desc": "Place pour 2 à 3 bureaux de plus", "prix": 6000, "loyer": 500, "rep": 0},
    "atelier":   {"nom": "Atelier méca / 3D", "desc": "Débloque impression 3D et usinage", "prix": 8000, "loyer": 400, "rep": 0},
    "openspace": {"nom": "Open space", "desc": "Place pour 4 à 6 bureaux, coin détente possible", "prix": 20000, "loyer": 700, "rep": 3},
    "pause":     {"nom": "Salle de pause", "desc": "Pauses plus reposantes (fatigue −5 par jour au lieu de −3), moral +5", "prix": 5000, "loyer": 300, "rep": 1},
    "cem":       {"nom": "Labo CEM", "desc": "Tests CEM gratuits et équipements dédiés", "prix": 15000, "loyer": 600, "rep": 4},
}
LOYER_BASE = 400
# Anciennes positions des postes (sauvegardes v2) : coin haut-gauche de l'emprise
ANCIENS_POSTES = [(34, 66), (147, 66), (260, 66), (34, 152), (147, 152), (260, 152), (26, 660), (108, 660), (26, 760), (108, 760)]

TRAITS = {
    "perfectionniste": {"nom": "Perfectionniste", "desc": "Moins de défauts, un peu plus lent", "vitesse": 0.9, "defauts": 0.5},
    "rapide":   {"nom": "Rapide", "desc": "Travaille vite mais laisse plus de défauts", "vitesse": 1.25, "defauts": 1.5},
    "creatif":  {"nom": "Créatif", "desc": "Améliore la note finale des projets", "qualite": 0.3},
    "sociable": {"nom": "Sociable", "desc": "Remonte le moral de l'équipe", "moral": 4},
    "raleur":   {"nom": "Râleur", "desc": "Efficace mais plombe l'ambiance", "vitesse": 1.1, "moral": -5},
    "debug":    {"nom": "Chasseur de bugs", "desc": "Trouve deux fois plus de défauts", "detection": 2.0},
    "endurant": {"nom": "Endurant", "desc": "Se fatigue deux fois moins vite", "fatigue": 0.5},
}

PRENOMS = ["Léa", "Hugo", "Inès", "Sami", "Marc", "Chloé", "Yanis", "Camille", "Lucas", "Nora", "Théo",
           "Emma", "Rayan", "Julie", "Maël", "Sarah", "Nathan", "Zoé", "Karim", "Manon", "Bastien", "Elsa",
           "Antoine", "Lina", "Quentin", "Jade", "Mathis", "Anaïs", "Victor", "Amina"]
COULEURS = ["#6aa8f0", "#f08a6c", "#b08af0", "#7be08a", "#ffc94d", "#ef6f9a", "#5ccfc4", "#e8e8e8", "#ff9a4a"]
CHEVEUX = ["#2b1d14", "#5a3a22", "#e0703a", "#f2d06b", "#1a1a1a", "#9a9a9a", "#8a4a2a", "#c76b9e"]
PEAUX = ["#f8d8b8", "#f6cfa6", "#eab994", "#c98e5e", "#a86b45", "#7a4a2e"]

# Profils de recrutement : poids de répartition des compétences
POSTES = [
    {"nom": "Technicien·ne élec", "poids": {"e": 0.7, "m": 0.1, "f": 0.2}},
    {"nom": "Dessinateur·rice 3D", "poids": {"e": 0.05, "m": 0.85, "f": 0.1}},
    {"nom": "Dév firmware", "poids": {"e": 0.15, "m": 0.0, "f": 0.85}},
    {"nom": "Ingé hardware", "poids": {"e": 0.6, "m": 0.05, "f": 0.35}},
    {"nom": "Ingé mécatronique", "poids": {"e": 0.3, "m": 0.5, "f": 0.2}},
]

CLIENTS = ["Atelier Bois et Co", "DomoSud", "AgriTech Gironde", "VéloMotion", "Aéro Systèmes", "MedNova",
           "Océane Robotics", "Vignobles Connectés", "BatiSmart", "EnergiPlus", "LudoKit", "Port Atlantique",
           "Rail Services", "SolarFerme", "Brasserie du Bassin"]

# Modèles de contrats : nom, répartition e/m/f, taille de base, renommée minimale
# Modèles de contrats : nom, répartition e/m/f, taille de base, renommée minimale, technologie ou certification requise
CONTRATS = [
    ("Carte LED pour enseigne", (0.75, 0.0, 0.25), 40, 0, None),
    ("Interface capteur industriel", (0.7, 0.1, 0.2), 60, 0, None),
    ("Thermostat connecté", (0.4, 0.3, 0.3), 90, 0, None),
    ("Boîtier domotique Zigbee", (0.35, 0.35, 0.3), 120, 1, "ble"),
    ("Bracelet connecté", (0.35, 0.35, 0.3), 110, 1, "ble"),
    ("Chargeur de batterie lithium", (0.6, 0.15, 0.25), 140, 2, "hv"),
    ("Capteur LoRa agricole", (0.4, 0.2, 0.4), 150, 3, "rf"),
    ("Onduleur solaire", (0.6, 0.2, 0.2), 230, 4, "hv"),
    ("Contrôleur moteur BLDC", (0.45, 0.1, 0.45), 260, 5, "moteur"),
    ("Tracker GPS pour flotte", (0.4, 0.2, 0.4), 240, 6, "rf"),
    ("Caméra intelligente", (0.35, 0.2, 0.45), 320, 7, "ia"),
    ("Module radio 2,4 GHz", (0.55, 0.15, 0.3), 380, 9, "rf"),
    ("Instrument médical portable", (0.4, 0.3, 0.3), 500, 10, "medical"),
    ("Calculateur pour drone", (0.4, 0.2, 0.4), 650, 12, "moteur"),
    ("Équipement avionique", (0.5, 0.2, 0.3), 700, 14, "aero"),
]
PRIMES = {"medical": 1.3, "aero": 1.4}

# Choix techniques faits à la signature d'un projet
CHOIX_TECH = {
    "couches": {"nom": "Couches du PCB", "defaut": "4", "options": {
        "2": {"nom": "2 couches", "desc": "Proto moins cher, CEM plus difficile", "proto": 0.8, "cem": -0.08},
        "4": {"nom": "4 couches", "desc": "Le bon compromis"},
        "6": {"nom": "6 couches", "desc": "Proto cher, CEM facile, note +0,2", "proto": 1.6, "cem": 0.10, "note": 0.2},
    }},
    "mcu": {"nom": "Microcontrôleur", "defaut": "stm32", "options": {
        "stm32": {"nom": "STM32", "desc": "Polyvalent et bien connu"},
        "esp32": {"nom": "ESP32", "desc": "Wi-Fi intégré : firmware −15 %, CEM plus délicate", "f": 0.85, "cem": -0.05},
        "nrf": {"nom": "nRF52", "desc": "BLE basse conso : firmware +15 %, note +0,3", "f": 1.15, "note": 0.3, "requis": "ble"},
    }},
    "boitier": {"nom": "Boîtier", "defaut": "usine", "options": {
        "impression": {"nom": "Impression 3D", "desc": "Méca −30 %, note −0,3", "m": 0.7, "note": -0.3},
        "usine": {"nom": "Usiné", "desc": "Solide et standard"},
        "injection": {"nom": "Moule d'injection", "desc": "Moule 3 000 €, méca +25 %, note +0,5", "m": 1.25, "note": 0.5, "cout": 3000},
    }},
}
# Négociation : prix et délai proposés au client (multiplicateurs)
PRIX_PROPOSES = {"1.0": "Prix affiché", "1.1": "+10 %", "1.2": "+20 %", "1.3": "+30 %"}
DELAIS_PROPOSES = {"0.8": "−20 %", "1.0": "Délai affiché", "1.2": "+20 %"}
CONCURRENTS = [("ElectroConcept", 3), ("Circuits du Sud-Ouest", 6), ("Volta Ingénierie", 10)]

TECHNOS = {
    "ble":    {"nom": "Bluetooth Low Energy", "prix": 4000, "jours": 30, "desc": "Objets connectés et nRF52 ; firmware +10 %"},
    "rf":     {"nom": "Radiofréquence", "prix": 8000, "jours": 45, "desc": "Radio, LoRa et GPS ; tests CEM +5 %"},
    "hv":     {"nom": "Électronique de puissance", "prix": 7000, "jours": 40, "desc": "Chargeurs et onduleurs"},
    "moteur": {"nom": "Contrôle moteur", "prix": 9000, "jours": 45, "desc": "Contrôleurs BLDC et drones"},
    "dfm":    {"nom": "Conception pour la fabrication", "prix": 6000, "jours": 30, "desc": "Prototypes −30 %, défauts −10 %"},
    "ia":     {"nom": "IA embarquée", "prix": 15000, "jours": 60, "requis": "ble", "desc": "Caméras intelligentes ; note +0,2"},
}
CERTIFS = {
    "ce":      {"nom": "Marquage CE maîtrisé", "prix": 3000, "jours": 20, "desc": "Paie des contrats +5 %"},
    "iso":     {"nom": "ISO 9001", "prix": 10000, "jours": 60, "desc": "Défauts −15 %, note +0,2"},
    "medical": {"nom": "ISO 13485 (médical)", "prix": 18000, "jours": 90, "requis": "iso", "desc": "Dispositifs médicaux, payés 30 % de plus"},
    "aero":    {"nom": "EN 9100 (aéronautique)", "prix": 25000, "jours": 120, "requis": "iso", "desc": "Avionique, payée 40 % de plus"},
}
ENTRETIEN_CERTIF = 150  # € par mois et par certification (audits de suivi)

FOURNISSEURS = {
    "europe": {"nom": "Distributeur européen", "desc": "Fiable, prix standard", "proto": 1.0, "jours": 0, "defauts": 1.0, "serie": 1.0, "risque": 0.0},
    "asie":   {"nom": "Grossiste asiatique", "desc": "Protos −40 %, +2 jours, risque de contrefaçons et de ruptures", "proto": 0.6, "jours": 2, "defauts": 1.15, "serie": 1.1, "risque": 0.12},
    "local":  {"nom": "Fabricant local premium", "desc": "Protos +30 %, 1 jour de moins, moins de défauts", "proto": 1.3, "jours": -1, "defauts": 0.9, "serie": 0.95, "risque": 0.0},
}
PRETS = [10000, 25000, 50000]
TAUX_PRET = 0.06  # par an, sur 24 mois

SCENARIOS = {
    "garage":  {"nom": "Le garage", "desc": "Partir de zéro, seul avec 15 000 €. Objectif libre : 20 ans pour devenir une légende."},
    "iot":     {"nom": "Startup IoT", "desc": "Vous maîtrisez déjà le BLE. Objectif : lancer 3 produits maison en 5 ans.",
                "argent": 25000, "technos": ["ble"], "renommee": 1, "objectif": {"type": "produits", "n": 3, "ans": 5}},
    "aero":    {"nom": "Sous-traitant aéro", "desc": "Certifié ISO 9001 dès le départ. Objectif : obtenir l'EN 9100 et 25 de renommée en 8 ans.",
                "argent": 40000, "certifs": ["iso"], "renommee": 3, "objectif": {"type": "aero", "n": 25, "ans": 8}},
    "reprise": {"nom": "Reprise d'entreprise", "desc": "Vous rachetez un bureau de 4 personnes… et son prêt de 60 000 €. Objectif : 200 000 € de trésorerie en 6 ans, prêt remboursé.",
                "argent": 20000, "employes": 3, "locaux": ["bureau"], "pret": 60000, "objectif": {"type": "tresorerie", "n": 200000, "ans": 6}},
}
DIFFICULTES = {
    "facile":    {"nom": "Détente", "argent": 1.6, "impot": 0.15, "attente": -0.5, "paie": 1.1},
    "normal":    {"nom": "Normal", "argent": 1.0, "impot": 0.25, "attente": 0.0, "paie": 1.0},
    "difficile": {"nom": "Expert", "argent": 0.6, "impot": 0.33, "attente": 0.5, "paie": 0.92},
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
    {"id": "serre", "nom": "Contrôleur de serre", "rep": (0.4, 0.25, 0.35), "taille": 180, "cout": 5000, "potentiel": 7500, "rep_min": 3},
    {"id": "robot", "nom": "Robot éducatif", "rep": (0.35, 0.35, 0.3), "taille": 300, "cout": 9000, "potentiel": 13000, "rep_min": 5},
    {"id": "lora", "nom": "Module LoRa grand public", "rep": (0.5, 0.15, 0.35), "taille": 260, "cout": 7000, "potentiel": 11000, "rep_min": 6},
    {"id": "drone", "nom": "Contrôleur de vol open source", "rep": (0.45, 0.15, 0.4), "taille": 480, "cout": 15000, "potentiel": 22000, "rep_min": 9},
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
    "labo_cem":        {"nom": "Indépendance CEM", "desc": "Ouvrir son propre labo CEM"},
    "trois_produits":  {"nom": "Fabricant", "desc": "Lancer 3 produits maison"},
    "produit_star":    {"nom": "Produit star", "desc": "Un produit maison noté 8,5 ou plus"},
    "vingt_contrats":  {"nom": "Habitué des appels d'offres", "desc": "Livrer 20 contrats"},
    "renommee_10":     {"nom": "Connu dans la région", "desc": "Atteindre 10 de renommée"},
    "renommee_25":     {"nom": "Référence nationale", "desc": "Atteindre 25 de renommée"},
    "cent_mille":      {"nom": "Coussin de sécurité", "desc": "Avoir 100 000 € en trésorerie"},
    "million":         {"nom": "Millionnaire", "desc": "Avoir 1 000 000 € en trésorerie"},
}
TITRES_FIN = [(1000, "Bricoleur du dimanche"), (3000, "Petit bureau d'études"), (7000, "PME reconnue"),
              (15000, "Référence nationale"), (10 ** 9, "Légende de l'électronique")]
