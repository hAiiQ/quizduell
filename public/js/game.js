const socket = io();
let isAdmin = false;
let lobbyId = '';
let gameData = null;
let currentQuestions = {};
let localStream = null;
let playerStreams = new Map();

// Jitsi system variables for game
let gameJitsiApi = null;
let gameJitsiVisible = true;

// Initialize game Jitsi - Optimiert für 5-Kamera Reihen-Layout
function initializeGameJitsi() {
    console.log('🎥 Initializing 5-Camera Row Jitsi for game view');
    
    const gameData = JSON.parse(sessionStorage.getItem('gameData') || '{}');
    const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
    
    if (!lobbyId) {
        console.warn('⚠️ No lobby ID for Jitsi initialization');
        showGameJitsiError('Keine Lobby ID gefunden');
        return;
    }
    
    const jitsiContainer = document.getElementById('game-jitsi-container');
    if (!jitsiContainer) {
        console.warn('⚠️ Game Jitsi container not found');
        return;
    }
    
    // Check if Jitsi API is available
    if (typeof JitsiMeetExternalAPI === 'undefined') {
        console.warn('⚠️ Jitsi API not loaded - continuing without video');
        showGameJitsiError('Jitsi API nicht verfügbar - Spiel läuft ohne Video');
        return;
    }
    
    const jitsiRoomName = `jeopardy-game-${lobbyId}`;
    console.log(`🎮 Initializing 5-Camera Game Jitsi for room: ${jitsiRoomName}`);
    
    // Update room code display
    const roomCodeElement = document.getElementById('game-room-code');
    if (roomCodeElement) {
        roomCodeElement.textContent = lobbyId;
    }
    
    // Update status
    updateCameraStatus('connecting', 'Verbinde mit Video-Chat...');
    
    try {
        // Konfiguration speziell für 5-Kamera horizontale Reihe
        gameJitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
            roomName: jitsiRoomName,
            parentNode: jitsiContainer,
            width: '100%',
            height: '100%',
            configOverwrite: {
                startWithAudioMuted: true, // Standardmäßig stumm im Spiel
                startWithVideoMuted: false,
                enableWelcomePage: false,
                prejoinPageEnabled: false,
                disableInviteFunctions: true,
                doNotStoreRoom: true,
                enableNoisyMicDetection: false,
                
                // Optimiert für 5-Kamera-Reihe
                defaultLocalDisplayName: playerData.name || 'Spieler',
                enableLayerSuspension: true
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'camera', 'fullscreen'],
                SETTINGS_SECTIONS: ['devices'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                SHOW_BRAND_WATERMARK: false,
                BRAND_WATERMARK_LINK: '',
                SHOW_POWERED_BY: false,
                APP_NAME: 'Jeopardy Game',
                DEFAULT_BACKGROUND: '#1a1a1a',
                
                // KRITISCH: 5 Spalten für horizontale Reihe
                TILE_VIEW_MAX_COLUMNS: 5,
                FILMSTRIP_ENABLED: true,
                VERTICAL_FILMSTRIP: false,
                
                // Verstecke UI-Elemente für saubere Anzeige
                HIDE_INVITE_MORE_HEADER: true,
                INITIAL_TOOLBAR_TIMEOUT: 20000,
                TOOLBAR_TIMEOUT: 4000,
                
                // Disable störende Indikatoren
                DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
                DISABLE_FOCUS_INDICATOR: false,
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                DISABLE_PRESENCE_STATUS: true
            },
            userInfo: {
                displayName: playerData.isAdmin ? `👑 ${playerData.name}` : `👤 ${playerData.name}`
            }
        });
        
        // Setup game Jitsi event listeners mit verbesserter 5-Kamera Logik
        let participantCount = 0;
        const joinTimeout = setTimeout(() => {
            console.warn('⏰ Jitsi join timeout - 5 Kamera Setup');
            showGameJitsiError('Verbindung dauert zu lange');
        }, 15000);
        
        gameJitsiApi.addEventListener('videoConferenceJoined', () => {
            console.log('✅ 5-Camera Game Jitsi joined successfully');
            clearTimeout(joinTimeout);
            hideGameJitsiLoading();
            updateCameraStatus('connected', 'Video-Chat aktiv');
            
            // Erzwinge 5-Kamera Kachel-Ansicht
            setTimeout(() => {
                enforce5CameraTileView();
            }, 1000);
        });
        
        gameJitsiApi.addEventListener('participantJoined', (participant) => {
            participantCount++;
            console.log(`👤 Participant joined 5-camera game: ${participant.displayName} (${participantCount} total)`);
            updateParticipantCount(participantCount + 1); // +1 for self
            
            // Erzwinge 5-Kamera-Reihe bei jedem neuen Teilnehmer
            setTimeout(() => {
                enforce5CameraTileView();
            }, 800);
        });
        
        gameJitsiApi.addEventListener('participantLeft', (participant) => {
            participantCount = Math.max(0, participantCount - 1);
            console.log(`👋 Participant left 5-camera game: ${participant.displayName} (${participantCount} remaining)`);
            updateParticipantCount(participantCount + 1); // +1 for self
        });
        
        gameJitsiApi.addEventListener('readyToClose', () => {
            console.log('🚪 5-Camera Game Jitsi ready to close');
            clearTimeout(joinTimeout);
        });
        
        gameJitsiApi.addEventListener('error', (error) => {
            console.warn('⚠️ Game Jitsi connection issue:', error);
            clearTimeout(joinTimeout);
            updateCameraStatus('error', 'Video-Problem');
            showGameJitsiError('Verbindungsproblem - Spiel läuft ohne Video weiter');
        });
        
        console.log('🎮 5-Camera Game Jitsi API instance created');
        
    } catch (error) {
        console.warn('⚠️ Game Jitsi initialization skipped:', error.message);
        updateCameraStatus('error', 'Video nicht verfügbar');
        showGameJitsiError('Video nicht verfügbar - Spiel läuft normal weiter');
    }
}

