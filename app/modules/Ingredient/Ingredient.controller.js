import Ingredient from "./Ingredient.model.js";


export async function getAllIngredients(req, res) {
  try {
    const result = await Ingredient.find().populate("category");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getIngredientByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Ingredient.find({ branch }).populate("category");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


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


export async function updateIngredient(req, res) {
  const id = req.params.id;
  const ingredientData = req.body;
  try {
    const result = await Ingredient.findByIdAndUpdate(id, ingredientData, {
      new: true,
      runValidators: true,
    });
    if (result) {

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
    return res
      .status(400)
      .send({ error: "A valid stock alert value is required." });
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


export async function getIngredientsByBranchAndCategory(req, res) {
  const { branch, category } = req.params;
  try {
    const result = await Ingredient.find({ branch, category }).populate(
      "category"
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getPaginatedIngredientsByBranch(req, res) {
    const { branch } = req.params;
    const { search = '', page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    try {
        const searchPipeline = [
            { $match: { branch: branch } },
            {
                $lookup: {
                    from: "ingredientcategories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            {
                $unwind: {
                    path: "$categoryDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { sku: { $regex: search, $options: 'i' } },
                        { "categoryDetails.categoryName": { $regex: search, $options: 'i' } }
                    ]
                }
            }
        ];

        const dataPipeline = [
            ...searchPipeline,
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
                $project: {
                    name: 1,
                    category: "$categoryDetails",
                    unit: 1,
                    sku: 1,
                    stockAlert: 1,
                    branch: 1,
                    isActive: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ];

        const countPipeline = [...searchPipeline, { $count: 'total' }];

        const [result] = await Ingredient.aggregate([{ $facet: { data: dataPipeline, count: countPipeline } }]);
        
        const ingredients = result.data;
        const totalDocuments = result.count[0] ? result.count[0].total : 0;
        const totalPages = Math.ceil(totalDocuments / limitNum);

        res.status(200).json({
            data: ingredients,
            pagination: { totalDocuments, totalPages, currentPage: pageNum, limit: limitNum }
        });

    } catch (err) {
        res.status(500).send({ error: "Server error fetching ingredients: " + err.message });
    }
}
