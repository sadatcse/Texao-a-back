import express from 'express';
import {
  createOrUpdatePermission,
  getPermission,
  getAllPermissions,
  deletePermission,
} from './rolePermission.controller.js';

// You might want to add middleware here for authentication (e.g., checking JWT)
// import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route to create or update a permission set
// e.g., POST to /api/permissions
router.post('/', createOrUpdatePermission);

// Route to get a specific permission set using query parameters
// e.g., GET to /api/permissions?role=MANAGER&branch=Main%20Branch
router.get('/', getPermission);

// Route to get all permission sets
// e.g., GET to /api/permissions/all
router.get('/all', getAllPermissions);

// Route to delete a specific permission set
// e.g., DELETE to /api/permissions
router.delete('/', deletePermission);

export default router;
