//! tests/test_batiment.py, réécrit un pour un.

mod commun;

use commun::*;
use office::moteur::{d, Jeu};
use office::py::{self, Val};
use office::{dict, list};

#[test]
fn tout_ouvert() {
    assert_eq!(d("LOCAUX").keys(), vec![Val::str("bureau")]);
    assert!(d("PIECES").items().iter().all(|(k, p)| k == "garage" || p.at("local") == "bureau"));
    let j = riche(1, 10, false);
    assert_eq!((j.capacite_projets(), j.nb_offres()), (1, 3));
    let moral = j.moral_global();
    ok(&j, "local", dict! {"id" => "bureau"});
    let mut dispo = j.pieces_dispo();
    dispo.sort();
    let mut toutes: Vec<String> = d("PIECES").keys().iter().map(|k| k.string()).filter(|k| k != "garage").collect();
    toutes.sort();
    assert_eq!(dispo, toutes);
    assert_eq!((j.capacite_projets(), j.nb_offres(), j.moral_global()), (2, 4, moral + 5.0));
    assert_eq!(j.etat.at("stock_max"), 1000i64);
    employe(&j, dict! {"e" => 6, "chef" => true});
    assert_eq!(j.capacite_projets(), 3);
    employe(&j, dict! {"e" => 2, "commercial" => true});
    assert_eq!(j.nb_offres(), 4); // les commerciaux prospectent au lieu d'attirer des offres
}

#[test]
fn investissements() {
    let j = riche(20, 7, false);
    ko(&j, "investir", dict! {"id" => "formation"}); // depuis le bâtiment seulement
    ok(&j, "local", dict! {"id" => "bureau"});
    ko(&j, "investir", dict! {"id" => "formation"}); // renommée 8 requise
    j.etat.set("renommee", 12);
    j.etat.set("argent", 10_000_000);
    let x = employe(&j, dict! {"e" => 4});
    let cout = j.cout_formation(&x);
    ok(&j, "investir", dict! {"id" => "formation"});
    assert_eq!(j.cout_formation(&x), py::int(cout as f64 * 0.5));
    ko(&j, "investir", dict! {"id" => "formation"}); // une seule fois
    let (capacite, offres, loyer) = (j.capacite_projets(), j.nb_offres(), j.loyer());
    ok(&j, "investir", dict! {"id" => "filiale"});
    assert_eq!((j.capacite_projets(), j.nb_offres(), j.loyer()), (capacite + 1, offres + 2, loyer + 5000));
    let argent = j.etat.ati("argent");
    ok(&j, "investir", dict! {"id" => "campagne"});
    assert_eq!((argent - j.etat.ati("argent"), j.etat.ati("renommee")), (100000, 14));
    ko(&j, "investir", dict! {"id" => "campagne"}); // une par an
    j.etat.set("derniere_campagne", j.etat.ati("derniere_campagne") - 360);
    assert_eq!(j.prix_investissement("campagne"), 150000);
    let fort = py::max_by_key(j.etat.at("concurrents").iter(), |c| c.at("renommee")).unwrap();
    assert_eq!(j.prix_investissement("rachat"), 200000 + 40000 * fort.ati("renommee"));
    ok(&j, "investir", dict! {"id" => "rachat"});
    ok(&j, "investir", dict! {"id" => "rachat"});
    assert!(!j.etat.at("concurrents").has(&fort));
    assert_eq!((j.etat.at("concurrents").len(), j.etat.ati("renommee")), (2, 20));
    ko(&j, "investir", dict! {"id" => "rachat"}); // il reste toujours un concurrent
    for _ in 0..40 {
        j.jour(); // la concurrence restante fonctionne toujours (vol d'offres, débauchage)
    }
}

#[test]
fn reprise_stock_du_batiment() {
    assert_eq!(partie(19, "reprise", "normal").etat.at("stock_max"), 1000i64);
}

#[test]
fn anciennes_parties_pas_reprises() {
    let etat = copie_json(&Jeu::graine(2).etat);
    etat.set("version_plan", 5);
    assert!(Jeu::charger(etat, None).is_err());
}

