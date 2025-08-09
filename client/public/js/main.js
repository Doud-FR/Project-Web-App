// Global variables
let currentUser = null;
let currentProject = null;
let socket = null;
let projects = [];
let tasks = [];

// API Base URL
const API_BASE = '/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        validateToken(token);
    } else {
        showLogin();
    }
});

// Authentication functions
async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            initializeApp();
            showToast('Login successful!', 'success');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function register(event) {
    event.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const firstName = document.getElementById('reg-firstName').value;
    const lastName = document.getElementById('reg-lastName').value;
    const password = document.getElementById('reg-password').value;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, firstName, lastName, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            initializeApp();
            showToast('Account created successfully!', 'success');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function validateToken(token) {
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            initializeApp();
        } else {
            localStorage.removeItem('authToken');
            showLogin();
        }
    } catch (error) {
        localStorage.removeItem('authToken');
        showLogin();
    }
}

function logout() {
    localStorage.removeItem('authToken');
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    location.reload();
}

// Initialize authenticated app
function initializeApp() {
    initializeSocket();
    showMainContent();
    updateUserDisplay();
    loadDashboard();
}

function initializeSocket() {
    const token = localStorage.getItem('authToken');
    socket = io({
        auth: {
            token: token
        }
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('project-updated', (data) => {
        handleProjectUpdate(data);
    });
    
    socket.on('task-updated', (data) => {
        handleTaskUpdate(data);
    });
    
    socket.on('cursor-moved', (data) => {
        // Handle real-time cursor movement for collaboration
        console.log('Cursor moved:', data);
    });
}

// UI Navigation functions
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('navbar').classList.add('hidden');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('navbar').classList.add('hidden');
}

function showMainContent() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('navbar').classList.remove('hidden');
}

function updateUserDisplay() {
    const userName = document.getElementById('user-name');
    if (currentUser) {
        userName.textContent = currentUser.firstName ? 
            `${currentUser.firstName} ${currentUser.lastName}` : 
            currentUser.username;
    }
}

function showDashboard() {
    hideAllSections();
    document.getElementById('dashboard').classList.remove('hidden');
    loadDashboard();
}

function showProjects() {
    hideAllSections();
    document.getElementById('projects-view').classList.remove('hidden');
    loadProjects();
}

function showTasks() {
    hideAllSections();
    document.getElementById('tasks-view').classList.remove('hidden');
    loadUserTasks();
}

function showProjectDetail(projectId) {
    hideAllSections();
    document.getElementById('project-detail').classList.remove('hidden');
    currentProject = projects.find(p => p.id === projectId);
    loadProjectDetail(projectId);
}

function hideAllSections() {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.add('hidden'));
}

// Dashboard functions
async function loadDashboard() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        // Load projects
        const projectsResponse = await fetch(`${API_BASE}/projects`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (projectsResponse.ok) {
            projects = await projectsResponse.json();
            updateDashboardStats();
            renderRecentProjects();
        }
        
        // Load user tasks
        const tasksResponse = await fetch(`${API_BASE}/users/me/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (tasksResponse.ok) {
            const userTasks = await tasksResponse.json();
            renderDashboardTasks(userTasks);
        }
        
    } catch (error) {
        showToast('Failed to load dashboard', 'error');
    } finally {
        showLoading(false);
    }
}

function updateDashboardStats() {
    document.getElementById('total-projects').textContent = projects.length;
    
    const activeTasks = tasks.filter(task => task.status !== 'completed').length;
    document.getElementById('total-tasks').textContent = activeTasks;
    
    // Calculate unique collaborators across all projects
    const collaborators = new Set();
    projects.forEach(project => {
        if (project.members) {
            project.members.forEach(member => collaborators.add(member.username));
        }
    });
    document.getElementById('total-collaborators').textContent = collaborators.size;
    
    // Calculate overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(task => {
        return task.endDate && new Date(task.endDate) < now && task.status !== 'completed';
    }).length;
    document.getElementById('overdue-tasks').textContent = overdueTasks;
}

function renderRecentProjects() {
    const container = document.getElementById('recent-projects');
    container.innerHTML = '';
    
    const recentProjects = projects.slice(0, 5);
    
    if (recentProjects.length === 0) {
        container.innerHTML = '<p class="text-muted">No projects yet. Create your first project!</p>';
        return;
    }
    
    recentProjects.forEach(project => {
        const projectCard = createProjectCard(project, true);
        container.appendChild(projectCard);
    });
}

function renderDashboardTasks(userTasks) {
    const container = document.getElementById('my-tasks');
    container.innerHTML = '';
    
    if (userTasks.length === 0) {
        container.innerHTML = '<p class="text-muted">No tasks assigned to you.</p>';
        return;
    }
    
    userTasks.slice(0, 5).forEach(task => {
        const taskCard = createTaskCard(task, true);
        container.appendChild(taskCard);
    });
}

// Project functions
async function loadProjects() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE}/projects`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            projects = await response.json();
            renderProjects();
        } else {
            showToast('Failed to load projects', 'error');
        }
    } catch (error) {
        showToast('Network error while loading projects', 'error');
    } finally {
        showLoading(false);
    }
}

