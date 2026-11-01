"""Catalogues du jeu : matériel, aménagement, locaux, traits, contrats, produits."""

DOMAINES = ("e", "m", "f")
NOM_DOMAINE = {"e": "Élec", "m": "Méca 3D", "f": "Firmware"}

# Deux cartes : le garage du fondateur au départ, puis le bâtiment carré (local « bureau » = déménagement).
# Pièces : intérieur utilisable (coordonnées du monde, en px, calées sur la grille) et local à louer.
# carte "garage" : seulement avant le déménagement ; carte "batiment" : seulement après.
PIECES = {
    "garage":    {"nom": "Garage", "rect": (440, 408, 232, 232), "local": None, "carte": "garage"},
    "etudes":    {"nom": "Bureau d'études", "rect": (48, 496, 156, 156), "local": "bureau", "carte": "batiment"},
    "labo":      {"nom": "Labo élec", "rect": (48, 236, 156, 248), "local": "bureau", "carte": "batiment"},
    "atelier":   {"nom": "Atelier 3D", "rect": (48, 68, 156, 156), "local": "atelier", "carte": "batiment"},
    "plateau":   {"nom": "Plateau R&D", "rect": (216, 68, 248, 156), "local": "plateau", "carte": "batiment"},
    "cem":       {"nom": "Labo CEM", "rect": (476, 68, 156, 156), "local": "cem", "carte": "batiment"},
    "openspace": {"nom": "Open space", "rect": (476, 236, 156, 248), "local": "openspace", "carte": "batiment"},
    "pause":     {"nom": "Salle de pause", "rect": (476, 496, 156, 156), "local": "pause", "carte": "batiment"},
    "cms":       {"nom": "Ligne CMS", "rect": (688, 128, 136, 364), "local": "cms", "carte": "batiment"},
}
# Ordre de placement automatique de la déco : salle de pause et pièces de travail avant le bureau d'études (gardé pour les postes)
INTERIEUR = ["garage", "pause", "openspace", "plateau", "labo", "atelier", "cem", "cms", "etudes"]
TRAVAIL = ["garage", "etudes", "openspace", "plateau"]
# Par carte (les deux cartes partagent les coordonnées) :
# établis fixes : ni bureau ni déco dessus (le petit matériel, lui, peut y être posé)
ETABLIS = {"garage": [(440, 408, 232, 44)], "batiment": [(48, 236, 36, 248)]}
# mobilier fixe : rien ne peut y être posé (étagère du garage ; cuisine, convoyeur et rayonnages du hangar).
# plan.js dessine ces meubles à partir de ces rectangles, dans cet ordre.
OBSTACLES = {"garage": [(636, 468, 32, 112)], "batiment": [(476, 496, 156, 30), (752, 128, 72, 364)]}
GRILLE = 4

# Poste de travail : l'emprise inclut la chaise et la place de l'employé devant le meuble
POSTE = {"nom": "Bureau de travail", "prix": 400, "w": 76, "h": 64, "pieces": TRAVAIL}
POSTES_DEPART = [(452, 468), (540, 560)]

