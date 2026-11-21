//! Extensions du moteur (moteur/extensions.py) : choix techniques, R&D, certifications, SAV, négociation, concurrence,
//! séries, fournisseurs, prêts et investisseurs, carrières, vie d'équipe, météo, scénarios et difficulté.

use super::{arrondi_entier, borne, bornef, champ, d, erreur, mil, mil_v, requis_liste, vmax, vmin, Jeu, R};
use crate::py::{self, Val};
use crate::{dict, list};

const DUREE_GARANTIE: i64 = 120;
const DUREE_STAGE: i64 = 90;
const DELAI_SEMINAIRE: i64 = 180;
const CHANGEMENT_METEO: f64 = 0.2; // chance par jour que le temps change (en moyenne tous les 5 jours)

impl Jeu {
    // ------------------------------------------------------------------ mise en place
    pub fn init_extensions(&self, scenario: &Val, difficulte: &Val) -> R {
        let e = &self.etat;
        if !d("SCENARIOS").has(scenario) || !d("DIFFICULTES").has(difficulte) {
            return erreur("Scénario ou difficulté inconnu.");
        }
        e.setdefault("scenario", scenario);
        e.setdefault("difficulte", difficulte);
        let defauts: [(&str, Val); 25] = [
            ("technos", list![]),
            ("certifs", list![]),
            ("recherches", list![]),
            ("garanties", list![]),
            ("series", list![]),
            ("prets", list![]),
            ("fournisseur", Val::str("europe")),
            ("parts", Val::Float(1.0)),
            ("meteo", Val::str("soleil")),
            ("fete", Val::None),
            ("dernier_seminaire", Val::Int(-999)),
            ("victoire", Val::None),
            ("objectif", Val::None),
            ("offre_serie", Val::None),
            ("brevets", list![]),
            ("commandes", list![]),
            ("stock_max", d("STOCK_GARAGE")),
            ("prospection", Val::None),
            ("investissements", dict! {}),
            ("derniere_campagne", Val::Int(-999)),
            ("clients", dict! {}),
            ("gammes", dict! {}),
            ("missions", list![]),
            ("affinites", dict! {}),
            ("affinites_connues", list![]),
        ];
        for (cle, val) in defauts {
            e.setdefault(cle, val);
        }
        let st = e.at("stats");
        for cle in ["megas", "suites", "series"] {
            st.setdefault(cle, 0);
        }
        st.setdefault("secteurs", dict! {});
        if !st.has("meilleure_note") {
            let m = py::max_by_key(e.at("historique").iter().map(|h| h.at("note")), |n| n.clone()).unwrap_or(Val::Int(0));
            st.set("meilleure_note", m);
        }
        for prod in e.at("produits").iter() {
            // anciennes sauvegardes : les produits en vente comptent pour les suites
            e.at("gammes").setdefault(prod.at("id_produit"), prod.at("note"));
        }
        if !e.get("concurrents").truthy() {
            let rivaux = d("CONCURRENTS")
                .iter()
                .map(|c| dict! {"nom" => c.at("nom"), "renommee" => c.at("renommee"), "equipe" => c.at("equipe"), "gagnes" => 0})
                .collect();
            e.set("concurrents", Val::list(rivaux));
        }
        self.init_commerce();
        for x in e.at("employes").iter() {
            self.completer_employe(&x);
        }
        // anciens CV, sans les nouveautés
        let candidats = e.at("candidats").iter().map(|c| if c.has("traits") { c } else { self.candidat() }).collect();
        e.set("candidats", Val::list(candidats));
        Ok(())
    }

    pub fn completer_employe(&self, x: &Val) {
        // (setdefault de Python : les deux tirages ont lieu même si l'anniversaire est déjà connu)
        let anniv = list![self.randint(0, 11), self.randint(1, 30)];
        x.setdefault("anniv", anniv);
        x.setdefault("chef", false);
        x.setdefault("role", Val::None);
        x.setdefault("stage", 0);
        x.setdefault("absence", Val::None);
        self.completer_personnel(x);
    }

    pub fn appliquer_scenario(&self) -> R {
        let e = &self.etat;
        let (sc, diff) = (d("SCENARIOS").at(e.at("scenario")), d("DIFFICULTES").at(e.at("difficulte")));
        e.set("argent", py::int(sc.get_or("argent", 15000).f() * diff.atf("argent")));
        e.set("renommee", sc.get_or("renommee", 0));
        e.set("technos", sc.get_or("technos", list![]).to_list());
        e.set("certifs", sc.get_or("certifs", list![]).to_list());
        e.set("objectif", sc.get("objectif"));
        for lid in sc.get_or("locaux", list![]).iter() {
            e.at("locaux").push(lid);
        }
        if e.at("locaux").has("bureau") {
            self.replacer_objets()?;
            e.set("stock_max", d("STOCK_BATIMENT")); // on reprend une société déjà installée dans le bâtiment
        }
        for _ in 0..sc.get_or("employes", 0).i() {
            let c = self.candidat();
            let libres = self.bureaux_libres();
            let bureau = match libres.first() {
                Some(b) => b.clone(),
                None => {
                    let (x, y, cote) = self.place_auto(&Val::str("poste"), None, &Val::None)?;
                    self.ajouter_objet(&Val::str("poste"), x, y, &cote).at("id")
                }
            };
            self.nouvel_employe(&c, &bureau, &Val::dict());
        }
        if sc.getb("pret") {
            self.ajouter_pret(sc.ati("pret"));
        }
        e.set("exercice", self.exercice_vide());
        if e.at("scenario") != "garage" {
            self.log(&format!("Scénario « {} » : {}", sc.at("nom"), sc.at("desc")), "info");
        }
        Ok(())
    }

    // ------------------------------------------------------------------ effets cumulés
    pub fn mod_bonus(&self, b: &Val) {
        let t = self.etat.at("technos");
        if t.has("ble") {
            b.inc("f", 1i64);
        }
        if t.has("rf") {
            b.inc("cem", 0.05);
        }
        if t.has("fpga") {
            b.inc("debug", 1i64);
        }
    }

    pub fn choix_effets(&self, p: &Val, cle: &str) -> Vec<Val> {
        let mut r = Vec::new();
        for (k, v) in p.get_or("choix", dict! {}).items() {
            let x = d("CHOIX_TECH").at(&k).at("options").at(&v).get(cle);
            if x.is_some() {
                r.push(x);
            }
        }
        r
    }

    pub fn note_bonus(&self, p: &Val) -> f64 {
        let (e, actifs) = (&self.etat, self.roles().at("actifs"));
        let oui = |b: bool| if b { 1.0 } else { 0.0 };
        let n = py::sum_v(self.choix_effets(p, "note")).f() + 0.2 * oui(e.at("technos").has("ia")) + 0.2 * oui(e.at("certifs").has("iso"));
        n + 0.2 * oui(actifs.has("dir_rd")) + 0.3 * oui(actifs.has("innov") && p.at("type") == "produit")
    }

    /// Votre bureau (fondateur) est installé en direction générale.
    pub fn dg_actif(&self) -> bool {
        let pieces = self.roles().at("pieces");
        self.etat.at("employes").iter().any(|x| x.getb("fondateur") && pieces.get(x.at("id")) == "dg")
    }

    pub fn prix_recherche(&self, genre: &str, f: &Val) -> i64 {
        if genre == "tech" && self.roles().at("actifs").has("dir_rd") {
            py::int(f.atf("prix") * 0.75)
        } else {
            f.ati("prix")
        }
    }

