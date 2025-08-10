const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get notes for a task
router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const db = getDatabase();
  
  const query = `
    SELECT tn.*, u.username, u.firstName, u.lastName
    FROM task_notes tn
    LEFT JOIN users u ON tn.userId = u.id
    WHERE tn.taskId = ?
    ORDER BY tn.createdAt DESC
  `;
  
  db.all(query, [taskId], (err, notes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(notes);
  });
});

// Create new note (technicians can add notes to their assigned tasks)
router.post('/', (req, res) => {
  const { taskId, content, timeSpent } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  if (!taskId || !content) {
    return res.status(400).json({ error: 'Task ID and content are required' });
  }
  
  const db = getDatabase();
  
  // Check if user has access to the task
  let taskQuery;
  let taskParams;
  
  if (userRole === 'technicien') {
    // Technicians can only add notes to tasks assigned to them
    taskQuery = 'SELECT id FROM tasks WHERE id = ? AND assignedTo = ?';
    taskParams = [taskId, userId];
  } else if (['admin', 'chef_projet'].includes(userRole)) {
    // Admin and chef_projet can add notes to any task
    taskQuery = 'SELECT id FROM tasks WHERE id = ?';
    taskParams = [taskId];
  } else {
    // Support role has read-only access
    return res.status(403).json({ error: 'Insufficient privileges to add notes' });
  }
  
  db.get(taskQuery, taskParams, (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!task) {
      return res.status(403).json({ error: 'Task not found or access denied' });
    }
    
    const insertQuery = `
      INSERT INTO task_notes (taskId, userId, content, timeSpent)
      VALUES (?, ?, ?, ?)
    `;
    
    db.run(insertQuery, [taskId, userId, content, timeSpent || 0], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create note' });
      }
      
      res.status(201).json({
        message: 'Note created successfully',
        noteId: this.lastID
      });
    });
  });
});

// Update note (only note author or admin)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { content, timeSpent } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const db = getDatabase();
  
  // Check if user can edit this note
  const checkQuery = 'SELECT userId FROM task_notes WHERE id = ?';
  
  db.get(checkQuery, [id], (err, note) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Only note author or admin can edit
    if (note.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own notes' });
    }
    
    const updateQuery = `
      UPDATE task_notes 
      SET content = ?, timeSpent = ?
      WHERE id = ?
    `;
    
    db.run(updateQuery, [content, timeSpent || 0, id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update note' });
      }
      
      res.json({ message: 'Note updated successfully' });
    });
  });
});

// Delete note (only note author or admin)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const db = getDatabase();
  
  // Check if user can delete this note
  const checkQuery = 'SELECT userId FROM task_notes WHERE id = ?';
  
  db.get(checkQuery, [id], (err, note) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Only note author or admin can delete
    if (note.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }
    
    const deleteQuery = 'DELETE FROM task_notes WHERE id = ?';
    
    db.run(deleteQuery, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete note' });
      }
      
      res.json({ message: 'Note deleted successfully' });
    });
  });
});

module.exports = router;