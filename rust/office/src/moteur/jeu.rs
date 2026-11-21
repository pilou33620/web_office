//! Le cœur du moteur (moteur/jeu.py) : création, plan et rangement des meubles, rôles, production, projets,
//! journées, évènements, actions du joueur et vue pour l'interface.

use std::cell::RefCell;
use std::collections::{BTreeSet, HashSet};

use super::{arrondi, arrondi_entier, borne, bornef, champ, d, entier, erreur, mil, r4, requis_liste, tronquer, vmax, vmin, ErreurJeu, R};
use crate::py::{self, Random, Val};
use crate::{dict, list};

pub const JOURS_MOIS: i64 = 30;
pub const SEUIL_FAILLITE: i64 = -5000;
pub const NB_OFFRES: i64 = 3;
const PAIE_REP: f64 = 0.01; // prix du point : +1 % par point de renommée (20 au plus)
const PRIX_GROS: (f64, f64) = (150.0, 600.0); // au-delà de 150 points, le client négocie le prix du point : ÷ (1 + (taille − 150) / 600)
const ATTENTE_REP: (f64, i64) = (10.0, 3); // note attendue : 6 + renommée / 10, +3 au plus
const TAILLE_REP: (f64, i64) = (0.05, 12); // les contrats grossissent avec la renommée : +5 % par point au-dessus du minimum, 12 points au plus
const DELAI_BASE: f64 = 14.0;
const DELAI_REP: (f64, i64, i64) = (0.3, 3, 8); // délai client = (base + jours par point) / (1 + 0,3 × renommée au-delà de 3, 8 points au plus)
pub const NB_CANDIDATS: usize = 4;
const DUREE_CEM: i64 = 3;
const DUREE_FORMATION: i64 = 10;
const DUREE_CONGES: i64 = 5;
pub const VERSION_PLAN: i64 = 10; // à augmenter quand le plan ou le rangement change : les parties sont rangées à nouveau
const PLAN_MINIMUM: i64 = 7; // plan avec cloisons et portes : les parties plus anciennes ne sont pas reprises
const POSTE_W: i64 = 76;
const POSTE_H: i64 = 64;
const DECOR_SANS_ACCES: [&str; 7] = ["plantes", "ficus", "lampe", "tableau", "tapis", "poster", "clim"]; // on n'a pas besoin de marcher jusque-là
const VENTES: f64 = 0.25; // ventes du 1er mois d'un produit = VENTES × potentiel × (note/10)² × (1 + renommée/25), puis −10 % par mois
const NOM_MAX: usize = 30;

/// Nom saisi par le joueur : espaces resserrés, défaut si vide, refusé si trop long ou avec caractères de contrôle.
pub fn nom_propre(v: &Val, defaut: &str) -> R<String> {
    if v.is_none() {
        return Ok(defaut.into());
    }
    let Val::Str(s) = v else { return erreur("Nom invalide.") };
    if s.chars().any(|c| (c as u32) < 32 || c as u32 == 127) {
        return erreur("Nom invalide.");
    }
    let t = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if t.chars().count() > NOM_MAX {
        return erreur(format!("Nom trop long ({NOM_MAX} caractères au plus)."));
    }
    Ok(if t.is_empty() { defaut.into() } else { t })
}

/// Une pièce du plan, un objet ou une place : (x, y, côté du mur).
pub type Place = (i64, i64, String);

pub struct Jeu {
    pub etat: Val,
    pub rng: RefCell<Random>,
    /// Rôles et services, recalculés à chaque jour et à chaque action (`_roles` du Python).
    roles_cache: RefCell<Val>,
}

impl Jeu {
    /// `Jeu(graine=…, scenario=…, difficulte=…, entreprise=…, directeur=…)` : une partie neuve.
    pub fn nouveau(graine: Option<i64>, scenario: &Val, difficulte: &Val, entreprise: &Val, directeur: &Val) -> R<Jeu> {
        let j = Jeu::vide(graine, Val::dict());
        let entreprise = nom_propre(entreprise, "Mon bureau d'études")?;
        let directeur = nom_propre(directeur, "Vous")?;
        j.nouvel_etat(&entreprise, &directeur)?;
        j.init_extensions(scenario, difficulte)?;
        j.appliquer_scenario()?;
        Ok(j)
    }

    /// `Jeu(etat)` : une partie relue (le dict est gardé tel quel et complété).
    pub fn charger(etat: Val, graine: Option<i64>) -> R<Jeu> {
        let j = Jeu::vide(graine, etat);
        j.migrer()?;
        j.init_extensions(&Val::str("garage"), &Val::str("normal"))?;
        Ok(j)
    }

    /// `Jeu(graine=n)` : une partie neuve au garage, en difficulté normale.
    pub fn graine(n: i64) -> Jeu {
        Jeu::nouveau(Some(n), &Val::str("garage"), &Val::str("normal"), &Val::None, &Val::None).expect("partie neuve")
    }

    fn vide(graine: Option<i64>, etat: Val) -> Jeu {
        let graine = graine.unwrap_or_else(py::graine_hasard);
        Jeu { etat, rng: RefCell::new(Random::new(graine)), roles_cache: RefCell::new(Val::None) }
    }

    // -- hasard (self.rng du Python)
    pub fn random(&self) -> f64 {
        self.rng.borrow_mut().random()
    }
    pub fn uniform(&self, a: f64, b: f64) -> f64 {
        self.rng.borrow_mut().uniform(a, b)
    }
    pub fn randint(&self, a: i64, b: i64) -> i64 {
        self.rng.borrow_mut().randint(a, b)
    }
    /// `rng.choice(seq)` (les clés d'un dict pour `choice(list(d))`).
    pub fn choice(&self, seq: &Val) -> Val {
        let v = seq.vec();
        let i = self.rng.borrow_mut().choice_i(v.len());
        v[i].clone()
    }
    /// `rng.choices(population, weights=poids)[0]`.
    pub fn choices(&self, population: &[Val], poids: &[f64]) -> Val {
        let i = self.rng.borrow_mut().choix_pondere(poids);
        population[i].clone()
    }
    /// `rng.sample(population, k)`.
    pub fn sample(&self, population: &Val, k: usize) -> Val {
        let v = population.vec();
        let rangs = self.rng.borrow_mut().sample_i(v.len(), k);
        Val::list(rangs.into_iter().map(|i| v[i].clone()).collect())
    }
    /// `self._roles = None`.
    pub fn oublier_roles(&self) {
        *self.roles_cache.borrow_mut() = Val::None;
    }

    // ------------------------------------------------------------------ création
    fn nouvel_etat(&self, entreprise: &str, directeur: &str) -> R {
        let e = &self.etat;
        e.update(&dict! {
            "version" => 3, "entreprise" => entreprise, "jour" => 1, "mois" => 8, "annee" => 2026, "jours_total" => 0,
            "argent" => 15000, "renommee" => 0, "prochain_id" => 1, "heures" => 8,
            "locaux" => list![], "materiel" => d("MATERIEL_DEPART").copy(), "deco" => list![], "pannes" => dict! {},
            "employes" => list![], "candidats" => list![], "offres" => list![], "projets" => list![], "produits" => list![],
            "evenement" => Val::None, "journal" => list![], "historique" => list![], "faillite" => false,
            "stats" => dict! {"livres" => 0, "ca" => 0, "produits_lances" => 0},
            "trophees" => list![], "bilans" => list![], "combos_vus" => list![], "objets" => list![], "version_plan" => VERSION_PLAN,
        });
        e.set("exercice", self.exercice_vide());
        for mid in d("MATERIEL_DEPART").iter() {
            // sur l'établi du garage
            let (x, y, c) = self.place_auto(&mid, None, &Val::None)?;
            self.ajouter_objet(&mid, x, y, &c);
        }
        let mut bureaux = Vec::new();
        for _ in 0..2 {
            let (x, y, c) = self.place_auto(&Val::str("poste"), None, &Val::None)?;
            bureaux.push(self.ajouter_objet(&Val::str("poste"), x, y, &c).at("id"));
        }
        let id = self.id();
        e.at("employes").push(dict! {
            "id" => id, "nom" => directeur, "poste" => "Fondateur · ingé élec", "e" => 5, "m" => 2, "f" => 4,
            "trait" => "endurant", "salaire" => 0, "couleur" => "#ffc94d", "cheveux" => "#5a3a22", "peau" => "#f6cfa6",
            "xp" => dict! {"e" => 0, "m" => 0, "f" => 0}, "fatigue" => 0, "humeur" => 3, "absent" => 0, "formation" => Val::None,
            "bureau" => bureaux[0].clone(), "fondateur" => true, "tache" => Val::None, "gain" => 0, "projet" => Val::None,
        });
        self.completer_personnel(&e.at("employes").at(0));
        for _ in 0..NB_CANDIDATS {
            let c = self.candidat();
            e.at("candidats").push(c);
        }
        for _ in 0..NB_OFFRES {
            let o = self.offre(0, &Val::None);
            e.at("offres").push(o);
        }
        self.log(&format!("{entreprise} ouvre ses portes ! Vous êtes seul dans votre garage : signez un premier contrat dans Projets."), "info");
        Ok(())
    }

    /// Complète une sauvegarde récente ; les parties d'avant le plan avec cloisons et portes ne sont pas reprises.
    fn migrer(&self) -> R {
        let e = &self.etat;
        if e.get_or("version_plan", 0) < PLAN_MINIMUM {
            return erreur("Partie d'avant le nouveau plan du bâtiment : elle n'est pas reprise, commencez une nouvelle partie.");
        }
        if !e.has("projets") {
            let p = e.pop("projet");
            e.set("projets", list![]);
            if p.truthy() {
                p.set("id", self.id());
                e.at("projets").push(p);
            }
        }
        e.setdefault("heures", 8);
        e.setdefault("trophees", list![]);
        e.setdefault("bilans", list![]);
        e.setdefault("combos_vus", list![]);
        e.setdefault("entreprise", "Votre bureau");
        if !e.has("exercice") {
            e.set("exercice", self.exercice_vide());
        }
        for p in e.at("projets").iter() {
            p.setdefault("combos", dict! {});
            p.setdefault("combos_jour", list![]);
            p.setdefault("equipe", list![]);
        }
        for x in e.at("employes").iter() {
            x.setdefault("projet", Val::None);
        }
        if e.get("version_plan") != VERSION_PLAN {
            // nouveau rangement : tout est replacé automatiquement
            self.replacer_objets()?;
            e.set("version_plan", VERSION_PLAN);
        }
        e.set("version", 3);
        Ok(())
    }

    pub fn exercice_vide(&self) -> Val {
        dict! {"ca" => 0, "charges" => 0, "livres" => 0, "notes" => list![], "rep0" => self.etat.get_or("renommee", 0)}
    }

    pub fn id(&self) -> i64 {
        let e = &self.etat;
        let n = e.ati("prochain_id");
        e.set("prochain_id", n + 1);
        n
    }

    pub fn offre(&self, bonus_rep: i64, secteur: &Val) -> Val {
        let e = &self.etat;
        let rep = e.ati("renommee") + bonus_rep;
        let mut acquis = e.get_or("technos", list![]).vec();
        acquis.extend(e.get_or("certifs", list![]).vec());
        let mut eligibles: Vec<Val> = d("CONTRATS")
            .iter()
            .filter(|c| c.ati(3) <= rep && requis_liste(&c.at(4)).iter().all(|r| acquis.contains(r)))
            .collect();
        let fidele = if secteur.truthy() { Val::None } else { self.client_fidele() };
        let mut fid = Val::Int(0);
        let mut nom_client = Val::None;
        if fidele.truthy() {
            // un client fidèle revient avec un projet de son secteur, plus gros et mieux payé
            let (nom, fiche) = fidele.pair();
            nom_client = nom;
            let pool: Vec<Val> = eligibles.iter().filter(|c| c.at(5) == fiche.at("secteur")).cloned().collect();
            if !pool.is_empty() {
                eligibles = pool;
                fid = fiche.at("fid");
            }
        }
        if secteur.truthy() {
            // démarchage d'un secteur choisi
            let du_secteur: Vec<Val> = eligibles.iter().filter(|c| c.at(5) == *secteur).cloned().collect();
            if !du_secteur.is_empty() {
                eligibles = du_secteur;
            }
        }
        let poids: Vec<f64> = (1..=eligibles.len()).map(|i| i as f64).collect();
        let c = self.choices(&eligibles, &poids);
        let (nom, mix, base, rmin, requis, secteur) = (c.at(0), c.at(1), c.at(2), c.at(3), c.at(4), c.at(5));
        let fidf = fid.f();
        let client = if fid.truthy() { nom_client } else { self.choice(&d("SECTEURS").at(&secteur).at("clients")) };
        let grossi = 1.0 + TAILLE_REP.0 * TAILLE_REP.1.min(0i64.max(rep - rmin.i())) as f64;
        let taille = py::round(base.f() * grossi * self.uniform(0.85, 1.2) * (1.0 + 0.08 * fidf));
        let total = Val::dict();
        for (dom, part) in d("DOMAINES").iter().zip(mix.iter()) {
            total.set(&dom, py::round(taille as f64 * part.f()));
        }
        let taille: i64 = total.values().iter().map(Val::i).sum();
        let tf = taille as f64;
        let id = self.id();
        let paie = arrondi_entier(
            tf * self.uniform(68.0, 82.0) / (1.0 + 0f64.max(tf - PRIX_GROS.0) / PRIX_GROS.1)
                * (1.0 + PAIE_REP * rep.min(20) as f64)
                * (1.0 + 0.03 * fidf)
                * (1.0 + 0.015 * 10i64.min(self.meilleur_metier("commercial")) as f64)
                * (1.0 + d("PRIME_COMMERCIAL").f() * 3usize.min(self.commerciaux().len()) as f64),
            2,
        );
        let delai = 12i64.max(py::round(
            (DELAI_BASE + tf * (0.5 - 0.3f64.min(tf / 1500.0))) / (1.0 + DELAI_REP.0 * (0i64.max(rep - DELAI_REP.1)).min(DELAI_REP.2) as f64),
        ));
        let expire = self.randint(18, 40) + if fid.truthy() { 15 } else { 0 };
        dict! {
            "id" => id, "nom" => nom, "client" => client, "taille" => taille, "total" => total,
            "paie" => paie, "delai" => delai, "gain" => 1 + py::floordiv_i(taille, 200), "expire" => expire,
            "requis" => if requis.is_list() { requis.copy() } else { requis }, "secteur" => secteur, "fidele" => fid,
        }
    }

    // ------------------------------------------------------------------ calculs
    pub fn log(&self, texte: &str, genre: &str) {
        let e = &self.etat;
        let date = format!("{} {}", e.at("jour"), d("MOIS").at(e.at("mois")));
        let journal = e.at("journal");
        journal.insert(0, dict! {"date" => date, "texte" => texte, "genre" => genre});
        tronquer(&journal, 40);
    }

    pub fn employe(&self, eid: &Val) -> R<Val> {
        match self.etat.at("employes").iter().find(|x| x.at("id") == *eid) {
            Some(x) => Ok(x),
            None => erreur("Employé introuvable."),
        }
    }

    pub fn projet(&self, pid: &Val) -> R<Val> {
        let projets = self.etat.at("projets");
        if pid.is_none() && projets.len() == 1 {
            return Ok(projets.at(0));
        }
        match projets.iter().find(|p| p.at("id") == *pid) {
            Some(p) => Ok(p),
            None => erreur("Projet introuvable."),
        }
    }

    pub fn postes_ouverts(&self) -> Vec<Val> {
        self.etat.at("objets").iter().filter(|o| o.at("type") == "poste").map(|o| o.at("id")).collect()
    }

