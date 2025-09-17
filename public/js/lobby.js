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
        
        console.log(`Creating video container for ${playerName} (${playerId}) - Camera: ${cameraActive}`);
        
        const videoElement = cameraActive ? 
            '<img class="video-stream webcam-preview" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2NjYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfk7kgV2FydGUgYXVmIFZpZGVvLi4uPC90ZXh0Pjwvc3ZnPg==" alt="Video Stream" style="display: block;">' :
            '<div class="video-placeholder">📷<br>Kamera aus</div>';
        
        container.innerHTML = `
            ${videoElement}
            <div class="video-label">${playerName}</div>
            <div class="video-status">${cameraActive ? 'Warte auf Video...' : 'Kamera aus'}</div>
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
                try {
                    // Draw current video frame to canvas
                    ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to base64 image
                    const imageData = canvas.toDataURL('image/jpeg', 0.7);
                    
                    // Send to server
                    socket.emit('videoFrame', {
                        image: imageData,
                        timestamp: Date.now()
                    });
                    
                    console.log('📤 Video frame sent successfully');
                } catch (error) {
                    console.error('Error capturing video frame:', error);
                }
            } else {
                console.log('Waiting for video to be ready...');
            }
        }, 100); // Send frame every 100ms = 10 FPS
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
        
        console.log(`📹 Received video frame from ${playerName} (${playerId})`);
        
        // Find the video container for this player
        const remoteVideos = document.getElementById('remoteVideos');
        let videoContainer = remoteVideos.querySelector(`[data-player-id="${playerId}"]`);
        
        console.log(`Looking for container with player ID: ${playerId}`);
        console.log(`Found container:`, videoContainer);
        
        if (videoContainer) {
            const imgElement = videoContainer.querySelector('.video-stream');
            console.log(`Found img element:`, imgElement);
            
            if (imgElement) {
                imgElement.src = image;
                imgElement.style.display = 'block';
                
                // Update status
                const statusElement = videoContainer.querySelector('.video-status');
                if (statusElement) {
                    statusElement.textContent = '🎥 Live-Stream aktiv';
                    statusElement.style.color = '#28a745';
                }
                
                console.log(`✅ Video frame applied for ${playerName}`);
            } else {
                console.log(`❌ No img element found in container for ${playerName}`);
            }
        } else {
            console.log(`❌ No video container found for player ${playerName} (${playerId})`);
            console.log('Available containers:', remoteVideos.querySelectorAll('[data-player-id]'));
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