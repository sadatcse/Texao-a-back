import Stock from "./Stock.model.js";

// Get all stock for a specific branch
export async function getStockByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const stock = await Stock.find({ branch }).populate({
      path: "ingredient",
      populate: {
        path: "category", // Populate the category within the ingredient
        model: "IngredientCategory",
      },
    });
    res.status(200).json(stock);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Manually adjust stock for an ingredient (for corrections, waste, etc.)
export async function adjustStock(req, res) {
  const { ingredientId, newQuantity } = req.body;
  const branch = req.params.branch;

  if (newQuantity == null || newQuantity < 0) {
    return res.status(400).send({ error: "A valid new quantity is required." });
  }

  try {
    const updatedStock = await Stock.findOneAndUpdate(
      { ingredient: ingredientId, branch: branch },
      { $set: { quantityInStock: newQuantity } },
      { new: true, runValidators: true }
    );

    if (!updatedStock) {
      return res.status(404).send({ error: "Stock item not found." });
    }

    res.status(200).json(updatedStock);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}