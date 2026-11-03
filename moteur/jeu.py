"""Moteur de Circuit Story : simulation jour par jour d'un bureau d'études électronique."""
import math
import random

from .extensions import ErreurJeu, Extensions, borne, requis_liste
from .personnel import Personnel
from .commerce import Commerce

from .donnees import (CHEVEUX, COMBOS, CONTRATS, COULEURS, DECO, DOMAINES, DUREE_PARTIE_ANS,
                      EMPLACEMENTS, ETABLIS, GRILLE, HORAIRES, OBSTACLES, LOCAUX, LOYER_BASE, MATERIEL, MATERIEL_DEPART, MOIS, NOM_DOMAINE, PEAUX,
                      PHASES, PIECES, POSTE, POSTES, PRENOMS, PRODUITS, TITRES_FIN, TRAITS, TROPHEES, FIDELITE_MAX, MISSIONS,
                      DIFFICULTES, FOURNISSEURS, PRIX_PROPOSES, DELAIS_PROPOSES, SECTEURS, TECHNOS,
                      JOURS_AN, SALAIRE_BASE, HAUSSE_POINT, SENIORITES, KICKOFF, ROLES, SERVICE_SANS_RESP,
                      CHOIX_TECH, COMMISSION, EXIGEANTS, PRESTATAIRES, INVESTISSEMENTS, PRIME_CHEF, PRIME_COMMERCIAL, STOCK_BATIMENT, STOCK_GARAGE)

JOURS_MOIS = 30
SEUIL_FAILLITE = -5000
NB_OFFRES = 3
PAIE_REP = 0.01  # prix du point : +1 % par point de renommée (20 au plus)
PRIX_GROS = (150, 600)  # au-delà de 150 points, le client négocie le prix du point : ÷ (1 + (taille − 150) / 600)
ATTENTE_REP = (10, 3)  # note attendue : 6 + renommée / 10, +3 au plus
TAILLE_REP = (0.05, 12)  # les contrats grossissent avec la renommée : +5 % par point au-dessus du minimum, 12 points au plus
DELAI_BASE, DELAI_REP = 14, (0.3, 3, 8)  # délai client = (base + jours par point) / (1 + 0,3 × renommée au-delà de 3, 8 points au plus) : une société connue doit livrer vite
NB_CANDIDATS = 4
DUREE_CEM = 3
DUREE_FORMATION = 10
DUREE_CONGES = 5
BANDE_ETIQUETTE = 24  # px en bas de chaque pièce, laissés libres pour son nom (rangement automatique)
VERSION_PLAN = 9      # à augmenter quand le plan ou le rangement change : les parties sont rangées à nouveau
PLAN_MINIMUM = 7      # plan avec cloisons et portes : les parties plus anciennes ne sont pas reprises
POSTE_W, POSTE_H = 76, 64
VENTES = 0.25  # ventes du 1er mois d'un produit = VENTES × potentiel × (note/10)² × (1 + renommée/25), puis −10 % par mois
NOM_MAX = 30


def entier(v):
    return isinstance(v, int) and not isinstance(v, bool)


def nom_propre(v, defaut):
    """Nom saisi par le joueur : espaces resserrés, défaut si vide, refusé si trop long ou avec caractères de contrôle."""
    if v is None:
        return defaut
    if not isinstance(v, str) or any(ord(c) < 32 or ord(c) == 127 for c in v):
        raise ErreurJeu("Nom invalide.")
    v = " ".join(v.split())
    if len(v) > NOM_MAX:
        raise ErreurJeu(f"Nom trop long ({NOM_MAX} caractères au plus).")
    return v or defaut


