//! Circuit Story : le moteur du jeu (simulation d'un bureau d'études électronique) et son serveur local.
//! Portage de moteur/*.py et de serveur.py : mêmes règles, mêmes tirages à la même graine, mêmes sauvegardes.
#![allow(clippy::too_many_arguments, clippy::type_complexity, clippy::neg_cmp_op_on_partial_ord, clippy::len_without_is_empty)]

pub mod py;

pub mod moteur;
pub mod serveur;
