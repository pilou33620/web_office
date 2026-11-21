//! tests/test_commerce.py, réécrit un pour un.

mod commun;

use commun::*;
use office::moteur::{d, Jeu};
use office::py::{self, Val};
use office::{dict, list};

fn piste(j: &Jeu, rivaux: Val) -> Val {
    let o = j.offre(0, &Val::None);
    o.update(&dict! {"canal" => "plateformes", "expire" => 5, "rivaux" => rivaux});
    j.etat.at("pistes").push(&o);
    o
}

#[test]
fn quatre_rivaux_et_anciennes_parties() {
    let j = Jeu::graine(1);
    assert_eq!(j.etat.at("concurrents").len(), 4);
    let e = &j.etat;
    e.set("concurrents", list![dict! {"nom" => "ElectroConcept", "renommee" => 4}, dict! {"nom" => "Volta Ingénierie", "renommee" => 12}]);
    e.pop("rivaux_v2");
    e.set("prospection", "maison");
    let copie = Jeu::charger(e.clone(), None).unwrap();
    let noms: Vec<String> = copie.etat.at("concurrents").iter().map(|c| c.ats("nom")).collect();
    assert_eq!(noms, ["ElectroConcept", "Volta Ingénierie", "Onde & Signal"]);
    assert_eq!(copie.etat.at("concurrents").at(0).at("equipe"), 2i64);
    assert!(!copie.etat.has("prospection"));
}

#[test]
fn fondateur_prospecte() {
    let j = Jeu::graine(2);
    let moi = j.etat.at("employes").at(0);
    let avant = j.production(&moi, "e", &j.bonus());
    ok(&j, "prospecter", dict! {"canal" => "reseaux", "qui" => moi.at("id")});
    assert!(proche(j.production(&moi, "e", &j.bonus()), avant / 2.0)); // mi-temps au téléphone
    ko(&j, "prospecter", dict! {"canal" => "plateformes", "qui" => moi.at("id")}); // une prospection à la fois
    let nb = j.etat.at("offres").len();
    toujours(&j, Some(0.0));
    for _ in 0..d("CANAUX").at("reseaux").ati("jours") {
        j.jour_commerce();
    }
    toujours(&j, None);
    assert!(!j.etat.at("prospections").truthy());
    let reservees: Vec<Val> = j.etat.at("offres").iter().filter(|o| o.getb("reservee")).collect();
    assert_eq!(j.etat.at("offres").len() - nb, reservees.len());
    assert!(!reservees.is_empty() && reservees.iter().all(|o| o.at("canal") == "reseaux"));
}

#[test]
fn canaux_contraints() {
    let j = Jeu::graine(3);
    let moi = j.etat.at("employes").at(0).at("id");
    ko(&j, "prospecter", dict! {"canal" => "demarchage", "qui" => &moi}); // sans secteur
    ko(&j, "prospecter", dict! {"canal" => "inconnu", "qui" => &moi});
    ko(&j, "prospecter", dict! {"canal" => "reseaux", "qui" => 9999});
    j.etat.set("mois", 1);
    ko(&j, "prospecter", dict! {"canal" => "salon", "qui" => &moi}); // pas de salon en février
    j.etat.set("mois", 2);
    let argent = j.etat.ati("argent");
    ok(&j, "prospecter", dict! {"canal" => "salon", "qui" => &moi});
    assert_eq!(argent - j.etat.ati("argent"), d("CANAUX").at("salon").ati("cout"));
    assert!(j.salon_du_mois().is_none()); // un seul salon par mois
    j.etat.set("argent", -1000);
    let com = employe(&j, dict! {"e" => 2, "commercial" => true});
    ok(&j, "prospecter", dict! {"canal" => "plateformes", "qui" => com.at("id")}); // gratuit : possible même dans le rouge
}

#[test]
fn devis_gagne_sans_rival() {
    let j = Jeu::graine(4);
    let o = piste(&j, list![]);
    ko(&j, "devis", dict! {"id" => o.at("id"), "prix" => "0.5"});
    ok(&j, "devis", dict! {"id" => o.at("id"), "prix" => "1.1", "delai" => "0.8"});
    for _ in 0..4 {
        j.jour_commerce();
    }
    let gagne = j.etat.at("offres").iter().find(|x| x.getb("gagne")).unwrap();
    assert_eq!(
        (gagne.ati("paie"), gagne.ati("delai")),
        (py::round_n(o.atf("paie") * 1.1, -2) as i64, 8i64.max(py::round(o.atf("delai") * 0.8)))
    );
    ok(&j, "signer", dict! {"id" => gagne.at("id"), "prix" => "1.3"}); // prix fixé par le devis : la demande est ignorée
    assert_eq!(j.etat.at("projets").at(0).at("paie"), gagne.at("paie"));
}

#[test]
fn devis_perdu_trop_cher() {
    let j = Jeu::graine(5);
    let o = piste(&j, list!["ElectroConcept"]);
    ok(&j, "devis", dict! {"id" => o.at("id"), "prix" => "1.2", "delai" => "1.0"});
    let avant = j.etat.at("concurrents").at(0).ati("gagnes");
    for _ in 0..4 {
        j.jour_commerce();
    }
    assert!(!j.etat.at("offres").iter().any(|x| x.getb("gagne")));
    assert_eq!(j.etat.at("concurrents").at(0).ati("gagnes"), avant + 1);
    assert!(j.etat.at("journal").at(0).ats("texte").contains("trop cher"));
}

#[test]
fn rival_grandit() {
    let j = Jeu::graine(6);
    let c = j.etat.at("concurrents").at(0);
    let (rep, eq) = (c.ati("renommee"), c.ati("equipe"));
    for _ in 0..8 {
        j.rival_gagne(&c);
    }
    assert_eq!((c.ati("renommee"), c.ati("equipe")), (rep + 1, eq + 1));
}
