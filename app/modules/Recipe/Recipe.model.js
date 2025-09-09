import mongoose from "mongoose";
const { Schema, model } = mongoose;

const RecipeSchema = Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },
    productName: {
      type: String,
      required: [true, "Please provide a product name"],
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
    ingredients: [
      {
        ingredientId: {
          type: Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        ingredientName: {
          type: String,
          required: [true, "Please provide an ingredient name"],
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        unit: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const Recipe = model("Recipe", RecipeSchema);
export default Recipe;