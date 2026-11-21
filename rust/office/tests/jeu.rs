//! tests/test_jeu.py, réécrit un pour un.

mod commun;

use commun::*;
use office::moteur::{d, Jeu};
use office::py::{Random, Val};
use office::{dict, list};

fn id0(liste: &Val) -> Val {
    liste.at(0).at("id")
}

#[test]
fn depart() {
    let j = Jeu::graine(1);
    assert_eq!(j.etat.at("argent"), 15000i64);
    assert_eq!(j.etat.at("employes").len(), 1);
    assert_eq!(j.etat.at("offres").len(), 3); // demandes spontanées ; le reste se prospecte
    assert_eq!(j.postes_ouverts().len(), 2);
    let mut m: Vec<String> = j.etat.at("materiel").iter().map(|x| x.string()).collect();
    m.sort();
    assert_eq!(m, ["multi", "station", "stlink"]);
}

#[test]
fn contrat_complet() {
    let j = Jeu::graine(2);
    let offre = office::py::min_by_key(j.etat.at("offres").iter(), |o| o.at("taille")).unwrap();
    ok(&j, "signer", dict! {"id" => offre.at("id")});
    let argent = j.etat.at("argent");
    for _ in 0..400 {
        if j.etat.atb("evenement") {
            ok(&j, "evenement", dict! {"choix" => 0});
        }
        if !j.etat.at("projets").truthy() {
            break;
        }
        let p = j.etat.at("projets").at(0);
        if p.at("etape") == "debug" && p.atf("defauts") < 1.0 {
            ok(&j, "tests_cem", dict! {"id" => p.at("id")});
        }
        ok(&j, "avancer", dict! {});
    }
    assert_eq!(j.etat.at("projets").len(), 0);
    assert_eq!(j.etat.at("stats").at("livres"), 1i64);
    let note = j.etat.at("historique").at(0).atf("note");
    assert!((1.0..=10.0).contains(&note));
    assert_ne!(j.etat.at("argent"), argent);
}

#[test]
fn fin_de_mois() {
    let j = Jeu::graine(3);
    j.etat.set("evenement", Val::None);
    let argent = j.etat.ati("argent");
    for _ in 0..30 {
        j.jour();
        j.etat.set("evenement", Val::None);
    }
    assert_eq!(j.etat.at("jour"), 1i64);
    assert_eq!(j.etat.ati("argent"), argent - j.loyer()); // seul le fondateur, sans salaire
    assert_eq!(j.etat.at("exercice").ati("charges"), j.loyer());
}

#[test]
fn postes_et_locaux() {
    let j = Jeu::graine(4);
    j.etat.set("argent", 100000);
    ok(&j, "embaucher", dict! {"id" => id0(&j.etat.at("candidats"))});
    ko(&j, "embaucher", dict! {"id" => id0(&j.etat.at("candidats"))});
    ok(&j, "poser", dict! {"id" => "poste"}); // placement automatique d'un bureau de plus
    ok(&j, "embaucher", dict! {"id" => id0(&j.etat.at("candidats"))});
    let mut bureaux: Vec<i64> = j.etat.at("employes").iter().map(|x| x.ati("bureau")).collect();
    bureaux.sort();
    bureaux.dedup();
    assert_eq!(bureaux.len(), 3);
    ko(&j, "acheter", dict! {"id" => "fdm"});
    ko(&j, "local", dict! {"id" => "atelier"}); // il faut d'abord emménager dans le bâtiment
    ok(&j, "local", dict! {"id" => "bureau"}); // tout le bâtiment s'ouvre, atelier compris
    ok(&j, "acheter", dict! {"id" => "fdm"});
    assert_eq!(j.bonus().at("m"), 2i64);
    ko(&j, "local", dict! {"id" => "fw2"}); // plus de pièces à louer une par une
}

#[test]
fn tresorerie_insuffisante() {
    let j = Jeu::graine(5);
    j.etat.set("argent", 100);
    ko(&j, "acheter", dict! {"id" => "spectre"});
    assert_eq!(j.etat.at("argent"), 100i64);
}

