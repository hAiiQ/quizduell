(function() {
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

    // Set lobby ID in display
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
    // Update admin info
    const adminInfo = document.getElementById('adminInfo');
    if (adminInfo) {
        const adminNameElement = adminInfo.querySelector('.player-name');
        if (adminNameElement && lobbyData.admin) {
            adminNameElement.textContent = lobbyData.admin.name || 'Admin';
        }
    }
    
    // Update players list
    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');
    
    if (playersList) {
        playersList.innerHTML = '';
        
        if (lobbyData.players && Array.isArray(lobbyData.players)) {
            lobbyData.players.forEach(player => {
                const playerCard = document.createElement('div');
                playerCard.className = 'player-card';
                playerCard.innerHTML = '<span class="player-name">' + (player.name || 'Unbekannter Spieler') + '</span>';
                playersList.appendChild(playerCard);
            });
            
            if (playerCount) {
                playerCount.textContent = lobbyData.players.length;
            }
        } else {
            if (playerCount) {
                playerCount.textContent = '0';
            }
        }
    }
    
    // Update admin actions
    const adminActions = document.getElementById('adminActions');
    if (adminActions && isAdmin) {
        adminActions.style.display = 'block';
        
        const startGameBtn = document.getElementById('startGameBtn');
        if (startGameBtn && lobbyData.players) {
            const hasEnoughPlayers = lobbyData.players.length >= 1;
            startGameBtn.disabled = !hasEnoughPlayers;
            
            if (hasEnoughPlayers) {
                startGameBtn.textContent = 'Spiel starten';
            } else {
                startGameBtn.textContent = 'Mindestens 1 Spieler benötigt';
            }
        }
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
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function() {
            if (!isAdmin) return;
            socket.emit('startGame', { lobbyId });
        });
    }

    const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
    if (leaveLobbyBtn) {
        leaveLobbyBtn.addEventListener('click', function() {
            socket.emit('leaveLobby', { lobbyId });
            sessionStorage.removeItem('playerData');
            window.location.href = '/';
        });
    }
}

    window.addEventListener('beforeunload', () => {
        if (socket.connected) {
            socket.emit('leaveLobby', { lobbyId });
        }
    });

})(); // End of IIFE