// Erzwinge 5-Kamera Kachel-Ansicht (Zentrale Funktion)
function enforce5CameraTileView() {
    if (!gameJitsiApi) return;
    
    try {
        // Setze Kachel-Ansicht mit 5 Spalten
        gameJitsiApi.executeCommand('setTileView', true);
        
        // Zusätzliche Kommandos für optimale 5er-Reihe
        setTimeout(() => {
            if (gameJitsiApi) {
                // Force 5 columns layout
                gameJitsiApi.executeCommand('setTileViewDimensions', { columns: 5, rows: 1 });
            }
        }, 200);
        
        console.log('🔲 5-Camera tile view enforced');
        
        // Update UI
        const tileBtn = document.getElementById('game-force-tiles');
        if (tileBtn) {
            tileBtn.classList.add('active');
        }
        
    } catch (error) {
        console.warn('⚠️ Error enforcing 5-camera tile view:', error);
    }
}

// Neue Kamera-Kontroll-Funktionen
function toggleGameCamera() {
    if (!gameJitsiApi) return;
    
    try {
        gameJitsiApi.executeCommand('toggleVideo');
        
        const btn = document.getElementById('game-toggle-camera');
        if (btn) {
            btn.classList.toggle('muted');
            console.log('📹 Game camera toggled');
        }
    } catch (error) {
        console.error('❌ Error toggling game camera:', error);
    }
}

function toggleGameAudio() {
    if (!gameJitsiApi) return;
    
    try {
        gameJitsiApi.executeCommand('toggleAudio');
        
        const btn = document.getElementById('game-toggle-audio');
        if (btn) {
            btn.classList.toggle('muted');
            console.log('🎤 Game audio toggled');
        }
    } catch (error) {
        console.error('❌ Error toggling game audio:', error);
    }
}

function fullscreenGameCameras() {
    if (!gameJitsiApi) return;
    
    try {
        const container = document.getElementById('game-jitsi-container');
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        
        console.log('⛶ Game cameras fullscreen requested');
    } catch (error) {
        console.error('❌ Error requesting fullscreen:', error);
    }
}

// Status-Update-Funktionen
function updateCameraStatus(status, text) {
    const indicator = document.getElementById('cameras-status-indicator');
    const statusText = document.getElementById('cameras-status-text');
    
    if (indicator) {
        indicator.className = `status-dot ${status}`;
    }
    
    if (statusText) {
        statusText.textContent = text;
    }
}