#[test]
fn formation() {
    let j = Jeu::graine(6);
    let fondateur = j.etat.at("employes").at(0);
    let m = fondateur.ati("m");
    ok(&j, "former", dict! {"id" => fondateur.at("id"), "dom" => "m"});
    for _ in 0..10 {
        j.jour();
        j.etat.set("evenement", Val::None);
    }
    assert_eq!(fondateur.ati("m"), m + 2);
}

#[test]
fn evenements() {
    let j = Jeu::graine(7);
    j.etat.set("renommee", 3);
    j.etat.at("stats").set("livres", 3);
    j.etat.at("materiel").push("oscillo");
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    let mut vus: Vec<String> = Vec::new();
    for _ in 0..200 {
        j.etat.set("derniers_ev", dict! {});
        j.etat.set("argent", 100000);
        j.evenement();
        let ev = j.etat.at("evenement");
        vus.push(ev.ats("type"));
        ok(&j, "evenement", dict! {"choix" => ev.at("options").len() - 1});
        assert!(j.etat.at("evenement").is_none());
    }
    for t in ["penurie", "salon", "panne", "subvention", "recommandation"] {
        assert!(vus.iter().any(|v| v == t), "{t}");
    }
}

#[test]
fn conditions_de_travail() {
    let j = Jeu::graine(11);
    j.etat.set("meteo", "canicule");
    assert!(proche(j.conditions().1, 0.85));
    j.etat.at("deco").push("clim");
    j.etat.at("deco").push("sieges");
    assert!(proche(j.conditions().1, 1.08));
}

#[test]
fn deplacements() {
    let j = Jeu::graine(12);
    j.etat.set("argent", 50000);
    ok(&j, "local", dict! {"id" => "bureau"});
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    let mut lieux: Vec<String> = Vec::new();
    for _ in 0..40 {
        j.etat.set("evenement", Val::None);
        j.etat.pop("dernier_livre");
        j.jour();
        let l = j.etat.at("employes").at(0).ats("lieu");
        if !lieux.contains(&l) {
            lieux.push(l);
        }
    }
    assert!(lieux.iter().any(|l| l == "reunion"));
    assert!(lieux.iter().all(|l| ["bureau", "labo", "atelier", "pause", "reunion", "visite"].contains(&l.as_str())), "{lieux:?}");
    assert!(lieux.len() > 2);
}

#[test]
fn abandon_rend_acompte() {
    let j = Jeu::graine(13);
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    ok(&j, "abandonner", dict! {});
    assert_eq!(j.etat.at("argent"), 15000i64);
}

#[test]
fn produit_unique_et_parametres() {
    let j = Jeu::graine(14);
    j.etat.set("renommee", 5);
    j.etat.at("produits").push(dict! {"nom" => "x", "id_produit" => "meteo", "note" => 7, "ventes" => 900, "mois" => 0, "total" => 0});
    ko(&j, "produit", dict! {"id" => "meteo"});
    ko(&j, "avancer", dict! {"jours" => f64::INFINITY});
    ko(&j, "avancer", dict! {"jours" => "3"});
    ko(&j, "signer", dict! {"id" => list![1]});
}

#[test]
fn evenements_espaces() {
    let j = Jeu::graine(15);
    j.etat.set("renommee", 3);
    j.etat.set("argent", 100000);
    j.evenement();
    let premier = j.etat.at("evenement").at("type");
    ok(&j, "evenement", dict! {"choix" => j.etat.at("evenement").at("options").len() - 1});
    for _ in 0..30 {
        j.evenement();
        if j.etat.atb("evenement") {
            assert_ne!(j.etat.at("evenement").at("type"), premier);
            ok(&j, "evenement", dict! {"choix" => j.etat.at("evenement").at("options").len() - 1});
        }
    }
}

#[test]
fn projets_en_parallele_et_affectation() {
    let j = Jeu::graine(16);
    j.etat.set("argent", 100000);
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    ko(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))}); // garage : un seul projet
    ok(&j, "local", dict! {"id" => "bureau"});
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    assert_eq!(j.etat.at("projets").len(), 2);
    ok(&j, "embaucher", dict! {"id" => id0(&j.etat.at("candidats"))});
    let cible = j.etat.at("projets").at(1).at("id");
    let emp = j.etat.at("employes").at(1).at("id");
    ok(&j, "affecter", dict! {"id" => &emp, "projet" => &cible});
    j.etat.set("evenement", Val::None);
    j.jour();
    assert!(j.etat.at("projets").at(1).at("equipe").has(&emp));
    ok(&j, "affecter", dict! {"id" => &emp, "projet" => Val::None});
    ko(&j, "affecter", dict! {"id" => &emp, "projet" => 99999});
}

