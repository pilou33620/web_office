//! tests/test_extensions.py, réécrit un pour un.

mod commun;

use commun::*;
use office::moteur::{d, requis_liste, Jeu};
use office::py::{self, Val};
use office::{dict, list};

fn jour(j: &Jeu, n: usize) {
    for _ in 0..n {
        j.etat.set("evenement", Val::None);
        j.etat.pop("dernier_livre");
        j.etat.pop("bilan");
        j.jour();
    }
}

#[test]
fn choix_techniques() {
    let j = Jeu::graine(1);
    let o = j.etat.at("offres").at(0).copy();
    o.update(&dict! {"total" => dict! {"e" => 40, "m" => 20, "f" => 40}, "taille" => 100});
    j.etat.at("offres").set(0, &o);
    let argent = j.etat.ati("argent");
    ok(&j, "signer", dict! {"id" => o.at("id"), "tech" => dict! {"couches" => "6", "mcu" => "esp32", "boitier" => "injection"}});
    let p = j.etat.at("projets").at(0);
    assert_eq!(p.at("total"), dict! {"e" => 40, "m" => 25, "f" => 34});
    assert_eq!(j.etat.ati("argent"), argent - 3000 + p.ati("acompte"));
    assert!(proche(j.note_bonus(&p), 0.7));
    ko(&j, "signer", dict! {"id" => j.etat.at("offres").at(0).at("id"), "tech" => dict! {"mcu" => "nrf"}}); // BLE requis
}

#[test]
fn prestataires() {
    let j = Jeu::graine(1);
    j.etat.set("argent", 100000);
    let o = j.etat.at("offres").at(0).copy();
    o.update(&dict! {"secteur" => "industrie", "total" => dict! {"e" => 60, "m" => 0, "f" => 40}, "taille" => 100});
    j.etat.at("offres").set(0, &o);
    let argent = j.etat.ati("argent");
    ko(&j, "signer", dict! {"id" => o.at("id"), "presta" => dict! {"f" => "inconnu"}});
    ok(
        &j,
        "signer",
        dict! {"id" => o.at("id"), "tech" => dict! {"indus" => "carte", "qualif" => "produit"},
        "presta" => dict! {"f" => "freelance", "m" => "be", "indus" => "be", "qualif" => "labo"}},
    );
    let p = j.etat.at("projets").at(0);
    assert_eq!(p.at("presta").at("m"), "interne"); // pas de méca sur ce projet
    assert_eq!(argent - j.etat.ati("argent"), 35 * 40 + py::round_n((3.0 + 5.0) * 1.5 * 100.0, -1) as i64 - p.ati("acompte"));
    assert_eq!(p.at("qualite_presta"), dict! {"indus" => 1.0, "qualif" => 1.0});
    assert_eq!(p.at("phases").at(-1i64).at("essais"), 7i64);
    // le freelance avance le firmware seul, l'équipe ne s'en occupe pas
    let ph = p.at("phases").at(0);
    j.travailler(&p, &[], &j.bonus());
    assert_eq!(ph.at("fait").at("f"), 4i64); // 4 points par jour sur un projet de cette taille
    j.travailler(&p, &[], &j.bonus());
    assert_eq!(ph.at("fait").at("f"), ph.at("besoin").at("f"));
    assert_eq!(ph.at("fait").at("e"), 0i64);
    // options verrouillées par une certification
    ko(&j, "signer", dict! {"id" => j.etat.at("offres").at(0).at("id"), "tech" => dict! {"composants" => "auto"}});
    j.etat.at("certifs").push("auto");
    assert_eq!(j.choix_valides(&dict! {"composants" => "auto"}).unwrap().at("composants"), "auto");
}

