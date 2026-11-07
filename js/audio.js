/**
 * GESTIONNAIRE AUDIO
 * Gère la musique de fond et les priorités sonores.
 * Robuste : ne plante pas si le fichier musique est absent.
 */
window.AppAudio = {
    music: null,
    isMusicPlaying: false,
    isMusicMuted: false,          // coupure manuelle par l'utilisateur
    currentPrioritySound: null,   // 'voice' ou 'video'
    _musicLoadFailed: false,
    _pausePourMedia: false,       // musique suspendue pour une vidéo / disquette
    _musicMuteTimer: null,
    _mediaPauseTimer: null,
    _fadeToken: 0,

    init: function() {
        const musicPath = window.AppConfig?.MUSIQUE;
        if (!musicPath) {
            console.warn("AppAudio: aucun chemin musique configuré");
            return;
        }
        this.music = new Audio(musicPath);
        this.music.loop = true;
        this.music.volume = 0;
        this.music.preload = "auto";

        // Écoute l'erreur de chargement
        this.music.addEventListener("error", () => {
            this._musicLoadFailed = true;
            console.warn("AppAudio: impossible de charger", musicPath);
        });
    },

    /**
     * Lance la musique de fond en fondu.
     * Ne fait rien si l'utilisateur l'a coupée manuellement.
     */
    playMusic: function() {
        if (!this.music || this._musicLoadFailed) {
            console.warn("AppAudio: musique non disponible");
            return;
        }
        if (this.isMusicMuted) return;

        // Si déjà en cours, ne rien faire
        if (this.isMusicPlaying && this.music.volume > 0) return;

        const playPromise = this.music.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.isMusicPlaying = true;

                    // L'utilisateur a coupé la musique pendant le démarrage.
                    if (this.isMusicMuted) {
                        this.music.volume = 0;
                        try {
                            this.music.pause();
                        } catch (e) {
                            // sans gravité
                        }
                        this._notifierEtatMusique();
                        return;
                    }

                    this.fadeVolume(this.music, window.AppConfig.VOLUME_MUSIQUE || 0.3, 2000);
                    this._notifierEtatMusique();
                })
                .catch(e => {
                    console.warn("AppAudio: lecture bloquée par le navigateur", e);
                    this._musicLoadFailed = true;
                });
        }
    },

    /**
     * Gère la priorité : coupe la musique pour un autre son.
     */
    setPrioritySound: function(type) {
        if (!this.music || this._musicLoadFailed) return;

        if (type === 'none') {
            this.currentPrioritySound = null;
            this._reprendreMusiqueSiPossible(1000);
        } else {
            this.currentPrioritySound = type;
            this.fadeVolume(this.music, 0, 500);
        }
    },

    /**
     * Met la musique EN PAUSE en fondu (vidéo ou disquette).
     * La position est conservée : resumeAfterVideo repart au même endroit.
     */
    pauseForVideo: function() {
        if (!this.music || this._musicLoadFailed) return Promise.resolve();

        this._pausePourMedia = true;

        // Une ancienne pause différée ne doit pas venir couper la musique
        // après la fermeture rapide d'une vidéo.
        clearTimeout(this._mediaPauseTimer);
        this._mediaPauseTimer = null;

        // Musique jamais lancée : rien à couper.
        if (!this.isMusicPlaying) return Promise.resolve();

        // Fondu rapide vers 0 puis pause
        this.fadeVolume(this.music, 0, 500);
        return new Promise(resolve => {
            this._mediaPauseTimer = setTimeout(() => {
                this._mediaPauseTimer = null;
                try {
                    this.music.pause();
                } catch (e) {
                    // sans gravité
                }
                resolve();
            }, 550);
        });
    },

    /**
     * Reprend la musique après une vidéo ou une disquette.
     * Ne fait rien si l'utilisateur l'a coupée manuellement.
     */
    resumeAfterVideo: function() {
        if (!this.music || this._musicLoadFailed) return;

        // La vidéo est fermée : on annule la pause encore programmée.
        clearTimeout(this._mediaPauseTimer);
        this._mediaPauseTimer = null;
        this._pausePourMedia = false;
        this._reprendreMusiqueSiPossible(1200);
    },

    /**
     * Bouton fixe : coupe ou rétablit la musique de fond.
     * Retourne true quand la musique est coupée.
     */
    toggleMusic: function() {
        this.setMusicMuted(!this.isMusicMuted);
        return this.isMusicMuted;
    },

    /**
     * Applique la coupure manuelle de la musique.
     * La reprise attend la fin d'une voix, d'une vidéo ou d'une disquette.
     */
    setMusicMuted: function(muted) {
        this.isMusicMuted = muted === true;

        if (!this.music || this._musicLoadFailed) {
            this._notifierEtatMusique();
            return;
        }

        clearTimeout(this._musicMuteTimer);
        this._musicMuteTimer = null;

        if (this.isMusicMuted) {
            // Fondu puis pause : on garde la position pour la reprise.
            this.fadeVolume(this.music, 0, 300);
            if (this.isMusicPlaying && !this.music.paused) {
                this._musicMuteTimer = setTimeout(() => {
                    if (!this.isMusicMuted) return;
                    try {
                        this.music.pause();
                    } catch (e) {
                        // sans gravité
                    }
                }, 330);
            }
        } else {
            // Si une voix, une vidéo ou une disquette est en cours, on attend.
            this._reprendreMusiqueSiPossible(1200);
        }

        this._notifierEtatMusique();
    },

    /**
     * Reprend la musique si aucune coupure manuelle ou média ne l'en empêche.
     */
    _reprendreMusiqueSiPossible: function(duree) {
        if (!this.music || this._musicLoadFailed) return;
        if (!this.isMusicPlaying) return;
        if (this.isMusicMuted) return;
        if (this.currentPrioritySound || this._pausePourMedia) return;

        const volumeCible = window.AppConfig.VOLUME_MUSIQUE || 0.3;

        // Musique encore en lecture : simple fondu de retour.
        if (!this.music.paused) {
            this.fadeVolume(this.music, volumeCible, duree);
            return;
        }

        // Musique mise en pause (mute manuel ou média) : on relance.
        this.music.volume = 0;
        const playPromise = this.music.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    if (!this.isMusicMuted && !this.currentPrioritySound && !this._pausePourMedia) {
                        this.fadeVolume(this.music, volumeCible, duree);
                    }
                })
                .catch(e => {
                    console.warn("AppAudio: reprise de la musique bloquée", e);
                });
        }
    },

    /**
     * Prévient l'interface (bouton MUSIQUE / MUET).
     */
    _notifierEtatMusique: function() {
        document.dispatchEvent(new CustomEvent("app:musicstate", {
            detail: { muted: this.isMusicMuted }
        }));
    },

    fadeVolume: function(audio, target, duration) {
        if (!audio || this._musicLoadFailed) return;

        const startVol = audio.volume;
        const diff = target - startVol;
        // Même si le volume est déjà à la cible, on annule l'ancien fondu.
        const token = ++this._fadeToken;
        if (Math.abs(diff) < 0.01) {
            audio.volume = target;
            return;
        }

        const startTime = performance.now();

        const update = (now) => {
            // Un nouveau fondu a pris la main : on arrête l'ancien.
            if (token !== this._fadeToken) return;

            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            audio.volume = startVol + (diff * progress);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
};
