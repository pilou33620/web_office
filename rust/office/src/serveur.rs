//! Le serveur de Circuit Story (portage de serveur.py) : sert l'interface web (web/) et l'API JSON du moteur.
//!
//! Lancement :  office [--port 8793] [--local] [--sans-navigateur] [--sans-pause] [--sans-maj] [--demo]
//! Sans --local, le jeu écoute sur le réseau local, protégé par l'appairage des web tools (web_tools_commun).
//! Mode démo (--demo, ou CIRCUIT_STORY_DEMO=1) : la partie se joue toute seule, sauvegardes à part dans sauvegardes/demo.
//!
//! Le moteur tient la partie dans des `Val` (références partagées, un seul fil) : un fil, celui du jeu, la garde et
//! traite une à une les requêtes que les fils du serveur HTTP lui passent par un canal (le VERROU du Python).

use std::io::Write;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, OnceLock};
use std::time::{Duration, Instant};

use serde_json::json;
use web_tools_commun::appairage::{self, Garde};
use web_tools_commun::serveur::{decoder_chemin, ErreurCorps, Reponse, Requete, Serveur};

use crate::moteur::{d, entier, Jeu};
use crate::py::{self, json as pyjson, Val};
use crate::{dict, list};

pub const PORT: u16 = 8793;
pub const ENTETE: &str = "X-WEB_OFFICE";
const EMPLACEMENTS: [i64; 3] = [1, 2, 3];
const JOURS_ENTRE_SAUVEGARDES: i64 = 10; // en jeu, on n'écrit pas la carte SD à chaque jour simulé
const NB_RECORDS: usize = 10;
const CORPS_MAX: usize = 10_000;
/// Ce que la page charge, et rien d'autre de web/ (plus les fichiers de web/vendor, voir `statique`).
const PAGES: [&str; 5] = ["index.html", "jeu.js", "plan.js", "rendu.js", "style.css"];

/// La racine du jeu (web/, sauvegardes/) : le dossier courant s'il contient web/index.html, sinon le premier
/// dossier au-dessus de l'exécutable qui le contient.
pub fn racine() -> &'static Path {
    static R: OnceLock<PathBuf> = OnceLock::new();
    R.get_or_init(|| {
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let jeu = |d: &Path| d.join("web").join("index.html").is_file();
        if jeu(&cwd) {
            return cwd;
        }
        let exe = std::env::current_exe().ok().and_then(|e| std::fs::canonicalize(e).ok());
        exe.and_then(|e| e.ancestors().find(|d| jeu(d)).map(Path::to_path_buf)).unwrap_or(cwd)
    })
}

/// `json.dumps(v, ensure_ascii=False)` : ce qui part au navigateur et dans les sauvegardes.
fn texte_json(v: &Val) -> String {
    pyjson::dumps_avec(v, pyjson::Ecriture::default())
}

// ---------------------------------------------------------------------- fichiers de données

/// Renomme un fichier illisible au lieu de le laisser écraser par un état neuf.
pub fn mettre_de_cote(fichier: &Path) -> std::io::Result<PathBuf> {
    let stem = fichier.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let mut i = 1;
    let abime = loop {
        let nom = if i == 1 { format!("{stem}.abime.json") } else { format!("{stem}.abime-{i}.json") };
        let f = fichier.with_file_name(nom);
        if !f.exists() {
            break f;
        }
        i += 1;
    };
    std::fs::rename(fichier, &abime)?;
    Ok(abime)
}

/// Écriture atomique : pas de fichier corrompu si coupure.
fn ecrire_json(fichier: &Path, v: &Val) -> std::io::Result<()> {
    if let Some(dossier) = fichier.parent() {
        std::fs::create_dir_all(dossier)?;
    }
    let tmp = fichier.with_extension("tmp");
    std::fs::write(&tmp, texte_json(v))?;
    std::fs::rename(&tmp, fichier)
}