    pub fn montant_levee(&self) -> i64 {
        let base = 60000 + 15000 * self.etat.ati("renommee");
        if self.dg_actif() {
            py::int(base as f64 * 1.3)
        } else {
            base
        }
    }

    pub fn cem_bonus(&self, p: &Val) -> f64 {
        py::sum_v(self.choix_effets(p, "cem")).f()
    }

    pub fn facteur_defauts(&self) -> f64 {
        let e = &self.etat;
        let f = d("FOURNISSEURS").at(e.at("fournisseur")).atf("defauts");
        let si = |b: bool, x: f64| if b { x } else { 1.0 };
        f * si(e.at("certifs").has("iso"), 0.85) * si(e.at("technos").has("dfm"), 0.9) * si(e.at("technos").has("secu"), 0.95)
    }

    pub fn facteur_proto(&self, p: &Val) -> f64 {
        let mut f = 1.0;
        for x in self.choix_effets(p, "proto") {
            f *= x.f();
        }
        let dfm = if self.etat.at("technos").has("dfm") { 0.7 } else { 1.0 };
        f * d("FOURNISSEURS").at(self.etat.at("fournisseur")).atf("proto") * dfm
    }

    pub fn facteur_paie(&self, p: &Val) -> f64 {
        let e = &self.etat;
        let prime = py::max_f(requis_liste(&p.get("requis")).iter().map(|x| d("PRIMES").get_or(x, 1).f())).unwrap_or(1.0);
        (if e.at("certifs").has("ce") { 1.05 } else { 1.0 }) * prime * d("DIFFICULTES").at(e.at("difficulte")).atf("paie")
    }

    pub fn mensualites(&self) -> Val {
        py::sum_v(self.etat.at("prets").iter().map(|x| x.at("mensualite")))
    }

    pub fn dette(&self) -> Val {
        py::sum_v(self.etat.at("prets").iter().map(|x| x.at("mensualite") * x.at("mois")))
    }

    pub fn plafond_pret(&self) -> i64 {
        20000 + 8000 * self.etat.ati("renommee")
    }

    // ------------------------------------------------------------------ choix techniques et négociation
    pub fn choix_valides(&self, choix: &Val) -> R<Val> {
        let choix = if choix.is_dict() { choix.clone() } else { Val::dict() };
        let res = Val::dict();
        let mut acquis = self.etat.at("technos").vec();
        acquis.extend(self.etat.at("certifs").vec());
        for (k, cat) in d("CHOIX_TECH").items() {
            let v = choix.get_or(&k, cat.at("defaut"));
            let opt = cat.at("options").get(&v);
            if !opt.truthy() {
                return erreur("Choix technique invalide.");
            }
            if opt.getb("requis") && !acquis.contains(&opt.at("requis")) {
                let req = opt.at("requis");
                let f = d("TECHNOS").get(&req).or_else(|| d("CERTIFS").at(&req));
                return erreur(format!("{} : il faut d'abord {}.", opt.at("nom"), f.at("nom")));
            }
            res.set(&k, v);
        }
        Ok(res)
    }

    /// Qui fait chaque étape ; « interne » quand l'étape n'existe pas sur ce projet.
    pub fn presta_valides(&self, presta: &Val, base: &Val, choix: &Val) -> R<Val> {
        let presta = if presta.is_dict() { presta.clone() } else { Val::dict() };
        let res = Val::dict();
        let total = base.at("total");
        for (k, cat) in d("PRESTATAIRES").items() {
            let v = presta.get_or(&k, "interne");
            if !cat.at("options").has(&v) {
                return erreur("Prestataire invalide.");
            }
            let utile = if total.has(&k) { total.atf(&k) > 0.0 } else { choix.at(&k) != "aucune" };
            res.set(&k, if utile { v } else { Val::str("interne") });
        }
        Ok(res)
    }

    /// Note qui fait quoi ; un prestataire d'indus ou de qualif a une efficacité tirée au sort à la signature.
    pub fn confier(&self, p: &Val, presta: &Val) {
        p.set("presta", presta);
        let q = Val::dict();
        for k in ["indus", "qualif"] {
            let o = d("PRESTATAIRES").at(k).at("options").at(presta.at(k));
            if o.has("qualite") {
                let (a, b) = o.at("qualite").pair();
                q.set(k, py::round_n(self.uniform(a.f(), b.f()), 2));
            }
        }
        p.set("qualite_presta", q);
    }

    /// Modifie les points à produire selon les choix ; renvoie le coût payé à la signature (moule, indus, qualif, prestataires).
    pub fn appliquer_choix(&self, base: &Val, choix: &Val, presta: &Val) -> (Val, i64) {
        let total = base.at("total").copy();
        let mut cout = 0i64;
        for (k, v) in choix.items() {
            let opt = d("CHOIX_TECH").at(&k).at("options").at(&v);
            for dom in ["e", "m", "f"] {
                if opt.has(dom) {
                    total.set(dom, py::round(total.atf(dom) * opt.atf(dom)));
                }
            }
            cout += opt.get_or("cout", 0).i();
        }
        let defaut = d("CHOIX_TECH").at("boitier").at("defaut");
        if base.at("total").at("m") == 0i64 && choix.get("boitier") != defaut {
            choix.set("boitier", defaut); // pas de méca : le choix du boîtier ne s'applique pas
            return self.appliquer_choix(base, choix, presta);
        }
        let base = base.copy();
        base.set("total", &total);
        base.set("taille", py::sum_v(total.values()));
        let offre = |k: &str| d("PRESTATAIRES").at(k).at("options").at(presta.get_or(k, "interne"));
        let etapes = py::sum_v(
            ["indus", "qualif"].iter().map(|k| d("CHOIX_TECH").at(*k).at("options").at(choix.at(*k)).get_or("cout_point", 0) * offre(*k).at("prix")),
        ) * base.at("taille");
        let dev = py::sum_v(["f", "m"].iter().map(|dom| offre(*dom).get_or("prix_point", 0) * total.at(*dom)));
        // le chef de projet pilote l'indus et la qualif
        let reduc = if self.chefs_projet().is_empty() { 1.0 } else { 0.85 };
        (base, cout + arrondi_entier(etapes.f() * reduc, 1) + arrondi_entier(dev.f(), 1))
    }

    /// Au prix et au délai affichés, le client signe à coup sûr ; demander plus est un pari (moins risqué avec un client fidèle).
    pub fn chance_negociation(&self, prix: f64, delai: f64, fid: f64) -> f64 {
        let x = 1.0 - 2.6 * (prix - 1.0) - 0.6 * (delai - 1.0)
            + 0.01 * self.etat.atf("renommee")
            + 0.05 * fid
            + 0.01 * self.meilleur_metier("commercial") as f64
            + if self.dg_actif() { 0.1 } else { 0.0 };
        py::round_n(bornef(x, 0.05, 1.0), 2)
    }

    // ------------------------------------------------------------------ clients fidèles, méga-projets, suites
    /// Un client fidèle (niveau 2 ou plus) qui revient (le tuple (nom, fiche)), ou None.
    pub fn client_fidele(&self) -> Val {
        let fideles: Vec<(Val, Val)> =
            self.etat.get_or("clients", dict! {}).items().into_iter().filter(|(_, c)| c.at("fid") >= 2i64 && c.getb("secteur")).collect();
        if fideles.is_empty() || self.random() >= 0.35 {
            return Val::None;
        }
        let population: Vec<Val> = fideles.iter().map(|(n, c)| Val::tuple(vec![n.clone(), c.clone()])).collect();
        let poids: Vec<f64> = fideles.iter().map(|(_, c)| c.atf("fid")).collect();
        self.choices(&population, &poids)
    }

