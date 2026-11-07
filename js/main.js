/**
 * MOTEUR PRINCIPAL
 * Gère le scroll, le compteur, la progression, les apparitions,
 * le système de pages activables (vérification médias au runtime)
 * et le déverrouillage de la page d'entrée scellée.
 */
window.App = {
    // Pages actives après vérification des médias
    _activePages: [],
    _pageCheckComplete: false,
    _currentPageIndex: -1, // page au centre de l'écran (pour les effets)

    init: function() {
        // 1. Vérifier les médias requis pour chaque page
        this.checkPageRequirements().then(() => {
            // 2. Appliquer la visibilité (cacher pages inactives)
            this.applyPageVisibility();
            // 3. Initialiser le reste
            this.setupScroll();
            this.setupIntersectionObserver();
            this.setupPageCounter();
            this.hideScrollHintOnScroll();
            this.updateNextHints();
            // 4. Initialiser les scènes des pages actives seulement
            this.initActiveScenes();
            this._pageCheckComplete = true;
            // 5. Pack d'effets (après les scènes : les hauteurs sont stables)
            if (window.AppEffets) window.AppEffets.init();
        });
    },

    /**
     * Vérifie les fichiers requis pour chaque page définie dans AppConfig.PAGES
     * Retourne une Promise résolue quand toutes les vérifications sont finies (max 5s par fichier)
     */
    checkPageRequirements: function() {
        const pagesConfig = window.AppConfig?.PAGES || [];
        const checks = pagesConfig.map(pageCfg => this.checkPage(pageCfg));
        return Promise.all(checks).then(results => {
            this._activePages = results.filter(r => r.active).map(r => r.id);
            console.log("[App] Pages actives :", this._activePages.join(", "));
        });
    },

    /**
     * Vérifie une page individuelle
     * @param {Object} pageCfg - {id, titre, actif, requis}
     * @returns {Promise<{id: string, active: boolean, missing: string[]}>}
     */
    checkPage: function(pageCfg) {
        const { id, titre, actif, requis } = pageCfg;
        if (!actif) {
            console.warn(`[Page ${id}] désactivée dans la config`);
            return Promise.resolve({ id, active: false, missing: ["config: actif=false"] });
        }

        // Cas spécial : AMIS_NON_VIDE (prérequis logique, pas un fichier)
        if (requis.includes("AMIS_NON_VIDE")) {
            const amis = window.AppConfig?.AMIS || [];
            if (amis.length === 0) {
                console.warn(`[Page ${id}] masquée : prérequis manquant : AMIS non vide`);
                return Promise.resolve({ id, active: false, missing: ["AMIS (array vide)"] });
            }
            return Promise.resolve({ id, active: true, missing: [] });
        }

        // Page sans média requis : toujours active
        if (requis.length === 0) {
            return Promise.resolve({ id, active: true, missing: [] });
        }

        // Vérifier chaque fichier requis avec timeout 5s
        const fileChecks = requis.map(filePath => this.checkFile(filePath, 5000));

        return Promise.all(fileChecks).then(results => {
            const missing = results.filter(r => !r.ok).map(r => r.path);
            const active = missing.length === 0;
            if (!active) {
                console.warn(`[Page ${id}] masquée : fichier(s) manquant(s) : ${missing.join(", ")}`);
            }
            return { id, active, missing };
        });
    },

    /**
     * Teste si un fichier média charge réellement
     * @param {string} path - chemin relatif
     * @param {number} timeoutMs - timeout en ms
     * @returns {Promise<{path: string, ok: boolean}>}
     */
    checkFile: function(path, timeoutMs) {
        return new Promise(resolve => {
            const ext = path.split(".").pop().toLowerCase();
            let testElement;
            let settled = false;

            const finish = (ok) => {
                if (settled) return;
                settled = true;
                resolve({ path, ok });
            };

            const timeout = setTimeout(() => finish(false), timeoutMs);

            if (["jpeg", "jpg", "png", "webp", "gif"].includes(ext)) {
                // Image : test via new Image() (onload / onerror)
                testElement = new Image();
                testElement.onload = () => { clearTimeout(timeout); finish(true); };
                testElement.onerror = () => { clearTimeout(timeout); finish(false); };
                testElement.src = path;
            } else if (["mp4", "webm", "ogg"].includes(ext)) {
                // Vidéo : test via createElement('video') + loadedmetadata / error
                testElement = document.createElement("video");
                testElement.preload = "metadata";
                testElement.onloadedmetadata = () => { clearTimeout(timeout); finish(true); };
                testElement.onerror = () => { clearTimeout(timeout); finish(false); };
                testElement.src = path;
            } else if (["mp3", "wav", "ogg", "m4a"].includes(ext)) {
                // Audio : test via new Audio() + canplay / error
                testElement = new Audio();
                testElement.preload = "auto";
                testElement.oncanplay = () => { clearTimeout(timeout); finish(true); };
                testElement.onerror = () => { clearTimeout(timeout); finish(false); };
                testElement.src = path;
            } else {
                // Extension inconnue : tentative fetch HEAD
                fetch(path, { method: "HEAD" })
                    .then(r => { clearTimeout(timeout); finish(r.ok); })
                    .catch(() => { clearTimeout(timeout); finish(false); });
            }
        });
    },

    /**
     * Liste les éléments DOM des pages actives (dans l'ordre du flux)
     */
    getActivePageElements: function() {
        return Array.from(document.querySelectorAll(".page"))
            .filter(p => !p.hidden && p.style.display !== "none");
    },

    /**
     * Applique la visibilité : cache les pages inactives (hidden + aria-hidden + display:none)
     * et retire leur scroll-snap
     */
    applyPageVisibility: function() {
        const allPages = document.querySelectorAll(".page");
        allPages.forEach(page => {
            const isActive = this._activePages.includes(page.id);
            if (!isActive) {
                page.hidden = true;
                page.setAttribute("aria-hidden", "true");
                page.style.display = "none";
                page.style.scrollSnapAlign = "none";
            }
        });
    },

    /**
     * Met à jour les liens "SUIVANT" pour pointer vers la page active suivante.
     * Le titre de la page suivante est lu depuis AppConfig.PAGES (source unique).
     */
    updateNextHints: function() {
        // Carte id -> titre, depuis la config (toujours fiable)
        const titlesById = {};
        (window.AppConfig?.PAGES || []).forEach(p => { titlesById[p.id] = p.titre; });

        const pageElements = this.getActivePageElements();

        pageElements.forEach((page, index) => {
            const nextHint = page.querySelector(".next-hint");
            if (!nextHint) return;

            if (index < pageElements.length - 1) {
                const nextPage = pageElements[index + 1];
                // Titre depuis PAGES config, fallback sur l'id si absent
                const nextTitle = titlesById[nextPage.id] || nextPage.id.replace("page-", "Page ");
                nextHint.innerHTML = `SUIVANT : ${nextTitle.toUpperCase()} <div class="next-arrow"></div>`;
            } else {
                // Dernière page active : masquer le hint
                nextHint.style.display = "none";
            }
        });
    },

    /**
     * Initialise seulement les scènes des pages actives
     */
    initActiveScenes: function() {
        const sceneMap = {
            "page-0": "initPage0",
            "page-1": "initPage1",
            "page-2": "initPage2",
            "page-3": "initPage3",
            "page-4": "initPage4",
            "page-5": "initPage5",
            "page-6": "initPage6",
            "page-7": "initPage7",
            "page-8": "initPage8",
            "page-9": "initPage9",
            "page-10": "initPage10"
        };

        this._activePages.forEach(pageId => {
            const fnName = sceneMap[pageId];
            if (fnName && window.AppScenes[fnName]) {
                try {
                    window.AppScenes[fnName]();
                } catch (e) {
                    console.error(`[App] Erreur init ${fnName}:`, e);
                }
            }
        });
    },

    setupScroll: function() {
        const container = document.getElementById("main-container");
        const progress = document.getElementById("global-progress");

        container.addEventListener("scroll", () => {
            const scrollPos = container.scrollTop;
            const totalHeight = container.scrollHeight - container.clientHeight;
            const percent = totalHeight > 0 ? (scrollPos / totalHeight) * 100 : 0;
            // Remplissage par transform (jamais d'animation de width).
            progress.style.transform = `scaleX(${percent / 100})`;

            this.updateCounter();
        });
    },

    setupPageCounter: function() {
        this.updateCounter();
    },

    /**
     * Compteur POSITIONNEL : le numéro affiché correspond à la page
     * qui occupe le centre de l'écran. Fonctionne avec des pages de hauteurs
     * différentes et avec les pages cachées (exclues de la numérotation).
     */
    updateCounter: function() {
        const container = document.getElementById("main-container");
        const counter = document.getElementById("page-counter");
        if (!container || !counter) return;

        const activePageElements = this.getActivePageElements();
        // Point de référence : le centre de l'écran (en position absolue du flux)
        const centerPos = container.scrollTop + container.clientHeight / 2;

        let activeIndex = 0;
        activePageElements.forEach((p, i) => {
            // Position du haut de la page dans le flux (inclut le scroll actuel)
            const topInFlow = p.getBoundingClientRect().top + container.scrollTop;
            if (centerPos >= topInFlow) activeIndex = i;
        });

        counter.innerText = `${(activeIndex + 1).toString().padStart(2, '0')} / ${activePageElements.length.toString().padStart(2, '0')}`;

        // Prévient les effets (barre colorée, arrêt audio page 6, etc.)
        // seulement quand la page au centre change réellement.
        if (this._currentPageIndex !== activeIndex) {
            this._currentPageIndex = activeIndex;
            const pageCourante = activePageElements[activeIndex];
            document.dispatchEvent(new CustomEvent("app:pagechange", {
                detail: {
                    index: activeIndex,
                    total: activePageElements.length,
                    pageId: pageCourante ? pageCourante.id : null
                }
            }));
        }
    },

    setupIntersectionObserver: function() {
        const options = { threshold: 0.2 };
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        }, options);

        // Observer seulement les .reveal des pages actives
        this._activePages.forEach(pageId => {
            const page = document.getElementById(pageId);
            if (page) {
                page.querySelectorAll(".reveal").forEach(el => this.observer.observe(el));
            }
        });
    },

    observeElement: function(el) {
        // N'observe que si l'élément appartient à une page active
        const page = el.closest(".page");
        if (page && page.hidden) {
            return; // Page cachée : ne pas observer
        }
        if (this.observer) {
            this.observer.observe(el);
        }
    },

    /**
     * Branche le bouton fixe de la musique de fond.
     * Un seul bouton : MUSIQUE -> MUET -> MUSIQUE.
     */
    initMusicToggle: function() {
        const btn = document.getElementById("btn-music-toggle");
        if (!btn) return;
        if (btn.dataset.musicToggleBound === "true") return;
        btn.dataset.musicToggleBound = "true";

        const label = btn.querySelector(".music-toggle-label");

        const synchroniser = () => {
            const coupe = !!window.AppAudio?.isMusicMuted;
            btn.classList.toggle("est-muet", coupe);
            btn.setAttribute("aria-pressed", coupe ? "true" : "false");
            btn.setAttribute("aria-label", coupe ? "Rétablir la musique de fond" : "Couper la musique de fond");
            if (label) label.textContent = coupe ? "MUET" : "MUSIQUE";
        };

        btn.addEventListener("click", () => {
            window.AppAudio?.toggleMusic?.();
            synchroniser();
        });

        document.addEventListener("app:musicstate", synchroniser);
        synchroniser();
    },

    /**
     * Cache la flèche "Fais défiler ↓" après le premier scroll
     */
    hideScrollHintOnScroll: function() {
        const container = document.getElementById("main-container");
        const scrollHint = document.querySelector(".scroll-hint");
        if (!scrollHint) return;

        let hasScrolled = false;
        container.addEventListener("scroll", () => {
            if (!hasScrolled && container.scrollTop > 50) {
                hasScrolled = true;
                scrollHint.style.opacity = "0";
                scrollHint.style.pointerEvents = "none";
                scrollHint.style.transition = "opacity 0.5s ease";
            }
        }, { once: false });
    },

    initScenes: function() {
        // Gardé pour compatibilité, mais initActiveScenes est utilisé à la place
        this.initActiveScenes();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.AppAudio.init();
    window.App.init();
    window.App.initMusicToggle();

    // === PAGE D'ENTRÉE SCELLÉE (gate) ===
    // Si présente dans le DOM, on l'active : c'est la première chose visible.
    // Le magazine reste dessous (body.entry-lock), on ne peut pas scroller.
    // Le clic dans la gate appelle window.AppScenes via scenes.js (initEntry).
    if (document.getElementById("page-entry")) {
        window.AppScenes.initEntry();
    }

    // Confettis page 1 (révélation) - seulement si page active
    // (vérifie après la fin de la vérification des médias)
    const startPage1Observer = () => {
        if (!window.App._activePages.includes("page-1")) return;
        const page1 = document.getElementById("page-1");
        if (!page1) return;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    window.AppScenes._spawnConfetti(page1);
                    obs.disconnect();
                }
            });
        }, { threshold: 0.5 });
        obs.observe(page1);
    };

    // Attendre que la vérification des pages soit terminée
    const waitForCheck = () => {
        if (window.App._pageCheckComplete) {
            startPage1Observer();
        } else {
            setTimeout(waitForCheck, 100);
        }
    };
    waitForCheck();
});