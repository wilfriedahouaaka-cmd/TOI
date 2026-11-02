/**
 * CONFIGURATION DU MAGAZINE
 * Centralisation de toutes les données et textes.
 */
window.AppConfig = {
    // Musique de fond (celle qui joue sur TOUT le site,
    // au décachetage du magazine puis pendant toute la lecture)
    MUSIQUE: "assets/audio/Happy-Birthday.mp3",
    VOLUME_MUSIQUE: 0.30,

    // --- PACK D'EFFETS (lots 1 et 2) ---
    // Chaque effet est indépendant. Mettre false pour le désactiver.
    // Le site reste complet et beau sans aucun effet.
    // prefers-reduced-motion réduit tout automatiquement (JS + CSS).
    EFFETS: {
        // Lot 1
        feuillesEmpilees: true, // pages courtes en sticky (glissement de feuilles)
        bandeaux: true,         // bandeaux jaunes défilants entre les pages
        barreCouleur: true,     // barre du haut corail / jaune / turquoise
        // Lot 2
        titresClaquent: true,   // titres Anton : glissement + lettres de CHIOMA
        autocollants: true,     // autocollants (rebond), polaroïds (pose), ruban
        confettis: true         // éclat de 30 confettis sur la page 1
    },

    // --- PAGE D'ENTRÉE : QUIZ DU SCEAU ---
    // La gate pose 3 questions AVANT de décacheter.
    // Règle importante : AUCUNE question sur la date de naissance de Chioma
    // (Wilfried ne la connaît pas). Les bonnes réponses sont des infos
    // qu'il maîtrise à 100 % : son prénom, la nature du cadeau, la date fixée.
    ENTRY_QUIZ: {
        // *** INTERRUPTEUR DE PHASE TEST ***
        // false = phase de tests : une fois le quiz réussi, le magazine
        //         S'OUVRE IMMÉDIATEMENT (Wilfried peut tout parcourir).
        // true  = comportement FINAL : après le quiz, le sceau reste levé
        //         seulement à partir du 30 novembre 2026 à minuit
        //         (sinon compte à rebours affiché).
        // ⚠️ MÉMO : à remettre sur true UNIQUEMENT quand Wilfried écrit
        //    « FINALISE LE SITE » (voir docs/suivi.md).
        DATE_LOCK_ACTIVE: false,

        // Date à laquelle le sceau se lève réellement (00h00 heure locale),
        // utilisée SEULEMENT quand DATE_LOCK_ACTIVE = true.
        DATE_DEVOILEMENT: "2026-11-30", // 30 novembre 2026

        // Nombre de mauvaises réponses tolérées avant le voile de refus
        MAX_TENTATIVES: 3,

        // Les 3 questions, dans l'ordre. "bonne" = texte exact du bon choix.
        // L'ordre d'affichage des choix est mélangé automatiquement par le JS.
        QUESTIONS: [
            {
                question: "Qui t'a envoyé ce lien ?",
                choices: ["Wilfried", "Google", "Maman"],
                bonne: "Wilfried"
            },
            {
                question: "Pourquoi ce magazine est scellé ?",
                choices: ["Un cadeau caché", "Une erreur d'archive", "Un livre perdu"],
                bonne: "Un cadeau caché"
            },
            {
                question: "À quelle date le sceau se lève ?",
                choices: ["30 novembre 2026", "25 décembre 2026", "1er janvier 2027"],
                bonne: "30 novembre 2026"
            }
        ],

        // Message affiché quand elle donne 3 mauvaises réponses
        // (voile sombre sur la gate, avec le rappel du rendez-vous + blague)
        MESSAGE_REFUS: "On dirait bien que tu ne connais pas ta propre fête… Ce sceau se lève le 30 novembre 2026. Reprends tes esprits. 😉",

        // Petit message de piste quand elle se trompe (tentatives 1 et 2)
        MESSAGE_TENTATIVE: "Mauvaise piste… Le magazine reste scellé.",

        // Compliment quand une réponse est juste
        MESSAGE_JUSTE: "Bonne réponse.",

        // Compte à rebours (affiché si le quiz est réussi AVANT le jour J)
        COMPTE_A_REBOURS: {
            titre: "Cadenas armé",
            sous_titre: "Le sceau se lève dans",
            legende: "Ouverture le 30 novembre 2026",
            unites: ["j", "h", "min", "sec"]
        }
    },

    // Photos A (Le Dossier)
    PHOTOS_A: [
        { src: "assets/photos/p4.jpeg", legende: "Un sourire." },
        { src: "assets/photos/p6.jpeg", legende: "Une présence." },
        { src: "assets/photos/p3.jpeg", legende: "De la lumière." },
    ],

    // Photos B (Tri-pli)
    PHOTOS_B: [
        { src: "assets/photos/p5.jpeg", legende: "Un instant." },
        { src: "assets/photos/p1.jpeg", legende: "Un éclat." },
        { src: "assets/photos/p7.jpeg", legende: "Un regard." },
    ],

    // Photo C (Pleine page)
    PHOTO_C: {
        src: "assets/photos/p3.jpeg",
        citation: "Toi, simplement."
    },

    // --- PAGE 6 : Ses Goûts ---
    GOUTS: {
        anime: {
            titre: "Black Clover",
            personnage: "Asta",
            description: "Sans magie dans un monde où tout est magie, il ne lâche rien. Sa force ? Une détermination brute qui finit par plier la réalité.",
            // Photo de l'univers anime (dossier assets/univers/)
            image: "assets/univers/univers-anime.jpeg"
        },
        serie: {
            titre: "True Beauty",
            description: "Le masque du maquillage, la peur du regard des autres, et ce moment où on choisit de se montrer tel qu'on est. Drôle, touchant, vrai.",
            // Photo de la série (dossier assets/univers/)
            image: "assets/univers/univers-serie.jpeg"
        }
    },

    // --- PAGE 6 : LES DISQUETTES (DANS SES OREILLES) ---
    // Tous les disques sont libres dès le départ : aucun verrou, aucun ordre.
    // « Écouté » = 10 secondes de lecture cumulées OU fin du son
    // (traces persistées dans localStorage "disquettes_ok").
    // Le BONUS se révèle quand tous les disques d'artistes sont écoutés.
    // Un disque au son introuvable (« SON INDISPONIBLE ») compte comme écouté.
    // Une seule disquette joue à la fois ; re-tap = pause / reprise ; la
    // musique de fond se met en pause et reprend (pause, fin, sortie de page).
    DISQUETTES: {
        consigne: "Touche un disque pour l'écouter.",
        bonus_revelation: "Tu as tout écouté. Celle-ci, c'est la dernière. Juste pour toi.",
        DISQUES: [
            {
                id: "meitod",
                artiste: "Meiitod",
                titre: "Éternité",
                src: "assets/audio/disquettes/disquette-meitod.mp3",
                image: "assets/univers/artiste-meitod.jpeg"
            },
            {
                id: "joe-dwet-file",
                artiste: "Joé Dwèt Filé",
                titre: "Slowly",
                src: "assets/audio/disquettes/disquette-joe-dwet-file.mp3",
                image: "assets/univers/artiste-joe-dwet-file.jpeg"
            },
            {
                id: "dadju",
                artiste: "Dadju",
                titre: "Reine",
                src: "assets/audio/disquettes/disquette-dadju.mp3",
                image: "assets/univers/artiste-dadju.jpeg"
            },
            {
                id: "kiff-no-beat",
                artiste: "Kiff No Beat",
                titre: "C Komen",
                src: "assets/audio/disquettes/disquette-kiff-no-beat.mp3",
                image: "assets/univers/artiste-kiff-no-beat.jpeg"
            }
        ],
        // La disquette bonus : cachée jusqu'à ce que les 4 disques
        // d'artistes soient écoutés (ou comptés comme écoutés en erreur).
        BONUS: {
            id: "bonus",
            artiste: "EMKA DREAM",
            titre: "Juste pour toi",
            src: "assets/audio/disquettes/bonus-emka-dream.mp3",
            sans_image: true // pas de photo : le mystère fait partie du bonus
        }
    },

    // --- PAGE 7 : Elle se décrit ---
    MOTS_ELLE: ["Sensible.", "Entière.", "Ambitieuse."],

    // --- PAGE 8 : Ils parlent de toi ---
    // Structure : { prenom, initiale, message, audio }
    // audio: chemin vers le fichier vocal (optionnel pour tests)
    AMIS: [
        // Exemple à remplir :
        // { prenom: "Marie", initiale: "M", message: "Tu es une lumière...", audio: "assets/audio/voix/ami1.mp3" },
        // { prenom: "Thomas", initiale: "T", message: "Ton énergie...", audio: "assets/audio/voix/ami2.mp3" },
    ],

    // --- PAGE 9 : En Vidéo ---
    // Vignettes cliquables : aucune lecture automatique.
    // Chaque vidéo s'ouvre en fenêtre modale (avec le son) au tap.
    // Option "poster" : chemin d'une image fixe à afficher sur la vignette
    // à la place de la première image de la vidéo. Exemple :
    // { src: "assets/videos/v1.mp4", poster: "assets/vignettes/v1-poster.jpeg", ... }
    // v1, v3 = paysage (inclinés + ruban), v2 = portrait
    VIDEOS: [
        { src: "assets/videos/v1.mp4", orientation: "landscape", tilted: true, hasTape: true },
        { src: "assets/videos/v3.mp4", orientation: "landscape", tilted: true, hasTape: true },
        { src: "assets/videos/v2.mp4", orientation: "portrait", tilted: false, hasTape: false },
    ],

    // --- PAGE 10 : Quatrième de Couverture ---
    BACK_COVER: {
        lines: [
            "Chioma,",
            "On se connaît encore peu…",
            "Que cette année t'apporte tout ce que tu mérites.",
            "Joyeux anniversaire.",
            "— Wilfried"
        ],
        whatsapp: {
            numero: "2250143928168",
            message: "Merci pour la surprise 🎂"
        }
    },

    // --- SYSTÈME DE PAGES ACTIVABLES ---
    // Un objet par page dans l'ordre du scénario.
    // "requis" = liste des chemins de fichiers sans lesquels la page ne doit pas s'afficher.
    // La musique de fond n'est PAS un prérequis (le site marche en silence).
    // Les pages sans média requis sont toujours actives.
    // "actif" = true par défaut, sera mis à false au runtime si un fichier requis manque.
    // Page 6 : les sons des disquettes ne sont PAS en prérequis (si un son
    // manque, seules les disquettes concernées affichent un état d'erreur,
    // la page reste visible).
    PAGES: [
        {
            id: "page-0",
            titre: "Couverture",
            actif: true,
            requis: ["assets/photos/p1.jpeg"]
        },
        {
            id: "page-1",
            titre: "Révélation",
            actif: true,
            requis: []
        },
        {
            id: "page-2",
            titre: "Édito",
            actif: true,
            requis: []
        },
        {
            id: "page-3",
            titre: "Le Dossier (A)",
            actif: true,
            requis: ["assets/photos/p4.jpeg", "assets/photos/p6.jpeg", "assets/photos/p3.jpeg"]
        },
        {
            id: "page-4",
            titre: "Tri-pli (B)",
            actif: true,
            requis: ["assets/photos/p5.jpeg", "assets/photos/p1.jpeg", "assets/photos/p7.jpeg"]
        },
        {
            id: "page-5",
            titre: "Pleine Page (C)",
            actif: true,
            requis: ["assets/photos/p3.jpeg"]
        },
        {
            id: "page-6",
            titre: "Ses Goûts",
            actif: true,
            requis: []
        },
        {
            id: "page-7",
            titre: "Elle se décrit",
            actif: true,
            requis: []
        },
        {
            id: "page-8",
            titre: "Ils parlent de toi",
            actif: true,
            requis: ["AMIS_NON_VIDE"]
        },
        {
            id: "page-9",
            titre: "En Vidéo",
            actif: true,
            requis: ["assets/videos/v1.mp4", "assets/videos/v3.mp4", "assets/videos/v2.mp4"]
        },
        {
            id: "page-10",
            titre: "Quatrième de Couverture",
            actif: true,
            requis: []
        }
    ]
};

// --- AVERTISSEMENT EN CONSOLE (MODE TEST) ---
// Si le verrou de date est désactivé, on prévient Wilfried dès le chargement
// de la page. Comme ça, il ne peut pas oublier de le réactiver avant d'envoyer
// le lien à Chioma (mot-clé de finalisation : « FINALISE LE SITE »).
if (!window.AppConfig.ENTRY_QUIZ.DATE_LOCK_ACTIVE) {
    console.warn("ATTENTION : verrou de date DÉSACTIVÉ (mode test)");
}