    pub fn offre_mega(&self) -> Val {
        let e = &self.etat;
        let mut acquis = e.at("technos").vec();
        acquis.extend(e.at("certifs").vec());
        let possibles: Vec<Val> = d("MEGAS").iter().filter(|m| m.at(3) <= e.at("renommee") && m.at(4).iter().all(|r| acquis.contains(&r))).collect();
        if possibles.is_empty() {
            return Val::None;
        }
        let m = self.choice(&Val::list(possibles));
        let (nom, mix, base, requis, secteur, equipe) = (m.at(0), m.at(1), m.at(2), m.at(4), m.at(5), m.at(6));
        let total = Val::dict();
        for (dom, part) in ["e", "m", "f"].iter().zip(mix.iter()) {
            total.set(*dom, py::round(base.f() * self.uniform(0.9, 1.15) * part.f()));
        }
        let taille: i64 = total.values().iter().map(Val::i).sum();
        let id = self.id();
        let client = self.choice(&d("SECTEURS").at(&secteur).at("clients"));
        let paie = arrondi_entier(taille as f64 * self.uniform(70.0, 80.0) * (1.0 + 0.01 * e.ati("renommee").min(20) as f64) * d("MEGA_PRIME").f(), 3);
        dict! {
            "id" => id, "nom" => nom, "client" => client, "taille" => taille, "total" => total,
            "paie" => paie, "delai" => 60 + py::round(taille as f64 * 0.12), "gain" => 1 + py::floordiv_i(taille, 200), "expire" => 60,
            "requis" => requis.to_list(), "secteur" => secteur, "fidele" => 0, "mega" => true, "equipe_min" => equipe,
        }
    }

    /// Une suite se vend mieux si le modèle précédent a plu (+8 % par point de note au-dessus de 6).
    pub fn bonus_suite(&self, prod: &Val) -> f64 {
        if !prod.getb("suite") {
            return 1.0;
        }
        let note = self.etat.at("gammes").get_or(prod.get("suite"), 0).f();
        1.0 + 0.08 * 0f64.max(note - 6.0)
    }

    // ------------------------------------------------------------------ R&D, certifications, prêts
    fn lancer_recherche(&self, genre: &str, rid: &Val) -> R {
        let e = &self.etat;
        let (cat, acquis) = if genre == "tech" { (d("TECHNOS"), e.at("technos")) } else { (d("CERTIFS"), e.at("certifs")) };
        let f = cat.get(rid);
        if !f.truthy() {
            return erreur("Inconnu.");
        }
        if acquis.has(rid) {
            return erreur("Déjà acquis.");
        }
        if e.at("recherches").iter().any(|r| r.at("genre") == genre) {
            return erreur(if genre == "tech" { "Une seule recherche de ce type à la fois." } else { "Un seul audit à la fois." });
        }
        if f.getb("requis") && !acquis.has(&f.at("requis")) {
            return erreur(format!("Il faut d'abord : {}.", cat.at(f.at("requis")).at("nom")));
        }
        self.payer(self.prix_recherche(genre, &f))?;
        e.at("recherches").push(dict! {"genre" => genre, "id" => rid, "jours" => f.at("jours"), "total" => f.at("jours")});
        let quoi = if genre == "tech" { "Recherche" } else { "Audit" };
        self.log(&format!("{quoi} lancé : {} ({} jours).", f.at("nom"), f.at("jours")), "info");
        Ok(())
    }

    pub fn ajouter_pret(&self, montant: i64) {
        let mensualite = py::round(montant as f64 * (1.0 + d("TAUX_PRET").f() * 2.0) / 24.0);
        self.etat.at("prets").push(dict! {"montant" => montant, "mensualite" => mensualite, "mois" => 24});
        self.etat.inc("argent", montant);
    }

    // ------------------------------------------------------------------ actions du joueur
    /// Rend vrai si l'action a été traitée ici.
    pub fn action_extension(&self, genre: &str, p: &Val) -> R<bool> {
        let e = &self.etat;
        match genre {
            "recherche" => self.lancer_recherche("tech", &p.get("id"))?,
            "certifier" => self.lancer_recherche("certif", &p.get("id"))?,
            "fournisseur" => {
                let id = p.get("id");
                if !d("FOURNISSEURS").has(&id) {
                    return erreur("Fournisseur inconnu.");
                }
                e.set("fournisseur", &id);
                self.log(&format!("Nouveau fournisseur : {}.", d("FOURNISSEURS").at(&id).at("nom")), "info");
            }
            "emprunter" => {
                let m = p.get("montant");
                if !d("PRETS").has(&m) {
                    return erreur("Montant inconnu.");
                }
                let t = 1.0 + d("TAUX_PRET").f() * 2.0;
                if self.dette().f() + m.f() * t > self.plafond_pret() as f64 * t {
                    return erreur(format!("La banque refuse : plafond d'endettement {} € (selon la renommée).", mil(self.plafond_pret())));
                }
                self.ajouter_pret(m.i());
                self.log(&format!("Prêt de {} € accordé sur 24 mois.", mil(m.i())), "info");
            }
            "rembourser" => {
                if !e.at("prets").truthy() {
                    return erreur("Aucun prêt en cours.");
                }
                // capital restant, sans les intérêts futurs
                let reste: i64 = e.at("prets").iter().map(|x| py::floordiv_i(x.ati("montant"), 24) * x.ati("mois")).sum();
                if e.at("argent") < reste {
                    return erreur("Trésorerie insuffisante pour rembourser.");
                }
                e.dec("argent", reste);
                e.set("prets", list![]);
                self.log(&format!("Prêts remboursés par anticipation (−{} €).", mil(reste)), "bon");
            }
            "lever" => {
                if e.atf("parts") < 1.0 {
                    return erreur("Vous avez déjà ouvert votre capital.");
                }
                if e.at("renommee") < 5i64 {
                    return erreur("Les investisseurs attendent 5 de renommée.");
                }
                let montant = self.montant_levee();
                e.inc("argent", montant);
                e.set("parts", 0.8);
                self.log(&format!("Levée de fonds : +{} € contre 20 % du capital (score final ×0,8).", mil(montant)), "bon");
            }
            "promouvoir" => {
                let emp = self.employe(&p.get("id"))?;
                if emp.getb("chef") {
                    return erreur("Déjà chef de projet.");
                }
                let seuil = if emp.at("traits").has("leader") { 10 } else { 14 };
                if emp.ati("e") + emp.ati("m") + emp.ati("f") < seuil {
                    return erreur(format!("Il faut {seuil} points de compétences au total pour devenir chef de projet."));
                }
                if emp.getb("stage") {
                    return erreur("Un stagiaire ne peut pas être promu.");
                }
                emp.set("chef", true);
                self.installer_fonction(&emp, "cdp");
                if !emp.getb("fondateur") {
                    emp.inc("salaire", 600i64);
                }
                emp.set("humeur", vmin(8, &emp.at("humeur") + 4i64));
                self.log(&format!("{} devient chef de projet !", emp.at("nom")), "bon");
            }
            "seminaire" => {
                if e.ati("jours_total") - e.ati("dernier_seminaire") < DELAI_SEMINAIRE {
                    return erreur("Un séminaire tous les 6 mois maximum.");
                }
                let presents: Vec<Val> = e.at("employes").iter().filter(|x| !x.atb("absent")).collect();
                self.payer(1000 + 300 * presents.len() as i64)?;
                for x in &presents {
                    x.set("absent", 2);
                    x.set("absence", "seminaire");
                    x.set("fatigue", 0);
                    x.set("humeur", vmin(8, &x.at("humeur") + 6i64));
                }
                e.set("dernier_seminaire", e.at("jours_total"));
                self.log("Séminaire d'équipe : deux jours au vert, tout le monde revient regonflé.", "bon");
            }
            "commander" => self.commander(&p.get("id"), &p.get("qte"))?,
            "agrandir_stock" => {
                if !self.emmenage() {
                    return erreur("Le stock s'agrandit dans le bâtiment : emménagez d'abord.");
                }
                let a = d("AGRANDIR_STOCK");
                self.payer(a.at(0))?;
                e.inc("stock_max", a.at(1));
                self.log(&format!("Stock agrandi : {} unités.", e.at("stock_max")), "bon");
            }
            "negocier" => self.negocier(&p.get("id"), &p.get("cible"))?,
            "nommer" => {
                let emp = self.employe(&p.get("id"))?;
                self.nommer(&emp, &p.get("role"))?;
            }
            "investir" => self.investir(&p.get("id"))?,
            "fermer_victoire" => {
                if e.getb("victoire") {
                    e.at("victoire").set("vue", true);
                }
            }
            _ => return Ok(false),
        }
        Ok(true)
    }

