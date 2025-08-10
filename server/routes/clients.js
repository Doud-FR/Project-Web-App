const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all clients (all roles can read)
router.get('/', (req, res) => {
  const db = getDatabase();
  const query = `
    SELECT c.*, u.username as createdByUsername
    FROM clients c
    LEFT JOIN users u ON c.createdBy = u.id
    ORDER BY c.name ASC
  `;
  
  db.all(query, (err, clients) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(clients);
  });
});

// Get single client
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const query = `
    SELECT c.*, u.username as createdByUsername
    FROM clients c
    LEFT JOIN users u ON c.createdBy = u.id
    WHERE c.id = ?
  `;
  
  db.get(query, [id], (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json(client);
  });
});

// Get client projects
router.get('/:id/projects', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const query = `
    SELECT p.*, u.username as createdByUsername
    FROM projects p
    LEFT JOIN users u ON p.createdBy = u.id
    WHERE p.clientId = ?
    ORDER BY p.createdAt DESC
  `;
  
  db.all(query, [id], (err, projects) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(projects);
  });
});

// Create new client (admin, chef_projet only)
router.post('/', requireRole(['admin', 'chef_projet']), (req, res) => {
  const { name, address, siteManager, projectManager, email, phone } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Client name is required' });
  }
  
  const db = getDatabase();
  const query = `
    INSERT INTO clients (name, address, siteManager, projectManager, email, phone, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [
    name, 
    address || '', 
    siteManager || '', 
    projectManager || '', 
    email || '', 
    phone || '', 
    req.user.id
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create client' });
    }
    
    res.status(201).json({
      message: 'Client created successfully',
      client: {
        id: this.lastID,
        name,
        address,
        siteManager,
        projectManager,
        email,
        phone
      }
    });
  });
});

// Update client (admin, chef_projet only)
router.put('/:id', requireRole(['admin', 'chef_projet']), (req, res) => {
  const { id } = req.params;
  const { name, address, siteManager, projectManager, email, phone } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Client name is required' });
  }
  
  const db = getDatabase();
  const query = `
    UPDATE clients 
    SET name = ?, address = ?, siteManager = ?, projectManager = ?, 
        email = ?, phone = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [
    name, 
    address || '', 
    siteManager || '', 
    projectManager || '', 
    email || '', 
    phone || '', 
    id
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update client' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json({ message: 'Client updated successfully' });
  });
});

// Delete client (admin only)
router.delete('/:id', requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  // Check if client has projects
  const checkQuery = 'SELECT COUNT(*) as count FROM projects WHERE clientId = ?';
  
  db.get(checkQuery, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete client with existing projects. Please reassign or delete projects first.' 
      });
    }
    
    const deleteQuery = 'DELETE FROM clients WHERE id = ?';
    
    db.run(deleteQuery, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete client' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json({ message: 'Client deleted successfully' });
    });
  });
});

module.exports = router;