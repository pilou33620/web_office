//! Les plans remplis (garage et bâtiment : tout le matériel, la déco, les bureaux) que lit tests/test_trajets.js.
//! Lancement : cargo run -q --release -p office --example trajets

use office::dict;
use office::moteur::{d, Jeu};
use office::py::{json, Val};

fn remplir(j: &Jeu) {
    j.etat.set("argent", 10_000_000);
    j.etat.set("renommee", 30);
    let action = |genre: &str, id: &Val| j.action(&Val::str(genre), &dict! {"id" => id});
    for m in d("MATERIEL").keys() {
        let _ = action("acheter", &m);
    }
    for (x, f) in d("DECO").items() {
        let n = if f.getb("multiple") { 4 } else { 1 };
        for _ in 0..n {
            let _ = action("poser", &x);
        }
    }
    while action("poser", &Val::str("poste")).is_ok() {}
}

fn main() {
    let partie = |scenario: &str, difficulte: &str| Jeu::nouveau(Some(1), &scenario.into(), &difficulte.into(), &"T".into(), &"T".into()).unwrap();
    let (g, b) = (partie("garage", "normal"), partie("reprise", "facile"));
    remplir(&g);
    remplir(&b);
    let cat = Val::dict();
    for (cle, nom) in [
        ("pieces", "PIECES"), ("coques", "COQUES"), ("communs", "COMMUNS"), ("etages", "ETAGES"), ("cloisons", "CLOISONS"),
        ("ouvertures", "OUVERTURES"), ("dehors", "DEHORS"), ("poste", "POSTE"), ("materiel", "MATERIEL"), ("deco", "DECO"),
        ("obstacles", "OBSTACLES"), ("etablis", "ETABLIS"),
    ] {
        cat.set(cle, d(nom));
    }
    let sortie = dict! {"cat" => cat, "garage" => g.etat.at("objets"), "batiment" => b.etat.at("objets"), "locaux" => b.etat.at("locaux")};
    println!("{}", json::dumps(&sortie));
}