#[test]
fn salle_de_pause_et_visites() {
    let j = Jeu::graine(21);
    j.etat.set("argent", 100000);
    j.etat.set("renommee", 2);
    let moral = j.moral_global();
    ok(&j, "local", dict! {"id" => "bureau"});
    assert_eq!(j.moral_global(), moral + 5.0); // salle de pause du bâtiment
    ok(&j, "deco", dict! {"id" => "babyfoot"});
    ok(&j, "embaucher", dict! {"id" => id0(&j.etat.at("candidats"))});
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    let mut visites = 0;
    for _ in 0..80 {
        j.etat.set("evenement", Val::None);
        j.etat.pop("dernier_livre");
        j.jour();
        for x in j.etat.at("employes").iter() {
            if x.at("lieu") == "visite" {
                visites += 1;
                assert_ne!(x.at("visite"), x.at("id"));
            }
        }
    }
    assert!(visites > 0);
}

#[test]
fn fabrication_prototype() {
    let j = Jeu::graine(22);
    let p = j.creer_projet(&dict! {"nom" => "x", "taille" => 100, "total" => dict! {"e" => 50, "m" => 20, "f" => 30}}, "contrat");
    let noms: Vec<String> = p.at("phases").iter().map(|ph| ph.ats("nom")).collect();
    assert_eq!(noms.iter().position(|n| n == "Fabrication du prototype"), Some(2));
    j.etat.at("projets").push(&p);
    p.set("phase", 2);
    let argent = j.etat.ati("argent");
    j.entrer_phase(&p);
    assert_eq!(p.at("phases").at(2).at("attente"), 4i64);
    assert_eq!(j.etat.ati("argent"), argent - 400);
    for _ in 0..4 {
        assert_eq!(p.at("phase"), 2i64);
        j.travailler(&p, &j.etat.at("employes").vec(), &j.bonus());
    }
    assert_eq!(p.at("phase"), 3i64);
}

#[test]
fn horaires() {
    let j = Jeu::graine(17);
    let base = j.efficacite(&j.etat.at("employes").at(0));
    ok(&j, "horaires", dict! {"heures" => 10});
    assert!(j.efficacite(&j.etat.at("employes").at(0)) > base * 0.95);
    assert!(j.moral_global() < 60.0);
    ko(&j, "horaires", dict! {"heures" => 11});
}

#[test]
fn combos() {
    let j = Jeu::graine(18);
    let p = j.creer_projet(&dict! {"nom" => "x", "taille" => 100, "total" => dict! {"e" => 40, "m" => 30, "f" => 30}}, "contrat");
    let modele = j.etat.at("employes").at(0);
    let equipe: Vec<Val> = [(9, 0, 0, "perfectionniste"), (0, 6, 0, "debug"), (0, 0, 6, "rapide"), (1, 1, 1, "rapide")]
        .iter()
        .enumerate()
        .map(|(i, &(a, b, c, t))| {
            let x = modele.copy();
            x.update(&dict! {"id" => i, "e" => a, "m" => b, "f" => c, "traits" => list![t]});
            x
        })
        .collect();
    let c = j.combos(&p, &equipe);
    for k in ["trio", "qualite", "mentor"] {
        assert!(c.iter().any(|x| x == k), "{k}");
    }
}

#[test]
fn bilan_annuel_et_fin() {
    let j = Jeu::graine(19);
    j.etat.at("exercice").set("ca", 50000);
    j.etat.set("jours_total", 359);
    j.etat.set("evenement", Val::None);
    let argent = j.etat.ati("argent");
    j.jour();
    assert_eq!(j.etat.at("bilan").at("impot"), 12500i64);
    assert!(j.etat.ati("argent") < argent);
    ok(&j, "avancer", dict! {});
    assert_eq!(j.etat.at("jours_total"), 360i64); // en pause tant que le bilan n'est pas fermé
    ok(&j, "fermer_bilan", dict! {});
    j.etat.set("jours_total", 20 * 360 - 1);
    j.etat.set("evenement", Val::None);
    j.jour();
    assert!(j.etat.at("fin").has("titre"));
}

