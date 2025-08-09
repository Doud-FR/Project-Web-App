const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken, checkProjectAccess } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all tasks for a project
router.get('/project/:projectId', checkProjectAccess, (req, res) => {
  const projectId = req.params.projectId;
  const db = getDatabase();
  
  const query = `
    SELECT t.*, 
           u1.username as assignedToName,
           u2.username as createdByName,
           pt.title as parentTaskTitle
    FROM tasks t
    LEFT JOIN users u1 ON t.assignedTo = u1.id
    LEFT JOIN users u2 ON t.createdBy = u2.id
    LEFT JOIN tasks pt ON t.parentTaskId = pt.id
    WHERE t.projectId = ?
    ORDER BY t.createdAt ASC
  `;
  
  db.all(query, [projectId], (err, tasks) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Get dependencies for each task
    const dependencyQuery = `
      SELECT td.*, t.title as dependsOnTitle
      FROM task_dependencies td
      JOIN tasks t ON td.dependsOnTaskId = t.id
      WHERE td.taskId IN (${tasks.map(() => '?').join(',')})
    `;
    
    if (tasks.length === 0) {
      return res.json([]);
    }
    
    const taskIds = tasks.map(task => task.id);
    
    db.all(dependencyQuery, taskIds, (err, dependencies) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Group dependencies by task ID
      const dependenciesMap = {};
      dependencies.forEach(dep => {
        if (!dependenciesMap[dep.taskId]) {
          dependenciesMap[dep.taskId] = [];
        }
        dependenciesMap[dep.taskId].push(dep);
      });
      
      // Add dependencies to tasks
      const tasksWithDependencies = tasks.map(task => ({
        ...task,
        dependencies: dependenciesMap[task.id] || []
      }));
      
      res.json(tasksWithDependencies);
    });
  });
});

// Get specific task
router.get('/:id', (req, res) => {
  const taskId = req.params.id;
  const db = getDatabase();
  
  const query = `
    SELECT t.*, 
           u1.username as assignedToName,
           u2.username as createdByName,
           pt.title as parentTaskTitle,
           p.title as projectTitle
    FROM tasks t
    LEFT JOIN users u1 ON t.assignedTo = u1.id
    LEFT JOIN users u2 ON t.createdBy = u2.id
    LEFT JOIN tasks pt ON t.parentTaskId = pt.id
    LEFT JOIN projects p ON t.projectId = p.id
    WHERE t.id = ?
  `;
  
  db.get(query, [taskId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check project access
    req.params.projectId = task.projectId;
    checkProjectAccess(req, res, () => {
      // Get task dependencies
      const dependencyQuery = `
        SELECT td.*, t.title as dependsOnTitle
        FROM task_dependencies td
        JOIN tasks t ON td.dependsOnTaskId = t.id
        WHERE td.taskId = ?
      `;
      
      db.all(dependencyQuery, [taskId], (err, dependencies) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        task.dependencies = dependencies;
        res.json(task);
      });
    });
  });
});