fn fichier_partie(dossier: &Path, n: i64) -> PathBuf {
    dossier.join(format!("partie_{n}.json"))
}

/// La partie d'un emplacement ; illisible (JSON abîmé, catalogue changé par une mise à jour…) : mise de côté.
pub fn lire_partie(dossier: &Path, n: i64) -> Option<Jeu> {
    let f = fichier_partie(dossier, n);
    let texte = match std::fs::read(&f) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return None,
        autre => autre,
    };
    let lu = (|| -> Result<Jeu, String> {
        let texte = texte.map_err(|e| format!("OSError : {e}"))?;
        let texte = String::from_utf8(texte).map_err(|_| "UnicodeDecodeError".to_string())?;
        let etat = pyjson::loads(&texte).map_err(|_| "JSONDecodeError".to_string())?;
        // vérifie aussi qu'elle s'affiche (catalogue changé par une mise à jour…)
        match catch_unwind(AssertUnwindSafe(|| Jeu::charger(etat, None).map(|j| (j.vue(), j)))) {
            Ok(Ok((_, j))) => Ok(j),
            Ok(Err(_)) => Err("ErreurJeu".into()),
            Err(_) => Err("erreur du moteur".into()),
        }
    })();
    match lu {
        Ok(j) => Some(j),
        Err(raison) => {
            match mettre_de_cote(&f) {
                Ok(abime) => println!("[!] Sauvegarde {n} illisible ({raison}) : mise de côté dans {}", abime.display()),
                Err(err) => println!("[!] Sauvegarde {n} illisible et impossible à mettre de côté : {err}"),
            }
            let _ = std::io::stdout().flush();
            None
        }
    }
}

fn nouvelle_partie(scenario: &str, difficulte: &str, entreprise: &str, directeur: &str) -> Jeu {
    Jeu::nouveau(None, &scenario.into(), &difficulte.into(), &entreprise.into(), &directeur.into()).expect("partie neuve")
}

/// Le catalogue envoyé à la page (CATALOGUE de serveur.py, dans le même ordre).
pub fn catalogue() -> Val {
    let c = Val::dict();
    let noms = [
        ("materiel", "MATERIEL"), ("deco", "DECO"), ("locaux", "LOCAUX"), ("traits", "TRAITS"), ("produits", "PRODUITS"),
        ("domaines", "NOM_DOMAINE"), ("horaires", "HORAIRES"), ("combos", "COMBOS"), ("trophees", "TROPHEES"),
        ("pieces", "PIECES"), ("etablis", "ETABLIS"), ("obstacles", "OBSTACLES"), ("poste", "POSTE"), ("grille", "GRILLE"),
        ("choix_tech", "CHOIX_TECH"), ("prestataires", "PRESTATAIRES"), ("prix_proposes", "PRIX_PROPOSES"), ("delais_proposes", "DELAIS_PROPOSES"),
        ("technos", "TECHNOS"), ("certifs", "CERTIFS"), ("fournisseurs", "FOURNISSEURS"), ("prets", "PRETS"),
        ("scenarios", "SCENARIOS"), ("difficultes", "DIFFICULTES"), ("entretien_certif", "ENTRETIEN_CERTIF"),
        ("secteurs", "SECTEURS"), ("nb_missions", ""),
        ("metiers", "METIERS"), ("seniorites", "SENIORITES"), ("motivations", "MOTIVATIONS"), ("cout_entretien", "COUT_ENTRETIEN"),
        ("etages", "ETAGES"), ("coques", "COQUES"), ("communs", "COMMUNS"), ("cloisons", "CLOISONS"),
        ("ouvertures", "OUVERTURES"), ("dehors", "DEHORS"), ("meubles", "MEUBLES"),
        ("roles", "ROLES"), ("kickoff", "KICKOFF"), ("brevet", "BREVET"), ("service_sans_resp", "SERVICE_SANS_RESP"),
        ("exigeants", "EXIGEANTS"), ("lots", "LOTS"), ("agrandir_stock", "AGRANDIR_STOCK"), ("stockage", "STOCKAGE"),
        ("commission", "COMMISSION"), ("prime_commercial", "PRIME_COMMERCIAL"),
        ("investissements", "INVESTISSEMENTS"),
    ];
    for (cle, nom) in noms {
        c.set(cle, if nom.is_empty() { Val::from(d("MISSIONS").len()) } else { d(nom) });
    }
    c
}

