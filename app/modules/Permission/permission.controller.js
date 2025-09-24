import Permission from "./permission.model.js";
// Get permissions for a specific role
export async function getPermissionsByRole(req, res) {
  const { role } = req.params;
  const { branch } = req.query;
  try {
    const permissions = await Permission.find({ role, branch });

    
    if (!permissions) {
      return res.status(404).json({ message: "Role not found" });
    }
    const permissionReport = await Permission.aggregate([
      {
        $match: {
          role: role,
          isAllowed: true,
          branch
        },
      },
      {
        $group: {
          _id: null,
          allowedGroups: { $addToSet: "$group_name" },
        },
      },
      {
        $project: {
          _id: 0,
          allowedGroups: "$allowedGroups",
        },
      },
    ]);
    res.status(200).json({
      routesData: permissions,
      groupNames: permissionReport[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Update permissions for a specific role
export async function updatePermissions(req, res) {
  const routeData = req.body;

  const isExist = await Permission.findOne({
    role: routeData.role,
    path: routeData.path,
    branch: routeData.branch,
  });

  try {
    if (isExist) {
      const updatedPermissions = await Permission.findOneAndUpdate(
        { role: routeData.role, path: routeData?.path, branch: routeData?.branch },
        routeData,
        { new: true, upsert: true } // upsert: true creates the role if it doesn't exist
      );
      res.status(200).json(updatedPermissions);
    } else {
      const updatedPermissions = await Permission.create(routeData);
      res.status(200).json(updatedPermissions);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Create a new role with permissions
export async function createRole(req, res) {
  try {
    const newRole = new Permission(req.body);
    await newRole.save();
    res.status(201).json(newRole);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
