# Project Web App

A collaborative project management web application with all the functionalities of Microsoft Project, enhanced with real-time collaboration features for multiple project managers.

## Features

### Core Project Management
- **Project Creation & Management**: Create, edit, and manage multiple projects
- **Task Management**: Create tasks, set dependencies, assign resources
- **Gantt Charts**: Visual project timeline with drag-and-drop functionality
- **Resource Allocation**: Assign team members and resources to tasks
- **Timeline Scheduling**: Automatic scheduling with constraint handling
- **Progress Tracking**: Monitor project and task completion
- **Critical Path Analysis**: Identify critical tasks affecting project timeline
- **Budget Management**: Track costs and budget allocation

### Collaboration Features
- **Real-time Collaboration**: Multiple project managers can work simultaneously
- **Shared Workspaces**: Team access to projects with role-based permissions
- **Live Updates**: Real-time synchronization of changes across all users
- **Communication Tools**: Comments, notifications, and activity feeds
- **Team Management**: User roles and permission management
- **Change Tracking**: Complete audit trail of project modifications

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite (easily upgradable to PostgreSQL/MySQL)
- **Real-time**: Socket.IO for live collaboration
- **Frontend**: Modern HTML5/CSS3/JavaScript with responsive design
- **Authentication**: JWT-based secure authentication

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Doud-FR/Project-Web-App.git
cd Project-Web-App

# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Create an account or log in
3. Create your first project
4. Add tasks, set dependencies, and assign resources
5. Invite team members to collaborate
6. Use the Gantt chart to visualize and manage your project timeline

## API Documentation

The application provides a RESTful API for all project management operations:

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id/tasks` - Get project tasks
- `POST /api/projects/:id/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue on GitHub or contact the development team.