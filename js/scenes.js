/**
 * LOGIQUE DES PAGES
 * Gère l'interaction et le rendu des pages du magazine,
 * plus la page d'entrée scellée (gate).
 */
window.AppScenes = {

    /* ============================================================
       PAGE D'ENTRÉE "SCELLÉE" (Gate) + QUIZ DU SCEAU
       Parcours :
       1) 3 questions (config.js ENTRY_QUIZ), choix mélangés ;
       2) mauvaise réponse -> secousse + message, 3 échecs -> voile de refus ;
       3) quiz réussi :
          - avant le jour J -> cadenas armé + compte à rebours,
          - jour J (30 novembre 2026) ou après -> bouton d'ouverture ;
       4) tap -> musique + décachetage + ouverture du magazine.
       Aucune question sur la date de naissance (info non maîtrisée).
       ============================================================ */
    initEntry: function() {
        const overlay = document.getElementById("page-entry");
        const card = document.getElementById("sealed-magazine");
        const lockBadge = overlay ? overlay.querySelector(".entry-lock-badge") : null;
        const quizBox = document.getElementById("entry-quiz");
        const progressEl = document.getElementById("quiz-progress");
        const questionEl = document.getElementById("quiz-question");
        const choicesEl = document.getElementById("quiz-choices");
        const feedbackEl = document.getElementById("quiz-feedback");
        const btn = document.getElementById("open-trigger");
        const countdownBox = document.getElementById("entry-countdown");
        const veil = document.getElementById("entry-veil");
        const veilText = document.getElementById("veil-text");
        const quizCfg = window.AppConfig?.ENTRY_QUIZ;

        // Sécurité : sans la gate ou la config du quiz, on ne branche rien
        if (!overlay || !card || !quizBox || !quizCfg) return;

        // --- État interne du quiz ---
        let questionIndex = 0;      // question courante (0, 1, 2)
        let wrongCount = 0;         // mauvaises réponses cumulées
        let busy = false;           // bloque les clics pendant une transition
        let countdownTimer = null;  // interval du compte à rebours

        /* ---------------------------------------------------------
           Ouverture finale du magazine (musique + décachetage + fondu)
           Reprise de l'ancien comportement, SAUF l'arrivée : après le
           fondu de la gate, on passe par la page intermédiaire
           (note de l'éditeur) avant de déverrouiller le magazine.
           --------------------------------------------------------- */
        const openMagazine = () => {
            // Empêche tout double déclenchement (double-tap, Entrée + clic)
            if (document.body.classList.contains("entry-lock") === false && overlay.classList.contains("hidden")) return;

            // 1. Lancer la musique de fond (robuste : rien si fichier absent)
            window.AppAudio.playMusic();

            // 2. Micro-animation de décachetage
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (!reduced) {
                card.classList.add("unsealing");
                setTimeout(() => card.classList.remove("unsealing"), 200);
            }

            // 3. Transition : fondu de l'overlay, puis bascule
            const fadeDelay = reduced ? 50 : 250;
            setTimeout(() => {
                overlay.classList.add("closing");
                setTimeout(() => {
                    overlay.classList.add("hidden");
                    const intro = document.getElementById("page-intro");
                    if (intro) {
                        showIntro(intro, reduced); // page intermédiaire (note de l'éditeur)
                    } else {
                        finishOpening(); // filet de sécurité si la section manque
                    }
                }, 450); // durée de la transition opacity du CSS
            }, fadeDelay);
        };

        /* ---------------------------------------------------------
           Page intermédiaire : la note se soulève, les lignes
           apparaissent une à une, puis le bouton Continuer
           (ou un tap n'importe où sur la page). Un auto-continue
           à 12s garantit qu'elle ne reste jamais bloquée.
           --------------------------------------------------------- */
        let introFinished = false;   // garde anti double-tap
        let introTimers = [];        // tous les timers annulables de la séquence

        const finishOpening = () => {
            if (introFinished) return;
            introFinished = true;
            introTimers.forEach(clearTimeout);
            introTimers = [];

            // Disparition douce de la page intermédiaire
            const intro = document.getElementById("page-intro");
            if (intro && !intro.hidden) {
                intro.classList.add("fading");
                setTimeout(() => {
                    intro.hidden = true;
                    intro.classList.remove("fading");
                }, 450);
            }

            // Déverrouillage du magazine : body sans "entry-lock"
            document.body.classList.remove("entry-lock");

            // Prévient les effets (lot 2) : la couverture peut maintenant
            // jouer ses animations, elle n'est plus cachée par la gate.
            document.dispatchEvent(new CustomEvent("app:magazineopen"));

            const container = document.getElementById("main-container");
            if (container) container.scrollTop = 0;
            window.App.updateCounter();
        };

        const showIntro = (intro, reduced) => {
            intro.hidden = false;
            const page = document.getElementById("intro-page");
            const lines = intro.querySelectorAll(".intro-line, .intro-signature");
            const contBtn = document.getElementById("intro-continue");

            // Réinitialisation propre (si la page intermédiaire est rejouée)
            lines.forEach(l => l.classList.remove("visible"));
            if (page) page.classList.remove("lift");
            if (contBtn) contBtn.hidden = true;

            // 1. La page se soulève (sauf prefers-reduced-motion)
            if (!reduced && page) {
                introTimers.push(setTimeout(() => page.classList.add("lift"), 50));
            } else if (page) {
                page.classList.add("lift"); // placement final sans animation
            }

            // 2. Lignes une à une (0,7s d'écart ; quasi instantané si reduced)
            const step = reduced ? 100 : 700;
            lines.forEach((line, i) => {
                introTimers.push(setTimeout(() => line.classList.add("visible"), 600 + i * step));
            });

            // 3. Bouton Continuer une fois la note complète
            introTimers.push(setTimeout(() => {
                if (contBtn) contBtn.hidden = false;
            }, 600 + lines.length * step + 300));

            // 4. Filet de sécurité : auto-continuation 12s après l'arrivée
            introTimers.push(setTimeout(finishOpening, 12000));

            // 5. Un tap n'importe où sur la page (ou le bouton) = avancer
            intro.addEventListener("click", finishOpening);
        };

        /* ---------------------------------------------------------
           Helper : date de dévoilement en heure locale
           ("2026-11-30" -> 30 novembre 2026, 00h00 de l'appareil)
           --------------------------------------------------------- */
        const getUnlockDate = () => {
            const parts = quizCfg.DATE_DEVOILEMENT.split("-").map(Number);
            return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
        };

        /* ---------------------------------------------------------
           Voile de refus : 3 mauvaises réponses -> message + blague,
           puis remise à zéro du quiz (le cadenas reste fermé).
           --------------------------------------------------------- */
        const showVeil = () => {
            if (!veil) return;
            veilText.textContent = quizCfg.MESSAGE_REFUS;
            veil.hidden = false;
            // Le voile reste ~3s puis s'efface et on repart de la question 1
            setTimeout(() => {
                veil.classList.add("fading");
                setTimeout(() => {
                    veil.hidden = true;
                    veil.classList.remove("fading");
                    questionIndex = 0;
                    wrongCount = 0;
                    if (lockBadge) lockBadge.classList.remove("step", "open");
                    renderQuestion();
                    busy = false;
                }, 350);
            }, 2800);
        };

        /* ---------------------------------------------------------
           Affichage d'une question : label + choix mélangés
           (Fisher-Yates : le bon choix n'est pas toujours le premier)
           --------------------------------------------------------- */
        const renderQuestion = () => {
            const current = quizCfg.QUESTIONS[questionIndex];
            if (!current) return;

            progressEl.textContent = `QUESTION ${questionIndex + 1} / ${quizCfg.QUESTIONS.length}`;
            questionEl.textContent = current.question;
            feedbackEl.textContent = "";

            // Copie + mélange des choix
            const shuffled = [...current.choices];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            choicesEl.innerHTML = "";
            choicesEl.classList.remove("locked");
            shuffled.forEach(texte => {
                const choice = document.createElement("button");
                choice.type = "button";
                choice.className = "entry-choice";
                choice.dataset.value = texte;
                choice.textContent = texte;
                choicesEl.appendChild(choice);
            });
        };

        /* ---------------------------------------------------------
           Fin du quiz : cadenas grand ouvert, puis selon la date :
           - jour J ou après -> bouton d'ouverture
           - avant le jour J -> compte à rebours
           --------------------------------------------------------- */
        const finishQuiz = () => {
            if (lockBadge) {
                lockBadge.classList.remove("step");
                lockBadge.classList.add("open");
            }
            // Mémorise le quiz réussi pour cette visite future (localStorage):
            // après le 30 novembre, elle ne rejouera pas le quiz à chaque fois.
            try { localStorage.setItem("magazine_quiz_ok", "1"); } catch (e) { /* mode privé : sans gravité */ }

            // Le quiz disparaît, laisse place au compte à rebours ou au bouton
            quizBox.hidden = true;

            const unlockDate = getUnlockDate();
            const now = new Date();

            // INTERRUPTEUR DE PHASE TEST (config.js ENTRY_QUIZ.DATE_LOCK_ACTIVE)
            // false : le magazine ouvre dès le quiz réussi, quelle que soit la date.
            // true  : le blocage "jour J" s'applique (compte à rebours ou bouton).
            if (quizCfg.DATE_LOCK_ACTIVE !== true) {
                // Ouverture directe : on attend un tap (indispensable pour la musique)
                btn.hidden = false;
                return;
            }

            if (now >= unlockDate) {
                // Le sceau est tombé : on attend un tap (indispensable pour la musique)
                btn.hidden = false;
            } else {
                startCountdown(unlockDate);
            }
        };

        /* ---------------------------------------------------------
           Compte à rebours jusqu'à la date de dévoilement
           --------------------------------------------------------- */
        const startCountdown = (unlockDate) => {
            const cfgCd = quizCfg.COMPTE_A_REBOURS || {};
            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

            countdownBox.hidden = false;
            setTxt("countdown-title", cfgCd.titre || "Cadenas armé");
            setTxt("countdown-sub", cfgCd.sous_titre || "Le sceau se lève dans");
            setTxt("countdown-legende", cfgCd.legende || quizCfg.DATE_DEVOILEMENT);
            (cfgCd.unites || ["j", "h", "min", "sec"]).forEach((u, i) => {
                setTxt(`cd-${["days", "hours", "mins", "secs"][i]}-u`, u);
            });

            const pad2 = n => n.toString().padStart(2, "0");

            const update = () => {
                const diff = unlockDate - new Date();
                if (diff <= 0) {
                    // Jour J atteint pendant le compte à rebours
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                    countdownBox.hidden = true;
                    btn.hidden = false;
                    return;
                }
                const days = Math.floor(diff / 86400000);
                const hours = Math.floor(diff / 3600000) % 24;
                const mins = Math.floor(diff / 60000) % 60;
                const secs = Math.floor(diff / 1000) % 60;
                setTxt("cd-days", pad2(days));
                setTxt("cd-hours", pad2(hours));
                setTxt("cd-mins", pad2(mins));
                setTxt("cd-secs", pad2(secs));
            };

            update();
            countdownTimer = setInterval(update, 1000);
        };

        /* ---------------------------------------------------------
           Gestion d'un choix cliqué (juste ou faux)
           --------------------------------------------------------- */
        const handleChoice = (choiceText, choiceEl) => {
            if (busy) return;
            busy = true;
            choicesEl.classList.add("locked"); // fige la liste pendant la réponse

            const current = quizCfg.QUESTIONS[questionIndex];

            if (choiceText === current.bonne) {
                // Choix juste : surlignage, cadenas qui s'éclaire progressivement
                choiceEl.classList.add("correct");
                feedbackEl.textContent = quizCfg.MESSAGE_JUSTE;
                if (lockBadge && questionIndex >= 1) lockBadge.classList.add("step");

                setTimeout(() => {
                    busy = false;
                    questionIndex++;
                    if (questionIndex >= quizCfg.QUESTIONS.length) {
                        finishQuiz();
                    } else {
                        renderQuestion();
                    }
                }, 900);
            } else {
                // Choix faux : secousse du magazine + message doux
                wrongCount++;
                choiceEl.classList.add("wrong");
                feedbackEl.textContent = quizCfg.MESSAGE_TENTATIVE || "Mauvaise piste…";
                card.classList.add("quake");
                setTimeout(() => card.classList.remove("quake"), 350);

                if (wrongCount >= quizCfg.MAX_TENTATIVES) {
                    // 3 échecs : voile de refus puis remise à zéro
                    setTimeout(showVeil, 600);
                } else {
                    setTimeout(() => {
                        choicesEl.classList.remove("locked");
                        choiceEl.classList.remove("wrong");
                        busy = false;
                    }, 900);
                }
            }
        };

        // Délégation d'événement sur la liste des choix
        choicesEl.addEventListener("click", (e) => {
            const choice = e.target.closest(".entry-choice");
            if (choice) handleChoice(choice.dataset.value, choice);
        });

        // Le pill n'ouvre qu'une fois le sceau tombé
        btn.addEventListener("click", openMagazine);

        // À l'arrivée : le magazine n'est plus un bouton (le quiz porte l'interaction)
        card.removeAttribute("role");
        card.removeAttribute("tabindex");
        card.removeAttribute("aria-label");
        card.style.cursor = "default";

        // Cas de reconnexion : si le verrou date est actif ET que le quiz a déjà
        // été réussi après le jour J, on saute directement le quiz pour ne pas
        // re-poser 3 questions. (Pendant la phase test, DATE_LOCK_ACTIVE vaut
        // false : elle rejoue le quiz à chaque visite, ce qui est plus pratique
        // pour tester.)
        let alreadyPassed = false;
        try { alreadyPassed = localStorage.getItem("magazine_quiz_ok") === "1"; } catch (e) { /* localStorage indisponible */ }
        const now = new Date();
        if (quizCfg.DATE_LOCK_ACTIVE === true && alreadyPassed && now >= getUnlockDate()) {
            quizBox.hidden = true;
            btn.hidden = false;
        } else {
            renderQuestion();
        }
    },

    /**
     * Logique de la Page 0 : Couverture
     */
    initPage0: function() {
        const startBtn = document.getElementById("btn-start-audio");
        if (!startBtn) return;

        startBtn.addEventListener("click", () => {
            window.AppAudio.playMusic();
            startBtn.style.backgroundColor = "var(--sun-yellow)";
            startBtn.style.color = "var(--ink-black)";
            startBtn.innerText = "Musique activée !";
            setTimeout(() => { startBtn.style.opacity = "0.7"; }, 2000);
        });
    },

    /**
     * Logique de la Page 1 : Révélation
     */
    initPage1: function() {
        // Géré par IntersectionObserver + confettis (déclenchés depuis main.js)
    },

    /**
     * Logique de la Page 2 : Édito
     */
    initPage2: function() {
        // Géré par IntersectionObserver
    },

    /**
     * Logique de la Page 3 : Le Dossier (A)
     * Injection dynamique des 3 polaroïds depuis config.js
     */
    initPage3: function() {
        const grid = document.getElementById("dossier-a");
        if (!grid) return;

        const photos = window.AppConfig?.PHOTOS_A || [];
        grid.innerHTML = "";

        photos.forEach((photo, i) => {
            const pol = document.createElement("div");
            pol.className = "pol";
            pol.setAttribute("data-fx", "drop");
            pol.dataset.d = i === 0 ? "0" : (i === 1 ? "0.15" : "0.3");

            // Inclinaison légère conservée dans --r (nombre, sans "deg").
            const rot = (Math.random() * 6 - 3).toFixed(2);
            pol.style.setProperty("--r", rot);

            pol.innerHTML = `
                <em class="washi-tape"></em>
                <div class="ph brutal-polaroid">
                    <img src="${photo.src}" alt="Photo" loading="lazy">
                    <div class="brutal-caption">${photo.legende}</div>
                </div>
            `;
            grid.appendChild(pol);
        });
    },

    /**
     * Logique de la Page 4 : Tri-pli (B)
     * Injection dynamique des 3 volets depuis config.js
     */
    initPage4: function() {
        const container = document.getElementById("tripli-b");
        if (!container) return;

        const photos = window.AppConfig?.PHOTOS_B || [];
        container.innerHTML = "";

        photos.forEach((photo, i) => {
            const panel = document.createElement("div");
            panel.className = "tripli-panel";
            panel.setAttribute("data-fx", "drop");
            panel.dataset.d = i === 0 ? "0" : (i === 1 ? "0.15" : "0.3");
            panel.style.setProperty("--r", "0");

            panel.innerHTML = `
                <img src="${photo.src}" alt="Photo" loading="lazy">
                <div class="tripli-caption">${photo.legende}</div>
            `;
            container.appendChild(panel);
        });

        // Ajout des plis visuels
        const fold1 = document.createElement("div");
        fold1.className = "tripli-fold fold-1";
        const fold2 = document.createElement("div");
        fold2.className = "tripli-fold fold-2";
        container.appendChild(fold1);
        container.appendChild(fold2);
    },

    /**
     * Logique de la Page 5 : Pleine Page (C)
     * Contenu statique dans l'HTML, photo depuis config.js (fallback)
     */
    initPage5: function() {
        const img = document.querySelector("#page-5 .full-page-photo");
        if (img && window.AppConfig?.PHOTO_C?.src) {
            img.src = window.AppConfig.PHOTO_C.src;
        }
        const quote = document.querySelector("#page-5 .quote-block");
        if (quote && window.AppConfig?.PHOTO_C?.citation) {
            quote.textContent = window.AppConfig.PHOTO_C.citation;
        }
    },

    /* ============================================================
       PAGE 6 : SES GOÛTS — 2 cartes avec photos + LES DISQUETTES
       Vinyles interactifs, TOUS libres dès le départ :
       - « écouté » = 10 s de lecture cumulées ou fin du son ;
       - re-tap sur le disque en cours = pause / reprise ;
       - une seule lecture à la fois + fine barre de progression ;
       - la musique de fond revient à la pause, à la fin, et quand
         on quitte la page (IntersectionObserver < 20 % visible) ;
       - le BONUS se révèle quand tous les artistes sont écoutés ;
       - « SON INDISPONIBLE » compte comme écouté : rien ne bloque.
       ============================================================ */
    initPage6: function() {
        const gouts = window.AppConfig?.GOUTS;
        if (!gouts) return;

        /* ---------- 1. Cartes anime / série : brancher les photos ---------- */
        const branchesCarte = (photoId, image) => {
            const photoBox = document.getElementById(photoId);
            if (!photoBox || !image) return;
            const img = photoBox.querySelector("img");
            if (img) {
                img.src = image;
                photoBox.hidden = false;
            }
        };
        if (gouts.anime) branchesCarte("gout-anime-photo", gouts.anime.image);
        if (gouts.serie) branchesCarte("gout-serie-photo", gouts.serie.image);

        /* ---------- 2. Réglages et éléments de la page ---------- */
        const disquettesCfg = window.AppConfig?.DISQUETTES;
        const shelf = document.getElementById("disquettes-shelf");
        const trace = document.getElementById("disquette-trace");
        const bonusNote = document.getElementById("bonus-note");
        const consigne = document.getElementById("disquette-consigne");
        const page6 = document.getElementById("page-6");
        if (!disquettesCfg || !shelf) return;

        const SEUIL_ECOUTE = 10;              // secondes cumulées pour valider
        const CLE_ECOUTES = "disquettes_ok";  // ids écoutés
        const CLE_ERREURS = "disquettes_erreurs"; // ids au son introuvable

        if (consigne) {
            consigne.textContent = disquettesCfg.consigne || "Touche un disque pour l'écouter.";
        }

        const disquesArtistes = (disquettesCfg.DISQUES || []).filter(Boolean);
        const bonus = disquettesCfg.BONUS || null;
        const liste = bonus ? [...disquesArtistes, bonus] : [...disquesArtistes];

        // Traces persistées. try/catch : localStorage peut être interdit
        // (navigation privée, stockage plein) : le site marche sans traces.
        const lireListe = (cle) => {
            try {
                const brut = JSON.parse(localStorage.getItem(cle) || "[]");
                return Array.isArray(brut) ? brut.filter(id => typeof id === "string") : [];
            } catch (e) {
                return [];
            }
        };
        const ecoutés = lireListe(CLE_ECOUTES);
        const enErreur = lireListe(CLE_ERREURS);

        const sauverListe = (cle, valeurs) => {
            try { localStorage.setItem(cle, JSON.stringify(valeurs)); } catch (e) { /* sans gravité */ }
        };

        /* ---------- 3. Construction des disquettes ---------- */
        // On repart d'une étagère vide (évite les doublons si la page
        // est initialisée deux fois).
        shelf.innerHTML = "";
        if (trace) trace.innerHTML = "";

        const elements = [];
        const points = [];

        const creerDisquette = (disque, estBonus) => {
            const bouton = document.createElement("button");
            bouton.type = "button";
            bouton.className = "disquette" + (estBonus ? " bonus" : "");
            if (estBonus) bouton.classList.add("est-cache"); // révélé plus tard
            bouton.dataset.id = disque.id;
            bouton.setAttribute("aria-label", `Écouter ${disque.artiste} — ${disque.titre}`);

            // Corps du vinyle
            const disc = document.createElement("span");
            disc.className = "disquette-disc";

            // Étiquette : photo de l'artiste, ou texte (bonus sans photo)
            const label = document.createElement("span");
            label.className = "disquette-label";
            if (disque.image && !disque.sans_image) {
                const img = document.createElement("img");
                img.src = disque.image;
                img.alt = disque.artiste;
                img.loading = "lazy";
                label.appendChild(img);
            } else {
                const txt = document.createElement("span");
                txt.className = "disquette-label-texte";
                txt.textContent = estBonus ? "BONUS" : disque.artiste;
                label.appendChild(txt);
            }
            disc.appendChild(label);

            // Trou central du vinyle
            const trou = document.createElement("span");
            trou.className = "disquette-hole";
            disc.appendChild(trou);
            bouton.appendChild(disc);

            // Badge « ON AIR » / « PAUSE » au-dessus du disque en cours
            const badge = document.createElement("span");
            badge.className = "disquette-badge";
            badge.setAttribute("aria-hidden", "true");
            badge.textContent = "ON AIR";
            bouton.appendChild(badge);

            // Nom + titre du son sous le disque
            const nom = document.createElement("span");
            nom.className = "disquette-nom";
            nom.textContent = disque.artiste;
            bouton.appendChild(nom);

            if (disque.titre) {
                const titre = document.createElement("span");
                titre.className = "disquette-titre";
                titre.textContent = disque.titre;
                bouton.appendChild(titre);
            }

            // Fine barre de progression, visible sur le disque en cours
            const barre = document.createElement("span");
            barre.className = "disquette-progress";
            barre.setAttribute("aria-hidden", "true");
            const remplissage = document.createElement("span");
            remplissage.className = "disquette-progress-fill";
            barre.appendChild(remplissage);
            bouton.appendChild(barre);

            bouton._cfg = disque;
            bouton._estBonus = estBonus;
            bouton._badge = badge;
            bouton._barre = barre;
            bouton._fill = remplissage;

            shelf.appendChild(bouton);
            return bouton;
        };

        liste.forEach((disque) => {
            elements.push(creerDisquette(disque, disque === bonus));
        });

        // Un point de progression par disquette (bonus = point noir)
        if (trace) {
            liste.forEach((disque) => {
                const dot = document.createElement("span");
                dot.className = "trace-dot" + (disque === bonus ? " bonus-dot" : "");
                dot.setAttribute("aria-hidden", "true");
                trace.appendChild(dot);
                points.push(dot);
            });
            const legende = document.createElement("span");
            legende.className = "trace-label";
            trace.appendChild(legende);
        }

        /* ---------- 4. Traces : sticker « ÉCOUTÉ » + points ---------- */
        const estEcouté = (id) => ecoutés.includes(id);

        const majSticker = (el, visible) => {
            let sticker = el.querySelector(".disquette-sticker-ecoute");
            if (visible && !sticker) {
                sticker = document.createElement("span");
                sticker.className = "disquette-sticker-ecoute";
                sticker.setAttribute("aria-hidden", "true");
                sticker.textContent = "ÉCOUTÉ";
                el.appendChild(sticker); // collé en travers, positionné en CSS

                // Petit rebond du sticker (lot 2). Sans effet, il apparaît
                // simplement : la fonction ne fait rien.
                if (window.AppEffets && typeof window.AppEffets.animerAutocollant === "function") {
                    window.AppEffets.animerAutocollant(sticker);
                }
            } else if (!visible && sticker) {
                sticker.remove();
            }
        };

        const majTraces = () => {
            elements.forEach((el, index) => {
                const cfg = el._cfg;
                const ecouté = estEcouté(cfg.id);
                // Pas de sticker sur un son introuvable : le message
                // « SON INDISPONIBLE » reste la seule vérité affichée.
                majSticker(el, ecouté && !enErreur.includes(cfg.id));
                if (points[index]) points[index].classList.toggle("ecoute", ecouté);
            });
        };

        /* ---------- 5. Révélation du BONUS ---------- */
        const bonusEl = elements.find(el => el._estBonus) || null;
        let bonusRevele = false;

        const majBonus = () => {
            const toutEcouté = disquesArtistes.length > 0 &&
                disquesArtistes.every(d => estEcouté(d.id));
            if (!toutEcouté) return;

            // Le disque bonus apparaît dans l'étagère
            if (bonusEl && !bonusRevele) {
                bonusRevele = true;
                bonusEl.classList.remove("est-cache");
                bonusEl.classList.add("apparait");
                setTimeout(() => bonusEl.classList.remove("apparait"), 500);
            }

            // Son message de révélation apparaît une seule fois
            if (bonusNote && bonusNote.hidden) {
                bonusNote.textContent = bonus?.message || disquettesCfg.bonus_revelation || "";
                bonusNote.hidden = false;
                // Laisse le navigateur peindre l'état initial avant le fondu
                requestAnimationFrame(() => bonusNote.classList.add("visible"));
            }
        };

        /* ---------- 6. Moteur audio : UNE seule lecture à la fois ---------- */
        const cumuls = new Map();       // id -> secondes cumulées (session)
        let audioCourant = null;        // <audio> du disque en cours
        let boutonCourant = null;       // son <button>
        let musiqueSuspendue = false;   // la musique a été coupée pour un disque
        let minuteurMusique = null;

        // Coupe la musique de fond une seule fois (fondu géré par audio.js)
        const couperMusique = () => {
            if (minuteurMusique) { clearTimeout(minuteurMusique); minuteurMusique = null; }
            if (musiqueSuspendue) return;
            musiqueSuspendue = true;
            window.AppAudio?.pauseForVideo?.();
        };

        // Rend la musique de fond. Petit délai : on laisse le fondu de
        // pause (550 ms) se terminer avant de remonter le volume.
        const relancerMusique = () => {
            if (!musiqueSuspendue) return;
            musiqueSuspendue = false;
            if (minuteurMusique) clearTimeout(minuteurMusique);
            minuteurMusique = setTimeout(() => {
                minuteurMusique = null;
                window.AppAudio?.resumeAfterVideo?.();
            }, 650);
        };

        const afficherProgression = (el, ratio) => {
            if (!el || !el._fill) return;
            const valeur = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
            el._fill.style.width = (valeur * 100).toFixed(2) + "%";
        };

        // Valide une écoute : point + éventuel sticker + bonus + localStorage.
        // "erreur" = son introuvable : ça compte aussi comme écouté.
        const marquerEcouté = (cfg, erreur) => {
            if (!estEcouté(cfg.id)) {
                ecoutés.push(cfg.id);
                sauverListe(CLE_ECOUTES, ecoutés);
            }
            if (erreur && !enErreur.includes(cfg.id)) {
                enErreur.push(cfg.id);
                sauverListe(CLE_ERREURS, enErreur);
            }
            majTraces();
            majBonus();
        };

        // Un son qui remarche efface l'ancien état d'erreur.
        const oublierErreur = (cfg) => {
            const index = enErreur.indexOf(cfg.id);
            if (index === -1) return;
            enErreur.splice(index, 1);
            sauverListe(CLE_ERREURS, enErreur);
            majTraces();
        };

        // Son absent / illisible : message local, compte comme écouté,
        // et la musique de fond revient. La page n'est jamais bloquée.
        const signalerIndisponible = (cfg, el) => {
            if (!el.querySelector(".disquette-son-manquant")) {
                const message = document.createElement("span");
                message.className = "disquette-son-manquant";
                message.textContent = "SON INDISPONIBLE";
                el.appendChild(message);
            }
            if (boutonCourant === el) {
                audioCourant = null;
                boutonCourant = null;
            }
            el.classList.remove("on-air", "en-pause", "is-current");
            if (el._badge) el._badge.textContent = "ON AIR";
            afficherProgression(el, 0);
            marquerEcouté(cfg, true);
            relancerMusique();
            console.warn(`[Disquette] son non chargé : ${cfg.src}`);
        };

        // Crée un lecteur audio NEUF à chaque lancement (ou relance).
        // Un élément qui a échoué une fois resterait bloqué en erreur :
        // on ne le réutilise donc jamais pour une nouvelle lecture.
        const creerAudio = (el) => {
            const cfg = el._cfg;
            const audio = new Audio();
            audio.preload = "auto";

            audio.addEventListener("timeupdate", () => {
                // Événement d'un ancien lecteur (disque changé entre-temps)
                if (audioCourant !== audio) return;

                // Barre de progression du disque en cours
                if (el === boutonCourant && Number.isFinite(audio.duration) && audio.duration > 0) {
                    afficherProgression(el, audio.currentTime / audio.duration);
                }
                // Cumul d'écoute : seuls les petits pas du timeupdate
                // comptent (un saut > 1,5 s est ignoré).
                const temps = audio.currentTime || 0;
                const delta = temps - audio._dernierTemps;
                audio._dernierTemps = temps;
                if (delta > 0 && delta <= 1.5) {
                    const cumul = (cumuls.get(cfg.id) || 0) + delta;
                    cumuls.set(cfg.id, cumul);
                    if (cumul >= SEUIL_ECOUTE && !estEcouté(cfg.id)) {
                        marquerEcouté(cfg, false);
                    }
                }
            });

            audio.addEventListener("playing", () => {
                if (audioCourant !== audio) return;
                // Le son répond : on efface un ancien état d'erreur
                oublierErreur(cfg);
            });

            audio.addEventListener("ended", () => {
                marquerEcouté(cfg, false);
                const etaitCourant = (audioCourant === audio);
                audio.pause();
                try { audio.currentTime = 0; } catch (e) { /* flux non seekable */ }
                audio._dernierTemps = 0;
                if (etaitCourant) {
                    audioCourant = null;
                    boutonCourant = null;
                    el.classList.remove("on-air", "en-pause", "is-current");
                    if (el._badge) el._badge.textContent = "ON AIR";
                    afficherProgression(el, 0);
                }
                relancerMusique();
            });

            audio.addEventListener("error", () => {
                // Erreur d'un ancien lecteur : on l'ignore, elle ne doit
                // pas afficher « SON INDISPONIBLE » sur le disque courant.
                if (audioCourant !== audio) return;

                // Une erreur peut être passagère (veille, réseau, cache).
                // On retente UNE fois avec un lecteur neuf avant d'annoncer
                // l'indisponibilité : une musique présente doit pouvoir jouer.
                if (!audio._secondeChance) {
                    try { audio.pause(); } catch (e) { /* sans gravité */ }
                    const prochain = creerAudio(el);
                    prochain._secondeChance = true;
                    audioCourant = prochain;
                    boutonCourant = el;
                    lancerLecture(el, prochain);
                    return;
                }
                signalerIndisponible(cfg, el);
            });

            // La source est posée après les écouteurs : aucun événement perdu
            audio._dernierTemps = 0;
            audio.src = cfg.src;
            return audio;
        };

        // Arrête le disque en cours (et le remet à zéro si demandé).
        const couperDisque = (remettreAZero) => {
            if (!audioCourant) return;
            audioCourant.pause();
            if (remettreAZero) {
                try { audioCourant.currentTime = 0; } catch (e) { /* sans gravité */ }
                audioCourant._dernierTemps = 0;
            }
            if (boutonCourant) afficherProgression(boutonCourant, 0);
            elements.forEach(el => {
                el.classList.remove("on-air", "en-pause", "is-current");
                if (el._badge) el._badge.textContent = "ON AIR";
            });
            audioCourant = null;
            boutonCourant = null;
        };

        // Lance (ou relance) la lecture d'un disque.
        const lancerLecture = (el, audio) => {
            const cfg = el._cfg;

            // Un ancien message d'erreur disparaît dès qu'on retente
            const ancienMessage = el.querySelector(".disquette-son-manquant");
            if (ancienMessage) ancienMessage.remove();

            audio._dernierTemps = audio.currentTime || 0;
            el.classList.add("on-air", "is-current");
            el.classList.remove("en-pause");
            if (el._badge) el._badge.textContent = "ON AIR";

            // La musique de fond s'efface pendant l'écoute
            couperMusique();

            const promesse = audio.play();
            if (promesse && typeof promesse.then === "function") {
                promesse.then(() => {
                    // Un autre disque a pris la main entre-temps : on s'arrête
                    if (audioCourant !== audio) audio.pause();
                }).catch((e) => {
                    console.warn("[Disquette] lecture impossible :", e);
                    // Le disque a changé entre-temps : ne rien modifier
                    if (audioCourant !== audio) return;
                    // Fichier réellement absent : état « indisponible »
                    if (audio.error) {
                        signalerIndisponible(cfg, el);
                        return;
                    }
                    // Simple refus du navigateur : disque en pause, sans blocage
                    if (boutonCourant === el) {
                        el.classList.remove("on-air");
                        el.classList.add("en-pause");
                        if (el._badge) el._badge.textContent = "PAUSE";
                    }
                    relancerMusique();
                });
            }
        };

        /* ---------- 7. Un tap = lecture, ou pause / reprise ---------- */
        elements.forEach((el) => {
            el.addEventListener("click", () => {
                // Re-tap sur le disque en cours : pause, puis reprise
                // exactement là où on s'était arrêté (pas de redémarrage).
                if (el === boutonCourant && audioCourant) {
                    if (audioCourant.paused) {
                        lancerLecture(el, audioCourant);
                    } else {
                        audioCourant.pause();
                        el.classList.remove("on-air");
                        el.classList.add("en-pause");
                        if (el._badge) el._badge.textContent = "PAUSE";
                        relancerMusique();
                    }
                    return;
                }

                // Un autre disque : on coupe le précédent (une seule lecture)
                couperDisque(true);

                // Nouveau lecteur à chaque lancement : une ancienne erreur
                // (veille du téléphone, réseau) ne bloque jamais la réécoute.
                const audio = creerAudio(el);
                audioCourant = audio;
                boutonCourant = el;
                el.classList.add("is-current");
                lancerLecture(el, audio);
            });
        });

        /* ---------- 8. Quitter la page 6 = arrêt du disque ---------- */
        // Sous 20 % de visibilité : le disque s'arrête net et la musique
        // de fond reprend. Aucun autre état ne touche au défilement.
        if (page6 && typeof IntersectionObserver === "function") {
            const observateur = new IntersectionObserver((entrees) => {
                entrees.forEach((entree) => {
                    if (!entree.isIntersecting || entree.intersectionRatio < 0.2) {
                        if (audioCourant) couperDisque(true);
                        relancerMusique();
                    }
                });
            }, { threshold: [0, 0.2, 0.5, 0.75, 1] });
            observateur.observe(page6);
        }

        // Compatibilité « feuilles empilées » : sur un écran assez haut
        // pour que la page 6 tienne dans 100dvh, elle devient sticky et
        // l'IntersectionObserver la voit toujours visible même recouverte
        // par la page suivante. On coupe donc aussi le disque dès que la
        // page active n'est plus la page 6.
        document.addEventListener("app:pagechange", (e) => {
            const pageId = e.detail && e.detail.pageId;
            if (pageId !== "page-6" && audioCourant) {
                couperDisque(true);
                relancerMusique();
            }
        });

        /* ---------- 9. Rendu initial (traces restaurées) ---------- */
        majTraces();
        majBonus();
    },

    /**
     * Logique de la Page 7 : Elle se décrit
     * Injection des 3 blocs colorés (Corail, Jaune, Turquoise)
     */
    initPage7: function() {
        const mots = window.AppConfig?.MOTS_ELLE || [];
        const grid = document.getElementById("mots-grid");
        if (!grid) return;

        grid.innerHTML = "";
        mots.forEach((mot, i) => {
            const block = document.createElement("div");
            block.className = "mot-block";
            block.innerHTML = `<div class="mot-word" data-fx="${i % 2 === 0 ? "slideL" : "slideR"}" data-ease="back" data-d="${(i * 0.12).toFixed(2)}">${mot}</div>`;
            grid.appendChild(block);
        });
    },

    /**
     * Logique de la Page 8 : Ils parlent de toi
     * Les amis « vedette » gardent une carte complète ; les autres
     * passent dans le mur « ILS EN PARLENT AUSSI », en citations courtes.
     * Aucun texte d'ami n'est modifié : tout est injecté en textContent.
     */
    initPage8: function() {
        const amis = Array.isArray(window.AppConfig?.AMIS)
            ? window.AppConfig.AMIS.filter(ami => ami && typeof ami === "object")
            : [];
        const grid = document.getElementById("amis-grid");
        const empty = document.querySelector(".amis-empty");
        if (!grid) return;

        if (amis.length === 0) {
            grid.innerHTML = "";
            if (empty) empty.style.display = "block";
            return;
        }

        if (empty) empty.style.display = "none";
        grid.innerHTML = "";

        // 1. Vedettes : celles marquées true. Si aucune, les 5 premières.
        const vedettesChoisies = amis.filter(ami => ami.vedette === true);
        const vedettes = vedettesChoisies.length > 0
            ? vedettesChoisies
            : amis.slice(0, 5);
        const ensembleVedettes = new Set(vedettes);
        const autres = amis.filter(ami => !ensembleVedettes.has(ami));

        // 2. Cartes complètes des vedettes.
        vedettes.forEach((ami, index) => {
            const card = document.createElement("article");
            card.className = "ami-card reveal";
            card.style.transitionDelay = (index * 0.1) + "s";

            const header = document.createElement("div");
            header.className = "ami-header";

            const avatar = document.createElement("div");
            avatar.className = "ami-avatar";
            avatar.textContent = ami.initiale || (ami.prenom ? ami.prenom.charAt(0) : "?");

            const nom = document.createElement("div");
            nom.className = "ami-name";
            nom.textContent = ami.prenom || "Ami";

            header.appendChild(avatar);
            header.appendChild(nom);
            card.appendChild(header);

            const message = document.createElement("div");
            message.className = "ami-message";
            message.textContent = ami.message || "Message à venir…";
            card.appendChild(message);

            if (ami.audio) {
                const player = document.createElement("div");
                player.className = "ami-audio-player";

                const bouton = document.createElement("button");
                bouton.type = "button";
                bouton.className = "ami-audio-btn";
                bouton.dataset.audio = ami.audio;
                bouton.dataset.index = String(amis.indexOf(ami));
                bouton.dataset.label = "Écouter le message de " + (ami.prenom || "cet ami");
                bouton.textContent = "Écouter";
                bouton.setAttribute("aria-label", bouton.dataset.label);
                bouton.setAttribute("aria-pressed", "false");

                const progression = document.createElement("div");
                progression.className = "ami-progress";
                const barre = document.createElement("div");
                barre.className = "ami-progress-bar";
                progression.appendChild(barre);

                player.appendChild(bouton);
                player.appendChild(progression);
                card.appendChild(player);
            }

            grid.appendChild(card);
            if (window.App && typeof window.App.observeElement === "function") {
                window.App.observeElement(card);
            }
        });

        // 3. Mur des autres amis.
        if (autres.length > 0) {
            const mur = document.createElement("section");
            mur.className = "amis-mur";

            const titre = document.createElement("h2");
            titre.className = "amis-mur-titre text-anton";
            titre.textContent = "ILS EN PARLENT AUSSI";
            mur.appendChild(titre);

            const grille = document.createElement("div");
            grille.className = "amis-mur-grille";

            autres.forEach((ami, index) => {
                const citation = document.createElement("article");
                const couleurs = ["corail", "jaune", "turquoise"];
                citation.className = "ami-citation ami-citation--" + couleurs[index % 3];
                citation.style.setProperty("--inclinaison", index % 2 === 0 ? "-1.2deg" : "1.2deg");

                const bouton = document.createElement("button");
                bouton.type = "button";
                bouton.className = "ami-citation-toggle";
                bouton.setAttribute("aria-expanded", "false");
                bouton.dataset.label = "Déplier le message de " + (ami.prenom || "cet ami");
                bouton.setAttribute("aria-label", bouton.dataset.label);

                const tete = document.createElement("span");
                tete.className = "ami-citation-tete";

                const nom = document.createElement("span");
                nom.className = "ami-citation-nom";
                nom.textContent = ami.prenom || "Ami";

                const signe = document.createElement("span");
                signe.className = "ami-citation-plus";
                signe.setAttribute("aria-hidden", "true");
                signe.textContent = "+";

                tete.appendChild(nom);
                tete.appendChild(signe);

                const texte = document.createElement("span");
                texte.className = "ami-citation-texte";
                texte.textContent = ami.message || "Message à venir…";

                bouton.appendChild(tete);
                bouton.appendChild(texte);
                citation.appendChild(bouton);

                if (ami.audio) {
                    citation.classList.add("a-audio");
                    const audioBtn = document.createElement("button");
                    audioBtn.type = "button";
                    audioBtn.className = "ami-audio-btn ami-audio-btn--wall";
                    audioBtn.dataset.audio = ami.audio;
                    audioBtn.dataset.index = String(amis.indexOf(ami));
                    audioBtn.dataset.label = "Écouter le message de " + (ami.prenom || "cet ami");
                    audioBtn.textContent = "▶";
                    audioBtn.setAttribute("aria-label", audioBtn.dataset.label);
                    audioBtn.setAttribute("aria-pressed", "false");
                    citation.appendChild(audioBtn);
                }

                grille.appendChild(citation);
            });

            mur.appendChild(grille);
            grid.appendChild(mur);
        }

        // 4. Audio et dépliage : une seule délégation, réinstallée à chaque init.
        grid.onclick = (e) => {
            const audioBtn = e.target.closest(".ami-audio-btn");
            if (audioBtn) {
                e.stopPropagation();
                const src = audioBtn.dataset.audio;
                if (!src) return;
                window.AppScenes.playVoiceMessage(src, audioBtn, audioBtn.dataset.index);
                return;
            }

            const toggle = e.target.closest(".ami-citation-toggle");
            if (!toggle) return;

            const citation = toggle.closest(".ami-citation");
            if (!citation) return;

            const ouvert = citation.classList.toggle("est-ouvert");
            toggle.setAttribute("aria-expanded", ouvert ? "true" : "false");
            const signe = toggle.querySelector(".ami-citation-plus");
            if (signe) signe.textContent = ouvert ? "−" : "+";
        };
    },

    /**
     * Joue un message vocal avec synchronisation basique.
     * Un seul lecteur à la fois : toute autre voix en cours est coupée.
     * Le bouton du mur garde son pictogramme ▶ / ❚❚.
     */
    playVoiceMessage: function(src, btn, index) {
        const estBoutonMur = btn.classList.contains("ami-audio-btn--wall");
        const progressBar = btn.closest(".ami-audio-player")?.querySelector(".ami-progress-bar");
        const labelBase = btn.dataset.label || "Écouter";

        const majBouton = (actif) => {
            btn.classList.toggle("playing", actif);
            btn.setAttribute("aria-pressed", actif ? "true" : "false");
            if (estBoutonMur) {
                btn.textContent = actif ? "❚❚" : "▶";
                btn.setAttribute("aria-label", actif ? "Mettre la voix en pause" : labelBase);
            } else {
                btn.textContent = actif ? "Pause" : "Écouter";
                btn.setAttribute("aria-label", actif ? "Mettre la voix en pause" : labelBase);
            }
        };

        const isPlaying = btn.classList.contains("playing");

        // Arrêter tout autre audio vocal en cours.
        document.querySelectorAll(".ami-audio-btn.playing").forEach(otherBtn => {
            if (otherBtn !== btn) {
                otherBtn.classList.remove("playing");
                otherBtn.setAttribute("aria-pressed", "false");
                otherBtn.setAttribute("aria-label", otherBtn.dataset.label || "Écouter");
                otherBtn.textContent = otherBtn.classList.contains("ami-audio-btn--wall") ? "▶" : "Écouter";
                const otherBar = otherBtn.closest(".ami-audio-player")?.querySelector(".ami-progress-bar");
                if (otherBar) otherBar.style.width = "0%";
            }
        });

        if (isPlaying) {
            // Pause
            if (this._currentVoiceAudio) {
                this._currentVoiceAudio.pause();
                try {
                    this._currentVoiceAudio.currentTime = 0;
                } catch (err) {
                    // Flux non seekable : on garde la pause.
                }
                this._currentVoiceAudio = null;
            }
            majBouton(false);
            window.AppAudio.setPrioritySound("none");
            return;
        }

        // Nouvelle voix : couper l'ancienne avant de créer la nouvelle.
        if (this._currentVoiceAudio) {
            this._currentVoiceAudio.pause();
            try {
                this._currentVoiceAudio.currentTime = 0;
            } catch (err) {
                // Flux non seekable : on garde la pause.
            }
            this._currentVoiceAudio = null;
        }

        // Nouveau lecteur audio vocal
        const audio = new Audio(src);
        this._currentVoiceAudio = audio;

        audio.addEventListener("timeupdate", () => {
            if (progressBar && audio.duration) {
                const percent = (audio.currentTime / audio.duration) * 100;
                progressBar.style.width = percent + "%";
            }
        });

        audio.addEventListener("ended", () => {
            majBouton(false);
            if (progressBar) progressBar.style.width = "0%";
            window.AppAudio.setPrioritySound("none");
            this._currentVoiceAudio = null;
        });

        audio.addEventListener("error", () => {
            btn.classList.remove("playing");
            btn.setAttribute("aria-pressed", "false");
            btn.textContent = estBoutonMur ? "!" : "Erreur";
            btn.setAttribute("aria-label", "Erreur de lecture");
            window.AppAudio.setPrioritySound("none");
            this._currentVoiceAudio = null;
        });

        majBouton(true);
        window.AppAudio.setPrioritySound("voice");
        audio.play().catch(err => {
            console.warn("Lecture vocale bloquée :", err);
            majBouton(false);
            window.AppAudio.setPrioritySound("none");
            this._currentVoiceAudio = null;
        });
    },

    _currentVoiceAudio: null,

    /**
     * Logique de la Page 9 : En Vidéo
     * Vignettes cliquables, AUCUNE lecture automatique.
     * Tap sur une vignette -> fenêtre modale : un seul <video> réutilisé,
     * lancé avec le son (le tap est un geste utilisateur), musique en pause.
     */
    initPage9: function() {
        const videos = window.AppConfig?.VIDEOS || [];
        const grid = document.getElementById("videos-grid");
        if (!grid) return;

        grid.innerHTML = "";

        videos.forEach((video, index) => {
            // La vignette EST le bouton : tap = ouvrir la fenêtre de lecture
            const vignette = document.createElement("button");
            vignette.type = "button";
            vignette.className = `video-vignette ${video.orientation} ${video.tilted ? "tilted" : ""} reveal`;
            vignette.style.transitionDelay = `${index * 0.1}s`;
            vignette.setAttribute("aria-label", "Touche pour lancer la vidéo " + (index + 1));

            // <video> de la vignette : sert UNIQUEMENT d'image de prévisualisation.
            // - preload="metadata" : juste le metadata, pas de lecture.
            // - src + "#t=0.5" : force le navigateur à afficher la frame à 0,5s.
            // - "poster" (config.js) est prioritaire s'il est défini.
            // - aucun .play() n'est jamais appelé sur cet élément.
            const preview = document.createElement("video");
            preview.preload = "metadata";
            preview.muted = true;
            preview.playsInline = true;
            preview.disablePictureInPicture = true;
            preview.tabIndex = -1;
            preview.setAttribute("aria-hidden", "true");
            preview.setAttribute("disablepictureinpicture", "");
            if (video.poster) {
                preview.setAttribute("poster", video.poster);
            }
            preview.src = video.src.includes("#") ? video.src : video.src + "#t=0.5";

            // Ruban adhésif sur les paysages (style maquette)
            if (video.hasTape) {
                const tape = document.createElement("span");
                tape.className = "video-tape";
                tape.textContent = video.orientation === "landscape" ? "Paysage" : "Portrait";
                tape.setAttribute("aria-hidden", "true");
                vignette.appendChild(tape);
            }

            vignette.appendChild(preview);

            // Gros bouton rond "▶" au centre + appel "Touche pour lancer"
            const play = document.createElement("span");
            play.className = "video-play";
            play.setAttribute("aria-hidden", "true");
            play.textContent = "▶";
            vignette.appendChild(play);

            const cue = document.createElement("span");
            cue.className = "video-play-cue";
            cue.setAttribute("aria-hidden", "true");
            cue.textContent = "Touche pour lancer";
            vignette.appendChild(cue);

            grid.appendChild(vignette);

            if (window.App && typeof window.App.observeElement === "function") {
                window.App.observeElement(vignette);
            }

            // Tap sur la vignette -> fenêtre modale avec le son
            vignette.addEventListener("click", () => {
                this.openVideoModal(video, vignette);
            });
        });

        // Branchement unique des fermetures / erreurs de la fenêtre modale
        if (!this._videoModalBound) {
            this._videoModalBound = true;
            this._bindVideoModal();
        }
    },

    /* -----------------------------------------------------------
       Fenêtre modale du lecteur vidéo (page 9)
       Un seul élément <video> réutilisé pour toutes les vignettes.
       ----------------------------------------------------------- */
    _videoModalBound: false,       // listeners de la modale déjà branchés ?
    _videoModalLastTrigger: null,  // vignette d'origine (pour rendre le focus)
    _videoRetry: 0,                // relance automatique déjà tentée ?

    /**
     * Ouvre la fenêtre modale pour une vidéo de config.js
     * @param {Object} video - {src, orientation, ...}
     * @param {HTMLElement} triggerEl - la vignette cliquée (focus retour)
     */
    openVideoModal: function(video, triggerEl) {
        const modal = document.getElementById("video-modal");
        const player = document.getElementById("video-modal-player");
        const error = document.getElementById("video-modal-error");
        const closeBtn = document.getElementById("video-modal-close");
        if (!modal || !player || !error) return;

        // Une seule vidéo à la fois : (re)brancher la source coupe l'ancienne.
        // On repart d'un état propre à chaque ouverture (erreur effacée,
        // relance automatique réarmée).
        player.src = video.src;
        this._videoRetry = 0;
        error.hidden = true;
        try { player.load(); } catch (e) { /* sans gravité */ }

        this._videoModalLastTrigger = triggerEl || null;

        // Afficher la fenêtre (aucune animation si prefers-reduced-motion,
        // géré uniquement côté CSS)
        modal.hidden = false;

        // Bloquer le défilement du magazine pendant la fenêtre
        document.body.classList.add("video-modal-open");

        // Musique de fond : pause en fondu (le tap autorise le son de la vidéo)
        window.AppAudio.pauseForVideo();

        // Focus accessibilité : sur le bouton de fermeture à l'ouverture
        if (closeBtn) closeBtn.focus();

        // Lecture avec le son (tap = geste utilisateur)
        const playPromise = player.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(() => {
                // Lecture refusée par le navigateur : la fenêtre reste ouverte,
                // elle pourra relancer via les contrôles natifs. Pas de plantage.
                console.warn("Lecture vidéo bloquée par le navigateur");
            });
        }
    },

    /**
     * Ferme la fenêtre modale : pause + remise à zéro, musique en reprise,
     * focus rendu à la vignette d'origine.
     */
    closeVideoModal: function() {
        const modal = document.getElementById("video-modal");
        const player = document.getElementById("video-modal-player");
        const error = document.getElementById("video-modal-error");
        if (!modal || modal.hidden) return;

        // Stop : pause + remise à zéro (la prochaine ouverture repart de 0)
        if (player) {
            player.pause();
            if (error) error.hidden = true;
            try {
                player.currentTime = 0;
            } catch (e) { /* vidéo jamais chargée : sans gravité */ }
            // On GARDE la source : removeAttribute("src") + load() déclenche
            // un événement "error" (source vide) qui pourrait afficher
            // « Vidéo indisponible » à la réouverture alors que la vidéo existe.
        }

        // Débloquer le défilement
        document.body.classList.remove("video-modal-open");
        modal.hidden = true;

        // La musique reprend là où elle s'était arrêtée
        window.AppAudio.resumeAfterVideo();

        // Accessibilité : le focus revient sur la vignette d'origine
        if (this._videoModalLastTrigger && document.contains(this._videoModalLastTrigger)) {
            this._videoModalLastTrigger.focus();
        }
        this._videoModalLastTrigger = null;
    },

    /**
     * Branchement unique des événements de la fenêtre modale
     * (fermetures, erreur de chargement, rechute/relecture)
     */
    _bindVideoModal: function() {
        const modal = document.getElementById("video-modal");
        const player = document.getElementById("video-modal-player");
        const closeBtn = document.getElementById("video-modal-close");
        const error = document.getElementById("video-modal-error");
        const backdrop = document.getElementById("video-modal-backdrop");
        if (!modal || !player || !closeBtn) return;

        // Relecture (contrôles natifs) : la musique repasse en pause en fondu
        player.addEventListener("play", () => {
            window.AppAudio.pauseForVideo();
        });

        // Échec de chargement : une seule relance automatique, puis message.
        // On ignore les erreurs d'une fenêtre fermée ou d'une source vide
        // (elles ne doivent jamais afficher « Vidéo indisponible »).
        player.addEventListener("error", () => {
            if (modal.hidden) return;
            if (!player.getAttribute("src")) return;

            if (this._videoRetry < 1) {
                this._videoRetry++;
                if (error) error.hidden = true;
                try { player.load(); } catch (e) { /* sans gravité */ }
                const relance = player.play();
                if (relance && relance.catch) relance.catch(() => { /* sans gravité */ });
                return;
            }
            if (error) error.hidden = false;
        });

        // Fin de la vidéo : la musique reprend d'elle-même
        player.addEventListener("ended", () => {
            window.AppAudio.resumeAfterVideo();
        });

        // 3 fermetures : bouton ✕, tap sur le fond, touche Échap
        closeBtn.addEventListener("click", () => this.closeVideoModal());
        if (backdrop) {
            backdrop.addEventListener("click", () => this.closeVideoModal());
        }
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !modal.hidden) {
                this.closeVideoModal();
            }
        });
    },

    /**
     * Logique de la Page 10 : Quatrième de Couverture
     * Le gâteau cache le message. Appui maintenu (ou tap / Entrée)
     * pour souffler, puis révélation progressive du texte.
     */
    initPage10: function() {
        const config = window.AppConfig?.BACK_COVER;
        const page = document.getElementById("page-10");
        const cake = document.getElementById("cake-container");
        const message = document.getElementById("back-cover-message");
        const text = document.getElementById("back-cover-text");
        const final = document.getElementById("back-cover-final");
        const skip = document.getElementById("btn-voir-message");
        const hint = document.getElementById("cake-hint");
        const btnWA = document.getElementById("btn-whatsapp");
        const btnRevoir = document.getElementById("btn-revoir");

        if (!config || !page || !cake || !message || !text || !final) return;

        const reduction = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const DUREE_APPUI = 1500;       // appui complet pour souffler
        const DUREE_TAP = 300;          // en dessous, c'est un tap accessible
        const DELAI_SECOURS = 25000;    // bouton "Voir le message"
        const PAUSE_LIGNE = 700;        // pause entre deux lignes
        const SILENCE_FINAL = 3000;     // silence avant la phrase finale

        let messageRevele = false;
        let timerAppui = null;
        let timerSecours = null;
        let debutAppui = 0;
        let pointerId = null;
        let supprimerClic = false;
        let observateur = null;

        // 1. Texte exact depuis config.js (aucune correction de texte ici).
        text.textContent = "";
        const lignes = Array.isArray(config.lines) ? config.lines : [];
        lignes.forEach((ligne, index) => {
            const p = document.createElement("p");
            p.className = "back-line" + (index === lignes.length - 1 ? " signature" : "");
            p.dataset.line = String(index);
            p.textContent = ligne;
            text.appendChild(p);
        });

        // 2. WhatsApp : numéro et message déjà validés dans config.js.
        if (btnWA && config.whatsapp) {
            btnWA.href = `https://wa.me/${config.whatsapp.numero}?text=${encodeURIComponent(config.whatsapp.message)}`;
        }

        // 3. Revoir : retour en haut du magazine.
        if (btnRevoir) {
            btnRevoir.addEventListener("click", () => {
                const container = document.getElementById("main-container");
                if (!container) return;

                if (reduction) {
                    // #main-container est en scroll-behavior:smooth.
                    // On force "auto" le temps du retour pour rester instantané
                    // en mouvement réduit, puis on rend la main au CSS.
                    const ancien = container.style.scrollBehavior;
                    container.style.scrollBehavior = "auto";
                    container.scrollTo({ top: 0, behavior: "auto" });
                    container.style.scrollBehavior = ancien;
                } else {
                    container.scrollTo({ top: 0, behavior: "smooth" });
                }
            });
        }

        const arreterSecours = () => {
            if (timerSecours) clearTimeout(timerSecours);
            timerSecours = null;
        };

        const cacherSecours = () => {
            arreterSecours();
            if (skip) skip.hidden = true;
        };

        const demarrerSecours = () => {
            if (messageRevele || timerSecours) return;
            timerSecours = setTimeout(() => {
                timerSecours = null;
                if (!messageRevele && skip) skip.hidden = false;
            }, DELAI_SECOURS);
        };

        const eteindreBougies = () => {
            cake.querySelectorAll(".flame").forEach((flame) => {
                flame.classList.add("extinguished");
            });
            cake.querySelectorAll(".smoke").forEach((smoke, index) => {
                setTimeout(() => smoke.classList.add("est-visible"), index * 70);
            });
        };

        const afficherFinal = (direct = false) => {
            if (!final) return;
            final.hidden = false;
            final.classList.add("est-visible");

            const items = final.querySelectorAll(".final-item");
            if (reduction || direct) {
                items.forEach((item) => item.classList.add("visible"));
                return;
            }
            items.forEach((item, index) => {
                setTimeout(() => item.classList.add("visible"), index * 350);
            });
        };

        const reveler = (direct = false) => {
            if (messageRevele) return;
            messageRevele = true;

            cacherSecours();
            if (timerAppui) {
                clearTimeout(timerAppui);
                timerAppui = null;
            }
            if (observateur) {
                observateur.disconnect();
                observateur = null;
            }

            cake.classList.remove("souffle-en-cours");
            cake.setAttribute("aria-disabled", "true");
            cake.tabIndex = -1;
            if (hint) hint.setAttribute("aria-hidden", "true");
            eteindreBougies();

            // Confettis plats : le helper existant plafonne à 30 pièces,
            // et respecte EFFETS.confettis + prefers-reduced-motion.
            this._spawnConfetti(page);

            page.classList.add("est-revele");
            message.hidden = false;
            message.setAttribute("aria-hidden", "false");
            message.classList.add("est-visible");

            const lignesAffichees = text.querySelectorAll(".back-line");

            // Révélation directe (secours après 25 s) : on affiche tout de suite
            // les lignes et les actions, sans attendre les 700 ms ni les 3 s.
            if (reduction || direct) {
                lignesAffichees.forEach((ligne) => ligne.classList.add("visible"));
                afficherFinal(direct);
                return;
            }

            // Le gâteau commence à descendre/rétrécir, puis chaque ligne
            // apparaît avec 700 ms d'écart.
            lignesAffichees.forEach((ligne, index) => {
                setTimeout(() => ligne.classList.add("visible"), PAUSE_LIGNE + index * PAUSE_LIGNE);
            });

            const finDesLignes = PAUSE_LIGNE + Math.max(lignesAffichees.length - 1, 0) * PAUSE_LIGNE + 500;
            setTimeout(() => afficherFinal(false), finDesLignes + SILENCE_FINAL);
        };

        // 4. Appui maintenu : souris et tactile.
        const annulerAppui = () => {
            if (timerAppui) {
                clearTimeout(timerAppui);
                timerAppui = null;
            }
            cake.classList.remove("souffle-en-cours");
            pointerId = null;
        };

        cake.addEventListener("pointerdown", (event) => {
            if (messageRevele) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (pointerId !== null) return;

            pointerId = event.pointerId;
            debutAppui = performance.now();
            supprimerClic = false;

            try {
                cake.setPointerCapture(event.pointerId);
            } catch (e) {
                // Capture non disponible : le pointerup suffira dans la plupart des cas.
            }

            if (reduction) return;

            cake.classList.add("souffle-en-cours");
            timerAppui = setTimeout(() => {
                timerAppui = null;
                reveler();
            }, DUREE_APPUI);
        });

        cake.addEventListener("pointerup", (event) => {
            if (messageRevele) {
                pointerId = null;
                return;
            }
            if (event.pointerId !== pointerId) return;

            const duree = performance.now() - debutAppui;
            pointerId = null;

            if (timerAppui) {
                clearTimeout(timerAppui);
                timerAppui = null;
            }
            cake.classList.remove("souffle-en-cours");

            // Un tap très court souffle aussi (accessibilité).
            // Un appui plus long relâché avant 1,5 s annule le souffle.
            if (reduction || duree < DUREE_TAP) {
                reveler();
            } else {
                supprimerClic = true;
            }
        });

        cake.addEventListener("pointercancel", () => {
            annulerAppui();
            supprimerClic = true;
        });

        // Le clic reste nécessaire pour les lecteurs d'écran et les
        // navigateurs qui n'envoient pas d'événements pointer.
        cake.addEventListener("click", () => {
            if (supprimerClic) {
                supprimerClic = false;
                return;
            }
            if (!messageRevele) reveler();
        });

        cake.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!messageRevele) reveler();
            }
        });

        cake.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });

        if (skip) {
            skip.addEventListener("click", () => reveler(true));
        }

        // 5. Secours après 25 s : le compte part du moment où la page
        //    devient réellement visible, pas du chargement du site.
        if ("IntersectionObserver" in window) {
            observateur = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        demarrerSecours();
                    } else {
                        arreterSecours();
                    }
                });
            }, { threshold: [0.5] });
            observateur.observe(page);
        } else {
            demarrerSecours();
        }
    },

    /**
     * Éclat de confettis (lot 2).
     * 30 pièces plates maximum, corail / jaune / turquoise, une seule
     * couche par déclenchement. La page 1 est déclenchée par main.js
     * à 50 % de visibilité ; le gâteau de la page 10 garde son appel.
     * Sans le booléen EFFETS.confettis, ou en reduced-motion, rien.
     */
    _spawnConfetti: function(container) {
        if (!container) return;

        // Respecte le booléen et la préférence système, même si l'appel
        // vient d'un ancien chemin (gâteau, page 1).
        const confettisActifs = (window.AppEffets && typeof window.AppEffets.actif === "function")
            ? window.AppEffets.actif("confettis")
            : window.AppConfig?.EFFETS?.confettis !== false;
        if (!confettisActifs) return;

        if (window.AppEffets && typeof window.AppEffets.mouvementReduit === "function" &&
            window.AppEffets.mouvementReduit()) {
            return;
        }
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        // Passe par l'ordonnanceur : l'éclat compte pour un groupe et
        // attend une place si 3 effets sont déjà en cours.
        const lancer = () => this._creerConfettis(container);
        if (window.AppEffets && typeof window.AppEffets.programmerGroupe === "function") {
            window.AppEffets.programmerGroupe(lancer, 800, container);
        } else {
            lancer();
        }
    },

    /**
     * Crée la couche et les 30 pièces. Les variables CSS portent la
     * distance, la rotation et la couleur ; les keyframes ne touchent
     * qu'à transform et opacity.
     */
    _creerConfettis: function(container) {
        const couleurs = [
            "var(--vivid-coral)",
            "var(--sun-yellow)",
            "var(--bold-turquoise)"
        ];

        const largeur = container.clientWidth || window.innerWidth;
        const hauteur = container.clientHeight || window.innerHeight;

        const couche = document.createElement("div");
        couche.className = "confetti-layer";
        couche.setAttribute("aria-hidden", "true");

        // Sur une page, la couche passe derrière le texte (le conteneur
        // .reveal-text-container garde un z-index supérieur).
        if (container.classList.contains("page")) {
            container.insertBefore(couche, container.firstChild);
        } else {
            container.appendChild(couche);
        }

        for (let i = 0; i < 30; i++) {
            const piece = document.createElement("div");
            piece.className = "confetti";

            // Éclat dans toutes les directions, avec une légère
            // préférence vers le bas (comme des confettis qui retombent).
            const angle = Math.random() * Math.PI * 2;
            const distance = 0.25 + Math.random() * 0.65;
            const x = Math.cos(angle) * distance * largeur * 0.5;
            const y = Math.sin(angle) * distance * hauteur * 0.35 + hauteur * 0.18;
            const rotation = Math.random() * 720 - 360;

            // Pièces plates : rectangles fins, jamais de cube ni de 3D.
            const w = 6 + Math.random() * 8;
            const h = 4 + Math.random() * 5;

            piece.style.setProperty("--confetti-x", `${x.toFixed(0)}px`);
            piece.style.setProperty("--confetti-y", `${y.toFixed(0)}px`);
            piece.style.setProperty("--confetti-r", `${rotation.toFixed(0)}deg`);
            piece.style.setProperty("--confetti-w", `${w.toFixed(0)}px`);
            piece.style.setProperty("--confetti-h", `${h.toFixed(0)}px`);
            piece.style.setProperty("--confetti-c", couleurs[i % couleurs.length]);
            piece.style.setProperty("--confetti-d", `${Math.round(Math.random() * 100)}ms`);

            couche.appendChild(piece);
        }

        // La durée d'une pièce est de 600 ms + 0 à 100 ms de décalage.
        setTimeout(() => couche.remove(), 800);
    }
};
