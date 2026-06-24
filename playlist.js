let db;

// 1. Initialiser la base de données IndexedDB au chargement
const request = indexedDB.open("OfflineYouTubeDB", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    // Création d'un espace de stockage pour nos vidéos
    db.createObjectStore("videos", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = (event) => {
    db = event.target.result;
    loadPlaylist();
};

// 2. Charger et afficher la liste des vidéos stockées localement
function loadPlaylist() {
    const listContainer = document.getElementById("videosList");
    listContainer.innerHTML = "";

    const transaction = db.transaction(["videos"], "readonly");
    const store = transaction.objectStore("videos");
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
        const videos = getAllRequest.result;

        if (videos.length === 0) {
            listContainer.innerHTML = '<div class="no-video">Aucune vidéo téléchargée pour le moment.</div>';
            return;
        }

        videos.forEach(video => {
            const item = document.createElement("div");
            item.className = "video-item";
            
            item.innerHTML = `
                <span class="video-title">${video.title}</span>
                <button class="delete-btn" data-id="${video.id}">Supprimer</button>
            `;

            // Clic sur l'élément pour lancer la vidéo
            item.addEventListener('click', (e) => {
                if(e.target.classList.contains('delete-btn')) return; // Éviter de lancer si on clique sur supprimer
                playVideo(video);
            });

            // Gérer le bouton supprimer
            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                deleteVideo(video.id);
            });

            listContainer.appendChild(item);
        });
    };
}

// 3. Lire la vidéo dans le lecteur HTML5 (génère une URL de Blob local)
function playVideo(video) {
    const player = document.getElementById("mainPlayer");
    const titleHeader = document.getElementById("playingTitle");

    // Convertir le fichier binaire (Blob) stocké en URL utilisable par la balise <video>
    const videoUrl = URL.createObjectURL(video.blobData);
    player.src = videoUrl;
    titleHeader.textContent = video.title;
    player.play();
}

// 4. Supprimer une vidéo pour libérer de l'espace disque
function deleteVideo(id) {
    const transaction = db.transaction(["videos"], "readwrite");
    const store = transaction.objectStore("videos");
    store.delete(id);

    transaction.oncomplete = () => {
        loadPlaylist();
    };
}