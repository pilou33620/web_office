#!/usr/bin/python3
"""Circuit Story en mode démo : double-cliquez sur ce fichier pour regarder une partie se jouer toute seule.

Le jeu s'ouvre dans le navigateur avec une société de 4 personnes déjà installée dans le bâtiment. Un pilote
automatique signe les contrats, embauche, lance des produits… Les jours défilent vite (3 s), mais un jour sur
cinq, et chaque jour où il se passe quelque chose (livraison, embauche, échec CEM, camion, course du vendredi),
se joue lentement pour voir la vie du bureau. Le bouton « Démo » en bas de l'écran vous rend la main.

Vos parties ne sont pas touchées : la démo a ses propres sauvegardes (sauvegardes/demo).
Ctrl+C (ou fermer la fenêtre) pour arrêter.
"""
import os
import sys

os.environ["CIRCUIT_STORY_DEMO"] = "1"  # avant d'importer le serveur : il choisit ses sauvegardes à l'import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.argv = [sys.argv[0], "--local", "--sans-maj", "--port", "8795"] + sys.argv[1:]

import serveur  # noqa: E402

raise SystemExit(serveur.main())
