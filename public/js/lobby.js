const socket = io();
let isAdmin = false;
let lobbyId = '';
let localStream = null;
let videoCaptureInterval = null;

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
                
                // Notify server about camera activation
                socket.emit('toggleCamera', true);
                
                // Start sending video frames
                startVideoCapture();
                
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
            
            // Notify server about camera deactivation
            socket.emit('toggleCamera', false);
            
            // Stop video capture
            stopVideoCapture();
            
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
        updateVideoDisplay(data);
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

    function updateVideoDisplay(data) {
        const remoteVideos = document.getElementById('remoteVideos');
        remoteVideos.innerHTML = '';
        
        // Show admin video if current user is not admin
        const currentPlayerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
        if (!currentPlayerData.isAdmin) {
            const adminContainer = createVideoContainer(data.admin.name, data.admin.cameraActive, data.admin.id);
            remoteVideos.appendChild(adminContainer);
        }
        
        // Show other players videos
        data.players.forEach((player, index) => {
            // Don't show own video in remote section
            if (player.name !== currentPlayerData.name) {
                const playerContainer = createVideoContainer(player.name, player.cameraActive, player.id);
                remoteVideos.appendChild(playerContainer);
            }
        });
    }
    
    function createVideoContainer(playerName, cameraActive, playerId) {
        const container = document.createElement('div');
        container.className = 'video-container';
        container.setAttribute('data-player-id', playerId);
        
        const videoElement = cameraActive ? 
            '<img class="video-stream webcam-preview" src="" alt="Video Stream" style="display: block;">' :
            '<div class="video-placeholder">📷<br>Kamera aus</div>';
        
        container.innerHTML = `
            ${videoElement}
            <div class="video-label">${playerName}</div>
            <div class="video-status">${cameraActive ? 'Kamera an' : 'Kamera aus'}</div>
        `;
        
        return container;
    }

    function startVideoCapture() {
        if (videoCaptureInterval) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const localVideo = document.getElementById('localVideo');
        
        canvas.width = 320;
        canvas.height = 240;
        
        videoCaptureInterval = setInterval(() => {
            if (localStream && localVideo.videoWidth > 0) {
                // Draw current video frame to canvas
                ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
                
                // Convert to base64 image
                const imageData = canvas.toDataURL('image/jpeg', 0.6);
                
                // Send to server
                socket.emit('videoFrame', {
                    image: imageData,
                    timestamp: Date.now()
                });
            }
        }, 1000); // Send frame every second (low frequency to avoid overload)
    }
    
    function stopVideoCapture() {
        if (videoCaptureInterval) {
            clearInterval(videoCaptureInterval);
            videoCaptureInterval = null;
        }
    }

    // Handle incoming video frames from other players
    socket.on('videoFrame', function(data) {
        const { playerId, playerName, image } = data;
        
        // Find the video container for this player
        const remoteVideos = document.getElementById('remoteVideos');
        let videoContainer = remoteVideos.querySelector(`[data-player-id="${playerId}"]`);
        
        if (videoContainer) {
            const imgElement = videoContainer.querySelector('.video-stream');
            if (imgElement) {
                imgElement.src = image;
            }
        }
    });

    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        stopVideoCapture();
    });
});