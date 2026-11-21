//! Commerce (moteur/commerce.py) : prospection par canaux (plateformes, réseaux, démarchage, salons), pistes, devis mis
//! en concurrence avec les rivaux.

use super::{arrondi_entier, champ, d, erreur, Jeu, R};
use crate::py::{self, Val};
use crate::{dict, list};

const PROD_PROSPECTION: f64 = 0.5; // part de sa production que garde celui qui prospecte

/// Le style d'un rival (`STYLES.get(nom, STYLE_NEUTRE)`).
fn style(nom: &Val) -> Val {
    d("CONCURRENTS")
        .iter()
        .find(|c| c.at("nom") == *nom)
        .unwrap_or_else(|| dict! {"style" => "", "prix" => 1.0, "delai" => 1.0, "secteurs" => list![]})
}

fn raison(k: &str) -> &'static str {
    match k {
        "prix" => "trop cher",
        "delai" => "délai trop long",
        _ => "pas assez connu",
    }
}

/// Un rival en début de partie (état qui évolue : renommée, équipe, contrats gagnés).
fn rival(c: &Val) -> Val {
    dict! {"nom" => c.at("nom"), "renommee" => c.at("renommee"), "equipe" => c.at("equipe"), "gagnes" => 0}
}

impl Jeu {
    pub fn init_commerce(&self) {
        let e = &self.etat;
        for cle in ["pistes", "devis", "prospections"] {
            e.setdefault(cle, list![]);
        }
        e.pop("prospection"); // ancien secteur visé par les commerciaux : remplacé par le démarchage
        for c in e.at("concurrents").iter() {
            c.setdefault("equipe", style(&c.at("nom")).get_or("equipe", 3));
            c.setdefault("gagnes", 0);
        }
        if !e.getb("rivaux_v2") {
            // anciennes parties : le quatrième rival arrive
            e.set("rivaux_v2", true);
            let noms: Vec<Val> = e.at("concurrents").iter().map(|c| c.at("nom")).collect();
            for c in d("CONCURRENTS").iter() {
                if !noms.contains(&c.at("nom")) && c.at("nom") == "Onde & Signal" {
                    e.at("concurrents").push(rival(&c));
                }
            }
        }
    }

    // ------------------------------------------------------------------ prospection
    /// Le fondateur et les commerciaux présents.
    pub fn prospecteurs(&self) -> Vec<Val> {
        self.etat.at("employes").iter().filter(|x| (x.getb("fondateur") || x.getb("commercial")) && !x.atb("absent")).collect()
    }

    pub fn en_prospection(&self, emp: &Val) -> bool {
        self.etat.at("prospections").iter().any(|pr| pr.at("qui") == emp.at("id"))
    }

    pub fn facteur_prospection(&self, emp: &Val) -> f64 {
        if self.en_prospection(emp) {
            PROD_PROSPECTION
        } else {
            1.0
        }
    }

    /// Nom du salon de ce mois-ci s'il n'est pas déjà fait, sinon None.
    pub fn salon_du_mois(&self) -> Val {
        let e = &self.etat;
        if e.get("dernier_salon") != Val::from(format!("{}-{}", e.at("annee"), e.at("mois"))) {
            d("SALONS").get(e.at("mois"))
        } else {
            Val::None
        }
    }

    fn prospecter(&self, p: &Val) -> R {
        let e = &self.etat;
        let k = p.get("canal");
        let canaux = d("CANAUX");
        if !canaux.has(&k) {
            return erreur("Canal de prospection inconnu.");
        }
        let Some(qui) = self.prospecteurs().into_iter().find(|x| x.at("id") == p.get("qui")) else {
            return erreur("Seuls le fondateur et les commerciaux présents prospectent.");
        };
        if self.en_prospection(&qui) {
            return erreur(format!("{} prospecte déjà.", qui.at("nom")));
        }
        let secteur = if k == "demarchage" { p.get("secteur") } else { Val::None };
        if k == "demarchage" && !d("SECTEURS").has(&secteur) {
            return erreur("Choisissez le secteur à démarcher.");
        }
        let salon = self.salon_du_mois();
        if k == "salon" && !salon.truthy() {
            return erreur("Pas de salon ce mois-ci.");
        }
        let c = canaux.at(&k);
        if c.getb("cout") {
            // les canaux gratuits restent ouverts même dans le rouge
            self.payer(c.at("cout"))?;
        }
        if k == "salon" {
            e.set("dernier_salon", format!("{}-{}", e.at("annee"), e.at("mois")));
        }
        e.at("prospections").push(dict! {"canal" => &k, "qui" => qui.at("id"), "jours" => c.at("jours"), "secteur" => &secteur});
        let quoi = if k == "salon" {
            salon.to_string()
        } else if secteur.truthy() {
            format!("{} ({})", c.at("nom"), d("SECTEURS").at(&secteur).at("nom"))
        } else {
            c.ats("nom")
        };
        self.log(&format!("{} prospecte : {quoi}, {} jours.", qui.at("nom"), c.at("jours")), "info");
        Ok(())
    }

