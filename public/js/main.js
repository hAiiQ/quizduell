const socket = io();

document.addEventListener('DOMContentLoaded', function() {
    const createLobbyBtn = document.getElementById('createLobbyBtn');
    const joinLobbyBtn = document.getElementById('joinLobbyBtn');
    const adminNameInput = document.getElementById('adminName');
    const playerNameInput = document.getElementById('playerName');
    const lobbyCodeInput = document.getElementById('lobbyCode');

    // Auto-uppercase lobby code
    lobbyCodeInput.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });

    // Create lobby
    createLobbyBtn.addEventListener('click', function() {
        const adminName = adminNameInput.value.trim();
        
        if (!adminName) {
            alert('Bitte gib deinen Namen ein');
            return;
        }
        
        if (adminName.length > 20) {
            alert('Name darf maximal 20 Zeichen lang sein');
            return;
        }
        
        createLobbyBtn.disabled = true;
        createLobbyBtn.textContent = 'Erstelle...';
        
        socket.emit('createLobby', adminName);
    });

    // Join lobby
    joinLobbyBtn.addEventListener('click', function() {
        const playerName = playerNameInput.value.trim();
        const lobbyCode = lobbyCodeInput.value.trim().toUpperCase();
        
        if (!playerName) {
            alert('Bitte gib deinen Namen ein');
            return;
        }
        
        if (!lobbyCode) {
            alert('Bitte gib den Lobby-Code ein');
            return;
        }
        
        if (playerName.length > 20) {
            alert('Name darf maximal 20 Zeichen lang sein');
            return;
        }
        
        if (lobbyCode.length !== 6) {
            alert('Lobby-Code muss 6 Zeichen lang sein');
            return;
        }
        
        joinLobbyBtn.disabled = true;
        joinLobbyBtn.textContent = 'Trete bei...';
        
        console.log('🔄 Attempting to join lobby:', { lobbyId: lobbyCode, playerName });
        socket.emit('joinLobby', { lobbyId: lobbyCode, playerName });
        
        // Add timeout fallback
        setTimeout(() => {
            if (joinLobbyBtn.disabled && joinLobbyBtn.textContent === 'Trete bei...') {
                console.error('❌ Join timeout - no response from server');
                alert('❌ Timeout beim Beitreten. Versuche es erneut.');
                joinLobbyBtn.disabled = false;
                joinLobbyBtn.textContent = 'Beitreten';
            }
        }, 8000); // 8 Sekunden Timeout
    });

    // Handle lobby created
    socket.on('lobbyCreated', function(data) {
        console.log('Lobby created:', data);
        
        // Store player data immediately
        const playerData = {
            name: adminNameInput.value.trim(),
            isAdmin: data.isAdmin,
            lobbyId: data.lobbyId
        };
        sessionStorage.setItem('playerData', JSON.stringify(playerData));
        
        // Add small delay to ensure data is stored
        setTimeout(() => {
            window.location.href = `/lobby/${data.lobbyId}`;
        }, 100);
    });

    // Handle lobby joined
    socket.on('joinedLobby', function(data) {
        console.log('✅ Successfully joined lobby from main.js:', data);
        
        // Store player data immediately
        const playerData = {
            name: playerNameInput.value.trim(),
            isAdmin: data.isAdmin,
            lobbyId: data.lobbyId
        };
        
        console.log('💾 Storing player data:', playerData);
        sessionStorage.setItem('playerData', JSON.stringify(playerData));
        
        console.log('🔄 Redirecting to lobby page...');
        // Add small delay to ensure data is stored
        setTimeout(() => {
            window.location.href = `/lobby/${data.lobbyId}`;
        }, 100);
    });

    // Handle errors
    socket.on('error', function(message) {
        console.error('❌ Main.js error received:', message);
        alert('❌ Fehler: ' + message);
        
        // Re-enable buttons
        createLobbyBtn.disabled = false;
        createLobbyBtn.textContent = 'Lobby erstellen';
        joinLobbyBtn.disabled = false;
        joinLobbyBtn.textContent = 'Beitreten';
    });
    
    // Add socket connection debugging
    socket.on('connect', function() {
        console.log('✅ Main.js - Socket connected');
    });
    
    socket.on('disconnect', function() {
        console.log('❌ Main.js - Socket disconnected');
    });
    
    socket.on('connect_error', function(error) {
        console.error('❌ Main.js - Socket connection error:', error);
    });

    // Handle Enter key press
    adminNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createLobbyBtn.click();
        }
    });

    playerNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinLobbyBtn.click();
        }
    });

    lobbyCodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinLobbyBtn.click();
        }
    });
});