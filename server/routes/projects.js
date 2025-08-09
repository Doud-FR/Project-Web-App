const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken, checkProjectAccess } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all user projects
router.get('/', (req, res) => {
  const userId = req.user.id;
  const db = getDatabase();
  
  const query = `
    SELECT DISTINCT p.*, u.username as createdByName,
           pm.role as memberRole
    FROM projects p
    LEFT JOIN users u ON p.createdBy = u.id
    LEFT JOIN project_members pm ON p.id = pm.projectId AND pm.userId = ?
    WHERE p.createdBy = ? OR pm.userId = ?
    ORDER BY p.updatedAt DESC
  `;
  
  db.all(query, [userId, userId, userId], (err, projects) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(projects);
  });
});

// Get specific project
router.get('/:id', checkProjectAccess, (req, res) => {
  const projectId = req.params.id;
  const db = getDatabase();
  
  const query = `
    SELECT p.*, u.username as createdByName,
           GROUP_CONCAT(
             DISTINCT u2.username || ':' || pm.role
           ) as members
    FROM projects p
    LEFT JOIN users u ON p.createdBy = u.id
    LEFT JOIN project_members pm ON p.id = pm.projectId
    LEFT JOIN users u2 ON pm.userId = u2.id
    WHERE p.id = ?
    GROUP BY p.id
  `;
  
  db.get(query, [projectId], (err, project) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Parse members string into array
    project.members = project.members ? 
      project.members.split(',').map(member => {
        const [username, role] = member.split(':');
        return { username, role };
      }) : [];
    
    res.json(project);
  });
});

// Create new project
router.post('/', (req, res) => {
  const { title, description, startDate, endDate, budget } = req.body;
  const userId = req.user.id;
  
  if (!title) {
    return res.status(400).json({ error: 'Project title is required' });
  }
  
  const db = getDatabase();
  const query = `
    INSERT INTO projects (title, description, startDate, endDate, budget, createdBy)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [title, description, startDate, endDate, budget, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create project' });
    }
    
    // Log activity
    const activityQuery = `
      INSERT INTO activity_log (projectId, userId, action, entityType, entityId)
      VALUES (?, ?, 'created', 'project', ?)
    `;
    
    db.run(activityQuery, [this.lastID, userId, this.lastID]);
    
    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: this.lastID,
        title,
        description,
        startDate,
        endDate,
        budget,
        createdBy: userId
      }
    });
  });
});

// Update project
router.put('/:id', checkProjectAccess, (req, res) => {
  const projectId = req.params.id;
  const { title, description, startDate, endDate, budget, status } = req.body;
  const userId = req.user.id;
  
  if (!req.projectAccess.isOwner && req.projectAccess.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const db = getDatabase();
  const query = `
    UPDATE projects
    SET title = ?, description = ?, startDate = ?, endDate = ?, budget = ?, status = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [title, description, startDate, endDate, budget, status, projectId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update project' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Log activity
    const activityQuery = `
      INSERT INTO activity_log (projectId, userId, action, entityType, entityId, changes)
      VALUES (?, ?, 'updated', 'project', ?, ?)
    `;
    
    const changes = JSON.stringify({ title, description, startDate, endDate, budget, status });
    db.run(activityQuery, [projectId, userId, projectId, changes]);
    
    res.json({ message: 'Project updated successfully' });
  });
});

// Delete project
router.delete('/:id', checkProjectAccess, (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  
  if (!req.projectAccess.isOwner) {
    return res.status(403).json({ error: 'Only project owner can delete the project' });
  }
  
  const db = getDatabase();
  const query = 'DELETE FROM projects WHERE id = ?';
  
  db.run(query, [projectId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete project' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  });
});

// Add member to project
router.post('/:id/members', checkProjectAccess, (req, res) => {
  const projectId = req.params.id;
  const { username, role = 'member', permissions = {} } = req.body;
  const userId = req.user.id;
  
  if (!req.projectAccess.isOwner) {
    return res.status(403).json({ error: 'Only project owner can add members' });
  }
  
  const db = getDatabase();
  
  // First, find the user by username
  const userQuery = 'SELECT id FROM users WHERE username = ?';
  
  db.get(userQuery, [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add user to project
    const memberQuery = `
      INSERT INTO project_members (projectId, userId, role, permissions)
      VALUES (?, ?, ?, ?)
    `;
    
    db.run(memberQuery, [projectId, user.id, role, JSON.stringify(permissions)], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'User is already a member of this project' });
        }
        return res.status(500).json({ error: 'Failed to add member' });
      }
      
      // Log activity
      const activityQuery = `
        INSERT INTO activity_log (projectId, userId, action, entityType, entityId, changes)
        VALUES (?, ?, 'added_member', 'project', ?, ?)
      `;
      
      const changes = JSON.stringify({ addedUser: username, role });
      db.run(activityQuery, [projectId, userId, projectId, changes]);
      
      res.status(201).json({ message: 'Member added successfully' });
    });
  });
});

// Get project activity
router.get('/:id/activity', checkProjectAccess, (req, res) => {
  const projectId = req.params.id;
  const db = getDatabase();
  
  const query = `
    SELECT al.*, u.username
    FROM activity_log al
    JOIN users u ON al.userId = u.id
    WHERE al.projectId = ?
    ORDER BY al.createdAt DESC
    LIMIT 100
  `;
  
  db.all(query, [projectId], (err, activities) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(activities);
  });
});

module.exports = router;