import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
  versionNumber: {
    type: Number,
    required: true
  },
  canvasData: {
    type: String,
    required: false
  },
  layers: [{
    id: String,
    name: String,
    data: String,
    visible: Boolean,
    opacity: Number
  }],
  thumbnail: String,
  message: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['editor', 'viewer'],
      default: 'viewer'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  currentVersion: {
    type: Number,
    default: 1
  },
  versions: [versionSchema],
  canvas: {
    width: {
      type: Number,
      default: 1200
    },
    height: {
      type: Number,
      default: 800
    },
    background: {
      type: String,
      default: '#ffffff'
    }
  },
  layers: [{
    id: String,
    name: String,
    data: String,
    visible: Boolean,
    opacity: Number
  }],
  thumbnail: String,
  forkedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  forks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  tags: [String],
  visibility: {
    type: String,
    enum: ['private', 'public', 'unlisted'],
    default: 'private'
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  votes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    value: {
      type: Number,
      enum: [-1, 1]
    }
  }],
  voteCount: {
    type: Number,
    default: 0
  },
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  auction: {
    isActive: Boolean,
    startPrice: Number,
    currentPrice: Number,
    endDate: Date,
    bids: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amount: Number,
      timestamp: Date
    }]
  }
}, {
  timestamps: true
});

// Index for search and sorting
projectSchema.index({ title: 'text', description: 'text', tags: 'text' });
projectSchema.index({ voteCount: -1 });
projectSchema.index({ createdAt: -1 });

export default mongoose.model('Project', projectSchema);
