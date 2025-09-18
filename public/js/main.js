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
        
        socket.emit('joinLobby', { lobbyId: lobbyCode, playerName });
    });

    // Handle lobby created
    socket.on('lobbyCreated', function(data) {
        console.log('DEBUG: Lobby created:', data);
        
        // Store player data immediately
        const playerData = {
            name: adminNameInput.value.trim(),
            isAdmin: data.isAdmin,
            lobbyId: data.lobbyId
        };
        
        console.log('DEBUG: Storing playerData:', playerData);
        sessionStorage.setItem('playerData', JSON.stringify(playerData));
        
        // Verify it was stored
        const storedData = sessionStorage.getItem('playerData');
        console.log('DEBUG: Verified stored data:', storedData);
        
        // Add small delay to ensure data is stored
        setTimeout(() => {
            window.location.href = `/lobby/${data.lobbyId}`;
        }, 100);
    });

    // Handle lobby joined
    socket.on('lobbyJoined', function(data) {
        console.log('DEBUG: Joined lobby:', data);
        
        // Store player data immediately  
        const playerData = {
            name: playerNameInput.value.trim(),
            isAdmin: data.isAdmin,
            lobbyId: data.lobbyId
        };
        
        console.log('DEBUG: Storing playerData for join:', playerData);
        sessionStorage.setItem('playerData', JSON.stringify(playerData));
        
        // Verify it was stored
        const storedData = sessionStorage.getItem('playerData');
        console.log('DEBUG: Verified stored data for join:', storedData);
        
        // Add small delay to ensure data is stored
        setTimeout(() => {
            window.location.href = `/lobby/${data.lobbyId}`;
        }, 100);
    });

    // Handle errors
    socket.on('error', function(message) {
        alert(message);
        
        // Re-enable buttons
        createLobbyBtn.disabled = false;
        createLobbyBtn.textContent = 'Lobby erstellen';
        joinLobbyBtn.disabled = false;
        joinLobbyBtn.textContent = 'Beitreten';
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