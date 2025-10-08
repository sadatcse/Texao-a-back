import mongoose from "mongoose";
const { Schema, model } = mongoose;

const CompanySchema = Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide the company name"],
    },
    phone: {
      type: String,
      required: [true, "Please provide the company phone number"],
    },
    email: {
      type: String,
      required: [true, "Please provide the company email address"],
      unique: true,
    },
       ownerEmail: {
      type: String,
      required: [true, "Please provide the owner's email address"],
    },
    address: {
      type: String,
      required: [true, "Please provide the company address"],
    },
    logo: {
      type: String,
    },
    otherInformation: {
      type: String,
    },
    branch: {
      type: String,
      required: [true, "Please provide the branch"],
    },
    website: {
      type: String, // Not required
    },
    binNumber: {
      type: String, // Add the new Bin Number field
    },
    tinNumber: {
      type: String, // Add the new Tin Number field
    }
  },
  { timestamps: true }
);

const Company = model("Company", CompanySchema);

export default Company;
