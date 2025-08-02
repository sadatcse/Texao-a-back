import IngredientCategory from "./IngredientCategory.model.js";

// Get all ingredient categories
export async function getAllIngredientCategories(req, res) {
  try {
    const result = await IngredientCategory.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get ingredient categories by branch
export async function getIngredientCategoryByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await IngredientCategory.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get ingredient category by ID
export async function getIngredientCategoryById(req, res) {
  const id = req.params.id;
  try {
    const result = await IngredientCategory.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Ingredient category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new ingredient category
export async function createIngredientCategory(req, res) {
  try {
    const categoryData = req.body;
    const result = await IngredientCategory.create(categoryData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove an ingredient category by ID
export async function removeIngredientCategory(req, res) {
  const id = req.params.id;
  try {
    const result = await IngredientCategory.findByIdAndDelete(id);
    if (result) {
      res
        .status(200)
        .json({ message: "Ingredient category deleted successfully" });
    } else {
      res.status(404).json({ message: "Ingredient category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get active ingredient categories by branch
export async function getActiveIngredientCategoriesByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await IngredientCategory.find({ branch, isActive: true });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update an ingredient category by ID
export async function updateIngredientCategory(req, res) {
  const id = req.params.id;
  const categoryData = req.body;
  try {
    const result = await IngredientCategory.findByIdAndUpdate(
      id,
      categoryData,
      {
        new: true,
      }
    );
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Ingredient category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}