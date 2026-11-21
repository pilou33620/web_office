//! Personnel (moteur/personnel.py) : séniorité, traits multiples, compétences métier, motivations, affinités, fidélité,
//! burn-out, vie perso, entretiens annuels et découverte progressive des candidats (CV, entretien, spécialiste).

use super::{arrondi_entier, borne, d, erreur, mil, vmax, Jeu, R};
use crate::py::{self, Val};
use crate::{dict, list};

const MULTIPLICATIFS: [&str; 4] = ["vitesse", "defauts", "detection", "fatigue"]; // les autres effets de traits s'additionnent
const PRIX_METIER: i64 = 120; // €/mois par point de compétence métier
const DUREE_BURNOUT: i64 = 20;
const SEUIL_SURMENAGE: i64 = 8; // jours de suite à 45 de fatigue ou plus avant le burn-out

pub fn paire(a: i64, b: i64) -> String {
    format!("{}-{}", a.min(b), a.max(b))
}

/// Les clés de TRAITS, triées (`sorted(TRAITS)`).
fn traits_tries() -> Vec<Val> {
    let mut t = d("TRAITS").keys();
    t.sort_by(|a, b| a.partial_cmp(b).expect("noms de traits"));
    t
}

impl Jeu {
    // ------------------------------------------------------------------ caractéristiques
    pub fn trait_(&self, emp: &Val, cle: &str) -> f64 {
        let mult = MULTIPLICATIFS.contains(&cle);
        let mut v = if mult { 1.0 } else { 0.0 };
        for t in emp.at("traits").iter() {
            let x = d("TRAITS").at(&t).get(cle);
            if x.is_some() {
                v = if mult { v * x.f() } else { v + x.f() };
            }
        }
        v
    }

    pub fn metier(&self, emp: &Val, m: &str) -> i64 {
        let traits = emp.at("traits");
        emp.at("metier").ati(m) + 3 * (m == "commercial" && traits.has("negociateur")) as i64 + 2 * (m == "qualif" && traits.has("rigoureux")) as i64
    }

    pub fn meilleur_metier(&self, m: &str) -> i64 {
        self.etat.at("employes").iter().filter(|x| !x.atb("absent")).map(|x| self.metier(&x, m)).max().unwrap_or(0)
    }

    pub fn seniorite_possible(&self, x: &Val) -> i64 {
        let somme = x.atf("e") + x.atf("m") + x.atf("f");
        d("SENIORITES").iter().enumerate().filter(|(_, s)| somme >= s.atf("points")).map(|(i, _)| i as i64).max().expect("séniorité")
    }

    pub fn prix_marche(&self, x: &Val, seniorite: Option<i64>) -> i64 {
        let sen = seniorite.unwrap_or_else(|| x.ati("seniorite"));
        let metier: i64 = x.at("metier").values().iter().map(Val::i).sum();
        d("SALAIRE_BASE").i()
            + d("SALAIRE_POINT").i() * (x.ati("e") + x.ati("m") + x.ati("f"))
            + PRIX_METIER * metier
            + d("SENIORITES").at(sen).ati("prime")
    }

    pub fn anciennete(&self, x: &Val) -> f64 {
        (self.etat.atf("jours_total") - x.atf("arrivee")) / d("JOURS_AN").f()
    }

    pub fn satisfait(&self, x: &Val) -> bool {
        let (e, m) = (&self.etat, x.get("motivation"));
        if m == "salaire" {
            return x.at("salaire") >= self.prix_marche(x, None);
        }
        if m == "ambiance" {
            return self.moral_global() >= 70.0;
        }
        if m == "projets" {
            return e.at("projets").iter().any(|p| p.at("type") == "produit" || p.getb("mega") || p.at("taille") >= 300i64);
        }
        if m == "formation" {
            return e.ati("jours_total") - x.ati("derniere_formation") < d("JOURS_AN").i();
        }
        if m == "horaires" {
            return e.at("heures") <= 8i64;
        }
        true
    }

    /// Chance qu'un employé ignore une offre de la concurrence.
    pub fn fidelite(&self, x: &Val) -> f64 {
        0.7f64.min(0.12 * self.anciennete(x) + 0.15 * if self.satisfait(x) { 1.0 } else { 0.0 })
    }

    pub fn cout_specialiste(&self) -> i64 {
        2500 + 300 * self.etat.ati("renommee")
    }