#[test]
fn responsable_de_service() {
    let j = riche(3, 10, true);
    let elec: Vec<Val> = (0..5).map(|i| employe(&j, dict! {"e" => 6 + i, "f" => 1})).collect(); // avec le fondateur, 6 en élec
    assert!(proche(j.facteur_service(&elec[0]), 0.92 * 1.05)); // bureau HW, sans responsable
    ko(&j, "nommer", dict! {"id" => elec[0].at("id"), "role" => "resp_e"}); // 6 en élec : il faut 8
    let chef = elec[4].clone();
    let salaire = chef.ati("salaire");
    ok(&j, "nommer", dict! {"id" => chef.at("id"), "role" => "resp_e"});
    let piece = j.piece_de(&j.objet(&chef.at("bureau")).unwrap()).unwrap();
    assert_eq!(d("PIECES").at(piece.as_str()).at("genre"), "res");
    assert_eq!(chef.ati("salaire"), salaire + 800);
    let membre = elec[0].clone();
    assert!(j.encadre(&membre));
    assert!(proche(j.facteur_service(&membre), 1.08 * 1.05));
    assert_eq!(j.coordination(&membre, &dict! {"suivi" => 0}, 8), 1.0); // le responsable coordonne son service
    membre.at("xp").set("e", 0);
    j.experience(&membre, "e", 10.0);
    let amb = if membre.at("traits").has("ambitieux") { 1.3 } else { 1.0 };
    let attendu = 10.0 * d("SENIORITES").at(membre.at("seniorite")).atf("xp") * amb * 1.25; // formation plus rapide
    assert!(proche(membre.at("xp").atf("e"), attendu));
    let b = j.objet(&chef.at("bureau")).unwrap();
    ok(&j, "poser", dict! {"id" => "poste", "x" => b.ati("x"), "y" => b.ati("y") + 66}); // un 2e bureau dans la pièce : plus individuel
    assert!(!j.roles().at("actifs").has("resp_e"));
    ok(&j, "nommer", dict! {"id" => chef.at("id"), "role" => Val::None});
    assert_eq!(chef.ati("salaire"), salaire);
}

#[test]
fn chef_d_equipe_embauche() {
    let j = riche(4, 10, true);
    let c = j.candidat();
    c.update(&dict! {"e" => 9, "role_propose" => "resp_e", "poste" => "Chef d'équipe Élec"});
    let (x, y, cote) = j.place_auto(&Val::str("poste"), None, &Val::None).unwrap();
    let bureau = j.ajouter_objet(&Val::str("poste"), x, y, &cote).at("id");
    let x = j.nouvel_employe(&c, &bureau, &dict! {});
    assert_eq!(x.at("role"), "resp_e");
    j.oublier_roles();
    assert!(j.roles().at("actifs").has("resp_e"));
}

#[test]
fn chefs_de_projet() {
    let j = riche(5, 10, true);
    let a = employe(&j, dict! {"e" => 6, "chef" => true});
    employe(&j, dict! {"e" => 6, "chef" => true});
    let piece = j.piece_de(&j.objet(&a.at("bureau")).unwrap()).unwrap();
    assert_eq!(d("PIECES").at(piece.as_str()).get("fonction"), "cdp");
    for t in [300, 200, 100] {
        let p = j.creer_projet(&dict! {"nom" => "x", "client" => "c", "taille" => t, "total" => dict! {"e" => t, "m" => 0, "f" => 0}, "paie" => t * 70}, "contrat");
        j.etat.at("projets").push(p);
    }
    j.suivi_chefs();
    let mut suivis: Vec<f64> = j.etat.at("projets").iter().map(|p| p.atf("suivi")).collect();
    suivis.sort_by(|a, b| a.partial_cmp(b).unwrap());
    assert_eq!(suivis, [0.707, 0.707, 1.0]); // un chef suit 2 projets, l'autre 1 : l'effet baisse avec la charge
    let p = j.etat.at("projets").at(0);
    assert!(j.mult_chef(&p) > 1.0);
    let seul = p.copy();
    seul.set("suivi", 0);
    assert!(j.note(&p) > j.note(&seul));
    let fw = employe(&j, dict! {"f" => 4});
    assert!(proche(j.coordination(&fw, &seul, 6), 0.91));
}

#[test]
fn delais_selon_renommee() {
    for rep in [0i64, 3, 7, 20] {
        let diviseur = 1.0 + 0.3 * (0i64.max(rep - 3)).min(8) as f64; // 1 ; 1 ; 2,2 ; 3,4
        let j = Jeu::graine(18);
        j.etat.set("renommee", rep);
        for _ in 0..10 {
            let o = j.offre(0, &Val::None);
            let t = o.atf("taille");
            assert_eq!(o.ati("delai"), 12i64.max(py::round((14.0 + t * (0.5 - 0.3f64.min(t / 1500.0))) / diviseur)));
        }
    }
}

