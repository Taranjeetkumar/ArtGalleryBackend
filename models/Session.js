import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  activeUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    socketId: String,
    cursor: {
      x: Number,
      y: Number
    },
    color: String,
    joinedAt: Date,
    lastActivity: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date
}, {
  timestamps: true
});

export default mongoose.model('Session', sessionSchema);
