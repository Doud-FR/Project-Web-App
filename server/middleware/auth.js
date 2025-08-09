const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
};

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    
    socket.userId = user.id;
    socket.username = user.username;
    next();
  });
};

const checkProjectAccess = async (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  const userId = req.user.id;
  const db = getDatabase();
  
  try {
    // Check if user is project owner or member
    const query = `
      SELECT p.id, p.createdBy, pm.role, pm.permissions
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.projectId AND pm.userId = ?
      WHERE p.id = ? AND (p.createdBy = ? OR pm.userId = ?)
    `;
    
    db.get(query, [userId, projectId, userId, userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }
      
      req.projectAccess = {
        isOwner: row.createdBy === userId,
        role: row.role || 'owner',
        permissions: row.permissions ? JSON.parse(row.permissions) : null
      };
      
      next();
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  checkProjectAccess
};