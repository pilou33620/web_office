//! Aides des essais du moteur (les tests Python, réécrits un pour un).
#![allow(dead_code)]

use office::moteur::{ErreurJeu, Jeu};
use office::py::Val;
use office::{dict, list};

/// `j.action(genre, **p)`.
pub fn act(j: &Jeu, genre: &str, p: Val) -> Result<(), ErreurJeu> {
    j.action(&Val::str(genre), &p)
}

/// L'action réussit.
#[track_caller]
pub fn ok(j: &Jeu, genre: &str, p: Val) {
    if let Err(e) = act(j, genre, p) {
        panic!("{genre} refusée : {e}");
    }
}

/// L'action est refusée (`with self.assertRaises(ErreurJeu)`).
#[track_caller]
pub fn ko(j: &Jeu, genre: &str, p: Val) {
    assert!(act(j, genre, p).is_err(), "{genre} aurait dû être refusée");
}

/// `Jeu(graine=…, scenario=…, difficulte=…)`.
pub fn partie(graine: i64, scenario: &str, difficulte: &str) -> Jeu {
    Jeu::nouveau(Some(graine), &scenario.into(), &difficulte.into(), &Val::None, &Val::None).expect("partie neuve")
}

/// `json.loads(json.dumps(etat))` : une copie indépendante.
pub fn copie_json(v: &Val) -> Val {
    office::py::json::loads(&office::py::json::dumps(v)).unwrap()
}

/// Ajoute un employé avec un bureau posé automatiquement (`employe` de test_batiment.py).
pub fn employe(j: &Jeu, comp: Val) -> Val {
    let (x, y, c) = j.place_auto(&Val::str("poste"), None, &Val::None).unwrap();
    let bureau = j.ajouter_objet(&Val::str("poste"), x, y, &c).at("id");
    let modifs = dict! {"e" => 0, "m" => 0, "f" => 0, "stage" => 0, "salaire" => 2000, "chef" => false, "commercial" => false, "role_propose" => Val::None};
    modifs.update(&comp);
    let x = j.nouvel_employe(&j.candidat(), &bureau, &modifs);
    j.oublier_roles();
    x
}

/// `riche(graine, rep, emmenage)` de test_batiment.py.
pub fn riche(graine: i64, rep: i64, emmenage: bool) -> Jeu {
    let j = Jeu::graine(graine);
    j.etat.set("argent", 1_000_000);
    j.etat.set("renommee", rep);
    if emmenage {
        ok(&j, "local", dict! {"id" => "bureau"});
    }
    j
}

/// Tirages forcés (`j.rng.random = lambda: valeur`) ; None les rend au hasard.
pub fn toujours(j: &Jeu, valeur: Option<f64>) {
    j.rng.borrow_mut().force = valeur;
}

pub fn vide() -> Val {
    list![]
}

pub fn proche(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-7
}
