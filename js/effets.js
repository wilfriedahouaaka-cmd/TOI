/**
 * PACK D'EFFETS — LOTS 1 ET 2
 *
 * LOT 1
 * 1. Feuilles empilées  : pages courtes en position sticky
 * 2. Bandeaux défilants : affichés / masqués selon la config
 * 3. Barre colorée      : corail / jaune / turquoise selon la page
 *
 * LOT 2
 * 4. Titres qui claquent : glissement des titres Anton + chute des
 *                          lettres de CHIOMA (60 ms entre chaque)
 * 5. Autocollants        : rebond scale 0.6 -> 1.08 -> 1
 * 6. Polaroïds + ruban   : pose avec rotation, ruban qui se colle
 * 7. Confettis           : éclat plafonné à 30 pièces (scenes.js)
 *
 * Source de vérité : window.AppConfig.EFFETS (js/config.js).
 * Tout est coupé si l'utilisateur préfère réduire les animations
 * (prefers-reduced-motion). Aucun effet ne touche au contenu.
 *
 * Règle de charge : 3 GROUPES d'effets maximum en même temps.
 * Un groupe = un titre, un autocollant, un polaroïd ou l'éclat de
 * confettis. Les 6 lettres de CHIOMA et les 30 confettis comptent
 * chacun pour UN groupe : ils sont indissociables.
 */