#[test]
fn progression_salaire() {
    let j = riche(17, 10, true);
    let x = employe(&j, dict! {"e" => 3});
    let salaire = x.ati("salaire");
    x.at("xp").set("e", 60 + 6 * 9); // juste au seuil du point suivant
    j.experience(&x, "e", 0.0);
    assert_eq!((x.ati("e"), x.ati("salaire")), (4, salaire + 115)); // un point gagné en travaillant : la moitié du prix du marché
}

#[test]
fn chef_compose_l_equipe() {
    let j = riche(14, 10, true);
    employe(&j, dict! {"e" => 6, "chef" => true});
    let fw = employe(&j, dict! {"f" => 9});
    let meca = employe(&j, dict! {"m" => 9});
    let suivi = j.creer_projet(&dict! {"nom" => "suivi", "client" => "c", "taille" => 100, "total" => dict! {"e" => 0, "m" => 50, "f" => 50}, "paie" => 7000}, "contrat");
    let gros = j.creer_projet(&dict! {"nom" => "gros", "client" => "c", "taille" => 900, "total" => dict! {"e" => 300, "m" => 300, "f" => 300}, "paie" => 60000}, "contrat");
    for p in [&suivi, &gros] {
        let fait = Val::dict();
        for k in p.at("total").keys() {
            fait.set(&k, 0.0);
        }
        p.set("phases", list![dict! {"nom" => "x", "besoin" => p.at("total").copy(), "fait" => fait}]);
        j.etat.at("projets").push(p);
    }
    for _ in 0..3 {
        employe(&j, dict! {"m" => 1, "f" => 1}).set("projet", suivi.at("id")); // trois débutants affectés d'office au petit projet
    }
    j.suivi_chefs();
    gros.set("chef", Val::None); // le chef ne suit que le petit projet
    let equipes = j.repartir();
    let ids: Vec<Val> = equipes.at(suivi.at("id")).iter().map(|x| x.at("id")).collect();
    assert!(ids.contains(&fw.at("id")) && ids.contains(&meca.at("id"))); // il a pris le meilleur firmware et le meilleur méca libres
    suivi.set("chef", Val::None);
    let equipes = j.repartir();
    let ids: Vec<Val> = equipes.at(suivi.at("id")).iter().map(|x| x.at("id")).collect();
    assert!(!(ids.contains(&fw.at("id")) && ids.contains(&meca.at("id")))); // sans chef, le petit projet est jugé plein : ils partent sur le gros
}

#[test]
fn prime_du_client() {
    let j = riche(15, 10, true);
    let mut payes = Vec::new();
    for chef in [Val::None, Val::Int(1)] {
        let p = j.creer_projet(&dict! {"nom" => "x", "client" => "c", "taille" => 100, "total" => dict! {"e" => 100, "m" => 0, "f" => 0}, "paie" => 10000}, "contrat");
        let suivi = if chef.is_some() { Val::Float(1.0) } else { Val::Int(0) };
        p.update(&dict! {"chef" => chef, "suivi" => suivi, "defauts" => 0, "jours" => 10, "delai" => 40});
        j.etat.at("projets").push(&p);
        let argent = j.etat.ati("argent");
        j.terminer(&p);
        payes.push(j.etat.ati("argent") - argent);
    }
    assert!(payes[1] > payes[0]); // note un peu meilleure et prime de 8 % du contrat
}

#[test]
fn commerciaux_offres_mieux_payees() {
    let (sans, avec) = (riche(16, 10, true), riche(16, 10, true));
    for _ in 0..3 {
        employe(&avec, dict! {"e" => 1, "commercial" => true}).at("metier").set("commercial", 2); // +2 % chacun, +1,5 % par point du meilleur
    }
    let mut ratios = Vec::new();
    for j in [&sans, &avec] {
        *j.rng.borrow_mut() = py::Random::new(3);
        let offres: Vec<Val> = (0..40).map(|_| j.offre(0, &Val::None)).collect();
        ratios.push(py::sum(offres.iter().map(|o| o.atf("paie") / o.atf("taille"))));
    }
    assert!(ratios[1] / ratios[0] > 1.08);
}

