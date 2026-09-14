const model = require('../models/taskSectionModel');
const {
  validateSection,
} = require('../validation/taskSectionValidation');

function validId(value) {
  return /^[1-9]\d*$/.test(value) &&
    Number(value) <= 2147483647;
}

module.exports = function sectionController(section) {
  return {
    list: async (req, res) => {
      const records = await model.list(section);
      return res.json({ records });
    },

    find: async (req, res) => {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid record ID.',
        });
      }

      const record = await model.find(
        section,
        Number(req.params.id),
      );

      if (!record) {
        return res.status(404).json({
          message: 'Record not found.',
        });
      }

      return res.json({ record });
    },

    create: async (req, res) => {
      let input = req.body;

      if (section === 'handovers') {
        input = {
          ...req.body,
          employee_id: req.currentUser.employee_id,
        };
      }

      const { value, errors } = validateSection(
        section,
        input,
      );

      if (Object.keys(errors).length) {
        return res.status(400).json({
          message: 'Check the form details.',
          errors,
        });
      }

      const record = await model.create(section, value);

      return res.status(201).json({ record });
    },
  };
};