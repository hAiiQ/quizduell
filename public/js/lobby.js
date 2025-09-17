const socket = io();
let isAdmin = false;
let lobbyId = '';

// Get lobby ID from URL  
const urlParams = new URLSearchParams(window.location.search);
const lobbyCode = urlParams.get('lobby') || urlParams.get('code');

if (lobbyCode) {
    joinLobby(lobbyCode);
} else {
    console.warn('No lobby code found in URL');
    window.location.href = '/';
}

function joinLobby(code) {
    const playerData = sessionStorage.getItem('playerData');
    if (!playerData) {
        console.warn('No player data found, redirecting to home');
        window.location.href = '/';
        return;
    }

    const data = JSON.parse(playerData);
    lobbyId = code;
    isAdmin = data.isAdmin || false;

    document.getElementById('lobbyId').textContent = code;
    
    // Join lobby via socket
    socket.emit('joinLobby', {
        lobbyId: code,
        playerName: data.name,
        isAdmin: data.isAdmin || false
    });

    console.log('Joining lobby ' + code + ' as ' + data.name + ' (Admin: ' + data.isAdmin + ')');
}

// Socket event listeners
socket.on('lobbyJoined', (lobbyData) => {
    console.log('Successfully joined lobby:', lobbyData);
    updateLobbyDisplay(lobbyData);
});

socket.on('lobbyUpdated', (lobbyData) => {
    console.log('Lobby updated:', lobbyData);
    updateLobbyDisplay(lobbyData);
});

socket.on('gameStarting', (gameData) => {
    console.log('Game starting!', gameData);
    window.location.href = '/game.html?lobby=' + lobbyId;
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    alert('Fehler: ' + (error.message || error));
    
    if (error.redirect) {
        window.location.href = error.redirect;
    }
});

console.log('Simple Lobby system initialized (No Video)');

// Update lobby display
function updateLobbyDisplay(lobbyData) {
    console.log('Updating lobby display with:', lobbyData);
    
    // Update admin info
    const adminInfo = document.getElementById('adminInfo');
    const adminNameElement = adminInfo.querySelector('.player-name');
    
    if (lobbyData.admin) {
        adminNameElement.textContent = lobbyData.admin.name || 'Admin';
    }
    
    // Update players list
    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');
    
    playersList.innerHTML = '';
    
    if (lobbyData.players && Array.isArray(lobbyData.players)) {
        lobbyData.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = '<span class="player-name">' + (player.name || 'Unbekannter Spieler') + '</span><span class="player-status ' + (player.ready ? 'ready' : 'not-ready') + '">' + (player.ready ? 'Bereit' : 'Wartet') + '</span>';
            playersList.appendChild(playerCard);
        });
        
        playerCount.textContent = lobbyData.players.length;
    } else {
        playerCount.textContent = '0';
    }
    
    // Show admin controls if user is admin
    const adminActions = document.getElementById('adminActions');
    if (isAdmin) {
        adminActions.style.display = 'block';
        
        // Enable start game button if enough players
        const startGameBtn = document.getElementById('startGameBtn');
        const hasEnoughPlayers = lobbyData.players && lobbyData.players.length >= 1;
        startGameBtn.disabled = !hasEnoughPlayers;
        
        if (hasEnoughPlayers) {
            startGameBtn.textContent = 'Spiel starten & Kameras aktivieren';
        } else {
            startGameBtn.textContent = 'Mindestens 1 Spieler benötigt (' + (lobbyData.players ? lobbyData.players.length : 0) + '/4)';
        }
    }
}

// Event handlers
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('startGameBtn').addEventListener('click', function() {
        if (!isAdmin) return;
        
        console.log('Admin starting game...');
        socket.emit('startGame', { lobbyId });
    });

    document.getElementById('leaveLobbyBtn').addEventListener('click', function() {
        console.log('Leaving lobby...');
        socket.emit('leaveLobby', { lobbyId });
        
        // Clear session data and redirect
        sessionStorage.removeItem('playerData');
        window.location.href = '/';
    });
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (socket.connected) {
        socket.emit('leaveLobby', { lobbyId });
    }
});