    // ------------------------------------------------------------------ investissements de fin de partie
    pub fn a_investi(&self, iid: &str) -> i64 {
        self.etat.at("investissements").get_or(iid, 0).i()
    }

    pub fn prix_investissement(&self, iid: &str) -> i64 {
        let (inv, n) = (d("INVESTISSEMENTS").at(iid), self.a_investi(iid));
        match iid {
            "campagne" => py::int(inv.atf("prix") * (1.0 + 0.5 * n as f64)),
            "rachat" => {
                let fort = self.etat.at("concurrents").iter().map(|c| c.ati("renommee")).max().expect("un concurrent au moins");
                inv.ati("prix") + inv.ati("par_rep") * fort
            }
            _ => inv.ati("prix"),
        }
    }

    fn investir(&self, iid: &Val) -> R {
        let e = &self.etat;
        let inv = d("INVESTISSEMENTS").get(iid);
        if !inv.truthy() {
            return erreur("Investissement inconnu.");
        }
        let iid = iid.string();
        let iid = iid.as_str();
        if !self.emmenage() {
            return erreur("Les investissements se font depuis le bâtiment : emménagez d'abord.");
        }
        if e.at("renommee") < inv.at("rep") {
            return erreur(format!("Renommée {} requise.", inv.at("rep")));
        }
        if (iid == "formation" || iid == "filiale") && self.a_investi(iid) != 0 {
            return erreur("Déjà fait.");
        }
        if iid == "campagne" && e.ati("jours_total") - e.ati("derniere_campagne") < 360 {
            return erreur("Une campagne nationale par an au plus.");
        }
        if iid == "rachat" && (self.a_investi(iid) >= 2 || e.at("concurrents").len() < 2) {
            return erreur("Deux rachats au plus : il reste toujours un concurrent.");
        }
        let prix = self.prix_investissement(iid);
        self.payer(prix)?;
        e.at("investissements").set(iid, self.a_investi(iid) + 1);
        if iid == "campagne" {
            e.set("derniere_campagne", e.at("jours_total"));
            e.inc("renommee", 2i64);
            self.log(&format!("Campagne de communication nationale (−{} €) : renommée +2.", mil(prix)), "bon");
        } else if iid == "rachat" {
            let c = py::max_by_key(e.at("concurrents").iter(), |c| c.at("renommee")).expect("un concurrent au moins");
            e.at("concurrents").remove(&c);
            e.inc("renommee", 3i64);
            self.log(&format!("Vous rachetez {} (−{} €) : un concurrent de moins, renommée +3.", c.at("nom"), mil(prix)), "bon");
        } else {
            self.log(&format!("{} : c'est fait ! (−{} €)", inv.at("nom"), mil(prix)), "bon");
        }
        Ok(())
    }

    // ------------------------------------------------------------------ produits : sous-traitant, lots, stock
    pub fn stock_total(&self) -> Val {
        let e = &self.etat;
        py::sum_v(e.at("produits").iter().map(|x| x.at("stock"))) + py::sum_v(e.at("commandes").iter().map(|c| c.at("qte")))
    }

    fn commander(&self, pid: &Val, qte: &Val) -> R {
        let e = &self.etat;
        let Some(prod) = e.at("produits").iter().find(|x| x.at("id_produit") == *pid) else {
            return erreur("Produit introuvable.");
        };
        if !d("LOTS").has(qte) {
            return erreur("Taille de lot inconnue.");
        }
        if &self.stock_total() + qte > e.at("stock_max") {
            return erreur(format!("Stock trop petit : {} unités en tout (commandes en cours comprises).", e.at("stock_max")));
        }
        let (coef, jours) = d("LOTS").at(qte).pair();
        let cout = arrondi_entier(qte.f() * prod.atf("cout_unite") * coef.f(), 1);
        self.payer(cout)?;
        let jours = jours.i() + 3 * d("FOURNISSEURS").at(e.at("fournisseur")).ati("jours");
        e.at("commandes").push(dict! {"produit" => pid, "nom" => prod.at("nom"), "qte" => qte, "jours" => jours, "retard" => false});
        self.log(&format!("Lot de {} « {} » commandé au sous-traitant (−{} €, {} jours).", qte, prod.at("nom"), mil(cout), jours).replace('_', " "), "info");
        Ok(())
    }

    /// Fabrication chez le sous-traitant, retards possibles, contrôle à réception (mieux fait avec la qualification).
    pub fn lots_du_jour(&self) {
        let e = &self.etat;
        for c in e.at("commandes").iter() {
            c.dec("jours", 1i64);
            if c.ati("jours") > 0 {
                continue;
            }
            let prod = e.at("produits").iter().find(|x| x.at("id_produit") == c.at("produit"));
            let chefs = if self.chefs_projet().is_empty() { 1.0 } else { 0.5 };
            if !c.atb("retard") && self.random() < 0.15 * chefs {
                c.set("retard", true);
                c.set("jours", self.randint(5, 12));
                self.log(&format!("Le sous-traitant prend du retard sur le lot « {} » ({} jours de plus).", c.at("nom"), c.at("jours")), "mauvais");
                continue;
            }
            e.at("commandes").remove(&c);
            let Some(prod) = prod else { continue };
            let defaut = self.random() < prod.atf("defaut_lot") * d("FOURNISSEURS").at(e.at("fournisseur")).atf("defauts");
            if defaut && self.random() < 0.95f64.min(0.5 + 0.06 * self.meilleur_metier("qualif") as f64) {
                let n = c.copy();
                n.set("jours", 15);
                n.set("retard", true);
                e.at("commandes").push(n);
                self.log(&format!("Contrôle à réception : lot « {} » défectueux, renvoyé au sous-traitant qui le refait.", c.at("nom")), "mauvais");
                continue;
            }
            prod.inc("stock", c.at("qte"));
            if defaut {
                prod.set("note", vmax(1, py::round_n(prod.atf("note") - 0.4, 1)));
                prod.set("demande", vmax(1, py::round(prod.atf("demande") * 0.85)));
                self.log(&format!("Lot « {} » défectueux passé au contrôle : retours clients, la réputation du produit baisse.", c.at("nom")), "mauvais");
            } else {
                self.log(&format!("Lot de {} « {} » reçu au stock.", c.at("qte"), c.at("nom")), "info");
            }
        }
    }

