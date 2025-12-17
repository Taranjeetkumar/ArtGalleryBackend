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
    const { page = 1, limit = 12, sort = '-createdAt', search, tags, onlyAuction } = req.query;

    const query = { visibility: 'public' };

    // Search with case-insensitive regex for partial matches
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i'); // 'i' flag for case-insensitive
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ];
    }

    if (tags) {
      query.tags = { $in: tags.split(',') };
    }

    // Filter for auction items
    if (onlyAuction === 'true') {
      query['auction.isActive'] = true;
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
      // If not authenticated, deny access to private projects
      if (!req.user) {
        return res.status(403).json({ message: 'Access denied. Please login to view this project.' });
      }

      const isOwner = project.owner._id.toString() === req.user._id.toString();
      const isCollaborator = project.collaborators.some(
        c => c.user._id.toString() === req.user._id.toString()
      );

      if (!isOwner && !isCollaborator) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Increment view count (only once per user per session)
    // For anonymous users, always increment
    // For logged-in users, track views to prevent duplicates
    if (!req.user) {
      project.viewCount += 1;
    } else {
      // Check if user has already viewed this project
      const hasViewed = project.views?.some(
        v => v.user?.toString() === req.user._id.toString()
      );

      if (!hasViewed) {
        if (!project.views) {
          project.views = [];
        }
        project.views.push({ user: req.user._id, viewedAt: new Date() });
        project.viewCount += 1;
      }
    }

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
    const originalProject = await Project.findById(req.params.id)
      .populate('owner', 'username avatar')
      .populate('forkedFrom', 'title owner');

    if (!originalProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (originalProject.visibility === 'private') {
      return res.status(403).json({ message: 'Cannot fork private project' });
    }

    // Get the latest version for forking
    const latestVersion = originalProject.versions[originalProject.versions.length - 1];

    // Build fork lineage
    const forkLineage = originalProject.forkLineage || [];
    forkLineage.push({
      projectId: originalProject._id,
      title: originalProject.title,
      owner: originalProject.owner,
      forkedAt: new Date()
    });

    const forkedProject = await Project.create({
      title: `${originalProject.title} (Fork)`,
      description: `Forked from "${originalProject.title}" by ${originalProject.owner.username}\n\n${originalProject.description}`,
      owner: req.user._id,
      canvas: originalProject.canvas,
      layers: originalProject.layers,
      tags: originalProject.tags,
      forkedFrom: originalProject._id,
      forkLineage,
      forkGeneration: (originalProject.forkGeneration || 0) + 1,
      visibility: 'private',
      thumbnail: latestVersion?.thumbnail || originalProject.thumbnail,
      versions: [{
        versionNumber: 1,
        canvasData: latestVersion?.canvasData || '',
        layers: originalProject.layers,
        thumbnail: latestVersion?.thumbnail || originalProject.thumbnail,
        message: `Forked from ${originalProject.title}`,
        author: req.user._id
      }]
    });

    // Add to original project's forks
    originalProject.forks.push(forkedProject._id);
    originalProject.forkCount = (originalProject.forkCount || 0) + 1;
    await originalProject.save();

    // Populate the forked project
    await forkedProject.populate('owner', 'username avatar');

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

    const existingVoteIndex = project.votes.findIndex(
      v => v.user.toString() === req.user._id.toString()
    );

    if (existingVoteIndex !== -1) {
      const existingVote = project.votes[existingVoteIndex];

      // If user is voting the same way again, ignore it (no duplicate votes)
      if (existingVote.value === value) {
        return res.json({
          voteCount: project.voteCount,
          message: 'You have already voted this way'
        });
      }

      // Remove previous vote count
      project.voteCount -= existingVote.value;
      // Update vote value
      project.votes[existingVoteIndex].value = value;
    } else {
      // New vote
      project.votes.push({ user: req.user._id, value });
    }

    // Add new vote count
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

export const removeCollaborator = async (req, res) => {
  try {
    const { userId } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can remove collaborators' });
    }

    project.collaborators = project.collaborators.filter(
      c => c.user.toString() !== userId
    );
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCollaboratorRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can update collaborator roles' });
    }

    const collaborator = project.collaborators.find(
      c => c.user.toString() === userId
    );

    if (!collaborator) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    collaborator.role = role;
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateShareLink = async (req, res) => {
  try {
    const { role, expiresIn } = req.body; // role: 'editor' or 'viewer', expiresIn: hours
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can generate share links' });
    }

    // Generate a unique token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

    if (!project.shareLinks) {
      project.shareLinks = [];
    }

    project.shareLinks.push({
      token,
      role,
      expiresAt,
      createdBy: req.user._id
    });

    await project.save();

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${project._id}/join/${token}`;

    res.json({ token, shareUrl, expiresAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const joinViaShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    const project = await Project.findOne({
      'shareLinks.token': token
    });

    if (!project) {
      return res.status(404).json({ message: 'Invalid share link' });
    }

    const shareLink = project.shareLinks.find(link => link.token === token);

    if (!shareLink) {
      return res.status(404).json({ message: 'Invalid share link' });
    }

    // Check if link has expired
    if (new Date() > new Date(shareLink.expiresAt)) {
      return res.status(410).json({ message: 'Share link has expired' });
    }

    // Check if user is already a collaborator or owner
    if (project.owner.toString() === req.user._id.toString()) {
      return res.json({ message: 'You are already the owner', project });
    }

    const alreadyCollaborator = project.collaborators.some(
      c => c.user.toString() === req.user._id.toString()
    );

    if (alreadyCollaborator) {
      return res.json({ message: 'You are already a collaborator', project });
    }

    // Add user as collaborator
    project.collaborators.push({
      user: req.user._id,
      role: shareLink.role
    });

    await project.save();

    res.json({ message: 'Successfully joined project', project });
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
