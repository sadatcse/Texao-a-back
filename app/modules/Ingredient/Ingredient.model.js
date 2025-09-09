import mongoose from "mongoose";
const { Schema, model } = mongoose;

const IngredientSchema = Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide an ingredient name"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "IngredientCategory",
      required: [true, "Please provide a category"],
    },
    unit: {
      type: String,
      required: [true, "Please provide a unit (e.g., kg, pcs, ltr)"],
    },
    sku: {
      type: String,
      required: [true, "Please provide a SKU"],
      unique: true,
    },
    stockAlert: {
      type: Number,
      default: 0, // Default to 0, meaning no alert
      min: [0, "Stock alert cannot be negative"],
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Ingredient = model("Ingredient", IngredientSchema);
export default Ingredient;
