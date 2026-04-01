import mongoose from "mongoose";

const ServiceTypeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

ServiceTypeSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model("ServiceType", ServiceTypeSchema);
