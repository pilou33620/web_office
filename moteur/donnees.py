"""Catalogues du jeu : matériel, aménagement, locaux, traits, contrats, produits."""

DOMAINES = ("e", "m", "f")
NOM_DOMAINE = {"e": "Élec", "m": "Méca 3D", "f": "Firmware"}

# Matériel : bonus de production (10 % par point), debug (détection des défauts), cem (chance aux tests)
MATERIEL = {
    # Labo électronique
    "multi":    {"nom": "Multimètre", "dom": "e", "prix": 150, "bonus": 1, "piece": "labo"},
    "station":  {"nom": "Station de soudage", "dom": "e", "prix": 300, "bonus": 1, "piece": "labo"},
    "alim":     {"nom": "Alimentation de labo", "dom": "e", "prix": 450, "bonus": 1, "piece": "labo"},
    "micro":    {"nom": "Microscope de soudure", "dom": "e", "prix": 1800, "bonus": 1, "debug": 1, "piece": "labo"},
    "oscillo":  {"nom": "Oscilloscope 4 voies", "dom": "e", "prix": 2800, "bonus": 2, "debug": 1, "piece": "labo"},
    "sonde":    {"nom": "Sondes champ proche", "dom": "e", "prix": 1200, "bonus": 0, "cem": 0.10, "piece": "labo"},
    "four":     {"nom": "Four de refusion", "dom": "e", "prix": 6500, "bonus": 3, "piece": "labo"},
    "spectre":  {"nom": "Analyseur de spectre", "dom": "e", "prix": 14000, "bonus": 2, "cem": 0.10, "piece": "labo"},
    # Atelier méca / 3D
    "fdm":      {"nom": "Imprimante 3D FDM", "dom": "m", "prix": 650, "bonus": 2, "piece": "atelier"},
    "resine":   {"nom": "Imprimante résine", "dom": "m", "prix": 2400, "bonus": 2, "piece": "atelier"},
    "cao":      {"nom": "Poste CAO 3D + licence", "dom": "m", "prix": 3500, "bonus": 3, "piece": "atelier"},
    "cnc":      {"nom": "Fraiseuse CNC", "dom": "m", "prix": 16000, "bonus": 4, "piece": "atelier"},
    # Firmware (établi du bureau)
    "stlink":   {"nom": "Programmateur ST-Link", "dom": "f", "prix": 40, "bonus": 1, "piece": "bureau"},
    "logique":  {"nom": "Analyseur logique", "dom": "f", "prix": 350, "bonus": 1, "debug": 1, "piece": "bureau"},
    "jlink":    {"nom": "Sonde J-Link", "dom": "f", "prix": 950, "bonus": 2, "debug": 1, "piece": "bureau"},
    "ci":       {"nom": "Serveur d'intégration continue", "dom": "f", "prix": 2200, "bonus": 2, "debug": 1, "piece": "bureau"},
    "banc":     {"nom": "Banc de test automatisé", "dom": "f", "prix": 9000, "bonus": 2, "debug": 2, "piece": "bureau"},
    # Labo CEM
    "esd":      {"nom": "Générateur ESD", "dom": "c", "prix": 3500, "bonus": 0, "cem": 0.08, "piece": "cem"},
    "chambre":  {"nom": "Chambre CEM de pré-conformité", "dom": "c", "prix": 22000, "bonus": 0, "cem": 0.25, "piece": "cem"},
}
MATERIEL_DEPART = ["multi", "station", "stlink"]

DECO = {
    "plantes": {"nom": "Plantes vertes", "prix": 180, "moral": 5},
    "tableau": {"nom": "Tableau blanc", "prix": 250, "moral": 3},
    "cafe":    {"nom": "Machine à café", "prix": 600, "moral": 7},
    "clim":    {"nom": "Climatisation", "prix": 2500, "moral": 4, "effet": "Supprime le malus de canicule (juin à août)"},
    "sieges":  {"nom": "Sièges ergonomiques", "prix": 1500, "moral": 3, "prod": 8, "effet": "+8 % de productivité"},
    "eclairage": {"nom": "Éclairage LED", "prix": 800, "moral": 2, "prod": 4, "effet": "+4 % de productivité"},
    "isolation": {"nom": "Isolation phonique", "prix": 3000, "moral": 2, "effet": "Supprime le malus de bruit"},
    "canape":  {"nom": "Coin détente", "prix": 900, "moral": 6, "piece": "openspace"},
    "babyfoot": {"nom": "Baby-foot", "prix": 1200, "moral": 8, "piece": "openspace"},
}

# Locaux : prix d'achat, loyer mensuel ajouté, renommée requise
LOCAUX = {
    "bureau":    {"nom": "Agrandir le bureau d'études", "desc": "4 postes de travail de plus", "prix": 6000, "loyer": 500, "rep": 0},
    "atelier":   {"nom": "Atelier méca / 3D", "desc": "Débloque impression 3D et usinage", "prix": 8000, "loyer": 400, "rep": 0},
    "openspace": {"nom": "Open space", "desc": "4 postes de plus et un coin détente", "prix": 20000, "loyer": 700, "rep": 3},
    "cem":       {"nom": "Labo CEM", "desc": "Tests CEM gratuits et équipements dédiés", "prix": 15000, "loyer": 600, "rep": 4},
}
LOYER_BASE = 400
# Postes de travail : 0-1 garage, 2-5 bureau agrandi, 6-9 open space
POSTES_GARAGE = [0, 1]
POSTES_BUREAU = [2, 3, 4, 5]
POSTES_OPENSPACE = [6, 7, 8, 9]

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
CONTRATS = [
    ("Carte LED pour enseigne", (0.75, 0.0, 0.25), 40, 0),
    ("Interface capteur industriel", (0.7, 0.1, 0.2), 60, 0),
    ("Thermostat connecté", (0.4, 0.3, 0.3), 90, 0),
    ("Boîtier domotique Zigbee", (0.35, 0.35, 0.3), 120, 1),
    ("Chargeur de batterie lithium", (0.6, 0.15, 0.25), 140, 2),
    ("Capteur LoRa agricole", (0.4, 0.2, 0.4), 150, 3),
    ("Contrôleur moteur BLDC", (0.45, 0.1, 0.45), 260, 5),
    ("Tracker GPS pour flotte", (0.4, 0.2, 0.4), 240, 6),
    ("Module radio 2,4 GHz", (0.55, 0.15, 0.3), 380, 9),
    ("Instrument médical portable", (0.4, 0.3, 0.3), 500, 12),
    ("Calculateur pour drone", (0.4, 0.2, 0.4), 650, 16),
]

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
