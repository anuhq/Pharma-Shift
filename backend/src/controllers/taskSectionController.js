const model = require('../models/taskSectionModel');
const { validateSection } = require('../validation/taskSectionValidation');

module.exports = function sectionController(section) {
  return {
    list: async (req, res) => res.json({ records: await model.list(section) }),
    find: async (req, res) => {
      if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ message: 'Invalid record ID.' });
      const record = await model.find(section, Number(req.params.id));
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      res.json({ record });
    },
    create: async (req, res) => {
      const { value, errors } = validateSection(section, req.body);
      if (Object.keys(errors).length) return res.status(400).json({ message: 'Check the form details.', errors });
      const record = await model.create(section, value);
      res.status(201).json({ record });
    },
  };
};
