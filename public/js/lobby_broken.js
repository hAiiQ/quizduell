// Prevent double execution
if (window.lobbyInitialized) {
    return;
}
window.lobbyInitialized = true;

const socket = io();
let isAdmin = false;
let lobbyId = '';

// Get lobby ID from URL path
const pathParts = window.location.pathname.split('/');
const lobbyCode = pathParts[pathParts.length - 1];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeLobby();
    setupEventHandlers();
});

function joinLobby(code) {
    const playerData = sessionStorage.getItem('playerData');
    
    if (!playerData) {
        alert('Keine Spielerdaten gefunden. Bitte erstelle oder tritt einer Lobby bei.');
        window.location.href = '/';
        return;
    }

    const data = JSON.parse(playerData);
    
    lobbyId = code;
    isAdmin = data.isAdmin || false;

    const lobbyIdElement = document.getElementById('lobbyId');
    if (lobbyIdElement) {
        lobbyIdElement.textContent = code;
    }
    
    socket.emit('rejoinLobby', {
        lobbyId: code,
        playerName: data.name,
        isAdmin: data.isAdmin || false
    });
}

// Socket events
socket.on('lobbyJoined', (lobbyData) => {
    updateLobbyDisplay(lobbyData);
});

socket.on('lobbyUpdated', (lobbyData) => {
    updateLobbyDisplay(lobbyData);
});

socket.on('gameStarting', (gameData) => {
    sessionStorage.setItem('gameData', JSON.stringify(gameData));
    window.location.href = '/game/' + lobbyId;
});

socket.on('error', (error) => {
    alert('Fehler: ' + (error.message || error));
    
    // If lobby not found, redirect to home
    if (error === 'Lobby nicht gefunden') {
        sessionStorage.removeItem('playerData');
        window.location.href = '/';
    }
});

// Update lobby display
function updateLobbyDisplay(lobbyData) {
    const adminInfo = document.getElementById('adminInfo');
    const adminNameElement = adminInfo.querySelector('.player-name');
    
    if (lobbyData.admin) {
        adminNameElement.textContent = lobbyData.admin.name || 'Admin';
    }
    
    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');
    
    playersList.innerHTML = '';
    
    if (lobbyData.players && Array.isArray(lobbyData.players)) {
        lobbyData.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = '<span class="player-name">' + (player.name || 'Unbekannter Spieler') + '</span>';
            playersList.appendChild(playerCard);
        });
        
        playerCount.textContent = lobbyData.players.length;
    } else {
        playerCount.textContent = '0';
    }
    
    const adminActions = document.getElementById('adminActions');
    if (isAdmin) {
        adminActions.style.display = 'block';
        
        const startGameBtn = document.getElementById('startGameBtn');
        const hasEnoughPlayers = lobbyData.players && lobbyData.players.length >= 1;
        startGameBtn.disabled = !hasEnoughPlayers;
        
        if (hasEnoughPlayers) {
            startGameBtn.textContent = 'Spiel starten';
        } else {
            startGameBtn.textContent = 'Mindestens 1 Spieler benötigt';
        }
    }
}

// Event handlers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize lobby after DOM is ready
    initializeLobby();
    
    document.getElementById('startGameBtn').addEventListener('click', function() {
        if (!isAdmin) return;
        socket.emit('startGame', { lobbyId });
    });

    document.getElementById('leaveLobbyBtn').addEventListener('click', function() {
        socket.emit('leaveLobby', { lobbyId });
        sessionStorage.removeItem('playerData');
        window.location.href = '/';
    });
});

function initializeLobby() {
    if (lobbyCode && lobbyCode !== 'lobby') {
        // Check if we have valid player data before attempting to join
        const playerData = sessionStorage.getItem('playerData');
        
        if (!playerData) {
            alert('Du musst zuerst eine Lobby erstellen oder beitreten.');
            window.location.href = '/';
            return;
        }
        
        // Parse and validate the data
        try {
            const data = JSON.parse(playerData);
            if (!data.name || !data.lobbyId) {
                sessionStorage.removeItem('playerData');
                alert('Ungültige Spielerdaten. Bitte erstelle oder tritt einer Lobby bei.');
                window.location.href = '/';
                return;
            }
            
            // Check if URL lobby matches stored lobby
            if (data.lobbyId !== lobbyCode) {
                sessionStorage.removeItem('playerData');
                alert('Lobby-Konflikt erkannt. Bitte erstelle oder tritt einer neuen Lobby bei.');
                window.location.href = '/';
                return;
            }
            
            joinLobby(lobbyCode);
        } catch (error) {
            sessionStorage.removeItem('playerData');
            alert('Fehler beim Lesen der Spielerdaten. Bitte erstelle oder tritt einer Lobby bei.');
            window.location.href = '/';
        }
    } else {
        window.location.href = '/';
    }
}

function initializeLobby() {
    if (lobbyCode && lobbyCode !== 'lobby') {
        // Check if we have valid player data before attempting to join
        const playerData = sessionStorage.getItem('playerData');
        
        if (!playerData) {
            alert('Du musst zuerst eine Lobby erstellen oder beitreten.');
            window.location.href = '/';
            return;
        }
        
        // Parse and validate the data
        try {
            const data = JSON.parse(playerData);
            if (!data.name || !data.lobbyId) {
                sessionStorage.removeItem('playerData');
                alert('Ungültige Spielerdaten. Bitte erstelle oder tritt einer Lobby bei.');
                window.location.href = '/';
                return;
            }
            
            // Check if URL lobby matches stored lobby
            if (data.lobbyId !== lobbyCode) {
                sessionStorage.removeItem('playerData');
                alert('Lobby-Konflikt erkannt. Bitte erstelle oder tritt einer neuen Lobby bei.');
                window.location.href = '/';
                return;
            }
            
            joinLobby(lobbyCode);
        } catch (error) {
            sessionStorage.removeItem('playerData');
            alert('Fehler beim Lesen der Spielerdaten. Bitte erstelle oder tritt einer Lobby bei.');
            window.location.href = '/';
        }
    } else {
        window.location.href = '/';
    }
}

function setupEventHandlers() {
    document.getElementById('startGameBtn').addEventListener('click', function() {
        if (!isAdmin) return;
        socket.emit('startGame', { lobbyId });
    });

    document.getElementById('leaveLobbyBtn').addEventListener('click', function() {
        socket.emit('leaveLobby', { lobbyId });
        sessionStorage.removeItem('playerData');
        window.location.href = '/';
    });
}

window.addEventListener('beforeunload', () => {
    if (socket.connected) {
        socket.emit('leaveLobby', { lobbyId });
    }
});