/// La partie en cours et ses fichiers (les globales de serveur.py) ; vit dans le fil du jeu.
pub struct App {
    pub jeu: Jeu,
    pub emplacement: i64,
    pub sauve_jour: i64,
    pub dossier: PathBuf,
    catalogue: String,
}

impl App {
    pub fn ouvrir(dossier: PathBuf, demo: bool) -> App {
        // Ancienne sauvegarde unique -> emplacement 1
        let ancienne = dossier.join("partie.json");
        if ancienne.exists() && !fichier_partie(&dossier, 1).exists() {
            let _ = std::fs::rename(&ancienne, fichier_partie(&dossier, 1));
        }
        let mut emplacement = std::fs::read_to_string(dossier.join("emplacement.txt"))
            .ok()
            .and_then(|t| t.trim().parse::<i64>().ok())
            .filter(|n| EMPLACEMENTS.contains(n))
            .unwrap_or(1);
        let mut jeu = lire_partie(&dossier, emplacement).unwrap_or_else(|| nouvelle_partie("garage", "normal", "", ""));
        if demo {
            // chaque démo repart d'une société déjà installée, pour voir tout de suite la vie du bureau
            emplacement = 1;
            jeu = nouvelle_partie("reprise", "facile", "Circuit Démo", "Pilote automatique");
        }
        App { jeu, emplacement, sauve_jour: 0, dossier, catalogue: texte_json(&catalogue()) }
    }

    pub fn sauver(&mut self) {
        match ecrire_json(&fichier_partie(&self.dossier, self.emplacement), &self.jeu.etat) {
            Ok(()) => self.sauve_jour = self.jeu.etat.ati("jours_total"),
            Err(e) => println!("[!] Sauvegarde impossible : {e}"),
        }
    }