function renderProjects() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <i class="fas fa-project-diagram" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                <h3>No Projects Yet</h3>
                <p>Create your first project to get started with collaborative project management!</p>
                <button class="btn btn-primary" onclick="showCreateProject()" style="margin-top: 1rem;">
                    <i class="fas fa-plus"></i> Create First Project
                </button>
            </div>
        `;
        return;
    }
    
    projects.forEach(project => {
        const projectCard = createProjectCard(project);
        container.appendChild(projectCard);
    });
}

function createProjectCard(project, compact = false) {
    const card = document.createElement('div');
    card.className = compact ? 'project-card-compact' : 'project-card';
    card.onclick = () => showProjectDetail(project.id);
    
    const statusClass = `status-${project.status || 'active'}`;
    
    card.innerHTML = `
        <div class="project-card-header">
            <h3>${project.title}</h3>
            <small>${formatDate(project.createdAt)}</small>
        </div>
        <div class="project-card-body">
            <p>${project.description || 'No description'}</p>
            <div class="project-meta">
                <span class="project-status ${statusClass}">
                    ${project.status || 'Active'}
                </span>
                <small>${project.createdByName}</small>
            </div>
        </div>
    `;
    
    return card;
}

async function loadProjectDetail(projectId) {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        // Load project details
        const projectResponse = await fetch(`${API_BASE}/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (projectResponse.ok) {
            const project = await projectResponse.json();
            renderProjectDetail(project);
            
            // Join project room for real-time updates
            if (socket) {
                socket.emit('join-project', projectId);
            }
        }
        
        // Load project tasks
        const tasksResponse = await fetch(`${API_BASE}/tasks/project/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (tasksResponse.ok) {
            tasks = await tasksResponse.json();
            renderTasks();
        }
        
    } catch (error) {
        showToast('Failed to load project details', 'error');
    } finally {
        showLoading(false);
    }
}

function renderProjectDetail(project) {
    document.getElementById('project-title').textContent = project.title;
    
    const projectDetails = document.getElementById('project-details');
    projectDetails.innerHTML = `
        <div class="project-info-card">
            <h4>Project Information</h4>
            <p><strong>Description:</strong> ${project.description || 'No description'}</p>
            <p><strong>Start Date:</strong> ${formatDate(project.startDate) || 'Not set'}</p>
            <p><strong>End Date:</strong> ${formatDate(project.endDate) || 'Not set'}</p>
            <p><strong>Budget:</strong> ${project.budget ? '$' + project.budget : 'Not set'}</p>
            <p><strong>Status:</strong> <span class="project-status status-${project.status || 'active'}">${project.status || 'Active'}</span></p>
        </div>
    `;
    
    const projectMembers = document.getElementById('project-members');
    projectMembers.innerHTML = `
        <div class="project-info-card">
            <h4>Team Members</h4>
            ${project.members && project.members.length > 0 ? 
                project.members.map(member => `
                    <div class="member-item">
                        <span>${member.username}</span>
                        <span class="member-role">${member.role}</span>
                    </div>
                `).join('') : 
                '<p>No team members yet.</p>'
            }
            <button class="btn btn-primary btn-sm" onclick="showAddMember()">
                <i class="fas fa-user-plus"></i> Add Member
            </button>
        </div>
    `;
}

// Task functions
function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <i class="fas fa-tasks" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                <h3>No Tasks Yet</h3>
                <p>Add your first task to start managing your project!</p>
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const taskCard = createTaskCard(task);
        container.appendChild(taskCard);
    });
}

function createTaskCard(task, compact = false) {
    const card = document.createElement('div');
    card.className = compact ? 'task-item-compact' : 'task-item';
    
    const priorityClass = `priority-${task.priority || 'medium'}`;
    
    card.innerHTML = `
        <div class="task-header">
            <span class="task-title">${task.title}</span>
            <span class="task-priority ${priorityClass}">
                ${task.priority || 'Medium'}
            </span>
        </div>
        <div class="task-description">
            ${task.description || 'No description'}
        </div>
        <div class="task-meta">
            <span><i class="fas fa-user"></i> ${task.assignedToName || 'Unassigned'}</span>
            <span><i class="fas fa-calendar"></i> ${formatDate(task.endDate) || 'No due date'}</span>
            <span><i class="fas fa-percent"></i> ${task.progress || 0}% complete</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${task.progress || 0}%"></div>
        </div>
    `;
    
    return card;
}

function showTaskList() {
    document.getElementById('task-list-view').classList.remove('hidden');
    document.getElementById('gantt-chart-view').classList.add('hidden');
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function showGanttChart() {
    document.getElementById('task-list-view').classList.add('hidden');
    document.getElementById('gantt-chart-view').classList.remove('hidden');
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    renderGanttChart();
}

function renderGanttChart() {
    const container = document.getElementById('gantt-chart');
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = '<p>No tasks to display in Gantt chart</p>';
        return;
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'gantt-header';
    header.innerHTML = `
        <div class="gantt-task-column">Task</div>
        <div class="gantt-timeline">Timeline</div>
    `;
    container.appendChild(header);
    
    // Find date range
    const dates = tasks.filter(task => task.startDate && task.endDate)
                      .map(task => [new Date(task.startDate), new Date(task.endDate)])
                      .flat();
    
    if (dates.length === 0) {
        container.innerHTML += '<p>No tasks with dates to display</p>';
        return;
    }
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24) + 1;
    
    // Render tasks
    tasks.forEach(task => {
        if (task.startDate && task.endDate) {
            const row = document.createElement('div');
            row.className = 'gantt-row';
            
            const startDate = new Date(task.startDate);
            const endDate = new Date(task.endDate);
            const taskDays = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;
            const startOffset = (startDate - minDate) / (1000 * 60 * 60 * 24);
            
            const leftPercent = (startOffset / totalDays) * 100;
            const widthPercent = (taskDays / totalDays) * 100;
            
            row.innerHTML = `
                <div class="gantt-task-name">${task.title}</div>
                <div class="gantt-bar-container">
                    <div class="gantt-bar" style="left: ${leftPercent}%; width: ${widthPercent}%;">
                        ${task.progress || 0}%
                    </div>
                </div>
            `;
            
            container.appendChild(row);
        }
    });
}

async function loadUserTasks() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE}/users/me/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const userTasks = await response.json();
            renderUserTasks(userTasks);
        } else {
            showToast('Failed to load tasks', 'error');
        }
    } catch (error) {
        showToast('Network error while loading tasks', 'error');
    } finally {
        showLoading(false);
    }
}

function renderUserTasks(userTasks) {
    const container = document.getElementById('user-tasks-container');
    container.innerHTML = '';
    
    if (userTasks.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <i class="fas fa-tasks" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                <h3>No Tasks Assigned</h3>
                <p>You don't have any tasks assigned to you yet.</p>
            </div>
        `;
        return;
    }
    
    userTasks.forEach(task => {
        const taskCard = createTaskCard(task);
        // Add project name to user tasks
        const projectInfo = document.createElement('div');
        projectInfo.innerHTML = `<small><i class="fas fa-project-diagram"></i> ${task.projectTitle}</small>`;
        taskCard.appendChild(projectInfo);
        
        container.appendChild(taskCard);
    });
}

