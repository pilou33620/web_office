# Circuit Story — web_office

Jeu de gestion façon *Game Dev Story* : vous dirigez un bureau d'études qui conçoit des cartes électroniques, des pièces 3D et des firmwares. On commence seul dans un garage, puis on embauche, on s'équipe et on agrandit les locaux.

Moteur en Python (bibliothèque standard uniquement), interface web cartoon en vue du dessus, jouable sur téléphone et sur tablette.

## Lancer le jeu

```bash
python3 serveur.py            # http://127.0.0.1:8793 et réseau local avec code d'appairage
python3 serveur.py --local    # ce poste seulement, sans code
```

Options : `--port N` (8793 par défaut ; le premier port libre au-delà si pris), `--local`, `--sans-navigateur`, `--sans-pause`, `--sans-maj` (pas de vérification GitHub au démarrage). Sans `--sans-maj`, le jeu fait un `git pull --ff-only` au démarrage s'il y a du nouveau, puis redémarre.

Le jeu figure aussi dans **web_launcher** (port 8793) ; c'est alors le launcher qui le met à jour.

### Utiliser depuis un autre appareil

Ouvrir l'adresse « réseau » affichée dans le terminal (IP du poste, en HTTPS). La première fois, l'appareil demande le **code d'appairage** à 6 chiffres affiché dans le terminal (ou sur la carte du launcher) ; il est ensuite reconnu par tous les web tools du poste. Pour éviter l'alerte de certificat, installer la CA du poste depuis `/appairage/ca.pem` (instructions dans le terminal). Une IP publique est toujours refusée : à distance, passer par Tailscale.

Aucune dépendance à installer : fonctionne sur Raspberry Pi et dans Termux. La partie est sauvegardée automatiquement dans `sauvegardes/partie_N.json` (3 emplacements).

## Comment on joue