#[test]
fn qualif_ratee() {
    let j = Jeu::graine(2);
    let p = dict! {
        "nom" => "X", "taille" => 100, "total" => dict! {"e" => 100, "m" => 0, "f" => 0}, "presta" => dict! {"qualif" => "interne"},
        "choix" => dict! {}, "etape" => "travail", "phase" => 0, "defauts" => 0.0, "combos" => dict! {},
        "phases" => list![dict! {"nom" => "Qualification", "etape" => "qualif", "besoin" => dict! {}, "fait" => dict! {}, "attente" => 1, "essais" => 6}],
    };
    toujours(&j, Some(0.0)); // tirage le plus défavorable
    j.travailler(&p, &[], &j.bonus());
    assert_eq!(p.at("phases").at(0).at("attente"), 6i64);
}

#[test]
fn negociation() {
    let j = Jeu::graine(2);
    assert_eq!(j.chance_negociation(1.0, 1.0, 0.0), 1.0);
    assert!(j.chance_negociation(1.3, 1.2, 0.0) < 0.5);
    j.etat.set("argent", 100000);
    ok(&j, "local", dict! {"id" => "bureau"});
    let (mut perdus, mut gagnes) = (0, 0);
    for _ in 0..30 {
        if !j.etat.at("offres").truthy() {
            let o = j.offre(0, &Val::None);
            j.etat.at("offres").push(o);
        }
        j.etat.at("projets").clear();
        ok(&j, "signer", dict! {"id" => j.etat.at("offres").at(0).at("id"), "prix" => "1.3"});
        if j.etat.at("projets").truthy() {
            gagnes += 1;
            assert_eq!(j.etat.at("projets").at(0).ati("paie") % 10, 0);
        } else {
            perdus += 1;
        }
    }
    assert!(perdus > 0);
    assert!(gagnes > 0);
}

#[test]
fn recherche_et_certifications() {
    let j = Jeu::graine(3);
    j.etat.set("argent", 200000);
    ko(&j, "recherche", dict! {"id" => "ia"}); // BLE d'abord
    ok(&j, "recherche", dict! {"id" => "ble"});
    ko(&j, "recherche", dict! {"id" => "rf"}); // une à la fois
    ok(&j, "certifier", dict! {"id" => "ce"});
    jour(&j, 30);
    assert!(j.etat.at("technos").has("ble"));
    assert!(j.etat.at("certifs").has("ce"));
    assert_eq!(j.bonus().at("f"), 2i64); // ST-Link + BLE
    j.etat.set("renommee", 20);
    let requis: Vec<Val> = (0..300).map(|_| j.offre(0, &Val::None).at("requis")).collect();
    assert!(requis.iter().any(|r| *r == "ble"));
    assert!(!requis.iter().any(|r| *r == "rf"));
}

#[test]
fn sav_et_series() {
    let j = Jeu::graine(4);
    let p = j.creer_projet(&dict! {"nom" => "Carte", "client" => "DomoSud", "taille" => 100, "total" => dict! {"e" => 60, "m" => 0, "f" => 40}, "paie" => 9000}, "contrat");
    p.set("defauts", 50.0);
    j.etat.set("argent", 100000);
    toujours(&j, Some(0.0)); // tout arrive
    j.apres_livraison(&p, &Val::Float(8.0), &Val::Int(5000));
    assert_eq!(j.etat.at("garanties").len(), 1);
    assert!(j.etat.at("offre_serie").is_some());
    j.fin_jour_extensions();
    assert_eq!(j.etat.at("evenement").at("type"), "sav");
    let argent = j.etat.ati("argent");
    ok(&j, "evenement", dict! {"choix" => 0});
    assert!(j.etat.ati("argent") < argent);
    j.fin_jour_extensions();
    assert_eq!(j.etat.at("evenement").at("type"), "serie");
    ok(&j, "evenement", dict! {"choix" => 0});
    assert_eq!(j.etat.at("series").len(), 1);
    toujours(&j, None);
}

