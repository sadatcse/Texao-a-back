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
    const { search, date: dateFilter, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Build the query object based on filters
    const query = { branch };
    if (search) {
      // Allow searching by title or category
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }
    if (dateFilter) {
      const startDate = new Date(dateFilter);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(dateFilter);
      endDate.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    // Execute two queries in parallel: one for the data, one for the total count
    const [results, totalDocuments] = await Promise.all([
      Expense.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNumber),
      Expense.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(totalDocuments / limitNumber);

    // Return a structured response
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