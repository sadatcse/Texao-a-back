import mongoose from "mongoose";

const { Schema, model } = mongoose;

const UserRoleSchema = Schema(
  {
    branch: {
      type: String,
      required: [true, "Please provide the branch"],
    },
    userrole: {
      type: String,
      required: [true, "Please provide the user role"],
    },
  },
  { timestamps: true }
);

const UserRole = model("UserRole", UserRoleSchema);

export default UserRole;
