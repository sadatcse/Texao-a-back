import Company from "./Companys.model.js";

// Get all companies
export async function getAllCompanies(req, res) {
  try {
    const result = await Company.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getSuperAdminCompanies(req, res) {
  try {
    const { 
        page = 1, 
        limit = 10, 
        search = ''
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // --- Build Filter Query ---
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { branch: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    // --- Execute Queries ---
    const [companies, totalCompanies] = await Promise.all([
        Company.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Company.countDocuments(query)
    ]);
      
    res.status(200).json({
      data: companies,
      pagination: {
        totalDocuments: totalCompanies,
        totalPages: Math.ceil(totalCompanies / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });

  } catch (err) {
    res.status(500).send({ error: "Server error fetching company data: " + err.message });
  }
}
export async function getCompanyById(req, res) {
  const id = req.params.id;
  try {
    const result = await Company.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Company not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export const getCompaniesByBranch = async (req, res) => {
  const { branch } = req.params;
  try {
    const companies = await Company.find({ branch });
    res.status(200).json(companies);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch companies", error: err.message });
  }
};

// Create a new company
export async function createCompany(req, res) {
  try {
    const companyData = req.body;
    const result = await Company.create(companyData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a company by ID
export async function updateCompany(req, res) {
  const id = req.params.id;
  const companyData = req.body;
  try {
    const result = await Company.findByIdAndUpdate(id, companyData, {
      new: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Company not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove a company by ID
export async function removeCompany(req, res) {
  const id = req.params.id;
  try {
    const result = await Company.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Company deleted successfully" });
    } else {
      res.status(404).json({ message: "Company not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
