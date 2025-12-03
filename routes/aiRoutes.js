import express from 'express';
import {
  generateAIImage,
  createVariation,
  getSuggestions,
  getColorPalette
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All AI routes require authentication
router.use(protect);

// POST /api/ai/generate - Generate image from text
router.post('/generate', generateAIImage);

// POST /api/ai/variation - Create variation of existing image
router.post('/variation', createVariation);

// POST /api/ai/suggestions - Get AI suggestions for artwork
router.post('/suggestions', getSuggestions);

// POST /api/ai/palette - Generate color palette
router.post('/palette', getColorPalette);

export default router;
