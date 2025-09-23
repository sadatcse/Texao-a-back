
// TransactionLog.controller.js
import TransactionLog from "./TransactionLog.model.js";

// Get all transaction logs
export async function getAllTransactionLogs(req, res) {
  try {
    const logs = await TransactionLog.find();
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export async function getSuperAdminTransactionLogs(req, res) {
  try {
    const { 
        page = 1, 
        limit = 15, 
        branch = '', 
        search = '',
        startDate = '',
        endDate = '',
        status = 'failed', // Default to 'failed' to act as an "Error Log"
        transactionCode = '',
        transactionType = ''
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // --- Build Filter Query ---
    const query = {};

    if (branch) query.branch = branch;
    if (status) query.status = status;
    if (transactionCode) query.transactionCode = transactionCode;
    if (transactionType) query.transactionType = { $regex: transactionType, $options: 'i' };

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { Message: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Date Filtering Logic
    if (startDate && endDate) {
      query.transactionTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      query.transactionTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.transactionTime = { $lte: new Date(endDate) };
    } else if (status === 'failed') { // Only default to this month if we are looking at errors
      const startOfMonth = moment().startOf('month').toDate();
      const endOfMonth = moment().endOf('month').toDate();
      query.transactionTime = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // --- Execute Queries ---
    const totalLogs = await TransactionLog.countDocuments(query);
    const logs = await TransactionLog.find(query)
      .sort({ transactionTime: -1 })
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
    res.status(500).send({ error: "Server error fetching transaction logs: " + err.message });
  }
}
// Get paginated transaction logs
export async function getPaginatedTransactionLogs(req, res) {
  const { page = 1, limit = 10 } = req.query;

  try {
    const totalLogs = await TransactionLog.countDocuments();
    const logs = await TransactionLog.find()
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
    res.status(500).json({ error: err.message });
  }
}

// Get transaction logs by branch
export async function getTransactionLogsByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const logs = await TransactionLog.find({ branch });
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get a single transaction log by ID
export async function getTransactionLogById(req, res) {
  const id = req.params.id;
  try {
    const log = await TransactionLog.findById(id);
    if (log) {
      res.status(200).json(log);
    } else {
      res.status(404).json({ message: "Transaction log not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Create a new transaction log
export async function createTransactionLog(req, res) {
  try {
    const logData = req.body;
    const newLog = await TransactionLog.create(logData);
    res.status(201).json(newLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Delete a transaction log by ID
export async function removeTransactionLog(req, res) {
  const id = req.params.id;
  try {
    const deletedLog = await TransactionLog.findByIdAndDelete(id);
    if (deletedLog) {
      res.status(200).json({ message: "Transaction log deleted successfully" });
    } else {
      res.status(404).json({ message: "Transaction log not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}