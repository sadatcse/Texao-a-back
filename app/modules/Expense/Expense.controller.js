import Expense from "./Expense.model.js";

// Get all expenses
export async function getAllExpenses(req, res) {
  try {
    const result = await Expense.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
export async function getExpenseByBranch(req, res) {
  try {
    const { branch } = req.params;
    // --- MODIFICATION START ---
    // Destructure fromDate and toDate from the query instead of 'date'
    const { search, fromDate, toDate, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { branch };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }
    
    // Build the date range query
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) {
        // Set the start of the day for the 'from' date
        const startDate = new Date(fromDate);
        startDate.setUTCHours(0, 0, 0, 0);
        query.date.$gte = startDate;
      }
      if (toDate) {
        // Set the end of the day for the 'to' date to include the entire day
        const endDate = new Date(toDate);
        endDate.setUTCHours(23, 59, 59, 999);
        query.date.$lte = endDate;
      }
    }
    // --- MODIFICATION END ---

    const [results, totalDocuments] = await Promise.all([
      Expense.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNumber),
      Expense.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(totalDocuments / limitNumber);

    res.status(200).json({
      data: results,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalDocuments,
        limit: limitNumber
      }
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get expense by ID
export async function getExpenseById(req, res) {
  const id = req.params.id;
  try {
    const result = await Expense.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Expense not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new expense
export async function createExpense(req, res) {
  try {
    const expenseData = req.body;
    const result = await Expense.create(expenseData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove an expense by ID
export async function removeExpense(req, res) {
  const id = req.params.id;
  try {
    const result = await Expense.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Expense deleted successfully" });
    } else {
      res.status(404).json({ message: "Expense not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update an expense by ID
export async function updateExpense(req, res) {
  const id = req.params.id;
  const expenseData = req.body;
  try {
    const result = await Expense.findByIdAndUpdate(id, expenseData, {
      new: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Expense not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}