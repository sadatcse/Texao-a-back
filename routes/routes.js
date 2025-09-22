import { Router } from "express";

// Existing Imports
import AddonsRoutes from "../app/modules/Addons/Addonss.routes.js";
import CategoryRoutes from "../app/modules/Catagorie/Catagories.routes.js";
import CompanyRoutes from "../app/modules/Company/Companys.routes.js";
import CounterRoutes from "../app/modules/Counter/Counters.routes.js";
import departmentsRoutes from "../app/modules/Departments/Departments.routes.js";
import InvoiceRoutes from "../app/modules/Invoice/Invoices.routes.js";
import permissionRoutes from "../app/modules/Permission/permission.routes.js";
import ProductRoutes from "../app/modules/Product/Product.routes.js";
import userRoutes from "../app/modules/User/Users.routes.js";
import VATTypeRoutes from "../app/modules/Vattype/Vattypes.routes.js";
import UserlogRoutes from "../app/modules/UserLog/UserLog.routes.js";
import TableRoutes from "../app/modules/Table/Tables.routes.js";
import CustomerRoutes from "../app/modules/Customer/Customers.routes.js";
import TransactionLogRoutes from "../app/modules/TransactionLog/TransactionLog.routes.js";
import TableReservationRoutes from "../app/modules/TableReservation/TableReservation.routes.js";
import TableCombine from "../app/modules/TableCombine/tableStatus.js";
import RecipeRoutes from "../app/modules/Recipe/Recipe.routes.js"
import ReportRoutes from "../app/modules/Report/Report.routes.js";
import ExpenseRoutes from "../app/modules/Expense/Expense.routes.js";
import VendorRoutes from "../app/modules/Vendor/Vendor.routes.js";
import IngredientCategoryRoutes from "../app/modules/IngredientCategory/IngredientCategory.routes.js";
import IngredientRoutes from "../app/modules/Ingredient/Ingredient.routes.js";
import StockRoutes from "../app/modules/Stock/Stock.routes.js";
import PurchaseRoutes from "../app/modules/Purchase/Purchase.routes.js";
import ReviewRoutes from "../app/modules/Review/Review.routes.js"; 
import PredictionRoutes from "../app/modules/Prediction/Prediction.routes.js"; 
// Other Imports
import { getImageUrl } from "../config/space.js";
import { sendTestEmail } from "../controllers/emailController.js";
import transactionLogger from "../middleware/transactionLogger.js";
import { getSuperAdminDashboard } from "../controllers/dashboardController.js";
import { getAllBranches } from "../controllers/branchController.js";

const routes = Router();

// Middleware
routes.use(transactionLogger);

// Existing Routes
routes.use("/addons", AddonsRoutes);
routes.use("/category", CategoryRoutes);
routes.use("/company", CompanyRoutes);
routes.use("/counter", CounterRoutes);
routes.use("/departments", departmentsRoutes);
routes.use("/invoice", InvoiceRoutes);
routes.use("/permissions", permissionRoutes);
routes.use("/product", ProductRoutes);
routes.use("/user", userRoutes);
routes.use("/vattype", VATTypeRoutes);
routes.use("/userlog", UserlogRoutes);
routes.use("/table", TableRoutes);
routes.use("/customer", CustomerRoutes);
routes.use("/transaction-logs", TransactionLogRoutes);
routes.use("/reservation", TableReservationRoutes);
routes.use("/tablecombine", TableCombine);

// Inventory & Expense Routes
routes.use("/expense", ExpenseRoutes);
routes.use("/vendor", VendorRoutes);
routes.use("/ingredient-category", IngredientCategoryRoutes);
routes.use("/ingredient", IngredientRoutes);
routes.use("/stock", StockRoutes);
routes.use("/purchase", PurchaseRoutes);
routes.use("/reports", ReportRoutes);
routes.use("/recipes", RecipeRoutes);
routes.use("/review", ReviewRoutes);
routes.use("/prediction", PredictionRoutes);
// Other Routes
routes.post("/send-email", sendTestEmail);
routes.post("/get-image-url", getImageUrl);
routes.get("/superadmin/dashboard", getSuperAdminDashboard);
routes.get("/branch", getAllBranches);


export default routes;
