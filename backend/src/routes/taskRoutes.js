const router = require('express').Router();

const controller = require('../controllers/taskController');
const sectionController = require('../controllers/taskSectionController');
const { requireRole } = require('../middleware/authMiddleware');

const managerOnly = requireRole('Owner/Manager');

const templateHandlers = sectionController('templates');
const checklistHandlers = sectionController('checklists');
const handoverHandlers = sectionController('handovers');

// Templates: everyone can view; only managers can create.
router.get('/templates', templateHandlers.list);
router.get('/templates/:id', templateHandlers.find);
router.post('/templates', managerOnly, templateHandlers.create);

// Checklists: everyone can view; only managers can create.
router.get('/checklists', checklistHandlers.list);
router.get('/checklists/:id', checklistHandlers.find);
router.post('/checklists', managerOnly, checklistHandlers.create);

// Handovers: authenticated managers and staff can view and record them.
router.get('/handovers', handoverHandlers.list);
router.get('/handovers/:id', handoverHandlers.find);
router.post('/handovers', handoverHandlers.create);

// Manager-only assignment information and actions.
router.get('/options', managerOnly, controller.getOptions);
router.post('/', managerOnly, controller.createTask);
router.patch('/:id/assignee', managerOnly, controller.updateAssignee);

// Managers and staff can use these routes.
// Ownership checks will be added in the controller and model.
router.get('/', controller.listTasks);
router.get(
  '/handover-options',
  controller.getHandoverOptions,
);
router.get('/:id', controller.getTask);
router.patch('/:id/progress', controller.updateProgress);

module.exports = router;