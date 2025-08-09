const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get current user profile
router.get('/me', (req, res) => {
  const userId = req.user.id;
  const db = getDatabase();
  
  const query = `
    SELECT id, username, email, firstName, lastName, role, createdAt
    FROM users
    WHERE id = ?
  `;
  
  db.get(query, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });
});

// Search users (for adding to projects)
router.get('/search', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  const db = getDatabase();
  const query = `
    SELECT id, username, email, firstName, lastName
    FROM users
    WHERE username LIKE ? OR email LIKE ? OR firstName LIKE ? OR lastName LIKE ?
    LIMIT 10
  `;
  
  const searchTerm = `%${q}%`;
  
  db.all(query, [searchTerm, searchTerm, searchTerm, searchTerm], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(users);
  });
});

// Update user profile
router.put('/me', (req, res) => {
  const userId = req.user.id;
  const { firstName, lastName, email } = req.body;
  
  const db = getDatabase();
  const query = `
    UPDATE users
    SET firstName = ?, lastName = ?, email = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [firstName, lastName, email, userId], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Profile updated successfully' });
  });
});

// Get user's tasks
router.get('/me/tasks', (req, res) => {
  const userId = req.user.id;
  const db = getDatabase();
  
  const query = `
    SELECT t.*, p.title as projectTitle
    FROM tasks t
    JOIN projects p ON t.projectId = p.id
    WHERE t.assignedTo = ? AND t.status != 'completed'
    ORDER BY t.endDate ASC
  `;
  
  db.all(query, [userId], (err, tasks) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(tasks);
  });
});

module.exports = router;