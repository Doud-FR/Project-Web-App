const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get intervention reports for a task
router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const db = getDatabase();
  
  let query = `
    SELECT ir.*, u.username as technicianName, u.firstName, u.lastName,
           t.title as taskTitle
    FROM intervention_reports ir
    LEFT JOIN users u ON ir.technicianId = u.id
    LEFT JOIN tasks t ON ir.taskId = t.id
    WHERE ir.taskId = ?
  `;
  let params = [taskId];
  
  // Technicians can only see their own reports, others see all
  if (userRole === 'technicien') {
    query += ' AND ir.technicianId = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY ir.createdAt DESC';
  
  db.all(query, params, (err, reports) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(reports);
  });
});

// Get all intervention reports (admin, chef_projet, support)
router.get('/', requireRole(['admin', 'chef_projet', 'support']), (req, res) => {
  const db = getDatabase();
  const query = `
    SELECT ir.*, u.username as technicianName, u.firstName, u.lastName,
           t.title as taskTitle, p.title as projectTitle
    FROM intervention_reports ir
    LEFT JOIN users u ON ir.technicianId = u.id
    LEFT JOIN tasks t ON ir.taskId = t.id
    LEFT JOIN projects p ON t.projectId = p.id
    ORDER BY ir.createdAt DESC
  `;
  
  db.all(query, (err, reports) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(reports);
  });
});

// Get technician's own reports
router.get('/my-reports', requireRole(['technicien']), (req, res) => {
  const userId = req.user.id;
  const db = getDatabase();
  
  const query = `
    SELECT ir.*, t.title as taskTitle, p.title as projectTitle
    FROM intervention_reports ir
    LEFT JOIN tasks t ON ir.taskId = t.id
    LEFT JOIN projects p ON t.projectId = p.id
    WHERE ir.technicianId = ?
    ORDER BY ir.createdAt DESC
  `;
  
  db.all(query, [userId], (err, reports) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(reports);
  });
});

// Create new intervention report (technicians only)
router.post('/', requireRole(['technicien']), (req, res) => {
  const { taskId, title, description, workDone, timeSpent, issues, recommendations } = req.body;
  const technicianId = req.user.id;
  
  if (!taskId || !title || !timeSpent) {
    return res.status(400).json({ error: 'Task ID, title, and time spent are required' });
  }
  
  const db = getDatabase();
  
  // Verify the task is assigned to the technician
  const checkQuery = 'SELECT id FROM tasks WHERE id = ? AND assignedTo = ?';
  
  db.get(checkQuery, [taskId, technicianId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!task) {
      return res.status(403).json({ error: 'You can only create reports for tasks assigned to you' });
    }
    
    const insertQuery = `
      INSERT INTO intervention_reports 
      (taskId, technicianId, title, description, workDone, timeSpent, issues, recommendations, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `;
    
    db.run(insertQuery, [
      taskId, technicianId, title, description || '', workDone || '', 
      timeSpent, issues || '', recommendations || ''
    ], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create intervention report' });
      }
      
      res.status(201).json({
        message: 'Intervention report created successfully',
        reportId: this.lastID
      });
    });
  });
});

// Update intervention report
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, workDone, timeSpent, issues, recommendations, status } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  const db = getDatabase();
  
  // Verify ownership or appropriate role
  const checkQuery = 'SELECT technicianId FROM intervention_reports WHERE id = ?';
  
  db.get(checkQuery, [id], (err, report) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!report) {
      return res.status(404).json({ error: 'Intervention report not found' });
    }
    
    // Technicians can only edit their own reports, others can edit any
    if (userRole === 'technicien' && report.technicianId !== userId) {
      return res.status(403).json({ error: 'You can only edit your own reports' });
    }
    
    // Validate status if provided
    const validStatuses = ['draft', 'submitted', 'approved'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updateQuery = `
      UPDATE intervention_reports 
      SET title = ?, description = ?, workDone = ?, timeSpent = ?, 
          issues = ?, recommendations = ?, status = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateQuery, [
      title, description || '', workDone || '', timeSpent,
      issues || '', recommendations || '', status || 'draft', id
    ], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update intervention report' });
      }
      
      res.json({ message: 'Intervention report updated successfully' });
    });
  });
});

// Delete intervention report
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const db = getDatabase();
  
  // Verify ownership or admin role
  const checkQuery = 'SELECT technicianId FROM intervention_reports WHERE id = ?';
  
  db.get(checkQuery, [id], (err, report) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!report) {
      return res.status(404).json({ error: 'Intervention report not found' });
    }
    
    // Only admin or report owner can delete
    if (userRole !== 'admin' && report.technicianId !== userId) {
      return res.status(403).json({ error: 'Insufficient privileges to delete this report' });
    }
    
    const deleteQuery = 'DELETE FROM intervention_reports WHERE id = ?';
    
    db.run(deleteQuery, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete intervention report' });
      }
      
      res.json({ message: 'Intervention report deleted successfully' });
    });
  });
});

module.exports = router;