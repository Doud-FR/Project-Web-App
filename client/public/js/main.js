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
    
    // Bind event listeners after DOM loads
    bindEventListeners();
});

function bindEventListeners() {
    // Navigation click handlers
    document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });
    
    document.getElementById('nav-projects')?.addEventListener('click', (e) => {
        e.preventDefault();
        showProjects();
    });
    
    document.getElementById('nav-tasks')?.addEventListener('click', (e) => {
        e.preventDefault();
        showTasks();
    });
    
    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    // Auth links
    document.getElementById('show-register-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });
    
    document.getElementById('show-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    
    // Project creation buttons
    document.getElementById('new-project-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showCreateProject();
    });
    
    document.getElementById('new-project-btn-2')?.addEventListener('click', (e) => {
        e.preventDefault();
        showCreateProject();
    });
    
    // Modal close handlers
    document.getElementById('modal-overlay')?.addEventListener('click', closeModal);
    
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', closeModal);
    });
    
    document.querySelectorAll('.cancel-btn').forEach(button => {
        button.addEventListener('click', closeModal);
    });
}

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
    
    // Re-bind event listeners after showing main content
    bindEventListeners();
}

function updateUserDisplay() {
    const userName = document.getElementById('user-name');
    if (currentUser) {
        const displayName = currentUser.firstName ? 
            `${currentUser.firstName} ${currentUser.lastName}` : 
            currentUser.username;
        
        // Add role display based on user role
        let roleDisplay = '';
        switch(currentUser.role) {
            case 'admin':
                roleDisplay = 'System Administrator';
                break;
            case 'chef_projet':
                roleDisplay = 'Chef de Projet';
                break;
            case 'technicien':
                roleDisplay = 'Technicien';
                break;
            case 'support':
                roleDisplay = 'Support';
                break;
            default:
                roleDisplay = 'User';
        }
        
        userName.textContent = `${displayName} (${roleDisplay})`;
        
        // Update navigation based on role
        updateNavigationForRole(currentUser.role);
    }
}