    /// Ventes limitées au stock, pannes remboursées, invendus liquidés en fin de vie ; rend (ventes, frais de stockage).
    pub fn ventes_du_mois(&self) -> (i64, i64) {
        let e = &self.etat;
        let frais = py::round(d("STOCKAGE").f() * py::sum_v(e.at("produits").iter().map(|x| x.at("stock"))).f());
        let mut total = 0i64;
        for prod in e.at("produits").iter() {
            let vendus = vmin(prod.at("stock"), prod.at("demande"));
            let net = py::round(vendus.f() * prod.atf("prix") * (1.0 - prod.atf("pannes")));
            if vendus < prod.at("demande") && prod.atb("mois") {
                self.log(&format!("Rupture de stock : « {} » a manqué {} ventes.", prod.at("nom"), prod.at("demande") - &vendus), "mauvais");
            }
            prod.dec("stock", &vendus);
            prod.inc("total", net);
            prod.inc("mois", 1i64);
            prod.set("demande", py::int(prod.atf("demande") * 0.9));
            prod.set("ventes", prod.at("demande") * prod.at("prix"));
            total += net;
            if prod.at("demande") < 3i64 && !e.at("commandes").iter().any(|c| c.at("produit") == prod.at("id_produit")) {
                let reste = py::round(prod.atf("stock") * prod.atf("cout_unite") * 0.3);
                if prod.atb("stock") {
                    self.log(&format!("Fin de vie de « {} » : {} invendus soldés (+{} €).", prod.at("nom"), prod.at("stock"), mil(reste)), "info");
                }
                total += reste;
                e.at("produits").remove(&prod);
            }
        }
        (total, frais)
    }

    /// Un commercial renégocie une offre : plus d'argent ou plus de délai, au risque de perdre le client.
    fn negocier(&self, oid: &Val, cible: &Val) -> R {
        let e = &self.etat;
        let Some(o) = e.at("offres").iter().find(|x| x.at("id") == *oid) else {
            return erreur("Cette offre n'est plus disponible.");
        };
        if !(*cible == "prix" || *cible == "delai") {
            return erreur("Paramètres invalides.");
        }
        if self.commerciaux().is_empty() {
            return erreur("Il faut des commerciaux pour négocier.");
        }
        if o.getb("negociee") || o.getb("gagne") {
            return erreur("Offre déjà négociée.");
        }
        o.set("negociee", true);
        if self.random() < self.chance_commerciale() {
            let quoi = if *cible == "prix" {
                o.set("paie", arrondi_entier(o.atf("paie") * 1.15, 2));
                format!("{} €", mil(o.ati("paie")))
            } else {
                o.set("delai", py::round(o.atf("delai") * 1.25));
                format!("{} jours", o.at("delai"))
            };
            self.log(&format!("Négociation réussie sur « {} » : {quoi}.", o.at("nom")), "bon");
        } else {
            e.at("offres").remove(&o);
            self.log(&format!("Négociation ratée : {} se tourne vers la concurrence pour « {} ».", o.at("client"), o.at("nom")), "mauvais");
        }
        Ok(())
    }

    pub fn chance_commerciale(&self) -> f64 {
        let meilleur = self.commerciaux().iter().map(|x| self.metier(x, "commercial")).max().unwrap_or(0);
        py::round_n(0.9f64.min(0.45 + 0.05 * meilleur as f64), 2)
    }

    /// Donne (ou retire, role=None) un rôle : responsable de service, directeur R&D ou chargé d'innovation.
    fn nommer(&self, emp: &Val, role: &Val) -> R {
        let paye = !emp.getb("fondateur") && !emp.getb("stage");
        if role.is_none() {
            if !emp.getb("role") {
                return erreur("Aucun rôle à retirer.");
            }
            let r = d("ROLES").at(emp.at("role"));
            if paye {
                emp.set("salaire", vmax(0, &emp.at("salaire") - r.at("salaire")));
            }
            self.log(&format!("{} quitte son poste de {}.", emp.at("nom"), r.at("nom")), "info");
            emp.set("role", Val::None);
            emp.set("humeur", vmax(-8, &emp.at("humeur") - 4i64)); // rendu à la nomination : pas d'humeur gratuite en boucle
            return Ok(());
        }
        let r = if role.is_str() { d("ROLES").get(role) } else { Val::None };
        if !r.truthy() {
            return erreur("Rôle inconnu.");
        }
        if emp.getb("stage") {
            return erreur("Un stagiaire ne peut pas être promu.");
        }
        if emp.getb("role") {
            return erreur(format!("{} a déjà un rôle.", emp.at("nom")));
        }
        if self.etat.at("employes").iter().any(|x| x.get("role") == *role) {
            return erreur(format!("Il y a déjà un·e {}.", r.at("nom")));
        }
        if r.has("dom") && emp.at(r.at("dom")) < r.at("min") {
            return erreur(format!("Il faut {} en {}.", r.at("min"), d("NOM_DOMAINE").at(r.at("dom"))));
        }
        if r.has("total") && emp.ati("e") + emp.ati("m") + emp.ati("f") < r.ati("total") {
            return erreur(format!("Il faut {} points de compétences au total.", r.at("total")));
        }
        self.installer(emp, r.ats("genre").as_str())?;
        emp.set("role", role);
        if paye {
            emp.inc("salaire", r.at("salaire"));
        }
        emp.set("humeur", vmin(8, &emp.at("humeur") + 4i64));
        self.log(&format!("{} devient {} !", emp.at("nom"), r.at("nom")), "bon");
        Ok(())
    }

    // ------------------------------------------------------------------ chaque jour
    pub fn debut_jour_extensions(&self) {
        let e = &self.etat;
        let meteo = d("METEO").at(d("SAISONS").at(e.at("mois")));
        // le temps dure plusieurs jours (un tirage quotidien faisait clignoter la pluie) ; nouveau tirage au changement de saison
        if !meteo.has(&e.at("meteo")) || self.random() < CHANGEMENT_METEO {
            let (tirage, mut cumul) = (self.random(), 0.0);
            for (nom, pr) in meteo.items() {
                cumul += pr.f();
                if tirage < cumul {
                    e.set("meteo", nom);
                    break;
                }
            }
        }
        e.set("fete", Val::None);
        if e.getb("pot") {
            e.set("fete", dict! {"type" => "pot"});
            e.pop("pot");
            for x in e.at("employes").iter() {
                x.set("humeur", vmin(8, &x.at("humeur") + 2i64));
            }
        }
        for x in e.at("employes").iter() {
            if x.get("anniv") == list![e.at("mois"), e.at("jour")] && !x.atb("absent") {
                e.set("fete", dict! {"type" => "anniv", "nom" => x.at("nom")});
                x.set("humeur", vmin(8, &x.at("humeur") + 4i64));
                self.log(&format!("Joyeux anniversaire {} ! Gâteau pour tout le monde.", x.at("nom")), "bon");
            }
        }
    }

