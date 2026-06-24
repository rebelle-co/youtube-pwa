document.addEventListener('DOMContentLoaded', async () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const blockAdsToggle = document.getElementById('blockAdsToggle');
    const backgroundPlayToggle = document.getElementById('backgroundPlayToggle');
    const videoUrlInput = document.getElementById('videoUrlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const ytMusicBtn = document.getElementById('ytMusicBtn');
    const openPlaylistBtn = document.getElementById('openPlaylistBtn');

    let db;

    // 1. Initialiser IndexedDB dans le popup pour pouvoir y enregistrer les fichiers
    const dbRequest = indexedDB.open("OfflineYouTubeDB", 1);
    dbRequest.onsuccess = (event) => { db = event.target.result; };

    // 2. Gestion de l'état des switchs (Sauvegarde locale)
    chrome.storage.local.get(['darkMode', 'blockAds', 'backgroundPlay'], (result) => {
        const isDark = result.darkMode !== undefined ? result.darkMode : true;
        darkModeToggle.checked = isDark;
        if (!isDark) document.body.classList.add('light-mode');

        if (result.blockAds !== undefined) blockAdsToggle.checked = result.blockAds;
        if (result.backgroundPlay !== undefined) backgroundPlayToggle.checked = result.backgroundPlay;
    });

    darkModeToggle.addEventListener('change', () => {
        chrome.storage.local.set({ darkMode: darkModeToggle.checked });
        document.body.classList.toggle('light-mode', !darkModeToggle.checked);
    });

    blockAdsToggle.addEventListener('change', () => {
        chrome.storage.local.set({ blockAds: blockAdsToggle.checked });
        sendMessageToActiveTab({ action: "toggleAds", value: blockAdsToggle.checked });
    });

    backgroundPlayToggle.addEventListener('change', () => {
        chrome.storage.local.set({ backgroundPlay: backgroundPlayToggle.checked });
        sendMessageToActiveTab({ action: "toggleBackground", value: backgroundPlayToggle.checked });
    });

    // 3. Préremplir l'URL si on est sur une vidéo YouTube
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url.includes('youtube.com/watch')) {
        videoUrlInput.value = tab.url;
    }

    // 4. MÉTHODE 1 : Téléchargement et enregistrement hors-ligne
    downloadBtn.addEventListener('click', async () => {
        const url = videoUrlInput.value.trim();
        if (!url) {
            alert('Veuillez entrer une URL valide.');
            return;
        }

        downloadBtn.disabled = true;
        downloadBtn.textContent = "Conversion en cours...";

        try {
            // Utilisation d'une API publique de conversion YouTube en MP4 (no-api-key requise)
            // Note : Ces APIs publiques peuvent changer d'adresse. En production, on utilise souvent son propre serveur de conversion (yt-dlp).
            const apiUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://youtube-downloader-api.example.com/api/convert?url=' + url)}`; 
            
            // Pour l'exemple et s'assurer que ça ne crash pas, nous utilisons un tunnel de fetch vers un convertisseur direct
            // Simuler l'appel à une API de récupération de lien direct MP4 :
            const formatUrl = `https://v2.convertapi.com/v2/download?url=${encodeURIComponent(url)}`; 
            
            // Remplaçons par une API de secours stable qui renvoie un flux binaire MP4
            downloadBtn.textContent = "Téléchargement des données (0%)...";
            
            // 1. Demander le fichier vidéo à l'API de conversion
            // (Ici nous utilisons un service d'extraction standard)
            const videoTitle = tab && tab.title ? tab.title.replace(" - YouTube", "") : "Vidéo YouTube";
            
            // Simuler une requête de flux (Fetch du MP4 via le convertisseur tiers)
            // Pour le test, on passe par un serveur de débridage de lien
            const response = await fetch(`https://co.wuk.sh/api/json`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ url: url, vQuality: "720" })
            });
            
            const data = await response.json();
            
            if (data && data.url) {
                downloadBtn.textContent = "Enregistrement local...";
                
                // 2. Télécharger le fichier sous forme de Blob (Données binaires)
                const videoFile = await fetch(data.url);
                const videoBlob = await videoFile.blob();

                // 3. Sauvegarder dans notre IndexedDB "OfflineYouTubeDB"
                const transaction = db.transaction(["videos"], "readwrite");
                const store = transaction.objectStore("videos");
                
                const newVideo = {
                    title: videoTitle,
                    blobData: videoBlob,
                    addedAt: new Date().getTime()
                };
                
                store.add(newVideo);

                transaction.oncomplete = () => {
                    downloadBtn.disabled = false;
                    downloadBtn.textContent = "Télécharger dans la Playlist";
                    alert("Succès ! Vidéo disponible dans ta playlist hors-ligne.");
                };
            } else {
                throw new Error("Impossible de récupérer le flux vidéo.");
            }

        } catch (error) {
            console.error(error);
            downloadBtn.disabled = false;
            downloadBtn.textContent = "Télécharger dans la Playlist";
            alert("Erreur lors de la conversion. L'API tierce est peut-être saturée. Réessaie.");
        }
    });

    // 5. Liens complémentaires
    openPlaylistBtn.addEventListener('click', () => { chrome.tabs.create({ url: 'playlist.html' }); });
    ytMusicBtn.addEventListener('click', () => { chrome.tabs.create({ url: 'https://music.youtube.com' }); });
});

function sendMessageToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.runtime.sendMessage(tabs[0].id, message).catch(() => {});
        }
    });
}