    // ------------------------------------------------------------------ recrutement
    pub fn candidat(&self) -> Val {
        let rep = self.etat.ati("renommee");
        let stagiaire = self.random() < 0.15;
        let (profil, total) = if stagiaire {
            (dict! {"nom" => "Stagiaire", "poids" => dict! {"e" => 0.4, "m" => 0.3, "f" => 0.3}}, self.uniform(2.0, 4.0))
        } else {
            let profil = self.choice(&d("POSTES"));
            (profil, 24f64.min(self.uniform(4.0, 7.0) + rep as f64 * 0.7))
        };
        let poids = profil.at("poids");
        let stats = Val::dict();
        for dom in d("DOMAINES").iter() {
            stats.set(&dom, 0i64.max(py::round(total * poids.atf(&dom) + self.uniform(-0.6, 0.6))));
        }
        if py::sum_v(stats.values()).i() < 2 {
            let fort = py::max_by_key(poids.keys(), |k| poids.at(k)).expect("poids");
            stats.inc(&fort, 2i64);
        }
        let metier = Val::dict();
        for m in d("METIERS").keys() {
            let v = if self.random() < 0.3 { self.randint(1, 2) } else { 0 };
            metier.set(&m, v);
        }
        if profil.getb("metier") {
            metier.set(profil.at("metier"), 2i64.max(py::round(total * 0.45 + self.uniform(-1.0, 1.0))));
        }
        let cachee = self.choice(&d("METIERS"));
        metier.inc(&cachee, self.randint(2, 5)); // talent caché : ni le CV ni l'entretien ne le montrent
        let id = self.id();
        let nom = self.choice(&d("PRENOMS"));
        let k = if self.random() < 0.3 { 3 } else { 2 };
        let traits = self.sample(&Val::list(traits_tries()), k);
        let motivation = self.choice(&d("MOTIVATIONS"));
        let couleur = self.choice(&d("COULEURS"));
        let cheveux = self.choice(&d("CHEVEUX"));
        let peau = self.choice(&d("PEAUX"));
        let c = dict! {"id" => id, "nom" => nom, "poste" => profil.at("nom")};
        c.update(&stats);
        c.update(&dict! {
            "metier" => metier, "cachee" => &cachee, "traits" => traits, "motivation" => motivation,
            "connu" => dict! {"traits" => 1, "cachee" => false, "motivation" => false, "seniorite" => false, "indice" => Val::None},
            "couleur" => couleur, "cheveux" => cheveux, "peau" => peau,
        });
        if !stagiaire && rep >= 3 && self.random() < 0.12 {
            // un chef d'équipe expérimenté, embauché pour encadrer un service
            let dom = self.choice(&d("DOMAINES"));
            c.set(&dom, vmax(c.at(&dom), 8 + self.randint(0, 2)));
            c.update(&dict! {"poste" => format!("Chef d'équipe {}", d("NOM_DOMAINE").at(&dom)), "role_propose" => format!("resp_{dom}")});
        }
        c.set("chef", profil.getb("chef"));
        c.set("commercial", profil.getb("commercial"));
        let sen = if stagiaire { 0 } else { self.seniorite_possible(&c) };
        c.set("seniorite", sen);
        let annonce = if !stagiaire && self.random() < 0.3 { 3i64.min(sen + 1) } else { sen }; // CV parfois gonflé
        c.set("annonce", annonce);
        c.set("salaire", if stagiaire { 600 } else { self.prix_marche(&c, Some(annonce)) }); // on paie ce que le CV annonce
        if c.getb("commercial") {
            c.set("salaire", arrondi_entier(c.atf("salaire") * 0.6, 1)); // fixe plus faible : le reste en commission sur les contrats
        }
        if c.getb("role_propose") {
            c.inc("salaire", d("ROLES").at(c.at("role_propose")).at("salaire"));
        }
        c
    }

