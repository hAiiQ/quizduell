const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'public')));

// Game data structure
const lobbies = new Map();
const players = new Map(); // socketId -> player info

// Jeopardy Questions Data
const jeopardyQuestions = {
  round1: {
    "Geschichte": [
      { question: "Wer war der erste Kaiser von Deutschland?", answer: "Wilhelm I", points: 100 },
      { question: "In welchem Jahr fiel die Berliner Mauer?", answer: "1989", points: 200 },
      { question: "Welcher deutsche König wurde auch Kaiser des Heiligen Römischen Reiches?", answer: "Karl der Große", points: 300 },
      { question: "Wie hieß die erste deutsche Verfassung von 1919?", answer: "Weimarer Verfassung", points: 500 }
    ],
    "Geografie": [
      { question: "Welche ist die Hauptstadt von Bayern?", answer: "München", points: 100 },
      { question: "Wie heißt der höchste Berg Deutschlands?", answer: "Zugspitze", points: 200 },
      { question: "Welcher Fluss fließt durch Hamburg?", answer: "Elbe", points: 300 },
      { question: "Wie viele Bundesländer hat Deutschland?", answer: "16", points: 500 }
    ],
    "Sport": [
      { question: "Wie oft hat Deutschland die Fußball-WM gewonnen?", answer: "4 mal", points: 100 },
      { question: "In welcher Stadt fanden die Olympischen Spiele 1972 statt?", answer: "München", points: 200 },
      { question: "Wie heißt die höchste deutsche Fußballliga?", answer: "Bundesliga", points: 300 },
      { question: "Welcher deutsche Tennisspieler gewann 6 Grand Slams?", answer: "Boris Becker", points: 500 }
    ],
    "Wissenschaft": [
      { question: "Wer entwickelte die Relativitätstheorie?", answer: "Albert Einstein", points: 100 },
      { question: "Wie heißt das chemische Element mit dem Symbol 'Au'?", answer: "Gold", points: 200 },
      { question: "Welches Organ produziert Insulin?", answer: "Bauchspeicheldrüse", points: 300 },
      { question: "Wie viele Knochen hat ein erwachsener Mensch?", answer: "206", points: 500 }
    ],
    "Kultur": [
      { question: "Wer komponierte die 'Mondscheinsonate'?", answer: "Ludwig van Beethoven", points: 100 },
      { question: "In welcher Stadt steht das Brandenburger Tor?", answer: "Berlin", points: 200 },
      { question: "Welcher deutsche Autor schrieb 'Faust'?", answer: "Johann Wolfgang von Goethe", points: 300 },
      { question: "Wie heißt das berühmteste Oktoberfest der Welt?", answer: "Münchner Oktoberfest", points: 500 }
    ]
  },
  round2: {
    "Geschichte": [
      { question: "Wann begann der Erste Weltkrieg?", answer: "1914", points: 200 },
      { question: "Welche deutsche Stadt wurde 1945 durch Atombomben zerstört?", answer: "Keine (das waren japanische Städte)", points: 400 },
      { question: "Wer war der letzte Kaiser von Deutschland?", answer: "Wilhelm II", points: 600 },
      { question: "In welchem Jahr wurde die DDR gegründet?", answer: "1949", points: 1000 }
    ],
    "Geografie": [
      { question: "Welches Meer grenzt im Norden an Deutschland?", answer: "Nord- und Ostsee", points: 200 },
      { question: "Welche deutsche Stadt liegt am weitesten im Süden?", answer: "Oberstdorf", points: 400 },
      { question: "Wie heißt der größte See Deutschlands?", answer: "Bodensee", points: 600 },
      { question: "Welches Bundesland hat die meisten Einwohner?", answer: "Nordrhein-Westfalen", points: 1000 }
    ],
    "Sport": [
      { question: "Welcher deutsche Fahrer wurde 7-mal Formel 1 Weltmeister?", answer: "Michael Schumacher", points: 200 },
      { question: "In welcher Sportart ist Deutschland bei Olympia am erfolgreichsten?", answer: "Reitsport", points: 400 },
      { question: "Wie heißt das deutsche Nationalstadion?", answer: "Olympiastadion Berlin", points: 600 },
      { question: "Welcher deutsche Verein gewann die meisten Champions League Titel?", answer: "Bayern München", points: 1000 }
    ],
    "Wissenschaft": [
      { question: "Welche Geschwindigkeit hat Licht im Vakuum?", answer: "300.000 km/s", points: 200 },
      { question: "Wie heißt die kleinste Einheit der Materie?", answer: "Atom", points: 400 },
      { question: "Welcher deutsche Physiker entdeckte die Röntgenstrahlen?", answer: "Wilhelm Conrad Röntgen", points: 600 },
      { question: "Wie viele Planeten hat unser Sonnensystem?", answer: "8", points: 1000 }
    ],
    "Kultur": [
      { question: "Welcher deutsche Film gewann 2023 einen Oscar?", answer: "Im Westen nichts Neues", points: 200 },
      { question: "Wer malte das berühmte Bild 'Der Schrei'?", answer: "Edvard Munch (Norweger, nicht deutscher)", points: 400 },
      { question: "Welches deutsche Bauwerk ist UNESCO Weltkulturerbe?", answer: "Kölner Dom", points: 600 },
      { question: "Wer schrieb 'Die Buddenbrooks'?", answer: "Thomas Mann", points: 1000 }
    ]
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/lobby/:lobbyId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'lobby.html'));
});