#[test]
fn noms_entreprise_et_directeur() {
    let j = Jeu::nouveau(Some(30), &"garage".into(), &"normal".into(), &"  Ohm   Sweet Ohm ".into(), &"Ada".into()).unwrap();
    assert_eq!(j.etat.at("entreprise"), "Ohm Sweet Ohm");
    assert_eq!(j.etat.at("employes").at(0).at("nom"), "Ada");
    assert!(j.vue().at("classement").iter().any(|c| c.at("nom") == "Ohm Sweet Ohm"));
    let fin = j.score_final();
    assert_eq!((fin.ats("entreprise"), fin.ats("directeur")), ("Ohm Sweet Ohm".to_string(), "Ada".to_string()));
    let d2 = Jeu::nouveau(Some(30), &"garage".into(), &"normal".into(), &"   ".into(), &Val::None).unwrap();
    assert_eq!(d2.etat.at("entreprise"), "Mon bureau d'études");
    assert_eq!(d2.etat.at("employes").at(0).at("nom"), "Vous");
    for mauvais in [Val::from("x".repeat(31)), Val::from("a\nb"), Val::Int(42), list!["liste"]] {
        assert!(Jeu::nouveau(None, &"garage".into(), &"normal".into(), &mauvais, &Val::None).is_err());
    }
    let ancien = copie_json(&j.etat);
    ancien.pop("entreprise");
    assert_eq!(Jeu::charger(ancien, None).unwrap().vue().at("entreprise"), "Votre bureau");
}

#[test]
fn migration_v1() {
    let j = Jeu::graine(20);
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    let ancien = copie_json(&j.etat);
    let projets = ancien.pop("projets");
    ancien.set("projet", projets.at(0));
    for cle in ["heures", "trophees", "bilans", "exercice", "combos_vus"] {
        ancien.pop(cle);
    }
    let nouveau = Jeu::charger(ancien, None).unwrap();
    assert_eq!(nouveau.etat.at("projets").len(), 1);
    ok(&nouveau, "avancer", dict! {"jours" => 3});
    office::py::json::dumps(&nouveau.vue());
}

/// Chaque objet tient entièrement dans une pièce disponible ; chaque employé a un bureau.
fn bien_places(j: &Jeu) {
    let pieces = d("PIECES");
    let dispo = j.pieces_dispo();
    for o in j.etat.at("objets").iter() {
        let (w, h) = Jeu::emprise(&o.at("type"), o.get_or("cote", "n").s()).unwrap();
        let (x, y) = (o.ati("x"), o.ati("y"));
        assert!(
            dispo.iter().any(|k| {
                let (rx, ry, rw, rh) = office::moteur::r4(&pieces.at(k.as_str()).at("rect"));
                rx <= x && ry <= y && x + w <= rx + rw && y + h <= ry + rh
            }),
            "{o:?}"
        );
    }
    let postes = j.postes_ouverts();
    assert!(j.etat.at("employes").iter().all(|x| postes.contains(&x.at("bureau"))));
}

