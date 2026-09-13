const express = require('express');
const pool = require('../config/db');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireRole('Owner/Manager'));

function validateCategory(body) {
  if (
    typeof body?.category_name !== 'string' ||
    !body.category_name.trim() ||
    body.category_name.trim().length > 100
  ) {
    return 'Enter a category name between 1 and 100 characters.';
  }

  if (!['Low', 'Medium', 'High'].includes(body.severity_level)) {
    return 'Choose Low, Medium or High severity.';
  }

  if (
    body.description != null &&
    (typeof body.description !== 'string' ||
      body.description.trim().length > 255)
  ) {
    return 'Description must be 255 characters or fewer.';
  }

  return null;
}

// Read all categories
router.get('/', async (req, res) => {
  const [categories] = await pool.execute(
    `SELECT category_id, category_name, severity_level, description
     FROM incident_category
     ORDER BY category_name, category_id`
  );

  res.status(200).json({ categories });
});

// Create a category
router.post('/', async (req, res) => {
  const validationError = validateCategory(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const categoryName = req.body.category_name.trim();
  const severityLevel = req.body.severity_level;
  const description = req.body.description?.trim() || null;

  const [result] = await pool.execute(
    `INSERT INTO incident_category
      (category_name, severity_level, description)
     VALUES (?, ?, ?)`,
    [categoryName, severityLevel, description]
  );

  res.status(201).json({
    category: {
      category_id: result.insertId,
      category_name: categoryName,
      severity_level: severityLevel,
      description,
    },
  });
});

// Update a category
router.put('/:id', async (req, res) => {
  const categoryId = Number(req.params.id);

  if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
    return res.status(400).json({ message: 'Invalid category ID.' });
  }

  const validationError = validateCategory(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const categoryName = req.body.category_name.trim();
  const severityLevel = req.body.severity_level;
  const description = req.body.description?.trim() || null;

  await pool.execute(
    `UPDATE incident_category
     SET category_name = ?, severity_level = ?, description = ?
     WHERE category_id = ?`,
    [categoryName, severityLevel, description, categoryId]
  );

  const [rows] = await pool.execute(
    `SELECT category_id, category_name, severity_level, description
     FROM incident_category
     WHERE category_id = ?`,
    [categoryId]
  );

  if (!rows.length) {
    return res.status(404).json({ message: 'Category not found.' });
  }

  res.status(200).json({ category: rows[0] });
});

module.exports = router;