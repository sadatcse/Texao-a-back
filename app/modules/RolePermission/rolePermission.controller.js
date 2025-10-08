import RolePermission from './rolePermission.model.js';

/**
 * @description Create or update permissions for a specific role in a specific branch.
 * This function uses `findOneAndUpdate` with `upsert` to handle both
 * creation of new permissions and updates to existing ones.
 * @route       POST /api/permissions
 * @access      Private/Admin
 */
export const createOrUpdatePermission = async (req, res) => {
  try {
    const { branch, role, permissions } = req.body;

    // --- Basic Validation ---
    if (!branch || !role) {
      return res.status(400).json({ message: 'Branch and role are required.' });
    }
    if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({ message: 'Permissions object is required.' });
    }

    const updatedPermission = await RolePermission.findOneAndUpdate(
      { branch, role: role.toUpperCase() }, // The filter to find the document
      { $set: { permissions } },             // The data to update
      { 
        new: true,    // Return the modified document rather than the original
        upsert: true, // Create a new document if one doesn't exist
        runValidators: true // Ensure the model's schema rules are applied
      }
    );

    res.status(201).json({ 
        message: 'Permissions saved successfully', 
        data: updatedPermission 
    });
  } catch (error) {
    // Handle potential duplicate key errors
    if (error.code === 11000) {
        return res.status(409).json({ message: 'A permission set for this role and branch already exists but failed to update.' });
    }
    res.status(500).json({ message: 'Server error while updating permissions.', error: error.message });
  }
};

/**
 * @description Get the permissions for a specific role and branch.
 * @route       GET /api/permissions?role=MANAGER&branch=Main
 * @access      Private
 */
export const getPermission = async (req, res) => {
    try {
        const { branch, role } = req.query;

        if (!branch || !role) {
            return res.status(400).json({ message: 'Branch and role query parameters are required.' });
        }

        const permission = await RolePermission.findOne({ branch, role: role.toUpperCase() });

        if (!permission) {
            return res.status(404).json({ message: 'No permissions found for the specified role and branch.' });
        }

        res.status(200).json({ success: true, data: permission });

    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching permission.', error: error.message });
    }
};

/**
 * @description Get all permission sets for all roles and branches.
 * @route       GET /api/permissions/all
 * @access      Private/Admin
 */
export const getAllPermissions = async (req, res) => {
    try {
        const permissions = await RolePermission.find({});
        res.status(200).json({ success: true, count: permissions.length, data: permissions });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching all permissions.', error: error.message });
    }
};

/**
 * @description Delete the permissions for a specific role and branch.
 * @route       DELETE /api/permissions
 * @access      Private/Admin
 */
export const deletePermission = async (req, res) => {
    try {
        const { branch, role } = req.body;

        if (!branch || !role) {
            return res.status(400).json({ message: 'Branch and role are required in the request body.' });
        }

        const result = await RolePermission.findOneAndDelete({ branch, role: role.toUpperCase() });

        if (!result) {
            return res.status(404).json({ message: 'No permissions found to delete for the specified role and branch.' });
        }

        res.status(200).json({ message: 'Permissions deleted successfully.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting permission.', error: error.message });
    }
};