# Matériel : bonus de production (6 % par point), debug (détection des défauts), cem (chance aux tests)
# w, h : taille sur le plan ; pos : emplacement par défaut (achat automatique, anciennes sauvegardes)
_FW = ["garage", "labo", "etudes", "openspace", "plateau"]  # le labo d'abord : outils firmware sur l'établi
MATERIEL = {
    # Labo électronique
    "multi":    {"nom": "Multimètre", "dom": "e", "prix": 150, "bonus": 1, "piece": "labo", "w": 28, "h": 36, "pos": (448, 412)},
    "station":  {"nom": "Station de soudage", "dom": "e", "prix": 300, "bonus": 1, "piece": "labo", "w": 28, "h": 36, "pos": (484, 412)},
    "alim":     {"nom": "Alimentation de labo", "dom": "e", "prix": 450, "bonus": 1, "piece": "labo", "w": 32, "h": 32, "pos": (28, 374)},
    "micro":    {"nom": "Microscope de soudure", "dom": "e", "prix": 1800, "bonus": 1, "debug": 1, "piece": "labo", "w": 32, "h": 36, "pos": (28, 476)},
    "oscillo":  {"nom": "Oscilloscope 4 voies", "dom": "e", "prix": 2800, "bonus": 2, "debug": 1, "piece": "labo", "w": 36, "h": 44, "pos": (26, 420)},
    "sonde":    {"nom": "Sondes champ proche", "dom": "e", "prix": 1200, "bonus": 0, "cem": 0.10, "piece": "labo", "w": 28, "h": 30, "pos": (30, 526)},
    "four":     {"nom": "Four de refusion", "dom": "e", "prix": 6500, "bonus": 3, "piece": "labo", "w": 74, "h": 56, "pos": (110, 284)},
    "spectre":  {"nom": "Analyseur de spectre", "dom": "e", "prix": 14000, "bonus": 2, "cem": 0.10, "piece": "labo", "w": 74, "h": 44, "pos": (110, 372)},
    # Atelier méca / 3D
    "fdm":      {"nom": "Imprimante 3D FDM", "dom": "m", "prix": 650, "bonus": 2, "piece": "atelier", "w": 46, "h": 46, "pos": (214, 274)},
    "resine":   {"nom": "Imprimante résine", "dom": "m", "prix": 2400, "bonus": 2, "piece": "atelier", "w": 38, "h": 42, "pos": (270, 276)},
    "cao":      {"nom": "Poste CAO 3D + licence", "dom": "m", "prix": 3500, "bonus": 3, "piece": "atelier", "w": 84, "h": 32, "pos": (214, 344)},
    "cnc":      {"nom": "Fraiseuse CNC", "dom": "m", "prix": 16000, "bonus": 4, "piece": "atelier", "w": 92, "h": 72, "pos": (216, 430)},
    # Firmware (établi du bureau, ou labo)
    "stlink":   {"nom": "Programmateur ST-Link", "dom": "f", "prix": 40, "bonus": 1, "piece": "etudes", "pieces": _FW, "w": 20, "h": 20, "pos": (520, 420)},
    "logique":  {"nom": "Analyseur logique", "dom": "f", "prix": 350, "bonus": 1, "debug": 1, "piece": "etudes", "pieces": _FW, "w": 34, "h": 20, "pos": (58, 34)},
    "jlink":    {"nom": "Sonde J-Link", "dom": "f", "prix": 950, "bonus": 2, "debug": 1, "piece": "etudes", "pieces": _FW, "w": 28, "h": 20, "pos": (100, 34)},
    "ci":       {"nom": "Serveur d'intégration continue", "dom": "f", "prix": 2200, "bonus": 2, "debug": 1, "piece": "etudes", "pieces": _FW, "w": 40, "h": 24, "pos": (136, 32)},
    "banc":     {"nom": "Banc de test automatisé", "dom": "f", "prix": 9000, "bonus": 2, "debug": 2, "piece": "etudes", "pieces": _FW, "w": 90, "h": 24, "pos": (184, 32)},
    # Labo CEM
    "esd":      {"nom": "Générateur ESD", "dom": "c", "prix": 3500, "bonus": 0, "cem": 0.08, "piece": "cem", "w": 40, "h": 40, "pos": (220, 816)},
    "chambre":  {"nom": "Chambre CEM de pré-conformité", "dom": "c", "prix": 22000, "bonus": 0, "cem": 0.25, "piece": "cem", "w": 104, "h": 104, "pos": (214, 648)},
    # Ligne de production CMS (hangar voisin)
    "pickplace": {"nom": "Machine pick-and-place", "dom": "e", "prix": 30000, "bonus": 3, "piece": "cms", "w": 56, "h": 96, "pos": (688, 136)},
    "rayonx":   {"nom": "Inspection par rayons X", "dom": "e", "prix": 24000, "bonus": 1, "debug": 3, "piece": "cms", "w": 56, "h": 80, "pos": (688, 248)},
    "aoi":      {"nom": "Inspection optique automatique", "dom": "e", "prix": 12000, "bonus": 1, "debug": 1, "cem": 0.05, "piece": "cms", "w": 56, "h": 60, "pos": (688, 344)},
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
    "canape":   {"nom": "Canapé", "prix": 900, "moral": 6, "w": 90, "h": 36, "pieces": ["pause", "openspace"]},
    "babyfoot": {"nom": "Baby-foot", "prix": 1200, "moral": 8, "w": 54, "h": 44, "pieces": ["pause", "openspace"]},
    "arcade":   {"nom": "Borne d'arcade", "prix": 2000, "moral": 6, "w": 30, "h": 30, "pieces": ["pause", "openspace"]},
    "sieges":   {"nom": "Sièges ergonomiques", "prix": 1500, "moral": 3, "prod": 8, "global": True, "effet": "+8 % de productivité"},
    "eclairage": {"nom": "Éclairage LED", "prix": 800, "moral": 2, "prod": 4, "global": True, "effet": "+4 % de productivité"},
    "isolation": {"nom": "Isolation phonique", "prix": 3000, "moral": 2, "global": True, "effet": "Supprime le malus de bruit"},
}
for _d in DECO.values():
    _d.setdefault("pieces", INTERIEUR)

