import Table from "../Table/Tables.model.js";
import Invoice from "../Invoice/Invoices.model.js";
import TableReservation from "../TableReservation/TableReservation.model.js";
import moment from "moment";

export const getTableStatusByBranch = async (req, res) => {
  try {
    const { branch } = req.params;
    const now = new Date();

    // Get all tables for this branch
    const tables = await Table.find({ branch });

    // Get today's dine-in invoices that are not completed or cancelled
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();

    const invoices = await Invoice.find({
      branch,
      orderType: "dine-in",
      orderStatus: { $nin: ["completed", "cancelled"] },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // Get active reservations for the current time
    const reservations = await TableReservation.find({
      branch,
      startTime: { $lte: now },
      endTime: { $gte: now },
      status: { $in: ["Pending", "Confirmed"] },
    }).populate("table");

    const result = tables.map((table) => {
      // Match reservation to this table
      const reservation = reservations.find(
        (r) => r.table?._id?.toString() === table._id.toString()
      );

      // Match invoice to this table
      const invoice = invoices.find(
        (i) => i.tableName?.toLowerCase() === table.tableName.toLowerCase()
      );

      let status = "free";
      let invoiceId = null;
      let reservationInfo = null;

      if (reservation) {
        status = "reserved";
        reservationInfo = {
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          customerEmail: reservation.customerEmail,
        };
      } else if (invoice) {
        status = invoice.orderStatus;
        invoiceId = invoice._id;
      }

      return {
        _id: table._id,
        tableName: table.tableName,
        branch: table.branch,
        status,
        invoiceId,
        reservation: reservationInfo,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching table status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};