    /// Champs du personnel ; une ancienne sauvegarde garde ses employés, tout connus.
    pub fn completer_personnel(&self, x: &Val) {
        let e = &self.etat;
        if !x.has("traits") {
            x.set("traits", list![x.get_or("trait", "endurant")]);
        }
        x.pop("trait");
        if !x.has("metier") {
            let m = Val::dict();
            for k in d("METIERS").keys() {
                m.set(&k, 0);
            }
            x.set("metier", m);
        }
        x.setdefault("cachee", Val::None);
        // (setdefault de Python : la valeur par défaut est calculée, et le tirage fait, même si la clé existe)
        let sen = self.seniorite_possible(x);
        x.setdefault("seniorite", sen);
        x.setdefault("annonce", x.at("seniorite"));
        let motivation = if x.getb("fondateur") { Val::None } else { self.choice(&d("MOTIVATIONS")) };
        x.setdefault("motivation", motivation);
        if !x.has("connu") {
            x.set("connu", dict! {"traits" => x.at("traits").len(), "cachee" => true, "motivation" => true, "seniorite" => true, "indice" => Val::None});
        }
        x.setdefault("arrivee", e.at("jours_total"));
        x.setdefault("prochain_entretien", x.at("arrivee") + d("JOURS_AN"));
        x.setdefault("surmenage", 0);
        x.setdefault("derniere_formation", -999);
    }

    /// Nouvel employé : affinités tirées avec chacun des collègues (découvertes en travaillant ensemble).
    pub fn arrivee(&self, emp: &Val) {
        let aff = self.etat.at("affinites");
        for x in self.etat.at("employes").iter() {
            if !x.is(emp) {
                let t = self.random();
                if t < 0.25 {
                    aff.set(paire(x.ati("id"), emp.ati("id")).as_str(), if t < 0.15 { 1 } else { -1 });
                }
            }
        }
    }

    /// Découvre une caractéristique cachée (ou toutes) ; rend son libellé, ou None s'il n'y a plus rien à découvrir.
    pub fn reveler(&self, x: &Val, tout: bool) -> Val {
        let k = x.at("connu");
        let mut trouve: Vec<String> = Vec::new();
        loop {
            if k.ati("traits") < x.at("traits").len() as i64 {
                trouve.push(d("TRAITS").at(x.at("traits").at(k.at("traits"))).ats("nom").to_lowercase());
                k.inc("traits", 1i64);
            } else if !k.atb("cachee") && x.atb("cachee") {
                k.set("cachee", true);
                trouve.push(format!("doué en {}", d("METIERS").at(x.at("cachee")).ats("nom").to_lowercase()));
            } else if !k.atb("seniorite") {
                k.set("seniorite", true);
                trouve.push(d("SENIORITES").at(x.at("seniorite")).ats("nom").to_lowercase());
            } else if !k.atb("motivation") && x.getb("motivation") {
                k.set("motivation", true);
                trouve.push(format!("motivé par {}", d("MOTIVATIONS").at(x.at("motivation")).ats("nom").to_lowercase()));
            } else {
                break;
            }
            if !tout {
                break;
            }
        }
        if k.ati("traits") == x.at("traits").len() as i64 {
            k.set("indice", Val::None);
        }
        if trouve.is_empty() {
            Val::None
        } else {
            Val::from(trouve.join(", "))
        }
    }

    /// Rend vrai si l'action a été traitée ici.
    pub fn action_personnel(&self, genre: &str, p: &Val) -> R<bool> {
        let e = &self.etat;
        if genre == "entretien" {
            let Some(c) = e.at("candidats").iter().find(|x| x.at("id") == p.get("id")) else {
                return erreur("Candidat introuvable.");
            };
            let k = c.at("connu");
            if k.atb("seniorite") && k.atb("motivation") {
                return erreur("Entretien déjà passé.");
            }
            self.payer(d("COUT_ENTRETIEN"))?;
            k.set("seniorite", true);
            k.set("motivation", true);
            let caches = c.at("traits").slice(Some(k.ati("traits")), None);
            if caches.truthy() {
                // une impression, juste trois fois sur quatre
                let faux: Vec<Val> = traits_tries().into_iter().filter(|t| !c.at("traits").has(t)).collect();
                let indice = if self.random() < 0.75 { self.choice(&caches) } else { self.choice(&Val::list(faux)) };
                k.set("indice", indice);
            }
            let sen = d("SENIORITES").at(c.at("seniorite")).ats("nom").to_lowercase();
            let motiv = d("MOTIVATIONS").at(c.at("motivation")).ats("nom").to_lowercase();
            self.log(&format!("Entretien avec {} : {sen}, motivé par {motiv}.", c.at("nom")), "info");
        } else if genre == "specialiste" {
            let x = e.at("candidats").iter().chain(e.at("employes").iter()).find(|y| y.at("id") == p.get("id"));
            let Some(x) = x else { return erreur("Personne introuvable.") };
            let essai = x.copy();
            essai.set("connu", x.at("connu").copy());
            if !self.reveler(&essai, true).truthy() {
                return erreur(format!("On sait déjà tout de {}.", x.at("nom")));
            }
            self.payer(self.cout_specialiste())?;
            let trouve = self.reveler(&x, true);
            self.log(&format!("Le cabinet de recrutement a cerné {} : {trouve}.", x.at("nom")), "info");
        } else {
            return Ok(false);
        }
        Ok(true)
    }

