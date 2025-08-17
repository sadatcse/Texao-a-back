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
    vat: {
      type: Number,
      default: 0, // percentage
    },
    sd: {
      type: Number,
      default: 0, // percentage (Supplementary Duty)
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
      // required: [true, "Please provide a branch"],
      default: "teaxo",
    },
    photo: {
      type: String, // URL or file path for the photo
    },
  },
  { timestamps: true }
);

const Product = model("Product", ProductSchema);

export default Product;
