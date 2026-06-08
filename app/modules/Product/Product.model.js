import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ProductSchema = Schema(
  {
    category: {
      type: String,
      required: [true, "Please provide a category"],
    },
    productName: {
      type: String,
      required: [true, "Please provide a product name"],
    },
    flavour: {
      type: Boolean,
      default: false,
    },
    cFlavor: {
      type: Boolean,
      default: false,
    },
    addOns: {
      type: Boolean,
      default: false,
    },

    drinkBar: {
      type: Boolean,
      default: false, 
    },

    vat: {
      type: Number,
      default: 0, 
    },
    sd: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, "Please provide a price"],
    },
    status: {
      type: String,
      enum: ["available", "unavailable"],
      default: "available",
    },
    productDetails: {
      type: String,
    },
    branch: {
      type: String,
      default: "teaxo",
    },
    photo: {
      type: String, 
    },
  },
  { timestamps: true }
);

// Indexes for production performance optimization
ProductSchema.index({ branch: 1, category: 1 });
ProductSchema.index({ status: 1 });

const Product = model("Product", ProductSchema);

export default Product;