function updateNavigationForRole(role) {
    const navbar = document.querySelector('.navbar-menu');
    
    // Remove existing role-specific menu items
    const existingAdminLinks = navbar.querySelectorAll('.admin-only, .chef-only, .tech-only');
    existingAdminLinks.forEach(link => link.remove());
    
    // Add role-specific navigation items
    const dashboardLink = document.getElementById('nav-dashboard');
    
    if (['admin', 'chef_projet'].includes(role)) {
        // Add admin/management links
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.className = 'admin-only';
        adminLink.innerHTML = '<i class="fas fa-users-cog"></i> User Management';
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            showUserManagement();
        });
        
        const clientsLink = document.createElement('a');
        clientsLink.href = '#';
        clientsLink.className = 'admin-only';
        clientsLink.innerHTML = '<i class="fas fa-building"></i> Clients';
        clientsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showClientsManagement();
        });
        
        // Insert after dashboard
        dashboardLink.parentNode.insertBefore(adminLink, dashboardLink.nextSibling);
        dashboardLink.parentNode.insertBefore(clientsLink, adminLink.nextSibling);
    }
    
    if (role === 'technicien') {
        // Add technician-specific links
        const reportsLink = document.createElement('a');
        reportsLink.href = '#';
        reportsLink.className = 'tech-only';
        reportsLink.innerHTML = '<i class="fas fa-clipboard-list"></i> My Reports';
        reportsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showInterventionReports();
        });
        
        // Insert after tasks
        const tasksLink = document.getElementById('nav-tasks');
        if (tasksLink) {
            tasksLink.parentNode.insertBefore(reportsLink, tasksLink.nextSibling);
        }
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
                <button class="btn btn-primary" id="create-first-project-btn" style="margin-top: 1rem;">
                    <i class="fas fa-plus"></i> Create First Project
                </button>
            </div>
        `;
        
        // Bind the create first project button
        document.getElementById('create-first-project-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            showCreateProject();
        });
        
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
    document.getElementById('project-detail-title').textContent = project.title;
    
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
    
    // Clear the form fields in the modal
    const modal = document.getElementById('create-project-modal');
    modal.querySelector('#project-title').value = '';
    modal.querySelector('#project-description').value = '';
    modal.querySelector('#project-start-date').value = '';
    modal.querySelector('#project-end-date').value = '';
    modal.querySelector('#project-budget').value = '';
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
    
    const modal = document.getElementById('create-project-modal');
    const title = modal.querySelector('#project-title').value;
    const description = modal.querySelector('#project-description').value;
    const startDate = modal.querySelector('#project-start-date').value;
    const endDate = modal.querySelector('#project-end-date').value;
    const budget = modal.querySelector('#project-budget').value;
    
    console.log('Creating project:', { title, description, startDate, endDate, budget });
    
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
                budget: budget ? parseFloat(budget) : null
            })
        });
        
        const data = await response.json();
        console.log('Project creation response:', data);
        
        if (response.ok) {
            closeModal();
            showToast('Project created successfully!', 'success');
            // Refresh the current view
            if (document.getElementById('projects-view').classList.contains('hidden')) {
                loadDashboard();
            } else {
                loadProjects();
            }
        } else {
            showToast(data.error || 'Failed to create project', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
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

// Role-based View Functions

function showUserManagement() {
    hideAllSections();
    document.getElementById('user-management').classList.remove('hidden');
    loadUsers();
}

function showClientsManagement() {
    hideAllSections();
    document.getElementById('clients-management').classList.remove('hidden');
    loadClients();
}

function showInterventionReports() {
    hideAllSections();
    document.getElementById('intervention-reports').classList.remove('hidden');
    loadInterventionReports();
}

// User Management Functions
async function loadUsers() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            renderUsers(users);
        } else {
            showToast('Failed to load users', 'error');
        }
    } catch (error) {
        showToast('Network error while loading users', 'error');
    } finally {
        showLoading(false);
    }
}

function renderUsers(users) {
    const container = document.getElementById('users-container');
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<p class="no-data">No users found</p>';
        return;
    }
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-header">
                <h3>${user.firstName} ${user.lastName} (${user.username})</h3>
                <span class="user-role ${user.role}">${getRoleDisplayName(user.role)}</span>
            </div>
            <div class="user-info">
                <p><i class="fas fa-envelope"></i> ${user.email}</p>
                <p><i class="fas fa-calendar"></i> Created: ${new Date(user.createdAt).toLocaleDateString()}</p>
                ${user.createdByUsername ? `<p><i class="fas fa-user"></i> Created by: ${user.createdByUsername}</p>` : ''}
            </div>
            <div class="user-actions">
                <button class="btn btn-sm btn-secondary" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${user.id !== currentUser.id ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(userCard);
    });
}

function getRoleDisplayName(role) {
    const roleNames = {
        'admin': 'Administrator',
        'chef_projet': 'Chef de Projet',
        'technicien': 'Technicien',
        'support': 'Support'
    };
    return roleNames[role] || role;
}

function showCreateUser() {
    document.getElementById('create-user-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
}

async function createUser(event) {
    event.preventDefault();
    
    const username = document.getElementById('user-username').value;
    const email = document.getElementById('user-email').value;
    const firstName = document.getElementById('user-firstName').value;
    const lastName = document.getElementById('user-lastName').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, email, firstName, lastName, password, role })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal();
            loadUsers();
            showToast('User created successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to create user', 'error');
        }
    } catch (error) {
        showToast('Network error while creating user', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loadUsers();
            showToast('User deleted successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        showToast('Network error while deleting user', 'error');
    } finally {
        showLoading(false);
    }
}

// Client Management Functions
async function loadClients() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/clients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const clients = await response.json();
            renderClients(clients);
        } else {
            showToast('Failed to load clients', 'error');
        }
    } catch (error) {
        showToast('Network error while loading clients', 'error');
    } finally {
        showLoading(false);
    }
}

function renderClients(clients) {
    const container = document.getElementById('clients-container');
    container.innerHTML = '';
    
    if (clients.length === 0) {
        container.innerHTML = '<p class="no-data">No clients found</p>';
        return;
    }
    
    clients.forEach(client => {
        const clientCard = document.createElement('div');
        clientCard.className = 'client-card';
        clientCard.innerHTML = `
            <div class="client-header">
                <h3>${client.name}</h3>
            </div>
            <div class="client-info">
                ${client.address ? `<p><i class="fas fa-map-marker-alt"></i> ${client.address}</p>` : ''}
                ${client.email ? `<p><i class="fas fa-envelope"></i> ${client.email}</p>` : ''}
                ${client.phone ? `<p><i class="fas fa-phone"></i> ${client.phone}</p>` : ''}
                ${client.siteManager ? `<p><i class="fas fa-user-tie"></i> Site Manager: ${client.siteManager}</p>` : ''}
                ${client.projectManager ? `<p><i class="fas fa-user-cog"></i> Project Manager: ${client.projectManager}</p>` : ''}
                <p><i class="fas fa-calendar"></i> Created: ${new Date(client.createdAt).toLocaleDateString()}</p>
            </div>
            <div class="client-actions">
                <button class="btn btn-sm btn-primary" onclick="viewClientProjects(${client.id})">
                    <i class="fas fa-project-diagram"></i> View Projects
                </button>
                <button class="btn btn-sm btn-secondary" onclick="editClient(${client.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteClient(${client.id}, '${client.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        container.appendChild(clientCard);
    });
}

