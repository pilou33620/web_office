//! Moteur de Circuit Story : simulation jour par jour d'un bureau d'études électronique (portage de moteur/*.py).
//! Les modules gardent les noms et l'ordre des fichiers Python : jeu (le cœur), extensions, personnel, commerce.
//! La partie est un dict de Python (`Val`) : la sauvegarde est ce dict écrit en JSON, clé pour clé, nombre pour nombre.

mod commerce;
mod extensions;
mod jeu;
mod personnel;

pub use jeu::*;

use crate::py::{self, Val};

/// Action refusée ; le message est affiché au joueur.
#[derive(Debug, Clone, PartialEq)]
pub struct ErreurJeu(pub String);

impl std::fmt::Display for ErreurJeu {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

pub type R<T = ()> = Result<T, ErreurJeu>;

pub fn erreur<T>(m: impl Into<String>) -> R<T> {
    Err(ErreurJeu(m.into()))
}

thread_local! {
    /// Les catalogues de moteur/donnees.py, écrits en JSON (data/donnees.json) : relus une fois par fil.
    static DONNEES: Val = charger_donnees();
}

fn charger_donnees() -> Val {
    let v = py::json::loads(include_str!("../../data/donnees.json")).expect("data/donnees.json illisible");
    // JSON n'a que des clés texte : ces dict avaient des clés entières (heures, taille de lot, mois)
    for nom in ["HORAIRES", "LOTS", "SALONS"] {
        let t = v.at(nom);
        let paires = t.items().into_iter().map(|(k, x)| (Val::Int(k.s().parse().expect("clé entière")), x)).collect();
        v.set(nom, Val::dict_from(paires));
    }
    // … et celui-ci des clés (x, y) : rangé en liste de [x, y, côté]
    let cotes = v.at("COTE_POSTES");
    v.set("COTE_POSTES", Val::dict_from(cotes.iter().map(|t| (Val::tuple(vec![t.at(0), t.at(1)]), t.at(2))).collect()));
    v
}

/// Une constante de moteur/donnees.py (`d("PIECES")`).
pub fn d(nom: &str) -> Val {
    DONNEES.with(|x| x.at(nom))
}

/// `max(lo, min(hi, x))`, avec les types de Python (une borne entière reste entière).
pub fn borne(x: impl Into<Val>, lo: impl Into<Val>, hi: impl Into<Val>) -> Val {
    vmax(lo, vmin(hi, x))
}

/// `borne` entre flottants.
pub fn bornef(x: f64, lo: f64, hi: f64) -> f64 {
    lo.max(hi.min(x))
}

/// `max(a, b)` de Python : a, sauf si b est plus grand.
pub fn vmax(a: impl Into<Val>, b: impl Into<Val>) -> Val {
    let (a, b) = (a.into(), b.into());
    if b > a {
        b
    } else {
        a
    }
}

/// `min(a, b)` de Python : a, sauf si b est plus petit.
pub fn vmin(a: impl Into<Val>, b: impl Into<Val>) -> Val {
    let (a, b) = (a.into(), b.into());
    if b < a {
        b
    } else {
        a
    }
}

/// `round(v, n)` d'une valeur : un entier reste entier.
pub fn arrondi(v: &Val, n: i32) -> Val {
    match v {
        Val::Float(f) => Val::Float(py::round_n(*f, n)),
        autre => autre.clone(),
    }
}

/// `int(round(x, -n))` : arrondi à la dizaine (n = 1), à la centaine (n = 2)…
pub fn arrondi_entier(x: f64, n: i32) -> i64 {
    py::int(py::round_n(x, -n))
}

/// Prérequis d'un contrat : aucun, un identifiant ou une liste d'identifiants.
pub fn requis_liste(requis: &Val) -> Vec<Val> {
    if !requis.truthy() {
        Vec::new()
    } else if requis.is_str() {
        vec![requis.clone()]
    } else {
        requis.vec()
    }
}

/// Un entier de JSON (pas un booléen).
pub fn entier(v: &Val) -> bool {
    matches!(v, Val::Int(_))
}

/// `f"{n:,}".replace(",", " ")` : les milliers séparés par une espace.
pub fn mil(n: i64) -> String {
    py::milliers(n).replace(',', " ")
}

/// `d.get(cle)` sur un dict qui peut manquer (`PIECES.get(k, {}).get(cle)`).
pub fn champ(v: &Val, cle: &str) -> Val {
    if v.is_dict() {
        v.get(cle)
    } else {
        Val::None
    }
}

/// Garde les n premiers éléments d'une liste (`del l[n:]`).
pub fn tronquer(l: &Val, n: usize) {
    if l.len() > n {
        l.replace_all(l.slice(None, Some(n as i64)).vec());
    }
}

/// Un rectangle (x, y, l, h) du catalogue.
pub fn r4(v: &Val) -> (i64, i64, i64, i64) {
    (v.ati(0), v.ati(1), v.ati(2), v.ati(3))
}
