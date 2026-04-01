import ServiceType from "../models/ServiceType.js";

export const getServiceTypes = async (req, res) => {
  try {
    const types = await ServiceType.find({ user: req.user.id })
      .sort({ name: 1 })
      .lean();
    res.json({ data: types });
  } catch (err) {
    console.error("[SERVICE_TYPE] Get failed:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch service types" });
  }
};

export const createServiceType = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Service type name is required" });
    }

    const existing = await ServiceType.findOne({
      user: req.user.id,
      name: String(name).trim(),
    });

    if (existing) {
      return res.status(409).json({ message: "Service type already exists" });
    }

    const serviceType = await ServiceType.create({
      user: req.user.id,
      name: String(name).trim(),
      description: String(description || "").trim(),
    });

    res.status(201).json(serviceType);
  } catch (err) {
    console.error("[SERVICE_TYPE] Create failed:", err?.message || err);
    res.status(500).json({ message: "Failed to create service type" });
  }
};

export const deleteServiceType = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await ServiceType.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Service type not found" });
    }

    res.json({ message: "Service type deleted", serviceType: deleted });
  } catch (err) {
    console.error("[SERVICE_TYPE] Delete failed:", err?.message || err);
    res.status(500).json({ message: "Failed to delete service type" });
  }
};
