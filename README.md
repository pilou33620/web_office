# Circuit Story — web_office

Jeu de gestion façon *Game Dev Story* : vous dirigez un bureau d'études qui conçoit des cartes électroniques, des pièces 3D et des firmwares. On commence seul dans un garage, puis on embauche, on s'équipe et on agrandit les locaux.

Moteur en Python (bibliothèque standard uniquement), interface web cartoon en vue du dessus, jouable sur téléphone et sur tablette.

## Lancer le jeu

```bash
python3 serveur.py            # http://localhost:8095
python3 serveur.py --port 8080 --hote 0.0.0.0
```

Aucune dépendance à installer : fonctionne sur Raspberry Pi et dans Termux. La partie est sauvegardée automatiquement dans `sauvegardes/partie.json`.

## Comment on joue

- **Projets** : signez un contrat (un acompte de 30 % est versé), puis lancez le temps. Chaque projet passe par trois phases (schéma, routage PCB et pièces 3D, firmware et bring-up), un debug facultatif puis des **tests CEM** qui peuvent échouer et obliger à corriger le routage.
- **Qualité** : le travail génère des défauts. Le matériel de debug et les « chasseurs de bugs » les éliminent. À la livraison, le client donne une **note sur 10** qui fixe le solde payé et la renommée gagnée. Le retard fait baisser la note.
- **Produits maison** : développez votre propre produit, il se vend ensuite chaque mois selon sa note et votre renommée.
- **Équipe** : chaque employé a des compétences (Élec, Méca 3D, Firmware), un trait (perfectionniste, rapide, créatif, sociable, râleur, chasseur de bugs, endurant), un moral et une fatigue. Ils progressent en travaillant ; on peut les former (+2 dans un domaine) ou les envoyer en congés.
- **Conditions de travail** : sièges ergonomiques, éclairage, pauses café, climatisation l'été, isolation phonique quand l'équipe grandit… La vue *Productivité* affiche le multiplicateur obtenu.
- **Matériel** : multimètre, oscilloscope, four de refusion, analyseur de spectre, imprimantes 3D, CNC, sondes J-Link, banc de test, chambre CEM… Chaque appareil apparaît sur le plan.
- **Locaux** : garage (2 postes) → bureau agrandi (6) → open space (10), atelier méca / 3D, labo CEM. Loyer mensuel en conséquence.
- **Projets en parallèle** : 1 projet au garage, 2 avec le bureau agrandi, 3 avec l'open space. Chaque employé peut être affecté à un projet ou laissé en automatique (il va là où il est le plus utile).
- **Combos d'équipe** : équipe complète (un spécialiste par domaine), duo qualité (perfectionniste + chasseur de bugs), mentorat (expert + junior), équipe soudée.
- **Horaires** : de 6 h à 12 h par jour. Plus d'heures = plus de production, mais moral en baisse, fatigue, défauts et heures sup à payer.
- **Évènements** : pénuries de composants, salons pros, clients pressés, pannes, subventions, menaces de démission, ras-le-bol face aux horaires.
- **Bilans annuels** avec impôt de 25 % sur le bénéfice, **16 trophées** et une **fin de partie au bout de 20 ans** avec score et titre. Les clients deviennent plus exigeants à mesure que la renommée grandit, et les frais de structure augmentent avec l'effectif.

Sur le plan, les employés se déplacent : ils vont au labo pour le routage et le bring-up, à l'atelier pour la 3D, au labo CEM pendant les tests, et se retrouvent sur la terrasse pour les réunions de phase. Ils vont aussi demander de l'aide au collègue le plus fort de leur domaine. Leurs pauses se passent sur la terrasse, ou dans la **salle de pause** une fois louée (moral +5, meilleure récupération), avec canapé et baby-foot.

Sous −5 000 € de trésorerie, c'est la faillite.

## Structure

```
moteur/donnees.py   catalogues (matériel, déco, locaux, traits, contrats, produits)
moteur/jeu.py       simulation jour par jour et actions du joueur
serveur.py          serveur HTTP + API JSON
web/                interface (index.html, style.css, jeu.js)
tests/              tests unitaires du moteur
```

API : `GET /api/etat`, `GET /api/catalogue`, `POST /api/action {"genre": "...", ...}`, `POST /api/nouvelle`.

## Tests

```bash
python3 -m unittest -q
```