class Jeu(Personnel, Extensions, Commerce):
    def __init__(self, etat=None, graine=None, scenario="garage", difficulte="normal", entreprise=None, directeur=None):
        self.rng = random.Random(graine)
        self._roles = None  # cache des rôles et services, recalculé à chaque jour et à chaque action
        if etat is None:
            self.etat = {}
            self._nouvel_etat(nom_propre(entreprise, "Mon bureau d'études"), nom_propre(directeur, "Vous"))
            self._init_extensions(scenario, difficulte)
            self._appliquer_scenario()
        else:
            self.etat = etat
            self._migrer()
            self._init_extensions()

    # ------------------------------------------------------------------ création
    def _nouvel_etat(self, entreprise, directeur):
        self.etat.update({
            "version": 3, "entreprise": entreprise, "jour": 1, "mois": 8, "annee": 2026, "jours_total": 0,
            "argent": 15000, "renommee": 0, "prochain_id": 1, "heures": 8,
            "locaux": [], "materiel": list(MATERIEL_DEPART), "deco": [], "pannes": {},
            "employes": [], "candidats": [], "offres": [], "projets": [], "produits": [],
            "evenement": None, "journal": [], "historique": [], "faillite": False,
            "stats": {"livres": 0, "ca": 0, "produits_lances": 0},
            "trophees": [], "bilans": [], "combos_vus": [], "objets": [], "version_plan": VERSION_PLAN,
        })
        self.etat["exercice"] = self._exercice_vide()
        for mid in MATERIEL_DEPART:  # sur l'établi du garage
            self._ajouter_objet(mid, *self._place_auto(mid))
        bureaux = [self._ajouter_objet("poste", *self._place_auto("poste"))["id"] for _ in range(2)]
        self.etat["employes"].append({
            "id": self._id(), "nom": directeur, "poste": "Fondateur · ingé élec", "e": 5, "m": 2, "f": 4,
            "trait": "endurant", "salaire": 0, "couleur": "#ffc94d", "cheveux": "#5a3a22", "peau": "#f6cfa6",
            "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 3, "absent": 0, "formation": None,
            "bureau": bureaux[0], "fondateur": True, "tache": None, "gain": 0, "projet": None,
        })
        self._completer_personnel(self.etat["employes"][0])
        for _ in range(NB_CANDIDATS):
            self.etat["candidats"].append(self._candidat())
        for _ in range(NB_OFFRES):
            self.etat["offres"].append(self._offre())
        self._log(f"{entreprise} ouvre ses portes ! Vous êtes seul dans votre garage : signez un premier contrat dans Projets.", "info")

    def _migrer(self):
        """Complète une sauvegarde récente ; les parties d'avant le plan avec cloisons et portes ne sont pas reprises."""
        e = self.etat
        if e.get("version_plan", 0) < PLAN_MINIMUM:
            raise ErreurJeu("Partie d'avant le nouveau plan du bâtiment : elle n'est pas reprise, commencez une nouvelle partie.")
        if "projets" not in e:
            p = e.pop("projet", None)
            e["projets"] = []
            if p:
                p["id"] = self._id()
                e["projets"].append(p)
        for cle, val in (("heures", 8), ("trophees", []), ("bilans", []), ("combos_vus", []), ("entreprise", "Votre bureau")):
            e.setdefault(cle, val)
        e.setdefault("exercice", self._exercice_vide())
        for p in e["projets"]:
            for cle, val in (("combos", {}), ("combos_jour", []), ("equipe", [])):
                p.setdefault(cle, val)
        for x in e["employes"]:
            x.setdefault("projet", None)
        if e.get("version_plan") != VERSION_PLAN:  # nouveau rangement : tout est replacé automatiquement
            self._replacer_objets()
            e["version_plan"] = VERSION_PLAN
        e["version"] = 3

    def _exercice_vide(self):
        return {"ca": 0, "charges": 0, "livres": 0, "notes": [], "rep0": self.etat.get("renommee", 0)}

    def _id(self):
        self.etat["prochain_id"] += 1
        return self.etat["prochain_id"] - 1

    def _offre(self, bonus_rep=0, secteur=None):
        rep = self.etat["renommee"] + bonus_rep
        r = self.rng
        acquis = set(self.etat.get("technos", [])) | set(self.etat.get("certifs", []))
        eligibles = [c for c in CONTRATS if c[3] <= rep and set(requis_liste(c[4])) <= acquis]
        fidele = None if secteur else self._client_fidele()
        fid = 0
        if fidele:  # un client fidèle revient avec un projet de son secteur, plus gros et mieux payé
            nom_client, fiche = fidele
            pool = [c for c in eligibles if c[5] == fiche["secteur"]]
            if pool:
                eligibles, fid = pool, fiche["fid"]
        if secteur:  # démarchage d'un secteur choisi
            eligibles = [c for c in eligibles if c[5] == secteur] or eligibles
        nom, mix, base, rmin, requis, secteur = r.choices(eligibles, weights=range(1, len(eligibles) + 1))[0]
        client = nom_client if fid else r.choice(SECTEURS[secteur]["clients"])
        taille = round(base * (1 + TAILLE_REP[0] * min(TAILLE_REP[1], max(0, rep - rmin))) * r.uniform(0.85, 1.2) * (1 + 0.08 * fid))
        total = {d: round(taille * part) for d, part in zip(DOMAINES, mix)}
        taille = sum(total.values())
        return {
            "id": self._id(), "nom": nom, "client": client, "taille": taille, "total": total,
            "paie": int(round(taille * r.uniform(68, 82) / (1 + max(0, taille - PRIX_GROS[0]) / PRIX_GROS[1]) * (1 + PAIE_REP * min(rep, 20)) * (1 + 0.03 * fid) * (1 + 0.015 * min(10, self.meilleur_metier("commercial")))
                         * (1 + PRIME_COMMERCIAL * min(3, len(self.commerciaux()))), -2)),
            "delai": max(12, round((DELAI_BASE + taille * (0.5 - min(0.3, taille / 1500))) / (1 + DELAI_REP[0] * min(max(0, rep - DELAI_REP[1]), DELAI_REP[2])))),
            "gain": 1 + taille // 200, "expire": r.randint(18, 40) + (15 if fid else 0),
            "requis": list(requis) if isinstance(requis, tuple) else requis, "secteur": secteur, "fidele": fid,
        }

    # ------------------------------------------------------------------ calculs
    def _log(self, texte, genre="info"):
        e = self.etat
        e["journal"].insert(0, {"date": f"{e['jour']} {MOIS[e['mois']]}", "texte": texte, "genre": genre})
        del e["journal"][40:]

    def employe(self, eid):
        for emp in self.etat["employes"]:
            if emp["id"] == eid:
                return emp
        raise ErreurJeu("Employé introuvable.")

    def projet(self, pid):
        projets = self.etat["projets"]
        if pid is None and len(projets) == 1:
            return projets[0]
        for p in projets:
            if p["id"] == pid:
                return p
        raise ErreurJeu("Projet introuvable.")

    def postes_ouverts(self):
        return [o["id"] for o in self.etat["objets"] if o["type"] == "poste"]

    def bureaux_libres(self):
        pris = {x["bureau"] for x in self.etat["employes"]}
        return [b for b in self.postes_ouverts() if b not in pris]

    def _nouvel_employe(self, candidat, bureau, **modifs):
        emp = {**candidat, "xp": {"e": 0, "m": 0, "f": 0}, "fatigue": 0, "humeur": 0, "absent": 0, "formation": None,
               "bureau": bureau, "fondateur": False, "tache": None, "gain": 0, "projet": None, **modifs}
        self._completer_employe(emp)
        self.etat["employes"].append(emp)
        self._arrivee(emp)
        # chef d'équipe embauché comme tel ; chef de projet et commercial rejoignent leur bureau
        role = emp.pop("role_propose", None)
        if role and not any(x.get("role") == role for x in self.etat["employes"]):
            emp["role"] = role
            try:
                self._installer(emp, "res")
            except ErreurJeu:
                self._log(f"{emp['nom']} attend un bureau de responsable libre pour encadrer son service.", "info")
        if emp.get("chef"):
            self._installer_fonction(emp, "cdp")
        if emp.get("commercial"):
            self._installer_fonction(emp, "commerciaux")
        return emp

    def _installer_fonction(self, emp, fonction):
        """Déplace si possible le bureau de l'employé dans la pièce de sa fonction (sinon il reste où il est)."""
        o = next((x for x in self.etat["objets"] if x["id"] == emp.get("bureau")), None)
        pieces = [k for k, pc in PIECES.items() if pc.get("fonction") == fonction]
        if not o or self.carte() != "batiment" or self.piece_de(o) in pieces:
            return
        try:
            o["x"], o["y"] = self._place_auto("poste", pieces, ignorer=o["id"])
            self._roles = None
        except ErreurJeu:
            pass

    # ------------------------------------------------------------------ aménagement libre
    @staticmethod
    def fiche(genre):
        if genre == "poste":
            return POSTE
        fiche = MATERIEL.get(genre) or DECO.get(genre)
        if not fiche or fiche.get("global"):
            raise ErreurJeu("Objet inconnu.")
        return fiche

    def carte(self):
        """Le garage du fondateur, puis le bâtiment une fois le local « bureau » loué (déménagement)."""
        return "batiment" if "bureau" in self.etat["locaux"] else "garage"

    def pieces_dispo(self):
        c = self.carte()
        return [k for k, p in PIECES.items() if p["carte"] == c and (p["local"] is None or p["local"] in self.etat["locaux"])]

    def _verifier_place(self, genre, x, y, ignorer=None):
        """Renvoie la pièce où l'objet tient entièrement ; refuse les chevauchements."""
        if not (entier(x) and entier(y)):
            raise ErreurJeu("Paramètres invalides.")
        f = self.fiche(genre)
        w, h = f["w"], f["h"]
        dispo, carte = self.pieces_dispo(), self.carte()
        dedans = [k for k in f["pieces"] if PIECES[k]["rect"][0] <= x and PIECES[k]["rect"][1] <= y
                  and x + w <= PIECES[k]["rect"][0] + PIECES[k]["rect"][2] and y + h <= PIECES[k]["rect"][1] + PIECES[k]["rect"][3]]
        piece = next((k for k in dedans if k in dispo), None)
        if piece is None:
            fermee = next((k for k in dedans if PIECES[k]["carte"] == carte and PIECES[k]["local"]), None)
            if fermee:
                raise ErreurJeu(f"Il faut d'abord louer : {LOCAUX[PIECES[fermee]['local']]['nom']}.")
            noms = ", ".join(PIECES[k]["nom"] for k in f["pieces"] if PIECES[k]["carte"] == carte)
            raise ErreurJeu(f"{f['nom']} : à placer entièrement dans {noms}." if noms else f"{f['nom']} : il faut d'abord emménager dans le bâtiment.")
        if f.get("libre"):
            return piece
        if any(x < ex + ew and ex < x + w and y < ey + eh and ey < y + h for ex, ey, ew, eh in OBSTACLES[carte]):
            raise ErreurJeu("La place est prise par du mobilier fixe.")
        if genre not in MATERIEL and any(x < ex + ew and ex < x + w and y < ey + eh and ey < y + h for ex, ey, ew, eh in ETABLIS[carte]):
            raise ErreurJeu("Pas sur l'établi : seul le petit matériel peut y être posé.")
        for o in self.etat["objets"]:
            if o["id"] == ignorer:
                continue
            g = self.fiche(o["type"])
            if g.get("libre"):
                continue
            if x < o["x"] + g["w"] and o["x"] < x + w and y < o["y"] + g["h"] and o["y"] < y + h:
                raise ErreurJeu("La place est déjà prise.")
        return piece

    def _place_auto(self, genre, pieces=None, ignorer=None):
        """Rangement automatique : le petit matériel sur l'établi, le reste contre les murs (le centre reste libre pour
        circuler), en évitant la bande du bas où s'affiche le nom de la pièce. pieces : seulement ces pièces-là."""
        f, carte, dispo = self.fiche(genre), self.carte(), self.pieces_dispo()
        w, h = f["w"], f["h"]
        grille = genre == "poste" and pieces is None  # postes rangés seulement sur la grille des bureaux (à la main : partout)
        if pieces is None:  # les bureaux individuels et de direction ne se remplissent pas tout seuls
            pieces = [k for k in f["pieces"] if genre != "poste" or PIECES[k]["genre"] in ("garage", "bureau")]
        else:
            dispo = [k for k in dispo if k in pieces]
        # emplacements prévus d'abord (grille des postes, disposition de la cantine…)
        for x, y in EMPLACEMENTS.get(genre, []):
            if not any(PIECES[k]["rect"][0] <= x < PIECES[k]["rect"][0] + PIECES[k]["rect"][2] and PIECES[k]["rect"][1] <= y < PIECES[k]["rect"][1] + PIECES[k]["rect"][3] for k in pieces):
                continue
            try:
                self._verifier_place(genre, x, y, ignorer)
                return x, y
            except ErreurJeu:
                pass
        if grille:
            raise ErreurJeu("Plus de place libre pour un bureau : louez une autre pièce, ou posez-le vous-même.")
        dans = lambda x, y: any(r[0] <= x and r[1] <= y and x + POSTE_W <= r[0] + r[2] and y + POSTE_H <= r[1] + r[3] for r in (PIECES[k]["rect"] for k in dispo))
        postes = [] if genre == "poste" else [p for p in EMPLACEMENTS["poste"] if dans(*p)]  # seulement ceux de la carte courante
        gene = lambda x, y: any(x < px + POSTE_W and px < x + w and y < py + POSTE_H and py < y + h for px, py in postes)
        candidats = []  # (établi d'abord, gêne un poste prévu, rang de la pièce préférée, bande du nom, distance au mur, y, x)
        if genre in MATERIEL and set(pieces) & {"garage", "labo"}:
            for bx, by, bw, bh in ETABLIS[carte]:
                if bh >= bw and w <= bw:  # établi vertical : appareils les uns sous les autres
                    candidats += [(0, 0, 0, 0, y - by, y, bx + (bw - w) // 2) for y in range(by, by + bh - h + 1, 4)]
                elif bh < bw and h <= bh:  # établi horizontal : côte à côte
                    candidats += [(0, 0, 0, 0, x - bx, by + (bh - h) // 2, x) for x in range(bx, bx + bw - w + 1, 4)]
        for rang, k in enumerate(pieces):
            if k not in dispo:
                continue
            px, py, pw, ph = PIECES[k]["rect"]
            xs = sorted(set(range(px, px + pw - w + 1, 8)) | {px + pw - w})  # + collé au mur de droite / du bas
            ys = sorted(set(range(py, py + ph - h + 1, 8)) | {py + ph - h})
            for y in ys:
                for x in xs:
                    mur = min(x - px, px + pw - x - w, y - py, py + ph - y - h)
                    candidats.append((1, gene(x, y), rang, y + h > py + ph - BANDE_ETIQUETTE, mur, y, x))
        for *_, y, x in sorted(candidats):
            try:
                self._verifier_place(genre, x, y, ignorer)
                return x, y
            except ErreurJeu:
                pass
        raise ErreurJeu(f"Plus de place libre pour : {f['nom']}.")

    @staticmethod
    def piece_de(o):
        """Pièce du bâtiment (ou le garage) qui contient l'objet (son coin haut-gauche)."""
        for k, pc in PIECES.items():
            px, py, pw, ph = pc["rect"]
            if px <= o["x"] < px + pw and py <= o["y"] < py + ph and (pc["carte"] == "garage") == (k == "garage"):
                return k
        return None

    def emmenage(self):
        return "bureau" in self.etat["locaux"]

    def gens_de(self, fonction):
        """Employés présents installés dans la pièce d'une fonction (bureau indus, labo de qualif, chefs de projet, commerciaux)."""
        pieces = self.roles()["pieces"]
        return [x for x in self.etat["employes"] if not x["absent"] and PIECES.get(pieces.get(x["id"]), {}).get("fonction") == fonction]

    def qualite_etape(self, fonction, metier):
        """Qualité d'une étape d'indus ou de qualif : 60 % sans spécialiste installé, jusqu'à 100 % avec un expert du métier."""
        return min(1.0, 0.6 + 0.05 * max([self.metier(x, metier) for x in self.gens_de(fonction)], default=0))

    def qualite_projet(self, p, etape):
        """Qualité de l'indus ou de la qualif d'un projet : celle du prestataire choisi, sinon celle de l'équipe."""
        q = p.get("qualite_presta", {}).get(etape)
        return self.qualite_etape(etape, etape) if q is None else q

    @staticmethod
    def _externes(p, ph):
        """Domaines de la phase confiés à un prestataire, avec son offre."""
        presta = p.get("presta", {})
        if ph.get("etape") == "indus" and presta.get("indus", "interne") != "interne":
            return {d: PRESTATAIRES["indus"]["options"][presta["indus"]] for d in ph["besoin"]}
        return {d: PRESTATAIRES[d]["options"][presta[d]] for d in ph["besoin"] if presta.get(d, "interne") != "interne"}

    def chefs_projet(self):
        return [x for x in self.etat["employes"] if x.get("chef") and not x["absent"]]

    def commerciaux(self):
        return [x for x in self.etat["employes"] if x.get("commercial") and not x["absent"]]

    @staticmethod
    def service(emp):
        """Service d'un employé : son domaine le plus fort."""
        return max(DOMAINES, key=lambda d: emp[d])

    def roles(self):
        """Rôles actifs (installés dans le bon bureau), taille des services et pièce de chaque employé."""
        if self._roles is None:
            e = self.etat
            garage = self.carte() == "garage"
            postes = {o["id"]: ("garage" if garage else self.piece_de(o)) for o in e["objets"] if o["type"] == "poste"}
            occupation = {}
            for k in postes.values():
                occupation[k] = occupation.get(k, 0) + 1
            actifs = {}
            for x in e["employes"]:
                k = postes.get(x.get("bureau"))
                r = ROLES.get(x.get("role"))
                if r and k and PIECES[k]["genre"] == r["genre"] and (r["genre"] != "res" or occupation[k] == 1):
                    actifs[x["role"]] = x["id"]
            self._roles = {"actifs": actifs, "pieces": {x["id"]: postes.get(x.get("bureau")) for x in e["employes"]},
                           "taille": {d: sum(1 for x in e["employes"] if self.service(x) == d) for d in DOMAINES}}
        return self._roles

    def facteur_service(self, emp):
        """Responsable installé : +8 % ; service trop grand sans responsable : jusqu'à −20 % ; bureau de son service : +5 %."""
        r, d = self.roles(), self.service(emp)
        f = 1.0
        if f"resp_{d}" in r["actifs"]:
            f *= 1.08
        elif r["taille"][d] > SERVICE_SANS_RESP:
            f *= 1 - min(0.2, 0.04 * (r["taille"][d] - SERVICE_SANS_RESP))
        if PIECES.get(r["pieces"].get(emp["id"]), {}).get("service") == d:
            f *= 1.05
        return f

    def _installer(self, emp, genre):
        """Déplace le bureau de l'employé dans une pièce du genre voulu (individuelle pour un responsable)."""
        e = self.etat
        o = next((x for x in e["objets"] if x["id"] == emp.get("bureau")), None)
        if o is None:
            raise ErreurJeu(f"{emp['nom']} n'a pas de bureau.")
        autres = [self.piece_de(x) for x in e["objets"] if x["type"] == "poste" and x is not o]
        libres = [k for k in self.pieces_dispo() if PIECES[k]["genre"] == genre and (genre != "res" or k not in autres)]
        if self.carte() == "batiment" and self.piece_de(o) in libres:
            return
        try:
            o["x"], o["y"] = self._place_auto("poste", libres, ignorer=o["id"])
        except ErreurJeu:
            raise ErreurJeu("Louez d'abord " + ("un bureau de responsable libre" if genre == "res" else "la direction R&D, avec une place libre") + " (Locaux).") from None
        self._roles = None

    def _replacer_objets(self):
        """Replace tous les objets dans les pièces disponibles (déménagement, nouveau plan) ; les bureaux d'abord, les plus gros
        objets ensuite. Ce qui ne tient plus est retiré du plan (l'effet d'une déco reste acquis, un employé sans bureau en retrouve un)."""
        e = self.etat
        anciens, e["objets"] = e["objets"], []
        connus = [o for o in anciens if o["type"] == "poste" or o["type"] in MATERIEL or (o["type"] in DECO and not DECO[o["type"]].get("global"))]
        hors_grille = [k for k in POSTE["pieces"] if PIECES[k]["genre"] in ("garage", "bureau")]
        perdus = []
        for o in sorted(connus, key=lambda o: (o["type"] != "poste", o["type"] not in MATERIEL, -self.fiche(o["type"])["w"] * self.fiche(o["type"])["h"])):
            try:
                x, y = self._place_auto(o["type"])
            except ErreurJeu:
                try:  # grille pleine : un poste se pose ailleurs dans les bureaux
                    if o["type"] != "poste":
                        raise
                    x, y = self._place_auto("poste", hors_grille)
                except ErreurJeu:
                    perdus.append(o)
                    continue
            e["objets"].append({**o, "x": x, "y": y})
        # ce qui ne tient nulle part est revendu à moitié prix (sinon : invisible, ni revendable ni reposable)
        for o in perdus:
            if o["type"] == "poste" or any(x["type"] == o["type"] for x in e["objets"]):
                continue
            liste = e["materiel"] if o["type"] in MATERIEL else e["deco"]
            if o["type"] in liste:
                liste.remove(o["type"])
                e["pannes"].pop(o["type"], None)
                self._encaisser(self.fiche(o["type"])["prix"] // 2)
                self._log(f"{self.fiche(o['type'])['nom']} : plus de place dans les pièces louées, revendu à moitié prix.", "info")
        postes = {o["id"] for o in e["objets"] if o["type"] == "poste"}
        for emp in e["employes"]:
            if emp["bureau"] not in postes:
                libres = self.bureaux_libres()
                emp["bureau"] = libres[0] if libres else None

    def _ajouter_objet(self, genre, x, y):
        o = {"id": self._id(), "type": genre, "x": x, "y": y}
        self.etat["objets"].append(o)
        return o

    def _poser(self, genre, x=None, y=None):
        e = self.etat
        f = self.fiche(genre)
        if genre in MATERIEL and genre in e["materiel"]:
            raise ErreurJeu(f"{f['nom']} : déjà installé.")
        if genre in DECO and genre in e["deco"] and not f.get("multiple"):
            raise ErreurJeu(f"{f['nom']} : vous en avez déjà un.")
        if x is None or y is None:
            x, y = self._place_auto(genre)
        else:
            x, y = round(x / GRILLE) * GRILLE if entier(x) else x, round(y / GRILLE) * GRILLE if entier(y) else y
        self._verifier_place(genre, x, y)
        self._payer(f["prix"])
        o = self._ajouter_objet(genre, x, y)
        sans = next((x for x in e["employes"] if genre == "poste" and x.get("bureau") is None), None)
        if sans:
            sans["bureau"] = o["id"]  # un employé sans bureau (déménagement serré) s'y installe
        if genre in MATERIEL:
            e["materiel"].append(genre)
        elif genre in DECO and genre not in e["deco"]:
            e["deco"].append(genre)
        self._log(f"{f['nom']} installé.", "bon")

    def objet(self, oid):
        o = next((x for x in self.etat["objets"] if x["id"] == oid), None)
        if not o:
            raise ErreurJeu("Objet introuvable.")
        return o

    def capacite_projets(self):
        """Garage : 1 projet ; emménagé : 2 ; un de plus par chef de projet (4 au plus)."""
        return 1 + self.emmenage() + min(4, len(self.chefs_projet())) + self.a_investi("filiale")

    def nb_offres(self):
        return NB_OFFRES + self.emmenage() + 2 * self.a_investi("filiale")  # demandes spontanées : l'accueil, la filiale ; le reste se prospecte

    def places_occupees(self):
        return sum(2 if p.get("mega") else 1 for p in self.etat["projets"])

    def horaires(self):
        return HORAIRES[self.etat["heures"]]

    def materiel_actif(self):
        return [m for m in self.etat["materiel"] if m not in self.etat["pannes"]]

    def bonus(self):
        b = {"e": 0, "m": 0, "f": 0, "debug": 0, "cem": 0.0}
        for mid in self.materiel_actif():
            m = MATERIEL[mid]
            if m["dom"] in b:
                b[m["dom"]] += m["bonus"]
            b["debug"] += m.get("debug", 0)
            b["cem"] += m.get("cem", 0)
        return self._mod_bonus(b)

    def moral_global(self):
        e = self.etat
        m = 60 + sum(DECO[d]["moral"] for d in e["deco"]) + self.horaires()["moral"] + 5 * self.emmenage()  # salle de pause
        m += sum(self._trait(x, "moral") for x in e["employes"])
        m -= max(0, len(e["employes"]) - 4) * 1.5
        return borne(m, 20, 95)

    def moral(self, emp):
        encadre = 5 if f"resp_{self.service(emp)}" in self.roles()["actifs"] else 0
        return borne(self.moral_global() - emp["fatigue"] / 2 + emp["humeur"] + encadre, 5, 100)

    def conditions(self):
        """Conditions de travail : facteurs (libellé, %) et multiplicateur appliqué à toute la production."""
        e = self.etat
        n = len([x for x in e["employes"] if not x["absent"]])
        f = [(DECO[d]["nom"], DECO[d]["prod"]) for d in e["deco"] if DECO[d].get("prod")]
        if "cafe" in e["deco"]:
            f.append(("Pauses café", 3))
        if e["heures"] != 8:
            f.append((f"Horaires : {e['heures']} h par jour", round((self.horaires()["prod"] - 1) * 100)))
        if e.get("meteo") == "canicule":
            f.append(("Canicule, mais climatisé", 0) if "clim" in e["deco"] else ("Canicule sans climatisation", -15))
        elif e.get("meteo") == "neige":
            f.append(("Neige : trajets difficiles", -5))
        bruit = 2 * (n - 4) - 6 * self.emmenage()  # les bulles téléphone du bâtiment
        if bruit > 0 and "isolation" not in e["deco"]:
            f.append(("Bruit, pas d'isolation phonique", -bruit))
        if n >= 2 and "bureau" not in e["locaux"]:
            f.append(("Garage exigu", -5))
        total = borne(1 + sum(x[1] for x in f) / 100, 0.6, 1.5)
        return [{"nom": a, "pct": b} for a, b in f], total

    def efficacite(self, emp):
        anciennete = 1 + min(0.1, 0.02 * self.anciennete(emp))  # on connaît la maison : +2 % par an, jusqu'à +10 %
        return borne(self.moral(emp) / 70, 0.4, 1.4) * self.conditions()[1] * self._trait(emp, "vitesse") * anciennete * self.facteur_service(emp)

    def loyer(self):
        return LOYER_BASE + sum(LOCAUX[l]["loyer"] for l in self.etat["locaux"]) + INVESTISSEMENTS["filiale"]["loyer"] * self.a_investi("filiale")

    def frais_structure(self):
        """Comptable, assurances, licences logicielles… : croît plus vite que l'effectif (coordination)."""
        n = len([x for x in self.etat["employes"] if not x.get("fondateur") and not x.get("stage")])
        return 400 * n + 50 * n * n

    def salaires(self):
        return int(round(sum(x["salaire"] for x in self.etat["employes"]) * (1 + self.horaires()["salaire"])))

    def _production(self, emp, dom, bon):
        if emp[dom] <= 0:
            return 0.0
        logiciel = 1 + 0.03 * emp["metier"]["logiciel"] if dom == "f" else 1
        return emp[dom] * self.efficacite(emp) * (1 + 0.06 * bon[dom]) * logiciel * self.facteur_prospection(emp)  # moins de production pendant la prospection

    def _detection(self, emp, bon):
        fm = borne(self.moral(emp) / 70, 0.4, 1.4) * self.conditions()[1]
        qualite = 1.5 if self.roles()["pieces"].get(emp["id"]) == "qualif" else 1.0
        return (emp["e"] + emp["f"]) / 2 * fm * 0.2 * (1 + 0.15 * bon["debug"]) * self._trait(emp, "detection") * qualite

    @staticmethod
    def frais_cem(p):
        return 600 + p["taille"] * 5  # tests toujours confiés à un labo externe

    def proba_cem(self, p):
        bon = self.bonus()
        norm = p["defauts"] / max(1, p["taille"] / 40)
        pr = 0.6 + bon["cem"] + self._cem_bonus(p) + min(0.15, 0.015 * self.meilleur_metier("qualif")) - min(0.25, p["taille"] / 2000) - 0.04 * norm + 0.2 * p["echecs_cem"]
        return round(borne(pr, 0.1, 0.95), 2)

    def note(self, p):
        bon = self.bonus()
        n = 7.5 + min(1.0, (bon["e"] + bon["m"] + bon["f"]) / 25)
        n += min(1.5, p["qualite"] / max(1, p["taille"]) * 3)
        n -= p["defauts"] / max(1, p["taille"] / 40) * 0.9
        n -= 0.6 * p["echecs_cem"]
        n += self._note_bonus(p)
        if p["combos"].get("trio", 0) >= max(1, p["jours"]) / 2:
            n += 0.4
        suivi = p.get("suivi", 0)  # chef de projet : client mieux tenu au courant, retard mieux absorbé
        n += 0.3 * suivi
        if p["type"] == "contrat" and p["jours"] > p["delai"]:
            n -= min(3, 0.12 * (p["jours"] - p["delai"])) * (1 - 0.5 * suivi)
        return round(borne(n, 1, 10), 1)

    def attente_client(self):
        """Plus la société est connue, plus les clients sont exigeants (frein à l'emballement de fin de partie)."""
        return 6 + min(ATTENTE_REP[1], self.etat["renommee"] / ATTENTE_REP[0]) + DIFFICULTES[self.etat.get("difficulte", "normal")]["attente"]

    # ------------------------------------------------------------------ argent
    def _encaisser(self, montant):
        e = self.etat
        e["argent"] += montant
        e["stats"]["ca"] += montant
        e["exercice"]["ca"] += montant

    def _depenser(self, montant):
        self.etat["argent"] -= montant
        self.etat["exercice"]["charges"] += montant

    def _payer(self, montant):
        if self.etat["argent"] < montant:
            raise ErreurJeu("Trésorerie insuffisante.")
        self._depenser(montant)

    # ------------------------------------------------------------------ projets
    def _creer_projet(self, base, genre):
        phases = []
        for nom, parts in PHASES:
            besoin = {d: round(base["total"][d] * parts[d]) for d in DOMAINES if round(base["total"][d] * parts[d]) > 0}
            if besoin:
                phases.append({"nom": nom, "besoin": besoin, "fait": {d: 0.0 for d in besoin}})
            if nom == PHASES[1][0]:
                # les PCB partent en fabrication : on attend le retour du fournisseur (durée fixée à l'entrée)
                phases.append({"nom": "Fabrication du prototype", "besoin": {}, "fait": {}, "attente": None})
        return {
            "id": self._id(), "type": genre, "nom": base["nom"], "client": base.get("client", ""),
            "taille": base["taille"], "total": base["total"], "paie": base.get("paie", 0), "delai": base.get("delai", 0),
            "gain": base.get("gain", 0), "potentiel": base.get("potentiel", 0), "id_produit": base.get("id_produit"),
            "secteur": base.get("secteur"), "mega": base.get("mega", False),
            "phases": phases, "phase": 0, "etape": "travail", "defauts": 0.0, "qualite": 0.0,
            "jours": 0, "cem_jours": 0, "echecs_cem": 0, "combos": {}, "combos_jour": [], "equipe": [],
        }

    def _verifier_capacite(self, places=1):
        if self.places_occupees() + places > self.capacite_projets():
            raise ErreurJeu(f"Vous menez déjà {self.places_occupees()} projet(s) sur {self.capacite_projets()} possibles"
                            + (" (un méga-projet compte double)" if places > 1 else "") + " : agrandissez les locaux pour en mener plus.")

    def _entrer_phase(self, p):
        ph = p["phases"][p["phase"]]
        if ph.get("essais") and ph["attente"] is None:
            ph["attente"] = max(2, ph["essais"] - (self.qualite_projet(p, "qualif") >= 0.9))
            self._log(f"« {p['nom']} » : essais de qualification ({ph['attente']} jours en étuve et sur pot vibrant).", "info")
        elif "attente" in ph and ph["attente"] is None:
            maison = "four" in self.materiel_actif()  # avec un four de refusion, on assemble soi-même : plus rapide et moins cher
            ph["attente"] = max(1, (2 if maison else 4) + FOURNISSEURS[self.etat["fournisseur"]]["jours"] + sum(self._choix_effets(p, "jours")))
            ph["cout"] = int(round((200 + p["taille"] * 2) * (0.5 if maison else 1) * self._facteur_proto(p) * (1 - 0.1 * p.get("suivi", 0)), -1))
            self._depenser(ph["cout"])
            ou = "assemblé au labo" if maison else "chez le fabricant"
            self._log(f"« {p['nom']} » : prototype {ou} (−{ph['cout']:_} €, {ph['attente']} jours).".replace("_", " "), "info")
        else:
            self._kickoff(p)
            self._log(f"« {p['nom']} » : phase « {ph['nom']} ».", "info")

    @staticmethod
    def _niveau(p, etape):
        """0 : pas d'étape ; 1 : la carte ; 2 : le produit fini."""
        return CHOIX_TECH[etape]["options"][p.get("choix", {}).get(etape, "aucune")].get(etape, 0)

    def _etapes(self, p):
        """Ajoute l'industrialisation (du travail) et la qualification (des essais) choisies, après le firmware."""
        t, ni, nq = p["total"], self._niveau(p, "indus"), self._niveau(p, "qualif")
        if ni:
            parts = {"e": 0.12, "m": 0, "f": 0} if ni == 1 else {"e": 0.1, "m": 0.15, "f": 0.08}
            besoin = {d: max(3, round(t[d] * k)) for d, k in parts.items() if k and t[d] > 0}
            p["phases"].append({"nom": "Industrialisation " + ("de la carte" if ni == 1 else "du produit"), "etape": "indus", "besoin": besoin, "fait": {d: 0.0 for d in besoin}})
        if nq:
            essais = round((4 if nq == 1 else 7) * PRESTATAIRES["qualif"]["options"][p.get("presta", {}).get("qualif", "interne")].get("duree", 1))
            p["phases"].append({"nom": "Qualification " + ("de la carte" if nq == 1 else "du produit"), "etape": "qualif", "besoin": {}, "fait": {}, "attente": None, "essais": essais})

    def _kickoff(self, p):
        """Réunion de lancement dans le bâtiment : la nouvelle phase démarre déjà avancée de 5 %."""
        ph = p["phases"][p["phase"]]
        part = KICKOFF * self.emmenage()
        for d in ph["besoin"]:
            ph["fait"][d] = max(ph["fait"][d], round(ph["besoin"][d] * part, 1))

    def _lancer_cem(self, p):
        frais = self.frais_cem(p)
        self._depenser(frais)
        p["etape"], p["cem_jours"] = "cem", DUREE_CEM
        self._log(f"Tests CEM confiés au labo externe pour « {p['nom']} » (−{frais:_} €, {DUREE_CEM} jours).".replace("_", " "), "info")

    def _utilite(self, emp, p):
        if p["etape"] == "travail":
            ph = p["phases"][p["phase"]]
            ext = self._externes(p, ph)
            return max([emp[d] for d in ph["besoin"] if ph["besoin"][d] - ph["fait"][d] > 1e-6 and d not in ext] or [0])
        if p["etape"] == "debug":
            return (emp["e"] + emp["f"]) / 4
        return 0

    def _repartir(self):
        """Affecte chaque employé présent à un projet : son affectation fixe ; puis chaque chef de projet prend, pour ses projets,
        le meilleur spécialiste libre de chaque domaine encore à faire ; les autres vont là où ils sont le plus utiles."""
        e = self.etat
        equipes = {p["id"]: [] for p in e["projets"]}
        if not equipes:
            return equipes
        libres = []
        for emp in e["employes"]:
            if emp["absent"]:
                continue
            if emp.get("projet") in equipes:
                equipes[emp["projet"]].append(emp)
            else:
                libres.append(emp)
        for p in sorted(e["projets"], key=lambda p: -p["taille"]):
            if not p.get("chef") or p["etape"] != "travail":
                continue
            ph = p["phases"][p["phase"]]
            ext = self._externes(p, ph)
            for d in [d for d in ph["besoin"] if ph["besoin"][d] - ph["fait"][d] > 1e-6 and d not in ext]:
                if any(x[d] >= 3 for x in equipes[p["id"]]):
                    continue  # domaine déjà couvert
                emp = max(libres, key=lambda x: x[d], default=None)
                if emp and emp[d] > 0:
                    equipes[p["id"]].append(emp)
                    libres.remove(emp)
        for emp in libres:
            meilleur = max(e["projets"], key=lambda p: self._utilite(emp, p) / (1 + 0.25 * len(equipes[p["id"]])))
            equipes[meilleur["id"]].append(emp)
        return equipes

    def _combos(self, p, equipe):
        actifs = []
        doms = [d for d in DOMAINES if p["total"][d] > 0]
        pris = set()
        for d in doms:
            expert = next((x for x in equipe if x[d] >= 5 and x["id"] not in pris), None)
            if not expert:
                break
            pris.add(expert["id"])
        else:
            if len(doms) >= 2:
                actifs.append("trio")
        traits = {t for x in equipe for t in x["traits"]}
        if {"perfectionniste", "debug"} <= traits:
            actifs.append("qualite")
        if any(x[d] >= 9 for x in equipe for d in DOMAINES) and any(x["e"] + x["m"] + x["f"] <= 6 for x in equipe):
            actifs.append("mentor")
        if len(equipe) >= 4 and all(self.moral(x) >= 65 for x in equipe):
            actifs.append("soudee")
        return actifs

    def _travailler(self, p, actifs, bon):
        e = self.etat
        combos = self._combos(p, actifs)
        p["combos_jour"], p["equipe"] = combos, [x["id"] for x in actifs]
        for c in combos:
            p["combos"][c] = p["combos"].get(c, 0) + 1
            if c not in e["combos_vus"]:
                e["combos_vus"].append(c)
                self._log(f"Combo débloqué sur « {p['nom']} » : {COMBOS[c]['nom']} !", "bon")
        mult = (1.1 if "trio" in combos else 1.0) * (1.05 if "soudee" in combos else 1.0) * self._mult_chef(p) * self._affinites(actifs, p)
        pedagogues = [x for x in actifs if "pedagogue" in x["traits"]]
        taux_base = 0.07 * self._facteur_defauts() * math.prod(self._choix_effets(p, "defauts"))
        taux_defauts = taux_base * self.horaires()["defauts"] * (0.7 if "qualite" in combos else 1.0)
        taux_defauts *= 1 - 0.1 * p.get("suivi", 0)  # le chef de projet fait le lien entre les équipes
        for emp in actifs:
            emp["projet_jour"] = p["id"]
        if p["etape"] == "travail":
            ph = p["phases"][p["phase"]]
            if ph.get("attente"):
                ph["attente"] -= 1
                # essais ratés : plus probable en interne sans spécialiste ou chez un labo low-cost
                if not ph["attente"] and ph.get("etape") == "qualif" and self.rng.random() < 0.5 * (1 - self.qualite_projet(p, "qualif")):
                    ph["attente"] = ph["essais"]
                    self._log(f"« {p['nom']} » : essais de qualification ratés, à refaire ({ph['essais']} jours).", "mauvais")
            ext = self._externes(p, ph)
            for d, o in ext.items():  # le prestataire avance de son côté, plus vite sur un gros projet
                pts = min(max(o["rythme"], p["taille"] * o["rythme"] / 150), ph["besoin"][d] - ph["fait"][d])
                ph["fait"][d] += pts
                p["defauts"] += pts * taux_base * o.get("defauts", 1)
            for emp in actifs:
                reste = {d: ph["besoin"][d] - ph["fait"][d] for d in ph["besoin"]}
                doms = [d for d, r in reste.items() if r > 1e-6 and emp[d] > 0 and d not in ext]
                if doms:
                    d = max(doms, key=lambda k: emp[k])
                    pts = min(self._production(emp, d, bon) * mult * self._contexte(emp, p, actifs) * self._coordination(emp, p, actifs), reste[d])
                    ph["fait"][d] += pts
                    p["defauts"] += pts * taux_defauts * self._facteur_defauts_emp(emp, p) * (0.9 if self.encadre(emp) else 1)  # le responsable relit
                    p["qualite"] += pts * self._trait(emp, "qualite")
                    emp["tache"], emp["gain"] = d, round(pts, 1)
                    junior = "mentor" in combos and emp["e"] + emp["m"] + emp["f"] <= 6
                    pedagogie = 1.5 if any(x is not emp for x in pedagogues) else 1
                    self._experience(emp, d, pts * (2 if junior else 1) * pedagogie)
                else:
                    retire = min(p["defauts"], self._detection(emp, bon))
                    p["defauts"] -= retire
                    emp["tache"], emp["gain"] = "debug", round(retire, 1)
            p["defauts"] *= 1 - min(0.3, 0.015 * (1 + 0.5 * bon["debug"]))
            if not ph.get("attente") and all(ph["fait"][d] >= ph["besoin"][d] - 1e-6 for d in ph["besoin"]):
                if p["phase"] + 1 < len(p["phases"]):
                    p["phase"] += 1
                    e["reunion"] = True
                    self._entrer_phase(p)
                elif p["defauts"] >= 0.5:
                    p["etape"] = "debug"
                    self._log(f"« {p['nom']} » : place au debug. Passez aux tests CEM quand vous voulez.", "info")
                else:
                    self._lancer_cem(p)
        elif p["etape"] == "debug":
            for emp in actifs:
                retire = min(p["defauts"], self._detection(emp, bon))
                p["defauts"] -= retire
                emp["tache"], emp["gain"] = "debug", round(retire, 1)
                self._experience(emp, "f" if emp["f"] >= emp["e"] else "e", retire)
            if p["defauts"] < 0.3:
                p["defauts"] = 0.0
                self._log(f"Plus aucun défaut connu sur « {p['nom']} » : direction les tests CEM.", "bon")
                self._lancer_cem(p)
        elif p["etape"] == "cem":
            for emp in actifs:
                emp["tache"], emp["gain"] = "cem", 0
            p["cem_jours"] -= 1
            if p["cem_jours"] <= 0:
                if self.rng.random() < self.proba_cem(p):
                    self._terminer(p)
                else:
                    p["echecs_cem"] += 1
                    besoin = max(6, round(p["total"]["e"] * 0.12))
                    p["phases"].append({"nom": "Correction CEM", "besoin": {"e": besoin}, "fait": {"e": 0.0}})
                    p["phase"] = len(p["phases"]) - 1
                    p["etape"] = "travail"
                    self._log(f"Échec aux tests CEM pour « {p['nom']} » : il faut corriger le routage.", "mauvais")

    def _terminer(self, p):
        e = self.etat
        note = self.note(p)
        if p["type"] == "contrat":
            facteur = borne(1 + 0.1 * (note - self.attente_client()), 0.5, 1.25)
            paie = int(round(p["paie"] * facteur * self._facteur_paie(p), -1)) - p.get("acompte", 0)
            ecart = note - self.attente_client()
            prime = int(round(p["paie"] * PRIME_CHEF * p.get("suivi", 0), -1)) if p.get("chef") and p["jours"] <= p["delai"] and ecart >= 0 else 0
            paie += prime
            gain = -1 if ecart < -2 else self._arrondi_hasard(max(0.0, p["gain"] * ecart / 2 + (0.5 if ecart >= 0 else 0)) * self._frein_renommee())
            self._encaisser(paie)
            e["renommee"] = max(0, e["renommee"] + gain)
            e["stats"]["livres"] += 1
            e["exercice"]["livres"] += 1
            self._log(f"« {p['nom']} » livré à {p['client']} : note {note}/10, +{paie:_} €{f' (dont prime du client {prime:_} €)' if prime else ''}, renommée {gain:+d}.".replace("_", " "), "bon")
            e["historique"].insert(0, {"nom": p["nom"], "client": p["client"], "note": note, "montant": paie,
                                       "jours": p["jours"], "type": "contrat", "avis": self._avis(note)})
            if p["taille"] >= 300 and p["echecs_cem"] == 0 and note >= 8:
                self._trophee("sans_faute")
        else:
            ventes = VENTES * p["potentiel"] * (note / 10) ** 2 * (1 + min(e["renommee"], 25) / 25)
            prix = max(20, round(p["potentiel"] / 60))
            ni, nq = self._niveau(p, "indus"), self._niveau(p, "qualif")
            qi, qq = self.qualite_projet(p, "indus"), self.qualite_projet(p, "qualif")
            e["produits"].append({"nom": p["nom"], "id_produit": p["id_produit"], "note": note, "prix": prix, "stock": 0, "mois": 0, "total": 0,
                                  "demande": max(5, round(ventes * 2 / prix)),  # unités par mois (×2 : la fabrication coûte la moitié du prix)
                                  "cout_unite": round(prix * 0.5 * (1 - 0.15 * ni * qi), 2),  # l'indus baisse le coût unitaire
                                  "defaut_lot": round(0.12 * (1 - 0.35 * ni * qi), 3), "pannes": round(0.04 * (1 - 0.35 * nq * qq), 3)})
            e["produits"][-1]["ventes"] = e["produits"][-1]["demande"] * prix
            e["stats"]["produits_lances"] += 1
            if note >= 8:
                e["renommee"] += self._arrondi_hasard(self._frein_renommee())
            self._log(f"« {p['nom']} » est en vente ! Note de la presse : {note}/10.", "bon")
            e["historique"].insert(0, {"nom": p["nom"], "client": "Produit maison", "note": note, "montant": 0,
                                       "jours": p["jours"], "type": "produit", "avis": self._avis(note)})
        for cle, niveau in (("indus", self._niveau(p, "indus")), ("qualif", self._niveau(p, "qualif"))):
            e["stats"][cle] = e["stats"].get(cle, 0) + (niveau > 0)
            e["stats"][cle + "_produit"] = e["stats"].get(cle + "_produit", 0) + (niveau == 2)
        e["exercice"]["notes"].append(note)
        del e["historique"][30:]
        e["projets"].remove(p)
        for x in e["employes"]:
            if x.get("projet") == p["id"]:
                x["projet"] = None
        e["dernier_livre"] = e["historique"][0]
        self._apres_livraison(p, note, e["historique"][0]["montant"])

    def _frein_renommee(self):
        """Chaque point de renommée est plus dur à gagner quand on est déjà connu (÷6 à 2, ÷88 à 10, ÷400 à 20)."""
        return 1 / (1 + self.etat["renommee"] / 2) ** 2.5

    def _arrondi_hasard(self, x):
        """Arrondi aléatoire : 0,3 donne 1 trois fois sur dix (les petits gains ne disparaissent pas)."""
        return int(x) + (self.rng.random() < x - int(x))

    def _avis(self, note):
        if note >= 9:
            return "Travail exceptionnel, on vous confie la suite !"
        if note >= 7.5:
            return "Très bon travail, client satisfait."
        if note >= 6:
            return "Correct, quelques retouches à prévoir."
        if note >= 4:
            return "Décevant : trop de défauts ou de retard."
        return "Inacceptable. Ce client ne reviendra pas."

    def encadre(self, emp):
        return f"resp_{self.service(emp)}" in self.roles()["actifs"]

    def _coordination(self, emp, p, equipe):
        """Plus on est nombreux sur un projet, plus on perd de temps à se coordonner ; un responsable et un chef de projet limitent la perte."""
        if self.encadre(emp):
            return 1.0
        return 1 - min(0.18, 0.03 * max(0, len(equipe) - 3)) * (1 - 0.5 * p.get("suivi", 0))

    def _suivi_chefs(self):
        """Chaque projet est suivi par le chef de projet le moins chargé ; son effet baisse avec le nombre de projets qu'il suit."""
        e = self.etat
        chefs = sorted(self.chefs_projet(), key=lambda c: -self.metier(c, "gestion"))
        charge = {c["id"]: 0 for c in chefs}
        for p in sorted(e["projets"], key=lambda p: -p["taille"]):
            c = min(chefs, key=lambda c: charge[c["id"]]) if chefs else None
            p["chef"] = c and c["id"]
            if c:
                charge[c["id"]] += 1
        for p in e["projets"]:
            p["suivi"] = round(1 / charge[p["chef"]] ** 0.5, 3) if p["chef"] else 0

    def _experience(self, emp, dom, pts):
        emp["xp"][dom] += pts * SENIORITES[emp["seniorite"]]["xp"] * (1.3 if "ambitieux" in emp["traits"] else 1) * (1.25 if self.encadre(emp) else 1) \
            * (1.25 if self.a_investi("formation") else 1)
        seuil = 60 + 6 * emp[dom] ** 2
        if emp["xp"][dom] >= seuil and emp[dom] < 15:
            emp["xp"][dom] -= seuil
            emp[dom] += 1
            if not emp.get("fondateur") and not emp.get("stage"):
                emp["salaire"] += HAUSSE_POINT
            self._log(f"{emp['nom']} progresse en {NOM_DOMAINE[dom]} ({emp[dom]}).", "bon")

    # ------------------------------------------------------------------ trophées, bilans, fin
    def _trophee(self, tid):
        e = self.etat
        if tid not in e["trophees"]:
            e["trophees"].append(tid)
            self._log(f"Trophée débloqué : {TROPHEES[tid]['nom']} !", "trophee")

    def _verifier_trophees(self):
        e = self.etat
        notes = [h["note"] for h in e["historique"]]
        conditions = {
            "premier_contrat": e["stats"]["livres"] >= 1,
            "note_9": any(n >= 9 for n in notes),
            "note_10": any(n >= 10 for n in notes),
            "equipe_6": len(e["employes"]) >= 6,
            "equipe_10": len(e["employes"]) >= 10,
            "parallele": len(e["projets"]) >= 3,
            "trio": "trio" in e["combos_vus"],
            "siege": self.dg_actif(),
            "trois_produits": e["stats"]["produits_lances"] >= 3,
            "produit_star": any(h["type"] == "produit" and h["note"] >= 8.5 for h in e["historique"]),
            "vingt_contrats": e["stats"]["livres"] >= 20,
            "renommee_10": e["renommee"] >= 10,
            "renommee_25": e["renommee"] >= 25,
            "cent_mille": e["argent"] >= 100_000,
            "million": e["argent"] >= 1_000_000,
            "batiment_b": {"rdc", "r1", "r2"} <= {PIECES[k]["etage"] for k in self.roles()["pieces"].values() if k},
            "usine": e["stats"].get("indus_produit", 0) >= 1,
            "partenaire": any(c["fid"] >= FIDELITE_MAX for c in e["clients"].values()),
            "gamme": e["stats"]["suites"] >= 1,
            "mega": e["stats"]["megas"] >= 1,
            "cinquante": e["stats"]["livres"] >= 50,
            "dix_missions": len(e["missions"]) >= 10,
            "toutes_missions": len(e["missions"]) >= len(MISSIONS),
        }
        for tid, ok in conditions.items():
            if ok:
                self._trophee(tid)
        self._verifier_missions()

    def _bilan(self):
        e = self.etat
        x = e["exercice"]
        benefice = x["ca"] - x["charges"]
        impot = int(round(max(0, benefice) * DIFFICULTES[e["difficulte"]]["impot"], -1))
        e["argent"] -= impot
        an = e["jours_total"] // JOURS_AN
        bilan = {
            "annee": an, "ca": x["ca"], "charges": x["charges"], "benefice": benefice, "impot": impot,
            "livres": x["livres"], "note_moy": round(sum(x["notes"]) / len(x["notes"]), 1) if x["notes"] else None,
            "renommee": e["renommee"] - x["rep0"], "employes": len(e["employes"]), "tresorerie": e["argent"],
        }
        e["bilans"].append(bilan)
        e["bilan"] = bilan
        e["exercice"] = self._exercice_vide()
        self._log(f"Bilan de l'année {an} : bénéfice {benefice:_} €, impôt −{impot:_} €.".replace("_", " "), "info")
        if an >= DUREE_PARTIE_ANS and "fin" not in e:
            e["fin"] = self.score_final()

    def score_final(self):
        e = self.etat
        notes = [h["note"] for h in e["historique"]]
        moy = sum(notes) / len(notes) if notes else 0
        score = round((e["stats"]["ca"] / 1000 + e["renommee"] * 40 + len(e["trophees"]) * 150 + moy * 100) * e.get("parts", 1))
        titre = next(t for seuil, t in TITRES_FIN if score < seuil)
        directeur = next(x["nom"] for x in e["employes"] if x.get("fondateur"))
        return {"score": score, "titre": titre, "vue": False, "entreprise": e["entreprise"], "directeur": directeur, "ca": e["stats"]["ca"], "livres": e["stats"]["livres"],
                "renommee": e["renommee"], "trophees": len(e["trophees"]), "note_moy": round(moy, 1)}

    # ------------------------------------------------------------------ temps
    def en_pause(self):
        e = self.etat
        return bool(e["evenement"] or e["faillite"] or e.get("bilan") or (e.get("fin") and not e["fin"]["vue"])
                    or (e.get("victoire") and not e["victoire"]["vue"]))

    def avancer(self, jours=1):
        for _ in range(max(1, min(30, int(jours)))):
            if self.en_pause():
                break
            self._jour()

    def _jour(self):
        e = self.etat
        self._roles = None
        e["jour"] += 1
        e["jours_total"] += 1
        if e["jour"] > JOURS_MOIS:
            e["jour"] = 1
            e["mois"] += 1
            if e["mois"] > 11:
                e["mois"], e["annee"] = 0, e["annee"] + 1
            self._debut_mois()
        self._debut_jour_extensions()
        bon = self.bonus()
        for emp in e["employes"]:
            emp["tache"], emp["gain"], emp["projet_jour"] = None, 0, None
        self._suivi_chefs()
        equipes = self._repartir()
        for p in list(e["projets"]):
            p["jours"] += 1
            self._travailler(p, equipes[p["id"]], bon)
            if p in e["projets"] and p["type"] == "contrat" and p["jours"] == p["delai"] + 1:
                self._log(f"Retard sur « {p['nom']} » : la note client va baisser.", "mauvais")
        par_id = {p["id"]: p for p in e["projets"]}
        for emp in e["employes"]:
            self._placer(emp, par_id.get(emp["projet_jour"]))
        e.pop("reunion", None)
        h = self.horaires()
        for emp in e["employes"]:
            if emp["absent"] > 0:
                emp["absent"] -= 1
                emp["fatigue"] = max(0, emp["fatigue"] - 3)
                if emp["absent"] == 0:
                    emp["absence"] = None
                if emp["absent"] == 0 and emp["formation"]:
                    d = emp["formation"]
                    emp[d] = min(15, emp[d] + 2)
                    emp["formation"] = None
                    self._log(f"{emp['nom']} revient de formation : {NOM_DOMAINE[d]} {emp[d]}.", "bon")
            elif emp["tache"]:
                emp["fatigue"] = min(50, emp["fatigue"] + 1.2 * self._trait(emp, "fatigue") * h["fatigue"])
            else:
                emp["fatigue"] = max(0, emp["fatigue"] - (5 if self.emmenage() else 3))
        self._jour_personnel()
        for pid in list(e["pannes"]):
            e["pannes"][pid] -= 1
            if e["pannes"][pid] <= 0:
                del e["pannes"][pid]
                self._log(f"{MATERIEL.get(pid, {}).get('nom', pid)} réparé.", "info")
        for o in e["offres"]:
            o["expire"] -= 1
        e["offres"] = [o for o in e["offres"] if o["expire"] > 0]
        if sum(not o.get("canal") for o in e["offres"]) < self.nb_offres() + len(e["projets"]) and self.rng.random() < 0.15:
            e["offres"].append(self._offre())
        self._jour_commerce()
        if e["jours_total"] > 10 and self.rng.random() < 1 / 18:
            self._evenement()
        self._fin_jour_extensions()
        self._verifier_trophees()
        if e["jours_total"] % JOURS_AN == 0:
            self._bilan()
        if e["argent"] < SEUIL_FAILLITE:
            e["faillite"] = True
            self._log("Faillite : la banque ferme le compte.", "mauvais")

    def _placer(self, emp, p):
        """Choisit la pièce où l'employé passe la journée (pour l'animation du plan)."""
        e, r, t = self.etat, self.rng, emp["tache"]
        if emp["absent"]:
            emp["lieu"] = None
            return
        if e.get("fete"):
            lieu = "fete"
        elif e.get("reunion"):
            lieu = "reunion"
        elif t == "e":
            premiere = p and p["etape"] == "travail" and p["phase"] == 0
            lieu = "labo" if not premiere and r.random() < 0.6 else "bureau"
        elif t == "m":
            lieu = "atelier" if "atelier" in e["locaux"] and r.random() < 0.65 else "bureau"
        elif t == "f":
            lieu = "labo" if r.random() < 0.25 else "bureau"
        elif t == "debug":
            lieu = "labo" if r.random() < 0.5 else "bureau"
        elif t == "cem":
            lieu = "pause" if r.random() < 0.3 else "bureau"  # les cartes sont au labo externe
        else:
            lieu = "pause" if r.random() < 0.75 else "bureau"
        emp["visite"] = None
        if t in ("e", "m", "f", "debug") and lieu != "reunion" and r.random() < 0.12:
            # va demander conseil au collègue le plus fort du domaine, sur le même projet
            dom = "f" if t == "debug" else t
            collegues = [x for x in e["employes"] if x is not emp and not x["absent"] and x.get("projet_jour") == emp.get("projet_jour")]
            if collegues:
                expert = max(collegues, key=lambda x: x[dom])
                emp["visite"] = expert["id"]
                if expert[dom] > emp[dom]:
                    self._experience(emp, dom, expert[dom] - emp[dom])  # on apprend en demandant conseil
                emp["lieu"], emp["tache_prec"] = "visite", t
                return
        # inertie : même tâche, on reste souvent au même endroit (déplacements moins frénétiques)
        if emp.get("lieu") not in (None, "reunion", "visite", "fete") and lieu not in ("reunion", "fete") and emp.get("tache_prec") == t and r.random() < 0.6:
            lieu = emp["lieu"]
        emp["lieu"], emp["tache_prec"] = lieu, t

    def _debut_mois(self):
        e = self.etat
        loyer, sal, frais = self.loyer(), self.salaires(), self.frais_structure()
        ventes, frais_stock = self._ventes_du_mois()
        rec, dep, autres, capital = self._mois_extensions()
        self._encaisser(ventes + rec)
        self._depenser(loyer + sal + frais + dep + frais_stock)
        e["argent"] -= capital  # remboursement du capital : sortie de trésorerie, pas une charge
        texte = f"Fin de mois : loyer −{loyer:_} €, salaires −{sal:_} €".replace("_", " ")
        if frais:
            texte += f", frais de structure −{frais:_} €".replace("_", " ")
        if ventes:
            texte += f", ventes +{ventes:_} €".replace("_", " ")
        if frais_stock:
            texte += f", stockage −{frais_stock:_} €".replace("_", " ")
        for m in autres:
            texte += ", " + m
        self._log(texte + ".", "info")
        while len(e["offres"]) < self.nb_offres():
            e["offres"].append(self._offre())
        for _ in range(2):
            if e["candidats"]:
                e["candidats"].pop(0)
        while len(e["candidats"]) < NB_CANDIDATS:
            e["candidats"].append(self._candidat())
        for emp in e["employes"]:
            emp["humeur"] = borne(emp["humeur"] + self.rng.randint(-2, 2), -8, 8)
        self._mois_personnel()
        if e["argent"] < 0:
            self._log("Trésorerie négative ! Sous −5 000 €, c'est la faillite.", "mauvais")

    # ------------------------------------------------------------------ évènements
    def _evenement(self):
        e, r = self.etat, self.rng
        en_travail = [p for p in e["projets"] if p["etape"] == "travail"]
        possibles = []
        if en_travail:
            p = r.choice(en_travail)
            cout = 400 + p["taille"] * 6
            possibles.append({"type": "penurie", "titre": "Pénurie de composants", "projet": p["id"],
                              "texte": f"Le microcontrôleur de « {p['nom']} » est en rupture chez tous les distributeurs.",
                              "options": [f"Acheter chez un broker (−{cout:,} €)".replace(",", " "),
                                          "Re-concevoir avec un équivalent (plus long, plus de défauts)"],
                              "cout": cout})
        presses = [p for p in en_travail if p["type"] == "contrat" and p["delai"] - p["jours"] > 15]
        if presses:
            p = r.choice(presses)
            possibles.append({"type": "presse", "titre": "Client pressé", "projet": p["id"],
                              "texte": f"{p['client']} veut avancer la livraison de « {p['nom']} » de 7 jours, contre 20 % de plus.",
                              "options": ["Accepter le défi", "Refuser poliment"]})
        if e["renommee"] >= 1 and e["argent"] > 5000:
            possibles.append({"type": "salon", "titre": "Salon professionnel",
                              "texte": "Un stand se libère au salon de l'électronique embarquée.",
                              "options": ["Exposer (−3 000 €)", "Ne pas y aller"]})
        cassables = [m for m in self.materiel_actif() if MATERIEL[m]["prix"] >= 1000]
        if cassables:
            mid = r.choice(cassables)
            rep = MATERIEL[mid]["prix"] * 15 // 100
            possibles.append({"type": "panne", "titre": "Panne de matériel",
                              "texte": f"{MATERIEL[mid]['nom']} vient de tomber en panne.",
                              "options": [f"Réparer tout de suite (−{rep:,} €)".replace(",", " "),
                                          "Attendre la pièce (15 jours sans l'appareil)"],
                              "materiel": mid, "cout": rep})
        if e["renommee"] >= 2:
            possibles.append({"type": "subvention", "titre": "Subvention innovation",
                              "texte": "La région finance les PME innovantes. Le dossier est lourd.",
                              "options": ["Monter le dossier (+4 000 €, équipe fatiguée)", "Pas le temps"]})
        mecontents = [x for x in e["employes"] if not x.get("fondateur") and self.moral(x) < 35]
        if mecontents:
            emp = r.choice(mecontents)
            possibles.append({"type": "demission", "titre": "Menace de démission",
                              "texte": f"{emp['nom']} n'en peut plus et pense à partir.",
                              "options": ["Augmenter son salaire (+500 €/mois)", "Le laisser partir"],
                              "employe": emp["id"]})
        if e["heures"] >= 10 and e["employes"][1:]:
            possibles.append({"type": "greve", "titre": "Ras-le-bol général",
                              "texte": f"L'équipe ne supporte plus les journées de {e['heures']} h.",
                              "options": ["Revenir à 8 h par jour", "Tenir bon (moral en baisse)"]})
        if e["stats"]["livres"] >= 2 and r.random() < 0.3:
            possibles.append({"type": "recommandation", "titre": "Bouche-à-oreille",
                              "texte": "Un ancien client vous recommande à son réseau.", "options": ["Merci !"]})
        self._evenements_extensions(possibles)
        self._evenements_personnel(possibles)
        vus = e.setdefault("derniers_ev", {})
        possibles = [x for x in possibles if e["jours_total"] - vus.get(x["type"], -999) >= 60]
        if possibles:
            e["evenement"] = r.choice(possibles)
            vus[e["evenement"]["type"]] = e["jours_total"]

    def _resoudre(self, choix):
        e = self.etat
        ev = e["evenement"]
        if not ev:
            raise ErreurJeu("Aucun évènement en attente.")
        if not 0 <= choix < len(ev["options"]):
            raise ErreurJeu("Choix invalide.")
        t = ev["type"]
        p = next((x for x in e["projets"] if x["id"] == ev.get("projet")), None)
        if self._resoudre_extension(ev, choix) or self._resoudre_personnel(ev, choix):
            pass
        elif t == "penurie" and p:
            if choix == 0:
                self._payer(ev["cout"])
            else:
                ph = p["phases"][p["phase"]]
                ph["besoin"]["e"] = ph["besoin"].get("e", 0) + round(p["taille"] * 0.08)
                ph["fait"].setdefault("e", 0.0)
                p["defauts"] += p["taille"] * 0.03
        elif t == "presse" and p and choix == 0:
            p["delai"] -= 7
            p["paie"] = int(p["paie"] * 1.2)
        elif t == "salon" and choix == 0:
            self._payer(3000)
            e["renommee"] += self._arrondi_hasard(2 * self._frein_renommee())
            e["offres"] = e["offres"][:self.nb_offres()] + [self._offre(bonus_rep=2) for _ in range(2)]
        elif t == "panne":
            if choix == 0:
                self._payer(ev["cout"])
            else:
                e["pannes"][ev["materiel"]] = 15
        elif t == "subvention" and choix == 0:
            self._encaisser(4000)
            for x in e["employes"]:
                x["fatigue"] = min(50, x["fatigue"] + 8)
        elif t == "demission":
            emp = next((x for x in e["employes"] if x["id"] == ev["employe"]), None)
            if emp and choix == 0:
                emp["salaire"] += 500
                emp["humeur"] = 8
            elif emp:
                e["employes"].remove(emp)
                self._log(f"{emp['nom']} a quitté l'équipe.", "mauvais")
        elif t == "greve":
            if choix == 0:
                e["heures"] = 8
            else:
                for x in e["employes"]:
                    x["humeur"] = borne(x["humeur"] - 4, -8, 8)
        elif t == "recommandation":
            e["renommee"] += self._arrondi_hasard(self._frein_renommee())
        e["evenement"] = None
        self._log(f"{ev['titre']} : {ev['options'][choix]}.", "info")

    # ------------------------------------------------------------------ actions du joueur
    def action(self, genre, **p):
        self._roles = None
        try:
            self._action(genre, p)
        finally:
            self._roles = None

    def _action(self, genre, p):
        e = self.etat
        for cle in ("jours", "choix", "heures", "montant"):
            if cle in p and not entier(p[cle]):
                raise ErreurJeu("Paramètres invalides.")
        if "id" in p and not (entier(p["id"]) or isinstance(p["id"], str)):
            raise ErreurJeu("Paramètres invalides.")
        if "projet" in p and not (p["projet"] is None or entier(p["projet"])):
            raise ErreurJeu("Paramètres invalides.")
        if e["faillite"] and genre != "avancer":
            raise ErreurJeu("La société est en faillite.")
        if genre == "avancer":
            self.avancer(p.get("jours", 1))
        elif genre == "evenement":
            self._resoudre(p.get("choix", 0))
        elif genre == "fermer_note":
            e.pop("dernier_livre", None)
        elif genre == "fermer_bilan":
            e.pop("bilan", None)
        elif genre == "fermer_fin":
            if e.get("fin"):
                e["fin"]["vue"] = True
        elif self._action_extension(genre, p) or self._action_personnel(genre, p) or self._action_commerce(genre, p):
            pass
        elif genre == "signer":
            o = next((x for x in e["offres"] if x["id"] == p.get("id")), None)
            if not o:
                raise ErreurJeu("Cette offre n'est plus disponible.")
            self._verifier_capacite(2 if o.get("mega") else 1)
            if len(e["employes"]) < o.get("equipe_min", 0):
                raise ErreurJeu(f"Il faut une équipe d'au moins {o['equipe_min']} personnes pour ce méga-projet.")
            prix, delai = str(p.get("prix", "1.0")), str(p.get("delai", "1.0"))
            if o.get("gagne"):
                prix = delai = "1.0"  # devis déjà accepté : prix et délai fixés
            if prix not in PRIX_PROPOSES or delai not in DELAIS_PROPOSES:
                raise ErreurJeu("Paramètres invalides.")
            tech = dict(p["tech"]) if isinstance(p.get("tech"), dict) else {}
            if o.get("secteur") in EXIGEANTS:
                tech.setdefault("qualif", "carte")  # sans choix explicite, la qualification minimale exigée
            choix = self._choix_valides(tech)
            if o.get("secteur") in EXIGEANTS and choix["qualif"] == "aucune":
                raise ErreurJeu("Ce client exige une qualification (carte ou produit fini).")
            presta = self._presta_valides(p.get("presta"), o, choix)
            base, cout = self._appliquer_choix(o, choix, presta)
            if cout and e["argent"] < cout:
                raise ErreurJeu("Trésorerie insuffisante pour les frais payés à la signature.")
            e["offres"].remove(o)
            if self.rng.random() >= self.chance_negociation(float(prix), float(delai), o.get("fidele", 0)):
                c = self.rng.choice(e["concurrents"])
                e["renommee"] = max(0, e["renommee"] - 1)
                self._log(f"Négociation perdue : {c['nom']} remporte « {o['nom']} ». Le client a mal pris vos exigences (renommée −1).", "mauvais")
                self._verifier_trophees()
                return
            base = {**base, "paie": int(round(o["paie"] * float(prix), -1)), "delai": max(8, round(o["delai"] * float(delai)))}
            if cout:
                self._depenser(cout)
            pr = self._creer_projet(base, "contrat")
            pr["choix"], pr["requis"] = choix, o.get("requis")
            self._confier(pr, presta)
            e["projets"].append(pr)
            e["reunion"] = True
            pr["acompte"] = int(round(pr["paie"] * 0.3, -1))
            self._etapes(pr)
            self._kickoff(pr)
            if self.commerciaux():
                com = int(round(pr["paie"] * COMMISSION * min(3, len(self.commerciaux())), -1))  # chacun touche sa part
                self._depenser(com)
                self._log(f"Commission des commerciaux : −{com:,} €.".replace(",", " "), "info")
            self._encaisser(pr["acompte"])
            self._log(f"Contrat signé avec {o['client']} : « {o['nom']} » (acompte +{pr['acompte']:,} €).".replace(",", " "), "info")
        elif genre == "produit":
            self._verifier_capacite()
            prod = next((x for x in PRODUITS if x["id"] == p.get("id")), None)
            if not prod or e["renommee"] < prod["rep_min"]:
                raise ErreurJeu("Produit indisponible.")
            if prod.get("innovation") and "innov" not in self.roles()["actifs"]:
                raise ErreurJeu("Idée réservée au chargé d'innovation : nommez-le dans Équipe.")
            if prod.get("requis") and prod["requis"] not in e["technos"]:
                raise ErreurJeu(f"Il faut d'abord maîtriser : {TECHNOS[prod['requis']]['nom']}.")
            if prod.get("suite") and prod["suite"] not in e["gammes"]:
                raise ErreurJeu(f"Lancez d'abord « {next(x['nom'] for x in PRODUITS if x['id'] == prod['suite'])} ».")
            if any(x.get("id_produit") == prod["id"] for x in e["produits"] + e["projets"]):
                raise ErreurJeu("Ce produit est déjà en vente ou en développement.")
            choix = self._choix_valides(p.get("tech"))
            total = {d: round(prod["taille"] * part) for d, part in zip(DOMAINES, prod["rep"])}
            base = {"nom": prod["nom"], "taille": sum(total.values()), "total": total,
                    "potentiel": round(prod["potentiel"] * self.bonus_suite(prod)), "id_produit": prod["id"]}
            presta = self._presta_valides(p.get("presta"), base, choix)
            base, cout = self._appliquer_choix(base, choix, presta)
            self._payer(prod["cout"] + cout)
            pr = self._creer_projet(base, "produit")
            pr["choix"] = choix
            self._confier(pr, presta)
            self._etapes(pr)
            self._kickoff(pr)
            e["projets"].append(pr)
            e["reunion"] = True
            self._log(f"Développement de votre produit « {prod['nom']} » lancé.", "info")
        elif genre == "tests_cem":
            pr = self.projet(p.get("id"))
            if pr["etape"] != "debug":
                raise ErreurJeu("Le projet n'est pas en phase de debug.")
            self._lancer_cem(pr)
        elif genre == "abandonner":
            pr = self.projet(p.get("id"))
            if pr["type"] == "contrat":
                e["renommee"] = max(0, e["renommee"] - 1)
                self._encaisser(-pr.get("acompte", 0))  # l'acompte est rendu au client
                if pr.get("client") in e["clients"]:
                    c = e["clients"][pr["client"]]
                    c["fid"] = max(0, c["fid"] - 2)
            e["projets"].remove(pr)
            for x in e["employes"]:
                if x.get("projet") == pr["id"]:
                    x["projet"] = None
            self._log(f"Projet « {pr['nom']} » abandonné.", "mauvais")
        elif genre == "affecter":
            emp = self.employe(p.get("id"))
            cible = p.get("projet")
            if cible is not None:
                self.projet(cible)
            emp["projet"] = cible
        elif genre == "horaires":
            h = p.get("heures")
            if h not in HORAIRES:
                raise ErreurJeu("Horaires inconnus.")
            e["heures"] = h
            self._log(f"Nouveaux horaires : {HORAIRES[h]['nom']}.", "info")
        elif genre == "embaucher":
            c = next((x for x in e["candidats"] if x["id"] == p.get("id")), None)
            if not c:
                raise ErreurJeu("Candidat introuvable.")
            libres = self.bureaux_libres()
            if not libres:
                raise ErreurJeu("Plus de bureau libre : achetez-en un dans Locaux.")
            e["candidats"].remove(c)
            self._nouvel_employe(c, libres[0])
            self._log(f"{c['nom']} rejoint l'équipe ({c['poste']}).", "bon")
        elif genre == "licencier":
            emp = self.employe(p.get("id"))
            if emp.get("fondateur"):
                raise ErreurJeu("Vous ne pouvez pas vous licencier vous-même.")
            self._payer(emp["salaire"])
            e["employes"].remove(emp)
            self._log(f"{emp['nom']} quitte la société (indemnité −{emp['salaire']:,} €).".replace(",", " "), "info")
        elif genre == "former":
            emp = self.employe(p.get("id"))
            d = p.get("dom")
            if d not in DOMAINES:
                raise ErreurJeu("Domaine inconnu.")
            if emp["absent"]:
                raise ErreurJeu(f"{emp['nom']} est déjà absent.")
            self._payer(self.cout_formation(emp))
            emp["absent"], emp["formation"], emp["absence"] = DUREE_FORMATION, d, "formation"
            emp["derniere_formation"] = e["jours_total"]
            self._log(f"{emp['nom']} part {DUREE_FORMATION} jours en formation {NOM_DOMAINE[d]}.", "info")
        elif genre == "conges":
            emp = self.employe(p.get("id"))
            if emp["absent"]:
                raise ErreurJeu(f"{emp['nom']} est déjà absent.")
            emp["absent"], emp["absence"] = DUREE_CONGES, "conges"
            self._log(f"{emp['nom']} part {DUREE_CONGES} jours en congés.", "info")
        elif genre in ("acheter", "deco", "poser"):
            ident = p.get("id")
            if genre == "acheter" and ident not in MATERIEL:
                raise ErreurJeu("Matériel indisponible.")
            if DECO.get(ident, {}).get("global"):
                if ident in e["deco"]:
                    raise ErreurJeu("Déjà installé.")
                self._payer(DECO[ident]["prix"])
                e["deco"].append(ident)
                self._log(f"{DECO[ident]['nom']} installé.", "bon")
            else:
                self._poser(ident, p.get("x"), p.get("y"))
        elif genre == "deplacer":
            o = self.objet(p.get("id"))
            x, y = p.get("x"), p.get("y")
            if entier(x) and entier(y):
                x, y = round(x / GRILLE) * GRILLE, round(y / GRILLE) * GRILLE
            self._verifier_place(o["type"], x, y, ignorer=o["id"])
            o["x"], o["y"] = x, y
        elif genre == "vendre":
            o = self.objet(p.get("id"))
            if o["type"] == "poste":
                if any(x["bureau"] == o["id"] for x in e["employes"]):
                    raise ErreurJeu("Ce bureau est occupé.")
            f = self.fiche(o["type"])
            e["objets"].remove(o)
            if o["type"] in MATERIEL:
                e["materiel"].remove(o["type"])
                e["pannes"].pop(o["type"], None)
            elif not any(x["type"] == o["type"] for x in e["objets"]):
                e["deco"].remove(o["type"])
            reprise = f["prix"] // 2
            self._encaisser(reprise)
            self._log(f"{f['nom']} revendu (+{reprise:,} €).".replace(",", " "), "info")
        elif genre == "local":
            lid = p.get("id")
            l = LOCAUX.get(lid)
            if not l or lid in e["locaux"]:
                raise ErreurJeu("Local indisponible.")
            if e["renommee"] < l["rep"]:
                raise ErreurJeu(f"Renommée {l['rep']} requise.")
            self._payer(l["prix"])
            e["locaux"].append(lid)
            self._replacer_objets()  # déménagement : tout le garage part dans le bâtiment
            e["stock_max"] += STOCK_BATIMENT - STOCK_GARAGE  # la zone de stock du RDC
            self._log(f"{l['nom']} : c'est fait ! Loyer +{l['loyer']} €/mois.", "bon")
        else:
            raise ErreurJeu(f"Action inconnue : {genre}")
        self._verifier_trophees()

    def cout_formation(self, emp):
        return int((1200 + 150 * (emp["e"] + emp["m"] + emp["f"])) * (0.5 if self.a_investi("formation") else 1))

    # ------------------------------------------------------------------ vue pour l'interface
    def vue(self):
        e = self.etat
        self._roles = None
        v = dict(e)
        v["date"] = f"{e['jour']} {MOIS[e['mois']]} {e['annee'] % 100:02d}"
        v["moral"] = round(self.moral_global())
        v["bonus"] = self.bonus()
        v["loyer"] = self.loyer()
        v["salaires"] = self.salaires()
        v["frais_structure"] = self.frais_structure()
        v["postes_ouverts"] = self.postes_ouverts()
        v["capacite"] = self.capacite_projets()
        v["places"] = self.places_occupees()
        v["annee_jeu"] = e["jours_total"] // JOURS_AN + 1
        v["attente_client"] = round(self.attente_client(), 1)
        r = self.roles()
        v["employes"] = [{**x, "moral": round(self.moral(x)), "cout_formation": self.cout_formation(x),
                          "efficacite": round(100 * self.efficacite(x)), "service": self.service(x),
                          "facteur_service": round(self.facteur_service(x), 3), "piece": r["pieces"].get(x["id"]),
                          "role_actif": r["actifs"].get(x.get("role")) == x["id"]} for x in e["employes"]]
        v["services"] = {d: {"n": r["taille"][d], "resp": r["actifs"].get(f"resp_{d}")} for d in DOMAINES}
        v["roles_actifs"] = r["actifs"]
        v["conditions"], v["facteur_conditions"] = self.conditions()
        v["projets"] = [{**p, "note_estimee": self.note(p), "proba_cem": self.proba_cem(p), "frais_cem": self.frais_cem(p)}
                        for p in e["projets"]]
        return self.vue_commerce(self.vue_personnel(self.vue_extensions(v)))