    // ------------------------------------------------------------------ au travail
    /// Effet du contexte sur la vitesse : chef présent, taille de l'équipe, pression du délai.
    pub fn contexte(&self, emp: &Val, p: &Val, equipe: usize) -> f64 {
        let t = emp.at("traits");
        let mut f = 1.0;
        let chef = p.getb("chef") && p.at("chef") != emp.at("id"); // un chef de projet suit ce projet
        if t.has("autonome") && !chef {
            f *= 1.08;
        }
        if t.has("encadrement") {
            f *= if chef { 1.1 } else { 0.85 };
        }
        if t.has("solitaire") {
            f *= if equipe <= 2 {
                1.1
            } else if equipe >= 4 {
                0.9
            } else {
                1.0
            };
        }
        if t.has("stresse") && Jeu::sous_pression(p) {
            f *= 0.85;
        }
        f
    }

    pub fn sous_pression(p: &Val) -> bool {
        p.at("type") == "contrat" && p.ati("delai") - p.ati("jours") < 10
    }

    pub fn facteur_defauts_emp(&self, emp: &Val, p: &Val) -> f64 {
        let stresse = if emp.at("traits").has("stresse") && Jeu::sous_pression(p) { 1.2 } else { 1.0 };
        self.trait_(emp, "defauts") * d("SENIORITES").at(emp.at("seniorite")).atf("defauts") * stresse
    }

    /// Les collègues qui s'entendent travaillent mieux ensemble ; un chef de projet apaise les conflits.
    pub fn affinites(&self, equipe: &[Val], p: Option<&Val>) -> f64 {
        let e = &self.etat;
        let mut f = 1.0;
        let chef = p.is_some_and(|p| p.getb("chef"));
        for (i, a) in equipe.iter().enumerate() {
            for b in &equipe[i + 1..] {
                let k = paire(a.ati("id"), b.ati("id"));
                let v = e.at("affinites").get(k.as_str());
                if !v.truthy() {
                    continue;
                }
                let bonne = v > 0i64;
                if !e.at("affinites_connues").has(k.as_str()) {
                    e.at("affinites_connues").push(k.as_str());
                    let quoi = if bonne { "s'entendent à merveille." } else { "ne se supportent pas…" };
                    self.log(&format!("{} et {} {quoi}", a.at("nom"), b.at("nom")), if bonne { "bon" } else { "mauvais" });
                }
                f *= if bonne {
                    1.03
                } else if chef {
                    0.975
                } else {
                    0.95
                };
            }
        }
        f
    }

    /// Bonus du chef de projet qui suit ce projet : sa gestion, son leadership, son bureau ; partagé entre ses projets.
    pub fn mult_chef(&self, p: &Val) -> f64 {
        let Some(c) = self.etat.at("employes").iter().find(|x| x.at("id") == p.get("chef")) else { return 1.0 };
        let leader = if c.at("traits").has("leader") { 1.5 } else { 1.0 };
        let bureau = if self.roles().at("pieces").get(c.at("id")) == "cdp" { 1.5 } else { 1.0 };
        1.0 + (0.06 + 0.01 * self.metier(&c, "gestion") as f64) * leader * bureau * p.get_or("suivi", 0).f()
    }

