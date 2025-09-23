import { Router } from "express";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  removeCompany,
  getSuperAdminCompanies,
  getCompaniesByBranch,
} from "./Companys.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 

const CompanyRoutes = Router();

// Protect all routes with authentication middleware
CompanyRoutes.get("/", authenticateToken, getAllCompanies);
CompanyRoutes.get("/get-id/:id", authenticateToken, getCompanyById);
CompanyRoutes.post("/post", authenticateToken, createCompany);
CompanyRoutes.put("/update/:id", authenticateToken, updateCompany);
CompanyRoutes.delete("/delete/:id", authenticateToken, removeCompany);
CompanyRoutes.get("/branch/:branch", authenticateToken, getCompaniesByBranch);
CompanyRoutes.get("/superadmin/all", authenticateToken, /* adminOnly, */ getSuperAdminCompanies);

export default CompanyRoutes;
