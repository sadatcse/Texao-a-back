import mongoose from "mongoose";
const { Schema, model } = mongoose;

const CategorySchema = Schema(
  {
    categoryName: {
      type: String,
      required: [true, "Please provide a category name"],
    },
    serial: {
      type: Number,
      required: [true, "Please provide a serial number"],
  
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
    isActive: {
      type: Boolean,
      default: true, // Default to active
    },
  },
  { timestamps: true }
);

// Indexes for production performance optimization
CategorySchema.index({ branch: 1 });

const Category = model("Category", CategorySchema);
export default Category;
