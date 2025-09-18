const socket = io();
let isAdmin = false;
let lobbyId = '';

// Get lobby ID from URL path
const pathParts = window.location.pathname.split('/');
const lobbyCode = pathParts[pathParts.length - 1];

console.log('DEBUG: Lobby page loaded, lobby code from URL:', lobbyCode);

// Lobby initialization moved to initializeLobby() function called from DOMContentLoaded

function joinLobby(code) {
    const playerData = sessionStorage.getItem('playerData');
    console.log('DEBUG: playerData from sessionStorage:', playerData);
    
    if (!playerData) {
        console.log('DEBUG: No playerData found, redirecting to home');
        alert('Keine Spielerdaten gefunden. Bitte erstelle oder tritt einer Lobby bei.');
        window.location.href = '/';
        return;
    }

    const data = JSON.parse(playerData);
    console.log('DEBUG: Parsed playerData:', data);
    
    lobbyId = code;
    isAdmin = data.isAdmin || false;

    console.log('DEBUG: Setting lobby ID to:', code);
    console.log('DEBUG: isAdmin set to:', isAdmin);
    
    const lobbyIdElement = document.getElementById('lobbyId');
    console.log('DEBUG: lobbyId element:', lobbyIdElement);
    
    if (lobbyIdElement) {
        lobbyIdElement.textContent = code;
        console.log('DEBUG: Lobby ID element updated to:', lobbyIdElement.textContent);
    } else {
        console.log('DEBUG: ERROR - lobbyId element not found!');
    }
    
    console.log('DEBUG: Emitting rejoinLobby with:', {
        lobbyId: code,
        playerName: data.name,
        isAdmin: data.isAdmin || false
    });
    
    socket.emit('rejoinLobby', {
        lobbyId: code,
        playerName: data.name,
        isAdmin: data.isAdmin || false
    });
}

// Socket events
socket.on('lobbyJoined', (lobbyData) => {
    console.log('DEBUG: lobbyJoined event received:', lobbyData);
    updateLobbyDisplay(lobbyData);
});

socket.on('lobbyUpdated', (lobbyData) => {
    console.log('DEBUG: lobbyUpdated event received:', lobbyData);
    updateLobbyDisplay(lobbyData);
});

socket.on('gameStarting', (gameData) => {
    sessionStorage.setItem('gameData', JSON.stringify(gameData));
    window.location.href = '/game/' + lobbyId;
});

socket.on('error', (error) => {
    console.error('DEBUG: Socket error received:', error);
    alert('Fehler: ' + (error.message || error));
    
    // If lobby not found, redirect to home
    if (error === 'Lobby nicht gefunden') {
        console.log('DEBUG: Lobby not found, redirecting to home');
        sessionStorage.removeItem('playerData');
        window.location.href = '/';
    }
});

// Update lobby display
function updateLobbyDisplay(lobbyData) {
    console.log('DEBUG: updateLobbyDisplay called with:', lobbyData);
    
    const adminInfo = document.getElementById('adminInfo');
    const adminNameElement = adminInfo.querySelector('.player-name');
    
    console.log('DEBUG: adminInfo element:', adminInfo);
    console.log('DEBUG: adminNameElement:', adminNameElement);
    
    if (lobbyData.admin) {
        console.log('DEBUG: Setting admin name to:', lobbyData.admin.name);
        adminNameElement.textContent = lobbyData.admin.name || 'Admin';
    } else {
        console.log('DEBUG: No admin data found in lobbyData');
    }
    
    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');
    
    console.log('DEBUG: playersList element:', playersList);
    console.log('DEBUG: playerCount element:', playerCount);
    
    playersList.innerHTML = '';
    
    if (lobbyData.players && Array.isArray(lobbyData.players)) {
        console.log('DEBUG: Processing players:', lobbyData.players);
        lobbyData.players.forEach(player => {
            console.log('DEBUG: Adding player:', player);
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
    console.log('DEBUG: DOMContentLoaded - setting up event handlers');
    
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
    console.log('DEBUG: Initializing lobby...');
    
    if (lobbyCode && lobbyCode !== 'lobby') {
        // Check if we have valid player data before attempting to join
        const playerData = sessionStorage.getItem('playerData');
        console.log('DEBUG: Initial playerData check:', playerData);
        
        if (!playerData) {
            console.log('DEBUG: No playerData found on page load, redirecting to home');
            alert('Du musst zuerst eine Lobby erstellen oder beitreten.');
            window.location.href = '/';
            return;
        }
        
        // Parse and validate the data
        try {
            const data = JSON.parse(playerData);
            if (!data.name || !data.lobbyId) {
                console.log('DEBUG: Invalid playerData structure:', data);
                sessionStorage.removeItem('playerData');
                alert('Ungültige Spielerdaten. Bitte erstelle oder tritt einer Lobby bei.');
                window.location.href = '/';
                return;
            }
            
            // Check if URL lobby matches stored lobby
            if (data.lobbyId !== lobbyCode) {
                console.log('DEBUG: URL lobby mismatch. URL:', lobbyCode, 'Stored:', data.lobbyId);
                sessionStorage.removeItem('playerData');
                alert('Lobby-Konflikt erkannt. Bitte erstelle oder tritt einer neuen Lobby bei.');
                window.location.href = '/';
                return;
            }
            
            joinLobby(lobbyCode);
        } catch (error) {
            console.log('DEBUG: Error parsing playerData:', error);
            sessionStorage.removeItem('playerData');
            alert('Fehler beim Lesen der Spielerdaten. Bitte erstelle oder tritt einer Lobby bei.');
            window.location.href = '/';
        }
    } else {
        console.warn('No lobby code found');
        window.location.href = '/';
    }
}

window.addEventListener('beforeunload', () => {
    if (socket.connected) {
        socket.emit('leaveLobby', { lobbyId });
    }
});