// Modal functions
function showCreateProject() {
    showModal('create-project-modal');
    document.getElementById('project-title').value = '';
    document.getElementById('project-description').value = '';
    document.getElementById('project-start-date').value = '';
    document.getElementById('project-end-date').value = '';
    document.getElementById('project-budget').value = '';
}

function showCreateTask() {
    if (!currentProject) {
        showToast('Please select a project first', 'error');
        return;
    }
    showModal('create-task-modal');
    document.getElementById('task-title').value = '';
    document.getElementById('task-description').value = '';
    document.getElementById('task-start-date').value = '';
    document.getElementById('task-end-date').value = '';
    document.getElementById('task-duration').value = '1';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-budget').value = '';
}

function showModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

async function createProject(event) {
    event.preventDefault();
    
    const title = document.getElementById('project-title').value;
    const description = document.getElementById('project-description').value;
    const startDate = document.getElementById('project-start-date').value;
    const endDate = document.getElementById('project-end-date').value;
    const budget = document.getElementById('project-budget').value;
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                startDate: startDate || null,
                endDate: endDate || null,
                budget: budget || null
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal();
            showToast('Project created successfully!', 'success');
            loadProjects();
        } else {
            showToast(data.error || 'Failed to create project', 'error');
        }
    } catch (error) {
        showToast('Network error while creating project', 'error');
    } finally {
        showLoading(false);
    }
}