function updateParticipantCount(count) {
    const countElement = document.getElementById('camera-participant-count');
    if (countElement) {
        countElement.textContent = `${count}/5`;
    }
}

// Toggle game Jitsi visibility
function toggleGameJitsi() {
    const jitsiContainer = document.getElementById('game-jitsi-container');
    const toggleBtn = document.getElementById('game-toggle-jitsi');
    
    if (jitsiContainer && toggleBtn) {
        gameJitsiVisible = !gameJitsiVisible;
        jitsiContainer.style.display = gameJitsiVisible ? 'block' : 'none';
        toggleBtn.textContent = gameJitsiVisible ? '📹 Ein/Aus' : '📹 Zeigen';
        toggleBtn.style.background = gameJitsiVisible ? '#0066cc' : '#666';
        
        console.log(`📹 Game Jitsi ${gameJitsiVisible ? 'shown' : 'hidden'}`);
    }
}

function hideGameJitsiLoading() {
    const loading = document.getElementById('game-jitsi-loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showGameJitsiError(message = 'Kamera-Fehler') {
    console.warn('⚠️ Game Jitsi Info:', message);
    const loading = document.getElementById('game-jitsi-loading');
    if (loading) {
        // Less intrusive - just show a simple message without big error
        loading.innerHTML = `
            <div class="loading-content">
                <div style="font-size: 24px; margin-bottom: 10px; color: #ffc107;">⚠️</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Kameras nicht verfügbar</div>
                <div style="font-size: 12px; color: #888; margin-bottom: 15px;">${message}</div>
                <div style="font-size: 11px; color: #999;">Das Spiel funktioniert auch ohne Video</div>
            </div>
        `;
        loading.style.display = 'flex';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (loading) {
                loading.style.display = 'none';
            }
        }, 3000);
    }
}

// Retry function for game Jitsi
function retryGameJitsi() {
    console.log('🔄 Retrying game Jitsi initialization...');
    
    // Clean up existing instance
    if (gameJitsiApi) {
        try {
            gameJitsiApi.dispose();
        } catch (e) {
            console.warn('Warning disposing game Jitsi:', e);
        }
        gameJitsiApi = null;
    }
    
    // Reset loading state
    const loading = document.getElementById('game-jitsi-loading');
    if (loading) {
        loading.style.display = 'flex';
        loading.innerHTML = `
            <div>
                <div style="font-size: 16px; margin-bottom: 5px;">🔄</div>
                <div style="font-size: 11px;">Erneut verbinden...</div>
            </div>
        `;
    }
    
    // Try again after short delay
    setTimeout(() => {
        initializeGameJitsi();
    }, 2000);
}

// Cleanup game Jitsi
function cleanupGameJitsi() {
    if (gameJitsiApi) {
        try {
            gameJitsiApi.dispose();
        } catch (error) {
            console.warn('Warning disposing game Jitsi API:', error);
        }
        gameJitsiApi = null;
    }
}

// Legacy function (replaced with Jitsi)
function addGameCameraCard(playerId, playerName, isAdminPlayer = false) {
    const camerasGrid = document.getElementById('gameCamerasGrid');
    if (!camerasGrid) return;
    
    const cameraCard = document.createElement('div');
    cameraCard.className = 'game-camera-card';
    cameraCard.id = `game-camera-${playerId}`;
    
    const borderColor = isAdminPlayer ? '#ffd700' : '#007bff';
    const namePrefix = isAdminPlayer ? '👑' : '👤';
    
    cameraCard.style.cssText = `
        background: #2a2a2a; 
        border: 2px solid ${borderColor}; 
        border-radius: 8px; 
        padding: 8px; 
        text-align: center;
    `;
    
    cameraCard.innerHTML = `
        <div style="color: ${borderColor}; font-size: 11px; font-weight: bold; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${namePrefix} ${playerName}
        </div>
        <div class="video-container" style="position: relative; background: #1a1a1a; border-radius: 4px; height: 80px; overflow: hidden;">
            <video id="game-${playerId}-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover; background: #000; display: none;"></video>
            <div id="game-${playerId}-placeholder" class="video-placeholder" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #888;">
                <div style="text-align: center;">
                    <div style="font-size: 14px; margin-bottom: 2px;">📹</div>
                    <div style="font-size: 8px;">Kamera nicht verfügbar</div>
                </div>
            </div>
        </div>
        <div style="margin-top: 4px; display: flex; justify-content: center; gap: 3px;">
            <span id="game-${playerId}-camera-status" style="font-size: 10px; color: #888;">📹</span>
            <span id="game-${playerId}-audio-status" style="font-size: 10px; color: #888;">🎤</span>
        </div>
    `;
    
    camerasGrid.appendChild(cameraCard);
    console.log(`📹 Added game camera card for ${playerName} (${playerId})`);
}