    pub fn lire_records(&self) -> Val {
        let fichier = self.dossier.join("records.json");
        let lu = match std::fs::read(&fichier) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return list![],
            Err(e) => Err(e.to_string()),
            Ok(o) => String::from_utf8(o)
                .map_err(|_| "texte illisible".to_string())
                .and_then(|t| pyjson::loads(&t))
                .and_then(|v| if v.is_list() { Ok(v) } else { Err("pas une liste".into()) }),
        };
        match lu {
            Ok(v) => v,
            Err(raison) => {
                if let Ok(abime) = mettre_de_cote(&fichier) {
                    println!("[!] Records illisibles ({raison}) : mis de côté dans {}", abime.display());
                }
                list![]
            }
        }
    }

    /// Ajoute le score de fin de partie aux meilleurs scores de toujours, une seule fois par partie.
    pub fn noter_record(&self) {
        let fin = self.jeu.etat.get("fin");
        if !fin.truthy() || fin.getb("record") {
            return;
        }
        let nouveau = Val::dict();
        for k in ["entreprise", "directeur", "score", "titre"] {
            nouveau.set(k, fin.get(k));
        }
        nouveau.set("date", chrono::Local::now().format("%d/%m/%Y").to_string());
        let mut records = self.lire_records().vec();
        records.push(nouveau);
        let mut records = py::sorted_by_key(records, |r| if r.is_dict() { -r.get_or("score", 0).f() } else { 0.0 });
        records.truncate(NB_RECORDS);
        match ecrire_json(&self.dossier.join("records.json"), &Val::list(records)) {
            Ok(()) => fin.set("record", true),
            Err(e) => println!("[!] Record non enregistré : {e}"), // nouvel essai à la prochaine action
        }
    }

    fn resume_partie(&self, n: i64) -> Val {
        let Some(jeu) = lire_partie(&self.dossier, n) else { return dict! {"emplacement" => n, "existe" => false} };
        let v = jeu.vue();
        dict! {
            "emplacement" => n, "existe" => true, "entreprise" => v.at("entreprise"), "date" => v.at("date"), "argent" => v.at("argent"),
            "annee" => v.at("annee_jeu"), "renommee" => v.at("renommee"), "scenario" => d("SCENARIOS").at(v.at("scenario")).at("nom"),
            "difficulte" => d("DIFFICULTES").at(v.at("difficulte")).at("nom"), "faillite" => v.at("faillite"),
        }
    }

    /// Une requête de l'API : (code, corps JSON). `corps` : l'objet JSON d'un POST, déjà vérifié.
    pub fn api(&mut self, post: bool, chemin: &str, corps: &[u8]) -> (u16, String) {
        if !post {
            return match chemin {
                "/api/etat" => match catch_unwind(AssertUnwindSafe(|| self.jeu.vue())) {
                    Ok(v) => (200, texte_json(&v)),
                    Err(_) => (500, texte_json(&dict! {"ok" => false, "erreur" => "Erreur interne."})),
                },
                "/api/catalogue" => (200, self.catalogue.clone()),
                "/api/parties" => {
                    let parties = Val::list(EMPLACEMENTS.iter().map(|&n| self.resume_partie(n)).collect());
                    (200, texte_json(&dict! {"actuelle" => self.emplacement, "parties" => parties, "records" => self.lire_records()}))
                }
                _ => (404, texte_json(&dict! {"ok" => false, "erreur" => "Route inconnue."})),
            };
        }
        let data = std::str::from_utf8(corps).ok().and_then(|t| pyjson::loads(if t.is_empty() { "{}" } else { t }).ok()).unwrap_or_else(Val::dict);
        match catch_unwind(AssertUnwindSafe(|| self.post(chemin, &data))) {
            Ok(r) => r,
            Err(_) => (500, texte_json(&dict! {"ok" => false, "erreur" => "Erreur interne."})),
        }
    }

    fn post(&mut self, chemin: &str, data: &Val) -> (u16, String) {
        let refus = |jeu: &Jeu, m: &str| (200, texte_json(&dict! {"ok" => false, "erreur" => m, "etat" => jeu.vue()}));
        if chemin == "/api/nouvelle" || chemin == "/api/charger" {
            let n = data.get_or("emplacement", self.emplacement);
            if !entier(&n) || !EMPLACEMENTS.contains(&n.i()) {
                return refus(&self.jeu, "Emplacement inconnu.");
            }
            let n = n.i();
            let jeu = if chemin == "/api/charger" {
                match lire_partie(&self.dossier, n) {
                    Some(j) => j,
                    None => return refus(&self.jeu, "Emplacement vide."),
                }
            } else {
                let (sc, di) = (data.get_or("scenario", "garage"), data.get_or("difficulte", "normal"));
                let (en, dr) = (data.get("entreprise"), data.get("directeur"));
                match catch_unwind(AssertUnwindSafe(|| Jeu::nouveau(None, &sc, &di, &en, &dr))) {
                    Ok(Ok(j)) => j,
                    Ok(Err(e)) => return refus(&self.jeu, e.0.as_str()),
                    Err(_) => return refus(&self.jeu, "Paramètres invalides."),
                }
            };
            self.sauver();
            self.jeu = jeu;
            self.emplacement = n;
            self.sauver();
            if let Err(e) = std::fs::write(self.dossier.join("emplacement.txt"), n.to_string()) {
                println!("[!] Emplacement non enregistré : {e}");
            }
            return (200, texte_json(&dict! {"ok" => true, "etat" => self.jeu.vue()}));
        }
        if chemin != "/api/action" {
            return (404, texte_json(&dict! {"ok" => false, "erreur" => "Route inconnue."}));
        }
        let genre = if data.has("genre") { data.pop("genre") } else { Val::str("") };
        let erreur = match catch_unwind(AssertUnwindSafe(|| self.jeu.action(&genre, data))) {
            Ok(Ok(())) => Val::None,
            Ok(Err(e)) => Val::from(e.0),
            Err(_) => Val::str("Paramètres invalides."),
        };
        self.noter_record();
        if genre != "avancer" || self.jeu.en_pause() || self.jeu.etat.ati("jours_total") - self.sauve_jour >= JOURS_ENTRE_SAUVEGARDES {
            self.sauver();
        }
        (200, texte_json(&dict! {"ok" => erreur.is_none(), "erreur" => erreur, "etat" => self.jeu.vue()}))
    }
}

