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

// Get expenses by branch
export async function getExpenseByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Expense.find({ branch });
    res.status(200).json(result);
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