- **Menu** : un écran titre s'affiche à chaque ouverture (Continuer, Nouvelle partie, Charger, Comment jouer, Trophées et records). En jeu, le bouton ☰ en haut à gauche met en pause et ouvre ce menu. Les 10 meilleurs scores de fin de partie sont gardés dans `sauvegardes/records.json`.
- **Nom de l'entreprise et du directeur** : choisis à la création de la partie (30 caractères au plus), puis définitifs. Ils apparaissent dans la barre du haut, le classement, l'équipe, la liste des sauvegardes et l'écran de fin.
- **Projets** : signez un contrat (un acompte de 30 % est versé), puis lancez le temps. Chaque projet passe par le schéma, le routage PCB et les pièces 3D, la fabrication du prototype (4 jours, 2 avec un four de refusion, payante), puis le firmware et le bring-up, un debug facultatif puis des **tests CEM** qui peuvent échouer et obliger à corriger le routage.
- **Qualité** : le travail génère des défauts. Le matériel de debug et les « chasseurs de bugs » les éliminent. À la livraison, le client donne une **note sur 10** qui fixe le solde payé et la renommée gagnée. Le retard fait baisser la note.
- **Produits maison** : développez votre propre produit, il se vend ensuite chaque mois selon sa note et votre renommée.
- **Équipe** : chaque employé a des compétences (Élec, Méca 3D, Firmware), un trait (perfectionniste, rapide, créatif, sociable, râleur, chasseur de bugs, endurant), un moral et une fatigue. Ils progressent en travaillant ; on peut les former (+2 dans un domaine) ou les envoyer en congés.
- **Conditions de travail** : sièges ergonomiques, éclairage, pauses café, climatisation l'été, isolation phonique quand l'équipe grandit… La vue *Productivité* affiche le multiplicateur obtenu.
- **Matériel** : multimètre, oscilloscope, four de refusion, analyseur de spectre, imprimantes 3D, CNC, sondes J-Link, banc de test, chambre CEM… Chaque appareil apparaît sur le plan.
- **Locaux** : on démarre dans le garage de la maison, puis on emménage dans un bâtiment carré (accueil, bureau d'études, labo élec, salle de réunion, sanitaires, serveurs, couloir en anneau). On y loue ensuite l'atelier 3D, la salle de pause et sa terrasse, l'open space, le labo CEM, le plateau R&D, puis le hangar de production voisin. Loyer mensuel en conséquence.
- **Plan** : vue de dessus détaillée (lumière du jour, éclairage le soir, personnages, rue animée). Sur téléphone, on fait glisser le plan au doigt et on zoome en pinçant ; les boutons + / − / ⌖ zooment et recentrent.
- **Aménagement libre** : les bureaux s'achètent à l'unité (un par employé) et se placent où l'on veut, sur une grille aimantée, comme le matériel et une vingtaine d'objets (plantes, ficus, fontaine, distributeur, bibliothèque de datasheets, armoire à composants, table de réunion, aquarium, tapis, affiches, borne d'arcade…). Le mode aménagement (bouton en haut à gauche) permet de déplacer ou revendre (à moitié prix) n'importe quel objet.
- **Projets en parallèle** : 1 projet au garage, 2 après l'emménagement, 3 avec l'open space, 4 avec le plateau R&D. Chaque employé peut être affecté à un projet ou laissé en automatique (il va là où il est le plus utile).
- **Combos d'équipe** : équipe complète (un spécialiste par domaine), duo qualité (perfectionniste + chasseur de bugs), mentorat (expert + junior), équipe soudée.
- **Horaires** : de 6 h à 12 h par jour. Plus d'heures = plus de production, mais moral en baisse, fatigue, défauts et heures sup à payer.
- **Évènements** : pénuries de composants, salons pros, clients pressés, pannes, subventions, menaces de démission, ras-le-bol face aux horaires.
- **Bilans annuels** avec impôt sur le bénéfice (15, 25 ou 33 % selon la difficulté), **24 trophées** et une **fin de partie au bout de 20 ans** avec score et titre. Les clients deviennent plus exigeants à mesure que la renommée grandit, et les frais de structure augmentent avec l'effectif.

- **Choix techniques à la signature** : nombre de couches du PCB, microcontrôleur (STM32, ESP32, nRF52), type de boîtier (impression 3D, usiné, moule d'injection). Chaque choix modifie les points à produire, le coût du proto, les chances aux tests CEM et la note.
- **Négociation et concurrence** : au prix et au délai affichés, le client signe ; demander plus est un pari. Trois bureaux concurrents remportent aussi des appels d'offres et figurent au classement (onglet Société).
- **Recherche et technologies** (BLE, radiofréquence, puissance, contrôle moteur, conception pour la fabrication, IA embarquée) et **certifications** (CE, ISO 9001, ISO 13485 médical, EN 9100 aéro) : elles débloquent de nouveaux contrats mieux payés et donnent des bonus.
- **SAV et garanties** : un projet livré avec des défauts peut revenir pendant 120 jours. **Production en série** : un client satisfait peut commander une série qui rapporte chaque mois.
- **Fournisseurs de composants** (européen, asiatique, local premium), **prêts bancaires** sur 24 mois et **levée de fonds**.
- **Carrières** : promotion en chef de projet (+8 % de production pour son équipe), tentatives de débauchage par la concurrence, stagiaires d'école gratuits pendant 3 mois. **Vie d'équipe** : anniversaires, pots de livraison, séminaires.
- **Météo et saisons** sur le plan (pluie, neige, orage, brouillard, canicule), ambiance du soir et de nuit quand les horaires s'allongent.
- **Secteurs et clients fidèles** : 54 types de contrats dans 10 secteurs (industrie, maison connectée, énergie, agriculture, mobilité, grand public, médical, aéro, télécoms, spatial). Un client bien servi devient fidèle (★ à ★★★★★ « Partenaire ») et revient avec des projets plus gros, plus faciles à négocier.
- **Méga-projets** : dès 10 de renommée, de rares projets géants (usine 4.0, métro automatique, constellation de satellites…) qui occupent deux places, demandent une grande équipe et plusieurs technologies, et paient 25 % de plus.
- **22 produits maison** dont 7 suites (v2, v3) : une suite se vend d'autant mieux que le modèle précédent a été bien noté.
- **Bâtiment B** : plateau R&D (8 bureaux, un projet de plus) et ligne de production CMS (prototypes en 1 jour, séries +50 %, machines de production). 12 technologies et 7 certifications au total.
- **40 missions** enchaînées, trois proposées à la fois sur le tableau de bord, avec une prime et parfois de la renommée.
- **Temps** : barre de 5 boutons, Pause, Lent (16 s par jour), Normal (8 s), Rapide (3 s) et Très rapide (1 s). La météo dure plusieurs jours.
- **Scénarios** (Le garage, Startup IoT, Sous-traitant aéro, Reprise d'entreprise), **3 niveaux de difficulté** et **3 emplacements de sauvegarde** (Journal › Parties et sauvegardes).

Sur le plan, les employés se déplacent : ils vont au labo pour le routage et le bring-up, à l'atelier pour la 3D, au labo CEM pendant les tests, et se retrouvent sur la terrasse pour les réunions de phase. Ils vont aussi demander de l'aide au collègue le plus fort de leur domaine, et progressent grâce à lui. Leurs pauses se passent sur la terrasse, ou dans la **salle de pause** une fois louée (moral +5, meilleure récupération), avec canapé et baby-foot.

Sous −5 000 € de trésorerie, c'est la faillite.

## Structure

```
moteur/donnees.py   catalogues (matériel, déco, locaux, traits, contrats, produits)
moteur/jeu.py       simulation jour par jour et actions du joueur
moteur/extensions.py  R&D, certifications, SAV, séries, finances, carrières, météo, scénarios
serveur.py          serveur HTTP + API JSON
web/                interface (index.html, style.css, jeu.js ; plan.js dessine le plan, les objets et les personnages)
tests/              tests unitaires du moteur, banc du serveur
appairage.py        sécurité réseau, copie identique de web_suite/lanceur/appairage.py
```

API : `GET /api/etat`, `GET /api/catalogue`, `GET /api/parties`, `POST /api/action {"genre": "...", ...}`, `POST /api/nouvelle {emplacement, scenario, difficulte, entreprise, directeur}`, `POST /api/charger {emplacement}`. Les POST exigent l'en-tête `X-WEB_OFFICE: 1`.

## Tests

```bash
python3 -m unittest -q          # moteur
python3 tests/banc-serveur.py   # serveur : fichiers servis, Host, en-tête, tailles
python3 appairage.py            # code, jeton, cookie
```