#[test]
fn series_rapportent() {
    let j = Jeu::graine(5);
    j.etat.at("series").push(dict! {"nom" => "X", "client" => "Y", "mois" => 2, "marge" => 1000});
    let (rec, _, _, _) = j.mois_extensions();
    assert_eq!(rec, 1000);
    j.mois_extensions();
    assert_eq!(j.etat.at("series").len(), 0);
}

#[test]
fn fournisseur_et_proto() {
    let j = Jeu::graine(6);
    let p = j.creer_projet(&dict! {"nom" => "x", "taille" => 100, "total" => dict! {"e" => 50, "m" => 20, "f" => 30}}, "contrat");
    j.etat.at("projets").push(&p);
    ok(&j, "fournisseur", dict! {"id" => "asie"});
    p.set("phase", 2);
    j.entrer_phase(&p);
    assert_eq!(p.at("phases").at(2).at("attente"), 6i64);
    assert_eq!(p.at("phases").at(2).at("cout"), 240i64);
    j.etat.set("argent", 100000);
    j.etat.at("prets").push(dict! {"montant" => 24000, "mensualite" => 1120, "mois" => 24});
    let argent = j.etat.ati("argent");
    let (_, dep, _, capital) = j.mois_extensions();
    assert_eq!((capital, dep), (1000, 120)); // seuls les intérêts sont des charges
    ok(&j, "rembourser", dict! {});
    assert_eq!(j.etat.ati("argent"), argent - 23000);
}

#[test]
fn prets_et_levee() {
    let j = Jeu::graine(7);
    let argent = j.etat.ati("argent");
    ok(&j, "emprunter", dict! {"montant" => 10000});
    assert_eq!(j.etat.ati("argent"), argent + 10000);
    assert_eq!(j.mensualites(), 467i64);
    ko(&j, "emprunter", dict! {"montant" => 25000}); // plafond 20 000 € à renommée 0
    ko(&j, "lever", dict! {});
    j.etat.set("renommee", 6);
    ok(&j, "lever", dict! {});
    assert_eq!(j.etat.at("parts"), 0.8);
    j.etat.at("prets").at(0).set("mois", 1);
    j.mois_extensions();
    assert_eq!(j.etat.at("prets").len(), 0);
}

#[test]
fn chef_seminaire_stage() {
    let j = Jeu::graine(8);
    j.etat.set("argent", 100000);
    let fondateur = j.etat.at("employes").at(0);
    ko(&j, "promouvoir", dict! {"id" => fondateur.at("id")}); // 11 points seulement
    fondateur.set("e", 8);
    ok(&j, "promouvoir", dict! {"id" => fondateur.at("id")});
    assert!(fondateur.atb("chef"));
    assert_eq!(j.mult_chef(&dict! {"chef" => fondateur.at("id"), "suivi" => 1}), 1.06);
    ok(&j, "seminaire", dict! {});
    assert_eq!(fondateur.at("absence"), "seminaire");
    ko(&j, "seminaire", dict! {});
    jour(&j, 2);
    assert!(fondateur.at("absence").is_none());
    j.etat.set("evenement", dict! {"type" => "stage", "titre" => "x", "texte" => "x", "options" => list!["a", "b"]});
    ok(&j, "evenement", dict! {"choix" => 0});
    let stagiaire = j.etat.at("employes").at(-1i64);
    assert_eq!((stagiaire.ati("salaire"), stagiaire.ati("stage")), (0, 90));
    stagiaire.set("stage", 1);
    j.etat.set("evenement", Val::None);
    j.fin_jour_extensions();
    assert_eq!(j.etat.at("evenement").at("type"), "fin_stage");
    ok(&j, "evenement", dict! {"choix" => 0});
    assert!(stagiaire.ati("salaire") > 0);
}