    // ------------------------------------------------------------------ chaque jour, chaque mois
    pub fn jour_personnel(&self) {
        let e = &self.etat;
        for x in e.at("employes").iter() {
            if x.atb("absent") {
                continue;
            }
            let s = if x.at("fatigue") >= 45i64 { x.ati("surmenage") + 1 } else { 0i64.max(x.ati("surmenage") - 1) };
            x.set("surmenage", s);
            if s >= SEUIL_SURMENAGE {
                let humeur = borne(&x.at("humeur") - 4i64, -8, 8);
                x.update(&dict! {"absent" => DUREE_BURNOUT, "absence" => "burnout", "surmenage" => 0, "humeur" => humeur});
                self.log(&format!("Burn-out : {} est arrêté {DUREE_BURNOUT} jours. Trop de fatigue trop longtemps.", x.at("nom")), "mauvais");
            } else if self.random() < 0.0015 {
                let n = self.randint(2, 5);
                x.update(&dict! {"absent" => n, "absence" => "maladie"});
                self.log(&format!("{} est malade, arrêt de {n} jours.", x.at("nom")), "info");
            }
        }
        if !e.atb("evenement") {
            for x in e.at("employes").iter() {
                if !x.getb("fondateur") && !x.getb("stage") && e.at("jours_total") >= x.at("prochain_entretien") {
                    x.inc("prochain_entretien", d("JOURS_AN"));
                    e.set("evenement", self.entretien(&x));
                    break;
                }
            }
        }
    }

    pub fn mois_personnel(&self) {
        for x in self.etat.at("employes").iter() {
            if !x.getb("fondateur") && !x.getb("stage") {
                let pas = if self.satisfait(&x) { 1i64 } else { -1i64 };
                x.set("humeur", borne(&x.at("humeur") + pas, -8, 8));
            }
            if self.random() < 0.25 {
                let trouve = self.reveler(&x, false);
                if trouve.truthy() {
                    self.log(&format!("On apprend à connaître {} : {trouve}.", x.at("nom")), "info");
                }
            }
        }
    }

    fn entretien(&self, x: &Val) -> Val {
        let (cible, nom) = (x.ati("seniorite") + 1, x.at("nom"));
        let sens = d("SENIORITES");
        let ev = dict! {"type" => "entretien", "titre" => format!("Entretien annuel de {nom}"), "employe" => x.at("id")};
        if cible < sens.len() as i64 && self.seniorite_possible(x) >= cible {
            let hausse = sens.at(cible).ati("prime") - sens.at(x.at("seniorite")).ati("prime");
            let statut = sens.at(cible).ats("nom").to_lowercase();
            ev.update(&dict! {
                "demande" => "promotion", "hausse" => hausse, "texte" => format!("{nom} estime mériter le statut {statut}."),
                "options" => list![format!("Le passer {statut} (+{hausse} €/mois)"), "Pas cette année"],
            });
            return ev;
        }
        if x.at("motivation") == "salaire" || x.at("traits").has("ambitieux") {
            let hausse = arrondi_entier(x.atf("salaire") * 0.06, 1);
            ev.update(&dict! {
                "demande" => "augmentation", "hausse" => hausse, "texte" => format!("{nom} demande une augmentation de 6 %."),
                "options" => list![format!("Accepter (+{hausse} €/mois)"), "Refuser"],
            });
            return ev;
        }
        if x.at("motivation") == "formation" && !x.atb("absent") {
            let cout = self.cout_formation(x);
            ev.update(&dict! {
                "demande" => "formation", "cout" => cout, "texte" => format!("{nom} aimerait suivre une formation cette année."),
                "options" => list![format!("L'envoyer en formation (−{} €)", mil(cout)), "Plus tard"],
            });
            return ev;
        }
        ev.update(&dict! {"demande" => "point", "texte" => format!("Bilan de l'année avec {nom} : tout va bien."), "options" => list!["Le féliciter"]});
        ev
    }

    pub fn evenements_personnel(&self, possibles: &mut Vec<Val>) {
        let presents: Vec<Val> = self.etat.at("employes").iter().filter(|x| !x.atb("absent") && !x.getb("stage")).collect();
        if !presents.is_empty() {
            let x = self.choice(&Val::list(presents));
            possibles.push(dict! {
                "type" => "naissance", "titre" => "Heureux évènement", "employe" => x.at("id"),
                "texte" => format!("{} va être parent ! Dix jours de congé à prévoir.", x.at("nom")),
                "options" => list!["Félicitations !", "Offrir un cadeau de l'équipe (−300 €)"],
            });
        }
    }