    pub fn fin_jour_extensions(&self) {
        let e = &self.etat;
        for rech in e.at("recherches").iter() {
            let pas = if rech.at("genre") == "tech" && self.roles().at("actifs").has("dir_rd") { 2i64 } else { 1i64 };
            rech.dec("jours", pas);
            if rech.ati("jours") <= 0 {
                e.at("recherches").remove(&rech);
                if rech.at("genre") == "tech" {
                    e.at("technos").push(rech.at("id"));
                    self.log(&format!("Nouvelle technologie maîtrisée : {} !", d("TECHNOS").at(rech.at("id")).at("nom")), "bon");
                } else {
                    e.at("certifs").push(rech.at("id"));
                    self.log(&format!("Certification obtenue : {} !", d("CERTIFS").at(rech.at("id")).at("nom")), "bon");
                }
            }
        }
        for g in e.at("garanties").iter() {
            g.dec("jours", 1i64);
            if g.ati("jours") <= 0 {
                e.at("garanties").remove(&g);
            } else if !e.atb("evenement") && self.random() < g.atf("defauts") * 0.003 {
                e.at("garanties").remove(&g);
                let atelier = if self.emmenage() { 0.5 } else { 1.0 }; // atelier SAV du bâtiment
                let cout = arrondi_entier((500.0 + 400.0 * g.atf("defauts")) * atelier, 1);
                e.set(
                    "evenement",
                    dict! {
                        "type" => "sav", "titre" => "Retour SAV",
                        "texte" => format!("{} signale des pannes sur « {} », encore sous garantie.", g.at("client"), g.at("nom")),
                        "options" => list![format!("Corriger gratuitement (−{} €)", mil(cout)), "Refuser la prise en charge (renommée −2)"],
                        "cout" => cout,
                    },
                );
            }
        }
        let fort = e.at("concurrents").iter().map(|c| c.ati("renommee")).max().expect("un concurrent au moins");
        for o in e.at("offres").iter() {
            if o.getb("reservee") || o.getb("gagne") {
                continue; // piste réservée ou devis déjà accepté : le client attend votre signature
            }
            if self.random() < 0.004 + 0.0008 * fort as f64 {
                // plus la concurrence est connue, plus elle rafle de marchés
                let rivaux = e.at("concurrents").vec();
                let poids: Vec<f64> = rivaux.iter().map(|c| 1.0 + c.atf("renommee")).collect();
                let c = self.choices(&rivaux, &poids);
                e.at("offres").remove(&o);
                self.rival_gagne(&c);
                self.log(&format!("{} remporte l'appel d'offres « {} ».", c.at("nom"), o.at("nom")), "info");
            }
        }
        if e.at("renommee") >= 10i64 && !e.at("offres").iter().any(|o| o.getb("mega")) && self.random() < 0.012 {
            let mega = self.offre_mega();
            if mega.truthy() {
                e.at("offres").push(&mega);
                self.log(&format!("Méga-projet en vue : « {} » pour {} !", mega.at("nom"), mega.at("client")), "bon");
            }
        }
        for x in e.at("employes").iter() {
            if x.getb("stage") {
                x.dec("stage", 1i64);
                if x.ati("stage") <= 0 {
                    if e.atb("evenement") {
                        x.set("stage", 1); // on attend que l'évènement en cours soit réglé
                    } else {
                        let salaire = 900 + 230 * (x.ati("e") + x.ati("m") + x.ati("f"));
                        e.set(
                            "evenement",
                            dict! {
                                "type" => "fin_stage", "titre" => "Fin de stage", "employe" => x.at("id"), "salaire" => salaire,
                                "texte" => format!("Le stage de {} se termine. L'embaucher ?", x.at("nom")),
                                "options" => list![format!("L'embaucher ({} €/mois)", mil(salaire)), "Lui dire au revoir"],
                            },
                        );
                    }
                }
            }
        }
        if e.getb("offre_serie") && !e.atb("evenement") {
            let s = e.pop("offre_serie");
            e.set(
                "evenement",
                dict! {
                    "type" => "serie", "titre" => "Commande de série", "serie" => &s,
                    "texte" => format!("{} veut produire « {} » en série pendant {} mois. Vous touchez une marge sur chaque lot.", s.at("client"), s.at("nom"), s.at("mois")),
                    "options" => list![format!("Accepter (~{} €/mois)", mil_v(&s.at("marge"))), "Décliner"],
                },
            );
        }
        self.lots_du_jour();
        self.verifier_objectif();
    }

    /// Rend (recettes, dépenses, morceaux du texte, capital remboursé) du mois pour les séries, prêts et certifications.
    pub fn mois_extensions(&self) -> (i64, i64, Vec<String>, i64) {
        let e = &self.etat;
        let (mut recettes, mut depenses, mut morceaux) = (0i64, 0i64, Vec::new());
        let f = d("FOURNISSEURS").at(e.at("fournisseur"));
        for s in e.at("series").iter() {
            if self.random() < f.atf("risque") {
                self.log(&format!("Rupture de composants : pas de lot ce mois-ci pour « {} ».", s.at("nom")), "mauvais");
            } else {
                recettes += py::int(s.atf("marge") * f.atf("serie") * s.get_or("indus", 1).f() * (1.0 + 0.04 * self.meilleur_metier("indus") as f64));
            }
            s.dec("mois", 1i64);
            if s.ati("mois") <= 0 {
                e.at("series").remove(&s);
                self.log(&format!("Fin de la production en série de « {} ».", s.at("nom")), "info");
            }
        }
        if recettes != 0 {
            morceaux.push(format!("séries +{} €", mil(recettes)));
        }
        let brevets: i64 = e.at("brevets").iter().map(|b| b.ati("revenu")).sum();
        for b in e.at("brevets").iter() {
            b.dec("mois", 1i64);
            if b.ati("mois") <= 0 {
                e.at("brevets").remove(&b);
                self.log(&format!("Le brevet « {} » arrive à échéance.", b.at("nom")), "info");
            }
        }
        if brevets != 0 {
            recettes += brevets;
            morceaux.push(format!("brevets +{} €", mil(brevets)));
        }
        let mut capital = 0i64;
        for pret in e.at("prets").iter() {
            let part = py::floordiv_i(pret.ati("montant"), 24);
            capital += part;
            depenses += pret.ati("mensualite") - part; // seuls les intérêts sont des charges déductibles
            pret.dec("mois", 1i64);
            if pret.ati("mois") <= 0 {
                e.at("prets").remove(&pret);
                self.log(&format!("Prêt de {} € entièrement remboursé.", mil(pret.ati("montant"))), "bon");
            }
        }
        if capital != 0 {
            morceaux.push(format!("prêts −{} €", mil(capital + depenses)));
        }
        let certifs = d("ENTRETIEN_CERTIF").i() * e.at("certifs").len() as i64;
        if certifs != 0 {
            depenses += certifs;
            morceaux.push(format!("audits −{} €", mil(certifs)));
        }
        for c in e.at("concurrents").iter() {
            let x = self.choice(&list![0, 0, 0, 1]);
            c.inc("renommee", x);
        }
        (recettes, depenses, morceaux, capital)
    }

