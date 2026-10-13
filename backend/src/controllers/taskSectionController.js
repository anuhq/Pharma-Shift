const model = require('../models/taskSectionModel');
const {
  validateSection,
  validateHandoverEdit,
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
        update: async (req, res) => {
      if (section !== 'templates' && section !== 'checklists') {
        return res.status(400).json({
          message: 'This record cannot be edited.',
        });
      }

      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid record ID.',
        });
      }

      const { value, errors } = validateSection(
        section,
        req.body
      );

      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          message: 'Check the form details.',
          errors,
        });
      }

      const record = await model.update(
        section,
        Number(req.params.id),
        value
      );

      return res.json({ record });
    },

    updateHandover: async (req, res) => {
      if (section !== 'handovers') {
        return res.status(400).json({
          message: 'This operation is only for handovers.',
        });
      }

      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid handover ID.',
        });
      }

      const { value, errors } = validateHandoverEdit(
        req.body,
        req.currentUser.employee_id
      );

      if (Object.keys(errors).length) {
        return res.status(400).json({
          message: 'Check the handover details.',
          errors,
        });
      }

      const record = await model.updateHandover(
        Number(req.params.id),
        value,
        req.currentUser
      );

      if (!record) {
        return res.status(404).json({
          message: 'Handover not found or access denied.',
        });
      }

      return res.json({ record });
    },

    completeHandover: async (req, res) => {
      if (section !== 'handovers') {
        return res.status(400).json({
          message: 'This operation is only for handovers.',
        });
      }

      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid handover ID.',
        });
      }

      const record = await model.completeHandover(
        Number(req.params.id),
        req.currentUser
      );

      if (!record) {
        return res.status(404).json({
          message: 'Handover not found or access denied.',
        });
      }

      return res.json({
        message: 'Handover completed successfully.',
        record,
      });
    },

    deactivate: async (req, res) => {
      if (!['templates', 'checklists'].includes(section)) {
        return res.status(400).json({
          message: 'This record cannot be deactivated.',
        });
      }

      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid record ID.',
        });
      }

      const record = await model.deactivate(
        section,
        Number(req.params.id)
      );

      return res.json({
        message: 'Record deactivated successfully.',
        record,
      });
    },
  };
};