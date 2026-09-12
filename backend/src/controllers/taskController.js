const tasks = require('../models/taskModel');
const { validateTask } = require('../validation/taskValidation');
const { validateProgress } = require('../validation/taskProgressValidation');

exports.updateProgress = async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ message: 'Invalid task ID.' });
  const { errors, value } = validateProgress(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Check the progress details.', errors });
  const task = await tasks.updateProgress(Number(req.params.id), value);
  if (!task) return res.status(404).json({ message: 'Task not found. Refresh the task list.' });
  res.json({ task });
};

exports.listTasks = async (req, res) => res.json({ tasks: await tasks.list() });
exports.getOptions = async (req, res) => res.json(await tasks.options());
exports.getTask = async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ message: 'Invalid task ID.' });
  const task = await tasks.find(Number(req.params.id));
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.json({ task });
};
exports.createTask = async (req, res) => {
  const { errors, value } = validateTask(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Check the task details.', errors });
  const task = await tasks.create(value);
  res.status(201).location(`/api/tasks/${task.assignment_id}`).json({ task });
};
