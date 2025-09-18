const socket = io();
let isAdmin = false;
let lobbyId = '';

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
});