    pub fn bureaux_libres(&self) -> Vec<Val> {
        let pris: Vec<Val> = self.etat.at("employes").iter().map(|x| x.at("bureau")).collect();
        self.postes_ouverts().into_iter().filter(|b| !pris.contains(b)).collect()
    }

    /// Embauche : le candidat devient employé (`modifs` : ce qui change, pour un stagiaire).
    pub fn nouvel_employe(&self, candidat: &Val, bureau: &Val, modifs: &Val) -> Val {
        let emp = candidat.copy();
        emp.update(&dict! {
            "xp" => dict! {"e" => 0, "m" => 0, "f" => 0}, "fatigue" => 0, "humeur" => 0, "absent" => 0, "formation" => Val::None,
            "bureau" => bureau, "fondateur" => false, "tache" => Val::None, "gain" => 0, "projet" => Val::None,
        });
        emp.update(modifs);
        self.completer_employe(&emp);
        self.etat.at("employes").push(emp.clone());
        self.arrivee(&emp);
        // chef d'équipe embauché comme tel ; chef de projet et commercial rejoignent leur bureau
        let role = emp.pop("role_propose");
        if role.truthy() && !self.etat.at("employes").iter().any(|x| x.get("role") == role) {
            emp.set("role", role);
            if self.installer(&emp, "res").is_err() {
                self.log(&format!("{} attend un bureau de responsable libre pour encadrer son service.", emp.at("nom")), "info");
            }
        }
        if emp.getb("chef") {
            self.installer_fonction(&emp, "cdp");
        }
        if emp.getb("commercial") {
            self.installer_fonction(&emp, "commerciaux");
        }
        emp
    }

    /// Déplace si possible le bureau de l'employé dans la pièce de sa fonction (sinon il reste où il est).
    pub fn installer_fonction(&self, emp: &Val, fonction: &str) {
        let o = self.etat.at("objets").iter().find(|x| x.at("id") == emp.get("bureau"));
        let pieces: Vec<String> = d("PIECES").items().into_iter().filter(|(_, pc)| pc.get("fonction") == fonction).map(|(k, _)| k.string()).collect();
        let Some(o) = o else { return };
        if self.carte() != "batiment" || self.piece_de(&o).is_some_and(|k| pieces.contains(&k)) {
            return;
        }
        if let Ok((x, y, c)) = self.place_auto(&Val::str("poste"), Some(pieces), &o.at("id")) {
            o.set("x", x);
            o.set("y", y);
            o.set("cote", c);
            self.oublier_roles();
        }
    }

    // ------------------------------------------------------------------ aménagement libre
    pub fn fiche(genre: &Val) -> R<Val> {
        if *genre == "poste" {
            return Ok(d("POSTE"));
        }
        let f = d("MATERIEL").get(genre).or_else(|| d("DECO").get(genre));
        if !f.truthy() || f.getb("global") {
            return erreur("Objet inconnu.");
        }
        Ok(f)
    }

