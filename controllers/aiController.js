import {
  generateImage,
  createImageVariation,
  getArtSuggestions,
  generateColorPalette
} from '../services/aiService.js';

// Generate image from text prompt
export const generateAIImage = async (req, res) => {
  try {
    const { prompt, size, quality } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const result = await generateImage(prompt, size, quality);

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json({
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt
    });
  } catch (error) {
    console.error('Generate AI Image Error:', error);
    res.status(500).json({ message: 'Failed to generate image' });
  }
};

// Create variation of existing artwork
export const createVariation = async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ message: 'Image data is required' });
    }

    const result = await createImageVariation(imageData);

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json({
      imageUrl: result.imageUrl
    });
  } catch (error) {
    console.error('Create Variation Error:', error);
    res.status(500).json({ message: 'Failed to create variation' });
  }
};

// Get AI suggestions for artwork
export const getSuggestions = async (req, res) => {
  try {
    const { description, style } = req.body;

    if (!description) {
      return res.status(400).json({ message: 'Artwork description is required' });
    }

    const result = await getArtSuggestions(description, style || 'general');

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json({
      suggestions: result.suggestions
    });
  } catch (error) {
    console.error('Get Suggestions Error:', error);
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
};

// Generate color palette
export const getColorPalette = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    const result = await generateColorPalette(description);

    res.json({
      palette: result.palette
    });
  } catch (error) {
    console.error('Get Color Palette Error:', error);
    res.status(500).json({ message: 'Failed to generate palette' });
  }
};
