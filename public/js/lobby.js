const socket = io();
let isAdmin = false;
let lobbyId = '';

// Global functions for HTML buttons - Custom Jitsi System
window.loadCustomJitsi = function() {
    console.log('🔄 loadCustomJitsi function called!');
    
    const input = document.getElementById('jitsi-url-input');
    const iframe = document.getElementById('custom-jitsi-iframe');
    const welcome = document.getElementById('jitsi-welcome');
    
    console.log('📋 Elements found:', {
        input: !!input,
        iframe: !!iframe, 
        welcome: !!welcome
    });
    
    if (!input || !iframe) {
        console.error('❌ Jitsi elements not found');
        alert('❌ Fehler: Video-Elemente nicht gefunden');
        return;
    }
    
    let url = input.value.trim();
    
    // Validate and clean URL
    if (!url) {
        alert('❌ Bitte gib einen Jitsi-Link ein');
        return;
    }
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // Ensure it's a valid Jitsi URL
    if (!url.includes('meet.jit.si/')) {
        if (url.includes('jit.si')) {
            // Fix common URL issues
            url = url.replace('jit.si', 'meet.jit.si');
        } else {
            alert('❌ Bitte verwende einen gültigen Jitsi Meet Link (meet.jit.si/...)');
            return;
        }
    }
    
    console.log(`🎥 Loading custom Jitsi: ${url}`);
    
    // Hide welcome, show iframe
    if (welcome) welcome.style.display = 'none';
    iframe.src = url;
    iframe.style.display = 'block';
    
    // Update input with cleaned URL
    input.value = url;
    
    console.log('✅ Custom Jitsi loaded successfully');
};

window.clearJitsi = function() {
    const iframe = document.getElementById('custom-jitsi-iframe');
    const welcome = document.getElementById('jitsi-welcome');
    
    if (iframe) {
        iframe.src = '';
        iframe.style.display = 'none';
    }
    
    if (welcome) {
        welcome.style.display = 'block';
    }
    
    console.log('🧹 Jitsi cleared');
};

window.openInNewTab = function() {
    const input = document.getElementById('jitsi-url-input');
    
    if (input && input.value.trim()) {
        let url = input.value.trim();
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        window.open(url, '_blank');
        console.log(`🔗 Opened Jitsi in new tab: ${url}`);
    } else {
        alert('❌ Bitte gib erst einen Jitsi-Link ein');
    }
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

    // Initialize custom Jitsi system - much simpler!
    console.log('🎥 Custom Jitsi system ready - enter your own link above');
    
    // Initialize Jitsi Individual Tiles system
    console.log('🎥 Jitsi Individual Tiles system initialized');
    
    // Initialize Jitsi after lobby is loaded
    setTimeout(() => {
        if (typeof initializeJitsiTiles === 'function') {
            initializeJitsiTiles();
        }
    }, 1000);

    // Start game (admin only)
    startGameBtn.addEventListener('click', function() {
        socket.emit('startGame');
    });

    // Leave lobby
    leaveLobbyBtn.addEventListener('click', function() {
        if (confirm('Möchtest du die Lobby wirklich verlassen?')) {
            // Clean up Jitsi
            if (typeof cleanupJitsi === 'function') {
                cleanupJitsi();
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
        const adminVideoName = document.getElementById('admin-video-name');
        
        if (adminInfo) {
            adminInfo.querySelector('.player-name').textContent = data.admin.name;
        }
        
        if (adminVideoName) {
            adminVideoName.textContent = `👑 ${data.admin.name}`;
        }

        // Update players list
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        if (playersList) {
            playersList.innerHTML = '';
            
            data.players.forEach((player, index) => {
                const playerCard = document.createElement('div');
                playerCard.className = 'player-card';
                playerCard.innerHTML = `
                    <span class="player-name">${player.name}</span>
                    <span class="player-number">Spieler ${index + 1}</span>
                `;
                playersList.appendChild(playerCard);
                
                // Add video card for each player
                if (typeof addPlayerVideoCard === 'function') {
                    addPlayerVideoCard(player, index);
                }
            });
        }
        
        if (playerCount) {
            playerCount.textContent = data.players.length;
        }
        
        // Update start button state
        if (isAdmin) {
            startGameBtn.disabled = data.players.length === 0;
        }
        
        console.log(`📹 Updated display for ${data.players.length} players`);
    }

    // Individual camera system handles cleanup automatically
    console.log('✅ Lobby initialization complete with individual cameras');
});