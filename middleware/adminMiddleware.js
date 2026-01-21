import User from "../models/User.js";

export default async function adminMiddleware(req, res, next) {
  const user = await User.findById(req.user.id);

  if (!user || user.role !== "superadmin") {
    return res.status(403).json({ message: "Admin access denied" });
  }

  next();
}
