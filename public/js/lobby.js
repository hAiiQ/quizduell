const socket = io();
let isAdmin = false;
let lobbyId = '';
let jitsiApi = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get lobby ID from URL
    lobbyId = window.location.pathname.split('/').pop();
    document.getElementById('lobbyId').textContent = lobbyId;
    
    // Initialize Jitsi Meet with delay to ensure API is loaded
    let attempts = 0;
    const maxAttempts = 10;
    
    function checkAndInitializeJitsi() {
        attempts++;
        
        if (typeof JitsiMeetExternalAPI !== 'undefined') {
            console.log('✅ JitsiMeetExternalAPI found, initializing...');
            initializeJitsi();
        } else if (attempts < maxAttempts) {
            console.log(`⏳ Waiting for Jitsi API... (${attempts}/${maxAttempts})`);
            setTimeout(checkAndInitializeJitsi, 500);
        } else {
            console.error('❌ JitsiMeetExternalAPI failed to load after maximum attempts');
            // Fallback: Load Jitsi in iframe
            const roomName = `jeopardy-lobby-${lobbyId}`;
            document.querySelector('#jitsi-meet').innerHTML = `
                <iframe 
                    src="https://meet.jit.si/${roomName}" 
                    style="width: 100%; height: 100%; border: none; border-radius: 10px;"
                    allow="camera; microphone; fullscreen; display-capture">
                </iframe>
            `;
            console.log('✅ Jitsi loaded via iframe fallback');
        }
    }
    
    checkAndInitializeJitsi();

    const startGameBtn = document.getElementById('startGameBtn');
    const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
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

    // Jitsi Meet initialization
    function initializeJitsi() {
        const roomName = `jeopardy-lobby-${lobbyId}`;
        document.getElementById('jitsiRoomName').textContent = roomName;
        
        // Update direct link - WICHTIG: Muss vor der Jitsi Initialisierung stehen
        const directLink = document.getElementById('directJitsiLink');
        if (directLink) {
            directLink.href = `https://meet.jit.si/${roomName}`;
            directLink.textContent = 'Video-Chat direkt bei Jitsi öffnen';
            console.log(`🔗 Direct Jitsi link updated: https://meet.jit.si/${roomName}`);
        }
        
        console.log(`🎥 Initializing Jitsi Meet room: ${roomName}`);
        
        // Check if JitsiMeetExternalAPI is loaded
        if (typeof JitsiMeetExternalAPI === 'undefined') {
            console.error('❌ JitsiMeetExternalAPI is not loaded');
            document.querySelector('#jitsi-meet').innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff4444; text-align: center;">
                    <div>❌ Jitsi Meet API konnte nicht geladen werden</div>
                    <div style="font-size: 12px; margin-top: 10px;">Versuche die Seite neu zu laden</div>
                    <button onclick="window.location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 5px; cursor: pointer;">Neu laden</button>
                </div>
            `;
            return;
        }
        
        const domain = 'meet.jit.si';
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
                disableModeratorIndicator: true,
                startScreenSharing: false,
                enableEmailInStats: false
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: [
                    'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                    'fodeviceselection', 'hangup', 'profile', 'chat', 'settings', 'videoquality',
                    'filmstrip', 'feedback', 'stats', 'shortcuts'
                ],
                SETTINGS_SECTIONS: ['devices', 'language'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                SHOW_BRAND_WATERMARK: false,
                BRAND_WATERMARK_LINK: "",
                SHOW_POWERED_BY: false,
                DISPLAY_WELCOME_PAGE_CONTENT: false,
                DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
                APP_NAME: "Jeopardy Video Chat"
            }
        };
        
        try {
            jitsiApi = new JitsiMeetExternalAPI(domain, options);
            
            jitsiApi.addEventListener('videoConferenceJoined', () => {
                console.log('✅ Successfully joined Jitsi room');
                const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
                jitsiApi.executeCommand('displayName', playerData.name || 'Spieler');
            });
            
            jitsiApi.addEventListener('participantJoined', (participant) => {
                console.log('👥 New participant joined:', participant.displayName);
            });
            
            jitsiApi.addEventListener('participantLeft', (participant) => {
                console.log('👋 Participant left:', participant.displayName);
            });
            
            console.log('🎥 Jitsi Meet initialized successfully');
            
        } catch (error) {
            console.error('❌ Jitsi initialization failed:', error);
            document.querySelector('#jitsi-meet').innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff4444; text-align: center;">
                    <div>❌ Video-Chat konnte nicht geladen werden</div>
                    <div style="font-size: 12px; margin-top: 10px;">Fehler: ${error.message}</div>
                    <button onclick="initializeJitsi()" style="margin-top: 10px; padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 5px; cursor: pointer;">Erneut versuchen</button>
                    <div style="font-size: 12px; margin-top: 10px;">Oder <a href="https://meet.jit.si/jeopardy-lobby-${lobbyId}" target="_blank" style="color: #0066cc;">direkt bei Jitsi öffnen</a></div>
                </div>
            `;
        }
    }

    // Start game (admin only)
    startGameBtn.addEventListener('click', function() {
        socket.emit('startGame');
    });

    // Leave lobby
    leaveLobbyBtn.addEventListener('click', function() {
        if (confirm('Möchtest du die Lobby wirklich verlassen?')) {
            // Disconnect from Jitsi
            if (jitsiApi) {
                jitsiApi.dispose();
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

    // Force load Jitsi Meet function (global for HTML onclick)
    window.forceLoadJitsi = function() {
        console.log('🔄 Force loading Jitsi Meet...');
        document.querySelector('#jitsi-meet').innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ccc; text-align: center;">
                <div>🔄 Erzwinge Video-Chat Laden...</div>
            </div>
        `;
        setTimeout(() => {
            initializeJitsi();
        }, 500);
    };

    // Video display now handled by Jitsi Meet - no custom functions needed
    // Handle page unload
    window.addEventListener('beforeunload', function() {
        // Disconnect from Jitsi
        if (jitsiApi) {
            jitsiApi.dispose();
        }
    });
});