window.AppEffets = {
    _initialise: false,   // init() ne s'exécute qu'une fois
    _reduit: false,       // prefers-reduced-motion actif ?
    _mqReduit: null,      // MediaQueryList
    _couleurActive: false,// la barre suit-elle la page ?
    _raf: 0,              // mesure replanifiée (requestAnimationFrame)

    // --- LOT 2 ---
    _lot2Initialise: false,      // observateur du lot 2 déjà branché ?
    _observateurLot2: null,      // IntersectionObserver des effets d'entrée
    _maxGroupes: 3,              // 3 groupes d'effets maximum à l'écran
    _groupesActifs: 0,           // groupes en cours
    _fileGroupes: [],            // groupes en attente

    /**
     * Branche les écouteurs et applique les effets.
     * Appelé par main.js une fois les pages actives connues.
     */
    init: function() {
        if (this._initialise) return;
        this._initialise = true;

        this._mqReduit = window.matchMedia("(prefers-reduced-motion: reduce)");
        this._reduit = this._mqReduit.matches;

        // Réagir si la préférence système change en cours de visite.
        const surChangement = () => {
            this._reduit = this._mqReduit.matches;
            if (this._reduit) this._fileGroupes = [];
            this.appliquer();
        };
        if (typeof this._mqReduit.addEventListener === "function") {
            this._mqReduit.addEventListener("change", surChangement);
        } else if (typeof this._mqReduit.addListener === "function") {
            // Anciens navigateurs (Safari < 14)
            this._mqReduit.addListener(surChangement);
        }

        // La couleur suit la page visible (événement émis par main.js).
        document.addEventListener("app:pagechange", () => this.majCouleur());

        // La gate peut rester fermée un moment : on attend son ouverture
        // pour que les effets de la couverture soient vus au bon moment.
        document.addEventListener("app:magazineopen", () => this.initierLot2());

        // Re-mesurer après un redimensionnement, une rotation,
        // le chargement complet et l'arrivée des polices.
        const replanifier = () => this.replanifier();
        window.addEventListener("resize", replanifier);
        window.addEventListener("orientationchange", replanifier);
        window.addEventListener("load", replanifier);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => this.appliquer());
        }

        this.appliquer();
    },

    /**
     * Un effet est actif sauf si son booléen vaut explicitement false.
     * (Un oubli dans config.js laisse donc l'effet actif.)
     */
    actif: function(nom) {
        const reglages = (window.AppConfig && window.AppConfig.EFFETS) || {};
        return reglages[nom] !== false;
    },

    /**
     * Préférence système, lisible même avant init().
     * Utile à scenes.js qui prépare les polaroïds avant AppEffets.init().
     */
    mouvementReduit: function() {
        if (this._mqReduit) return this._mqReduit.matches;
        return !!(window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    },

    /** Regroupe les mesures dans une seule frame (évite les à-coups). */
    replanifier: function() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this.appliquer();
        });
    },

    /** Applique (ou retire) les effets d'un coup. */
    appliquer: function() {
        const mouvementReduit = this._reduit;

        this.appliquerFeuilles(!mouvementReduit && this.actif("feuillesEmpilees"));
        this.appliquerBandeaux(!mouvementReduit && this.actif("bandeaux"));
        this.appliquerCouleur(!mouvementReduit && this.actif("barreCouleur"));

        if (mouvementReduit) {
            this._fileGroupes = [];
        } else {
            this.initierLot2();
        }
    },

    /* ============================================================
       LOT 2 — OBSERVATEUR COMMUN
       ============================================================ */

    /**
     * Prépare l'observateur du lot 2 puis pose les états de départ.
     * Ne fait rien si l'utilisateur préfère réduire les animations,
     * si IntersectionObserver manque, ou si la gate est encore fermée.
     */
    initierLot2: function() {
        if (this._lot2Initialise) return;
        if (this._reduit || this.mouvementReduit()) return;
        if (typeof IntersectionObserver !== "function") return;

        // La couverture est derrière la gate : on attend l'ouverture
        // pour ne pas jouer ses effets dans le vide.
        const gate = document.getElementById("page-entry");
        if (gate && document.body.classList.contains("entry-lock")) return;

        this._lot2Initialise = true;

        this._observateurLot2 = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;

                // Si la préférence vient de changer, on laisse l'élément
                // observer : il sera animé si l'utilisateur réactive plus tard.
                if (this._reduit) return;

                this._observateurLot2.unobserve(el);
                this._declencherEffet(el);
            });
        }, { threshold: 0.3 });

        try {
            this._preparerTitres();
            this._preparerAutocollants();
            this._preparerPolaroids();
        } catch (erreur) {
            console.warn("[AppEffets] Préparation du lot 2 impossible :", erreur);
        }
    },

    /** Aiguille l'élément observé vers le bon effet. */
    _declencherEffet: function(el) {
        const type = el.dataset.effetLot2;
        if (!type) return;

        if (type === "titre") {
            this.programmerGroupe(() => {
                el.classList.add("titre-claque");
            }, 600, el);
            return;
        }

        if (type === "lettres") {
            this.programmerGroupe(() => {
                el.querySelectorAll(".lettre").forEach((lettre) => {
                    lettre.classList.add("lettre-tombe");
                });
            }, 750, el);
            return;
        }

        if (type === "autocollant") {
            this.programmerGroupe(() => {
                el.classList.add("autocollant-rebond");
            }, 550, el);
            return;
        }

        if (type === "polaroid") {
            this.programmerGroupe(() => {
                el.classList.add("polaroid-pose");
            }, 750, el);
        }
    },

    /* ============================================================
       LOT 2 — PRÉPARATION DES ÉLÉMENTS
       ============================================================ */

    /**
     * Titres Anton.
     * - .masthead et .reveal-name : les deux « CHIOMA », lettres une à une.
     * - .reveal-bday, .gout-title, .mot-word : glissement gauche/droite.
     * Le .masthead de la couverture et le .reveal-name de la page 1
     * sont les seuls mots découpés : le reste de la page n'est pas touché.
     */
    _preparerTitres: function() {
        if (!this.actif("titresClaquent")) return;

        document.querySelectorAll(".masthead, .reveal-name").forEach((el) => {
            if (el.dataset.effetLot2) return;
            el.dataset.effetLot2 = "lettres";
            this._decouperLettres(el);
            if (this._observateurLot2) this._observateurLot2.observe(el);
        });

        const titres = document.querySelectorAll(".reveal-bday, .gout-title, .mot-word");
        titres.forEach((el, index) => {
            if (el.dataset.effetLot2) return;
            el.dataset.effetLot2 = "titre";
            el.classList.add("titre-a-claquer");
            // Alterne gauche / droite pour éviter un bloc uniforme.
            if (index % 2 === 1) el.classList.add("depuis-droite");
            if (this._observateurLot2) this._observateurLot2.observe(el);
        });
    },

    /**
     * Découpe le texte visible en lettres animables.
     * Une copie .sr-only garde le mot lisible par les lecteurs d'écran ;
     * la copie visuelle est aria-hidden pour éviter l'épellation.
     */
    _decouperLettres: function(el) {
        if (el.classList.contains("lettres-preparees")) return;

        const texte = (el.textContent || "").trim();
        if (!texte) return;

        el.textContent = "";

        const lecteur = document.createElement("span");
        lecteur.className = "sr-only";
        lecteur.textContent = texte;
        el.appendChild(lecteur);

        const visuel = document.createElement("span");
        visuel.className = "lettres-visuelles";
        visuel.setAttribute("aria-hidden", "true");

        Array.from(texte).forEach((caractere, index) => {
            if (caractere === " ") {
                visuel.appendChild(document.createTextNode(" "));
                return;
            }

            const lettre = document.createElement("span");
            lettre.className = "lettre";
            lettre.textContent = caractere;
            lettre.style.setProperty("--delai-lettre", `${index * 60}ms`);
            visuel.appendChild(lettre);
        });

        el.appendChild(visuel);
        el.classList.add("lettres-preparees");
    },

    /**
     * Autocollants statiques : le tag « ÉDITION SPÉCIALE » de la
     * couverture et les tags de la page 6. Le sticker « ÉCOUTÉ » est
     * créé plus tard par scenes.js : il passe par animerAutocollant().
     */
    _preparerAutocollants: function() {
        if (!this.actif("autocollants")) return;

        document.querySelectorAll(".edition-tag, .gout-tag").forEach((el) => {
            if (el.dataset.effetLot2) return;
            el.dataset.effetLot2 = "autocollant";
            el.classList.add("autocollant-a-poser");
            if (this._observateurLot2) this._observateurLot2.observe(el);
        });
    },

    /**
     * Polaroïds préparés par scenes.js : ils portent .polaroid-a-poser
     * quand l'effet est actif. On les observe pour lancer la pose.
     */
    _preparerPolaroids: function() {
        if (!this.actif("autocollants")) return;

        document.querySelectorAll(".brutal-polaroid.polaroid-a-poser").forEach((el) => {
            if (el.dataset.effetLot2) return;
            el.dataset.effetLot2 = "polaroid";
            if (this._observateurLot2) this._observateurLot2.observe(el);
        });
    },

    /**
     * Sticker créé après une écoute (scenes.js).
     * Retour immédiat au doigt : il n'entre pas dans la file d'attente,
     * car il ne dépend pas du scroll et arrive au moins 10 s après
     * l'entrée dans la page 6. Le plafond de 3 groupes concerne les
     * effets d'entrée déclenchés par IntersectionObserver.
     */
    animerAutocollant: function(el) {
        if (!el || this._reduit || this.mouvementReduit()) return;
        if (!this.actif("autocollants")) return;

        el.classList.remove("autocollant-rebond");
        // Force un reflow : l'animation peut ainsi rejouer.
        void el.offsetWidth;
        el.classList.add("autocollant-rebond");
    },

    /* ============================================================
       LOT 2 — ORDONNANCEUR (3 GROUPES MAXIMUM)
       ============================================================ */

    /**
     * Met un groupe en file ou le démarre s'il reste une place.
     * @param {Function} demarrer - pose la classe d'animation
     * @param {number} duree - durée du groupe en ms
     * @param {Element} element - élément à vérifier avant de démarrer
     */
    programmerGroupe: function(demarrer, duree, element) {
        if (this._reduit || this.mouvementReduit()) return;

        const tache = {
            demarrer: demarrer,
            duree: Math.max(0, duree || 0),
            element: element || null
        };

        if (this._groupesActifs >= this._maxGroupes) {
            this._fileGroupes.push(tache);
            return;
        }

        this._demarrerGroupe(tache);
    },

    _demarrerGroupe: function(tache) {
        if (this._reduit) {
            this._groupeSuivant();
            return;
        }

        // Un élément sorti de l'écran pendant l'attente ne joue pas.
        if (tache.element && !this._elementVisible(tache.element)) {
            this._groupeSuivant();
            return;
        }

        this._groupesActifs++;

        try {
            tache.demarrer();
        } catch (erreur) {
            console.warn("[AppEffets] Animation ignorée :", erreur);
        }

        setTimeout(() => {
            this._groupesActifs = Math.max(0, this._groupesActifs - 1);
            this._groupeSuivant();
        }, tache.duree);
    },

    _groupeSuivant: function() {
        if (this._groupesActifs >= this._maxGroupes) return;
        const tache = this._fileGroupes.shift();
        if (tache) this._demarrerGroupe(tache);
    },

    /** Vrai si une partie de l'élément est encore dans l'écran. */
    _elementVisible: function(el) {
        if (!el || !el.isConnected) return false;

        const rect = el.getBoundingClientRect();
        const largeur = window.innerWidth || document.documentElement.clientWidth;
        const hauteur = window.innerHeight || document.documentElement.clientHeight;

        return rect.bottom > 0 &&
            rect.top < hauteur &&
            rect.right > 0 &&
            rect.left < largeur;
    },

    /* ============================================================
       LOT 1 — FEUILLES, BANDEAUX, COULEUR
       ============================================================ */

    /**
     * FEUILLES EMPILÉES
     * On retire d'abord toutes les classes pour mesurer la hauteur
     * réelle (sans sticky), puis on empile seulement les pages qui
     * tiennent dans l'écran. Une page plus haute garde le flux normal :
     * son bas reste accessible, jamais caché sous la feuille suivante.
     */
    appliquerFeuilles: function(actif) {
        const pages = Array.from(document.querySelectorAll(".page"));

        pages.forEach((page) => page.classList.remove("empilee"));
        if (!actif) return;

        const conteneur = document.getElementById("main-container");
        const hauteurEcran = conteneur ? conteneur.clientHeight : window.innerHeight;
        if (!hauteurEcran) return;

        // 2 px de tolérance : les hauteurs calculées peuvent avoir
        // des décimales (100dvh, arrondis de mise en page).
        const tolerance = 2;

        pages.forEach((page) => {
            // Page inactive : hidden + display:none -> hauteur 0, on ignore.
            if (page.hidden) return;
            if (window.getComputedStyle(page).display === "none") return;

            const hauteur = page.getBoundingClientRect().height;
            if (hauteur > 0 && hauteur <= hauteurEcran + tolerance) {
                page.classList.add("empilee");
            }
        });
    },

    /**
     * BANDEAUX DÉFILANTS
     * Ils existent dans index.html (entre les pages) et restent cachés
     * tant que l'effet n'est pas actif. Jamais de création dynamique :
     * ils ne peuvent pas perturber le compteur ni les « SUIVANT ».
     */
    appliquerBandeaux: function(actif) {
        document.querySelectorAll(".bandeau-defilant").forEach((bandeau) => {
            bandeau.hidden = !actif;
        });
    },

    /**
     * BARRE DE PROGRESSION COLORÉE
     * Sans effet : on retire la couleur inline, le corail de base.css
     * reprend. Avec effet : la couleur suit la page au centre.
     */
    appliquerCouleur: function(actif) {
        const barre = document.getElementById("global-progress");
        if (!barre) return;

        this._couleurActive = actif;
        if (!actif) {
            barre.style.backgroundColor = "";
            return;
        }
        this.majCouleur();
    },

    /** Corail -> jaune -> turquoise, en boucle, selon l'index de page. */
    majCouleur: function() {
        if (!this._couleurActive) return;

        const barre = document.getElementById("global-progress");
        if (!barre) return;

        const couleurs = [
            "var(--vivid-coral)",
            "var(--sun-yellow)",
            "var(--bold-turquoise)"
        ];
        const index = (window.App && Number.isInteger(window.App._currentPageIndex))
            ? window.App._currentPageIndex
            : 0;

        barre.style.backgroundColor = couleurs[index % couleurs.length];
    }
};
