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
    
    // Get user role from database
    const db = getDatabase();
    db.get('SELECT id, username, email, role FROM users WHERE id = ?', [user.id], (err, dbUser) => {
      if (err || !dbUser) {
        return res.status(403).json({ error: 'User not found' });
      }
      
      req.user = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        role: dbUser.role
      };
      next();
    });
  });
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient privileges' });
    }
    
    next();
  };
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
  const userRole = req.user.role;
  const db = getDatabase();
  
  try {
    // Admin and chef_projet have access to all projects
    if (['admin', 'chef_projet'].includes(userRole)) {
      req.projectAccess = {
        isOwner: userRole === 'admin',
        role: 'manager',
        permissions: { read: true, write: true, delete: true }
      };
      return next();
    }
    
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
      
      if (!row && userRole !== 'support') {
        return res.status(403).json({ error: 'Access denied to this project' });
      }
      
      // Support role has read-only access to all projects
      if (userRole === 'support') {
        req.projectAccess = {
          isOwner: false,
          role: 'support',
          permissions: { read: true, write: false, delete: false }
        };
        return next();
      }
      
      // Technicien has limited access
      if (userRole === 'technicien') {
        req.projectAccess = {
          isOwner: false,
          role: 'technicien',
          permissions: { read: true, write: false, delete: false }
        };
        return next();
      }
      
      req.projectAccess = {
        isOwner: row.createdBy === userId,
        role: row.role || 'owner',
        permissions: row.permissions ? JSON.parse(row.permissions) : { read: true, write: true, delete: true }
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
  checkProjectAccess,
  requireRole
};