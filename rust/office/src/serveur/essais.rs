//! Banc du serveur (tests/banc-serveur.py) : ce qu'il sert, ce qu'il refuse, sans réseau. Serveur sur un port libre
//! de 127.0.0.1, sauvegardes dans un dossier temporaire.

use super::*;
use std::io::Read;
use std::net::TcpStream;

fn dossier_essai(nom: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("web_office_essai_{}_{nom}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn demarrer(dossier: PathBuf) -> u16 {
    let _ = GARDE.set(Garde::new("WEB_OFFICE", false, None, None));
    let srv = Serveur::ouvrir(0, false, 1).unwrap();
    let jeu = fil_du_jeu(dossier, false);
    srv.servir_en_fond(Arc::new(move |r: &mut Requete| servir(r, &jeu)));
    srv.port()
}

/// (code, en-têtes, corps).
fn requete(port: u16, methode: &str, chemin: &str, hote: Option<&str>, entetes: &[(&str, &str)], corps: Option<&[u8]>) -> (u16, String, Vec<u8>) {
    let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
    let mut t = format!("{methode} {chemin} HTTP/1.0\r\nHost: {}\r\n", hote.map(str::to_string).unwrap_or(format!("127.0.0.1:{port}")));
    for (k, v) in entetes {
        t += &format!("{k}: {v}\r\n");
    }
    if let Some(c) = corps {
        if !entetes.iter().any(|(k, _)| *k == "Content-Length") {
            t += &format!("Content-Length: {}\r\n", c.len());
        }
    }
    t += "\r\n";
    s.write_all(t.as_bytes()).unwrap();
    if let Some(c) = corps {
        let _ = s.write_all(c);
    }
    let mut lu = Vec::new();
    let _ = s.read_to_end(&mut lu);
    let fin = lu.windows(4).position(|w| w == b"\r\n\r\n").expect("réponse HTTP");
    let tete = String::from_utf8_lossy(&lu[..fin]).to_string();
    let code = tete.split(' ').nth(1).unwrap().parse().unwrap();
    (code, tete, lu[fin + 4..].to_vec())
}

fn entete(tete: &str, nom: &str) -> Option<String> {
    tete.lines().find_map(|l| l.split_once(':').filter(|(k, _)| k.eq_ignore_ascii_case(nom)).map(|(_, v)| v.trim().to_string()))
}

fn post(port: u16, chemin: &str, corps: &str) -> (u16, serde_json::Value) {
    let (c, _, b) = requete(port, "POST", chemin, None, &[(ENTETE, "1")], Some(corps.as_bytes()));
    (c, serde_json::from_slice(&b).unwrap())
}

#[test]
fn fichiers_hote_et_ecritures() {
    let dossier = dossier_essai("banc");
    let port = demarrer(dossier.clone());
    for (chemin, attendu) in [
        ("/", 200), ("/index.html", 200), ("/jeu.js", 200), ("/plan.js", 200), ("/rendu.js", 200), ("/style.css", 200),
        ("/vendor/three/build/three.module.min.js", 200), ("/vendor/three/addons/postprocessing/GTAOPass.js", 200),
        ("/vendor/../serveur.py", 404), ("/vendor/%2e%2e/serveur.py", 404), ("/vendor/.cache", 404), ("/vendor/", 404),
        ("/api/etat", 200), ("/api/catalogue", 200), ("/api/parties", 200),
        ("/.git/config", 404), ("/.gitignore", 404), ("/serveur.py", 404), ("/Cargo.toml", 404), ("/lancer.sh", 404),
        ("/../serveur.py", 404), ("/%2e%2e/serveur.py", 404), ("/.env", 404), ("/README.md", 404),
        ("/rust/office/src/serveur.rs", 404), ("/sauvegardes/partie_1.json", 404), ("/web/index.html", 404), ("/api/inconnue", 404),
    ] {
        assert_eq!(requete(port, "GET", chemin, None, &[], None).0, attendu, "GET {chemin}");
    }
    assert_eq!(requete(port, "HEAD", "/.git/config", None, &[], None).0, 404);
    assert_eq!(requete(port, "GET", "/", Some("piege.example:8793"), &[], None).0, 403);
    assert_eq!(requete(port, "GET", "/api/etat", Some("piege.example:8793"), &[], None).0, 403);
    assert_eq!(requete(port, "GET", "/", Some("192.168.1.20:8793"), &[], None).0, 200);
    let (_, tete, _) = requete(port, "GET", "/", None, &[], None);
    assert_eq!(entete(&tete, "X-Frame-Options").as_deref(), Some("SAMEORIGIN"));
    assert_eq!(entete(&tete, "X-Content-Type-Options").as_deref(), Some("nosniff"));
    assert_eq!(entete(&tete, "Cache-Control").as_deref(), Some("no-store, max-age=0"));
    assert!(entete(&tete, "Content-Security-Policy").unwrap().contains("frame-ancestors 'self'"));
    let type_de = |c: &str| entete(&requete(port, "GET", c, None, &[], None).1, "Content-Type");
    assert_eq!(type_de("/jeu.js").as_deref(), Some("text/javascript; charset=utf-8"));
    assert_eq!(type_de("/vendor/three/build/three.module.min.js").as_deref(), Some("text/javascript; charset=utf-8"));
    // polices locales (le jeu marche sans Internet)
    assert_eq!(type_de("/vendor/polices/polices.css").as_deref(), Some("text/css; charset=utf-8"));
    for p in ["fredoka-latin", "fredoka-latin-ext", "nunito-latin", "nunito-latin-ext"] {
        let (code, tete, corps) = requete(port, "GET", &format!("/vendor/polices/{p}.woff2"), None, &[], None);
        assert_eq!((code, entete(&tete, "Content-Type").as_deref()), (200, Some("font/woff2")), "{p}");
        assert!(corps.starts_with(b"wOF2"), "{p} : un vrai fichier woff2");
    }

    // POST : en-tête maison, taille, JSON
    assert_eq!(requete(port, "POST", "/api/action", None, &[], Some(b"{}")).0, 403);
    assert_eq!(requete(port, "POST", "/api/action", None, &[(ENTETE, "1"), ("Content-Length", "999999")], Some(b"{}")).0, 413);
    assert_eq!(requete(port, "POST", "/api/action", None, &[(ENTETE, "1"), ("Content-Length", "abc")], Some(b"{}")).0, 413);
    assert_eq!(requete(port, "POST", "/api/action", None, &[(ENTETE, "1")], Some(b"{pas du json")).0, 400);
    assert_eq!(requete(port, "POST", "/api/action", None, &[(ENTETE, "1")], Some(b"[1, 2]")).0, 400);
    let (c, v) = post(port, "/api/action", r#"{"genre": "inconnu"}"#);
    assert_eq!((c, v["ok"].as_bool()), (200, Some(false)));
    let (c, v) = post(port, "/api/nouvelle", r#"{"emplacement": 2}"#);
    assert_eq!((c, v["ok"].as_bool()), (200, Some(true)));
    let f2 = dossier.join("partie_2.json");
    assert!(f2.is_file(), "sauvegarde dans le dossier des données");
    assert_eq!(post(port, "/api/charger", r#"{"emplacement": 9}"#).1["ok"], false);

    // Le temps qui passe n'écrit pas la sauvegarde à chaque jour simulé, seulement tous les 10 jours
    std::fs::remove_file(&f2).unwrap();
    post(port, "/api/action", r#"{"genre": "avancer"}"#);
    assert!(!f2.exists(), "1 jour joué : pas d'écriture");
    post(port, "/api/action", r#"{"genre": "avancer", "jours": 9}"#);
    assert!(f2.is_file(), "10 jours joués : sauvegarde écrite");

    // Une sauvegarde illisible (ici un matériel retiré du catalogue) est mise de côté, jamais écrasée
    let abimee = pyjson::loads(&std::fs::read_to_string(&f2).unwrap()).unwrap();
    abimee.at("materiel").push("appareil_disparu");
    let texte = pyjson::dumps(&abimee);
    std::fs::write(dossier.join("partie_3.json"), &texte).unwrap();
    assert_eq!(post(port, "/api/charger", r#"{"emplacement": 3}"#).1["ok"], false);
    assert_eq!(std::fs::read_to_string(dossier.join("partie_3.abime.json")).unwrap(), texte);
    post(port, "/api/nouvelle", r#"{"emplacement": 3}"#);
    assert!(dossier.join("partie_3.abime.json").is_file(), "nouvelle partie à sa place : la copie reste");

    // Noms choisis à la création, visibles dans la liste des parties
    let (_, v) = post(port, "/api/nouvelle", r#"{"emplacement": 1, "entreprise": "Ohm Sweet Ohm", "directeur": "Ada"}"#);
    assert_eq!(v["etat"]["entreprise"], "Ohm Sweet Ohm");
    let long = format!(r#"{{"emplacement": 1, "entreprise": "{}"}}"#, "x".repeat(31));
    assert_eq!(post(port, "/api/nouvelle", &long).1["ok"], false);
    let (_, _, b) = requete(port, "GET", "/api/parties", None, &[], None);
    let parties: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(parties["parties"][0]["entreprise"], "Ohm Sweet Ohm");
    assert_eq!(parties["records"], serde_json::json!([]));
    // paramètres de type inattendu : refus propre, le serveur reste debout
    assert_eq!(post(port, "/api/nouvelle", r#"{"emplacement": 1, "scenario": [1]}"#).1["ok"], false);
    assert_eq!(post(port, "/api/action", r#"{"genre": "acheter", "id": [1]}"#).1["ok"], false);
    assert_eq!(requete(port, "GET", "/api/etat", None, &[], None).0, 200);
    let _ = std::fs::remove_dir_all(&dossier);
}

#[test]
fn records() {
    let dossier = dossier_essai("records");
    let mut app = App::ouvrir(dossier.clone(), false);
    for score in 0..12 {
        app.jeu = nouvelle_partie("garage", "normal", &format!("Société {score}"), "Ada");
        let fin = app.jeu.score_final();
        fin.set("score", score);
        app.jeu.etat.set("fin", fin);
        app.noter_record();
        app.noter_record();
    }
    let records = app.lire_records();
    assert_eq!(records.len(), 10, "10 au plus, sans doublon");
    let r0 = records.at(0);
    assert_eq!((r0.ati("score"), r0.ats("entreprise"), r0.ats("directeur")), (11, "Société 11".to_string(), "Ada".to_string()));
    std::fs::write(dossier.join("records.json"), "{abîmé").unwrap();
    assert_eq!(app.lire_records().len(), 0);
    assert!(dossier.join("records.abime.json").is_file(), "records illisibles : mis de côté");
    app.emplacement = 2;
    app.sauver();
    assert!(dossier.join("partie_2.json").is_file());
    let _ = std::fs::remove_dir_all(&dossier);
}

#[test]
fn mise_de_cote_numerotee() {
    let dossier = dossier_essai("cote");
    for i in 0..3 {
        std::fs::write(dossier.join("partie_1.json"), format!("{i}")).unwrap();
        mettre_de_cote(&dossier.join("partie_1.json")).unwrap();
    }
    assert!(dossier.join("partie_1.abime.json").is_file());
    assert_eq!(std::fs::read_to_string(dossier.join("partie_1.abime-3.json")).unwrap(), "2");
    let _ = std::fs::remove_dir_all(&dossier);
}

#[test]
fn ligne_de_commande() {
    let a = |l: &[&str]| l.iter().map(|x| x.to_string()).collect::<Vec<_>>();
    // la commande du catalogue de web_launcher
    let x = lire_args(&a(&["--port", "8793", "--sans-navigateur", "--sans-pause", "--sans-maj"])).unwrap();
    assert_eq!((x.port, x.sans_navigateur, x.sans_pause, x.sans_maj, x.local), (8793, true, true, true, false));
    assert_eq!(lire_args(&[]).unwrap().port, PORT);
    assert_eq!(lire_args(&a(&["--port=8800", "--local", "--demo"])).unwrap(), Args { port: 8800, local: true, demo: true, ..Default::default() });
    assert!(lire_args(&a(&["--port"])).is_err());
    assert!(lire_args(&a(&["--port", "abc"])).is_err());
    assert!(lire_args(&a(&["--inconnu"])).is_err());
    assert!(lire_args(&a(&["--local=1"])).is_err());
}
