import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  bidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const auctionSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    default: function() { return this.startingPrice; }
  },
  reservePrice: {
    type: Number,
    default: 0
  },
  buyNowPrice: {
    type: Number,
    default: null
  },
  bids: [bidSchema],
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'sold', 'cancelled'],
    default: 'active'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  thumbnail: {
    type: String,
    default: ''
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for highest bidder
auctionSchema.virtual('highestBidder').get(function() {
  if (this.bids.length === 0) return null;
  return this.bids[this.bids.length - 1].bidder;
});

// Method to place a bid
auctionSchema.methods.placeBid = function(bidderId, amount) {
  if (this.status !== 'active') {
    throw new Error('Auction is not active');
  }

  if (new Date() > this.endDate) {
    this.status = 'ended';
    throw new Error('Auction has ended');
  }

  if (amount <= this.currentPrice) {
    throw new Error(`Bid must be higher than current price: $${this.currentPrice}`);
  }

  if (this.buyNowPrice && amount >= this.buyNowPrice) {
    this.currentPrice = this.buyNowPrice;
    this.status = 'sold';
    this.winner = bidderId;
    this.bids.push({ bidder: bidderId, amount: this.buyNowPrice });
  } else {
    this.currentPrice = amount;
    this.bids.push({ bidder: bidderId, amount });
  }

  return this;
};

// Method to end auction
auctionSchema.methods.endAuction = function() {
  if (this.status !== 'active') {
    throw new Error('Auction is not active');
  }

  this.status = 'ended';

  if (this.bids.length > 0 && this.currentPrice >= this.reservePrice) {
    this.status = 'sold';
    this.winner = this.bids[this.bids.length - 1].bidder;
  }

  return this;
};

// Index for efficient queries
auctionSchema.index({ status: 1, endDate: -1 });
auctionSchema.index({ seller: 1 });

const Auction = mongoose.model('Auction', auctionSchema);

export default Auction;
