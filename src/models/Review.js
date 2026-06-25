import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Please add a rating between 1 and 5'],
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: [true, 'Please add a review title'],
    trim: true
  },
  comment: {
    type: String,
    required: [true, 'Please add your review comment'],
    trim: true
  }
}, {
  timestamps: true
});

// Avoid duplicate reviews from the same user for the same product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Static method to calculate average rating of product
reviewSchema.statics.calculateAverageRating = async function(productId) {
  const stats = await this.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        numReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  try {
    if (stats.length > 0) {
      await mongoose.model('Product').findByIdAndUpdate(productId, {
        ratings: Math.round(stats[0].averageRating * 10) / 10,
        numReviews: stats[0].numReviews
      });
    } else {
      await mongoose.model('Product').findByIdAndUpdate(productId, {
        ratings: 0,
        numReviews: 0
      });
    }
  } catch (err) {
    console.error('Error updating average rating: ', err);
  }
};

// Post-save calculate average rating
reviewSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.product);
});

// Post-remove calculate average rating
reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await doc.constructor.calculateAverageRating(doc.product);
  }
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;
