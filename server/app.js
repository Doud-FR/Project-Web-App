const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/clients');
const interventionReportsRoutes = require('./routes/interventionReports');
const taskNotesRoutes = require('./routes/taskNotes');
const { initDatabase } = require('./config/database');
const { authenticateSocket } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../client/public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/intervention-reports', interventionReportsRoutes);
app.use('/api/task-notes', taskNotesRoutes);

// Socket.IO connection handling
io.use(authenticateSocket);
io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  
  // Join user to their projects rooms
  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`User ${socket.userId} joined project ${projectId}`);
  });
  
  // Handle project updates
  socket.on('project-update', (data) => {
    socket.to(`project-${data.projectId}`).emit('project-updated', data);
  });
  
  // Handle task updates
  socket.on('task-update', (data) => {
    socket.to(`project-${data.projectId}`).emit('task-updated', data);
  });
  
  // Handle real-time cursor movement (for collaboration)
  socket.on('cursor-move', (data) => {
    socket.to(`project-${data.projectId}`).emit('cursor-moved', {
      userId: socket.userId,
      ...data
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Internal Server Error',
    }
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Client: http://localhost:${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

module.exports = { app, server, io };