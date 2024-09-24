const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;  
const io = new Server(server, {
  cors: {
    origin: "https://nft-card-game-flame.vercel.app/",
    methods: ["GET", "POST"]
  }
});

const players = {};
const turnCount = {};
const playersReady = {};
const zones = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinGame', (gameId, playerName) => {
    socket.join(gameId);

    if (!players[gameId]) {
      players[gameId] = [];
    }

    players[gameId].push({ id: socket.id, name: playerName });

    // Initialisation des zones si nécessaire
    if (!zones[gameId]) {
      zones[gameId] = {
        0: [], 1: [], 2: [], // zones pour joueur 1
        3: [], 4: [], 5: []  // zones pour joueur 2
      };
    }

    console.log(`User ${playerName} joined game ${gameId}`);

    socket.to(gameId).emit('playerJoined', playerName);
    socket.emit('welcome', { id: socket.id, name: playerName });

    if (players[gameId].length === 2) {
      const [player1, player2] = players[gameId];
      io.to(gameId).emit('startGame', { 
        player1: { name: player1.name, id: player1.id },
        player2: { name: player2.name, id: player2.id }
      });
    }
  });

  socket.on('endTurn', (gameId, player) => {
    if (!playersReady[gameId]) {
        playersReady[gameId] = [];
    }
    if (!playersReady[gameId].includes(player)) {
        playersReady[gameId].push(player);
    }
    if (playersReady[gameId].length === 2) {
        turnCount[gameId] = turnCount[gameId] + 1;
        io.to(gameId).emit('endTurn', turnCount[gameId]);
        playersReady[gameId] = [];
    }
  });

  socket.on('playCard', (gameId, card, zoneId) => {
    if (!zones[gameId]) {
      console.error(`Game ${gameId} does not exist.`);
      return;
    }

    // Ajout de la carte dans la zone correspondante
    zones[gameId][zoneId].push(card);
    console.log(`Card played: ${card} in zone ${zoneId} by player ${socket.id}`);

    // Emission au joueur spécifique que la carte est jouée
    socket.emit('cardPlayed', card, zoneId);
  });

  socket.on('revealCards', (gameId) => {
    if (!zones[gameId]) {
      console.error(`Game ${gameId} does not exist.`);
      return;
    }

    // Regroupement des cartes de toutes les zones
    const revealedCards = {};
    for (let zoneId in zones[gameId]) {
      revealedCards[zoneId] = zones[gameId][zoneId];
    }

    console.log(`Revealing cards for game ${gameId}:`, revealedCards);

    // Emission de l'événement à tous les joueurs de la partie
    io.to(gameId).emit('cardsRevealed', revealedCards);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  
    for (const gameId in players) {
      players[gameId] = players[gameId].filter(player => player.id !== socket.id);
      
      // Si tous les joueurs ont quitté la partie, on la supprime
      if (players[gameId].length === 0) {
        delete players[gameId];
        delete zones[gameId];  // Réinitialiser les zones si la partie n'existe plus
        delete turnCount[gameId];
        delete playersReady[gameId];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
