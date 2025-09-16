const socket = io();
let isAdmin = false;
let lobbyId = '';
let localStream = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get lobby ID from URL
    lobbyId = window.location.pathname.split('/').pop();
    document.getElementById('lobbyId').textContent = lobbyId;

    const startGameBtn = document.getElementById('startGameBtn');
    const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
    const toggleCameraBtn = document.getElementById('toggleCameraBtn');
    const localVideo = document.getElementById('localVideo');
    const adminActions = document.getElementById('adminActions');

    // Join the lobby (reconnect)
    const playerData = sessionStorage.getItem('playerData');
    if (playerData) {
        const data = JSON.parse(playerData);
        console.log('Joining/Rejoining lobby with data:', data);
        
        // Always try rejoin first (handles both new joins and reconnects better)
        socket.emit('rejoinLobby', { 
            lobbyId, 
            playerName: data.name, 
            isAdmin: data.isAdmin 
        });
    } else {
        console.log('No player data found, redirecting to home');
        window.location.href = '/';
        return;
    }

    // Webcam functionality
    toggleCameraBtn.addEventListener('click', async function() {
        if (!localStream) {
            try {
                // Check if getUserMedia is available
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('getUserMedia ist in diesem Browser nicht verfügbar');
                }
                
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 320 },
                        height: { ideal: 240 },
                        facingMode: 'user'
                    }, 
                    audio: false 
                });
                
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
                toggleCameraBtn.textContent = 'Kamera deaktivieren';
                toggleCameraBtn.style.background = '#dc3545';
                
                console.log('Camera activated successfully');
            } catch (error) {
                console.error('Camera access error:', error);
                
                let errorMessage = 'Fehler beim Zugriff auf die Kamera.\n\n';
                
                switch (error.name) {
                    case 'NotAllowedError':
                        errorMessage += 'Kamera-Berechtigung wurde verweigert. Bitte erlaube den Kamera-Zugriff in den Browser-Einstellungen.';
                        break;
                    case 'NotFoundError':
                        errorMessage += 'Keine Kamera gefunden. Stelle sicher, dass eine Kamera angeschlossen ist.';
                        break;
                    case 'NotReadableError':
                        errorMessage += 'Kamera wird bereits von einer anderen Anwendung verwendet.';
                        break;
                    case 'OverconstrainedError':
                        errorMessage += 'Kamera-Einstellungen werden nicht unterstützt.';
                        break;
                    case 'SecurityError':
                        errorMessage += 'Sicherheitsfehler. Stelle sicher, dass die Seite über HTTPS geladen wird.';
                        break;
                    default:
                        errorMessage += `Unbekannter Fehler: ${error.message}`;
                }
                
                alert(errorMessage);
            }
        } else {
            // Stop camera
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
            localVideo.srcObject = null;
            localVideo.style.display = 'none';
            toggleCameraBtn.textContent = 'Kamera aktivieren';
            toggleCameraBtn.style.background = '#28a745';
            
            console.log('Camera deactivated');
        }
    });

    // Start game (admin only)
    startGameBtn.addEventListener('click', function() {
        socket.emit('startGame');
    });

    // Leave lobby
    leaveLobbyBtn.addEventListener('click', function() {
        if (confirm('Möchtest du die Lobby wirklich verlassen?')) {
            // Stop camera if active
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            
            sessionStorage.removeItem('playerData');
            window.location.href = '/';
        }
    });

    // Socket event handlers
    socket.on('joinedLobby', function(data) {
        isAdmin = data.isAdmin;
        if (isAdmin) {
            adminActions.style.display = 'block';
        }
        
        // Store player data
        const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
        playerData.isAdmin = isAdmin;
        sessionStorage.setItem('playerData', JSON.stringify(playerData));
    });

    socket.on('playersUpdate', function(data) {
        updatePlayersDisplay(data);
    });

    socket.on('gameStarted', function(data) {
        console.log('Game started:', data);
        
        // Store game data for the game page
        sessionStorage.setItem('gameData', JSON.stringify(data));
        
        // Redirect to game
        window.location.href = `/game/${lobbyId}`;
    });

    socket.on('lobbyDisconnected', function(message) {
        alert(message);
        sessionStorage.removeItem('playerData');
        window.location.href = '/';
    });

    socket.on('error', function(message) {
        alert(message);
        if (message === 'Lobby nicht gefunden') {
            window.location.href = '/';
        }
    });

    function updatePlayersDisplay(data) {
        // Update admin info
        const adminInfo = document.getElementById('adminInfo');
        adminInfo.querySelector('.player-name').textContent = data.admin.name;

        // Update players list
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        playersList.innerHTML = '';
        
        data.players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = `
                <span class="player-name">${player.name}</span>
                <span class="player-number">Spieler ${index + 1}</span>
            `;
            playersList.appendChild(playerCard);
        });
        
        playerCount.textContent = data.players.length;
        
        // Update start button state
        if (isAdmin) {
            startGameBtn.disabled = data.players.length === 0;
        }
    }

    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    });
});