# Locaux : prix d'achat, loyer mensuel ajouté, renommée requise
LOCAUX = {
    "bureau":    {"nom": "Emménager dans le bâtiment", "desc": "Accueil, bureau d'études (4 postes), labo élec, salle de réunion : tout le garage déménage", "prix": 6000, "loyer": 500, "rep": 0},
    "atelier":   {"nom": "Atelier méca / 3D", "desc": "Débloque impression 3D et usinage", "prix": 8000, "loyer": 400, "rep": 0},
    "openspace": {"nom": "Open space", "desc": "Place pour 6 bureaux, coin détente possible", "prix": 20000, "loyer": 700, "rep": 3},
    "pause":     {"nom": "Salle de pause", "desc": "Pauses plus reposantes (fatigue −5 par jour au lieu de −3), moral +5", "prix": 5000, "loyer": 300, "rep": 1},
    "cem":       {"nom": "Labo CEM", "desc": "Tests CEM gratuits et équipements dédiés", "prix": 15000, "loyer": 600, "rep": 4},
    "plateau":   {"nom": "Plateau R&D", "desc": "Place pour 6 bureaux, un projet de plus en parallèle", "prix": 45000, "loyer": 1500, "rep": 7},
    "cms":       {"nom": "Hangar de production CMS", "desc": "Prototypes assemblés en 1 jour, séries +50 %, machines de production", "prix": 80000, "loyer": 2200, "rep": 10},
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
    "batiment_b":      {"nom": "Deuxième bâtiment", "desc": "Ouvrir le plateau R&D"},
    "usine":           {"nom": "On fabrique !", "desc": "Ouvrir la ligne de production CMS"},
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
    ("m_openspace", "Ouvrir l'open space", "local:openspace", 1, 6000, 0),
    ("m_agri", "Livrer 4 contrats Agriculture", "secteur:agri", 4, 7000, 0),
    ("m_serie", "Décrocher une production en série", "series", 1, 6000, 0),
    ("m_suite", "Lancer la suite d'un produit", "suites", 1, 8000, 0),
    ("m_rep8", "Atteindre 8 de renommée", "renommee", 8, 10000, 0),
    ("m_equipe8", "Avoir une équipe de 8 personnes", "employes", 8, 10000, 0),
    ("m_energie", "Livrer 4 contrats Énergie", "secteur:energie", 4, 12000, 0),
    ("m_technos4", "Maîtriser 4 technologies", "technos", 4, 15000, 0),
    ("m_plateau", "Ouvrir le plateau R&D", "local:plateau", 1, 15000, 0),
    ("m_note9", "Obtenir une note de 9 ou plus", "note", 9, 12000, 0),
    ("m_fideles3", "Avoir 3 clients fidèles", "fideles", 3, 15000, 0),
    ("m_mobilite", "Livrer 5 contrats Mobilité", "secteur:mobilite", 5, 18000, 0),
    ("m_livres40", "Livrer 40 contrats", "livres", 40, 25000, 1),
    ("m_produits6", "Lancer 6 produits maison", "produits", 6, 20000, 0),
    ("m_medical", "Livrer 3 contrats Médical", "secteur:medical", 3, 25000, 0),
    ("m_cms", "Ouvrir la ligne de production CMS", "local:cms", 1, 30000, 0),
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
