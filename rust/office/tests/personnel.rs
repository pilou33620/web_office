//! tests/test_personnel.py, réécrit un pour un.

mod commun;

use commun::*;
use office::moteur::{d, Jeu};
use office::py::{self, Val};
use office::{dict, list};

#[test]
fn cv_cache_le_talent_et_les_traits() {
    let j = Jeu::graine(2);
    let vue = j.vue();
    for (c, vu) in j.etat.at("candidats").iter().zip(vue.at("candidats").iter()) {
        assert_eq!(vu.at("traits"), c.at("traits").slice(None, Some(1)));
        assert_eq!(vu.ati("traits_caches"), c.at("traits").len() as i64 - 1);
        assert!(vu.at("metier").at(c.at("cachee")).is_none());
        assert!(vu.at("motivation").is_none());
        assert_eq!(vu.at("seniorite"), c.at("annonce"));
        for cle in ["cachee", "annonce", "connu"] {
            assert!(!vu.has(cle));
        }
    }
    py::json::dumps(&j.vue());
}

#[test]
fn entretien_puis_specialiste() {
    let j = Jeu::graine(3);
    j.etat.set("argent", 50000);
    let c = j.etat.at("candidats").at(0);
    ok(&j, "entretien", dict! {"id" => c.at("id")});
    assert_eq!(j.etat.ati("argent"), 50000 - d("COUT_ENTRETIEN").i());
    let trouve = |j: &Jeu| j.vue().at("candidats").iter().find(|x| x.at("id") == c.at("id")).unwrap();
    let vu = trouve(&j);
    assert_eq!(vu.at("seniorite"), c.at("seniorite"));
    assert_eq!(vu.at("motivation"), c.at("motivation"));
    assert!(vu.at("indice").is_some());
    ko(&j, "entretien", dict! {"id" => c.at("id")});
    let avant = j.etat.ati("argent");
    ok(&j, "specialiste", dict! {"id" => c.at("id")});
    assert_eq!(j.etat.ati("argent"), avant - j.cout_specialiste());
    let vu = trouve(&j);
    assert_eq!(vu.at("traits"), c.at("traits"));
    assert_eq!(vu.at("metier"), c.at("metier"));
    ko(&j, "specialiste", dict! {"id" => c.at("id")}); // plus rien à découvrir : on ne paie pas pour rien
}

#[test]
fn cv_gonfle_paye_au_prix_annonce() {
    let j = Jeu::graine(4);
    for _ in 0..200 {
        let c = j.candidat();
        // commerciaux et chefs d'équipe : salaire à part
        if c.at("poste") != "Stagiaire" && !c.atb("commercial") && !c.getb("role_propose") {
            assert_eq!(c.ati("salaire"), j.prix_marche(&c, Some(c.ati("annonce"))));
            assert!([0, 1].contains(&(c.ati("annonce") - c.ati("seniorite"))));
        }
    }
}

#[test]
fn burnout_apres_surmenage() {
    let j = Jeu::graine(5);
    let x = j.etat.at("employes").at(0);
    x.set("fatigue", 50);
    for _ in 0..8 {
        x.set("fatigue", 50);
        j.jour_personnel();
    }
    assert_eq!((x.ats("absence"), x.ati("absent")), ("burnout".to_string(), 20));
}

#[test]
fn entretien_annuel_promotion() {
    let j = Jeu::graine(6);
    j.etat.set("argent", 1_000_000);
    let c = j.etat.at("candidats").at(0);
    ok(&j, "embaucher", dict! {"id" => c.at("id")});
    let x = j.etat.at("employes").at(-1i64);
    x.update(&dict! {"e" => 12, "m" => 3, "f" => 3, "seniorite" => 1, "annonce" => 1, "prochain_entretien" => 0});
    j.etat.set("evenement", Val::None);
    j.jour_personnel();
    let ev = j.etat.at("evenement");
    assert_eq!((ev.ats("type"), ev.ats("demande")), ("entretien".to_string(), "promotion".to_string()));
    let salaire = x.ati("salaire");
    ok(&j, "evenement", dict! {"choix" => 0});
    assert_eq!(x.ati("seniorite"), 2);
    let s = d("SENIORITES");
    assert_eq!(x.ati("salaire"), salaire + s.at(2).ati("prime") - s.at(1).ati("prime"));
    assert_eq!(x.ati("prochain_entretien"), 360);
}

#[test]
fn affinites_decouvertes_en_travaillant() {
    let j = Jeu::graine(7);
    let a = j.etat.at("employes").at(0);
    let b = a.copy();
    b.set("id", 999);
    let k = format!("{}-999", a.ati("id"));
    j.etat.at("affinites").set(k.as_str(), -1);
    assert!(proche(j.affinites(&[a.clone(), b.clone()], None), 0.95));
    assert!(j.etat.at("affinites_connues").has(k.as_str()));
    assert!(proche(j.affinites(&[a, b.clone()], Some(&dict! {"chef" => b.at("id")})), 0.975)); // un chef de projet suit le projet
}

#[test]
fn ancienne_sauvegarde() {
    let j = Jeu::graine(8);
    let etat = copie_json(&j.etat);
    for x in etat.at("employes").iter() {
        x.set("trait", "rapide");
        for cle in ["traits", "metier", "cachee", "seniorite", "annonce", "motivation", "connu", "arrivee", "prochain_entretien"] {
            x.pop(cle);
        }
    }
    for c in etat.at("candidats").iter() {
        c.pop("traits");
    }
    let k = Jeu::charger(etat, None).unwrap();
    assert_eq!(k.etat.at("employes").at(0).at("traits"), list!["rapide"]);
    assert!(k.etat.at("candidats").iter().all(|c| c.has("traits")));
    k.avancer(40);
    py::json::dumps(&k.vue());
}