    fn fin_prospection(&self, pr: &Val, qui: &Val) {
        let e = &self.etat;
        let c = d("CANAUX").at(pr.at("canal"));
        let reseaux = if pr.at("canal") == "reseaux" { 0.03 * e.ati("renommee").min(10) as f64 } else { 0.0 };
        let reussite = c.atf("reussite") + 0.05 * self.metier(qui, "commercial") as f64 + reseaux;
        let (a, b) = c.at("pistes").pair();
        let essais = self.randint(a.i(), b.i());
        let mut n = 0;
        for _ in 0..essais {
            if self.random() < 0.95f64.min(reussite) {
                n += 1;
            }
        }
        for _ in 0..n {
            let o = self.offre(c.ati("bonus_rep"), &pr.at("secteur"));
            o.set("canal", pr.at("canal"));
            if c.getb("devis") {
                o.set("expire", self.randint(4, 7));
                let rivaux: Vec<Val> = e
                    .at("concurrents")
                    .iter()
                    .filter(|x| self.random() < 0.7f64.min(c.atf("rivaux") + 0.03 * x.atf("equipe")))
                    .map(|x| x.at("nom"))
                    .collect();
                o.set("rivaux", Val::list(rivaux));
                e.at("pistes").push(o);
            } else {
                o.set("expire", self.randint(5, 8));
                o.set("reservee", true);
                e.at("offres").push(o);
            }
        }
        if pr.at("canal") == "salon" {
            e.inc("renommee", 1i64);
        }
        let suite = if c.getb("devis") { "à chiffrer dans Commerce" } else { "réservée(s) pour vous dans Projets" };
        let texte = if n > 0 { format!("{n} piste(s) {suite}.") } else { "aucune piste cette fois.".into() };
        self.log(&format!("Prospection de {} : {texte}", qui.at("nom")), if n > 0 { "bon" } else { "info" });
    }

    // ------------------------------------------------------------------ devis
    fn envoyer_devis(&self, p: &Val) -> R {
        let e = &self.etat;
        let Some(o) = e.at("pistes").iter().find(|x| x.at("id") == p.get("id")) else {
            return erreur("Cette piste n'est plus disponible.");
        };
        let (prix, delai) = (p.get_or("prix", "1.0").to_string(), p.get_or("delai", "1.0").to_string());
        if !d("DEVIS_PRIX").has(prix.as_str()) || !d("DEVIS_DELAIS").has(delai.as_str()) {
            return erreur("Paramètres invalides.");
        }
        e.at("pistes").remove(&o);
        let devis = o.copy();
        devis.update(&dict! {"prix" => prix.as_str(), "delai_devis" => delai.as_str(), "reponse" => self.randint(2, 4)});
        e.at("devis").push(devis);
        self.log(&format!("Devis envoyé à {} pour « {} » : réponse dans quelques jours.", o.at("client"), o.at("nom")), "info");
        Ok(())
    }

