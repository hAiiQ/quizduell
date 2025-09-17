const socket = io();
let isAdmin = false;
let lobbyId = '';
let jitsiApi = null;
let jitsiLoadAttempts = 0;
let jitsiMode = 'api'; // 'api' or 'iframe'

// Global functions for HTML buttons - MUST be outside DOMContentLoaded
window.retryJitsiLoad = function() {
    console.log('🔄 Retrying Jitsi load...');
    jitsiLoadAttempts++;
    
    const loadingIndicator = document.getElementById('jitsi-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
        loadingIndicator.innerHTML = `
            <div>🔄 Erneuter Ladeversuch (${jitsiLoadAttempts})...</div>
            <div style="font-size: 14px; margin-top: 10px;">Raum: jeopardy-lobby-${lobbyId}</div>
            <div style="margin-top: 15px;">
                <div class="loading-spinner" style="border: 3px solid #555; border-top: 3px solid #0066cc; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
        `;
    }
    
    if (window.jitsiApiLoaded) {
        loadJitsiWithAPI(`jeopardy-lobby-${lobbyId}`);
    } else {
        loadJitsiWithIframe(`jeopardy-lobby-${lobbyId}`);
    }
};

window.useJitsiIframe = function() {
    console.log('📺 Switching to iframe mode');
    loadJitsiWithIframe(`jeopardy-lobby-${lobbyId}`);
};

// Load Jitsi using iframe fallback - GLOBAL function
window.loadJitsiWithIframe = function(roomName) {
    console.log('📺 Loading Jitsi via iframe fallback');
    jitsiMode = 'iframe';
    
    const iframe = document.getElementById('jitsi-iframe-fallback');
    const mainContainer = document.getElementById('jitsi-meet');
    
    if (iframe && mainContainer) {
        // Clear any existing content
        mainContainer.innerHTML = '';
        
        // Set up the iframe
        iframe.src = `https://meet.jit.si/${roomName}`;
        iframe.style.display = 'block';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '10px';
        
        // Add iframe to container
        mainContainer.appendChild(iframe);
        
        setTimeout(() => {
            hideJitsiLoading();
            console.log('✅ Jitsi iframe loaded');
        }, 2000);
    } else {
        console.error('❌ Iframe elements not found');
    }
};

