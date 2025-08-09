const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../database.sqlite');

let db;

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('📦 Connected to SQLite database');
      
      // Create tables
      const createTables = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          firstName VARCHAR(50),
          lastName VARCHAR(50),
          role VARCHAR(20) DEFAULT 'user',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Projects table
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          startDate DATE,
          endDate DATE,
          status VARCHAR(20) DEFAULT 'active',
          budget DECIMAL(10, 2),
          createdBy INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (createdBy) REFERENCES users(id)
        );
        
        -- Project members table (for collaboration)
        CREATE TABLE IF NOT EXISTS project_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          userId INTEGER NOT NULL,
          role VARCHAR(20) DEFAULT 'member',
          permissions TEXT,
          joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id),
          UNIQUE(projectId, userId)
        );
        
        -- Tasks table
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          startDate DATE,
          endDate DATE,
          duration INTEGER DEFAULT 1,
          progress INTEGER DEFAULT 0,
          priority VARCHAR(10) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'not_started',
          assignedTo INTEGER,
          parentTaskId INTEGER,
          predecessors TEXT,
          budget DECIMAL(10, 2),
          createdBy INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (assignedTo) REFERENCES users(id),
          FOREIGN KEY (parentTaskId) REFERENCES tasks(id),
          FOREIGN KEY (createdBy) REFERENCES users(id)
        );
        
        -- Task dependencies table
        CREATE TABLE IF NOT EXISTS task_dependencies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          taskId INTEGER NOT NULL,
          dependsOnTaskId INTEGER NOT NULL,
          dependencyType VARCHAR(20) DEFAULT 'finish_to_start',
          lag INTEGER DEFAULT 0,
          FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (dependsOnTaskId) REFERENCES tasks(id) ON DELETE CASCADE,
          UNIQUE(taskId, dependsOnTaskId)
        );
        
        -- Resources table
        CREATE TABLE IF NOT EXISTS resources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50),
          cost DECIMAL(10, 2),
          availability DECIMAL(5, 2) DEFAULT 100,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );
        
        -- Task resources table
        CREATE TABLE IF NOT EXISTS task_resources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          taskId INTEGER NOT NULL,
          resourceId INTEGER NOT NULL,
          allocation DECIMAL(5, 2) DEFAULT 100,
          FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (resourceId) REFERENCES resources(id) ON DELETE CASCADE,
          UNIQUE(taskId, resourceId)
        );
        
        -- Comments table (for collaboration)
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER,
          taskId INTEGER,
          userId INTEGER NOT NULL,
          content TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id)
        );
        
        -- Activity log table (for tracking changes)
        CREATE TABLE IF NOT EXISTS activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          userId INTEGER NOT NULL,
          action VARCHAR(50) NOT NULL,
          entityType VARCHAR(20) NOT NULL,
          entityId INTEGER,
          changes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id)
        );
      `;
      
      db.exec(createTables, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database tables created successfully');
          resolve();
        }
      });
    });
  });
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

module.exports = {
  initDatabase,
  getDatabase
};