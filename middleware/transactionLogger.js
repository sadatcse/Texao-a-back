import TransactionLog from "./../app/modules/TransactionLog/TransactionLog.model.js";

// You no longer need uuidv4 here since the model generates its own logId
export default async function transactionLogger(req, res, next) {
  try {
    if (req.method === "GET") {
      return next();
    }

    const clientIP = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "Unknown IP";

    const logData = {
      transactionType: req.method,
      userEmail: req.headers["x-user-email"] || "Unknown User",
      userName: req.headers["x-user-name"] || "Unknown User",
      branch: req.headers["x-user-branch"] || "Unknown Branch",
      ipAddress: clientIP,
      status: "pending", // Start as pending
      amount: req.body.amount || 0,
      details: `Request to ${req.originalUrl}`,
      transactionTime: new Date(),
    };

    const originalSend = res.send;
    res.send = async function (body) {
      try {
        // Set final status based on the response code
        logData.status = res.statusCode >= 400 ? "failed" : "success";
        logData.transactionCode = res.statusCode.toString();
        logData.message = typeof body === "string" ? body : JSON.stringify(body);
        
        await TransactionLog.create(logData);
      
      } catch (error) {
        console.error("Error logging transaction:", error);
      }
      originalSend.apply(res, arguments);
    };

    next();
  } catch (error) {
    console.error("Middleware main catch block error:", error);
    // You might want a fallback logger here if the main one fails
    next(error); // Pass the error to the next error handler
  }
}