//! Ce que Python faisait tout seul et que le jeu laisse voir : ses valeurs (dict partagés, 1 contre 1.0), son
//! hasard, ses arrondis, son JSON. Pièces copiées de web_conquete : le moteur porté s'écrit avec elles pour rendre,
//! à la même graine, la même partie et les mêmes sauvegardes que le moteur Python.

mod hasard;
pub mod json;
mod nombres;
mod texte;
mod val;

pub use hasard::*;
pub use nombres::*;
pub use texte::*;
pub use val::*;