// ---------------------------------------------------------------------- le fil du jeu

pub enum Message {
    /// (POST ?, chemin, corps) et le canal de la réponse (code, JSON).
    Requete(bool, String, Vec<u8>, mpsc::SyncSender<(u16, String)>),
    /// Arrêt : la partie est sauvegardée, puis le canal répond.
    Arreter(mpsc::SyncSender<()>),
}

/// Lance le fil qui tient la partie ; rend le canal pour lui parler.
pub fn fil_du_jeu(dossier: PathBuf, demo: bool) -> mpsc::Sender<Message> {
    let (tx, rx) = mpsc::channel::<Message>();
    std::thread::spawn(move || {
        let mut app = App::ouvrir(dossier, demo);
        for m in rx {
            match m {
                Message::Requete(post, chemin, corps, reponse) => {
                    let _ = reponse.send(app.api(post, &chemin, &corps));
                }
                Message::Arreter(fait) => {
                    app.sauver(); // les derniers jours joués depuis la dernière sauvegarde
                    let _ = fait.send(());
                }
            }
        }
    });
    tx
}

// ---------------------------------------------------------------------- HTTP (les fils du serveur)

/// Les seules extensions servies (celles de web/) ; une autre, ou pas d'extension, est un 404.
fn type_mime(p: &Path) -> Option<&'static str> {
    Some(match p.extension()?.to_str()? {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        "woff2" => "font/woff2",
        _ => return None,
    })
}

/// Le fichier de web/ que la page charge, ou rien : les pages de PAGES, et sous /vendor des chemins dont aucun
/// segment ne commence par un point (`^/vendor(?:/[\w-][\w.+-]*)+$`).
fn statique(chemin: &str) -> Option<PathBuf> {
    let c = decoder_chemin(chemin);
    let web = racine().join("web");
    if c == "/" {
        return Some(web.join("index.html"));
    }
    let rel = c.strip_prefix('/')?;
    if PAGES.contains(&rel) {
        return Some(web.join(rel));
    }
    let reste = rel.strip_prefix("vendor/")?;
    let mot = |ch: char| ch.is_alphanumeric() || ch == '_';
    let bon = |s: &str| {
        let mut it = s.chars();
        it.next().is_some_and(|p| mot(p) || p == '-') && it.all(|ch| mot(ch) || "._+-".contains(ch))
    };
    if !reste.split('/').all(bon) {
        return None;
    }
    Some(reste.split('/').fold(web.join("vendor"), |p, s| p.join(s)))
}

fn fichier(chemin: &str) -> Reponse {
    let Some((f, mime)) = statique(chemin).and_then(|f| type_mime(&f).map(|m| (f, m))) else {
        return Reponse::texte(404, "File not found");
    };
    // pas de lien symbolique ni de dossier : un fichier ordinaire de web/
    if !std::fs::symlink_metadata(&f).is_ok_and(|m| m.is_file()) {
        return Reponse::texte(404, "File not found");
    }
    match std::fs::read(&f) {
        Ok(o) => Reponse::new(200, mime, o),
        Err(_) => Reponse::texte(404, "File not found"),
    }
}