    /// Le garage du fondateur, puis le bâtiment une fois le local « bureau » loué (déménagement).
    pub fn carte(&self) -> &'static str {
        if self.etat.at("locaux").has("bureau") {
            "batiment"
        } else {
            "garage"
        }
    }

    pub fn pieces_dispo(&self) -> Vec<String> {
        let c = self.carte();
        let locaux = self.etat.at("locaux");
        d("PIECES")
            .items()
            .into_iter()
            .filter(|(_, p)| p.at("carte") == c && (p.at("local").is_none() || locaux.has(&p.at("local"))))
            .map(|(k, _)| k.string())
            .collect()
    }

    /// Largeur et profondeur sur le plan : le long côté d'un meuble suit le mur auquel il est adossé.
    pub fn emprise(genre: &Val, cote: &str) -> R<(i64, i64)> {
        let f = Jeu::fiche(genre)?;
        Ok(if cote == "o" || cote == "e" { (f.ati("h"), f.ati("w")) } else { (f.ati("w"), f.ati("h")) })
    }

    /// Place réelle d'un objet ; un bureau occupe un peu moins que son emplacement.
    pub fn rect(o: &Val) -> R<(i64, i64, i64, i64)> {
        let c = o.get_or("cote", "n").string();
        let (w, h) = Jeu::emprise(&o.at("type"), &c)?;
        let (x, y) = (o.ati("x"), o.ati("y"));
        if o.at("type") != "poste" {
            return Ok((x, y, w, h));
        }
        Ok(match c.as_str() {
            "n" => (x + 7, y, 62, 58),
            "s" => (x + 7, y + 6, 62, 58),
            "o" => (x, y + 7, 58, 62),
            "e" => (x + 6, y + 7, 58, 62),
            _ => panic!("KeyError: {c}"),
        })
    }

    /// Mur le plus proche de l'endroit visé, et place collée à ce mur s'il est tout près : (x, y, cote).
    pub fn cote_pres(&self, genre: &Val, x: i64, y: i64) -> R<Place> {
        let f = Jeu::fiche(genre)?;
        if *genre == "poste" {
            let c = d("COTE_POSTES").get(Val::tuple(vec![Val::Int(x), Val::Int(y)]));
            if c.is_some() {
                return Ok((x, y, c.string()));
            }
        }
        if f.getb("libre") && *genre != "tableau" {
            return Ok((x, y, "n".into()));
        }
        let (cx, cy) = (x as f64 + f.atf("w") / 2.0, y as f64 + f.atf("h") / 2.0);
        let carte = self.carte();
        let piece = d("PIECES").values().into_iter().find(|p| {
            let (rx, ry, rw, rh) = r4(&p.at("rect"));
            p.at("carte") == carte && rx as f64 <= cx && cx < (rx + rw) as f64 && ry as f64 <= cy && cy < (ry + rh) as f64
        });
        let Some(piece) = piece else { return Ok((x, y, "n".into())) };
        let (px, py, pw, ph) = r4(&piece.at("rect"));
        let dist = [("n", cy - py as f64), ("s", (py + ph) as f64 - cy), ("o", cx - px as f64), ("e", (px + pw) as f64 - cx)];
        let c = py::min_by_key(dist, |t| t.1).unwrap().0;
        let (w, h) = Jeu::emprise(genre, c)?;
        // il pivote autour de son milieu
        let (mut x, mut y) = (py::int(cx - w as f64 / 2.0), py::int(cy - h as f64 / 2.0));
        if c == "n" && y - py <= 24 {
            y = py + 1;
        } else if c == "s" && py + ph - y - h <= 24 {
            y = py + ph - h - 1;
        } else if c == "o" && x - px <= 24 {
            x = px + 1;
        } else if c == "e" && px + pw - x - w <= 24 {
            x = px + pw - w - 1;
        }
        Ok((x, y, c.into()))
    }

    /// Depuis les portes de la pièce, peut-on encore atteindre chaque meuble à pied ? (grille de 6, meubles gonflés de 9)
    pub fn accessible(&self, k: &str, autres: &[Val], nouveau: Option<&Val>) -> R<bool> {
        let portes = d("PORTES").at(k);
        if !portes.truthy() {
            return Ok(true);
        }
        let (px, py, pw, ph) = r4(&d("PIECES").at(k).at("rect"));
        let c = 6i64;
        let (nx, ny) = (pw / 6 + 1, ph / 6 + 1);
        let mut libre = vec![true; (nx * ny) as usize];
        let mut objets: Vec<Val> = autres.to_vec();
        if let Some(n) = nouveau {
            objets.push(n.clone());
        }
        let carte = self.carte();
        let mut rects = Vec::new();
        for o in &objets {
            rects.push(Jeu::rect(o)?);
        }
        for r in d("OBSTACLES").at(carte).iter().chain(d("ETABLIS").at(carte).iter()) {
            let r = r4(&r);
            if px < r.0 + r.2 && r.0 < px + pw && py < r.1 + r.3 && r.1 < py + ph {
                rects.push(r);
            }
        }
        let fd = py::floordiv_i;
        for (x, y, w, h) in rects {
            for j in 0i64.max(fd(y - 9 - py, c))..ny.min(fd(y + h + 9 - py, c) + 1) {
                for i in 0i64.max(fd(x - 9 - px, c))..nx.min(fd(x + w + 9 - px, c) + 1) {
                    libre[(j * nx + i) as usize] = false;
                }
            }
        }
        let mut vu: HashSet<i64> = HashSet::new();
        let mut pile: Vec<i64> = Vec::new();
        for porte in portes.iter() {
            let (x, y, w, h) = r4(&porte);
            for j in 0i64.max(fd(y - py, c))..ny.min(fd(y + h - py, c) + 1) {
                for i in 0i64.max(fd(x - px, c))..nx.min(fd(x + w - px, c) + 1) {
                    let q = j * nx + i;
                    if libre[q as usize] && !vu.contains(&q) {
                        vu.insert(q);
                        pile.push(q);
                    }
                }
            }
        }
        while let Some(p) = pile.pop() {
            let i = p % nx;
            for q in [p - nx, p + nx, if i != 0 { p - 1 } else { -1 }, if i < nx - 1 { p + 1 } else { -1 }] {
                if 0 <= q && q < nx * ny && libre[q as usize] && !vu.contains(&q) {
                    vu.insert(q);
                    pile.push(q);
                }
            }
        }
        let etablis: Vec<(i64, i64, i64, i64)> = d("ETABLIS").at(carte).iter().map(|r| r4(&r)).collect();
        for o in &objets {
            let (x, y, w, h) = Jeu::rect(o)?;
            let t = o.at("type");
            if DECOR_SANS_ACCES.iter().any(|s| t == *s) || etablis.iter().any(|&(ex, ey, ew, eh)| ex <= x && ey <= y && x + w <= ex + ew && y + h <= ey + eh) {
                continue; // posé sur un établi : on l'atteint depuis l'établi
            }
            let cote = o.get_or("cote", "n");
            let (xf, yf, wf, hf) = (x as f64, y as f64, w as f64, h as f64);
            let (ax, ay) = if cote == "n" {
                (xf + wf / 2.0, yf + hf + 15.0)
            } else if cote == "s" {
                (xf + wf / 2.0, yf - 15.0)
            } else if cote == "o" {
                (xf + wf + 15.0, yf + hf / 2.0)
            } else {
                (xf - 15.0, yf + hf / 2.0)
            };
            let (j, i) = (py::floordiv_f(ay - py as f64, c as f64) as i64, py::floordiv_f(ax - px as f64, c as f64) as i64);
            if 0 <= j && j < ny && 0 <= i && i < nx && !vu.contains(&(j * nx + i)) {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Pour le rangement automatique : écarté des autres meubles (ecart), portes dégagées, tout reste accessible ;
    /// les emplacements de bureau encore vides de la pièce comptent comme occupés : un meuble ne vient pas les coincer.
    pub fn place_stricte(&self, genre: &Val, x: i64, y: i64, cote: &str, k: &str, ignorer: &Val, ecart: bool) -> R<bool> {
        let o = dict! {"type" => genre, "x" => x, "y" => y, "cote" => cote};
        let r = Jeu::rect(&o)?;
        let croise = |q: (i64, i64, i64, i64), m: i64| r.0 < q.0 + q.2 + m && q.0 < r.0 + r.2 + m && r.1 < q.1 + q.3 + m && q.1 < r.1 + r.3 + m;
        if d("PORTES").at(k).iter().any(|q| croise(r4(&q), 0)) {
            return Ok(false);
        }
        let (px, py, pw, ph) = r4(&d("PIECES").at(k).at("rect"));
        let dedans = |q: (i64, i64, i64, i64)| px < q.0 + q.2 && q.0 < px + pw && py < q.1 + q.3 && q.1 < py + ph;
        let m = if ecart { d("ECART_MEUBLES").i() } else { 0 };
        let carte = self.carte();
        if d("OBSTACLES").at(carte).iter().chain(d("ETABLIS").at(carte).iter()).any(|q| dedans(r4(&q)) && croise(r4(&q), m)) {
            return Ok(false);
        }
        let mut autres = Vec::new();
        for a in self.etat.at("objets").iter() {
            if a.get("id") == *ignorer {
                continue;
            }
            if Jeu::fiche(&a.at("type"))?.getb("libre") && a.at("type") != "tableau" {
                continue;
            }
            if dedans(Jeu::rect(&a)?) {
                autres.push(a);
            }
        }
        if *genre != "poste" {
            let pris: Vec<(i64, i64)> = autres.iter().filter(|a| a.at("type") == "poste").map(|a| (a.ati("x"), a.ati("y"))).collect();
            for p in d("EMPLACEMENTS").at("poste").iter() {
                let (x2, y2) = (p.ati(0), p.ati(1));
                if !pris.contains(&(x2, y2)) && px <= x2 && x2 < px + pw && py <= y2 && y2 < py + ph {
                    let c = d("COTE_POSTES").at(Val::tuple(vec![Val::Int(x2), Val::Int(y2)]));
                    autres.push(dict! {"type" => "poste", "x" => x2, "y" => y2, "cote" => c});
                }
            }
        }
        for a in &autres {
            if croise(Jeu::rect(a)?, m) {
                return Ok(false);
            }
        }
        self.accessible(k, &autres, Some(&o))
    }

    /// Renvoie la pièce où l'objet tient entièrement ; refuse les chevauchements.
    pub fn verifier_place(&self, genre: &Val, x: i64, y: i64, ignorer: &Val, cote: &str) -> R<String> {
        let f = Jeu::fiche(genre)?;
        let (w, h) = Jeu::emprise(genre, cote)?;
        let (dispo, carte) = (self.pieces_dispo(), self.carte());
        let pieces = d("PIECES");
        let dedans: Vec<String> = f
            .at("pieces")
            .iter()
            .filter(|k| {
                let (rx, ry, rw, rh) = r4(&pieces.at(k).at("rect"));
                rx <= x && ry <= y && x + w <= rx + rw && y + h <= ry + rh
            })
            .map(|k| k.string())
            .collect();
        let Some(piece) = dedans.iter().find(|k| dispo.contains(k)).cloned() else {
            let fermee = dedans.iter().find(|k| pieces.at(k.as_str()).at("carte") == carte && pieces.at(k.as_str()).at("local").truthy());
            if let Some(fermee) = fermee {
                let local = pieces.at(fermee.as_str()).at("local");
                return erreur(format!("Il faut d'abord louer : {}.", d("LOCAUX").at(&local).at("nom")));
            }
            let noms: Vec<String> = f.at("pieces").iter().filter(|k| pieces.at(k).at("carte") == carte).map(|k| pieces.at(&k).ats("nom")).collect();
            return erreur(if noms.is_empty() {
                format!("{} : il faut d'abord emménager dans le bâtiment.", f.at("nom"))
            } else {
                format!("{} : à placer entièrement dans {}.", f.at("nom"), noms.join(", "))
            });
        };
        if f.getb("libre") {
            return Ok(piece);
        }
        let chevauche = |r: &Val| {
            let (ex, ey, ew, eh) = r4(r);
            x < ex + ew && ex < x + w && y < ey + eh && ey < y + h
        };
        if d("OBSTACLES").at(carte).iter().any(|r| chevauche(&r)) {
            return erreur("La place est prise par du mobilier fixe.");
        }
        if !d("MATERIEL").has(genre) && d("ETABLIS").at(carte).iter().any(|r| chevauche(&r)) {
            return erreur("Pas sur l'établi : seul le petit matériel peut y être posé.");
        }
        for o in self.etat.at("objets").iter() {
            if o.at("id") == *ignorer {
                continue;
            }
            if Jeu::fiche(&o.at("type"))?.getb("libre") {
                continue;
            }
            let (gw, gh) = Jeu::emprise(&o.at("type"), o.get_or("cote", "n").s())?;
            let (ox, oy) = (o.ati("x"), o.ati("y"));
            if x < ox + gw && ox < x + w && y < oy + gh && oy < y + h {
                return erreur("La place est déjà prise.");
            }
        }
        Ok(piece)
    }

    /// Rangement automatique : le petit matériel sur l'établi, le reste contre les murs (le centre reste libre pour
    /// circuler), en évitant la bande du bas où s'affiche le nom de la pièce. pieces : seulement ces pièces-là.
    pub fn place_auto(&self, genre: &Val, pieces: Option<Vec<String>>, ignorer: &Val) -> R<Place> {
        let f = Jeu::fiche(genre)?;
        let (carte, mut dispo) = (self.carte(), self.pieces_dispo());
        let (w, h) = (f.ati("w"), f.ati("h"));
        let grille = *genre == "poste" && pieces.is_none(); // postes rangés seulement sur la grille des bureaux (à la main : partout)
        let pc = d("PIECES");
        let pieces: Vec<String> = match pieces {
            // les bureaux individuels et de direction ne se remplissent pas tout seuls
            None => f
                .at("pieces")
                .iter()
                .filter(|k| *genre != "poste" || matches!(pc.at(k).ats("genre").as_str(), "garage" | "bureau"))
                .map(|k| k.string())
                .collect(),
            Some(p) => {
                dispo.retain(|k| p.contains(k));
                p
            }
        };
        let rect_de = |k: &String| r4(&pc.at(k.as_str()).at("rect"));
        let materiel = d("MATERIEL").has(genre);
        // emplacements prévus d'abord (grille des postes, disposition de la cantine…)
        for p in d("EMPLACEMENTS").get_or(genre, list![]).iter() {
            let (x, y) = (p.ati(0), p.ati(1));
            let cote = if *genre == "poste" {
                d("COTE_POSTES").get_or(Val::tuple(vec![Val::Int(x), Val::Int(y)]), "n").string()
            } else {
                self.cote_pres(genre, x, y)?.2
            };
            if !pieces.iter().any(|k| {
                let (rx, ry, rw, rh) = rect_de(k);
                rx <= x && x < rx + rw && ry <= y && y < ry + rh
            }) {
                continue;
            }
            if self.verifier_place(genre, x, y, ignorer, &cote).is_ok() {
                return Ok((x, y, cote));
            }
        }
        if grille {
            return erreur("Plus de place libre pour un bureau : louez une autre pièce, ou posez-le vous-même.");
        }
        let dans = |x: i64, y: i64| {
            dispo.iter().any(|k| {
                let r = rect_de(k);
                r.0 <= x && r.1 <= y && x + POSTE_W <= r.0 + r.2 && y + POSTE_H <= r.1 + r.3
            })
        };
        // seulement ceux de la carte courante
        let postes: Vec<(i64, i64)> = if *genre == "poste" {
            Vec::new()
        } else {
            d("EMPLACEMENTS").at("poste").iter().map(|p| (p.ati(0), p.ati(1))).filter(|&(x, y)| dans(x, y)).collect()
        };
        let gene = |x: i64, y: i64, w: i64, h: i64| postes.iter().any(|&(px, py)| x < px + POSTE_W && px < x + w && y < py + POSTE_H && py < y + h);
        // (établi d'abord, gêne un poste prévu, rang de la pièce préférée, 0 si contre un mur, distance au mur, y, x, côté, pièce)
        type Candidat = (i64, bool, i64, i64, i64, i64, i64, String, Option<String>);
        let mut candidats: Vec<Candidat> = Vec::new();
        if materiel && pieces.iter().any(|k| k == "garage" || k == "labo") {
            for e in d("ETABLIS").at(carte).iter() {
                let (bx, by, bw, bh) = r4(&e);
                if bh >= bw && w <= bw {
                    // établi vertical : appareils les uns sous les autres
                    for y in (by..by + bh - h + 1).step_by(4) {
                        candidats.push((0, false, 0, 0, y - by, y, bx + py::floordiv_i(bw - w, 2), "n".into(), None));
                    }
                } else if bh < bw && h <= bh {
                    // établi horizontal : côte à côte ; contre un mur du bas : appareils tournés vers la pièce
                    let bas = pieces.iter().any(|k| {
                        let (rx, ry, rw, rh) = rect_de(k);
                        by + bh >= ry + rh - 3 && rx <= bx && bx < rx + rw && ry <= by && by < ry + rh
                    });
                    for x in (bx..bx + bw - w + 1).step_by(4) {
                        let y = if bas { by + bh - h } else { by + py::floordiv_i(bh - h, 2) };
                        candidats.push((0, false, 0, 0, x - bx, y, x, if bas { "s" } else { "n" }.into(), None));
                    }
                }
            }
        }
        for (rang, k) in pieces.iter().enumerate() {
            if !dispo.contains(k) {
                continue;
            }
            let rang = rang as i64;
            let (px, py, pw, ph) = rect_de(k);
            let au_sol = f.getb("libre") && *genre != "tableau"; // tapis, affiche, clim : sans mur attitré
            for c in (if au_sol { "n" } else { "nsoe" }).chars() {
                // le long de chaque mur, le long côté contre lui
                let c = c.to_string();
                let (cw, ch) = Jeu::emprise(genre, &c)?;
                if c == "n" || c == "s" {
                    let y = if c == "n" { py + 1 } else { py + ph - ch - 1 };
                    for x in (px + 1..px + pw - cw).step_by(6) {
                        candidats.push((1, gene(x, y, cw, ch), rang, 0, 1, y, x, c.clone(), Some(k.clone())));
                    }
                } else {
                    let x = if c == "o" { px + 1 } else { px + pw - cw - 1 };
                    for y in (py + 1..py + ph - ch).step_by(6) {
                        candidats.push((1, gene(x, y, cw, ch), rang, 0, 1, y, x, c.clone(), Some(k.clone())));
                    }
                }
            }
            // en dernier recours, ailleurs dans la pièce
            let mut xs: BTreeSet<i64> = (px..px + pw - w + 1).step_by(8).collect();
            xs.insert(px + pw - w);
            let mut ys: BTreeSet<i64> = (py..py + ph - h + 1).step_by(8).collect();
            ys.insert(py + ph - h);
            for &y in &ys {
                for &x in &xs {
                    let dist = (x - px).min(px + pw - x - w).min(y - py).min(py + ph - y - h);
                    candidats.push((1, gene(x, y, w, h), rang, 1, dist, y, x, "n".into(), Some(k.clone())));
                }
            }
        }
        candidats.sort_by(|a, b| (a.0, a.1, a.2, a.3, a.4, a.5, a.6).cmp(&(b.0, b.1, b.2, b.3, b.4, b.5, b.6)));
        // d'abord une vraie place contre un mur, écartée ; puis une place qui garde au moins le passage ; le matériel doit
        // pouvoir s'acheter, il prend ce qui reste en dernier
        for regle in ["ecart", "passage", "reste"] {
            if regle == "reste" && !materiel && *genre != "poste" {
                break;
            }
            for (_, _, _, ailleurs, _, y, x, c, k) in &candidats {
                if regle == "ecart" && *ailleurs != 0 {
                    continue;
                }
                if self.verifier_place(genre, *x, *y, ignorer, c).is_err() {
                    continue;
                }
                let bon = match k {
                    _ if regle == "reste" => true,
                    None => true,
                    Some(k) => self.place_stricte(genre, *x, *y, c, k, ignorer, regle == "ecart")?,
                };
                if bon {
                    return Ok((*x, *y, c.clone()));
                }
            }
        }
        erreur(format!("Plus de place libre pour : {}.", f.at("nom")))
    }

    /// Pièce du bâtiment (ou le garage) qui contient l'objet (son coin haut-gauche).
    pub fn piece_de(&self, o: &Val) -> Option<String> {
        let (x, y) = (o.atf("x"), o.atf("y"));
        for (k, pc) in d("PIECES").items() {
            let (px, py, pw, ph) = r4(&pc.at("rect"));
            if px as f64 <= x && x < (px + pw) as f64 && py as f64 <= y && y < (py + ph) as f64 && (pc.at("carte") == "garage") == (k == "garage") {
                return Some(k.string());
            }
        }
        None
    }

    pub fn emmenage(&self) -> bool {
        self.etat.at("locaux").has("bureau")
    }

    /// Employés présents installés dans la pièce d'une fonction (bureau indus, labo de qualif, chefs de projet, commerciaux).
    pub fn gens_de(&self, fonction: &str) -> Vec<Val> {
        let pieces = self.roles().at("pieces");
        self.etat
            .at("employes")
            .iter()
            .filter(|x| !x.atb("absent") && champ(&d("PIECES").get(pieces.get(x.at("id"))), "fonction") == fonction)
            .collect()
    }

    /// Qualité d'une étape d'indus ou de qualif : 60 % sans spécialiste installé, jusqu'à 100 % avec un expert du métier.
    pub fn qualite_etape(&self, fonction: &str, metier: &str) -> f64 {
        let meilleur = self.gens_de(fonction).iter().map(|x| self.metier(x, metier)).max().unwrap_or(0);
        1.0f64.min(0.6 + 0.05 * meilleur as f64)
    }

    /// Qualité de l'indus ou de la qualif d'un projet : celle du prestataire choisi, sinon celle de l'équipe.
    pub fn qualite_projet(&self, p: &Val, etape: &str) -> f64 {
        let q = champ(&p.get("qualite_presta"), etape);
        if q.is_none() {
            self.qualite_etape(etape, etape)
        } else {
            q.f()
        }
    }

    /// Domaines de la phase confiés à un prestataire, avec son offre.
    pub fn externes(p: &Val, ph: &Val) -> Val {
        let presta = p.get_or("presta", dict! {});
        let res = Val::dict();
        let prest = d("PRESTATAIRES");
        if ph.get("etape") == "indus" && presta.get_or("indus", "interne") != "interne" {
            for dom in ph.at("besoin").iter() {
                res.set(&dom, prest.at("indus").at("options").at(presta.at("indus")));
            }
            return res;
        }
        for dom in ph.at("besoin").iter() {
            if presta.get_or(&dom, "interne") != "interne" {
                res.set(&dom, prest.at(&dom).at("options").at(presta.at(&dom)));
            }
        }
        res
    }

    pub fn chefs_projet(&self) -> Vec<Val> {
        self.etat.at("employes").iter().filter(|x| x.getb("chef") && !x.atb("absent")).collect()
    }

    pub fn commerciaux(&self) -> Vec<Val> {
        self.etat.at("employes").iter().filter(|x| x.getb("commercial") && !x.atb("absent")).collect()
    }

    /// Service d'un employé : son domaine le plus fort.
    pub fn service(emp: &Val) -> String {
        py::max_by_key(d("DOMAINES").iter(), |dom| emp.at(dom)).unwrap().string()
    }

    /// Rôles actifs (installés dans le bon bureau), taille des services et pièce de chaque employé.
    pub fn roles(&self) -> Val {
        let deja = self.roles_cache.borrow().clone();
        if deja.is_some() {
            return deja;
        }
        let e = &self.etat;
        let garage = self.carte() == "garage";
        let postes = Val::dict();
        for o in e.at("objets").iter() {
            if o.at("type") == "poste" {
                postes.set(o.at("id"), if garage { Some("garage".to_string()) } else { self.piece_de(&o) });
            }
        }
        let occupation = Val::dict();
        for k in postes.values() {
            occupation.set(&k, occupation.get_or(&k, 0) + 1i64);
        }
        let actifs = Val::dict();
        for x in e.at("employes").iter() {
            let k = postes.get(x.get("bureau"));
            let r = d("ROLES").get(x.get("role"));
            if r.truthy() && k.truthy() && d("PIECES").at(&k).at("genre") == r.at("genre") && (r.at("genre") != "res" || occupation.at(&k) == 1i64) {
                actifs.set(x.at("role"), x.at("id"));
            }
        }
        let pieces = Val::dict();
        for x in e.at("employes").iter() {
            pieces.set(x.at("id"), postes.get(x.get("bureau")));
        }
        let taille = Val::dict();
        for dom in d("DOMAINES").iter() {
            let n = e.at("employes").iter().filter(|x| Jeu::service(x) == dom.s()).count();
            taille.set(&dom, n);
        }
        let r = dict! {"actifs" => actifs, "pieces" => pieces, "taille" => taille};
        *self.roles_cache.borrow_mut() = r.clone();
        r
    }

    /// Responsable installé : +8 % ; service trop grand sans responsable : jusqu'à −20 % ; bureau de son service : +5 %.
    pub fn facteur_service(&self, emp: &Val) -> f64 {
        let (r, dom) = (self.roles(), Jeu::service(emp));
        let mut f = 1.0;
        let taille = r.at("taille").ati(dom.as_str());
        let sans = d("SERVICE_SANS_RESP").i();
        if r.at("actifs").has(format!("resp_{dom}")) {
            f *= 1.08;
        } else if taille > sans {
            f *= 1.0 - 0.2f64.min(0.04 * (taille - sans) as f64);
        }
        if champ(&d("PIECES").get(r.at("pieces").get(emp.at("id"))), "service") == dom {
            f *= 1.05;
        }
        f
    }

    /// Déplace le bureau de l'employé dans une pièce du genre voulu (individuelle pour un responsable).
    pub fn installer(&self, emp: &Val, genre: &str) -> R {
        let e = &self.etat;
        let Some(o) = e.at("objets").iter().find(|x| x.at("id") == emp.get("bureau")) else {
            return erreur(format!("{} n'a pas de bureau.", emp.at("nom")));
        };
        let autres: Vec<Option<String>> = e.at("objets").iter().filter(|x| x.at("type") == "poste" && !x.is(&o)).map(|x| self.piece_de(&x)).collect();
        let libres: Vec<String> = self
            .pieces_dispo()
            .into_iter()
            .filter(|k| d("PIECES").at(k.as_str()).at("genre") == genre && (genre != "res" || !autres.contains(&Some(k.clone()))))
            .collect();
        if self.carte() == "batiment" && self.piece_de(&o).is_some_and(|k| libres.contains(&k)) {
            return Ok(());
        }
        match self.place_auto(&Val::str("poste"), Some(libres), &o.at("id")) {
            Ok((x, y, c)) => {
                o.set("x", x);
                o.set("y", y);
                o.set("cote", c);
            }
            Err(_) => {
                let quoi = if genre == "res" { "un bureau de responsable libre" } else { "la direction R&D, avec une place libre" };
                return erreur(format!("Louez d'abord {quoi} (Locaux)."));
            }
        }
        self.oublier_roles();
        Ok(())
    }

    /// Replace tous les objets dans les pièces disponibles (déménagement, nouveau plan) ; les bureaux d'abord, les plus gros
    /// objets ensuite. Ce qui ne tient plus est retiré du plan (l'effet d'une déco reste acquis, un employé sans bureau en retrouve un).
    pub fn replacer_objets(&self) -> R {
        let e = &self.etat;
        let anciens = e.at("objets");
        e.set("objets", list![]);
        let (materiel, deco) = (d("MATERIEL"), d("DECO"));
        let connus: Vec<Val> = anciens
            .iter()
            .filter(|o| {
                let t = o.at("type");
                t == "poste" || materiel.has(&t) || (deco.has(&t) && !deco.at(&t).getb("global"))
            })
            .collect();
        let hors_grille: Vec<String> = d("POSTE")
            .at("pieces")
            .iter()
            .filter(|k| matches!(d("PIECES").at(k).ats("genre").as_str(), "garage" | "bureau"))
            .map(|k| k.string())
            .collect();
        let mut cles = Vec::new();
        for o in connus {
            let t = o.at("type");
            let f = Jeu::fiche(&t)?;
            cles.push(((t != "poste", !materiel.has(&t), -f.ati("w") * f.ati("h")), o));
        }
        cles.sort_by(|a, b| a.0.cmp(&b.0));
        let mut perdus = Vec::new();
        for (_, o) in cles {
            let t = o.at("type");
            let place = match self.place_auto(&t, None, &Val::None) {
                Ok(p) => Ok(p),
                // grille pleine : un poste se pose ailleurs dans les bureaux
                Err(err) if t != "poste" => Err(err),
                Err(_) => self.place_auto(&t, Some(hors_grille.clone()), &Val::None),
            };
            let Ok((x, y, cote)) = place else {
                perdus.push(o);
                continue;
            };
            let n = o.copy();
            n.set("x", x);
            n.set("y", y);
            n.set("cote", cote);
            e.at("objets").push(n);
        }
        // ce qui ne tient nulle part est revendu à moitié prix (sinon : invisible, ni revendable ni reposable)
        for o in perdus {
            let t = o.at("type");
            if t == "poste" || e.at("objets").iter().any(|x| x.at("type") == t) {
                continue;
            }
            let liste = if materiel.has(&t) { e.at("materiel") } else { e.at("deco") };
            if liste.has(&t) {
                liste.remove(&t);
                e.at("pannes").pop(&t);
                let f = Jeu::fiche(&t)?;
                self.encaisser(py::floordiv_i(f.ati("prix"), 2));
                self.log(&format!("{} : plus de place dans les pièces louées, revendu à moitié prix.", f.at("nom")), "info");
            }
        }
        let postes = self.postes_ouverts();
        for emp in e.at("employes").iter() {
            if !postes.contains(&emp.at("bureau")) {
                let libres = self.bureaux_libres();
                emp.set("bureau", libres.first().cloned().unwrap_or(Val::None));
            }
        }
        Ok(())
    }

    pub fn ajouter_objet(&self, genre: &Val, x: i64, y: i64, cote: &str) -> Val {
        let o = dict! {"id" => self.id(), "type" => genre, "x" => x, "y" => y, "cote" => cote};
        self.etat.at("objets").push(o.clone());
        o
    }

    fn poser(&self, genre: &Val, x: &Val, y: &Val) -> R {
        let e = &self.etat;
        let f = Jeu::fiche(genre)?;
        if d("MATERIEL").has(genre) && e.at("materiel").has(genre) {
            return erreur(format!("{} : déjà installé.", f.at("nom")));
        }
        if d("DECO").has(genre) && e.at("deco").has(genre) && !f.getb("multiple") {
            return erreur(format!("{} : vous en avez déjà un.", f.at("nom")));
        }
        let (x, y, cote) = if x.is_none() || y.is_none() {
            self.place_auto(genre, None, &Val::None)?
        } else if entier(x) && entier(y) {
            let g = d("GRILLE").f();
            self.cote_pres(genre, py::round(x.f() / g) * g as i64, py::round(y.f() / g) * g as i64)?
        } else {
            return erreur("Paramètres invalides.");
        };
        self.verifier_place(genre, x, y, &Val::None, &cote)?;
        self.payer(f.ati("prix"))?;
        let o = self.ajouter_objet(genre, x, y, &cote);
        if *genre == "poste" {
            if let Some(sans) = e.at("employes").iter().find(|x| x.get("bureau").is_none()) {
                sans.set("bureau", o.at("id")); // un employé sans bureau (déménagement serré) s'y installe
            }
        }
        if d("MATERIEL").has(genre) {
            e.at("materiel").push(genre);
        } else if d("DECO").has(genre) && !e.at("deco").has(genre) {
            e.at("deco").push(genre);
        }
        self.log(&format!("{} installé.", f.at("nom")), "bon");
        Ok(())
    }

    pub fn objet(&self, oid: &Val) -> R<Val> {
        match self.etat.at("objets").iter().find(|x| x.at("id") == *oid) {
            Some(o) => Ok(o),
            None => erreur("Objet introuvable."),
        }
    }

    /// Garage : 1 projet ; emménagé : 2 ; un de plus par chef de projet (4 au plus).
    pub fn capacite_projets(&self) -> i64 {
        1 + self.emmenage() as i64 + 4i64.min(self.chefs_projet().len() as i64) + self.a_investi("filiale")
    }

    /// Demandes spontanées : l'accueil, la filiale ; le reste se prospecte.
    pub fn nb_offres(&self) -> i64 {
        NB_OFFRES + self.emmenage() as i64 + 2 * self.a_investi("filiale")
    }

    pub fn places_occupees(&self) -> i64 {
        self.etat.at("projets").iter().map(|p| if p.getb("mega") { 2 } else { 1 }).sum()
    }

    pub fn horaires(&self) -> Val {
        d("HORAIRES").at(self.etat.at("heures"))
    }

    pub fn materiel_actif(&self) -> Vec<Val> {
        let pannes = self.etat.at("pannes");
        self.etat.at("materiel").iter().filter(|m| !pannes.has(m)).collect()
    }

    pub fn bonus(&self) -> Val {
        let b = dict! {"e" => 0, "m" => 0, "f" => 0, "debug" => 0, "cem" => 0.0};
        for mid in self.materiel_actif() {
            let m = d("MATERIEL").at(&mid);
            if b.has(&m.at("dom")) {
                b.inc(m.at("dom"), m.at("bonus"));
            }
            b.inc("debug", m.get_or("debug", 0));
            b.inc("cem", m.get_or("cem", 0));
        }
        self.mod_bonus(&b);
        b
    }

    pub fn moral_global(&self) -> f64 {
        let e = &self.etat;
        let deco = py::sum_v(e.at("deco").iter().map(|x| d("DECO").at(&x).at("moral")));
        let m = Val::Int(60) + deco + self.horaires().at("moral") + Val::Int(5 * self.emmenage() as i64); // salle de pause
        let mut m = m.f() + py::sum(e.at("employes").iter().map(|x| self.trait_(&x, "moral")));
        m -= 0i64.max(e.at("employes").len() as i64 - 4) as f64 * 1.5;
        bornef(m, 20.0, 95.0)
    }

    pub fn moral(&self, emp: &Val) -> f64 {
        let encadre = if self.roles().at("actifs").has(format!("resp_{}", Jeu::service(emp))) { 5.0 } else { 0.0 };
        bornef(self.moral_global() - emp.atf("fatigue") / 2.0 + emp.atf("humeur") + encadre, 5.0, 100.0)
    }

    /// Conditions de travail : facteurs (libellé, %) et multiplicateur appliqué à toute la production.
    pub fn conditions(&self) -> (Val, f64) {
        let e = &self.etat;
        let n = e.at("employes").iter().filter(|x| !x.atb("absent")).count() as i64;
        let deco = e.at("deco");
        let mut f: Vec<(String, Val)> = Vec::new();
        for x in deco.iter() {
            let fd = d("DECO").at(&x);
            if fd.getb("prod") {
                f.push((fd.ats("nom"), fd.at("prod")));
            }
        }
        if deco.has("cafe") {
            f.push(("Pauses café".into(), Val::Int(3)));
        }
        if e.at("heures") != 8i64 {
            f.push((format!("Horaires : {} h par jour", e.at("heures")), Val::Int(py::round((self.horaires().atf("prod") - 1.0) * 100.0))));
        }
        let meteo = e.get("meteo");
        if meteo == "canicule" {
            f.push(if deco.has("clim") { ("Canicule, mais climatisé".into(), Val::Int(0)) } else { ("Canicule sans climatisation".into(), Val::Int(-15)) });
        } else if meteo == "neige" {
            f.push(("Neige : trajets difficiles".into(), Val::Int(-5)));
        }
        let bruit = 2 * (n - 4) - 6 * self.emmenage() as i64; // les bulles téléphone du bâtiment
        if bruit > 0 && !deco.has("isolation") {
            f.push(("Bruit, pas d'isolation phonique".into(), Val::Int(-bruit)));
        }
        if n >= 2 && !e.at("locaux").has("bureau") {
            f.push(("Garage exigu".into(), Val::Int(-5)));
        }
        let total = bornef(1.0 + py::sum_v(f.iter().map(|x| x.1.clone())).f() / 100.0, 0.6, 1.5);
        (Val::list(f.into_iter().map(|(a, b)| dict! {"nom" => a, "pct" => b}).collect()), total)
    }

    pub fn efficacite(&self, emp: &Val) -> f64 {
        let anciennete = 1.0 + 0.1f64.min(0.02 * self.anciennete(emp)); // on connaît la maison : +2 % par an, jusqu'à +10 %
        bornef(self.moral(emp) / 70.0, 0.4, 1.4) * self.conditions().1 * self.trait_(emp, "vitesse") * anciennete * self.facteur_service(emp)
    }

    pub fn loyer(&self) -> i64 {
        let locaux: i64 = self.etat.at("locaux").iter().map(|l| d("LOCAUX").at(&l).ati("loyer")).sum();
        d("LOYER_BASE").i() + locaux + d("INVESTISSEMENTS").at("filiale").ati("loyer") * self.a_investi("filiale")
    }

    /// Comptable, assurances, licences logicielles… : croît plus vite que l'effectif (coordination).
    pub fn frais_structure(&self) -> i64 {
        let n = self.etat.at("employes").iter().filter(|x| !x.getb("fondateur") && !x.getb("stage")).count() as i64;
        400 * n + 50 * n * n
    }

    pub fn salaires(&self) -> i64 {
        let s = py::sum_v(self.etat.at("employes").iter().map(|x| x.at("salaire")));
        py::round(s.f() * (1.0 + self.horaires().atf("salaire")))
    }

    pub fn production(&self, emp: &Val, dom: &str, bon: &Val) -> f64 {
        if emp.atf(dom) <= 0.0 {
            return 0.0;
        }
        let logiciel = if dom == "f" { 1.0 + 0.03 * emp.at("metier").atf("logiciel") } else { 1.0 };
        // moins de production pendant la prospection
        emp.atf(dom) * self.efficacite(emp) * (1.0 + 0.06 * bon.atf(dom)) * logiciel * self.facteur_prospection(emp)
    }

    pub fn detection(&self, emp: &Val, bon: &Val) -> f64 {
        let fm = bornef(self.moral(emp) / 70.0, 0.4, 1.4) * self.conditions().1;
        let qualite = if self.roles().at("pieces").get(emp.at("id")) == "qualif" { 1.5 } else { 1.0 };
        (emp.atf("e") + emp.atf("f")) / 2.0 * fm * 0.2 * (1.0 + 0.15 * bon.atf("debug")) * self.trait_(emp, "detection") * qualite
    }

    /// Tests toujours confiés à un labo externe.
    pub fn frais_cem(p: &Val) -> Val {
        Val::Int(600) + p.at("taille") * 5i64
    }

    pub fn proba_cem(&self, p: &Val) -> f64 {
        let bon = self.bonus();
        let norm = p.atf("defauts") / 1f64.max(p.atf("taille") / 40.0);
        let pr = 0.6 + bon.atf("cem") + self.cem_bonus(p) + 0.15f64.min(0.015 * self.meilleur_metier("qualif") as f64)
            - 0.25f64.min(p.atf("taille") / 2000.0)
            - 0.04 * norm
            + 0.2 * p.atf("echecs_cem");
        py::round_n(bornef(pr, 0.1, 0.95), 2)
    }

    pub fn note(&self, p: &Val) -> Val {
        let bon = self.bonus();
        let taille = p.atf("taille");
        let mut n = 7.5 + 1f64.min((bon.atf("e") + bon.atf("m") + bon.atf("f")) / 25.0);
        n += 1.5f64.min(p.atf("qualite") / 1f64.max(taille) * 3.0);
        n -= p.atf("defauts") / 1f64.max(taille / 40.0) * 0.9;
        n -= 0.6 * p.atf("echecs_cem");
        n += self.note_bonus(p);
        if p.at("combos").get_or("trio", 0).f() >= 1f64.max(p.atf("jours")) / 2.0 {
            n += 0.4;
        }
        let suivi = p.get_or("suivi", 0).f(); // chef de projet : client mieux tenu au courant, retard mieux absorbé
        n += 0.3 * suivi;
        if p.at("type") == "contrat" && p.at("jours") > p.at("delai") {
            n -= 3f64.min(0.12 * (p.atf("jours") - p.atf("delai"))) * (1.0 - 0.5 * suivi);
        }
        arrondi(&borne(n, 1, 10), 1)
    }

    /// Plus la société est connue, plus les clients sont exigeants (frein à l'emballement de fin de partie).
    pub fn attente_client(&self) -> Val {
        let e = &self.etat;
        let difficulte = e.get_or("difficulte", "normal");
        Val::Int(6) + vmin(ATTENTE_REP.1, e.atf("renommee") / ATTENTE_REP.0) + d("DIFFICULTES").at(&difficulte).at("attente")
    }

    // ------------------------------------------------------------------ argent
    pub fn encaisser(&self, montant: impl Into<Val>) {
        let (e, m) = (&self.etat, montant.into());
        e.inc("argent", &m);
        e.at("stats").inc("ca", &m);
        e.at("exercice").inc("ca", &m);
    }

    pub fn depenser(&self, montant: impl Into<Val>) {
        let (e, m) = (&self.etat, montant.into());
        e.dec("argent", &m);
        e.at("exercice").inc("charges", &m);
    }

    pub fn payer(&self, montant: impl Into<Val>) -> R {
        let m = montant.into();
        if self.etat.at("argent") < m {
            return erreur("Trésorerie insuffisante.");
        }
        self.depenser(m);
        Ok(())
    }

    // ------------------------------------------------------------------ projets
    pub fn creer_projet(&self, base: &Val, genre: &str) -> Val {
        let phases = list![];
        let modeles = d("PHASES");
        let nom_routage = modeles.at(1).at(0);
        for m in modeles.iter() {
            let (nom, parts) = m.pair();
            let besoin = Val::dict();
            for dom in d("DOMAINES").iter() {
                let v = py::round(base.at("total").atf(&dom) * parts.atf(&dom));
                if v > 0 {
                    besoin.set(&dom, v);
                }
            }
            if besoin.truthy() {
                let fait = Val::dict();
                for k in besoin.iter() {
                    fait.set(&k, 0.0);
                }
                phases.push(dict! {"nom" => &nom, "besoin" => besoin, "fait" => fait});
            }
            if nom == nom_routage {
                // les PCB partent en fabrication : on attend le retour du fournisseur (durée fixée à l'entrée)
                phases.push(dict! {"nom" => "Fabrication du prototype", "besoin" => dict! {}, "fait" => dict! {}, "attente" => Val::None});
            }
        }
        dict! {
            "id" => self.id(), "type" => genre, "nom" => base.at("nom"), "client" => base.get_or("client", ""),
            "taille" => base.at("taille"), "total" => base.at("total"), "paie" => base.get_or("paie", 0), "delai" => base.get_or("delai", 0),
            "gain" => base.get_or("gain", 0), "potentiel" => base.get_or("potentiel", 0), "id_produit" => base.get("id_produit"),
            "secteur" => base.get("secteur"), "mega" => base.get_or("mega", false),
            "phases" => phases, "phase" => 0, "etape" => "travail", "defauts" => 0.0, "qualite" => 0.0,
            "jours" => 0, "cem_jours" => 0, "echecs_cem" => 0, "combos" => dict! {}, "combos_jour" => list![], "equipe" => list![],
        }
    }

    fn verifier_capacite(&self, places: i64) -> R {
        let (occ, cap) = (self.places_occupees(), self.capacite_projets());
        if occ + places > cap {
            let mega = if places > 1 { " (un méga-projet compte double)" } else { "" };
            return erreur(format!("Vous menez déjà {occ} projet(s) sur {cap} possibles{mega} : agrandissez les locaux pour en mener plus."));
        }
        Ok(())
    }

    pub fn entrer_phase(&self, p: &Val) {
        let ph = p.at("phases").at(p.at("phase"));
        if ph.getb("essais") && ph.at("attente").is_none() {
            let q = (self.qualite_projet(p, "qualif") >= 0.9) as i64;
            ph.set("attente", vmax(2, &ph.at("essais") - q));
            self.log(&format!("« {} » : essais de qualification ({} jours en étuve et sur pot vibrant).", p.at("nom"), ph.at("attente")), "info");
        } else if ph.has("attente") && ph.at("attente").is_none() {
            let maison = self.materiel_actif().iter().any(|m| *m == "four"); // avec un four de refusion, on assemble soi-même : plus rapide et moins cher
            let jours = Val::Int(if maison { 2 } else { 4 }) + d("FOURNISSEURS").at(self.etat.at("fournisseur")).at("jours") + py::sum_v(self.choix_effets(p, "jours"));
            ph.set("attente", vmax(1, jours));
            let cout = arrondi_entier(
                (200.0 + p.atf("taille") * 2.0) * (if maison { 0.5 } else { 1.0 }) * self.facteur_proto(p) * (1.0 - 0.1 * p.get_or("suivi", 0).f()),
                1,
            );
            ph.set("cout", cout);
            self.depenser(cout);
            let ou = if maison { "assemblé au labo" } else { "chez le fabricant" };
            self.log(&format!("« {} » : prototype {ou} (−{} €, {} jours).", p.at("nom"), mil(cout), ph.at("attente")).replace('_', " "), "info");
        } else {
            self.kickoff(p);
            self.log(&format!("« {} » : phase « {} ».", p.at("nom"), ph.at("nom")), "info");
        }
    }

    /// 0 : pas d'étape ; 1 : la carte ; 2 : le produit fini.
    pub fn niveau(p: &Val, etape: &str) -> i64 {
        let v = p.get_or("choix", dict! {}).get_or(etape, "aucune");
        d("CHOIX_TECH").at(etape).at("options").at(&v).get_or(etape, 0).i()
    }

    /// Ajoute l'industrialisation (du travail) et la qualification (des essais) choisies, après le firmware.
    pub fn etapes(&self, p: &Val) {
        let (t, ni, nq) = (p.at("total"), Jeu::niveau(p, "indus"), Jeu::niveau(p, "qualif"));
        if ni != 0 {
            let parts = if ni == 1 { [("e", 0.12), ("m", 0.0), ("f", 0.0)] } else { [("e", 0.1), ("m", 0.15), ("f", 0.08)] };
            let (besoin, fait) = (Val::dict(), Val::dict());
            for (dom, k) in parts {
                if k != 0.0 && t.atf(dom) > 0.0 {
                    besoin.set(dom, 3i64.max(py::round(t.atf(dom) * k)));
                    fait.set(dom, 0.0);
                }
            }
            let nom = format!("Industrialisation {}", if ni == 1 { "de la carte" } else { "du produit" });
            p.at("phases").push(dict! {"nom" => nom, "etape" => "indus", "besoin" => besoin, "fait" => fait});
        }
        if nq != 0 {
            let qui = p.get_or("presta", dict! {}).get_or("qualif", "interne");
            let duree = d("PRESTATAIRES").at("qualif").at("options").at(&qui).get_or("duree", 1).f();
            let essais = py::round((if nq == 1 { 4.0 } else { 7.0 }) * duree);
            let nom = format!("Qualification {}", if nq == 1 { "de la carte" } else { "du produit" });
            p.at("phases").push(dict! {"nom" => nom, "etape" => "qualif", "besoin" => dict! {}, "fait" => dict! {}, "attente" => Val::None, "essais" => essais});
        }
    }

    /// Réunion de lancement dans le bâtiment : la nouvelle phase démarre déjà avancée de 5 %.
    pub fn kickoff(&self, p: &Val) {
        let ph = p.at("phases").at(p.at("phase"));
        let part = d("KICKOFF").f() * if self.emmenage() { 1.0 } else { 0.0 };
        let (besoin, fait) = (ph.at("besoin"), ph.at("fait"));
        for dom in besoin.iter() {
            fait.set(&dom, vmax(fait.at(&dom), py::round_n(besoin.atf(&dom) * part, 1)));
        }
    }

    pub fn lancer_cem(&self, p: &Val) {
        let frais = Jeu::frais_cem(p);
        self.depenser(&frais);
        p.set("etape", "cem");
        p.set("cem_jours", DUREE_CEM);
        self.log(&format!("Tests CEM confiés au labo externe pour « {} » (−{} €, {DUREE_CEM} jours).", p.at("nom"), mil_v(&frais)).replace('_', " "), "info");
    }

    fn utilite(&self, emp: &Val, p: &Val) -> f64 {
        if p.at("etape") == "travail" {
            let ph = p.at("phases").at(p.at("phase"));
            let ext = Jeu::externes(p, &ph);
            let (b, f) = (ph.at("besoin"), ph.at("fait"));
            return py::max_f(b.iter().filter(|dom| b.atf(dom) - f.atf(dom) > 1e-6 && !ext.has(dom)).map(|dom| emp.atf(&dom))).unwrap_or(0.0);
        }
        if p.at("etape") == "debug" {
            return (emp.atf("e") + emp.atf("f")) / 4.0;
        }
        0.0
    }

    /// Affecte chaque employé présent à un projet : son affectation fixe ; puis chaque chef de projet prend, pour ses projets,
    /// le meilleur spécialiste libre de chaque domaine encore à faire ; les autres vont là où ils sont le plus utiles.
    pub fn repartir(&self) -> Val {
        let e = &self.etat;
        let equipes = Val::dict();
        for p in e.at("projets").iter() {
            equipes.set(p.at("id"), list![]);
        }
        if !equipes.truthy() {
            return equipes;
        }
        let mut libres: Vec<Val> = Vec::new();
        for emp in e.at("employes").iter() {
            if emp.atb("absent") {
                continue;
            }
            if equipes.has(&emp.get("projet")) {
                equipes.at(emp.at("projet")).push(emp);
            } else {
                libres.push(emp);
            }
        }
        for p in py::sorted_by_key(e.at("projets").vec(), |p| -p.atf("taille")) {
            if !p.getb("chef") || p.at("etape") != "travail" {
                continue;
            }
            let ph = p.at("phases").at(p.at("phase"));
            let ext = Jeu::externes(&p, &ph);
            let (b, f) = (ph.at("besoin"), ph.at("fait"));
            let doms: Vec<Val> = b.iter().filter(|dom| b.atf(dom) - f.atf(dom) > 1e-6 && !ext.has(dom)).collect();
            let equipe = equipes.at(p.at("id"));
            for dom in doms {
                if equipe.iter().any(|x| x.atf(&dom) >= 3.0) {
                    continue; // domaine déjà couvert
                }
                let Some(emp) = py::max_by_key(libres.iter().cloned(), |x| x.at(&dom)) else { continue };
                if emp.atf(&dom) > 0.0 {
                    equipe.push(emp.clone());
                    let i = libres.iter().position(|x| x.is(&emp)).unwrap();
                    libres.remove(i);
                }
            }
        }
        for emp in libres {
            let meilleur =
                py::max_by_key(e.at("projets").iter(), |p| self.utilite(&emp, p) / (1.0 + 0.25 * equipes.at(p.at("id")).len() as f64)).unwrap();
            equipes.at(meilleur.at("id")).push(emp);
        }
        equipes
    }

    pub fn combos(&self, p: &Val, equipe: &[Val]) -> Vec<String> {
        let mut actifs: Vec<String> = Vec::new();
        let doms: Vec<Val> = d("DOMAINES").iter().filter(|dom| p.at("total").atf(dom) > 0.0).collect();
        let mut pris: Vec<Val> = Vec::new();
        let mut complet = true;
        for dom in &doms {
            match equipe.iter().find(|x| x.atf(dom) >= 5.0 && !pris.contains(&x.at("id"))) {
                Some(expert) => pris.push(expert.at("id")),
                None => {
                    complet = false;
                    break;
                }
            }
        }
        if complet && doms.len() >= 2 {
            actifs.push("trio".into());
        }
        let traits: Vec<Val> = equipe.iter().flat_map(|x| x.at("traits").vec()).collect();
        if traits.iter().any(|t| *t == "perfectionniste") && traits.iter().any(|t| *t == "debug") {
            actifs.push("qualite".into());
        }
        let tous = d("DOMAINES").vec();
        if equipe.iter().any(|x| tous.iter().any(|dom| x.atf(dom) >= 9.0)) && equipe.iter().any(|x| x.atf("e") + x.atf("m") + x.atf("f") <= 6.0) {
            actifs.push("mentor".into());
        }
        if equipe.len() >= 4 && equipe.iter().all(|x| self.moral(x) >= 65.0) {
            actifs.push("soudee".into());
        }
        actifs
    }

    pub fn travailler(&self, p: &Val, actifs: &[Val], bon: &Val) {
        let e = &self.etat;
        let combos = self.combos(p, actifs);
        p.set("combos_jour", Val::list(combos.iter().map(Val::from).collect()));
        p.set("equipe", Val::list(actifs.iter().map(|x| x.at("id")).collect()));
        for c in &combos {
            let pc = p.at("combos");
            pc.set(c.as_str(), pc.get_or(c.as_str(), 0) + 1i64);
            if !e.at("combos_vus").has(c.as_str()) {
                e.at("combos_vus").push(c.as_str());
                self.log(&format!("Combo débloqué sur « {} » : {} !", p.at("nom"), d("COMBOS").at(c.as_str()).at("nom")), "bon");
            }
        }
        let a = |c: &str| combos.iter().any(|x| x == c);
        let mult = (if a("trio") { 1.1 } else { 1.0 }) * (if a("soudee") { 1.05 } else { 1.0 }) * self.mult_chef(p) * self.affinites(actifs, Some(p));
        let pedagogues: Vec<Val> = actifs.iter().filter(|x| x.at("traits").has("pedagogue")).cloned().collect();
        let taux_base = 0.07 * self.facteur_defauts() * self.choix_effets(p, "defauts").iter().map(Val::f).product::<f64>();
        let mut taux_defauts = taux_base * self.horaires().atf("defauts") * (if a("qualite") { 0.7 } else { 1.0 });
        taux_defauts *= 1.0 - 0.1 * p.get_or("suivi", 0).f(); // le chef de projet fait le lien entre les équipes
        for emp in actifs {
            emp.set("projet_jour", p.at("id"));
        }
        let etape = p.at("etape");
        if etape == "travail" {
            let ph = p.at("phases").at(p.at("phase"));
            if ph.getb("attente") {
                ph.dec("attente", 1i64);
                // essais ratés : plus probable en interne sans spécialiste ou chez un labo low-cost
                if !ph.atb("attente") && ph.get("etape") == "qualif" && self.random() < 0.5 * (1.0 - self.qualite_projet(p, "qualif")) {
                    ph.set("attente", ph.at("essais"));
                    self.log(&format!("« {} » : essais de qualification ratés, à refaire ({} jours).", p.at("nom"), ph.at("essais")), "mauvais");
                }
            }
            let ext = Jeu::externes(p, &ph);
            let (besoin, fait) = (ph.at("besoin"), ph.at("fait"));
            for (dom, o) in ext.items() {
                // le prestataire avance de son côté, plus vite sur un gros projet
                let pts = vmin(vmax(o.at("rythme"), p.atf("taille") * o.atf("rythme") / 150.0), besoin.atf(&dom) - fait.atf(&dom));
                fait.set(&dom, &fait.at(&dom) + &pts);
                p.inc("defauts", pts.f() * taux_base * o.get_or("defauts", 1).f());
            }
            for emp in actifs {
                let doms: Vec<Val> = besoin.iter().filter(|dom| besoin.atf(dom) - fait.atf(dom) > 1e-6 && emp.atf(dom) > 0.0 && !ext.has(dom)).collect();
                if !doms.is_empty() {
                    let dom = py::max_by_key(doms, |k| emp.at(k)).unwrap();
                    let reste = besoin.atf(&dom) - fait.atf(&dom);
                    let n = actifs.len();
                    let pts = (self.production(emp, dom.s(), bon) * mult * self.contexte(emp, p, n) * self.coordination(emp, p, n)).min(reste);
                    fait.set(&dom, &fait.at(&dom) + pts);
                    let relu = if self.encadre(emp) { 0.9 } else { 1.0 }; // le responsable relit
                    p.inc("defauts", pts * taux_defauts * self.facteur_defauts_emp(emp, p) * relu);
                    p.inc("qualite", pts * self.trait_(emp, "qualite"));
                    emp.set("tache", &dom);
                    emp.set("gain", py::round_n(pts, 1));
                    let junior = a("mentor") && emp.atf("e") + emp.atf("m") + emp.atf("f") <= 6.0;
                    let pedagogie = if pedagogues.iter().any(|x| !x.is(emp)) { 1.5 } else { 1.0 };
                    self.experience(emp, dom.s(), pts * (if junior { 2.0 } else { 1.0 }) * pedagogie);
                } else {
                    let retire = vmin(p.at("defauts"), self.detection(emp, bon));
                    p.dec("defauts", &retire);
                    emp.set("tache", "debug");
                    emp.set("gain", arrondi(&retire, 1));
                }
            }
            p.scale("defauts", 1.0 - 0.3f64.min(0.015 * (1.0 + 0.5 * bon.atf("debug"))));
            if !ph.getb("attente") && besoin.iter().all(|dom| fait.atf(&dom) >= besoin.atf(&dom) - 1e-6) {
                if p.ati("phase") + 1 < p.at("phases").len() as i64 {
                    p.inc("phase", 1i64);
                    e.set("reunion", true);
                    self.entrer_phase(p);
                } else if p.atf("defauts") >= 0.5 {
                    p.set("etape", "debug");
                    self.log(&format!("« {} » : place au debug. Passez aux tests CEM quand vous voulez.", p.at("nom")), "info");
                } else {
                    self.lancer_cem(p);
                }
            }
        } else if etape == "debug" {
            for emp in actifs {
                let retire = vmin(p.at("defauts"), self.detection(emp, bon));
                p.dec("defauts", &retire);
                emp.set("tache", "debug");
                emp.set("gain", arrondi(&retire, 1));
                let dom = if emp.at("f") >= emp.at("e") { "f" } else { "e" };
                self.experience(emp, dom, retire.f());
            }
            if p.atf("defauts") < 0.3 {
                p.set("defauts", 0.0);
                self.log(&format!("Plus aucun défaut connu sur « {} » : direction les tests CEM.", p.at("nom")), "bon");
                self.lancer_cem(p);
            }
        } else if etape == "cem" {
            for emp in actifs {
                emp.set("tache", "cem");
                emp.set("gain", 0);
            }
            p.dec("cem_jours", 1i64);
            if p.ati("cem_jours") <= 0 {
                if self.random() < self.proba_cem(p) {
                    self.terminer(p);
                } else {
                    p.inc("echecs_cem", 1i64);
                    let besoin = 6i64.max(py::round(p.at("total").atf("e") * 0.12));
                    p.at("phases").push(dict! {"nom" => "Correction CEM", "besoin" => dict! {"e" => besoin}, "fait" => dict! {"e" => 0.0}});
                    p.set("phase", p.at("phases").len() - 1);
                    p.set("etape", "travail");
                    self.log(&format!("Échec aux tests CEM pour « {} » : il faut corriger le routage.", p.at("nom")), "mauvais");
                }
            }
        }
    }

    pub fn terminer(&self, p: &Val) {
        let e = &self.etat;
        let note = self.note(p);
        let nf = note.f();
        if p.at("type") == "contrat" {
            let facteur = bornef(1.0 + 0.1 * (nf - self.attente_client().f()), 0.5, 1.25);
            let mut paie = arrondi_entier(p.atf("paie") * facteur * self.facteur_paie(p), 1) - p.get_or("acompte", 0).i();
            let ecart = nf - self.attente_client().f();
            let prime = if p.getb("chef") && p.at("jours") <= p.at("delai") && ecart >= 0.0 {
                arrondi_entier(p.atf("paie") * d("PRIME_CHEF").f() * p.get_or("suivi", 0).f(), 1)
            } else {
                0
            };
            paie += prime;
            let gain = if ecart < -2.0 {
                -1
            } else {
                self.arrondi_hasard(0f64.max(p.atf("gain") * ecart / 2.0 + if ecart >= 0.0 { 0.5 } else { 0.0 }) * self.frein_renommee())
            };
            self.encaisser(paie);
            e.set("renommee", vmax(0, &e.at("renommee") + gain));
            e.at("stats").inc("livres", 1i64);
            e.at("exercice").inc("livres", 1i64);
            let dont = if prime != 0 { format!(" (dont prime du client {} €)", mil(prime)) } else { String::new() };
            self.log(
                &format!("« {} » livré à {} : note {}/10, +{} €{}, renommée {:+}.", p.at("nom"), p.at("client"), note, mil(paie), dont, gain).replace('_', " "),
                "bon",
            );
            e.at("historique").insert(
                0,
                dict! {"nom" => p.at("nom"), "client" => p.at("client"), "note" => &note, "montant" => paie,
                "jours" => p.at("jours"), "type" => "contrat", "avis" => Jeu::avis(nf)},
            );
            if p.ati("taille") >= 300 && p.ati("echecs_cem") == 0 && nf >= 8.0 {
                self.trophee("sans_faute");
            }
        } else {
            let ventes = VENTES * p.atf("potentiel") * py::pow(nf / 10.0, 2.0) * (1.0 + e.ati("renommee").min(25) as f64 / 25.0);
            let prix = 20i64.max(py::round(p.atf("potentiel") / 60.0));
            let (ni, nq) = (Jeu::niveau(p, "indus") as f64, Jeu::niveau(p, "qualif") as f64);
            let (qi, qq) = (self.qualite_projet(p, "indus"), self.qualite_projet(p, "qualif"));
            let demande = 5i64.max(py::round(ventes * 2.0 / prix as f64)); // unités par mois (×2 : la fabrication coûte la moitié du prix)
            let prod = dict! {
                "nom" => p.at("nom"), "id_produit" => p.at("id_produit"), "note" => &note, "prix" => prix, "stock" => 0, "mois" => 0, "total" => 0,
                "demande" => demande,
                "cout_unite" => py::round_n(prix as f64 * 0.5 * (1.0 - 0.15 * ni * qi), 2), // l'indus baisse le coût unitaire
                "defaut_lot" => py::round_n(0.12 * (1.0 - 0.35 * ni * qi), 3), "pannes" => py::round_n(0.04 * (1.0 - 0.35 * nq * qq), 3),
            };
            prod.set("ventes", demande * prix);
            e.at("produits").push(prod);
            e.at("stats").inc("produits_lances", 1i64);
            if nf >= 8.0 {
                e.inc("renommee", self.arrondi_hasard(self.frein_renommee()));
            }
            self.log(&format!("« {} » est en vente ! Note de la presse : {}/10.", p.at("nom"), note), "bon");
            e.at("historique").insert(
                0,
                dict! {"nom" => p.at("nom"), "client" => "Produit maison", "note" => &note, "montant" => 0,
                "jours" => p.at("jours"), "type" => "produit", "avis" => Jeu::avis(nf)},
            );
        }
        let st = e.at("stats");
        for (cle, niveau) in [("indus", Jeu::niveau(p, "indus")), ("qualif", Jeu::niveau(p, "qualif"))] {
            st.set(cle, st.get_or(cle, 0) + (niveau > 0) as i64);
            let cle2 = format!("{cle}_produit");
            st.set(cle2.as_str(), st.get_or(cle2.as_str(), 0) + (niveau == 2) as i64);
        }
        e.at("exercice").at("notes").push(&note);
        tronquer(&e.at("historique"), 30);
        e.at("projets").remove(p);
        for x in e.at("employes").iter() {
            if x.get("projet") == p.at("id") {
                x.set("projet", Val::None);
            }
        }
        e.set("dernier_livre", e.at("historique").at(0));
        let montant = e.at("historique").at(0).at("montant");
        self.apres_livraison(p, &note, &montant);
    }

    /// Chaque point de renommée est plus dur à gagner quand on est déjà connu (÷6 à 2, ÷88 à 10, ÷400 à 20).
    pub fn frein_renommee(&self) -> f64 {
        1.0 / py::pow(1.0 + self.etat.atf("renommee") / 2.0, 2.5)
    }

    /// Arrondi aléatoire : 0,3 donne 1 trois fois sur dix (les petits gains ne disparaissent pas).
    pub fn arrondi_hasard(&self, x: f64) -> i64 {
        let i = py::int(x);
        i + (self.random() < x - i as f64) as i64
    }

    fn avis(note: f64) -> &'static str {
        if note >= 9.0 {
            "Travail exceptionnel, on vous confie la suite !"
        } else if note >= 7.5 {
            "Très bon travail, client satisfait."
        } else if note >= 6.0 {
            "Correct, quelques retouches à prévoir."
        } else if note >= 4.0 {
            "Décevant : trop de défauts ou de retard."
        } else {
            "Inacceptable. Ce client ne reviendra pas."
        }
    }

    pub fn encadre(&self, emp: &Val) -> bool {
        self.roles().at("actifs").has(format!("resp_{}", Jeu::service(emp)))
    }

    /// Plus on est nombreux sur un projet, plus on perd de temps à se coordonner ; un responsable et un chef de projet limitent la perte.
    pub fn coordination(&self, emp: &Val, p: &Val, equipe: usize) -> f64 {
        if self.encadre(emp) {
            return 1.0;
        }
        1.0 - 0.18f64.min(0.03 * 0i64.max(equipe as i64 - 3) as f64) * (1.0 - 0.5 * p.get_or("suivi", 0).f())
    }

    /// Chaque projet est suivi par le chef de projet le moins chargé ; son effet baisse avec le nombre de projets qu'il suit.
    pub fn suivi_chefs(&self) {
        let e = &self.etat;
        let chefs = py::sorted_by_key(self.chefs_projet(), |c| -self.metier(c, "gestion"));
        let charge = Val::dict();
        for c in &chefs {
            charge.set(c.at("id"), 0);
        }
        for p in py::sorted_by_key(e.at("projets").vec(), |p| -p.atf("taille")) {
            match py::min_by_key(chefs.iter(), |c| charge.at(c.at("id"))) {
                Some(c) => {
                    p.set("chef", c.at("id"));
                    charge.inc(c.at("id"), 1i64);
                }
                None => p.set("chef", Val::None),
            }
        }
        for p in e.at("projets").iter() {
            let chef = p.at("chef");
            let suivi = if chef.truthy() { Val::Float(py::round_n(1.0 / py::pow(charge.atf(&chef), 0.5), 3)) } else { Val::Int(0) };
            p.set("suivi", suivi);
        }
    }

    pub fn experience(&self, emp: &Val, dom: &str, pts: f64) {
        let sen = d("SENIORITES").at(emp.at("seniorite")).atf("xp");
        let gain = pts
            * sen
            * (if emp.at("traits").has("ambitieux") { 1.3 } else { 1.0 })
            * (if self.encadre(emp) { 1.25 } else { 1.0 })
            * (if self.a_investi("formation") != 0 { 1.25 } else { 1.0 });
        let xp = emp.at("xp");
        xp.set(dom, &xp.at(dom) + gain);
        let niv = emp.ati(dom);
        let seuil = 60 + 6 * niv * niv;
        if xp.at(dom) >= seuil && niv < 15 {
            xp.set(dom, &xp.at(dom) - seuil);
            emp.set(dom, niv + 1);
            if !emp.getb("fondateur") && !emp.getb("stage") {
                emp.inc("salaire", d("HAUSSE_POINT"));
            }
            self.log(&format!("{} progresse en {} ({}).", emp.at("nom"), d("NOM_DOMAINE").at(dom), niv + 1), "bon");
        }
    }

    // ------------------------------------------------------------------ trophées, bilans, fin
    pub fn trophee(&self, tid: &str) {
        let t = self.etat.at("trophees");
        if !t.has(tid) {
            t.push(tid);
            self.log(&format!("Trophée débloqué : {} !", d("TROPHEES").at(tid).at("nom")), "trophee");
        }
    }

    pub fn verifier_trophees(&self) {
        let e = &self.etat;
        let st = e.at("stats");
        let notes: Vec<f64> = e.at("historique").iter().map(|h| h.atf("note")).collect();
        let etages: Vec<Val> = self.roles().at("pieces").values().into_iter().filter(Val::truthy).map(|k| d("PIECES").at(&k).at("etage")).collect();
        let nb = |cle: &str| e.at(cle).len();
        let conditions = [
            ("premier_contrat", st.at("livres") >= 1i64),
            ("note_9", notes.iter().any(|&n| n >= 9.0)),
            ("note_10", notes.iter().any(|&n| n >= 10.0)),
            ("equipe_6", nb("employes") >= 6),
            ("equipe_10", nb("employes") >= 10),
            ("parallele", nb("projets") >= 3),
            ("trio", e.at("combos_vus").has("trio")),
            ("siege", self.dg_actif()),
            ("trois_produits", st.at("produits_lances") >= 3i64),
            ("produit_star", e.at("historique").iter().any(|h| h.at("type") == "produit" && h.atf("note") >= 8.5)),
            ("vingt_contrats", st.at("livres") >= 20i64),
            ("renommee_10", e.at("renommee") >= 10i64),
            ("renommee_25", e.at("renommee") >= 25i64),
            ("cent_mille", e.at("argent") >= 100_000i64),
            ("million", e.at("argent") >= 1_000_000i64),
            ("batiment_b", ["rdc", "r1", "r2"].iter().all(|x| etages.iter().any(|v| v == x))),
            ("usine", st.get_or("indus_produit", 0) >= 1i64),
            ("partenaire", e.at("clients").values().iter().any(|c| c.at("fid") >= d("FIDELITE_MAX"))),
            ("gamme", st.at("suites") >= 1i64),
            ("mega", st.at("megas") >= 1i64),
            ("cinquante", st.at("livres") >= 50i64),
            ("dix_missions", nb("missions") >= 10),
            ("toutes_missions", nb("missions") >= d("MISSIONS").len()),
        ];
        for (tid, ok) in conditions {
            if ok {
                self.trophee(tid);
            }
        }
        self.verifier_missions();
    }

    pub fn bilan(&self) {
        let e = &self.etat;
        let x = e.at("exercice");
        let benefice = x.at("ca") - x.at("charges");
        let impot = arrondi_entier(0f64.max(benefice.f()) * d("DIFFICULTES").at(e.at("difficulte")).atf("impot"), 1);
        e.dec("argent", impot);
        let an = py::floordiv_i(e.ati("jours_total"), d("JOURS_AN").i());
        let notes = x.at("notes");
        let note_moy = if notes.truthy() { Val::Float(py::round_n(py::sum_v(notes.iter()).f() / notes.len() as f64, 1)) } else { Val::None };
        let bilan = dict! {
            "annee" => an, "ca" => x.at("ca"), "charges" => x.at("charges"), "benefice" => &benefice, "impot" => impot,
            "livres" => x.at("livres"), "note_moy" => note_moy,
            "renommee" => e.at("renommee") - x.at("rep0"), "employes" => e.at("employes").len(), "tresorerie" => e.at("argent"),
        };
        e.at("bilans").push(&bilan);
        e.set("bilan", bilan);
        e.set("exercice", self.exercice_vide());
        self.log(&format!("Bilan de l'année {an} : bénéfice {} €, impôt −{} €.", mil_v(&benefice), mil(impot)).replace('_', " "), "info");
        if an >= d("DUREE_PARTIE_ANS").i() && !e.has("fin") {
            e.set("fin", self.score_final());
        }
    }

    pub fn score_final(&self) -> Val {
        let e = &self.etat;
        let st = e.at("stats");
        let notes: Vec<Val> = e.at("historique").iter().map(|h| h.at("note")).collect();
        let moy = if notes.is_empty() { 0.0 } else { py::sum_v(notes.iter().cloned()).f() / notes.len() as f64 };
        let score = py::round(
            (st.atf("ca") / 1000.0 + e.atf("renommee") * 40.0 + e.at("trophees").len() as f64 * 150.0 + moy * 100.0) * e.get_or("parts", 1).f(),
        );
        let titre = d("TITRES_FIN").iter().find(|t| score < t.ati(0)).expect("titre de fin").at(1);
        let directeur = e.at("employes").iter().find(|x| x.getb("fondateur")).expect("fondateur").at("nom");
        let note_moy = if notes.is_empty() { Val::Int(0) } else { Val::Float(py::round_n(moy, 1)) };
        dict! {
            "score" => score, "titre" => titre, "vue" => false, "entreprise" => e.at("entreprise"), "directeur" => directeur,
            "ca" => st.at("ca"), "livres" => st.at("livres"), "renommee" => e.at("renommee"), "trophees" => e.at("trophees").len(), "note_moy" => note_moy,
        }
    }

    // ------------------------------------------------------------------ temps
    pub fn en_pause(&self) -> bool {
        let e = &self.etat;
        e.atb("evenement")
            || e.atb("faillite")
            || e.getb("bilan")
            || (e.getb("fin") && !e.at("fin").atb("vue"))
            || (e.getb("victoire") && !e.at("victoire").atb("vue"))
    }

    pub fn avancer(&self, jours: i64) {
        for _ in 0..1i64.max(30i64.min(jours)) {
            if self.en_pause() {
                break;
            }
            self.jour();
        }
    }

    pub fn jour(&self) {
        let e = &self.etat;
        self.oublier_roles();
        e.inc("jour", 1i64);
        e.inc("jours_total", 1i64);
        if e.ati("jour") > JOURS_MOIS {
            e.set("jour", 1);
            e.inc("mois", 1i64);
            if e.ati("mois") > 11 {
                e.set("mois", 0);
                e.inc("annee", 1i64);
            }
            self.debut_mois();
        }
        self.debut_jour_extensions();
        let bon = self.bonus();
        for emp in e.at("employes").iter() {
            emp.set("tache", Val::None);
            emp.set("gain", 0);
            emp.set("projet_jour", Val::None);
        }
        self.suivi_chefs();
        let equipes = self.repartir();
        for p in e.at("projets").iter() {
            p.inc("jours", 1i64);
            self.travailler(&p, &equipes.at(p.at("id")).vec(), &bon);
            if e.at("projets").has(&p) && p.at("type") == "contrat" && p.at("jours") == p.at("delai") + 1i64 {
                self.log(&format!("Retard sur « {} » : la note client va baisser.", p.at("nom")), "mauvais");
            }
        }
        let par_id = Val::dict();
        for p in e.at("projets").iter() {
            par_id.set(p.at("id"), &p);
        }
        for emp in e.at("employes").iter() {
            self.placer(&emp, &par_id.get(emp.at("projet_jour")));
        }
        e.pop("reunion");
        let h = self.horaires();
        for emp in e.at("employes").iter() {
            if emp.at("absent") > 0i64 {
                emp.dec("absent", 1i64);
                emp.set("fatigue", vmax(0, &emp.at("fatigue") - 3i64));
                if emp.at("absent") == 0i64 {
                    emp.set("absence", Val::None);
                }
                if emp.at("absent") == 0i64 && emp.atb("formation") {
                    let dom = emp.at("formation");
                    emp.set(&dom, vmin(15, &emp.at(&dom) + 2i64));
                    emp.set("formation", Val::None);
                    self.log(&format!("{} revient de formation : {} {}.", emp.at("nom"), d("NOM_DOMAINE").at(&dom), emp.at(&dom)), "bon");
                }
            } else if emp.atb("tache") {
                emp.set("fatigue", vmin(50, &emp.at("fatigue") + 1.2 * self.trait_(&emp, "fatigue") * h.atf("fatigue")));
            } else {
                emp.set("fatigue", vmax(0, &emp.at("fatigue") - if self.emmenage() { 5i64 } else { 3i64 }));
            }
        }
        self.jour_personnel();
        let pannes = e.at("pannes");
        for pid in pannes.keys() {
            pannes.dec(&pid, 1i64);
            if pannes.at(&pid) <= 0i64 {
                pannes.del(&pid);
                let nom = champ(&d("MATERIEL").get(&pid), "nom");
                self.log(&format!("{} réparé.", if nom.is_some() { nom } else { pid.clone() }), "info");
            }
        }
        for o in e.at("offres").iter() {
            o.dec("expire", 1i64);
        }
        e.set("offres", Val::list(e.at("offres").iter().filter(|o| o.at("expire") > 0i64).collect()));
        let spontanees = e.at("offres").iter().filter(|o| !o.getb("canal")).count() as i64;
        if spontanees < self.nb_offres() + e.at("projets").len() as i64 && self.random() < 0.15 {
            let o = self.offre(0, &Val::None);
            e.at("offres").push(o);
        }
        self.jour_commerce();
        if e.ati("jours_total") > 10 && self.random() < 1.0 / 18.0 {
            self.evenement();
        }
        self.fin_jour_extensions();
        self.verifier_trophees();
        if py::mod_i(e.ati("jours_total"), d("JOURS_AN").i()) == 0 {
            self.bilan();
        }
        if e.at("argent") < SEUIL_FAILLITE {
            e.set("faillite", true);
            self.log("Faillite : la banque ferme le compte.", "mauvais");
        }
    }

    /// Choisit la pièce où l'employé passe la journée (pour l'animation du plan).
    fn placer(&self, emp: &Val, p: &Val) {
        let e = &self.etat;
        let t = emp.at("tache");
        if emp.atb("absent") {
            emp.set("lieu", Val::None);
            return;
        }
        let lieu = if e.getb("fete") {
            "fete"
        } else if e.getb("reunion") {
            "reunion"
        } else if t == "e" {
            let premiere = p.truthy() && p.at("etape") == "travail" && p.at("phase") == 0i64;
            if !premiere && self.random() < 0.6 { "labo" } else { "bureau" }
        } else if t == "m" {
            if e.at("locaux").has("atelier") && self.random() < 0.65 { "atelier" } else { "bureau" }
        } else if t == "f" {
            if self.random() < 0.25 { "labo" } else { "bureau" }
        } else if t == "debug" {
            if self.random() < 0.5 { "labo" } else { "bureau" }
        } else if t == "cem" {
            if self.random() < 0.3 { "pause" } else { "bureau" } // les cartes sont au labo externe
        } else if self.random() < 0.75 {
            "pause"
        } else {
            "bureau"
        };
        let mut lieu = lieu.to_string();
        emp.set("visite", Val::None);
        if (t == "e" || t == "m" || t == "f" || t == "debug") && lieu != "reunion" && self.random() < 0.12 {
            // va demander conseil au collègue le plus fort du domaine, sur le même projet
            let dom = if t == "debug" { "f".to_string() } else { t.string() };
            let collegues: Vec<Val> =
                e.at("employes").iter().filter(|x| !x.is(emp) && !x.atb("absent") && x.get("projet_jour") == emp.get("projet_jour")).collect();
            if !collegues.is_empty() {
                let expert = py::max_by_key(collegues, |x| x.at(dom.as_str())).unwrap();
                emp.set("visite", expert.at("id"));
                if expert.at(dom.as_str()) > emp.at(dom.as_str()) {
                    self.experience(emp, &dom, (expert.at(dom.as_str()) - emp.at(dom.as_str())).f()); // on apprend en demandant conseil
                }
                emp.set("lieu", "visite");
                emp.set("tache_prec", &t);
                return;
            }
        }
        // inertie : même tâche, on reste souvent au même endroit (déplacements moins frénétiques)
        let ancien = emp.get("lieu");
        let mobile = !(ancien.is_none() || ancien == "reunion" || ancien == "visite" || ancien == "fete");
        if mobile && lieu != "reunion" && lieu != "fete" && emp.get("tache_prec") == t && self.random() < 0.6 {
            lieu = ancien.string();
        }
        emp.set("lieu", lieu.as_str());
        emp.set("tache_prec", &t);
    }

    fn debut_mois(&self) {
        let e = &self.etat;
        let (loyer, sal, frais) = (self.loyer(), self.salaires(), self.frais_structure());
        let (ventes, frais_stock) = self.ventes_du_mois();
        let (rec, dep, autres, capital) = self.mois_extensions();
        self.encaisser(ventes + rec);
        self.depenser(loyer + sal + frais + dep + frais_stock);
        e.dec("argent", capital); // remboursement du capital : sortie de trésorerie, pas une charge
        let mut texte = format!("Fin de mois : loyer −{} €, salaires −{} €", mil(loyer), mil(sal));
        if frais != 0 {
            texte += &format!(", frais de structure −{} €", mil(frais));
        }
        if ventes != 0 {
            texte += &format!(", ventes +{} €", mil(ventes));
        }
        if frais_stock != 0 {
            texte += &format!(", stockage −{} €", mil(frais_stock));
        }
        for m in autres {
            texte += ", ";
            texte += &m;
        }
        self.log(&(texte + "."), "info");
        while (e.at("offres").len() as i64) < self.nb_offres() {
            let o = self.offre(0, &Val::None);
            e.at("offres").push(o);
        }
        for _ in 0..2 {
            if e.at("candidats").truthy() {
                e.at("candidats").pop(0i64);
            }
        }
        while e.at("candidats").len() < NB_CANDIDATS {
            let c = self.candidat();
            e.at("candidats").push(c);
        }
        for emp in e.at("employes").iter() {
            emp.set("humeur", borne(&emp.at("humeur") + self.randint(-2, 2), -8, 8));
        }
        self.mois_personnel();
        if e.at("argent") < 0i64 {
            self.log("Trésorerie négative ! Sous −5 000 €, c'est la faillite.", "mauvais");
        }
    }

    // ------------------------------------------------------------------ évènements
    pub fn evenement(&self) {
        let e = &self.etat;
        let en_travail: Vec<Val> = e.at("projets").iter().filter(|p| p.at("etape") == "travail").collect();
        let mut possibles: Vec<Val> = Vec::new();
        if !en_travail.is_empty() {
            let p = self.choice(&Val::list(en_travail.clone()));
            let cout = Val::Int(400) + p.at("taille") * 6i64;
            possibles.push(dict! {
                "type" => "penurie", "titre" => "Pénurie de composants", "projet" => p.at("id"),
                "texte" => format!("Le microcontrôleur de « {} » est en rupture chez tous les distributeurs.", p.at("nom")),
                "options" => list![format!("Acheter chez un broker (−{} €)", mil_v(&cout)), "Re-concevoir avec un équivalent (plus long, plus de défauts)"],
                "cout" => cout,
            });
        }
        let presses: Vec<Val> = en_travail.iter().filter(|p| p.at("type") == "contrat" && p.ati("delai") - p.ati("jours") > 15).cloned().collect();
        if !presses.is_empty() {
            let p = self.choice(&Val::list(presses));
            possibles.push(dict! {
                "type" => "presse", "titre" => "Client pressé", "projet" => p.at("id"),
                "texte" => format!("{} veut avancer la livraison de « {} » de 7 jours, contre 20 % de plus.", p.at("client"), p.at("nom")),
                "options" => list!["Accepter le défi", "Refuser poliment"],
            });
        }
        if e.at("renommee") >= 1i64 && e.at("argent") > 5000i64 {
            possibles.push(dict! {
                "type" => "salon", "titre" => "Salon professionnel",
                "texte" => "Un stand se libère au salon de l'électronique embarquée.",
                "options" => list!["Exposer (−3 000 €)", "Ne pas y aller"],
            });
        }
        let cassables: Vec<Val> = self.materiel_actif().into_iter().filter(|m| d("MATERIEL").at(m).ati("prix") >= 1000).collect();
        if !cassables.is_empty() {
            let mid = self.choice(&Val::list(cassables));
            let m = d("MATERIEL").at(&mid);
            let rep = py::floordiv_i(m.ati("prix") * 15, 100);
            possibles.push(dict! {
                "type" => "panne", "titre" => "Panne de matériel",
                "texte" => format!("{} vient de tomber en panne.", m.at("nom")),
                "options" => list![format!("Réparer tout de suite (−{} €)", mil(rep)), "Attendre la pièce (15 jours sans l'appareil)"],
                "materiel" => &mid, "cout" => rep,
            });
        }
        if e.at("renommee") >= 2i64 {
            possibles.push(dict! {
                "type" => "subvention", "titre" => "Subvention innovation",
                "texte" => "La région finance les PME innovantes. Le dossier est lourd.",
                "options" => list!["Monter le dossier (+4 000 €, équipe fatiguée)", "Pas le temps"],
            });
        }
        let mecontents: Vec<Val> = e.at("employes").iter().filter(|x| !x.getb("fondateur") && self.moral(x) < 35.0).collect();
        if !mecontents.is_empty() {
            let emp = self.choice(&Val::list(mecontents));
            possibles.push(dict! {
                "type" => "demission", "titre" => "Menace de démission",
                "texte" => format!("{} n'en peut plus et pense à partir.", emp.at("nom")),
                "options" => list!["Augmenter son salaire (+500 €/mois)", "Le laisser partir"],
                "employe" => emp.at("id"),
            });
        }
        if e.at("heures") >= 10i64 && e.at("employes").len() > 1 {
            possibles.push(dict! {
                "type" => "greve", "titre" => "Ras-le-bol général",
                "texte" => format!("L'équipe ne supporte plus les journées de {} h.", e.at("heures")),
                "options" => list!["Revenir à 8 h par jour", "Tenir bon (moral en baisse)"],
            });
        }
        if e.at("stats").at("livres") >= 2i64 && self.random() < 0.3 {
            possibles.push(dict! {
                "type" => "recommandation", "titre" => "Bouche-à-oreille",
                "texte" => "Un ancien client vous recommande à son réseau.", "options" => list!["Merci !"],
            });
        }
        self.evenements_extensions(&mut possibles);
        self.evenements_personnel(&mut possibles);
        let vus = e.setdefault("derniers_ev", dict! {});
        let jt = e.ati("jours_total");
        let possibles: Vec<Val> = possibles.into_iter().filter(|x| jt - vus.get_or(x.at("type"), -999).i() >= 60).collect();
        if !possibles.is_empty() {
            let ev = self.choice(&Val::list(possibles));
            e.set("evenement", &ev);
            vus.set(ev.at("type"), jt);
        }
    }

    fn resoudre(&self, choix: &Val) -> R {
        let e = &self.etat;
        let ev = e.at("evenement");
        if !ev.truthy() {
            return erreur("Aucun évènement en attente.");
        }
        let c = choix.i();
        if !(0 <= c && c < ev.at("options").len() as i64) {
            return erreur("Choix invalide.");
        }
        let t = ev.at("type");
        let p = e.at("projets").iter().find(|x| x.at("id") == ev.get("projet"));
        if self.resoudre_extension(&ev, c)? || self.resoudre_personnel(&ev, c)? {
        } else if t == "penurie" && p.is_some() {
            let p = p.unwrap();
            if c == 0 {
                self.payer(ev.at("cout"))?;
            } else {
                let ph = p.at("phases").at(p.at("phase"));
                ph.at("besoin").set("e", ph.at("besoin").get_or("e", 0) + py::round(p.atf("taille") * 0.08));
                ph.at("fait").setdefault("e", 0.0);
                p.inc("defauts", p.atf("taille") * 0.03);
            }
        } else if t == "presse" && p.is_some() && c == 0 {
            let p = p.unwrap();
            p.dec("delai", 7i64);
            p.set("paie", py::int(p.atf("paie") * 1.2));
        } else if t == "salon" && c == 0 {
            self.payer(3000)?;
            e.inc("renommee", self.arrondi_hasard(2.0 * self.frein_renommee()));
            let garder = e.at("offres").slice(None, Some(self.nb_offres()));
            for _ in 0..2 {
                let o = self.offre(2, &Val::None);
                garder.push(o);
            }
            e.set("offres", garder);
        } else if t == "panne" {
            if c == 0 {
                self.payer(ev.at("cout"))?;
            } else {
                e.at("pannes").set(ev.at("materiel"), 15);
            }
        } else if t == "subvention" && c == 0 {
            self.encaisser(4000);
            for x in e.at("employes").iter() {
                x.set("fatigue", vmin(50, &x.at("fatigue") + 8i64));
            }
        } else if t == "demission" {
            if let Some(emp) = e.at("employes").iter().find(|x| x.at("id") == ev.at("employe")) {
                if c == 0 {
                    emp.inc("salaire", 500i64);
                    emp.set("humeur", 8);
                } else {
                    e.at("employes").remove(&emp);
                    self.log(&format!("{} a quitté l'équipe.", emp.at("nom")), "mauvais");
                }
            }
        } else if t == "greve" {
            if c == 0 {
                e.set("heures", 8);
            } else {
                for x in e.at("employes").iter() {
                    x.set("humeur", borne(&x.at("humeur") - 4i64, -8, 8));
                }
            }
        } else if t == "recommandation" {
            e.inc("renommee", self.arrondi_hasard(self.frein_renommee()));
        }
        e.set("evenement", Val::None);
        self.log(&format!("{} : {}.", ev.at("titre"), ev.at("options").at(c)), "info");
        Ok(())
    }

    // ------------------------------------------------------------------ actions du joueur
    /// `jeu.action(genre, **p)` : une action du joueur ; `p` est le dict de ses paramètres.
    pub fn action(&self, genre: &Val, p: &Val) -> R {
        self.oublier_roles();
        let r = self.action_(genre, p);
        self.oublier_roles();
        r
    }

    fn action_(&self, genre_v: &Val, p: &Val) -> R {
        let e = &self.etat;
        for cle in ["jours", "choix", "heures", "montant"] {
            if p.has(cle) && !entier(&p.at(cle)) {
                return erreur("Paramètres invalides.");
            }
        }
        if p.has("id") && !(entier(&p.at("id")) || p.at("id").is_str()) {
            return erreur("Paramètres invalides.");
        }
        if p.has("projet") && !(p.at("projet").is_none() || entier(&p.at("projet"))) {
            return erreur("Paramètres invalides.");
        }
        // un genre qui n'est pas un texte ne vaut aucune action (« Action inconnue » à la fin)
        let genre = if let Val::Str(s) = genre_v { s.to_string() } else { "\u{0}".to_string() };
        let g = genre.as_str();
        if e.atb("faillite") && g != "avancer" {
            return erreur("La société est en faillite.");
        }
        if g == "avancer" {
            self.avancer(p.get_or("jours", 1).i());
        } else if g == "evenement" {
            self.resoudre(&p.get_or("choix", 0))?;
        } else if g == "fermer_note" {
            e.pop("dernier_livre");
        } else if g == "fermer_bilan" {
            e.pop("bilan");
        } else if g == "fermer_fin" {
            if e.getb("fin") {
                e.at("fin").set("vue", true);
            }
        } else if self.action_extension(g, p)? || self.action_personnel(g, p)? || self.action_commerce(g, p)? {
        } else if g == "signer" {
            let Some(o) = e.at("offres").iter().find(|x| x.at("id") == p.get("id")) else {
                return erreur("Cette offre n'est plus disponible.");
            };
            self.verifier_capacite(if o.getb("mega") { 2 } else { 1 })?;
            if (e.at("employes").len() as i64) < o.get_or("equipe_min", 0).i() {
                return erreur(format!("Il faut une équipe d'au moins {} personnes pour ce méga-projet.", o.at("equipe_min")));
            }
            let (mut prix, mut delai) = (p.get_or("prix", "1.0").to_string(), p.get_or("delai", "1.0").to_string());
            if o.getb("gagne") {
                // devis déjà accepté : prix et délai fixés
                prix = "1.0".into();
                delai = "1.0".into();
            }
            if !d("PRIX_PROPOSES").has(prix.as_str()) || !d("DELAIS_PROPOSES").has(delai.as_str()) {
                return erreur("Paramètres invalides.");
            }
            let (prix, delai): (f64, f64) = (prix.parse().expect("prix proposé"), delai.parse().expect("délai proposé"));
            let tech = if p.get("tech").is_dict() { p.at("tech").copy() } else { Val::dict() };
            let exigeant = d("EXIGEANTS").has(&o.get("secteur"));
            if exigeant {
                tech.setdefault("qualif", "carte"); // sans choix explicite, la qualification minimale exigée
            }
            let choix = self.choix_valides(&tech)?;
            if exigeant && choix.at("qualif") == "aucune" {
                return erreur("Ce client exige une qualification (carte ou produit fini).");
            }
            let presta = self.presta_valides(&p.get("presta"), &o, &choix)?;
            let (base, cout) = self.appliquer_choix(&o, &choix, &presta);
            if cout != 0 && e.at("argent") < cout {
                return erreur("Trésorerie insuffisante pour les frais payés à la signature.");
            }
            e.at("offres").remove(&o);
            if self.random() >= self.chance_negociation(prix, delai, o.get_or("fidele", 0).f()) {
                let c = self.choice(&e.at("concurrents"));
                e.set("renommee", vmax(0, &e.at("renommee") - 1i64));
                self.log(&format!("Négociation perdue : {} remporte « {} ». Le client a mal pris vos exigences (renommée −1).", c.at("nom"), o.at("nom")), "mauvais");
                self.verifier_trophees();
                return Ok(());
            }
            let base = base.copy();
            base.set("paie", arrondi_entier(o.atf("paie") * prix, 1));
            base.set("delai", 8i64.max(py::round(o.atf("delai") * delai)));
            if cout != 0 {
                self.depenser(cout);
            }
            let pr = self.creer_projet(&base, "contrat");
            pr.set("choix", &choix);
            pr.set("requis", o.get("requis"));
            self.confier(&pr, &presta);
            e.at("projets").push(&pr);
            e.set("reunion", true);
            pr.set("acompte", arrondi_entier(pr.atf("paie") * 0.3, 1));
            self.etapes(&pr);
            self.kickoff(&pr);
            if !self.commerciaux().is_empty() {
                // chacun touche sa part
                let com = arrondi_entier(pr.atf("paie") * d("COMMISSION").f() * 3usize.min(self.commerciaux().len()) as f64, 1);
                self.depenser(com);
                self.log(&format!("Commission des commerciaux : −{} €.", mil(com)), "info");
            }
            self.encaisser(pr.at("acompte"));
            self.log(&format!("Contrat signé avec {} : « {} » (acompte +{} €).", o.at("client"), o.at("nom"), mil(pr.ati("acompte"))), "info");
        } else if g == "produit" {
            self.verifier_capacite(1)?;
            let prod = d("PRODUITS").iter().find(|x| x.at("id") == p.get("id"));
            let Some(prod) = prod.filter(|x| e.at("renommee") >= x.at("rep_min")) else {
                return erreur("Produit indisponible.");
            };
            if prod.getb("innovation") && !self.roles().at("actifs").has("innov") {
                return erreur("Idée réservée au chargé d'innovation : nommez-le dans Équipe.");
            }
            if prod.getb("requis") && !e.at("technos").has(&prod.at("requis")) {
                return erreur(format!("Il faut d'abord maîtriser : {}.", d("TECHNOS").at(prod.at("requis")).at("nom")));
            }
            if prod.getb("suite") && !e.at("gammes").has(&prod.at("suite")) {
                let nom = d("PRODUITS").iter().find(|x| x.at("id") == prod.at("suite")).expect("produit précédent").at("nom");
                return erreur(format!("Lancez d'abord « {nom} »."));
            }
            if e.at("produits").iter().chain(e.at("projets").iter()).any(|x| x.get("id_produit") == prod.at("id")) {
                return erreur("Ce produit est déjà en vente ou en développement.");
            }
            let choix = self.choix_valides(&p.get("tech"))?;
            let total = Val::dict();
            for (dom, part) in d("DOMAINES").iter().zip(prod.at("rep").iter()) {
                total.set(&dom, py::round(prod.atf("taille") * part.f()));
            }
            let taille: i64 = total.values().iter().map(Val::i).sum();
            let base = dict! {
                "nom" => prod.at("nom"), "taille" => taille, "total" => total,
                "potentiel" => py::round(prod.atf("potentiel") * self.bonus_suite(&prod)), "id_produit" => prod.at("id"),
            };
            let presta = self.presta_valides(&p.get("presta"), &base, &choix)?;
            let (base, cout) = self.appliquer_choix(&base, &choix, &presta);
            self.payer(prod.ati("cout") + cout)?;
            let pr = self.creer_projet(&base, "produit");
            pr.set("choix", &choix);
            self.confier(&pr, &presta);
            self.etapes(&pr);
            self.kickoff(&pr);
            e.at("projets").push(&pr);
            e.set("reunion", true);
            self.log(&format!("Développement de votre produit « {} » lancé.", prod.at("nom")), "info");
        } else if g == "tests_cem" {
            let pr = self.projet(&p.get("id"))?;
            if pr.at("etape") != "debug" {
                return erreur("Le projet n'est pas en phase de debug.");
            }
            self.lancer_cem(&pr);
        } else if g == "abandonner" {
            let pr = self.projet(&p.get("id"))?;
            if pr.at("type") == "contrat" {
                e.set("renommee", vmax(0, &e.at("renommee") - 1i64));
                self.encaisser(-pr.get_or("acompte", 0)); // l'acompte est rendu au client
                if e.at("clients").has(&pr.get("client")) {
                    let c = e.at("clients").at(pr.at("client"));
                    c.set("fid", vmax(0, &c.at("fid") - 2i64));
                }
            }
            e.at("projets").remove(&pr);
            for x in e.at("employes").iter() {
                if x.get("projet") == pr.at("id") {
                    x.set("projet", Val::None);
                }
            }
            self.log(&format!("Projet « {} » abandonné.", pr.at("nom")), "mauvais");
        } else if g == "affecter" {
            let emp = self.employe(&p.get("id"))?;
            let cible = p.get("projet");
            if cible.is_some() {
                self.projet(&cible)?;
            }
            emp.set("projet", cible);
        } else if g == "horaires" {
            let h = p.get("heures");
            if !d("HORAIRES").has(&h) {
                return erreur("Horaires inconnus.");
            }
            e.set("heures", &h);
            self.log(&format!("Nouveaux horaires : {}.", d("HORAIRES").at(&h).at("nom")), "info");
        } else if g == "embaucher" {
            let Some(c) = e.at("candidats").iter().find(|x| x.at("id") == p.get("id")) else {
                return erreur("Candidat introuvable.");
            };
            let libres = self.bureaux_libres();
            if libres.is_empty() {
                return erreur("Plus de bureau libre : achetez-en un dans Locaux.");
            }
            e.at("candidats").remove(&c);
            self.nouvel_employe(&c, &libres[0], &Val::dict());
            self.log(&format!("{} rejoint l'équipe ({}).", c.at("nom"), c.at("poste")), "bon");
        } else if g == "licencier" {
            let emp = self.employe(&p.get("id"))?;
            if emp.getb("fondateur") {
                return erreur("Vous ne pouvez pas vous licencier vous-même.");
            }
            self.payer(emp.at("salaire"))?;
            e.at("employes").remove(&emp);
            self.log(&format!("{} quitte la société (indemnité −{} €).", emp.at("nom"), mil_v(&emp.at("salaire"))), "info");
        } else if g == "former" {
            let emp = self.employe(&p.get("id"))?;
            let dom = p.get("dom");
            if !d("DOMAINES").has(&dom) {
                return erreur("Domaine inconnu.");
            }
            if emp.atb("absent") {
                return erreur(format!("{} est déjà absent.", emp.at("nom")));
            }
            self.payer(self.cout_formation(&emp))?;
            emp.set("absent", DUREE_FORMATION);
            emp.set("formation", &dom);
            emp.set("absence", "formation");
            emp.set("derniere_formation", e.at("jours_total"));
            self.log(&format!("{} part {DUREE_FORMATION} jours en formation {}.", emp.at("nom"), d("NOM_DOMAINE").at(&dom)), "info");
        } else if g == "conges" {
            let emp = self.employe(&p.get("id"))?;
            if emp.atb("absent") {
                return erreur(format!("{} est déjà absent.", emp.at("nom")));
            }
            emp.set("absent", DUREE_CONGES);
            emp.set("absence", "conges");
            self.log(&format!("{} part {DUREE_CONGES} jours en congés.", emp.at("nom")), "info");
        } else if g == "acheter" || g == "deco" || g == "poser" {
            let ident = p.get("id");
            if g == "acheter" && !d("MATERIEL").has(&ident) {
                return erreur("Matériel indisponible.");
            }
            if champ(&d("DECO").get(&ident), "global").truthy() {
                if e.at("deco").has(&ident) {
                    return erreur("Déjà installé.");
                }
                let f = d("DECO").at(&ident);
                self.payer(f.at("prix"))?;
                e.at("deco").push(&ident);
                self.log(&format!("{} installé.", f.at("nom")), "bon");
            } else {
                self.poser(&ident, &p.get("x"), &p.get("y"))?;
            }
        } else if g == "deplacer" {
            let o = self.objet(&p.get("id"))?;
            let (x, y) = (p.get("x"), p.get("y"));
            if !(entier(&x) && entier(&y)) {
                return erreur("Paramètres invalides.");
            }
            let grille = d("GRILLE").f();
            let t = o.at("type");
            let (x, y, cote) = self.cote_pres(&t, py::round(x.f() / grille) * grille as i64, py::round(y.f() / grille) * grille as i64)?;
            self.verifier_place(&t, x, y, &o.at("id"), &cote)?;
            o.set("x", x);
            o.set("y", y);
            o.set("cote", cote);
        } else if g == "vendre" {
            let o = self.objet(&p.get("id"))?;
            let t = o.at("type");
            if t == "poste" && e.at("employes").iter().any(|x| x.at("bureau") == o.at("id")) {
                return erreur("Ce bureau est occupé.");
            }
            let f = Jeu::fiche(&t)?;
            e.at("objets").remove(&o);
            if d("MATERIEL").has(&t) {
                e.at("materiel").remove(&t);
                e.at("pannes").pop(&t);
            } else if !e.at("objets").iter().any(|x| x.at("type") == t) {
                e.at("deco").remove(&t);
            }
            let reprise = py::floordiv_i(f.ati("prix"), 2);
            self.encaisser(reprise);
            self.log(&format!("{} revendu (+{} €).", f.at("nom"), mil(reprise)), "info");
        } else if g == "local" {
            let lid = p.get("id");
            let l = d("LOCAUX").get(&lid);
            if !l.truthy() || e.at("locaux").has(&lid) {
                return erreur("Local indisponible.");
            }
            if e.at("renommee") < l.at("rep") {
                return erreur(format!("Renommée {} requise.", l.at("rep")));
            }
            self.payer(l.at("prix"))?;
            e.at("locaux").push(&lid);
            self.replacer_objets()?; // déménagement : tout le garage part dans le bâtiment
            e.inc("stock_max", d("STOCK_BATIMENT").i() - d("STOCK_GARAGE").i()); // la zone de stock du RDC
            self.log(&format!("{} : c'est fait ! Loyer +{} €/mois.", l.at("nom"), l.at("loyer")), "bon");
        } else {
            return erreur(format!("Action inconnue : {genre_v}"));
        }
        self.verifier_trophees();
        Ok(())
    }

    pub fn cout_formation(&self, emp: &Val) -> i64 {
        let points = emp.ati("e") + emp.ati("m") + emp.ati("f");
        let base = 1200 + 150 * points;
        if self.a_investi("formation") != 0 {
            py::int(base as f64 * 0.5)
        } else {
            base
        }
    }

    // ------------------------------------------------------------------ vue pour l'interface
    pub fn vue(&self) -> Val {
        let e = &self.etat;
        self.oublier_roles();
        let v = e.copy();
        v.set("date", format!("{} {} {:02}", e.at("jour"), d("MOIS").at(e.at("mois")), py::mod_i(e.ati("annee"), 100)));
        v.set("moral", py::round(self.moral_global()));
        v.set("bonus", self.bonus());
        v.set("loyer", self.loyer());
        v.set("salaires", self.salaires());
        v.set("frais_structure", self.frais_structure());
        v.set("postes_ouverts", Val::list(self.postes_ouverts()));
        v.set("capacite", self.capacite_projets());
        v.set("places", self.places_occupees());
        v.set("annee_jeu", py::floordiv_i(e.ati("jours_total"), d("JOURS_AN").i()) + 1);
        v.set("attente_client", arrondi(&self.attente_client(), 1));
        let r = self.roles();
        let employes = list![];
        for x in e.at("employes").iter() {
            let y = x.copy();
            y.update(&dict! {
                "moral" => py::round(self.moral(&x)), "cout_formation" => self.cout_formation(&x),
                "efficacite" => py::round(100.0 * self.efficacite(&x)), "service" => Jeu::service(&x),
                "facteur_service" => py::round_n(self.facteur_service(&x), 3), "piece" => r.at("pieces").get(x.at("id")),
                "role_actif" => r.at("actifs").get(x.get("role")) == x.at("id"),
            });
            employes.push(y);
        }
        v.set("employes", employes);
        let services = Val::dict();
        for dom in d("DOMAINES").iter() {
            services.set(&dom, dict! {"n" => r.at("taille").at(&dom), "resp" => r.at("actifs").get(format!("resp_{dom}"))});
        }
        v.set("services", services);
        v.set("roles_actifs", r.at("actifs"));
        let (conditions, facteur) = self.conditions();
        v.set("conditions", conditions);
        v.set("facteur_conditions", facteur);
        let projets = list![];
        for p in e.at("projets").iter() {
            let y = p.copy();
            y.update(&dict! {"note_estimee" => self.note(&p), "proba_cem" => self.proba_cem(&p), "frais_cem" => Jeu::frais_cem(&p)});
            projets.push(y);
        }
        v.set("projets", projets);
        let v = self.vue_extensions(v);
        let v = self.vue_personnel(v);
        self.vue_commerce(v)
    }
}

/// `f"{x:_}".replace("_", " ")` d'une valeur (un entier, en pratique).
pub fn mil_v(v: &Val) -> String {
    match v {
        Val::Int(i) => mil(*i),
        autre => autre.to_string(),
    }
}
