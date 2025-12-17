import Auction from '../models/Auction.js';
import Project from '../models/Project.js';

// Create a new auction
export const createAuction = async (req, res) => {
  try {
    const { projectId, title, description, startingPrice, reservePrice, buyNowPrice, duration } = req.body;

    // Verify project exists and user owns it
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this project' });
    }

    // Calculate end date
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + (duration || 24)); // Default 24 hours

    const auction = new Auction({
      project: projectId,
      seller: req.user._id,
      title,
      description,
      startingPrice,
      currentPrice: startingPrice,
      reservePrice: reservePrice || 0,
      buyNowPrice: buyNowPrice || null,
      endDate,
      thumbnail: project.thumbnail || ''
    });

    await auction.save();

    res.status(201).json(auction);
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all active auctions
export const getActiveAuctions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const auctions = await Auction.find({ status: 'active' })
      .populate('seller', 'username email')
      .populate('project', 'title thumbnail')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Auction.countDocuments({ status: 'active' });

    res.json({
      auctions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get auction by ID
export const getAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('seller', 'username email')
      .populate('project', 'title thumbnail description')
      .populate('bids.bidder', 'username');

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Increment view count
    auction.views += 1;
    await auction.save();

    res.json(auction);
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Place a bid
export const placeBid = async (req, res) => {
  try {
    const { amount } = req.body;
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Check if user is the seller
    if (auction.seller.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot bid on your own auction' });
    }

    try {
      auction.placeBid(req.user._id, amount);
      await auction.save();

      // Populate the auction with user details
      await auction.populate('bids.bidder', 'username');

      res.json(auction);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get user's auctions (selling)
export const getMyAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({ seller: req.user._id })
      .populate('project', 'title thumbnail')
      .populate('winner', 'username')
      .sort({ createdAt: -1 });

    res.json(auctions);
  } catch (error) {
    console.error('Get my auctions error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get user's bids
export const getMyBids = async (req, res) => {
  try {
    const auctions = await Auction.find({ 'bids.bidder': req.user._id })
      .populate('seller', 'username')
      .populate('project', 'title thumbnail')
      .sort({ 'bids.timestamp': -1 });

    // Filter to only include auctions where user has bid
    const myBids = auctions.map(auction => {
      const userBids = auction.bids.filter(
        bid => bid.bidder.toString() === req.user._id.toString()
      );

      return {
        auction,
        myHighestBid: Math.max(...userBids.map(b => b.amount)),
        isWinning: auction.bids.length > 0 &&
                   auction.bids[auction.bids.length - 1].bidder.toString() === req.user._id.toString()
      };
    });

    res.json(myBids);
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Cancel auction (only if no bids)
export const cancelAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    if (auction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this auction' });
    }

    if (auction.bids.length > 0) {
      return res.status(400).json({ message: 'Cannot cancel auction with existing bids' });
    }

    auction.status = 'cancelled';
    await auction.save();

    res.json({ message: 'Auction cancelled successfully', auction });
  } catch (error) {
    console.error('Cancel auction error:', error);
    res.status(500).json({ message: error.message });
  }
};

// End auction manually (only seller)
export const endAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    if (auction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this auction' });
    }

    auction.endAuction();
    await auction.save();

    res.json({ message: 'Auction ended successfully', auction });
  } catch (error) {
    console.error('End auction error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get featured/ending soon auctions
export const getFeaturedAuctions = async (req, res) => {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const endingSoon = await Auction.find({
      status: 'active',
      endDate: { $lte: in24Hours, $gte: now }
    })
      .populate('seller', 'username')
      .populate('project', 'title thumbnail')
      .sort({ endDate: 1 })
      .limit(6);

    const popular = await Auction.find({ status: 'active' })
      .populate('seller', 'username')
      .populate('project', 'title thumbnail')
      .sort({ views: -1, 'bids.length': -1 })
      .limit(6);

    res.json({ endingSoon, popular });
  } catch (error) {
    console.error('Get featured auctions error:', error);
    res.status(500).json({ message: error.message });
  }
};