#[test]
fn indus_et_qualif() {
    let j = riche(6, 10, true);
    let o = j.etat.at("offres").at(0).copy();
    o.update(&dict! {"secteur" => "industrie", "taille" => 100, "total" => dict! {"e" => 60, "m" => 20, "f" => 20}, "paie" => 8000});
    j.etat.at("offres").set(0, &o);
    let argent = j.etat.ati("argent");
    ok(&j, "signer", dict! {"id" => o.at("id"), "tech" => dict! {"indus" => "produit", "qualif" => "produit"}});
    let p = j.etat.at("projets").at(0);
    assert!(p.at("phases").iter().any(|ph| ph.at("nom") == "Industrialisation du produit"));
    assert_eq!(p.at("phases").at(-1i64).at("essais"), 10i64); // en interne : essais 50 % plus longs
    assert_eq!(argent - j.etat.ati("argent"), py::round_n((6.0 + 5.0) * 100.0 / 3.0, -1) as i64 - p.ati("acompte")); // en interne : prix ÷3
    let exigeant = j.etat.at("offres").at(0).copy();
    exigeant.set("secteur", "aero");
    j.etat.at("offres").set(0, &exigeant);
    ko(&j, "signer", dict! {"id" => exigeant.at("id"), "tech" => dict! {"qualif" => "aucune"}}); // l'aéro exige une qualification
    // garanties : l'indus et la qualif évitent les défauts chez le client
    let q = p.copy();
    q.update(&dict! {"defauts" => 10.0, "taille" => 300});
    j.apres_livraison(&q, &Val::Float(7.0), &Val::Int(0));
    let avec = j.etat.at("garanties").at(-1i64).atf("defauts");
    let sans_choix = q.copy();
    sans_choix.set("choix", dict! {});
    j.apres_livraison(&sans_choix, &Val::Float(7.0), &Val::Int(0));
    assert!(avec < j.etat.at("garanties").at(-1i64).atf("defauts"));
    // séries : plus fréquentes (35 % + 10 % par niveau d'indus) et mieux margées avec l'indus
    toujours(&j, Some(0.5));
    j.etat.set("offre_serie", Val::None);
    j.apres_livraison(&sans_choix, &Val::Float(8.0), &Val::Int(0));
    assert!(j.etat.at("offre_serie").is_none());
    j.apres_livraison(&q, &Val::Float(8.0), &Val::Int(0));
    toujours(&j, None);
    assert_eq!(j.etat.at("offre_serie").atf("indus"), py::round_n(1.0 + 0.3 * 2.0 * j.qualite_etape("indus", "indus"), 2));
}

#[test]
fn lots_stock_et_ventes() {
    let j = riche(7, 10, false);
    let p = j.creer_projet(&dict! {"nom" => "Station", "taille" => 110, "total" => dict! {"e" => 50, "m" => 30, "f" => 30}, "potentiel" => 4500, "id_produit" => "meteo"}, "produit");
    p.set("choix", dict! {});
    j.etat.at("projets").push(&p);
    j.terminer(&p);
    let prod = j.etat.at("produits").at(0);
    assert_eq!((prod.ati("stock"), prod.ati("prix")), (0, 75));
    ko(&j, "commander", dict! {"id" => "meteo", "qte" => 500}); // garage : 200 unités de stock
    let argent = j.etat.ati("argent");
    ok(&j, "commander", dict! {"id" => "meteo", "qte" => 50});
    assert_eq!(argent - j.etat.ati("argent"), py::round_n(50.0 * prod.atf("cout_unite"), -1) as i64);
    toujours(&j, Some(0.99)); // pas de retard, pas de défaut
    for _ in 0..20 {
        j.lots_du_jour();
    }
    toujours(&j, None);
    assert_eq!(prod.ati("stock"), 50);
    let demande = prod.ati("demande");
    let (ventes, frais) = j.ventes_du_mois();
    assert_eq!(frais, 15); // 50 unités × 0,30 €
    assert_eq!(prod.ati("stock"), 50 - 50i64.min(demande));
    assert_eq!(ventes, py::round(50i64.min(demande) as f64 * 75.0 * (1.0 - prod.atf("pannes"))));
}

#[test]
fn controle_reception() {
    let j = riche(8, 10, true);
    j.etat.at("produits").push(dict! {
        "nom" => "X", "id_produit" => "x", "note" => 7, "prix" => 50, "stock" => 0, "mois" => 0, "total" => 0,
        "demande" => 40, "cout_unite" => 25, "defaut_lot" => 1.0, "pannes" => 0.04, "ventes" => 2000,
    });
    j.etat.at("commandes").push(dict! {"produit" => "x", "nom" => "X", "qte" => 100, "jours" => 1, "retard" => true});
    toujours(&j, Some(0.0)); // lot défectueux et repéré
    j.lots_du_jour();
    toujours(&j, None);
    assert_eq!((j.etat.at("commandes").at(0).ati("jours"), j.etat.at("produits").at(0).ati("stock")), (15, 0)); // renvoyé au sous-traitant
}