app.get('/game/:lobbyId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'game.html'));
});

// Health check for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create new lobby
  socket.on('createLobby', (playerName) => {
    const lobbyId = uuidv4().substring(0, 6).toUpperCase();
    const lobby = {
      id: lobbyId,
      admin: socket.id,
      adminName: playerName,
      players: [],
      gameState: 'lobby', // lobby, playing, finished
      currentRound: 1,
      currentPlayer: 0,
      usedQuestions: new Set(),
      scores: {}
    };
    
    lobbies.set(lobbyId, lobby);
    players.set(socket.id, { name: playerName, lobbyId, isAdmin: true });
    
    socket.join(lobbyId);
    socket.emit('lobbyCreated', { lobbyId, isAdmin: true });
    
    console.log(`Lobby ${lobbyId} created by ${playerName} (${socket.id})`);
  });

  // Rejoin lobby (for page refreshes/navigation and new joins)
  socket.on('rejoinLobby', (data) => {
    const { lobbyId, playerName, isAdmin } = data;
    const lobby = lobbies.get(lobbyId);
    
    console.log(`Rejoin/Join attempt: ${playerName} (admin: ${isAdmin}) trying to join lobby ${lobbyId}`);
    console.log('Available lobbies:', Array.from(lobbies.keys()));
    
    if (!lobby) {
      console.log(`Lobby ${lobbyId} not found`);
      socket.emit('error', 'Lobby nicht gefunden');
      return;
    }
    
    if (lobby.gameState !== 'lobby' && !isAdmin) {
      socket.emit('error', 'Spiel läuft bereits');
      return;
    }
    
    if (isAdmin) {
      // Update admin socket ID
      lobby.admin = socket.id;
      players.set(socket.id, { name: playerName, lobbyId, isAdmin: true });
      console.log(`Admin ${playerName} reconnected to lobby ${lobbyId}`);
    } else {
      // Check if lobby is full (max 4 players)
      if (lobby.players.length >= 4) {
        const existingPlayer = lobby.players.find(p => p.name === playerName);
        if (!existingPlayer) {
          socket.emit('error', 'Lobby ist voll');
          return;
        }
      }
      
      // Update or add player
      const existingPlayer = lobby.players.find(p => p.name === playerName);
      if (existingPlayer) {
        // Update existing player's socket ID
        existingPlayer.id = socket.id;
        console.log(`Player ${playerName} reconnected to lobby ${lobbyId}`);
      } else {
        // Add new player
        lobby.players.push({ id: socket.id, name: playerName, score: 0 });
        console.log(`New player ${playerName} joined lobby ${lobbyId}`);
      }
      lobby.scores[socket.id] = lobby.scores[socket.id] || 0;
      players.set(socket.id, { name: playerName, lobbyId, isAdmin: false });
    }
    
    socket.join(lobbyId);
    socket.emit('joinedLobby', { lobbyId, isAdmin });
    
    // Update all players in lobby
    io.to(lobbyId).emit('playersUpdate', {
      admin: { id: lobby.admin, name: lobby.adminName },
      players: lobby.players
    });
    
    console.log(`${playerName} successfully joined lobby ${lobbyId}`);
  });

  // Join lobby
  socket.on('joinLobby', (data) => {
    const { lobbyId, playerName } = data;
    const lobby = lobbies.get(lobbyId);
    
    console.log(`Join attempt: ${playerName} trying to join lobby ${lobbyId}`);
    console.log('Available lobbies:', Array.from(lobbies.keys()));
    
    if (!lobby) {
      console.log(`Lobby ${lobbyId} not found`);
      socket.emit('error', 'Lobby nicht gefunden');
      return;
    }
    
    if (lobby.players.length >= 4) {
      socket.emit('error', 'Lobby ist voll');
      return;
    }
    
    if (lobby.gameState !== 'lobby') {
      socket.emit('error', 'Spiel läuft bereits');
      return;
    }
    
    const player = {
      id: socket.id,
      name: playerName,
      score: 0
    };
    
    lobby.players.push(player);
    lobby.scores[socket.id] = 0;
    players.set(socket.id, { name: playerName, lobbyId, isAdmin: false });
    
    socket.join(lobbyId);
    socket.emit('joinedLobby', { lobbyId, isAdmin: false });
    
    // Update all players in lobby
    io.to(lobbyId).emit('playersUpdate', {
      admin: { id: lobby.admin, name: lobby.adminName },
      players: lobby.players
    });
    
    console.log(`${playerName} joined lobby ${lobbyId}`);
  });

  // Start game
  socket.on('startGame', () => {
    const player = players.get(socket.id);
    if (!player || !player.isAdmin) return;
    
    const lobby = lobbies.get(player.lobbyId);
    if (!lobby || lobby.players.length === 0) {
      socket.emit('error', 'Mindestens ein Spieler erforderlich');
      return;
    }
    
    lobby.gameState = 'playing';
    io.to(player.lobbyId).emit('gameStarted', {
      round: lobby.currentRound,
      questions: jeopardyQuestions.round1,
      players: lobby.players,
      scores: lobby.scores,
      currentPlayer: lobby.currentPlayer
    });
    
    console.log(`Game started in lobby ${player.lobbyId}`);
  });

  // Select question
  socket.on('selectQuestion', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.isAdmin) {
      console.log('Non-admin tried to select question:', player?.name);
      return;
    }
    
    const lobby = lobbies.get(player.lobbyId);
    if (!lobby || lobby.gameState !== 'playing') return;
    
    const { category, questionIndex } = data;
    const questionKey = `${category}_${questionIndex}`;
    
    if (lobby.usedQuestions.has(questionKey)) {
      socket.emit('error', 'Frage bereits beantwortet');
      return;
    }
    
    lobby.usedQuestions.add(questionKey);
    const questions = lobby.currentRound === 1 ? jeopardyQuestions.round1 : jeopardyQuestions.round2;
    const question = questions[category][questionIndex];
    
    io.to(player.lobbyId).emit('questionSelected', {
      category,
      questionIndex,
      question: question.question,
      points: question.points,
      currentPlayer: lobby.players[lobby.currentPlayer]
    });
  });

  // Submit answer
  socket.on('submitAnswer', (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    
    const lobby = lobbies.get(player.lobbyId);
    if (!lobby) return;
    
    const { answer, category, questionIndex } = data;
    const questions = lobby.currentRound === 1 ? jeopardyQuestions.round1 : jeopardyQuestions.round2;
    const correctAnswer = questions[category][questionIndex].answer;
    
    io.to(player.lobbyId).emit('answerSubmitted', {
      playerId: socket.id,
      playerName: player.name,
      answer,
      correctAnswer,
      category,
      questionIndex,
      points: questions[category][questionIndex].points
    });
  });

  // Award points (admin only)
  socket.on('awardPoints', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.isAdmin) return;
    
    const lobby = lobbies.get(player.lobbyId);
    if (!lobby) return;
    
    const { playerId, points, correct } = data;
    
    if (correct) {
      lobby.scores[playerId] += points;
    }
    
    // Move to next player
    lobby.currentPlayer = (lobby.currentPlayer + 1) % lobby.players.length;
    
    io.to(player.lobbyId).emit('pointsAwarded', {
      playerId,
      points: correct ? points : 0,
      newScore: lobby.scores[playerId],
      allScores: lobby.scores,
      nextPlayer: lobby.players[lobby.currentPlayer]
    });
  });

  // Next round
  socket.on('nextRound', () => {
    const player = players.get(socket.id);
    if (!player || !player.isAdmin) return;
    
    const lobby = lobbies.get(player.lobbyId);
    if (!lobby) return;
    
    lobby.currentRound = 2;
    lobby.usedQuestions.clear();
    
    io.to(player.lobbyId).emit('roundChanged', {
      round: 2,
      questions: jeopardyQuestions.round2,
      scores: lobby.scores
    });
  });

  // End game
  socket.on('endGame', () => {
    const player = players.get(socket.id);
    if (!player || !player.isAdmin) return;
    
    const lobby = lobbies.get(player.lobbyId);
    if (!lobby) return;
    
    lobby.gameState = 'finished';
    
    // Calculate winner
    let maxScore = -1;
    let winners = [];
    
    for (const [playerId, score] of Object.entries(lobby.scores)) {
      if (score > maxScore) {
        maxScore = score;
        winners = [playerId];
      } else if (score === maxScore) {
        winners.push(playerId);
      }
    }
    
    const winnerNames = winners.map(id => {
      const p = lobby.players.find(player => player.id === id);
      return p ? p.name : 'Unbekannt';
    });
    
    io.to(player.lobbyId).emit('gameEnded', {
      finalScores: lobby.scores,
      winners: winnerNames,
      maxScore
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const lobby = lobbies.get(player.lobbyId);
      
      console.log(`User disconnected: ${socket.id} (${player.name})`);
      
      if (lobby) {
        if (player.isAdmin) {
          // Don't delete lobby immediately - wait for potential reconnect
          console.log(`Admin ${player.name} disconnected from lobby ${player.lobbyId} - lobby kept alive`);
        } else {
          // Remove player from lobby only if they don't reconnect soon
          setTimeout(() => {
            const currentLobby = lobbies.get(player.lobbyId);
            if (currentLobby && currentLobby.players.some(p => p.id === socket.id)) {
              currentLobby.players = currentLobby.players.filter(p => p.id !== socket.id);
              delete currentLobby.scores[socket.id];
              
              io.to(player.lobbyId).emit('playersUpdate', {
                admin: { id: currentLobby.admin, name: currentLobby.adminName },
                players: currentLobby.players
              });
            }
          }, 5000); // 5 second grace period
        }
      }
      
      // Don't delete player data immediately to allow reconnects
      setTimeout(() => {
        players.delete(socket.id);
      }, 10000); // 10 second grace period
    }
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});