    // ------------------------------------------------------------------ livraisons et évènements
    pub fn apres_livraison(&self, p: &Val, note: &Val, _montant: &Val) {
        let e = &self.etat;
        let st = e.at("stats");
        st.set("meilleure_note", vmax(st.at("meilleure_note"), note));
        if p.at("type") == "produit" {
            let g = e.at("gammes");
            g.set(p.at("id_produit"), vmax(g.get_or(p.at("id_produit"), 0), note));
            if d("PRODUITS").iter().any(|x| x.at("id") == p.at("id_produit") && x.getb("suite")) {
                st.inc("suites", 1i64);
            }
        } else {
            if p.getb("secteur") {
                let s = st.at("secteurs");
                s.set(p.at("secteur"), s.get_or(p.at("secteur"), 0) + 1i64);
            }
            if p.getb("mega") {
                st.inc("megas", 1i64);
            }
            if p.getb("client") {
                let c = e.at("clients").setdefault(p.at("client"), dict! {"secteur" => p.get("secteur"), "fid" => 0, "livres" => 0});
                let ecart = note.f() - self.attente_client().f();
                let avant = c.ati("fid");
                let pas = if ecart >= 1.5 {
                    2
                } else if ecart >= 0.0 {
                    1
                } else if ecart < -1.0 {
                    -2
                } else {
                    0
                };
                c.set("fid", borne(avant + pas, 0, d("FIDELITE_MAX")));
                c.inc("livres", 1i64);
                if c.ati("fid") >= 3 && 3 > avant {
                    self.log(&format!("{} devient un client fidèle : il reviendra avec de plus gros projets.", p.at("client")), "bon");
                }
            }
        }
        let (ni, nq) = (Jeu::niveau(p, "indus") as f64, Jeu::niveau(p, "qualif") as f64);
        let (qi, qq) = (self.qualite_projet(p, "indus"), self.qualite_projet(p, "qualif"));
        // défauts vus par le client : l'indus et la qualif en évitent ; sans indus, un gros projet en laisse passer plus
        let gros = if ni == 0.0 && p.ati("taille") >= 250 { 1.3 } else { 1.0 };
        let reel = p.atf("defauts") * (1.0 - 0.35 * ni * qi) * (1.0 - 0.35 * nq * qq) * gros;
        if p.at("type") == "contrat" && reel >= 0.3 {
            e.at("garanties").push(dict! {"nom" => p.at("nom"), "client" => p.at("client"), "defauts" => py::round_n(reel, 1), "jours" => DUREE_GARANTIE});
        }
        if note.f() >= 7.0 {
            e.set("pot", true);
        }
        // un projet industrialisé est plus souvent produit en série, avec une meilleure marge
        if p.at("type") == "contrat" && note.f() >= 7.0 && e.at("series").len() < 4 && self.random() < 0.35 + 0.1 * ni {
            let mois = self.randint(6, 18);
            e.set(
                "offre_serie",
                dict! {
                    "nom" => p.at("nom"), "client" => p.at("client"), "mois" => mois,
                    "marge" => arrondi_entier(p.atf("paie") * 0.04 * note.f() / 8.0, 1), "indus" => py::round_n(1.0 + 0.3 * ni * qi, 2),
                },
            );
        }
    }

    pub fn evenements_extensions(&self, possibles: &mut Vec<Val>) {
        let e = &self.etat;
        // les fidèles n'écoutent même pas
        let stars: Vec<Val> = e
            .at("employes")
            .iter()
            .filter(|x| !x.getb("fondateur") && !x.getb("stage") && x.ati("e") + x.ati("m") + x.ati("f") >= 12 && self.random() >= self.fidelite(x))
            .collect();
        if !stars.is_empty() {
            let x = self.choice(&Val::list(stars));
            let c = py::max_by_key(e.at("concurrents").iter(), |c| c.at("renommee")).expect("un concurrent au moins");
            possibles.push(dict! {
                "type" => "debauche", "titre" => "Tentative de débauchage", "employe" => x.at("id"),
                "texte" => format!("{} propose un pont d'or à {}.", c.at("nom"), x.at("nom")),
                "options" => list!["Contre-offre (+15 % de salaire)", "Le laisser partir"],
            });
        }
        if !self.bureaux_libres().is_empty() {
            possibles.push(dict! {
                "type" => "stage", "titre" => "Stagiaire d'école d'ingénieurs",
                "texte" => "Une école propose un stagiaire gratuit pendant 3 mois.",
                "options" => list!["L'accueillir", "Pas maintenant"],
            });
        }
        if self.roles().at("actifs").has("innov") && e.at("brevets").len() < 3 {
            // 3 brevets actifs au plus
            let idee = self.choice(&d("IDEES_BREVET"));
            possibles.push(dict! {
                "type" => "brevet", "titre" => "Idée brevetable", "idee" => &idee,
                "texte" => format!("Votre chargé·e d'innovation a une idée : « {idee} ». Un brevet rapporterait des licences pendant 3 ans."),
                "options" => list![format!("Déposer le brevet (−{} €)", mil(d("BREVET").ati("cout"))), "Laisser tomber"],
            });
        }
        if e.at("series").truthy() {
            let s = self.choice(&e.at("series"));
            let cout = arrondi_entier(2000.0 + s.atf("marge") * 2.0, 1);
            possibles.push(dict! {
                "type" => "obsolescence", "titre" => "Composant obsolète", "serie" => s.at("nom"),
                "texte" => format!("Un composant clé de « {} » n'est plus fabriqué.", s.at("nom")),
                "options" => list![format!("Redessiner la carte (−{} €)", mil(cout)), "Arrêter la série"], "cout" => cout,
            });
        }
    }

    /// Rend vrai si l'évènement a été traité ici.
    pub fn resoudre_extension(&self, ev: &Val, choix: i64) -> R<bool> {
        let e = &self.etat;
        let t = ev.at("type");
        let employe = || e.at("employes").iter().find(|y| y.at("id") == ev.at("employe"));
        if t == "sav" {
            if choix == 0 {
                self.payer(ev.at("cout"))?;
            } else {
                e.set("renommee", vmax(0, &e.at("renommee") - 2i64));
            }
        } else if t == "serie" {
            if choix == 0 {
                e.at("series").push(ev.at("serie").copy());
                e.at("stats").inc("series", 1i64);
            }
        } else if t == "debauche" {
            if let Some(x) = employe() {
                if choix == 0 {
                    x.set("salaire", arrondi_entier(x.atf("salaire") * 1.15, 1));
                    x.set("humeur", vmin(8, &x.at("humeur") + 3i64));
                } else {
                    e.at("employes").remove(&x);
                    self.log(&format!("{} part chez la concurrence.", x.at("nom")), "mauvais");
                }
            }
        } else if t == "stage" {
            if choix == 0 {
                if let Some(bureau) = self.bureaux_libres().first() {
                    let c = self.candidat();
                    let modifs = dict! {
                        "poste" => "Stagiaire d'école", "salaire" => 0, "humeur" => 2, "stage" => DUREE_STAGE, "seniorite" => 0, "annonce" => 0,
                        "e" => 1i64.max(py::floordiv_i(c.ati("e"), 2)), "m" => 0i64.max(py::floordiv_i(c.ati("m"), 2)),
                        "f" => 1i64.max(py::floordiv_i(c.ati("f"), 2)),
                    };
                    self.nouvel_employe(&c, bureau, &modifs);
                    self.log(&format!("{} arrive en stage pour 3 mois.", c.at("nom")), "bon");
                }
            }
        } else if t == "fin_stage" {
            if let Some(x) = employe() {
                if choix == 0 {
                    x.update(&dict! {"stage" => 0, "salaire" => ev.at("salaire"), "poste" => "Ingé junior"});
                } else {
                    e.at("employes").remove(&x);
                    self.log(&format!("Fin de stage pour {}. Bonne route !", x.at("nom")), "info");
                }
            }
        } else if t == "brevet" {
            if choix == 0 {
                let brevet = d("BREVET");
                self.payer(brevet.at("cout"))?;
                let (a, b) = brevet.at("revenu").pair();
                let revenu = arrondi_entier(self.randint(a.i(), b.i()) as f64, 1);
                e.at("brevets").push(dict! {"nom" => ev.at("idee"), "revenu" => revenu, "mois" => brevet.at("mois")});
                e.inc("renommee", 1i64);
                self.log(&format!("Brevet déposé : « {} » (+{revenu} €/mois de licences, renommée +1).", ev.at("idee")), "bon");
            }
        } else if t == "obsolescence" {
            if let Some(s) = e.at("series").iter().find(|y| y.at("nom") == ev.at("serie")) {
                if choix == 0 {
                    self.payer(ev.at("cout"))?;
                } else {
                    e.at("series").remove(&s);
                }
            }
        } else {
            return Ok(false);
        }
        Ok(true)
    }

