import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // 🔐 PASSWORD IS COMPULSORY FOR USERS
    password: {
      type: String,
      required: function () {
        return this.role !== "superadmin";
      },
    },

    role: {
      type: String,
      enum: ["user", "superadmin"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Google login permission
    googleEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
