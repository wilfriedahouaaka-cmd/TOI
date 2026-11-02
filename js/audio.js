/**
 * GESTIONNAIRE AUDIO
 * Gère la musique de fond et les priorités sonores.
 * Robuste : ne plante pas si le fichier musique est absent.
 */
window.AppAudio = {
    music: null,
    isMusicPlaying: false,
    currentPrioritySound: null, // 'voice' ou 'video'
    _musicLoadFailed: false,

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
     * Lance la musique de fond en fondu
     */
    playMusic: function() {
        if (!this.music || this._musicLoadFailed) {
            console.warn("AppAudio: musique non disponible");
            return;
        }
        // Si déjà en cours, ne rien faire
        if (this.isMusicPlaying && this.music.volume > 0) return;

        const playPromise = this.music.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.fadeVolume(this.music, window.AppConfig.VOLUME_MUSIQUE || 0.3, 2000);
                    this.isMusicPlaying = true;
                })
                .catch(e => {
                    console.warn("AppAudio: lecture bloquée par le navigateur", e);
                    this._musicLoadFailed = true;
                });
        }
    },

    /**
     * Gère la priorité : coupe la musique pour un autre son
     */
    setPrioritySound: function(type) {
        if (!this.music || this._musicLoadFailed) return;

        if (type === 'none') {
            this.currentPrioritySound = null;
            if (this.isMusicPlaying) this.fadeVolume(this.music, window.AppConfig.VOLUME_MUSIQUE || 0.3, 1000);
        } else {
            this.currentPrioritySound = type;
            this.fadeVolume(this.music, 0, 500);
        }
    },

    /**
     * Met la musique EN PAUSE en fondu (fenêtre vidéo ouverte).
     * La position au moment de la pause est conservée : la reprise
     * (resumeAfterVideo) repart exactement là où elle s'était arrêtée.
     * Retourne une Promise (résolue quand la musique est bien en pause).
     */
    pauseForVideo: function() {
        if (!this.music || this._musicLoadFailed) return Promise.resolve();
        // Musique jamais lancée : rien à couper (et resumeAfterVideo ne la démarrera pas)
        if (!this.isMusicPlaying) return Promise.resolve();

        // Fondu rapide vers 0 puis pause
        this.fadeVolume(this.music, 0, 500);
        return new Promise(resolve => {
            setTimeout(() => {
                try { this.music.pause(); } catch (e) { /* sans gravité */ }
                resolve();
            }, 550);
        });
    },

    /**
     * Reprend la musique EN FONDU après la vidéo (fermeture ou fin de vidéo).
     * Repart de la position mémorisée par la pause. Si la musique n'était
     * pas en cours avant la vidéo, ne fait rien.
     */
    resumeAfterVideo: function() {
        if (!this.music || this._musicLoadFailed) return;
        if (!this.isMusicPlaying) return; // elle n'était pas en cours : pas de reprise

        this.music.volume = 0; // repart silencieuse, le fondu remonte le volume
        const playPromise = this.music.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.fadeVolume(this.music, window.AppConfig.VOLUME_MUSIQUE || 0.3, 1200);
                })
                .catch(() => {
                    // Reprise bloquée par le navigateur : sans gravité
                    console.warn("AppAudio: reprise de la musique bloquée");
                });
        }
    },

    fadeVolume: function(audio, target, duration) {
        if (!audio || this._musicLoadFailed) return;
        const startVol = audio.volume;
        const diff = target - startVol;
        if (Math.abs(diff) < 0.01) return; // Déjà cible
        const startTime = performance.now();

        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            audio.volume = startVol + (diff * progress);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
};
