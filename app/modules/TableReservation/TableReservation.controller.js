
import TableReservation from "../TableReservation/TableReservation.model.js";
import Table from "../Table/Tables.model.js"; 

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const createReservation = asyncHandler(async (req, res) => {
  const { table, startTime, endTime, customerName, customerPhone, customerEmail, additionalInfo, branch } = req.body;

 
  const bookedBy = req.user.id; 


  if (!table || !startTime || !endTime || !customerName || !customerPhone || !branch || !bookedBy) {
    return res.status(400).json({ message: "Please fill all required fields: table, startTime, endTime, customerName, customerPhone, branch, bookedBy." });
  }


  const existingTable = await Table.findById(table);
  if (!existingTable) {
    return res.status(404).json({ message: "Table not found." });
  }

  // Convert times to Date objects
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Validate time logic
  if (start >= end) {
    return res.status(400).json({ message: "End time must be after start time." });
  }

  // Check for overlapping reservations for the same table
  // This query checks if any existing reservation overlaps with the new one's time slot
  const overlappingReservation = await TableReservation.findOne({
    table,
    $or: [
      { startTime: { $lt: end, $gte: start } }, // Existing reservation starts within new reservation
      { endTime: { $gt: start, $lte: end } },   // Existing reservation ends within new reservation
      { startTime: { $lte: start }, endTime: { $gte: end } } // New reservation fully encompasses an existing one
    ],
    status: { $in: ["Pending", "Confirmed"] } // Only consider active reservations
  });

  if (overlappingReservation) {
    return res.status(409).json({ message: "This table is already reserved for the specified time slot." });
  }

  const newReservation = await TableReservation.create({
    table,
    startTime: start,
    endTime: end,
    customerName,
    customerPhone,
    customerEmail,
    additionalInfo,
    branch,
    bookedBy,
    status: "Pending", // Default status for new reservations
  });

  res.status(201).json(newReservation);
});

// @desc    Get all table reservations (can be filtered by branch in frontend)
// @route   GET /api/table-reservation
// @access  Private (authenticated user) - Though the route is public in the user's provided code, it should ideally be protected.
export const getAllReservations = asyncHandler(async (req, res) => {
  // Populating 'table' to get tableName and 'bookedBy' to get user info (e.g., name, email)
  const reservations = await TableReservation.find().populate("table").populate("bookedBy", "name email");
  res.status(200).json(reservations);
});

// @desc    Get table reservations by branch
// @route   GET /api/table-reservation/branch/:branch
// @access  Private (authenticated user)
export const getReservationsByBranch = asyncHandler(async (req, res) => {
  const { branch } = req.params;
  const reservations = await TableReservation.find({ branch }).populate("table").populate("bookedBy", "name email");
  res.status(200).json(reservations);
});

// @desc    Get a single table reservation by ID
// @route   GET /api/table-reservation/get-id/:id
// @access  Private (authenticated user)
export const getReservationById = asyncHandler(async (req, res) => {
  const reservation = await TableReservation.findById(req.params.id).populate("table").populate("bookedBy", "name email");
  if (!reservation) {
    return res.status(404).json({ message: "Reservation not found" });
  }
  res.status(200).json(reservation);
});

// @desc    Update a table reservation
// @route   PUT /api/table-reservation/update/:id
// @access  Private (authenticated user)
export const updateReservation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { table, startTime, endTime, customerName, customerPhone, customerEmail, additionalInfo, branch, status } = req.body;

  // Ensure bookedBy is set from the authenticated user if it's being updated, or keep old one
  const bookedBy = req.user.id; // Assuming req.user.id is set by authenticateToken middleware

  // Basic validation
  if (!table || !startTime || !endTime || !customerName || !customerPhone || !branch || !bookedBy) {
    return res.status(400).json({ message: "Please fill all required fields: table, startTime, endTime, customerName, customerPhone, branch, bookedBy." });
  }

  // Check if the table exists
  const existingTable = await Table.findById(table);
  if (!existingTable) {
    return res.status(404).json({ message: "Table not found." });
  }

  // Convert times to Date objects
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Validate time logic
  if (start >= end) {
    return res.status(400).json({ message: "End time must be after start time." });
  }

  // Check for overlapping reservations for the same table, excluding the current reservation being updated
  const overlappingReservation = await TableReservation.findOne({
    _id: { $ne: id }, // Exclude the current reservation being updated
    table,
    $or: [
      { startTime: { $lt: end, $gte: start } },
      { endTime: { $gt: start, $lte: end } },
      { startTime: { $lte: start }, endTime: { $gte: end } }
    ],
    status: { $in: ["Pending", "Confirmed"] } // Only consider active reservations
  });

  if (overlappingReservation) {
    return res.status(409).json({ message: "This table is already reserved for the specified time slot by another booking." });
  }

  const updatedReservation = await TableReservation.findByIdAndUpdate(
    id,
    {
      table,
      startTime: start,
      endTime: end,
      customerName,
      customerPhone,
      customerEmail,
      additionalInfo,
      branch,
      status, // Allow status update
      bookedBy // Update bookedBy if needed, or keep original
    },
    { new: true, runValidators: true } // 'new: true' returns the updated document, 'runValidators: true' runs schema validators
  ).populate("table").populate("bookedBy", "name email");

  if (!updatedReservation) {
    return res.status(404).json({ message: "Reservation not found" });
  }
  res.status(200).json(updatedReservation);
});

// @desc    Remove a table reservation
// @route   DELETE /api/table-reservation/delete/:id
// @access  Private (authenticated user)
export const removeReservation = asyncHandler(async (req, res) => {
  const reservation = await TableReservation.findByIdAndDelete(req.params.id);
  if (!reservation) {
    return res.status(404).json({ message: "Reservation not found" });
  }
  res.status(200).json({ message: "Reservation removed successfully" });
});