// Hide loading indicator - GLOBAL function  
window.hideJitsiLoading = function() {
    const loadingIndicator = document.getElementById('jitsi-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Get lobby ID from URL
    lobbyId = window.location.pathname.split('/').pop();
    document.getElementById('lobbyId').textContent = lobbyId;
    
    const startGameBtn = document.getElementById('startGameBtn');
    const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
    const adminActions = document.getElementById('adminActions');
    
    // Check if all required elements exist before proceeding
    if (!startGameBtn || !leaveLobbyBtn || !adminActions) {
        console.error('❌ Required lobby elements not found');
        return;
    }

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

    // Jitsi Meet initialization - robust with multiple fallbacks
    function initializeJitsiMeet() {
        const roomName = `jeopardy-lobby-${lobbyId}`;
        console.log(`🎥 Initializing Jitsi Meet room: ${roomName}`);
        
        // Update room name display
        const roomNameElement = document.getElementById('jitsiRoomName');
        if (roomNameElement) {
            roomNameElement.textContent = roomName;
        }
        
        // Update direct link
        const directLink = document.getElementById('directJitsiLink');
        if (directLink) {
            directLink.href = `https://meet.jit.si/${roomName}`;
        }
        
        // Set up API ready callback
        window.jitsiApiReadyCallback = function() {
            console.log('� Jitsi API ready, initializing...');
            loadJitsiWithAPI(roomName);
        };
        
        // Set up API error callback  
        window.jitsiApiErrorCallback = function() {
            console.warn('⚠️ Jitsi API failed, using iframe fallback');
            loadJitsiWithIframe(roomName);
        };
        
        // If API already loaded, initialize immediately
        if (window.jitsiApiLoaded) {
            loadJitsiWithAPI(roomName);
        } else {
            // Wait a bit for API, then fallback to iframe
            setTimeout(() => {
                if (!window.jitsiApiLoaded && !jitsiApi) {
                    console.warn('⏰ Jitsi API timeout, using iframe');
                    loadJitsiWithIframe(roomName);
                }
            }, 5000);
        }
    }
    
    // Load Jitsi using the External API
    function loadJitsiWithAPI(roomName) {
        if (jitsiApi) {
            console.log('🔄 Disposing existing Jitsi API instance');
            jitsiApi.dispose();
        }
        
        try {
            const options = {
                roomName: roomName,
                width: '100%',
                height: '100%',
                parentNode: document.querySelector('#jitsi-meet'),
                configOverwrite: {
                    startWithAudioMuted: true,
                    startWithVideoMuted: false,
                    enableWelcomePage: false,
                    prejoinPageEnabled: false,
                    disableModeratorIndicator: false,
                    toolbarButtons: [
                        'microphone', 'camera', 'closedcaptions', 'desktop', 
                        'fullscreen', 'fodeviceselection', 'hangup', 'profile', 
                        'chat', 'settings', 'videoquality', 'filmstrip'
                    ]
                },
                interfaceConfigOverwrite: {
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    SHOW_BRAND_WATERMARK: false,
                    APP_NAME: "Jeopardy Video Chat"
                }
            };
            
            console.log('🔧 Creating Jitsi API instance...');
            jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', options);
            jitsiMode = 'api';
            
            // Event listeners
            jitsiApi.addEventListener('videoConferenceJoined', () => {
                console.log('✅ Successfully joined Jitsi room via API');
                hideJitsiLoading();
                
                // Set display name from player data
                const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
                if (playerData.name) {
                    jitsiApi.executeCommand('displayName', playerData.name);
                }
            });
            
            jitsiApi.addEventListener('videoConferenceLeft', () => {
                console.log('👋 Left Jitsi room');
            });
            
            jitsiApi.addEventListener('participantJoined', (participant) => {
                console.log('👥 New participant joined:', participant.displayName);
            });
            
            // Hide loading after successful initialization
            setTimeout(hideJitsiLoading, 2000);
            
        } catch (error) {
            console.error('❌ Jitsi API initialization failed:', error);
            loadJitsiWithIframe(roomName);
        }
    }
    
    // Load Jitsi using iframe fallback
    function loadJitsiWithIframe(roomName) {
        console.log('📺 Loading Jitsi via iframe fallback');
        jitsiMode = 'iframe';
        
        const iframe = document.getElementById('jitsi-iframe-fallback');
        const mainContainer = document.getElementById('jitsi-meet');
        
        if (iframe && mainContainer) {
            // Clear any existing API content
            const apiContent = mainContainer.querySelector('.jitsi-iframe-fallback');
            if (!apiContent) {
                mainContainer.innerHTML = '';
                mainContainer.appendChild(iframe);
            }
            
            iframe.src = `https://meet.jit.si/${roomName}`;
            iframe.style.display = 'block';
            
            setTimeout(() => {
                hideJitsiLoading();
                console.log('✅ Jitsi iframe loaded');
            }, 3000);
        }
    }
    
    // Hide loading indicator
    function hideJitsiLoading() {
        const loadingIndicator = document.getElementById('jitsi-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
    
    // Functions already defined globally above

    // Initialize Jitsi Meet after all elements are confirmed to exist
    // Start with iframe immediately for reliability
    setTimeout(() => {
        console.log('🚀 Starting with Jitsi iframe for immediate loading');
        loadJitsiWithIframe(`jeopardy-lobby-${lobbyId}`);
    }, 1000);

    // Start game (admin only)
    startGameBtn.addEventListener('click', function() {
        socket.emit('startGame');
    });

    // Leave lobby
    leaveLobbyBtn.addEventListener('click', function() {
        if (confirm('Möchtest du die Lobby wirklich verlassen?')) {
            // Clean up Jitsi
            if (jitsiApi && jitsiMode === 'api') {
                try {
                    jitsiApi.dispose();
                } catch (error) {
                    console.warn('Error disposing Jitsi API:', error);
                }
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
        console.log('🔄 Players update received:', data);
        updatePlayersDisplay(data);
        // Video display now handled by Jitsi Meet
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

    // Video display handled by Jitsi Meet with robust fallback system
    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (jitsiApi && jitsiMode === 'api') {
            try {
                jitsiApi.dispose();
            } catch (error) {
                console.warn('Error disposing Jitsi API on unload:', error);
            }
        }
    });
});