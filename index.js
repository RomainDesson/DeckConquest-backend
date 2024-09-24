require('dotenv').config();
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
    origin: process.env.CORS_ORIGIN,
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
      console.log(players[gameId])
      const [player1, player2] = players[gameId];
      io.to(gameId).emit('startGame', { 
        player1: { name: player1.name, id: player1.id },
        player2: { name: player2.name, id: player2.id }
      });
    }
  });

  socket.on('playCard', (gameId, card, zoneId) => {
    if (!zones[gameId]) {
      console.error(`Game ${gameId} does not exist.`);
      return;
    }
    zones[gameId][zoneId].push(card);
    console.log(`Card played: ${card} in zone ${zoneId} by player ${socket.id}`);
    socket.emit('cardPlayed', card, zoneId);
  });

  socket.on('endTurn', (gameId, player, endGame = false) => {
    if (!playersReady[gameId]) {
        playersReady[gameId] = [];
    }
    if (!playersReady[gameId].includes(player)) {
        playersReady[gameId].push(player);
    }
    if (playersReady[gameId].length === 2) {
        turnCount[gameId] = turnCount[gameId] + 1;
        io.to(gameId).emit('endTurn', turnCount[gameId]);
        if (endGame) {
          console.log(`Game ${gameId} ended`);
          io.to(gameId).emit('gameEnded');
        }
        playersReady[gameId] = [];
    }
  });

  socket.on('revealCards', (gameId) => {
    if (!zones[gameId]) {
      console.error(`Game ${gameId} does not exist.`);
      return;
    }
    const revealedCards = {};
    for (let zoneId in zones[gameId]) {
      revealedCards[zoneId] = zones[gameId][zoneId];
    }

    console.log(`Revealing cards for game ${gameId}:`, revealedCards);
    io.to(gameId).emit('cardsRevealed', revealedCards);
  });

  socket.on('pickWinner', (gameId, score) => {
    if (!players[gameId]) {
      console.error(`Game ${gameId} does not exist in players.`);
      return;
    }
  
    const player1 = players[gameId][0];
    const player2 = players[gameId][1];
  
    const playerOneScore = score[0];
    const playerTwoScore = score[1];
  
    let winner;
    if (playerOneScore > playerTwoScore) {
      winner = player1.name;
    } else if (playerOneScore < playerTwoScore) {
      winner = player2.name;
    } else {
      winner = 'Draw';
    }
  
    io.to(gameId).emit('winner', winner);
    console.log(`Game ${gameId} ended with score:`, score);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  
    for (const gameId in players) {
      players[gameId] = players[gameId].filter(player => player.id !== socket.id);
      
      if (players[gameId].length === 0) {
        delete players[gameId];
        delete zones[gameId];
        delete turnCount[gameId];
        delete playersReady[gameId];
      }
    }
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
