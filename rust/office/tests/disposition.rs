//! tests/test_disposition.py, réécrit un pour un : meubles adossés aux murs, écartés, portes dégagées, tout
//! accessible, même bâtiment plein.

mod commun;

use commun::*;
use office::moteur::{d, r4, Jeu};
use office::py::Val;
use office::dict;

fn plein(graine: i64) -> Jeu {
    let j = Jeu::nouveau(Some(graine), &"reprise".into(), &"facile".into(), &"Banc".into(), &"Test".into()).unwrap();
    j.etat.set("argent", 10_000_000);
    j.etat.set("renommee", 30);
    for m in d("MATERIEL").keys() {
        let _ = act(&j, "acheter", dict! {"id" => m});
    }
    for (k, f) in d("DECO").items() {
        let n = if f.getb("multiple") { 4 } else { 1 };
        for _ in 0..n {
            let _ = act(&j, "poser", dict! {"id" => &k});
        }
    }
    while act(&j, "poser", dict! {"id" => "poste"}).is_ok() {}
    j
}

#[test]
fn grille_des_bureaux_contre_les_murs() {
    let pieces = d("PIECES");
    for p in d("EMPLACEMENTS").at("poste").iter() {
        let (x, y) = (p.ati(0), p.ati(1));
        let c = d("COTE_POSTES").at(Val::tuple(vec![Val::Int(x), Val::Int(y)])).string();
        let (k, pc) = pieces
            .items()
            .into_iter()
            .find(|(_, pc)| {
                let (px, py, pw, ph) = r4(&pc.at("rect"));
                px <= x && x < px + pw && py <= y && y < py + ph
            })
            .unwrap();
        let (px, py, pw, ph) = r4(&pc.at("rect"));
        let (dd, w) = if c == "o" || c == "e" { (64, 76) } else { (76, 64) };
        let dos = match c.as_str() {
            "n" => y - py,
            "s" => py + ph - y - w,
            "o" => x - px,
            _ => px + pw - x - dd,
        };
        if k != "garage" || c != "e" {
            // au garage, ce bureau-là s'adosse à l'étagère
            assert!(dos <= 2, "{k} {x} {y} {c}");
        }
    }
}

#[test]
fn batiment_plein() {
    let j = plein(5);
    let libre = |o: &Val| Jeu::fiche(&o.at("type")).unwrap().getb("libre") && o.at("type") != "tableau";
    let mut par_piece: Vec<(String, Vec<Val>)> = Vec::new();
    for o in j.etat.at("objets").iter() {
        let Some(k) = j.piece_de(&o) else { continue };
        match par_piece.iter_mut().find(|(p, _)| *p == k) {
            Some((_, v)) => v.push(o),
            None => par_piece.push((k, vec![o])),
        }
    }
    for (k, objets) in &par_piece {
        let meubles: Vec<Val> = objets.iter().filter(|o| !libre(o)).cloned().collect();
        assert!(j.accessible(k, &meubles, None).unwrap(), "{k} : un meuble n'est plus accessible");
        for o in &meubles {
            let r = Jeu::rect(o).unwrap();
            let devant = d("PORTES").at(k.as_str()).iter().any(|q| {
                let q = r4(&q);
                r.0 < q.0 + q.2 && q.0 < r.0 + r.2 && r.1 < q.1 + q.3 && q.1 < r.1 + r.3
            });
            assert!(!(devant && o.at("type") == "poste"), "{k} : bureau devant une porte");
        }
    }
    let meubles: Vec<Val> = j.etat.at("objets").iter().filter(|o| !libre(o) && j.piece_de(o).is_some()).collect();
    let etablis = [(520, 1546, 228, 44), (532, 1678, 220, 58), (440, 408, 232, 44)];
    let mut loin = Vec::new();
    for o in &meubles {
        let k = j.piece_de(o).unwrap();
        let c = o.get_or("cote", "n").string();
        let (px, py, pw, ph) = r4(&d("PIECES").at(k.as_str()).at("rect"));
        let (w, h) = Jeu::emprise(&o.at("type"), &c).unwrap();
        let (x, y) = (o.ati("x"), o.ati("y"));
        let dos = match c.as_str() {
            "n" => y - py,
            "s" => py + ph - y - h,
            "o" => x - px,
            _ => px + pw - x - w,
        };
        let sur_etabli = etablis.iter().any(|&(ex, ey, ew, eh)| ex <= x && ey <= y && x + w <= ex + ew && y + h <= ey + eh);
        if dos > 2 && !sur_etabli {
            loin.push((k, o.ats("type")));
        }
    }
    assert!(loin.len() <= meubles.len() / 10, "meubles loin d'un mur : {loin:?}");
}

#[test]
fn sauvegarde_ancienne_rangee_a_nouveau() {
    let j = Jeu::graine(3);
    let etat = j.etat.clone();
    etat.set("version_plan", 9);
    for o in etat.at("objets").iter() {
        o.pop("cote");
    }
    Jeu::charger(etat.clone(), None).unwrap();
    assert!(etat.at("objets").iter().all(|o| o.has("cote")));
}
