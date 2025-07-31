import { Router } from "express";

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
import { getImageUrl } from "../config/space.js";
import TableRoutes from "../app/modules/Table/Tables.routes.js";
import CustomerRoutes from "../app/modules/Customer/Customers.routes.js";
import { sendTestEmail } from "../controllers/emailController.js";

import TransactionLogRoutes from "../app/modules/TransactionLog/TransactionLog.routes.js";
import transactionLogger from "../middleware/transactionLogger.js";
import { getSuperAdminDashboard } from "../controllers/dashboardController.js"; 
import { getAllBranches } from "../controllers/branchController.js";
import TableReservationRoutes from "../app/modules/TableReservation/TableReservation.routes.js";
import TableCombine from "../app/modules/TableCombine/tableStatus.js";


const routes = Router();

routes.use(transactionLogger);
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
routes.post("/send-email", sendTestEmail);
routes.post("/get-image-url", getImageUrl);
routes.use("/transaction-logs", TransactionLogRoutes);
routes.get("/superadmin/dashboard", getSuperAdminDashboard);
routes.get("/branch", getAllBranches);
routes.use("/reservation", TableReservationRoutes);
routes.use("/tablecombine", TableCombine);
export default routes;
