let adsBlockingEnabled = true;
let backgroundPlayEnabled = true;

// Charger la configuration sauvegardée
chrome.storage.local.get(['blockAds', 'backgroundPlay'], (result) => {
    if (result.blockAds !== undefined) adsBlockingEnabled = result.blockAds;
    if (result.backgroundPlay !== undefined) backgroundPlayEnabled = result.backgroundPlay;
});

// Écouter les messages envoyés depuis le Popup (le panel)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleAds") {
        adsBlockingEnabled = request.value;
    }
    if (request.action === "toggleBackground") {
        backgroundPlayEnabled = request.value;
    }
});

// 1. Logique Anti-Pub améliorée
function skipYouTubeAds() {
    if (!adsBlockingEnabled) return; // Si désactivé dans le panel, on ne fait rien

    const adOverlays = document.querySelectorAll('.video-ads, .ytp-ad-module, #player-ads, ytd-promoted-sparkles-web-renderer');
    adOverlays.forEach(ad => ad.style.display = 'none');

    const moviePlayer = document.querySelector('.html5-video-player');
    const video = document.querySelector('video');

    if (moviePlayer && moviePlayer.classList.contains('ad-showing')) {
        if (video) {
            if (isFinite(video.duration)) {
                video.currentTime = video.duration - 0.1;
            }
            video.muted = true;
            video.playbackRate = 16; 
        }
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if (skipButton) skipButton.click();
    }
}

// 2. Logique "Lecture écran éteint / Arrière-plan"
// YouTube utilise l'API "VisibilityState" pour détecter si tu changes d'onglet et couper/pauser la vidéo. On va cloner et bloquer cette détection.
Object.defineProperty(document, 'visibilityState', {
    get: function() {
        return backgroundPlayEnabled ? 'visible' : 'hidden';
    }
});
Object.defineProperty(document, 'hidden', {
    get: function() {
        return backgroundPlayEnabled ? false : true;
    }
});

// Empêcher YouTube de recevoir l'événement de mise en arrière-plan
window.addEventListener('visibilitychange', (e) => {
    if (backgroundPlayEnabled) {
        e.stopImmediatePropagation();
    }
}, true);


// Observation de la page
const observer = new MutationObserver(() => {
    skipYouTubeAds();
});

window.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    skipYouTubeAds();
});