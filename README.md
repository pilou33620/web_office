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

## Mode démo

Double-cliquer sur `demo.py` (ou `python3 demo.py`) : le jeu s'ouvre dans le navigateur et une partie se joue toute seule, avec une société de 4 personnes déjà installée dans le bâtiment. Un pilote automatique signe les contrats, embauche, lance des produits, commande les lots, achète du matériel. Les jours défilent en 3 secondes, mais un jour sur cinq, chaque vendredi et chaque jour où il se passe quelque chose (livraison, embauche, échec CEM, lot livré, contrat signé, burn-out…) se jouent en vitesse Normal, avec toute la journée de bureau. Le bouton « Démo » de la barre du temps vous rend la main. La démo a ses propres sauvegardes (`sauvegardes/demo`) : vos parties ne sont pas touchées.

## Comment on joue

- **Menu** : un écran titre s'affiche à chaque ouverture (Continuer, Nouvelle partie, Charger, Comment jouer, Trophées et records). En jeu, le bouton ☰ en haut à gauche met en pause et ouvre ce menu. Les 10 meilleurs scores de fin de partie sont gardés dans `sauvegardes/records.json`.
- **Nom de l'entreprise et du directeur** : choisis à la création de la partie (30 caractères au plus), puis définitifs. Ils apparaissent dans la barre du haut, le classement, l'équipe, la liste des sauvegardes et l'écran de fin.
- **Projets** : signez un contrat (un acompte de 30 % est versé), puis lancez le temps. Chaque projet passe par le schéma, le routage PCB et les pièces 3D, la fabrication du prototype (4 jours, 2 avec un four de refusion, payante), puis le firmware et le bring-up, un debug facultatif puis des **tests CEM**, au labo externe, qui peuvent échouer et obliger à corriger le routage.
- **Qualité** : le travail génère des défauts. Le matériel de debug et les « chasseurs de bugs » les éliminent. À la livraison, le client donne une **note sur 10** qui fixe le solde payé et la renommée gagnée. Le retard fait baisser la note.
- **Produits maison** : développez votre propre produit, puis faites-le fabriquer par lots de 50, 200 ou 500 chez un sous-traitant (plus le lot est gros, moins l'unité coûte, mais les invendus restent en stock). Les lots mettent 2 à 5 semaines, peuvent prendre du retard ou arriver défectueux ; le contrôle à réception en repère plus avec un bon qualiticien. La demande dépend de la note et de la renommée et baisse chaque mois ; le stock est limité (200 unités au garage, 1 000 dans le bâtiment, agrandissable) et coûte 0,30 € par unité et par mois.
- **Industrialisation et qualification** : deux étapes optionnelles et payantes choisies à la signature, pour la carte ou pour le produit fini. L'indus (environ 4 % du contrat pour la carte, 7 % pour le produit fini) baisse le coût unitaire, les défauts en série et les retours SAV, et rend les commandes de série plus fréquentes et plus rentables ; sans elle, un gros projet livre plus de défauts. Sur un petit projet, elle coûte plus qu'elle ne rapporte. La qualification (environ 4 ou 6 % du contrat, 4 ou 7 jours d'essais en température et vibrations) donne une meilleure note, moins de pannes, et est obligatoire pour la mobilité, l'aéro, le médical et le spatial. Leur qualité dépend du meilleur spécialiste installé au Bureau indus ou au Labo de qualification.
- **Équipe** : chaque employé a des compétences (Élec, Méca 3D, Firmware), des compétences métier (logiciel, industrialisation, qualification, commercial, gestion), une séniorité (junior à expert), deux ou trois traits (perfectionniste, rapide, leader, pédagogue, négociateur, rigoureux, stressé, solitaire, ambitieux…), une motivation (salaire, ambiance, beaux projets, formation, horaires), un moral et une fatigue. Ils progressent en travaillant ; on peut les former (+2 dans un domaine) ou les envoyer en congés.
- **Recrutement** : le CV ne montre qu'un trait, cache un talent et gonfle parfois la séniorité (on paie ce qu'il annonce). L'entretien (300 €) révèle la vraie séniorité, la motivation et une impression sur un trait caché, juste trois fois sur quatre ; le spécialiste, très cher, révèle tout. Le reste se découvre avec le temps.
- **Vie des employés** : affinités et conflits entre collègues (découverts en travaillant ensemble ; un chef apaise les conflits), ancienneté (+2 % par an, jusqu'à +10 %, et plus de fidélité face au débauchage), burn-out après une fatigue trop longue, maladies, naissances, entretiens annuels (promotion de séniorité, augmentation, formation).
- **Conditions de travail** : sièges ergonomiques, éclairage, pauses café, climatisation l'été, isolation phonique quand l'équipe grandit… La vue *Productivité* affiche le multiplicateur obtenu.
- **Matériel** : multimètre, oscilloscope, four de refusion, analyseur de spectre, imprimantes 3D, CNC, sondes J-Link, banc de test… Chaque appareil apparaît sur le plan.
- **Locaux** : on démarre dans le garage de la maison, puis on emménage dans un **bâtiment de bureaux** (pièces, cloisons et portes) : 3 étages (RDC, R1, R2) reliés par l'escalier central, choisis avec les onglets à gauche du plan (le petit chiffre indique combien de personnes s'y trouvent). Tout le bâtiment est ouvert dès l'emménagement (8 000 €, loyer 900 € par mois) ; on grandit ensuite en embauchant. Il apporte une place de projet et un appel d'offres de plus, des réparations SAV à moitié prix, une réunion de lancement (chaque phase démarre à 5 %), des bulles téléphone contre le bruit et la salle de pause du R2 (moral +5, meilleure récupération) :
  - **RDC** : accueil, supply chain, SAV, stock, contrôle réception des lots, ligne pilote, atelier méca / 3D, étuves, salle Atlas ;
  - **R1** : bureaux HW, Firmware 1, Firmware 2 et Méca (+5 % pour les gens du service installés chez eux), laboratoire, chefs de projet (un chef installé là est 50 % plus efficace), DT, bureau indus, labo de qualification, bureaux de responsables, direction R&D, bulles téléphone, coin café, salle Orion ; l'atelier étant petit, les machines méca peuvent aussi aller dans le bureau Méca ;
  - **R2** : salle de pause (canapé, baby-foot, arcade), bureau des commerciaux, salles Véga et Lyra, bulle, bureau de responsable, direction générale (votre bureau ici : négociation +10 points, levée de fonds +30 %), terrasse accessible.
  - Les tests CEM partent toujours au labo externe (payants, 3 jours).
- **Responsables de service** : au-delà de 4 personnes, un service (Élec, Méca, Firmware) sans responsable perd 4 % d'efficacité par personne. Un responsable (8 dans son domaine, installé seul dans un bureau de responsable), promu ou embauché comme « Chef d'équipe », donne +8 % et moral +5 à tout son service ; ses membres progressent 25 % plus vite, font 10 % de défauts en moins et ne perdent pas de temps en coordination quand ils sont nombreux sur un projet.
- **Chefs de projet** : chacun suit plusieurs projets, mais son effet baisse avec le nombre de projets suivis. Il ajoute une place de projet (4 au plus), compose lui-même l'équipe de ses projets (le meilleur spécialiste libre de chaque domaine qui reste à faire), apporte de la production, de la note, une prime du client (8 % du contrat) quand le projet est livré à l'heure et bien noté, moins de pénalité de retard, moins de défauts, 15 % de moins sur l'indus et la qualif, deux fois moins de retards de lots, et il limite les pertes de coordination entre les équipes.
- **Commerciaux** : bouton « Négocier » sur les appels d'offres (+15 % payé ou +25 % de délai, mais le client peut partir), prospection du secteur choisi, une offre de plus et des offres 2 % mieux payées par commercial (3 au plus), en plus du bonus de la compétence commerciale (+1,5 % par point) ; salaire plus faible et commission de 6 % des contrats signés pour chacun.
- **Direction R&D** : le directeur R&D (20 points de compétences) rend les recherches deux fois plus rapides et 25 % moins chères et ajoute 0,2 à la note des projets ; le chargé d'innovation (12 points) débloque deux produits maison exclusifs, améliore leur note et propose des idées à breveter (licences pendant 3 ans, 3 brevets au plus).
- **Plan** : vue isométrique façon Game Dev Story (murs du fond avec fenêtres et décoration, façade basse pour voir dedans), appareils à taille réelle, lumière du jour et éclairage du soir, personnages, rue animée (voitures, bus, passants) et nuages qui passent aux étages. Pendant que le temps tourne, les employés font de petites escapades : un café, une question à un collègue, un essai au labo. Aux vitesses Lent et Normal, chaque jour est une vraie journée de bureau (l'heure s'affiche à côté de la date) : réunion du matin d'un service à tour de rôle (HW, soft ou méca) dans la salle de son étage, cafés en petits groupes vers 10 h 30 et 15 h 45, et à midi presque tout le monde passe par l'escalier pour déjeuner à la salle de pause du R2 (au garage, dans le jardin), quelques-uns restant au bureau avec un sandwich. Le matin, chacun arrive à son heure par la porte ou l'escalier ; le soir, ils repartent (avec les heures sup, certains restent tard, lampes allumées) et le vendredi, ceux qui restent font une course de fauteuils dans le couloir.
- **Animations** : gestes de métier (étincelles au fer à souder, oscillo, imprimante 3D, four, code qui défile sur les écrans), carton à l'arrivée d'une recrue et au départ d'un employé, pot avec confettis, fumée et consternation après un échec CEM, burn-out affalé à son bureau, camion du sous-traitant à chaque lot livré, coursier du prototype, client en visite reçu en salle de réunion, oiseaux et chat, lumière qui suit l'heure, saisons visibles (herbe, arbres, feuilles qui tombent, neige), et le montant qui s'envole au-dessus de la trésorerie à chaque encaissement. Dans le bâtiment, un étage est affiché à la fois ; les employés changent d'étage selon leur travail. Bureaux rangés sur une grille et cantine disposée automatiquement. Sur téléphone, on fait glisser le plan au doigt et on zoome en pinçant ; les boutons + / − / ⌖ zooment et recentrent.
- **Aménagement libre** : les bureaux s'achètent à l'unité (un par employé) et se placent où l'on veut, sur une grille aimantée, comme le matériel et une vingtaine d'objets (plantes, ficus, fontaine, distributeur, bibliothèque de datasheets, armoire à composants, table de réunion, aquarium, tapis, affiches, borne d'arcade…). Le mode aménagement (bouton en haut à gauche) permet de déplacer ou revendre (à moitié prix) n'importe quel objet.
- **Projets en parallèle** : 1 projet au garage, 2 après l'emménagement, puis un de plus par chef de projet (6 au total). Chaque employé peut être affecté à un projet ou laissé en automatique (il va là où il est le plus utile).
- **Combos d'équipe** : équipe complète (un spécialiste par domaine), duo qualité (perfectionniste + chasseur de bugs), mentorat (expert + junior), équipe soudée.
- **Horaires** : de 6 h à 12 h par jour. Plus d'heures = plus de production, mais moral en baisse, fatigue, défauts et heures sup à payer.
- **Évènements** : pénuries de composants, salons pros, clients pressés, pannes, subventions, menaces de démission, ras-le-bol face aux horaires.
- **Bilans annuels** avec impôt sur le bénéfice (15, 25 ou 33 % selon la difficulté), **24 trophées** et une **fin de partie au bout de 20 ans** avec score et titre. Les clients deviennent plus exigeants à mesure que la renommée grandit : notes attendues plus hautes, contrats plus gros et délais plus courts (au-delà de 3 de renommée, un client attend jusqu'à 3,4 fois plus vite ; de quoi mener plusieurs projets de front sans traîner), et les frais de structure augmentent avec l'effectif.

- **Choix techniques à la signature** : nombre de couches du PCB, microcontrôleur, boîtier, alimentation, grade des composants, relecture DFM, industrialisation et qualification. Chaque choix modifie les points à produire, le coût du proto, les défauts, les chances aux tests CEM et la note. Les options avancées (8 et 12 couches, FPGA, 4G, MCU sécurisé, boîtier blindé ou IP67, USB-C PD, puissance isolée, composants auto, aéro ou spatiaux) se débloquent avec une techno ou une certification.
- **Prestataires** : firmware, méca, indus et qualif se font en interne ou chez un prestataire payé à la signature (freelance ou labo low-cost : qualité variable ; bureau d'études ou labo accrédité : cher et sûr), qui avance sans occuper l'équipe. En interne, l'indus et la qualif coûtent trois fois moins cher mais sont moins efficaces sans spécialiste, et des essais de qualif ratés sont à refaire.
- **Négociation et concurrence** : au prix et au délai affichés, le client signe ; demander plus est un pari. Trois bureaux concurrents remportent aussi des appels d'offres et figurent au classement (onglet Société).
- **Recherche et technologies** (BLE, radiofréquence, puissance, contrôle moteur, conception pour la fabrication, IA embarquée) et **certifications** (CE, ISO 9001, ISO 13485 médical, EN 9100 aéro) : elles débloquent de nouveaux contrats mieux payés et donnent des bonus.
- **SAV et garanties** : un projet livré avec des défauts peut revenir pendant 120 jours. **Production en série** : un client satisfait peut commander une série qui rapporte chaque mois.
- **Fournisseurs de composants** (européen, asiatique, local premium), **prêts bancaires** sur 24 mois et **levée de fonds**.
- **Investissements de fin de partie** (onglet Société, dès 8 ou 10 de renommée, dans le bâtiment) : campagne de communication nationale (renommée +2, une par an, de plus en plus chère), centre de formation interne (tout le monde progresse 25 % plus vite, formations à moitié prix), filiale à Toulouse (une place de projet et deux appels d'offres de plus, loyer +5 000 € par mois), rachat d'un concurrent (il disparaît du marché, renommée +3, deux rachats au plus, prix selon sa renommée).
- **Gros contrats** : au-delà de 150 points, le client négocie le prix du point (un contrat de 750 points se paie la moitié du prix du point d'un petit).
- **Carrières** : promotion en chef de projet (+6 % de production sur les projets qu'il suit, +1 % par point de gestion ; dès 10 points de compétences pour un leader), tentatives de débauchage par la concurrence, stagiaires d'école gratuits pendant 3 mois. **Vie d'équipe** : anniversaires, pots de livraison, séminaires.
- **Météo et saisons** sur le plan (pluie, neige, orage, brouillard, canicule), ambiance du soir et de nuit quand les horaires s'allongent.
- **Secteurs et clients fidèles** : 54 types de contrats dans 10 secteurs (industrie, maison connectée, énergie, agriculture, mobilité, grand public, médical, aéro, télécoms, spatial). Un client bien servi devient fidèle (★ à ★★★★★ « Partenaire ») et revient avec des projets plus gros, plus faciles à négocier.
- **Méga-projets** : dès 10 de renommée, de rares projets géants (usine 4.0, métro automatique, constellation de satellites…) qui occupent deux places, demandent une grande équipe et plusieurs technologies, et paient 25 % de plus.
- **24 produits maison** dont 8 suites (v2, v3) : une suite se vend d'autant mieux que le modèle précédent a été bien noté.
- **12 technologies et 7 certifications** au total. Les parties d'avant le bâtiment actuel ne sont pas reprises : il faut commencer une nouvelle partie.
- **40 missions** enchaînées, trois proposées à la fois sur le tableau de bord, avec une prime et parfois de la renommée.
- **Temps** : barre de 5 boutons, Pause, Lent (24 s par jour), Normal (18 s), Rapide (4,5 s) et Très rapide (1,5 s). La météo dure plusieurs jours.
- **Scénarios** (Le garage, Startup IoT, Sous-traitant aéro, Reprise d'entreprise), **3 niveaux de difficulté** et **3 emplacements de sauvegarde** (Journal › Parties et sauvegardes).

Sur le plan, les employés se déplacent : ils vont au labo pour le routage et le bring-up, à l'atelier pour la 3D, et se retrouvent en salle de réunion pour les réunions de phase. Ils vont aussi demander de l'aide au collègue le plus fort de leur domaine, et progressent grâce à lui. Leurs pauses se passent à la **salle de pause** du R2, avec canapé et baby-foot (au garage : dans le jardin, ou au bureau quand il pleut). Ils contournent les murs et passent par les portes.

Sous −5 000 € de trésorerie, c'est la faillite.

## Structure

```
moteur/donnees.py   catalogues (matériel, déco, locaux, traits, métiers, séniorités, contrats, produits)
moteur/personnel.py séniorité, traits, motivations, affinités, burn-out, entretiens, recrutement
moteur/jeu.py       simulation jour par jour et actions du joueur
moteur/extensions.py  R&D, certifications, SAV, séries, finances, carrières, météo, scénarios
serveur.py          serveur HTTP + API JSON
web/                interface (index.html, style.css, jeu.js ; plan.js dessine le plan isométrique, les objets et les personnages)
tests/              tests unitaires du moteur, banc du serveur
appairage.py        sécurité réseau, copie identique de web_suite/lanceur/appairage.py
```

API : `GET /api/etat`, `GET /api/catalogue`, `GET /api/parties`, `POST /api/action {"genre": "...", ...}`, `POST /api/nouvelle {emplacement, scenario, difficulte, entreprise, directeur}`, `POST /api/charger {emplacement}`. Les POST exigent l'en-tête `X-WEB_OFFICE: 1`.

## Tests

```bash
python3 -m unittest -q          # moteur
python3 tests/banc-serveur.py   # serveur : fichiers servis, Host, en-tête, tailles
node tests/test_trajets.js      # trajets : les personnages passent par les portes
python3 appairage.py            # code, jeton, cookie
```