fn garde() -> &'static Garde {
    GARDE.get().expect("garde non initialisée")
}
static GARDE: OnceLock<Garde> = OnceLock::new();

fn json_ok(code: u16, erreur: &str) -> Reponse {
    Reponse::json(code, &json!({"ok": false, "erreur": erreur}))
}

/// Passe la requête au fil du jeu et attend sa réponse.
fn appel(jeu: &mpsc::Sender<Message>, post: bool, chemin: &str, corps: Vec<u8>) -> Reponse {
    let (tx, rx) = mpsc::sync_channel(1);
    match jeu.send(Message::Requete(post, chemin.to_string(), corps, tx)).ok().and_then(|_| rx.recv().ok()) {
        Some((code, texte)) => Reponse::new(code, "application/json; charset=utf-8", texte),
        None => json_ok(500, "Erreur interne."),
    }
}

fn traiter(r: &mut Requete, jeu: &mpsc::Sender<Message>) -> Reponse {
    // Host, Internet, TLS, jeton : avant tout traitement de la requête
    if let Some(rep) = garde().filtrer(r) {
        return rep;
    }
    let chemin = r.chemin().to_string();
    if r.lecture() {
        return match chemin.as_str() {
            "/api/etat" | "/api/catalogue" | "/api/parties" => appel(jeu, false, &chemin, Vec::new()),
            _ => fichier(&chemin),
        };
    }
    if r.methode != "POST" {
        return Reponse::texte(501, "Unsupported method");
    }
    if r.entete(ENTETE) != Some("1") {
        return json_ok(403, "Requête refusée.");
    }
    let corps = match r.lire_corps(CORPS_MAX) {
        Ok(c) => c,
        Err(ErreurCorps::TropGrand | ErreurCorps::Invalide) => return json_ok(413, "Requête trop grande."),
        Err(ErreurCorps::Lecture(_)) => return json_ok(400, "JSON invalide."),
    };
    match serde_json::from_slice::<serde_json::Value>(if corps.is_empty() { b"{}" } else { &corps }) {
        Ok(serde_json::Value::Object(_)) => appel(jeu, true, &chemin, corps),
        _ => json_ok(400, "JSON invalide."),
    }
}

/// Toutes les réponses : pas de cache, pas d'affichage dans le cadre d'un autre site, pas de devinette de type.
fn servir(r: &mut Requete, jeu: &mpsc::Sender<Message>) -> Reponse {
    let mut rep = traiter(r, jeu);
    rep.entetes.retain(|(k, _)| !k.eq_ignore_ascii_case("Cache-Control"));
    rep.entete("Cache-Control", "no-store, max-age=0")
        .entete("X-Frame-Options", "SAMEORIGIN")
        .entete("Content-Security-Policy", "frame-ancestors 'self'")
        .entete("X-Content-Type-Options", "nosniff")
}

// ---------------------------------------------------------------------- lancement

#[derive(Debug, Default, PartialEq)]
pub struct Args {
    pub port: u16,
    pub local: bool,
    pub sans_navigateur: bool,
    pub sans_pause: bool,
    pub sans_maj: bool,
    pub demo: bool,
    pub aide: bool,
}

pub const USAGE: &str = "usage: office [--port 8793] [--local] [--sans-navigateur] [--sans-pause] [--sans-maj] [--demo]";

