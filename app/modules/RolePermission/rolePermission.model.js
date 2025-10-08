import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const rolePermissionSchema = new Schema({
    branch: { 
        type: String, 
        required: [true, "Branch is a required field."],
        trim: true 
    },
    role: { 
        type: String, 
        required: [true, "Role is a required field."],
        trim: true,
        uppercase: true // Ensures "Manager" and "manager" are treated as the same role
    },
    permissions: {
        type: Map,
        of: {
            view: { type: Boolean, default: false },
            add: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
        },
        default: {}
    },
}, { timestamps: true });


rolePermissionSchema.index({ role: 1, branch: 1 }, { unique: true });

const RolePermission = model('RolePermission', rolePermissionSchema);

export default RolePermission;
