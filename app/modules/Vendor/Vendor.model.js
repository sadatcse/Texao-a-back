import mongoose from "mongoose";
const { Schema, model } = mongoose;

const VendorSchema = Schema(
  {
    vendorID: {
      type: String,
      required: [true, "Please provide a Vendor ID"],
      unique: true,
    },
    vendorName: {
      type: String,
      required: [true, "Please provide a vendor name"],
    },
    address: {
      type: String,
    },
    primaryPhone: {
      type: String,
      required: [true, "Please provide a primary phone number"],
    },
    primaryEmail: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    contactPersonName: {
      type: String,
    },
    contactPersonPhone: {
      type: String,
    },
    notes: {
      type: String,
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
  },
  { timestamps: true }
);

const Vendor = model("Vendor", VendorSchema);

export default Vendor;