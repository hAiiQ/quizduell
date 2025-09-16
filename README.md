# 🎮 Jeopardy Multiplayer Game

Ein vollständig funktionsfähiges Echtzeit-Multiplayer-Jeopardy-Spiel mit Webcam-Unterstützung für bis zu 4 Spieler + 1 Admin.

![Jeopardy Game](https://img.shields.io/badge/Game-Jeopardy-blue) 
![Node.js](https://img.shields.io/badge/Node.js-Express-green) 
![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-orange) 
![Webcam](https://img.shields.io/badge/WebRTC-Webcam%20Support-red)

## 🚀 Live Demo
[Spiele jetzt auf Render](https://your-app-name.onrender.com) *(Nach dem Deployment)*

## Features

- 🎮 **Multiplayer-Gameplay**: Bis zu 4 Spieler + 1 Admin
- 🎯 **Lobby-System**: Einfache Lobby-Erstellung und -Beitritt mit 6-stelligen Codes
- 📹 **Webcam-Integration**: Live-Video-Feeds aller Spieler während des Spiels
- ⚡ **Echtzeit-Kommunikation**: Socket.io für Live-Updates
- 🏆 **Vollständiges Jeopardy-Format**: 5 Kategorien, 4 Fragen pro Kategorie, 2 Runden
- 💰 **Punktesystem**: Runde 1: 100-500€, Runde 2: 200-1000€
- 🎨 **Responsive Design**: Funktioniert auf Desktop und Mobile

## Technologie-Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Webcam**: WebRTC/getUserMedia API
- **Deployment**: Render-ready

## Installation & Lokale Entwicklung

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd jeopardy-game
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```
   
   Oder für Produktion:
   ```bash
   npm start
   ```

4. **Im Browser öffnen**
   ```
   http://localhost:3000
   ```

## Deployment auf Render

### Automatisches Deployment

1. **GitHub Repository erstellen** und Code hochladen
2. **Render.com Account** erstellen
3. **Neue Web Service** auf Render erstellen:
   - Repository verbinden
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

### Manuelle Konfiguration

Render erkennt automatisch die `package.json` und verwendet:
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Port**: Automatisch von Render zugewiesen (über `process.env.PORT`)

## Spielregeln

### Lobby-Phase
1. **Admin erstellt Lobby** mit seinem Namen
2. **Spieler treten bei** mit dem 6-stelligen Lobby-Code
3. **Webcam-Test** in der Lobby möglich
4. **Admin startet das Spiel** wenn alle bereit sind

### Gameplay
1. **Runde 1**: 5 Kategorien mit je 4 Fragen (100€, 200€, 300€, 500€)
2. **Runde 2**: Gleiche Kategorien mit höheren Punkten (200€, 400€, 600€, 1000€)
3. **Spieler wählen Fragen** der Reihe nach aus
4. **Admin bewertet Antworten** als richtig oder falsch
5. **Punkte werden automatisch vergeben**
6. **Gewinner** wird am Ende ermittelt

## API Endpoints

- `GET /` - Startseite (Lobby erstellen/beitreten)
- `GET /lobby/:lobbyId` - Lobby-Warteraum
- `GET /game/:lobbyId` - Spieloberfläche
- Socket.io Events für Echtzeit-Kommunikation

## Socket.io Events

### Client → Server
- `createLobby(playerName)` - Neue Lobby erstellen
- `joinLobby({lobbyId, playerName})` - Lobby beitreten
- `startGame()` - Spiel starten (nur Admin)
- `selectQuestion({category, questionIndex})` - Frage auswählen
- `submitAnswer({answer, category, questionIndex})` - Antwort abgeben
- `awardPoints({playerId, points, correct})` - Punkte vergeben (nur Admin)
- `nextRound()` - Nächste Runde (nur Admin)
- `endGame()` - Spiel beenden (nur Admin)

### Server → Client
- `lobbyCreated({lobbyId, isAdmin})` - Lobby erfolgreich erstellt
- `joinedLobby({lobbyId, isAdmin})` - Lobby erfolgreich beigetreten
- `playersUpdate({admin, players})` - Spieler-Liste aktualisiert
- `gameStarted(gameData)` - Spiel gestartet
- `questionSelected(questionData)` - Frage ausgewählt
- `answerSubmitted(answerData)` - Antwort eingereicht
- `pointsAwarded(scoreData)` - Punkte vergeben
- `roundChanged(roundData)` - Runde gewechselt
- `gameEnded(endData)` - Spiel beendet
- `error(message)` - Fehlermeldung

## Projektstruktur

```
jeopardy-game/
├── package.json
├── server.js              # Express Server + Socket.io
├── views/
│   ├── index.html        # Startseite
│   ├── lobby.html        # Lobby-Warteraum
│   └── game.html         # Hauptspiel
├── public/
│   ├── css/
│   │   └── style.css     # Alle Styles
│   └── js/
│       ├── main.js       # Startseite-Logik
│       ├── lobby.js      # Lobby-Logik
│       └── game.js       # Spiel-Logik
└── README.md
```

## Browser-Kompatibilität

- **Chrome** 80+ ✅
- **Firefox** 75+ ✅
- **Safari** 13+ ✅
- **Edge** 80+ ✅

**Webcam-Unterstützung** erfordert HTTPS in Produktion (Render stellt automatisch bereit).

## Troubleshooting

### Webcam funktioniert nicht
- Browser-Berechtigungen für Kamera überprüfen
- HTTPS-Verbindung erforderlich (lokale Entwicklung: localhost ist OK)
- Firewall/Antivirus könnte Kamera-Zugriff blockieren

### Verbindungsprobleme
- Port 3000 freigeben bei lokaler Entwicklung
- Socket.io CORS-Einstellungen prüfen
- Render-Logs in der Render-Konsole überprüfen

### Performance-Optimierung
- Webcam-Auflösung reduzieren (bereits auf 320x240 eingestellt)
- Bei schlechter Verbindung Audio deaktiviert

## Lizenz

MIT License - Siehe LICENSE-Datei für Details.

## Support

Bei Problemen oder Fragen:
1. GitHub Issues verwenden
2. Render-Logs überprüfen
3. Browser-Konsole auf Fehler prüfen