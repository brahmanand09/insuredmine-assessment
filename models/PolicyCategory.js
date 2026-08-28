const mongoose = require('mongoose');

const policyCategorySchema = new mongoose.Schema({
  category_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('PolicyCategory', policyCategorySchema);
