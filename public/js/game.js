const socket = io();
let isAdmin = false;
let lobbyId = '';
let gameData = null;
let currentQuestions = {};
let localStream = null;
let playerStreams = new Map();

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
    setupWebcam();
    
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

    async function setupWebcam() {
        const webcamGrid = document.getElementById('webcamGrid');
        
        try {
            // Check if getUserMedia is available
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 320 },
                        height: { ideal: 240 },
                        facingMode: 'user'
                    }, 
                    audio: false 
                });
                
                // Add local video
                const localFeed = document.createElement('div');
                localFeed.className = 'webcam-feed';
                localFeed.innerHTML = `
                    <video autoplay muted playsinline></video>
                    <div class="webcam-label">${playerData.name} (Du)</div>
                `;
                
                const localVideo = localFeed.querySelector('video');
                localVideo.srcObject = localStream;
                webcamGrid.appendChild(localFeed);
                
                console.log('Webcam setup successful');
            } else {
                // Add placeholder for local user without camera
                const localFeed = document.createElement('div');
                localFeed.className = 'webcam-feed';
                localFeed.innerHTML = `
                    <div class="webcam-placeholder">Kamera nicht verfügbar</div>
                    <div class="webcam-label">${playerData.name} (Du)</div>
                `;
                webcamGrid.appendChild(localFeed);
            }
            
            // Add placeholder feeds for other players
            gameData.players.forEach(player => {
                if (player.name !== playerData.name) {
                    const playerFeed = document.createElement('div');
                    playerFeed.className = 'webcam-feed';
                    playerFeed.innerHTML = `
                        <div class="webcam-placeholder">Kamera nicht verfügbar</div>
                        <div class="webcam-label">${player.name}</div>
                    `;
                    webcamGrid.appendChild(playerFeed);
                }
            });
            
        } catch (error) {
            console.error('Webcam setup error:', error);
            
            // Add error placeholder
            const errorFeed = document.createElement('div');
            errorFeed.className = 'webcam-feed';
            errorFeed.innerHTML = `
                <div class="webcam-placeholder">Kamera-Fehler</div>
                <div class="webcam-label">${playerData.name} (Du)</div>
            `;
            webcamGrid.appendChild(errorFeed);
            
            // Still add placeholders for other players
            gameData.players.forEach(player => {
                if (player.name !== playerData.name) {
                    const playerFeed = document.createElement('div');
                    playerFeed.className = 'webcam-feed';
                    playerFeed.innerHTML = `
                        <div class="webcam-placeholder">Kamera nicht verfügbar</div>
                        <div class="webcam-label">${player.name}</div>
                    `;
                    webcamGrid.appendChild(playerFeed);
                }
            });
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