import Ingredient from "./Ingredient.model.js";

// Get all ingredients and populate their category details
export async function getAllIngredients(req, res) {
  try {
    const result = await Ingredient.find().populate("category");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get ingredients by branch and populate their category details
export async function getIngredientByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Ingredient.find({ branch }).populate("category");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get a single ingredient by ID and populate its category details
export async function getIngredientById(req, res) {
  const id = req.params.id;
  try {
    const result = await Ingredient.findById(id).populate("category");
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Ingredient not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new ingredient
export async function createIngredient(req, res) {
  try {
    const ingredientData = req.body;
    const result = await Ingredient.create(ingredientData);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({ error: "SKU already exists." });
    }
    res.status(500).send({ error: err.message });
  }
}

// Remove an ingredient by ID
export async function removeIngredient(req, res) {
  const id = req.params.id;
  try {
    const result = await Ingredient.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Ingredient deleted successfully" });
    } else {
      res.status(404).json({ message: "Ingredient not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get active ingredients by branch and populate their category details
export async function getActiveIngredientsByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Ingredient.find({ branch, isActive: true }).populate(
      "category"
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update an ingredient by ID
export async function updateIngredient(req, res) {
  const id = req.params.id;
  const ingredientData = req.body;
  try {
    const result = await Ingredient.findByIdAndUpdate(id, ingredientData, {
      new: true,
      runValidators: true,
    });
    if (result) {
      // Populate the category of the updated document before sending it back
      const populatedResult = await result.populate("category");
      res.status(200).json(populatedResult);
    } else {
      res.status(404).json({ message: "Ingredient not found" });
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({ error: "SKU already exists." });
    }
    res.status(500).send({ error: err.message });
  }
}

export async function updateStockAlert(req, res) {
  const { id } = req.params;
  const { stockAlert } = req.body;

  if (stockAlert == null || stockAlert < 0) {
    return res.status(400).send({ error: "A valid stock alert value is required." });
  }

  try {
    const result = await Ingredient.findByIdAndUpdate(
      id,
      { $set: { stockAlert: stockAlert } },
      { new: true, runValidators: true }
    );

    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Ingredient not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}