#[test]
fn amenagement_libre() {
    let pieces = d("PIECES");
    let j = Jeu::graine(23);
    j.etat.set("argent", 100000);
    j.etat.set("renommee", 2);
    let (hx, hy, _, hh) = office::moteur::r4(&pieces.at("hw").at("rect"));
    let (hx, hy) = (hx + 24 - hx % 4, hy + 116 - hy % 4); // une place libre du bureau HW, sur la grille
    assert_eq!(j.carte(), "garage");
    bien_places(&j);
    ko(&j, "poser", dict! {"id" => "poste", "x" => hx, "y" => hy}); // bureau HW (R1) : il faut d'abord emménager
    ko(&j, "poser", dict! {"id" => "poste", "x" => 452, "y" => 468}); // déjà occupé par le bureau de départ
    ko(&j, "poser", dict! {"id" => "poste", "x" => 592, "y" => 480}); // sur l'étagère du garage (mobilier fixe)
    ko(&j, "poser", dict! {"id" => "canape", "x" => 440, "y" => 580}); // canapé : cantine uniquement
    ko(&j, "local", dict! {"id" => "cantine"}); // il faut d'abord emménager
    ok(&j, "local", dict! {"id" => "bureau"}); // déménagement : tout le garage est replacé dans le bâtiment
    assert_eq!(j.carte(), "batiment");
    bien_places(&j);
    ok(&j, "poser", dict! {"id" => "poste", "x" => hx - 1, "y" => hy - 1});
    let poste = j.etat.at("objets").at(-1i64);
    let ry = office::moteur::r4(&pieces.at("hw").at("rect")).1;
    let bas = ry + hh - d("POSTE").ati("h") - 1;
    assert_eq!((poste.ati("x"), poste.ati("y"), poste.ats("cote")), (hx, bas, "s".to_string())); // calé sur la grille, puis collé au mur tout proche
    assert_eq!(j.piece_de(&poste).as_deref(), Some("hw"));
    ok(&j, "deplacer", dict! {"id" => poste.at("id"), "x" => hx + 80, "y" => hy});
    assert_eq!(poste.ati("x"), hx + 80);
    ok(&j, "poser", dict! {"id" => "plantes"});
    ok(&j, "poser", dict! {"id" => "plantes"});
    assert_eq!(j.etat.at("deco").iter().filter(|x| *x == "plantes").count(), 1);
    ok(&j, "poser", dict! {"id" => "tapis", "x" => hx + 30, "y" => hy - 50}); // au sol : ne gêne rien
    let (cx, cy, _, _) = office::moteur::r4(&pieces.at("cantine").at("rect"));
    ko(&j, "poser", dict! {"id" => "plantes", "x" => cx + 10, "y" => cy + 8}); // sur la cuisine de la cantine (mobilier fixe)
    ok(&j, "acheter", dict! {"id" => "oscillo"});
    let oscillo = j.etat.at("objets").iter().find(|o| o.at("type") == "oscillo").unwrap();
    ko(&j, "acheter", dict! {"id" => "oscillo"});
    let argent = j.etat.ati("argent");
    ok(&j, "vendre", dict! {"id" => oscillo.at("id")});
    assert!(!j.etat.at("materiel").has("oscillo"));
    assert_eq!(j.etat.ati("argent"), argent + 1400);
    let occupe = j.etat.at("employes").at(0).at("bureau");
    ko(&j, "vendre", dict! {"id" => occupe});
    bien_places(&j);
}

#[test]
fn rangement_postes_et_salle_de_pause() {
    let j = Jeu::graine(31);
    let e = &j.etat;
    e.set("argent", 1_000_000);
    e.set("renommee", 30);
    ok(&j, "local", dict! {"id" => "bureau"});
    for x in ["table", "biblio", "armoire", "imprimante", "plantes", "ficus"] {
        ok(&j, "poser", dict! {"id" => x});
    }
    for x in ["canape", "babyfoot", "arcade", "distrib", "fontaine", "aquarium", "cafe"] {
        ok(&j, "poser", dict! {"id" => x});
        let o = e.at("objets").at(-1i64);
        let p = d("EMPLACEMENTS").at(x).at(0);
        assert_eq!((o.ati("x"), o.ati("y")), (p.ati(0), p.ati(1)), "{x}");
    }
    while act(&j, "poser", dict! {"id" => "poste"}).is_ok() {}
    let grille: Vec<(i64, i64)> = d("EMPLACEMENTS").at("poste").iter().map(|p| (p.ati(0), p.ati(1))).collect();
    assert!(e.at("objets").iter().filter(|o| o.at("type") == "poste").all(|o| grille.contains(&(o.ati("x"), o.ati("y")))));
    let attendu = grille.iter().filter(|&&(x, y)| !((440..672).contains(&x) && (408..640).contains(&y))).count();
    assert_eq!(e.at("objets").iter().filter(|o| o.at("type") == "poste").count(), attendu);
}

