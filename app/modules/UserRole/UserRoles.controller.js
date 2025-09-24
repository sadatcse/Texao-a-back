import UserRole from "./UserRoles.model.js";

// Get all user roles
export async function getAllUserRoles(req, res) {
  try {
    const result = await UserRole.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get user role by ID
export async function getUserRoleById(req, res) {
  const id = req.params.id;
  try {
    const result = await UserRole.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "UserRole not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get user roles by branch
export const getUserRolesByBranch = async (req, res) => {
  const { branch } = req.params;
  try {
    const userRoles = await UserRole.find({ branch });
    res.status(200).json(userRoles);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user roles", error: err.message });
  }
};

// Create a new user role
export async function createUserRole(req, res) {
  try {
    const userRoleData = req.body;
    const result = await UserRole.create(userRoleData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a user role by ID
export async function updateUserRole(req, res) {
  const id = req.params.id;
  const userRoleData = req.body;
  try {
    const result = await UserRole.findByIdAndUpdate(id, userRoleData, {
      new: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "UserRole not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove a user role by ID
export async function removeUserRole(req, res) {
  const id = req.params.id;
  try {
    const result = await UserRole.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "UserRole deleted successfully" });
    } else {
      res.status(404).json({ message: "UserRole not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
