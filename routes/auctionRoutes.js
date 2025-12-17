import express from 'express';
import {
  createAuction,
  getActiveAuctions,
  getAuctionById,
  placeBid,
  getMyAuctions,
  getMyBids,
  cancelAuction,
  endAuction,
  getFeaturedAuctions
} from '../controllers/auctionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveAuctions);
router.get('/featured', getFeaturedAuctions);
router.get('/:id', getAuctionById);

// Protected routes
router.post('/', protect, createAuction);
router.post('/:id/bid', protect, placeBid);
router.get('/my/selling', protect, getMyAuctions);
router.get('/my/bidding', protect, getMyBids);
router.put('/:id/cancel', protect, cancelAuction);
router.put('/:id/end', protect, endAuction);

export default router;
