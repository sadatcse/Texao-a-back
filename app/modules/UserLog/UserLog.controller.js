import UserLog from "./UserLog.model.js";
import Company from "../Company/Companys.model.js";
import moment from 'moment';
// Get all user logs
export async function getAllUserLogs(req, res) {
  try {
    const result = await UserLog.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getPaginatedUserLogs(req, res) {
  const { page = 1, limit = 10, branch } = req.query;

  try {
    const filter = branch ? { branch: branch } : {};
    const totalLogs = await UserLog.countDocuments(filter);
    const logs = await UserLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: parseInt(page),
      logs,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getSuperAdminLogs(req, res) {
  try {
    const { 
        page = 1, 
        limit = 10, 
        branch = '', 
        search = '',
        startDate = '',
        endDate = '',
        status = ''
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (branch) query.branch = branch;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }

    // --- Updated Date Filter Logic ---
    if (startDate && endDate) {
      // Case 1: A specific date range is provided by the user
      query.loginTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      // Case 2: Only a start date is provided
      query.loginTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      // Case 3: Only an end date is provided
      query.loginTime = { $lte: new Date(endDate) };
    } else {
      // ✅ NEW: Case 4: No dates are provided, so default to the current month
      const startOfMonth = moment().startOf('month').toDate();
      const endOfMonth = moment().endOf('month').toDate();
      query.loginTime = { $gte: startOfMonth, $lte: endOfMonth };
    }
    // --- End of Updated Logic ---

    if (status === 'active') query.logoutTime = { $exists: false };
    else if (status === 'logged_out') query.logoutTime = { $exists: true, $ne: null };

    const totalLogs = await UserLog.countDocuments(query);
    const logs = await UserLog.find(query)
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(limitNum);
      
    res.status(200).json({
      data: logs,
      pagination: {
        totalDocuments: totalLogs,
        totalPages: Math.ceil(totalLogs / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });

  } catch (err) {
    res.status(500).send({ error: "Server error fetching user logs: " + err.message });
  }
}
export async function getUserLogsByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await UserLog.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get user log by ID
export async function getUserLogById(req, res) {
  const id = req.params.id;
  try {
    const result = await UserLog.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "User log not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new user log
export async function createUserLog(req, res) {
  try {
    const userLogData = req.body;
    const result = await UserLog.create(userLogData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a user log by ID
export async function updateUserLog(req, res) {
  const id = req.params.id;
  const userLogData = req.body;
  try {
    const result = await UserLog.findByIdAndUpdate(id, userLogData, { new: true });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "User log not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove a user log by ID
export async function removeUserLog(req, res) {
  const id = req.params.id;
  try {
    const result = await UserLog.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "User log deleted successfully" });
    } else {
      res.status(404).json({ message: "User log not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