async function createTask(event) {
    event.preventDefault();
    
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const startDate = document.getElementById('task-start-date').value;
    const endDate = document.getElementById('task-end-date').value;
    const duration = document.getElementById('task-duration').value;
    const priority = document.getElementById('task-priority').value;
    const budget = document.getElementById('task-budget').value;
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE}/tasks/project/${currentProject.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                startDate: startDate || null,
                endDate: endDate || null,
                duration: parseInt(duration),
                priority,
                budget: budget || null
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal();
            showToast('Task created successfully!', 'success');
            loadProjectDetail(currentProject.id);
            
            // Emit real-time update
            if (socket) {
                socket.emit('task-update', {
                    projectId: currentProject.id,
                    action: 'created',
                    task: data.task
                });
            }
        } else {
            showToast(data.error || 'Failed to create task', 'error');
        }
    } catch (error) {
        showToast('Network error while creating task', 'error');
    } finally {
        showLoading(false);
    }
}

// Real-time collaboration handlers
function handleProjectUpdate(data) {
    showToast(`Project updated by ${data.username}`, 'info');
    if (currentProject && currentProject.id === data.projectId) {
        loadProjectDetail(data.projectId);
    }
}

function handleTaskUpdate(data) {
    showToast(`Task updated by ${data.username}`, 'info');
    if (currentProject && currentProject.id === data.projectId) {
        loadProjectDetail(data.projectId);
    }
}

// Utility functions
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div>
            <strong>${type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Info'}</strong>
            <div>${message}</div>
        </div>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Toggle functions for UI
function toggleGanttView() {
    const button = event.target;
    if (document.getElementById('gantt-chart-view').classList.contains('hidden')) {
        showGanttChart();
        button.innerHTML = '<i class="fas fa-list"></i> List View';
    } else {
        showTaskList();
        button.innerHTML = '<i class="fas fa-chart-gantt"></i> Gantt View';
    }
}