    /// Rend vrai si l'évènement a été traité ici.
    pub fn resoudre_personnel(&self, ev: &Val, choix: i64) -> R<bool> {
        let t = ev.at("type");
        if !(t == "entretien" || t == "naissance") {
            return Ok(false);
        }
        let Some(x) = self.etat.at("employes").iter().find(|y| y.at("id") == ev.at("employe")) else { return Ok(true) };
        if t == "naissance" {
            if choix == 1 {
                self.payer(300)?;
                x.set("humeur", borne(&x.at("humeur") + 4i64, -8, 8));
            }
            if !x.atb("absent") {
                x.update(&dict! {"absent" => 10, "absence" => "naissance"});
            }
            return Ok(true);
        }
        let demande = ev.at("demande");
        if choix == 1 {
            // refus
            let baisse = if x.at("traits").has("ambitieux") { 6i64 } else { 3i64 };
            x.set("humeur", borne(&x.at("humeur") - baisse, -8, 8));
            return Ok(true);
        }
        if demande == "promotion" || demande == "augmentation" {
            x.inc("salaire", ev.at("hausse"));
            x.set("humeur", borne(&x.at("humeur") + 3i64, -8, 8));
            if demande == "promotion" {
                let s = x.ati("seniorite") + 1;
                x.set("seniorite", s);
                x.set("annonce", s);
                x.at("connu").set("seniorite", true);
                self.log(&format!("{} passe {} !", x.at("nom"), d("SENIORITES").at(s).ats("nom").to_lowercase()), "bon");
            }
        } else if demande == "formation" {
            self.payer(ev.at("cout"))?;
            x.set("humeur", borne(&x.at("humeur") + 2i64, -8, 8));
            if !x.atb("absent") {
                let dom = py::max_by_key(d("DOMAINES").iter(), |k| x.at(k)).expect("domaines");
                x.update(&dict! {"absent" => 10, "absence" => "formation", "formation" => dom, "derniere_formation" => self.etat.at("jours_total")});
            }
        } else {
            x.set("humeur", borne(&x.at("humeur") + 2i64, -8, 8));
        }
        Ok(true)
    }

    // ------------------------------------------------------------------ vue (ce qu'on ne sait pas reste caché)
    fn public(&self, x: &Val) -> Val {
        let k = x.at("connu");
        let n = k.ati("traits");
        let metier = Val::dict();
        for (m, val) in x.at("metier").items() {
            metier.set(&m, if m == x.get("cachee") && !k.atb("cachee") { Val::None } else { val });
        }
        let v = x.copy();
        v.update(&dict! {
            "traits" => x.at("traits").slice(None, Some(n)), "traits_caches" => x.at("traits").len() as i64 - n,
            "metier" => metier, "motivation" => if k.atb("motivation") { x.get("motivation") } else { Val::None },
            "seniorite" => if k.atb("seniorite") { x.at("seniorite") } else { x.at("annonce") },
            "seniorite_sure" => k.at("seniorite"), "entretien_fait" => k.at("seniorite").and(k.at("motivation")), "indice" => k.at("indice"),
        });
        for cle in ["cachee", "annonce", "connu"] {
            v.del(cle);
        }
        v
    }

    pub fn vue_personnel(&self, v: Val) -> Val {
        let e = &self.etat;
        let noms = Val::dict();
        for x in e.at("employes").iter() {
            noms.set(x.at("id"), x.at("nom"));
        }
        v.set("candidats", Val::list(e.at("candidats").iter().map(|c| self.public(&c)).collect()));
        let employes = list![];
        for (x, vx) in e.at("employes").iter().zip(v.at("employes").iter()) {
            let publ = vx.copy();
            publ.update(&self.public(&x));
            publ.set("anciennete", py::round_n(self.anciennete(&x), 1));
            publ.set("satisfait", if x.at("connu").atb("motivation") { Val::Bool(self.satisfait(&x)) } else { Val::None });
            let (amis, froid) = (list![], list![]);
            let id = x.ati("id");
            for k in e.at("affinites_connues").iter() {
                let ks = k.string();
                let (a, b) = ks.split_once('-').expect("paire d'identifiants");
                let (a, b): (i64, i64) = (a.parse().expect("identifiant"), b.parse().expect("identifiant"));
                let autre = if a == id {
                    Some(b)
                } else if b == id {
                    Some(a)
                } else {
                    None
                };
                if let Some(autre) = autre {
                    if noms.has(autre) {
                        if e.at("affinites").at(&k) > 0i64 {
                            amis.push(noms.at(autre));
                        } else {
                            froid.push(noms.at(autre));
                        }
                    }
                }
            }
            publ.set("amis", amis);
            publ.set("froid", froid);
            employes.push(publ);
        }
        v.set("employes", employes);
        v.set("cout_specialiste", self.cout_specialiste());
        v
    }
}
