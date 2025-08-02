import Vendor from "./Vendor.model.js";

// Get all vendors
export async function getAllVendors(req, res) {
  try {
    const result = await Vendor.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get vendors by branch
export async function getVendorByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Vendor.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get vendor by ID
export async function getVendorById(req, res) {
  const id = req.params.id;
  try {
    const result = await Vendor.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new vendor
export async function createVendor(req, res) {
  try {
    const vendorData = req.body;
    const result = await Vendor.create(vendorData);
    res.status(201).json(result);
  } catch (err) {
    // Handle duplicate vendorID error
    if (err.code === 11000) {
      return res.status(409).send({ error: "Vendor ID already exists." });
    }
    res.status(500).send({ error: err.message });
  }
}

// Remove a vendor by ID
export async function removeVendor(req, res) {
  const id = req.params.id;
  try {
    const result = await Vendor.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Vendor deleted successfully" });
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get active vendors by branch
export async function getActiveVendorsByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Vendor.find({ branch, status: "Active" });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a vendor by ID
export async function updateVendor(req, res) {
  const id = req.params.id;
  const vendorData = req.body;
  try {
    const result = await Vendor.findByIdAndUpdate(id, vendorData, {
      new: true,
      runValidators: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (err) {
    // Handle duplicate vendorID error on update
    if (err.code === 11000) {
      return res.status(409).send({ error: "Vendor ID already exists." });
    }
    res.status(500).send({ error: err.message });
  }
}