    // ------------------------------------------------------------------ objectifs de scénario
    pub fn verifier_objectif(&self) {
        let e = &self.etat;
        let obj = e.get("objectif");
        if !obj.truthy() || e.getb("victoire") {
            return;
        }
        let t = obj.at("type");
        let ok = if t == "produits" {
            e.at("stats").at("produits_lances") >= obj.at("n")
        } else if t == "aero" {
            e.at("certifs").has("aero") && e.at("renommee") >= obj.at("n")
        } else {
            e.at("argent") >= obj.at("n") && !e.at("prets").truthy()
        };
        if ok {
            let texte = format!("Objectif du scénario « {} » atteint !", d("SCENARIOS").at(e.at("scenario")).at("nom"));
            e.set("victoire", dict! {"ok" => true, "vue" => false, "texte" => texte.as_str()});
            self.log(&texte, "trophee");
        } else if e.ati("jours_total") >= obj.ati("ans") * 360 {
            let texte = "Le délai du scénario est écoulé sans atteindre l'objectif. Vous pouvez continuer à jouer.";
            e.set("victoire", dict! {"ok" => false, "vue" => false, "texte" => texte});
            self.log(texte, "mauvais");
        }
    }

    // ------------------------------------------------------------------ missions
    pub fn mesure(&self, cle: &str) -> Val {
        let (e, st) = (&self.etat, self.etat.at("stats"));
        if let Some(s) = cle.strip_prefix("secteur:") {
            return st.at("secteurs").get_or(s, 0);
        }
        if let Some(l) = cle.strip_prefix("local:") {
            return Val::Int(e.at("locaux").has(l) as i64);
        }
        fn compte(liste: Val, f: impl Fn(&Val) -> bool) -> Val {
            Val::from(liste.iter().filter(|x| f(x)).count())
        }
        match cle {
            "livres" => st.at("livres"),
            "employes" => Val::from(e.at("employes").len()),
            "produits" => st.at("produits_lances"),
            "technos" => Val::from(e.at("technos").len()),
            "certifs" => Val::from(e.at("certifs").len()),
            "renommee" => e.at("renommee"),
            "fideles" => compte(Val::list(e.at("clients").values()), |c| c.at("fid") >= 3i64),
            "series" => st.at("series"),
            "suites" => st.at("suites"),
            "megas" => st.at("megas"),
            "note" => st.at("meilleure_note"),
            "indus" => st.get_or("indus", 0),
            "qualif" => st.get_or("qualif_produit", 0),
            "chefs" => compte(e.at("employes"), |x| x.getb("chef")),
            _ => panic!("KeyError: '{cle}'"),
        }
    }

    pub fn missions_actives(&self) -> Vec<Val> {
        let faites = self.etat.at("missions");
        d("MISSIONS").iter().filter(|m| !faites.has(&m.at(0))).take(d("NB_MISSIONS_ACTIVES").i() as usize).collect()
    }

    pub fn verifier_missions(&self) {
        let e = &self.etat;
        for m in self.missions_actives() {
            let (mid, texte, cle, seuil, argent, rep) = (m.at(0), m.at(1), m.at(2), m.at(3), m.at(4), m.at(5));
            if self.mesure(cle.s()) >= seuil {
                e.at("missions").push(&mid);
                self.encaisser(&argent);
                e.inc("renommee", &rep);
                let gain = format!("+{} €", mil_v(&argent)) + &if rep.truthy() { format!(", renommée +{rep}") } else { String::new() };
                self.log(&format!("Mission accomplie : {texte} ({gain})."), "trophee");
            }
        }
    }

    pub fn progres_objectif(&self) -> Val {
        let e = &self.etat;
        let obj = e.get("objectif");
        if !obj.truthy() {
            return Val::None;
        }
        let t = obj.at("type");
        let texte = if t == "produits" {
            format!("Produits lancés : {} / {}", e.at("stats").at("produits_lances"), obj.at("n"))
        } else if t == "aero" {
            let oui = if e.at("certifs").has("aero") { "oui" } else { "non" };
            format!("EN 9100 : {oui} · renommée {} / {}", e.at("renommee"), obj.at("n"))
        } else {
            format!("Trésorerie {} / {} € · prêts restants : {}", mil(py::int(e.atf("argent"))), mil_v(&obj.at("n")), e.at("prets").len())
        };
        let reste = py::floordiv_i(0i64.max(obj.ati("ans") * 360 - e.ati("jours_total")), 30);
        dict! {"texte" => texte, "mois_restants" => reste, "scenario" => d("SCENARIOS").at(e.at("scenario")).at("nom")}
    }

    pub fn vue_extensions(&self, v: Val) -> Val {
        let e = &self.etat;
        let mut classement = vec![dict! {"nom" => e.at("entreprise"), "renommee" => e.at("renommee"), "vous" => true}];
        classement.extend(e.at("concurrents").iter().map(|c| c.copy()));
        v.set("classement", Val::list(py::sorted_by_key(classement, |c| -c.atf("renommee"))));
        let prix = Val::dict();
        for k in d("INVESTISSEMENTS").keys() {
            prix.set(&k, self.prix_investissement(k.s()));
        }
        v.set("prix_investissements", prix);
        v.set("mensualites", self.mensualites());
        v.set("dette", self.dette());
        v.set("plafond_pret", self.plafond_pret());
        v.set("saison", d("SAISONS").at(e.at("mois")));
        v.set("progres_objectif", self.progres_objectif());
        v.set("seminaire_dans", 0i64.max(DELAI_SEMINAIRE - (e.ati("jours_total") - e.ati("dernier_seminaire"))));
        v.set("cout_seminaire", 1000 + 300 * e.at("employes").iter().filter(|x| !x.atb("absent")).count() as i64);
        v.set("levee_possible", self.montant_levee());
        v.set("bonus_nego", if self.dg_actif() { Val::Float(0.1) } else { Val::Int(0) });
        v.set("stock_total", self.stock_total());
        v.set("chance_commerciale", self.chance_commerciale());
        v.set("nb_commerciaux", self.commerciaux().len());
        v.set("qualite_indus", self.qualite_etape("indus", "indus"));
        v.set("qualite_qualif", self.qualite_etape("qualif", "qualif"));
        let missions: Vec<Val> = self
            .missions_actives()
            .iter()
            .map(|m| {
                let progres = vmin(self.mesure(&m.ats(2)), m.at(3));
                dict! {"id" => m.at(0), "texte" => m.at(1), "progres" => progres, "seuil" => m.at(3), "argent" => m.at(4), "renommee" => m.at(5)}
            })
            .collect();
        v.set("missions_actives", Val::list(missions));
        let clients = py::sorted_by_key(e.at("clients").items(), |(_, c)| (-c.atf("fid"), -c.atf("livres")));
        let top: Vec<Val> = clients
            .into_iter()
            .take(8)
            .map(|(nom, c)| {
                let secteur = champ(&d("SECTEURS").get(c.get("secteur")), "nom").or("");
                dict! {"nom" => nom, "secteur" => secteur, "fid" => c.at("fid"), "niveau" => d("NIVEAUX_FIDELITE").at(c.at("fid")), "livres" => c.at("livres")}
            })
            .collect();
        v.set("clients_top", Val::list(top));
        v
    }
}
