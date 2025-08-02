import mongoose from "mongoose";
const { Schema, model } = mongoose;

const IngredientCategorySchema = Schema(
  {
    categoryName: {
      type: String,
      required: [true, "Please provide a category name"],
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

const IngredientCategory = model(
  "IngredientCategory",
  IngredientCategorySchema
);

export default IngredientCategory;