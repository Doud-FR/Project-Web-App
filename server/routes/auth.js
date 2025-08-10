const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Register new user - ADMIN ONLY
router.post('/register', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { username, email, password, firstName, lastName, role } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }
  
  // Validate role
  const validRoles = ['admin', 'chef_projet', 'technicien', 'support'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }
  
  try {
    const db = getDatabase();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (username, email, password, firstName, lastName, role, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      username, 
      email, 
      hashedPassword, 
      firstName || '', 
      lastName || '', 
      role || 'technicien',
      req.user.id
    ], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: 'Failed to create user' });
      }
      
      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: this.lastID,
          username,
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          role: role || 'technicien'
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const db = getDatabase();
  const query = `
    SELECT id, username, email, password, firstName, lastName, role
    FROM users
    WHERE username = ? OR email = ?
  `;
  
  db.get(query, [username, username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

module.exports = router;