pub fn lire_args(argv: &[String]) -> Result<Args, String> {
    let mut a = Args { port: PORT, ..Default::default() };
    let mut i = 0;
    while i < argv.len() {
        let x = argv[i].as_str();
        let (cle, val) = match x.split_once('=') {
            Some((k, v)) => (k, Some(v.to_string())),
            None => (x, None),
        };
        match cle {
            "--port" => {
                let v = match val {
                    Some(v) => v,
                    None => {
                        i += 1;
                        argv.get(i).cloned().ok_or("--port attend un nombre")?
                    }
                };
                a.port = v.parse().map_err(|_| format!("port invalide : {v}"))?;
            }
            "--local" if val.is_none() => a.local = true,
            "--sans-navigateur" if val.is_none() => a.sans_navigateur = true,
            "--sans-pause" if val.is_none() => a.sans_pause = true,
            "--sans-maj" if val.is_none() => a.sans_maj = true,
            "--demo" if val.is_none() => a.demo = true,
            "-h" | "--help" if val.is_none() => a.aide = true,
            _ => return Err(format!("option inconnue : {x}")),
        }
        i += 1;
    }
    Ok(a)
}

fn ouvrir_navigateur(url: &str) {
    let r = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", "", url]).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).spawn()
    } else {
        Command::new("xdg-open").arg(url).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
    };
    if r.is_err() {
        println!("Ouvrez {url} dans votre navigateur.");
    }
}

