const socket = io();
let isAdmin = false;
let lobbyId = '';

// Debug socket connection
socket.on('connect', function() {
    console.log('✅ Socket connected to server');
});

socket.on('disconnect', function() {
    console.log('❌ Socket disconnected from server');
});

socket.on('connect_error', function(error) {
    console.error('❌ Socket connection error:', error);
});

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
        console.log('🔄 Joining/Rejoining lobby with data:', data);
        console.log('🏠 Lobby ID:', lobbyId);
        
        // Add loading indicator
        document.body.innerHTML += '<div id="loadingIndicator" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; z-index: 9999;">🔄 Trete Lobby bei...</div>';
        
        // Always try rejoin first (handles both new joins and reconnects better)
        socket.emit('rejoinLobby', { 
            lobbyId, 
            playerName: data.name, 
            isAdmin: data.isAdmin 
        });
        
        // Set timeout as fallback
        setTimeout(() => {
            const loading = document.getElementById('loadingIndicator');
            if (loading) {
                loading.remove();
                console.error('❌ Timeout: Lobby beitritt fehlgeschlagen');
                alert('❌ Fehler beim Beitreten zur Lobby. Versuche es erneut.');
                window.location.href = '/';
            }
        }, 10000); // 10 Sekunden timeout
        
    } else {
        console.log('❌ No player data found, redirecting to home');
        window.location.href = '/';
        return;
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
        console.log('✅ Successfully joined lobby:', data);
        
        // Remove loading indicator
        const loading = document.getElementById('loadingIndicator');
        if (loading) loading.remove();
        
        isAdmin = data.isAdmin;
        if (isAdmin) {
            adminActions.style.display = 'block';
            console.log('🔧 Admin controls enabled');
        }
        
        // Store player data
        const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
        playerData.isAdmin = isAdmin;
        sessionStorage.setItem('playerData', JSON.stringify(playerData));
    });

    socket.on('playersUpdate', function(data) {
        console.log('🔄 Players update received:', data);
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
        console.error('❌ Lobby error:', message);
        
        // Remove loading indicator
        const loading = document.getElementById('loadingIndicator');
        if (loading) loading.remove();
        
        alert('❌ ' + message);
        if (message === 'Lobby nicht gefunden' || message.includes('nicht gefunden')) {
            window.location.href = '/';
        }
    });
    
    // Add general socket error handler
    socket.on('rejoinError', function(message) {
        console.error('❌ Rejoin error:', message);
        
        // Remove loading indicator  
        const loading = document.getElementById('loadingIndicator');
        if (loading) loading.remove();
        
        alert('❌ Fehler beim Beitreten: ' + message);
        window.location.href = '/';
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
});