    /// Le client compare votre devis à ceux des rivaux consultés : prix, délai, renommée (et un peu de hasard).
    fn decider_devis(&self, dv: &Val) {
        let e = &self.etat;
        let px: f64 = dv.ats("prix").parse().expect("prix du devis");
        let dl: f64 = dv.ats("delai_devis").parse().expect("délai du devis");
        let moi = [
            ("prix", -2.6 * (px - 1.0)),
            ("delai", -0.6 * (dl - 1.0)),
            ("renommee", 0.02 * e.atf("renommee") + 0.01 * self.meilleur_metier("commercial") as f64),
        ];
        let somme = |t: &[(&str, f64); 3]| py::sum(t.iter().map(|x| x.1));
        let mut meilleur: Option<Val> = None;
        let mut score = somme(&moi) + self.uniform(-0.2, 0.2);
        let mut parts = moi;
        for c in e.at("concurrents").iter() {
            if !dv.at("rivaux").has(&c.at("nom")) {
                continue; // pas consulté, ou racheté entre-temps
            }
            let s = style(&c.at("nom"));
            let secteur = if s.at("secteurs").has(&dv.at("secteur")) { 0.15 } else { 0.0 };
            let lui = [("prix", -2.6 * (s.atf("prix") - 1.0)), ("delai", -0.6 * (s.atf("delai") - 1.0)), ("renommee", 0.02 * c.atf("renommee") + secteur)];
            let sc = somme(&lui) + self.uniform(-0.2, 0.2);
            if sc > score {
                meilleur = Some(c);
                score = sc;
                parts = lui;
            }
        }
        if meilleur.is_none() && self.random() >= self.chance_negociation(px, dl, dv.get_or("fidele", 0).f()) {
            self.log(&format!("Devis refusé : {} trouve « {} » trop cher pour son budget.", dv.at("client"), dv.at("nom")), "mauvais");
            return;
        }
        if let Some(m) = meilleur {
            let k = py::min_by_key(0..3usize, |&i| moi[i].1 - parts[i].1).expect("trois critères");
            self.rival_gagne(&m);
            let pourquoi = if moi[k].1 - parts[k].1 < -0.05 { raison(moi[k].0) } else { "de peu" };
            self.log(&format!("Devis perdu : {} remporte « {} » ({pourquoi}).", m.at("nom"), dv.at("nom")), "mauvais");
            return;
        }
        let o = Val::dict();
        for (k, v) in dv.items() {
            if !["prix", "delai_devis", "reponse", "rivaux"].iter().any(|x| k == *x) {
                o.set(&k, v);
            }
        }
        o.update(&dict! {
            "paie" => arrondi_entier(dv.atf("paie") * px, 2), "delai" => 8i64.max(py::round(dv.atf("delai") * dl)), "expire" => 10, "gagne" => true,
        });
        e.at("offres").push(&o);
        self.log(&format!("Devis accepté par {} : « {} », à signer dans Projets.", o.at("client"), o.at("nom")), "bon");
    }

    /// Un rival qui vous prend des marchés grandit : renommée et équipe tous les huit.
    pub fn rival_gagne(&self, c: &Val) {
        c.set("gagnes", c.get_or("gagnes", 0) + 1i64);
        if py::mod_i(c.ati("gagnes"), 8) == 0 {
            c.inc("renommee", 1i64);
            c.set("equipe", c.get_or("equipe", 3) + 1i64);
        }
    }

    // ------------------------------------------------------------------ tour de jeu, actions, vue
    pub fn jour_commerce(&self) {
        let e = &self.etat;
        for pr in e.at("prospections").iter() {
            pr.dec("jours", 1i64);
            if pr.ati("jours") <= 0 {
                e.at("prospections").remove(&pr);
                if let Some(qui) = e.at("employes").iter().find(|x| x.at("id") == pr.at("qui")) {
                    self.fin_prospection(&pr, &qui); // parti entre-temps : rien
                }
            }
        }
        for o in e.at("pistes").iter() {
            o.dec("expire", 1i64);
            if o.ati("expire") <= 0 {
                e.at("pistes").remove(&o);
            }
        }
        for dv in e.at("devis").iter() {
            dv.dec("reponse", 1i64);
            if dv.ati("reponse") <= 0 {
                e.at("devis").remove(&dv);
                self.decider_devis(&dv);
            }
        }
    }

    pub fn action_commerce(&self, genre: &str, p: &Val) -> R<bool> {
        match genre {
            "prospecter" => self.prospecter(p)?,
            "devis" => self.envoyer_devis(p)?,
            _ => return Ok(false),
        }
        Ok(true)
    }

    pub fn vue_commerce(&self, v: Val) -> Val {
        let e = &self.etat;
        let salon = self.salon_du_mois();
        let canaux = Val::dict();
        for (k, c) in d("CANAUX").items() {
            let x = c.copy();
            x.set("salon", if k == "salon" { salon.clone() } else { Val::None });
            x.set("dispo", k != "salon" || salon.truthy());
            canaux.set(&k, x);
        }
        v.set("canaux", canaux);
        let (mois, salons) = (e.ati("mois"), d("SALONS"));
        let prochain = (mois + 1..mois + 13).map(|m| py::mod_i(m, 12)).find(|m| salons.has(*m)).map(|m| salons.at(m)).unwrap_or(Val::None);
        v.set("prochain_salon", prochain);
        let prospecteurs = self
            .prospecteurs()
            .iter()
            .map(|x| dict! {"id" => x.at("id"), "nom" => x.at("nom"), "commercial" => self.metier(x, "commercial"), "occupe" => self.en_prospection(x)})
            .collect();
        v.set("prospecteurs", Val::list(prospecteurs));
        v.set("devis_prix", d("DEVIS_PRIX"));
        v.set("devis_delais", d("DEVIS_DELAIS"));
        for x in v.at("employes").iter() {
            x.set("prospecte", self.en_prospection(&x));
        }
        for c in v.at("classement").iter() {
            let s = if c.getb("vous") { Val::str("") } else { champ(&style(&c.at("nom")), "style") };
            c.set("style", s);
        }
        v
    }
}
