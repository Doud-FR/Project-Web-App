const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken, requireRole(['admin']));

// Get all users
router.get('/users', (req, res) => {
  const db = getDatabase();
  const query = `
    SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.role, 
           u.createdAt, u.updatedAt,
           creator.username as createdByUsername
    FROM users u
    LEFT JOIN users creator ON u.createdBy = creator.id
    ORDER BY u.createdAt DESC
  `;
  
  db.all(query, (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Remove password field
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    
    res.json(safeUsers);
  });
});

// Create new user
router.post('/users', async (req, res) => {
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

// Update user
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, firstName, lastName, role, password } = req.body;
  
  // Validate role if provided
  const validRoles = ['admin', 'chef_projet', 'technicien', 'support'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }
  
  try {
    const db = getDatabase();
    let query = `
      UPDATE users 
      SET username = ?, email = ?, firstName = ?, lastName = ?, role = ?, updatedAt = CURRENT_TIMESTAMP
    `;
    let params = [username, email, firstName || '', lastName || '', role];
    
    // If password is provided, hash it and include in update
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = ?`;
      params.push(hashedPassword);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);
    
    db.run(query, params, function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: 'Failed to update user' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'User updated successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  
  // Prevent admin from deleting themselves
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  const db = getDatabase();
  const query = 'DELETE FROM users WHERE id = ?';
  
  db.run(query, [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  });
});

module.exports = router;