import Category from "./Catagories.model.js";

// Get all categories
export async function getAllCategories(req, res) {
  try {
    const result = await Category.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get categories by branch
export async function getCategoryByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Category.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get category by ID
export async function getCategoryById(req, res) {
  const id = req.params.id;
  try {
    const result = await Category.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new category
export async function createCategory(req, res) {
  try {
    const categoryData = req.body;
    const result = await Category.create(categoryData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove a category by ID
export async function removeCategory(req, res) {
  const id = req.params.id;
  try {
    const result = await Category.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Category deleted successfully" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getActiveCategoriesByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Category.find({ branch, isActive: true });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a category by ID
export async function updateCategory(req, res) {
  const id = req.params.id;
  const categoryData = req.body;
  try {
    const result = await Category.findByIdAndUpdate(id, categoryData, {
      new: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