// Create new task
router.post('/project/:projectId', checkProjectAccess, (req, res) => {
  const projectId = req.params.projectId;
  const {
    title, description, startDate, endDate, duration,
    priority, assignedTo, parentTaskId, budget
  } = req.body;
  const userId = req.user.id;
  
  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }
  
  const db = getDatabase();
  const query = `
    INSERT INTO tasks (
      projectId, title, description, startDate, endDate, duration,
      priority, assignedTo, parentTaskId, budget, createdBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [
    projectId, title, description, startDate, endDate, duration || 1,
    priority || 'medium', assignedTo, parentTaskId, budget, userId
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create task' });
    }
    
    // Log activity
    const activityQuery = `
      INSERT INTO activity_log (projectId, userId, action, entityType, entityId, changes)
      VALUES (?, ?, 'created', 'task', ?, ?)
    `;
    
    const changes = JSON.stringify({ title, assignedTo, priority });
    db.run(activityQuery, [projectId, userId, this.lastID, changes]);
    
    res.status(201).json({
      message: 'Task created successfully',
      task: {
        id: this.lastID,
        projectId,
        title,
        description,
        startDate,
        endDate,
        duration: duration || 1,
        priority: priority || 'medium',
        assignedTo,
        parentTaskId,
        budget,
        createdBy: userId
      }
    });
  });
});

// Update task
router.put('/:id', (req, res) => {
  const taskId = req.params.id;
  const {
    title, description, startDate, endDate, duration,
    progress, priority, status, assignedTo, parentTaskId, budget
  } = req.body;
  const userId = req.user.id;
  
  const db = getDatabase();
  
  // First get the task to check project access
  const getTaskQuery = 'SELECT projectId FROM tasks WHERE id = ?';
  
  db.get(getTaskQuery, [taskId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    req.params.projectId = task.projectId;
    
    checkProjectAccess(req, res, () => {
      const updateQuery = `
        UPDATE tasks
        SET title = ?, description = ?, startDate = ?, endDate = ?, duration = ?,
            progress = ?, priority = ?, status = ?, assignedTo = ?, parentTaskId = ?,
            budget = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(updateQuery, [
        title, description, startDate, endDate, duration,
        progress, priority, status, assignedTo, parentTaskId, budget, taskId
      ], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update task' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }
        
        // Log activity
        const activityQuery = `
          INSERT INTO activity_log (projectId, userId, action, entityType, entityId, changes)
          VALUES (?, ?, 'updated', 'task', ?, ?)
        `;
        
        const changes = JSON.stringify({ title, progress, status, assignedTo });
        db.run(activityQuery, [task.projectId, userId, taskId, changes]);
        
        res.json({ message: 'Task updated successfully' });
      });
    });
  });
});

// Delete task
router.delete('/:id', (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  const db = getDatabase();
  
  // First get the task to check project access
  const getTaskQuery = 'SELECT projectId FROM tasks WHERE id = ?';
  
  db.get(getTaskQuery, [taskId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    req.params.projectId = task.projectId;
    
    checkProjectAccess(req, res, () => {
      const deleteQuery = 'DELETE FROM tasks WHERE id = ?';
      
      db.run(deleteQuery, [taskId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete task' });
        }
        
        // Log activity
        const activityQuery = `
          INSERT INTO activity_log (projectId, userId, action, entityType, entityId)
          VALUES (?, ?, 'deleted', 'task', ?)
        `;
        
        db.run(activityQuery, [task.projectId, userId, taskId]);
        
        res.json({ message: 'Task deleted successfully' });
      });
    });
  });
});

// Add task dependency
router.post('/:id/dependencies', (req, res) => {
  const taskId = req.params.id;
  const { dependsOnTaskId, dependencyType = 'finish_to_start', lag = 0 } = req.body;
  const userId = req.user.id;
  
  const db = getDatabase();
  
  // First check if both tasks exist and belong to the same project
  const checkQuery = `
    SELECT t1.projectId as task1Project, t2.projectId as task2Project
    FROM tasks t1, tasks t2
    WHERE t1.id = ? AND t2.id = ?
  `;
  
  db.get(checkQuery, [taskId, dependsOnTaskId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'One or both tasks not found' });
    }
    
    if (result.task1Project !== result.task2Project) {
      return res.status(400).json({ error: 'Tasks must belong to the same project' });
    }
    
    req.params.projectId = result.task1Project;
    
    checkProjectAccess(req, res, () => {
      const insertQuery = `
        INSERT INTO task_dependencies (taskId, dependsOnTaskId, dependencyType, lag)
        VALUES (?, ?, ?, ?)
      `;
      
      db.run(insertQuery, [taskId, dependsOnTaskId, dependencyType, lag], function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Dependency already exists' });
          }
          return res.status(500).json({ error: 'Failed to create dependency' });
        }
        
        // Log activity
        const activityQuery = `
          INSERT INTO activity_log (projectId, userId, action, entityType, entityId, changes)
          VALUES (?, ?, 'added_dependency', 'task', ?, ?)
        `;
        
        const changes = JSON.stringify({ dependsOnTaskId, dependencyType });
        db.run(activityQuery, [result.task1Project, userId, taskId, changes]);
        
        res.status(201).json({ message: 'Dependency created successfully' });
      });
    });
  });
});

module.exports = router;