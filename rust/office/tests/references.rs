//! Le moteur Rust rend, à la même graine, exactement ce que rendait le moteur Python : mêmes parties neuves, même
//! partie jouée deux ans par une stratégie fixe, même catalogue, et une sauvegarde Python se relit et se réécrit à
//! l'octet près. Références tirées du Python avant le portage (tests/references/).

mod commun;

use commun::*;
use office::moteur::Jeu;
use office::py::{json, Val};
use office::dict;
use serde_json::Value as J;

const PARTIES: &str = include_str!("references/parties.json");
const CATALOGUE: &str = include_str!("references/catalogue.json");
const SAUVEGARDE: &str = include_str!("references/sauvegarde_python.json");

/// `json.dumps(v, ensure_ascii=False)`.
fn texte(v: &Val) -> String {
    json::dumps_avec(v, json::Ecriture::default())
}

/// Le premier endroit où deux JSON diffèrent (clés, ordre, nombres 1 contre 1.0 compris).
fn difference(a: &J, b: &J, chemin: &str) -> Option<String> {
    let court = |v: &J| v.to_string().chars().take(200).collect::<String>();
    match (a, b) {
        (J::Object(x), J::Object(y)) => {
            let (kx, ky): (Vec<&String>, Vec<&String>) = (x.keys().collect(), y.keys().collect());
            if kx != ky {
                return Some(format!("{chemin} : clés rust {kx:?}\n  python {ky:?}"));
            }
            x.iter().find_map(|(k, v)| difference(v, &y[k], &format!("{chemin}.{k}")))
        }
        (J::Array(x), J::Array(y)) if x.len() == y.len() => x.iter().zip(y).enumerate().find_map(|(i, (u, v))| difference(u, v, &format!("{chemin}[{i}]"))),
        _ if a == b => None,
        _ => Some(format!("{chemin} : rust {}\n  python {}", court(a), court(b))),
    }
}

#[track_caller]
fn pareil(rust: &str, python: &str, nom: &str) {
    if rust == python {
        return;
    }
    let (a, b): (J, J) = (serde_json::from_str(rust).unwrap(), serde_json::from_str(python).unwrap());
    match difference(&a, &b, nom) {
        Some(d) => panic!("différence avec le Python : {d}"),
        None => panic!("{nom} : même contenu, écriture différente\n  rust   {}\n  python {}", &rust[..rust.len().min(300)], &python[..python.len().min(300)]),
    }
}

fn reference(cas: &str, cle: &str) -> String {
    let p: J = serde_json::from_str(PARTIES).unwrap();
    p[cas][cle].as_str().unwrap_or_else(|| panic!("référence {cas}/{cle}")).to_string()
}

/// La stratégie fixe de la partie de référence (`jouer` du générateur Python).
fn jouer(j: &Jeu, jours: i64, instantanes: &[i64], cas: &str) {
    for jour in 1..=jours {
        let e = &j.etat;
        if e.atb("faillite") {
            break;
        }
        if e.atb("evenement") {
            for choix in 0..e.at("evenement").at("options").len() {
                if act(j, "evenement", dict! {"choix" => choix}).is_ok() {
                    break;
                }
            }
        }
        for cle in ["bilan", "dernier_livre"] {
            e.pop(cle);
        }
        if !e.at("prospections").truthy() && !j.prospecteurs().is_empty() {
            ok(j, "prospecter", dict! {"canal" => "reseaux", "qui" => j.prospecteurs()[0].at("id")});
        }
        for piste in e.at("pistes").iter() {
            ok(j, "devis", dict! {"id" => piste.at("id"), "prix" => "1.0", "delai" => "1.0"});
        }
        if (e.at("projets").len() as i64) < j.capacite_projets() && e.at("offres").truthy() {
            let _ = act(j, "signer", dict! {"id" => e.at("offres").at(0).at("id")});
        }
        for p in e.at("projets").iter() {
            if p.at("etape") == "debug" && p.atf("defauts") < 2.0 {
                ok(j, "tests_cem", dict! {"id" => p.at("id")});
            }
        }
        for (genre, ident) in [("local", "bureau"), ("embaucher", ""), ("acheter", "oscillo"), ("deco", "cafe")] {
            if e.ati("argent") > 25000 {
                let id = if !ident.is_empty() {
                    Val::str(ident)
                } else if e.at("candidats").truthy() {
                    e.at("candidats").at(0).at("id")
                } else {
                    Val::Int(0)
                };
                let _ = act(j, genre, dict! {"id" => id});
            }
        }
        ok(j, "avancer", dict! {});
        if instantanes.contains(&jour) {
            pareil(&texte(&j.etat), &reference(cas, &jour.to_string()), &format!("{cas} jour {jour}"));
        }
    }
    pareil(&texte(&j.vue()), &reference(cas, "vue"), &format!("{cas} vue"));
}

#[test]
fn partie_neuve() {
    pareil(&texte(&Jeu::graine(1).etat), &reference("neuf_1", "etat"), "neuf_1");
    pareil(&texte(&Jeu::graine(1).vue()), &reference("neuf_1", "vue"), "neuf_1 vue");
}

#[test]
fn reprise_d_entreprise() {
    let j = Jeu::nouveau(Some(3), &"reprise".into(), &"facile".into(), &"Banc".into(), &"Test".into()).unwrap();
    pareil(&texte(&j.etat), &reference("reprise_3", "etat"), "reprise_3");
}

#[test]
fn partie_de_deux_ans() {
    jouer(&Jeu::graine(7), 720, &[30, 90, 180, 360, 720], "partie_7");
}

#[test]
fn partie_dans_le_batiment() {
    jouer(&partie(11, "reprise", "facile"), 360, &[60, 360], "batiment_11");
}

#[test]
fn catalogue() {
    pareil(&texte(&office::serveur::catalogue()), CATALOGUE, "catalogue");
}

/// Une vraie sauvegarde de la version Python se relit, se réécrit à l'octet près et se joue.
#[test]
fn sauvegarde_python() {
    let etat = json::loads(SAUVEGARDE).unwrap();
    assert_eq!(texte(&etat), SAUVEGARDE);
    let j = Jeu::charger(etat, None).unwrap();
    j.vue();
    ok(&j, "avancer", dict! {"jours" => 5});
}