// Update camera status in game view
function updateGameCameraStatus(playerId, hasCamera, hasAudio) {
    const videoElement = document.getElementById(`game-${playerId}-video`);
    const placeholder = document.getElementById(`game-${playerId}-placeholder`);
    const cameraStatus = document.getElementById(`game-${playerId}-camera-status`);
    const audioStatus = document.getElementById(`game-${playerId}-audio-status`);
    
    if (placeholder) {
        if (hasCamera) {
            placeholder.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 14px; margin-bottom: 2px; color: #4CAF50;">📹</div>
                    <div style="font-size: 8px; color: #4CAF50;">Kamera aktiv</div>
                </div>
            `;
        } else {
            placeholder.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 14px; margin-bottom: 2px;">📹</div>
                    <div style="font-size: 8px;">Kamera nicht verfügbar</div>
                </div>
            `;
        }
    }
    
    if (cameraStatus) {
        cameraStatus.textContent = hasCamera ? '📹' : '📷';
        cameraStatus.style.color = hasCamera ? '#4CAF50' : '#888';
    }
    
    if (audioStatus) {
        audioStatus.textContent = hasAudio ? '🎤' : '🔇';
        audioStatus.style.color = hasAudio ? '#4CAF50' : '#888';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Get lobby ID from URL
    lobbyId = window.location.pathname.split('/').pop();
    
    // Get stored data
    const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
    gameData = JSON.parse(sessionStorage.getItem('gameData') || '{}');
    
    console.log('Player data:', playerData);
    console.log('Game data:', gameData);
    
    if (!playerData.name || !gameData.round) {
        window.location.href = '/';
        return;
    }
    
    isAdmin = playerData.isAdmin;
    
    // Rejoin the lobby for game
    socket.emit('rejoinLobby', { 
        lobbyId, 
        playerName: playerData.name, 
        isAdmin: playerData.isAdmin 
    });
    
    // Initialize game interface
    initializeGame();
    
    // Initialize Jitsi tiles for game - wait for DOM and lobby to be ready
    setTimeout(() => {
        console.log('🎮 Starting 5-camera game Jitsi initialization...');
        initializeGameJitsi();
    }, 2000); // Reduced delay since no lobby Jitsi conflict
    
    // Setup new 5-camera control buttons
    const gameCameraBtn = document.getElementById('game-toggle-camera');
    const gameAudioBtn = document.getElementById('game-toggle-audio');
    const forceTilesBtn = document.getElementById('game-force-tiles');
    const fullscreenBtn = document.getElementById('game-fullscreen-cameras');
    
    if (gameCameraBtn) {
        gameCameraBtn.addEventListener('click', toggleGameCamera);
    }
    
    if (gameAudioBtn) {
        gameAudioBtn.addEventListener('click', toggleGameAudio);
    }
    
    if (forceTilesBtn) {
        forceTilesBtn.addEventListener('click', () => {
            enforce5CameraTileView();
            console.log('🔲 Manual 5-camera tile view trigger');
        });
    }
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', fullscreenGameCameras);
    }
    
    // DOM elements
    const questionModal = document.getElementById('questionModal');
    const answerInput = document.getElementById('answerInput');
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');
    const correctBtn = document.getElementById('correctBtn');
    const incorrectBtn = document.getElementById('incorrectBtn');
    const nextRoundBtn = document.getElementById('nextRoundBtn');
    const endGameBtn = document.getElementById('endGameBtn');
    const gameEndModal = document.getElementById('gameEndModal');
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');

    // Admin controls
    if (isAdmin) {
        document.getElementById('adminControls').style.display = 'block';
        
        nextRoundBtn.addEventListener('click', function() {
            socket.emit('nextRound');
        });
        
        endGameBtn.addEventListener('click', function() {
            if (confirm('Spiel beenden?')) {
                socket.emit('endGame');
            }
        });
        
        correctBtn.addEventListener('click', function() {
            const questionData = JSON.parse(questionModal.dataset.questionData || '{}');
            const playerData = JSON.parse(questionModal.dataset.playerData || '{}');
            
            console.log('Awarding correct points:', { questionData, playerData });
            
            socket.emit('awardPoints', {
                playerId: playerData.id,
                points: questionData.points,
                correct: true
            });
            
            questionModal.style.display = 'none';
        });
        
        incorrectBtn.addEventListener('click', function() {
            const questionData = JSON.parse(questionModal.dataset.questionData || '{}');
            const playerData = JSON.parse(questionModal.dataset.playerData || '{}');
            
            console.log('Awarding incorrect (0) points:', { questionData, playerData });
            
            socket.emit('awardPoints', {
                playerId: playerData.id,
                points: questionData.points,
                correct: false
            });
            
            questionModal.style.display = 'none';
        });
    }

    // Player controls
    submitAnswerBtn.addEventListener('click', function() {
        const answer = answerInput.value.trim();
        if (!answer) {
            alert('Bitte gib eine Antwort ein');
            return;
        }
        
        const questionData = JSON.parse(questionModal.dataset.questionData || '{}');
        
        socket.emit('submitAnswer', {
            answer,
            category: questionData.category,
            questionIndex: questionData.questionIndex
        });
        
        submitAnswerBtn.disabled = true;
        submitAnswerBtn.textContent = 'Gesendet...';
    });

    // Back to lobby
    backToLobbyBtn.addEventListener('click', function() {
        sessionStorage.removeItem('gameData');
        window.location.href = '/';
    });

    // Socket event handlers
    socket.on('gameStarted', function(data) {
        updateGameState(data);
    });

    socket.on('questionSelected', function(data) {
        showQuestion(data);
    });

    socket.on('answerSubmitted', function(data) {
        console.log('Answer submitted:', data);
        
        if (isAdmin) {
            // Clear waiting message and show admin review
            const waitingAdminSections = questionModal.querySelectorAll('.waiting-admin-section');
            waitingAdminSections.forEach(section => section.remove());
            
            showAdminReview(data);
        } else {
            // Hide answer section for the player who submitted
            if (data.playerName === playerData.name) {
                document.getElementById('playerAnswerSection').style.display = 'none';
                
                const modalContent = questionModal.querySelector('.modal-content');
                const waitingDiv = document.createElement('div');
                waitingDiv.className = 'waiting-section';
                waitingDiv.innerHTML = `
                    <p>Antwort gesendet! Warte auf die Bewertung des Admins...</p>
                    <p><strong>Deine Antwort:</strong> ${data.answer}</p>
                `;
                modalContent.appendChild(waitingDiv);
            }
        }
    });

    socket.on('pointsAwarded', function(data) {
        updateScores(data.allScores);
        updateCurrentPlayer(data.nextPlayer);
        questionModal.style.display = 'none';
        
        // Mark question as used
        markQuestionAsUsed(questionModal.dataset.category, questionModal.dataset.questionIndex);
    });

    socket.on('roundChanged', function(data) {
        document.getElementById('currentRound').textContent = data.round;
        currentQuestions = data.questions;
        createGameBoard();
        updateScores(data.scores);
    });

    socket.on('gameEnded', function(data) {
        showGameEndScreen(data);
    });

    socket.on('lobbyDisconnected', function(message) {
        alert(message);
        window.location.href = '/';
    });
    
    // Camera status updates from lobby
    socket.on('cameraStatusUpdate', function(data) {
        console.log('📹 Game camera status update:', data);
        
        const { playerId, hasCamera, hasAudio } = data;
        updateGameCameraStatus(playerId, hasCamera, hasAudio);
    });

    function initializeGame() {
        document.getElementById('currentRound').textContent = gameData.round;
        currentQuestions = gameData.questions;
        createGameBoard();
        updateScores(gameData.scores);
        updateCurrentPlayer(gameData.players[gameData.currentPlayer]);
    }

    function createGameBoard() {
        const categoriesContainer = document.querySelector('.categories');
        categoriesContainer.innerHTML = '';
        
        const categoryNames = Object.keys(currentQuestions);
        
        categoryNames.forEach(categoryName => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'category-header';
            headerDiv.textContent = categoryName;
            categoryDiv.appendChild(headerDiv);
            
            const questionsColumn = document.createElement('div');
            questionsColumn.className = 'questions-column';
            
            currentQuestions[categoryName].forEach((question, index) => {
                const questionCard = document.createElement('div');
                questionCard.className = 'question-card';
                questionCard.textContent = `${question.points}`;
                questionCard.dataset.category = categoryName;
                questionCard.dataset.questionIndex = index;
                
                // Only admin can click questions
                if (isAdmin) {
                    questionCard.classList.add('admin-can-click');
                    questionCard.addEventListener('click', function() {
                        if (this.classList.contains('used')) return;
                        
                        socket.emit('selectQuestion', {
                            category: categoryName,
                            questionIndex: index
                        });
                    });
                } else {
                    questionCard.style.cursor = 'not-allowed';
                    questionCard.style.opacity = '0.7';
                }
                
                questionsColumn.appendChild(questionCard);
            });
            
            categoryDiv.appendChild(questionsColumn);
            categoriesContainer.appendChild(categoryDiv);
        });
    }

    function showQuestion(data) {
        const questionModal = document.getElementById('questionModal');
        
        // Store data for later use
        questionModal.dataset.questionData = JSON.stringify({
            category: data.category,
            questionIndex: data.questionIndex,
            points: data.points
        });
        
        questionModal.dataset.category = data.category;
        questionModal.dataset.questionIndex = data.questionIndex;
        
        // Fill modal content
        document.getElementById('questionCategory').textContent = data.category;
        document.getElementById('questionPoints').textContent = data.points;
        document.getElementById('questionText').textContent = data.question;
        
        // Clear any existing waiting sections first
        const waitingSections = questionModal.querySelectorAll('.waiting-section, .waiting-admin-section');
        waitingSections.forEach(section => section.remove());
        
        // Show question to everyone, but different interfaces
        if (isAdmin) {
            // Admin sees question and waits for player answers
            document.getElementById('playerAnswerSection').style.display = 'none';
            document.getElementById('adminAnswerSection').style.display = 'none';
            
            // Show waiting for answers message
            const waitingDiv = document.createElement('div');
            waitingDiv.className = 'waiting-admin-section';
            waitingDiv.innerHTML = `
                <p><strong>Frage wird allen Spielern angezeigt.</strong></p>
                <p>Warte auf Antworten der Spieler...</p>
                <p><em>Du wirst die Antworten zur Bewertung erhalten.</em></p>
            `;
            questionModal.querySelector('.modal-content').appendChild(waitingDiv);
        } else {
            // Players can answer
            document.getElementById('playerAnswerSection').style.display = 'block';
            document.getElementById('adminAnswerSection').style.display = 'none';
            
            // Reset answer input
            answerInput.value = '';
            submitAnswerBtn.disabled = false;
            submitAnswerBtn.textContent = 'Antwort abgeben';
        }
        
        questionModal.style.display = 'flex';
    }

    function showAdminReview(data) {
        console.log('Admin reviewing answer:', data);
        
        // Store player data for point awarding
        questionModal.dataset.playerData = JSON.stringify({
            id: data.playerId
        });
        
        // Store question data for point awarding
        questionModal.dataset.questionData = JSON.stringify({
            category: data.category,
            questionIndex: data.questionIndex,
            points: data.points
        });
        
        document.getElementById('playerAnswerSection').style.display = 'none';
        document.getElementById('adminAnswerSection').style.display = 'block';
        
        document.getElementById('answerPlayerName').textContent = data.playerName;
        document.getElementById('submittedAnswer').textContent = data.answer;
        document.getElementById('correctAnswer').textContent = data.correctAnswer;
    }

    function findPlayerIdByName(playerName) {
        const player = gameData.players.find(p => p.name === playerName);
        return player ? player.id : null;
    }

    function updateScores(scores) {
        const scoresList = document.getElementById('scoresList');
        scoresList.innerHTML = '';
        
        // Convert scores object to array and sort by score
        const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        
        sortedScores.forEach(([playerId, score]) => {
            const player = gameData.players.find(p => p.id === playerId);
            if (player) {
                const scoreItem = document.createElement('div');
                scoreItem.className = 'score-item';
                scoreItem.innerHTML = `
                    <div class="score-name">${player.name}</div>
                    <div class="score-points">${score} Punkte</div>
                `;
                scoresList.appendChild(scoreItem);
            }
        });
    }

    function updateCurrentPlayer(player) {
        document.getElementById('currentPlayerName').textContent = player.name;
        
        // Highlight current player in scoreboard
        const scoreItems = document.querySelectorAll('.score-item');
        scoreItems.forEach(item => {
            item.classList.remove('current-player');
            if (item.querySelector('.score-name').textContent === player.name) {
                item.classList.add('current-player');
            }
        });
    }

    function markQuestionAsUsed(category, questionIndex) {
        const questionCard = document.querySelector(
            `[data-category="${category}"][data-question-index="${questionIndex}"]`
        );
        if (questionCard) {
            questionCard.classList.add('used');
            questionCard.textContent = 'X';
        }
    }

    function showGameEndScreen(data) {
        const gameEndModal = document.getElementById('gameEndModal');
        const winnersDiv = document.getElementById('winners');
        const finalScoresDiv = document.getElementById('finalScores');
        
        // Show winners
        if (data.winners.length === 1) {
            winnersDiv.innerHTML = `<h3>🏆 Gewinner: ${data.winners[0]}</h3>`;
        } else {
            winnersDiv.innerHTML = `<h3>🏆 Unentschieden zwischen: ${data.winners.join(', ')}</h3>`;
        }
        
        // Show final scores
        const sortedScores = Object.entries(data.finalScores).sort((a, b) => b[1] - a[1]);
        let scoresHTML = '<h4>Endergebnis:</h4><ul>';
        
        sortedScores.forEach(([playerId, score]) => {
            const player = gameData.players.find(p => p.id === playerId);
            if (player) {
                scoresHTML += `<li>${player.name}: ${score} Punkte</li>`;
            }
        });
        
        scoresHTML += '</ul>';
        finalScoresDiv.innerHTML = scoresHTML;
        
        gameEndModal.style.display = 'flex';
    }

    function setupWebcam() {
        const webcamGrid = document.getElementById('webcamGrid');
        
        try {
            // Don't access camera in game - it's handled by lobby
            // Add placeholder for local user
            const localFeed = document.createElement('div');
            localFeed.className = 'webcam-feed';
            localFeed.innerHTML = `
                <div class="webcam-placeholder">📹 Kamera-Stream</div>
                <div class="webcam-label">${playerData.name} (Du)</div>
            `;
            webcamGrid.appendChild(localFeed);
            
            // Add placeholder feeds for other players
            gameData.players.forEach(player => {
                if (player.name !== playerData.name) {
                    const playerFeed = document.createElement('div');
                    playerFeed.className = 'webcam-feed';
                    playerFeed.innerHTML = `
                        <div class="webcam-placeholder">📷 Kamera-Stream</div>
                        <div class="webcam-label">${player.name}</div>
                    `;
                    webcamGrid.appendChild(playerFeed);
                }
            });
            
            console.log('Webcam setup completed (placeholder mode)');
            
        } catch (error) {
            console.error('Webcam setup error:', error);
            
            // Add error placeholder
            const errorFeed = document.createElement('div');
            errorFeed.className = 'webcam-feed';
            errorFeed.innerHTML = `
                <div class="webcam-placeholder">❌ Fehler</div>
                <div class="webcam-label">${playerData.name} (Du)</div>
            `;
            webcamGrid.appendChild(errorFeed);
        }
    }

    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    });

    // Close modal on outside click
    document.addEventListener('click', function(event) {
        if (event.target === questionModal) {
            // Don't allow closing during active question
            // questionModal.style.display = 'none';
        }
    });
});