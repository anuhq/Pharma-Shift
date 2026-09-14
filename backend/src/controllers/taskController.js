const tasks = require('../models/taskModel');
const { validateTask } = require('../validation/taskValidation');
const {
  validateProgress,
} = require('../validation/taskProgressValidation');

function validId(value) {
  return /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;
}

exports.listTasks = async (req, res) => {
  const taskList = await tasks.list(req.currentUser);
  return res.json({ tasks: taskList });
};

exports.getTask = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task ID.' });
  }

  const task = await tasks.find(
    Number(req.params.id),
    req.currentUser,
  );

  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  return res.json({ task });
};

exports.createTask = async (req, res) => {
  const { errors, value } = validateTask(req.body);

  if (Object.keys(errors).length) {
    return res.status(400).json({
      message: 'Check the task details.',
      errors,
    });
  }

  const task = await tasks.create(value);

  return res
    .status(201)
    .location(`/api/tasks/${task.assignment_id}`)
    .json({ task });
};

exports.updateProgress = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task ID.' });
  }

  const { errors, value } = validateProgress(req.body);

  if (Object.keys(errors).length) {
    return res.status(400).json({
      message: 'Check the progress details.',
      errors,
    });
  }

  const task = await tasks.updateProgress(
    Number(req.params.id),
    value,
    req.currentUser,
  );

  if (!task) {
    return res.status(404).json({
      message:
        'Task not found or you do not have permission to update it.',
    });
  }

  return res.json({ task });
};

exports.updateAssignee = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task ID.' });
  }

  const userId = req.body?.user_id;

  if (
    !Number.isInteger(userId) ||
    userId < 1 ||
    userId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Select a valid user.',
    });
  }

  const task = await tasks.updateAssignee(
    Number(req.params.id),
    userId,
  );

  if (!task) {
    return res.status(404).json({
      message: 'Task not found. Refresh the task list.',
    });
  }

  return res.json({ task });
};

exports.getOptions = async (req, res) => {
  return res.json(await tasks.options());
};

exports.getHandoverOptions = async (req, res) => {
  return res.json(await tasks.handoverOptions());
};