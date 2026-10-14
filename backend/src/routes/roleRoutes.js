const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Get the roles available for employee records
router.get('/', async (req, res) => {
  try {
    const [roles] = await pool.query(
      'SELECT role_id, role_name, description FROM `role` ORDER BY role_name, role_id',
    );

    res.status(200).json(roles);
  } catch (error) {
    console.error('Role list error:', error.code);

    res.status(500).json({
      message: 'Unable to retrieve employee roles.',
    });
  }
});

// Create a new employee role
router.post('/', async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      message: 'Enter valid role details.',
    });
  }

  // Validate the role name
  if (typeof body.role_name !== 'string') {
    return res.status(400).json({
      message: 'Role name is required.',
    });
  }

  const roleName = body.role_name.trim();

  if (roleName.length < 2 || roleName.length > 50) {
    return res.status(400).json({
      message: 'Role name must contain 2 to 50 characters.',
    });
  }

  // Validate the optional description
  if (
    body.description !== undefined &&
    body.description !== null &&
    typeof body.description !== 'string'
  ) {
    return res.status(400).json({
      message: 'Description must be text.',
    });
  }

  const description =
    typeof body.description === 'string'
      ? body.description.trim() || null
      : null;

  if (description && description.length > 255) {
    return res.status(400).json({
      message: 'Description must not exceed 255 characters.',
    });
  }

  try {
    // Check whether a role with this name already exists
    const [existingRoles] = await pool.query(
      `SELECT role_id
       FROM \`role\`
       WHERE LOWER(TRIM(role_name)) = LOWER(?)
       LIMIT 1`,
      [roleName]
    );

    if (existingRoles.length > 0) {
      return res.status(409).json({
        message: 'A role with this name already exists.',
      });
    }

    // Save the role in MySQL
    const [result] = await pool.query(
      `INSERT INTO \`role\` (role_name, description)
       VALUES (?, ?)`,
      [roleName, description]
    );

    return res.status(201).json({
      role_id: result.insertId,
      role_name: roleName,
      description: description,
      message: 'Role created successfully.',
    });

  } catch (error) {
    console.error('Role creation error:', error.code);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'A role with this name already exists.',
      });
    }

    return res.status(500).json({
      message: 'Unable to create the role.',
    });
  }
});

// Update an existing employee role
router.put('/:id', async (req, res) => {
  const idText = req.params.id;
  const roleId = Number(idText);

  if (
    !/^[1-9]\d*$/.test(idText) ||
    !Number.isSafeInteger(roleId) ||
    roleId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Invalid role ID.',
    });
  }

  if (!req.body || typeof req.body.role_name !== 'string') {
    return res.status(400).json({
      message: 'Role name is required.',
    });
  }

  const roleName = req.body.role_name.trim();

  if (roleName.length < 2 || roleName.length > 50) {
    return res.status(400).json({
      message: 'Role name must contain 2 to 50 characters.',
    });
  }

  if (
    req.body.description != null &&
    typeof req.body.description !== 'string'
  ) {
    return res.status(400).json({
      message: 'Description must be text.',
    });
  }

  const description =
    typeof req.body.description === 'string'
      ? req.body.description.trim() || null
      : null;

  if (description && description.length > 255) {
    return res.status(400).json({
      message: 'Description must not exceed 255 characters.',
    });
  }

  try {
    const [current] = await pool.query(
      'SELECT role_name FROM `role` WHERE role_id = ?',
      [roleId]
    );

    if (current.length === 0) {
      return res.status(404).json({
        message: 'Role not found.',
      });
    }

    // Protect the management role used by authentication
    if (current[0].role_name === 'Owner/Manager') {
      return res.status(403).json({
        message: 'The Owner/Manager role cannot be edited.',
      });
    }

    if (roleName.toLowerCase() === 'owner/manager') {
      return res.status(400).json({
        message: 'This role name is reserved.',
      });
    }

    // Prevent duplicate role names
    const [duplicates] = await pool.query(
      `SELECT role_id FROM \`role\`
       WHERE LOWER(TRIM(role_name)) = LOWER(?)
       AND role_id <> ?`,
      [roleName, roleId]
    );

    if (duplicates.length > 0) {
      return res.status(409).json({
        message: 'A role with this name already exists.',
      });
    }

    // Do not rename roles already assigned to employees
    if (current[0].role_name !== roleName) {
      const [references] = await pool.query(
        'SELECT COUNT(*) AS total FROM employee WHERE role_id = ?',
        [roleId]
      );

      if (references[0].total > 0) {
        return res.status(409).json({
          message: 'This role is assigned to employees. Only its description can be changed.',
        });
      }
    }

    const [result] = await pool.query(
      `UPDATE \`role\`
       SET role_name = ?, description = ?
       WHERE role_id = ?`,
      [roleName, description, roleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Role not found.',
      });
    }

    return res.status(200).json({
      role_id: roleId,
      role_name: roleName,
      description,
      message: 'Role updated successfully.',
    });

  } catch (error) {
    console.error('Role update error:', error.code);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'A role with this name already exists.',
      });
    }

    return res.status(500).json({
      message: 'Unable to update the role.',
    });
  }
});

// Safely delete an employee role
router.delete('/:id', async (req, res) => {
  const idText = req.params.id;
  const roleId = Number(idText);

  if (
    !/^[1-9]\d*$/.test(idText) ||
    !Number.isSafeInteger(roleId) ||
    roleId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Invalid role ID.',
    });
  }

  try {
    // Check whether the role exists
    const [roles] = await pool.query(
      'SELECT role_name FROM `role` WHERE role_id = ?',
      [roleId]
    );

    if (roles.length === 0) {
      return res.status(404).json({
        message: 'Role not found.',
      });
    }

    // Protect the system management role
    if (roles[0].role_name.trim().toLowerCase() === 'owner/manager') {
      return res.status(403).json({
        message: 'The Owner/Manager role cannot be deleted.',
      });
    }

    // Check whether employees are using this role
    const [employees] = await pool.query(
      'SELECT COUNT(*) AS total FROM employee WHERE role_id = ?',
      [roleId]
    );

    if (employees[0].total > 0) {
      return res.status(409).json({
        message: 'This role is assigned to employees and cannot be deleted.',
      });
    }

    // Delete only an unused role
    const [result] = await pool.query(
      'DELETE FROM `role` WHERE role_id = ?',
      [roleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Role not found.',
      });
    }

    return res.status(200).json({
      message: 'Role deleted successfully.',
    });

  } catch (error) {
    console.error('Role deletion error:', error.code);

    // Also protect against changes made during the request
    if (
      error.code === 'ER_ROW_IS_REFERENCED_2' ||
      error.code === 'ER_ROW_IS_REFERENCED'
    ) {
      return res.status(409).json({
        message: 'This role is being used and cannot be deleted.',
      });
    }

    return res.status(500).json({
      message: 'Unable to delete the role.',
    });
  }
});
module.exports = router;