#[test]
fn tout_tient_dans_le_batiment() {
    for g in 0..8 {
        let j = Jeu::graine(g);
        let e = &j.etat;
        e.set("argent", 10_000_000);
        e.set("renommee", 30);
        ok(&j, "local", dict! {"id" => "bureau"});
        let mut mats: Vec<Val> = d("MATERIEL").keys().into_iter().filter(|m| !e.at("materiel").has(m)).collect();
        Random::new(g).shuffle(&mut mats);
        for m in mats {
            ok(&j, "acheter", dict! {"id" => m});
        }
        while act(&j, "poser", dict! {"id" => "poste"}).is_ok() {}
        let grille = d("EMPLACEMENTS").at("poste").iter().filter(|p| !((440..672).contains(&p.ati(0)) && (408..640).contains(&p.ati(1)))).count();
        assert_eq!(e.at("objets").iter().filter(|o| o.at("type") == "poste").count(), grille, "graine {g}");
    }
}

#[test]
fn sauvegarde_json() {
    let j = Jeu::graine(8);
    ok(&j, "signer", dict! {"id" => id0(&j.etat.at("offres"))});
    ok(&j, "avancer", dict! {"jours" => 5});
    let copie = Jeu::charger(copie_json(&j.etat), None).unwrap();
    ok(&copie, "avancer", dict! {"jours" => 5});
    assert!(copie.etat.ati("jours_total") >= 5);
}

#[test]
fn faillite() {
    let j = Jeu::graine(9);
    j.etat.set("argent", -4900);
    j.etat.set("jour", 30);
    ok(&j, "avancer", dict! {});
    assert!(j.etat.atb("faillite"));
    ko(&j, "acheter", dict! {"id" => "alim"});
}

/// Joue 3 ans avec une stratégie simple : le moteur ne doit jamais planter.
#[test]
fn partie_longue_automatique() {
    for graine in 0..5 {
        let j = Jeu::graine(graine);
        let mut r = Random::new(graine);
        for _ in 0..3 * 360 {
            let e = &j.etat;
            if e.atb("faillite") {
                break;
            }
            if e.atb("evenement") {
                let n = e.at("evenement").at("options").len();
                let premier = r.choice_i(n);
                for choix in std::iter::once(premier).chain(0..n) {
                    // au hasard, sinon la première option abordable
                    if act(&j, "evenement", dict! {"choix" => choix}).is_ok() {
                        break;
                    }
                }
            }
            for cle in ["bilan", "dernier_livre"] {
                e.pop(cle);
            }
            if !e.at("prospections").truthy() && !j.prospecteurs().is_empty() {
                let canal = ["plateformes", "reseaux"][r.choice_i(2)];
                ok(&j, "prospecter", dict! {"canal" => canal, "qui" => j.prospecteurs()[0].at("id")});
            }
            for piste in e.at("pistes").iter() {
                let prix = ["0.95", "1.0"][r.choice_i(2)];
                ok(&j, "devis", dict! {"id" => piste.at("id"), "prix" => prix, "delai" => "1.0"});
            }
            if (e.at("projets").len() as i64) < j.capacite_projets() && e.at("offres").truthy() {
                ok(&j, "signer", dict! {"id" => id0(&e.at("offres"))});
            }
            for p in e.at("projets").iter() {
                if p.at("etape") == "debug" && p.atf("defauts") < 2.0 {
                    ok(&j, "tests_cem", dict! {"id" => p.at("id")});
                }
            }
            if r.random() < 0.01 {
                let h = [6, 7, 8, 9, 10, 12][r.choice_i(6)];
                ok(&j, "horaires", dict! {"heures" => h});
            }
            for (genre, ident) in [("local", "bureau"), ("embaucher", ""), ("acheter", "oscillo"), ("deco", "cafe")] {
                if e.ati("argent") > 25000 {
                    let id = if ident.is_empty() { if e.at("candidats").truthy() { id0(&e.at("candidats")) } else { Val::Int(0) } } else { Val::str(ident) };
                    let _ = act(&j, genre, dict! {"id" => id});
                }
            }
            ok(&j, "avancer", dict! {});
            office::py::json::dumps(&j.vue());
        }
        assert!(j.etat.at("stats").ati("livres") > 0, "graine {graine}");
    }
}
