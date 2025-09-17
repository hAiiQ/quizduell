const socket = io();
let isAdmin = false;
let lobbyId = '';
let wherebyLoaded = false;

document.addEventListener('DOMContentLoaded', function() {
    // Get lobby ID from URL
    lobbyId = window.location.pathname.split('/').pop();
    document.getElementById('lobbyId').textContent = lobbyId;
    
    // Initialize Whereby - much simpler and faster than Jitsi
    initializeWhereby();

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

    // Whereby initialization - much simpler than Jitsi!
    function initializeWhereby() {
        const roomName = `jeopardy-lobby-${lobbyId}`;
        const wherebyUrl = `https://whereby.com/${roomName}`;
        
        console.log(`🎥 Initializing Whereby room: ${roomName}`);
        console.log(`🔗 Whereby URL: ${wherebyUrl}`);
        
        // Update room name display
        document.getElementById('wherebyRoomName').textContent = roomName;
        
        // Update direct link
        const directLink = document.getElementById('directWherebyLink');
        if (directLink) {
            directLink.href = wherebyUrl;
            console.log(`🔗 Direct Whereby link updated: ${wherebyUrl}`);
        }
        
        // Load Whereby in iframe - no complex API needed!
        const iframe = document.getElementById('wherebyFrame');
        // Add embed parameter for better integration
        iframe.src = `${wherebyUrl}?embed&displayName=Spieler&background=off`;
        
        // Hide loading indicator after iframe loads
        iframe.onload = function() {
            console.log('✅ Whereby loaded successfully!');
            document.getElementById('loadingIndicator').style.display = 'none';
            wherebyLoaded = true;
        };
        
        // Fallback: hide loading after 3 seconds even if onload doesn't fire
        setTimeout(() => {
            if (!wherebyLoaded) {
                console.log('⏰ Whereby load timeout - hiding loading indicator');
                document.getElementById('loadingIndicator').style.display = 'none';
            }
        }, 3000);
    }

    // Start game (admin only)
    startGameBtn.addEventListener('click', function() {
        socket.emit('startGame');
    });

    // Leave lobby
    leaveLobbyBtn.addEventListener('click', function() {
        if (confirm('Möchtest du die Lobby wirklich verlassen?')) {
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

    // Video display now handled by Whereby - much simpler!
    // No cleanup needed for Whereby iframes
});