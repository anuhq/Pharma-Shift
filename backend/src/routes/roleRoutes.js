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

module.exports = router;