#[test]
fn commerciaux() {
    let j = riche(9, 10, true);
    let o = j.etat.at("offres").at(0);
    ko(&j, "negocier", dict! {"id" => o.at("id"), "cible" => "prix"}); // pas de commercial
    employe(&j, dict! {"e" => 2, "commercial" => true});
    let paie = o.atf("paie");
    toujours(&j, Some(0.0));
    ok(&j, "negocier", dict! {"id" => o.at("id"), "cible" => "prix"});
    assert_eq!(o.ati("paie"), py::round_n(paie * 1.15, -2) as i64);
    ko(&j, "negocier", dict! {"id" => o.at("id"), "cible" => "delai"}); // une seule fois par offre
    let offres: Vec<Val> = (0..20).map(|_| j.offre(0, &Val::str("maison"))).collect();
    toujours(&j, None);
    assert!(offres.iter().all(|x| x.at("secteur") == "maison"));
    let autre = j.etat.at("offres").at(1);
    toujours(&j, Some(0.999));
    ok(&j, "negocier", dict! {"id" => autre.at("id"), "cible" => "delai"}); // ratée : le client part
    toujours(&j, None);
    assert!(!j.etat.at("offres").has(&autre));
    employe(&j, dict! {"e" => 2, "commercial" => true});
    let argent = j.etat.ati("argent");
    let exigeant = ["mobilite", "aero", "medical", "spatial"].iter().any(|s| o.at("secteur") == *s);
    ok(&j, "signer", dict! {"id" => o.at("id"), "tech" => if exigeant { dict! {"qualif" => "carte"} } else { dict! {} }});
    let pr = j.etat.at("projets").at(0);
    assert_eq!(argent - j.etat.ati("argent"), py::round_n(pr.atf("paie") * 0.06 * 2.0, -1) as i64 - pr.ati("acompte")); // 6 % par commercial
}

#[test]
fn direction_rd_innovation_brevets() {
    let j = riche(10, 10, true);
    let directeur = employe(&j, dict! {"e" => 8, "m" => 6, "f" => 7});
    let inventeur = employe(&j, dict! {"e" => 5, "m" => 4, "f" => 4});
    ko(&j, "produit", dict! {"id" => "eolienne"}); // idée réservée au chargé d'innovation
    ok(&j, "nommer", dict! {"id" => directeur.at("id"), "role" => "dir_rd"});
    ok(&j, "nommer", dict! {"id" => inventeur.at("id"), "role" => "innov"});
    for x in [&directeur, &inventeur] {
        assert_eq!(j.piece_de(&j.objet(&x.at("bureau")).unwrap()).as_deref(), Some("rd"));
    }
    let argent = j.etat.ati("argent");
    ok(&j, "recherche", dict! {"id" => "ble"});
    assert_eq!(argent - j.etat.ati("argent"), py::int(d("TECHNOS").at("ble").atf("prix") * 0.75));
    let mut possibles = Vec::new();
    j.evenements_extensions(&mut possibles);
    j.etat.set("evenement", possibles.into_iter().find(|x| x.at("type") == "brevet").unwrap());
    ok(&j, "evenement", dict! {"choix" => 0});
    assert_eq!(j.etat.at("brevets").len(), 1);
}

#[test]
fn direction_generale() {
    let j = riche(11, 10, true);
    let (chance, levee) = (j.chance_negociation(1.2, 1.0, 0.0), j.montant_levee());
    let fondateur = j.etat.at("employes").at(0);
    let (x, y, _, _) = office::moteur::r4(&d("PIECES").at("dg").at("rect"));
    ok(&j, "deplacer", dict! {"id" => fondateur.at("bureau"), "x" => x + 8, "y" => y + 8});
    assert!(j.dg_actif());
    assert!(proche(j.chance_negociation(1.2, 1.0, 0.0), chance + 0.1));
    assert_eq!(j.montant_levee(), py::int(levee as f64 * 1.3));
}

#[test]
fn missions_toutes_mesurables() {
    let j = riche(12, 10, true);
    for m in d("MISSIONS").iter() {
        let cle = m.ats(2);
        assert!(j.mesure(&cle).is_int(), "{}", m.at(0));
        if let Some(l) = cle.strip_prefix("local:") {
            assert!(d("LOCAUX").has(l), "{}", m.at(0));
        }
    }
}

#[test]
fn services_dans_la_vue() {
    let j = riche(13, 10, false);
    let v = j.vue();
    let mut s: Vec<String> = v.at("services").keys().iter().map(|k| k.string()).collect();
    s.sort();
    assert_eq!(s, ["e", "f", "m"]);
    assert_eq!(v.at("employes").at(0).at("piece"), "garage");
}
