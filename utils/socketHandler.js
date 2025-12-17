import Session from '../models/Session.js';
import Project from '../models/Project.js';

const connectedUsers = new Map(); // socketId -> { userId, projectId, username, color }
const projectRooms = new Map(); // projectId -> Set of socketIds
const projectStates = new Map(); // projectId -> { canvasData, layers, version }

// Generate random color for user cursor
const generateUserColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B500', '#FF85A2', '#7FDBFF', '#2ECC40'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a project room
    socket.on('join-project', async ({ projectId, userId, username }) => {
      try {
        socket.join(projectId);

        const userColor = generateUserColor();
        connectedUsers.set(socket.id, { userId, projectId, username, color: userColor });

        if (!projectRooms.has(projectId)) {
          projectRooms.set(projectId, new Set());

          // Load project state when first user joins
          const project = await Project.findById(projectId);
          if (project && project.versions && project.versions.length > 0) {
            const lastVersion = project.versions[project.versions.length - 1];
            projectStates.set(projectId, {
              canvasData: lastVersion.canvasData,
              layers: project.layers,
              version: project.currentVersion
            });
          }
        }
        projectRooms.get(projectId).add(socket.id);

        // Update or create session
        let session = await Session.findOne({ project: projectId, isActive: true });

        if (!session) {
          session = await Session.create({
            project: projectId,
            activeUsers: [{
              user: userId,
              socketId: socket.id,
              color: userColor,
              joinedAt: new Date(),
              lastActivity: new Date()
            }]
          });
        } else {
          const existingUser = session.activeUsers.find(u => u.socketId === socket.id);
          if (!existingUser) {
            session.activeUsers.push({
              user: userId,
              socketId: socket.id,
              color: userColor,
              joinedAt: new Date(),
              lastActivity: new Date()
            });
            await session.save();
          }
        }

        // Get all active users in this project
        const activeUsers = Array.from(projectRooms.get(projectId) || [])
          .map(sid => connectedUsers.get(sid))
          .filter(Boolean);

        // Send current project state to the joining user
        const currentState = projectStates.get(projectId);
        if (currentState) {
          socket.emit('sync-state', currentState);
        }

        // Notify all users in the room
        io.to(projectId).emit('user-joined', {
          socketId: socket.id,
          userId,
          username,
          color: userColor,
          activeUsers
        });

        console.log(`User ${username} joined project ${projectId}`);
      } catch (error) {
        console.error('Error joining project:', error);
      }
    });

    // Handle drawing events
    socket.on('draw', ({ projectId, drawData }) => {
      socket.to(projectId).emit('draw', {
        socketId: socket.id,
        drawData
      });
    });

    // Handle canvas state updates (for synchronization)
    socket.on('canvas-update', async ({ projectId, canvasData, layers }) => {
      // Update the project state
      if (projectStates.has(projectId)) {
        const state = projectStates.get(projectId);
        state.canvasData = canvasData;
        state.layers = layers;
      } else {
        projectStates.set(projectId, { canvasData, layers, version: 1 });
      }
    });

    // Handle cursor movement
    socket.on('cursor-move', ({ projectId, x, y }) => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        socket.to(projectId).emit('cursor-update', {
          socketId: socket.id,
          username: user.username,
          color: user.color,
          x,
          y
        });
      }
    });

    // Handle layer changes
    socket.on('layer-change', ({ projectId, layers }) => {
      socket.to(projectId).emit('layer-update', { layers });

      // Update project state
      if (projectStates.has(projectId)) {
        projectStates.get(projectId).layers = layers;
      }
    });

    // Handle undo/redo
    socket.on('undo', ({ projectId }) => {
      socket.to(projectId).emit('undo');
    });

    socket.on('redo', ({ projectId }) => {
      socket.to(projectId).emit('redo');
    });

    // Handle canvas clear
    socket.on('clear-canvas', ({ projectId }) => {
      socket.to(projectId).emit('clear-canvas');
    });

    // Handle tool change
    socket.on('tool-change', ({ projectId, tool }) => {
      const user = connectedUsers.get(socket.id);
      socket.to(projectId).emit('user-tool-change', {
        socketId: socket.id,
        username: user?.username,
        tool
      });
    });

    // Leave project
    socket.on('leave-project', async ({ projectId }) => {
      await handleUserLeave(socket, projectId, io);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        await handleUserLeave(socket, user.projectId, io);
      }
      console.log('User disconnected:', socket.id);
    });
  });
};

// Helper function to handle user leaving
const handleUserLeave = async (socket, projectId, io) => {
  try {
    const user = connectedUsers.get(socket.id);

    if (projectId) {
      socket.leave(projectId);

      if (projectRooms.has(projectId)) {
        projectRooms.get(projectId).delete(socket.id);

        if (projectRooms.get(projectId).size === 0) {
          projectRooms.delete(projectId);
          // Clean up project state when last user leaves
          projectStates.delete(projectId);

          // End session if no more users
          await Session.findOneAndUpdate(
            { project: projectId, isActive: true },
            { isActive: false, endedAt: new Date() }
          );
        }
      }

      // Update session to remove user
      await Session.findOneAndUpdate(
        { project: projectId, isActive: true },
        { $pull: { activeUsers: { socketId: socket.id } } }
      );

      // Notify other users
      io.to(projectId).emit('user-left', {
        socketId: socket.id,
        username: user?.username
      });
    }

    connectedUsers.delete(socket.id);
  } catch (error) {
    console.error('Error handling user leave:', error);
  }
};

export default initializeSocket;