function showCreateClient() {
    document.getElementById('create-client-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
}

async function createClient(event) {
    event.preventDefault();
    
    const name = document.getElementById('client-name').value;
    const address = document.getElementById('client-address').value;
    const siteManager = document.getElementById('client-siteManager').value;
    const projectManager = document.getElementById('client-projectManager').value;
    const email = document.getElementById('client-email').value;
    const phone = document.getElementById('client-phone').value;
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/clients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, address, siteManager, projectManager, email, phone })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal();
            loadClients();
            showToast('Client created successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to create client', 'error');
        }
    } catch (error) {
        showToast('Network error while creating client', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteClient(clientId, clientName) {
    if (!confirm(`Are you sure you want to delete client "${clientName}"?`)) {
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/clients/${clientId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loadClients();
            showToast('Client deleted successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to delete client', 'error');
        }
    } catch (error) {
        showToast('Network error while deleting client', 'error');
    } finally {
        showLoading(false);
    }
}

// Intervention Reports Functions
async function loadInterventionReports() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/intervention-reports/my-reports`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const reports = await response.json();
            renderInterventionReports(reports);
        } else {
            showToast('Failed to load reports', 'error');
        }
    } catch (error) {
        showToast('Network error while loading reports', 'error');
    } finally {
        showLoading(false);
    }
}

function renderInterventionReports(reports) {
    const container = document.getElementById('reports-container');
    container.innerHTML = '';
    
    if (reports.length === 0) {
        container.innerHTML = '<p class="no-data">No intervention reports found</p>';
        return;
    }
    
    reports.forEach(report => {
        const reportCard = document.createElement('div');
        reportCard.className = 'report-card';
        reportCard.innerHTML = `
            <div class="report-header">
                <h3>${report.title}</h3>
                <span class="report-status ${report.status}">${report.status}</span>
            </div>
            <div class="report-info">
                <p><i class="fas fa-tasks"></i> Task: ${report.taskTitle}</p>
                <p><i class="fas fa-project-diagram"></i> Project: ${report.projectTitle}</p>
                <p><i class="fas fa-clock"></i> Time Spent: ${report.timeSpent} hours</p>
                <p><i class="fas fa-calendar"></i> Created: ${new Date(report.createdAt).toLocaleDateString()}</p>
                ${report.description ? `<p><i class="fas fa-info-circle"></i> ${report.description}</p>` : ''}
            </div>
            <div class="report-actions">
                <button class="btn btn-sm btn-primary" onclick="viewReport(${report.id})">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn btn-sm btn-secondary" onclick="editReport(${report.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteReport(${report.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        container.appendChild(reportCard);
    });
}

// Add event listeners for new buttons
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for new user and client buttons
    document.getElementById('new-user-btn')?.addEventListener('click', showCreateUser);
    document.getElementById('new-client-btn')?.addEventListener('click', showCreateClient);
});