#[test]
fn anniversaire_et_meteo() {
    let j = Jeu::graine(9);
    let f = j.etat.at("employes").at(0);
    f.set("anniv", list![j.etat.at("mois"), j.etat.ati("jour") + 1]);
    jour(&j, 1);
    assert_eq!(j.etat.at("fete").at("type"), "anniv");
    assert_eq!(f.at("lieu"), "fete");
    let (mut meteos, mut changements, mut hier) = (Vec::<String>::new(), 0, j.etat.ats("meteo"));
    for _ in 0..400 {
        jour(&j, 1);
        let m = j.etat.ats("meteo");
        if !meteos.contains(&m) {
            meteos.push(m.clone());
        }
        changements += (m != hier) as i32;
        hier = m;
    }
    for t in ["soleil", "pluie", "neige"] {
        assert!(meteos.iter().any(|m| m == t), "{t}");
    }
    assert!(changements < 120); // le temps dure plusieurs jours, il ne clignote pas d'un jour à l'autre
}

#[test]
fn scenarios_et_difficulte() {
    for sc in d("SCENARIOS").keys() {
        for diff in ["facile", "normal", "difficile"] {
            let j = partie(10, sc.s(), diff);
            jour(&j, 5);
            py::json::dumps(&j.vue());
        }
    }
    let j = partie(11, "reprise", "normal");
    assert_eq!(j.etat.at("employes").len(), 4);
    assert_eq!(j.etat.at("prets").len(), 1);
    let j = partie(12, "iot", "normal");
    j.etat.at("stats").set("produits_lances", 4);
    j.verifier_objectif();
    assert!(j.etat.at("victoire").atb("ok"));
    assert!(j.en_pause());
    ok(&j, "fermer_victoire", dict! {});
    assert!(!j.en_pause());
    assert!(Jeu::nouveau(None, &"inconnu".into(), &"normal".into(), &Val::None, &Val::None).is_err());
    let j = partie(13, "garage", "difficile");
    j.etat.at("exercice").set("ca", 30000);
    j.etat.set("jours_total", 359);
    jour(&j, 1);
    let b = j.etat.at("bilans").at(-1i64);
    assert_eq!(b.ati("impot"), py::round_n((30000.0 - b.atf("charges")) * 0.33, -1) as i64);
}

#[test]
fn clients_fideles() {
    let j = Jeu::graine(40);
    let o = j.etat.at("offres").at(0);
    let p = j.creer_projet(&o, "contrat");
    p.update(&dict! {"client" => "DomoSud", "secteur" => "maison"});
    for _ in 0..3 {
        j.apres_livraison(&p, &Val::Int(10), &Val::Int(0)); // notes largement au-dessus de l'attente : +2 par livraison
    }
    let c = j.etat.at("clients").at("DomoSud");
    assert_eq!((c.ati("fid"), c.ati("livres")), (5, 3));
    assert_eq!(j.etat.at("stats").at("secteurs").at("maison"), 3i64);
    j.apres_livraison(&p, &Val::Int(1), &Val::Int(0));
    assert_eq!(c.ati("fid"), 3); // une très mauvaise note fait reculer
    let offres: Vec<Val> = (0..200).map(|_| j.offre(0, &Val::None)).collect();
    let fideles: Vec<&Val> = offres.iter().filter(|x| x.atb("fidele")).collect();
    assert!(!fideles.is_empty() && fideles.iter().all(|x| x.at("client") == "DomoSud" && x.at("secteur") == "maison"));
    assert!(j.chance_negociation(1.3, 1.0, 3.0) > j.chance_negociation(1.3, 1.0, 0.0));
}