/// Une commande git dans le dossier du jeu, avec un délai : (réussie, sortie, erreurs).
fn git(args: &[&str], delai: u64) -> Result<(bool, String, String), String> {
    let mut enfant = Command::new("git")
        .args(args)
        .current_dir(racine())
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let fin = Instant::now() + Duration::from_secs(delai);
    loop {
        match enfant.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() < fin => std::thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                let _ = enfant.kill();
                let _ = enfant.wait();
                return Err("délai dépassé".into());
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    let o = enfant.wait_with_output().map_err(|e| e.to_string())?;
    let texte = |b: &[u8]| String::from_utf8_lossy(b).trim().to_string();
    Ok((o.status.success(), texte(&o.stdout), texte(&o.stderr)))
}

/// Recherche les mises à jour sur GitHub et les applique (avance rapide seulement). Rend vrai si le code a changé.
fn verifier_et_appliquer_maj() -> bool {
    if git(&["--version"], 5).is_err() {
        return false;
    }
    if !matches!(git(&["rev-parse", "--is-inside-work-tree"], 5), Ok((true, _, _))) {
        return false;
    }
    println!("[*] Recherche de mises a jour sur GitHub...");
    match git(&["fetch", "--quiet", "origin"], 10) {
        Ok((true, _, _)) => {}
        Ok(_) => {
            println!("[!] Impossible de contacter GitHub (hors ligne ou depot distant inaccessible).");
            println!("[*] Demarrage normal de l'outil...");
            return false;
        }
        Err(e) => {
            println!("[!] Echec de la recherche de mise a jour : {e}");
            println!("[*] Demarrage normal de l'outil...");
            return false;
        }
    }
    let amont = if matches!(git(&["rev-parse", "--verify", "@{u}"], 5), Ok((true, _, _))) {
        "@{u}"
    } else if matches!(git(&["rev-parse", "--verify", "origin/main"], 5), Ok((true, _, _))) {
        "origin/main"
    } else {
        return false;
    };
    let nb: i64 = match git(&["rev-list", &format!("HEAD..{amont}"), "--count"], 5) {
        Ok((true, s, _)) => s.parse().unwrap_or(0),
        _ => return false,
    };
    if nb <= 0 {
        println!("[*] Le logiciel est a jour.");
        return false;
    }
    println!("\nMISE A JOUR DISPONIBLE ({nb} nouveau(x) commit(s) sur GitHub)");
    let modifie = matches!(git(&["status", "--porcelain", "-uno"], 5), Ok((_, s, _)) if !s.is_empty());
    let mut reserve = false;
    if modifie {
        println!("  Modifications locales detectees : mise en reserve temporaire...");
        reserve = matches!(git(&["stash", "push", "-m", "Auto-stash WEB_OFFICE avant mise a jour"], 10), Ok((true, _, _)));
    }
    // --ff-only : jamais de fusion ni de rebase silencieux dans le code qu'on va exécuter
    let fusion = git(&["merge", "--ff-only", amont], 120);
    if reserve {
        println!("  Restauration des modifications locales...");
        if let Ok((false, s, e)) = git(&["stash", "pop"], 10) {
            println!("[!] Vos modifications locales n'ont pas pu etre reappliquees automatiquement :");
            println!("    {}", if e.is_empty() { s } else { e });
            println!("    Elles sont conservees dans la reserve Git : voir « git stash list », puis « git stash pop » une fois le conflit resolu.");
        }
    }
    match fusion {
        Ok((true, _, _)) => {
            println!("[*] Mise a jour appliquee.");
            true
        }
        Ok((false, s, e)) => {
            println!("[!] Echec de l'application de la mise a jour : {}", if e.is_empty() { s } else { e });
            println!("[*] Poursuite avec la version actuelle...");
            false
        }
        Err(e) => {
            println!("[!] Echec de l'application de la mise a jour : {e}");
            println!("[*] Poursuite avec la version actuelle...");
            false
        }
    }
}

pub fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let args = match lire_args(&argv) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{USAGE}\noffice: {e}");
            std::process::exit(2);
        }
    };
    if args.aide {
        println!("{USAGE}");
        return;
    }
    let _ = std::env::set_current_dir(racine());
    // --sans-pause : accepté (le catalogue du launcher le passe) ; lancer.bat garde la fenêtre ouverte sous Windows
    let demo = args.demo || std::env::var("CIRCUIT_STORY_DEMO").as_deref() == Ok("1");
    if !args.sans_maj && std::env::var("WEB_OFFICE_DEJA_MAJ").as_deref() != Ok("1") && verifier_et_appliquer_maj() {
        if std::env::var_os("WEB_OFFICE_RELANCEUR").is_some() {
            println!("Nouvelle version installée : relance du jeu…");
            std::process::exit(75);
        }
        println!("  Nouvelle version téléchargée : relancez le jeu pour en profiter.");
    }
    let reseau = !args.local;
    let srv = match Serveur::ouvrir(args.port, reseau, 10) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Aucun port libre entre {} et {} : {e}", args.port, args.port.saturating_add(9));
            std::process::exit(1);
        }
    };
    let _ = GARDE.set(Garde::new("WEB_OFFICE", reseau, None, None));
    garde().brancher(&srv); // en mode réseau : HTTPS sur le même port
    let port = srv.port();
    let dossier = if demo { racine().join("sauvegardes").join("demo") } else { racine().join("sauvegardes") };
    let jeu = fil_du_jeu(dossier, demo);
    let url = format!("http://127.0.0.1:{port}/{}", if demo { "?demo=1" } else { "" });
    println!("Circuit Story{}", if demo { " — mode démo : la partie se joue toute seule" } else { "" });
    println!("  adresse : {url}");
    if port != args.port {
        println!("  (le port {} était occupé)", args.port);
    }
    if reseau {
        for ip in appairage::adresses_poste() {
            println!("  réseau  : {}   (téléphone, autre poste)", garde().adresse(&ip, port));
        }
        println!("            l'autre appareil demande une fois le code d'appairage ci-dessous");
        garde().annoncer();
    }
    println!("  Ctrl+C pour arrêter.\n");
    let _ = std::io::stdout().flush();
    if !args.sans_navigateur {
        ouvrir_navigateur(&url);
    }
    // arrêt par web_launcher (SIGTERM) ou Ctrl+C : la partie est sauvegardée avant de sortir
    let arret = jeu.clone();
    let _ = ctrlc::set_handler(move || {
        let (tx, rx) = mpsc::sync_channel(1);
        if arret.send(Message::Arreter(tx)).is_ok() {
            let _ = rx.recv_timeout(Duration::from_secs(10));
        }
        println!("\nArrêt du serveur.");
        let _ = std::io::stdout().flush();
        std::process::exit(0);
    });
    srv.servir(Arc::new(move |r: &mut Requete| servir(r, &jeu)));
}

#[cfg(test)]
mod essais;
