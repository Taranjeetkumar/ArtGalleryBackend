import Project from '../models/Project.js';
import User from '../models/User.js';

export const createProject = async (req, res) => {
  try {
    const { title, description, canvas, visibility } = req.body;

    const project = await Project.create({
      title,
      description,
      owner: req.user._id,
      canvas: canvas || {},
      visibility: visibility || 'private',
      versions: [{
        versionNumber: 1,
        canvasData: '',
        layers: [],
        message: 'Initial version',
        author: req.user._id
      }]
    });

    await User.findByIdAndUpdate(req.user._id, {
      $push: { portfolioProjects: project._id }
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    const { page = 1, limit = 12, sort = '-createdAt', search, tags } = req.query;

    const query = { visibility: 'public' };

    if (search) {
      query.$text = { $search: search };
    }

    if (tags) {
      query.tags = { $in: tags.split(',') };
    }

    const projects = await Project.find(query)
      .populate('owner', 'username avatar')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Project.countDocuments(query);

    res.json({
      projects,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'username avatar email')
      .populate('collaborators.user', 'username avatar')
      .populate('versions.author', 'username avatar');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check access permissions
    if (project.visibility === 'private') {
      const isOwner = project.owner._id.toString() === req.user?._id.toString();
      const isCollaborator = project.collaborators.some(
        c => c.user._id.toString() === req.user?._id.toString()
      );

      if (!isOwner && !isCollaborator) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Increment view count
    project.viewCount += 1;
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { title, description, layers, canvas, tags, visibility } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user has edit permission
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isEditor = project.collaborators.some(
      c => c.user.toString() === req.user._id.toString() && c.role === 'editor'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ message: 'Not authorized to edit this project' });
    }

    if (title) project.title = title;
    if (description !== undefined) project.description = description;
    if (layers) project.layers = layers;
    if (canvas) project.canvas = { ...project.canvas, ...canvas };
    if (tags) project.tags = tags;
    if (visibility) project.visibility = visibility;

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await project.deleteOne();

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { portfolioProjects: project._id }
    });

    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createVersion = async (req, res) => {
  try {
    const { canvasData, layers, message, thumbnail } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const newVersion = {
      versionNumber: project.currentVersion + 1,
      canvasData,
      layers,
      message,
      thumbnail,
      author: req.user._id
    };

    project.versions.push(newVersion);
    project.currentVersion += 1;
    project.layers = layers;
    project.thumbnail = thumbnail;

    await project.save();
    res.status(201).json(newVersion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const forkProject = async (req, res) => {
  try {
    const originalProject = await Project.findById(req.params.id);

    if (!originalProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (originalProject.visibility === 'private') {
      return res.status(403).json({ message: 'Cannot fork private project' });
    }

    const forkedProject = await Project.create({
      title: `${originalProject.title} (Fork)`,
      description: originalProject.description,
      owner: req.user._id,
      canvas: originalProject.canvas,
      layers: originalProject.layers,
      forkedFrom: originalProject._id,
      visibility: 'private',
      versions: [{
        versionNumber: 1,
        canvasData: originalProject.versions[originalProject.versions.length - 1]?.canvasData || '',
        layers: originalProject.layers,
        message: `Forked from ${originalProject.title}`,
        author: req.user._id
      }]
    });

    // Add to original project's forks
    originalProject.forks.push(forkedProject._id);
    await originalProject.save();

    res.status(201).json(forkedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const voteProject = async (req, res) => {
  try {
    const { value } = req.body; // 1 for upvote, -1 for downvote
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const existingVote = project.votes.find(
      v => v.user.toString() === req.user._id.toString()
    );

    if (existingVote) {
      // Remove previous vote count
      project.voteCount -= existingVote.value;
      // Update vote
      existingVote.value = value;
    } else {
      project.votes.push({ user: req.user._id, value });
    }

    project.voteCount += value;
    await project.save();

    res.json({ voteCount: project.voteCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addCollaborator = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can add collaborators' });
    }

    const alreadyCollaborator = project.collaborators.some(
      c => c.user.toString() === userId
    );

    if (alreadyCollaborator) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    project.collaborators.push({ user: userId, role });
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyProjects = async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user._id })
      .populate('collaborators.user', 'username avatar')
      .sort('-updatedAt');

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