#[test]
fn mega_projet() {
    let j = Jeu::graine(41);
    let e = &j.etat;
    e.set("renommee", 12);
    e.set("technos", list!["moteur", "rf"]);
    e.set("argent", 100000);
    let mega = j.offre_mega();
    assert_eq!((mega.ats("nom"), mega.ati("equipe_min")), ("Flotte de drones de livraison".to_string(), 6));
    e.at("offres").push(&mega);
    ko(&j, "signer", dict! {"id" => mega.at("id")}); // équipe trop petite
    for _ in 0..5 {
        j.nouvel_employe(&j.candidat(), &Val::None, &dict! {});
    }
    for x in e.at("employes").iter() {
        x.set("chef", false); // un chef de projet ajouterait une place
    }
    ko(&j, "signer", dict! {"id" => mega.at("id")}); // 2 places nécessaires, le garage n'en a qu'une
    e.at("locaux").push("bureau");
    ok(&j, "signer", dict! {"id" => mega.at("id")});
    assert_eq!((j.places_occupees(), e.at("projets").at(0).atb("mega")), (2, true));
    ko(&j, "signer", dict! {"id" => e.at("offres").at(0).at("id")}); // complet
    j.apres_livraison(&e.at("projets").at(0), &Val::Int(8), &Val::Int(0));
    assert_eq!(e.at("stats").at("megas"), 1i64);
}

#[test]
fn suites_de_produits() {
    let j = Jeu::graine(42);
    let e = &j.etat;
    e.set("renommee", 5);
    e.set("argent", 100000);
    ko(&j, "produit", dict! {"id" => "meteo2"}); // la v1 d'abord
    ko(&j, "produit", dict! {"id" => "chargeur"}); // USB-C requis
    e.at("gammes").set("meteo", 9);
    ok(&j, "produit", dict! {"id" => "meteo2"});
    assert_eq!(e.at("projets").at(0).ati("potentiel"), py::round(7500.0 * 1.24));
    j.apres_livraison(&e.at("projets").at(0), &Val::Int(8), &Val::Int(0));
    assert_eq!((e.at("stats").ati("suites"), e.at("gammes").ati("meteo2")), (1, 8));
}

#[test]
fn missions() {
    let j = Jeu::graine(43);
    let e = &j.etat;
    let ids: Vec<String> = j.vue().at("missions_actives").iter().map(|m| m.ats("id")).collect();
    assert_eq!(ids, ["m_premier", "m_equipe2", "m_bureau"]);
    let argent = e.ati("argent");
    e.at("stats").set("livres", 1);
    e.at("locaux").push("bureau");
    j.verifier_missions();
    assert_eq!(e.at("missions"), list!["m_premier", "m_bureau"]);
    assert_eq!(e.ati("argent"), argent + 2500);
    assert_eq!(j.vue().at("missions_actives").at(0).at("id"), "m_equipe2");
    let ancien = copie_json(e);
    for cle in ["clients", "gammes", "missions"] {
        ancien.pop(cle);
    }
    for cle in ["megas", "suites", "series", "secteurs", "meilleure_note"] {
        ancien.at("stats").pop(cle);
    }
    py::json::dumps(&Jeu::charger(ancien, None).unwrap().vue()); // ancienne sauvegarde : complétée sans erreur
}

#[test]
fn contrats_requis_existent() {
    let mut connus = d("TECHNOS").keys();
    connus.extend(d("CERTIFS").keys());
    for c in d("CONTRATS").iter().chain(d("MEGAS").iter()) {
        assert!(requis_liste(&c.at(4)).iter().all(|r| connus.contains(r)), "{}", c.at(0));
        assert!(d("SECTEURS").has(&c.at(5)), "{}", c.at(0));
    }
    let rmin: Vec<i64> = d("CONTRATS").iter().map(|c| c.ati(3)).collect();
    let mut tri = rmin.clone();
    tri.sort();
    assert_eq!(rmin, tri); // tirage pondéré par l'ordre
    let ids: Vec<Val> = d("PRODUITS").iter().map(|p| p.at("id")).collect();
    for p in d("PRODUITS").iter() {
        let suite = p.get("suite");
        let requis = p.get("requis");
        assert!((suite.is_none() || ids.contains(&suite)) && (requis.is_none() || d("TECHNOS").has(&requis)), "{}", p.at("id"));
    }
    let j = Jeu::graine(1);
    for m in d("MISSIONS").iter() {
        j.mesure(&m.ats(2)); // chaque mesure de mission existe
    }
}
