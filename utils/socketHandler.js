import Session from '../models/Session.js';

const connectedUsers = new Map(); // socketId -> { userId, projectId, username, color }
const projectRooms = new Map(); // projectId -> Set of socketIds

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
