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
  },
  { timestamps: true }
);

const Company = model("Company", CompanySchema);

export default Company;
