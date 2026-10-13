const router = require('express').Router();

const controller = require('../controllers/taskController');
const sectionController = require('../controllers/taskSectionController');
const reportController = require('../controllers/taskReportController');
const { requireRole } = require('../middleware/authMiddleware');

const managerOnly = requireRole('Owner/Manager');

const templateHandlers = sectionController('templates');
const checklistHandlers = sectionController('checklists');
const handoverHandlers = sectionController('handovers');

// Templates: everyone can view; only managers can create.
router.get('/templates', templateHandlers.list);
router.get('/templates/:id', templateHandlers.find);
router.post('/templates', managerOnly, templateHandlers.create);
router.patch('/templates/:id', managerOnly, templateHandlers.update);
router.delete('/templates/:id', managerOnly, templateHandlers.deactivate);

// Checklists: everyone can view; only managers can create.
router.get('/checklists', checklistHandlers.list);
router.get('/checklists/:id', checklistHandlers.find);
router.post('/checklists', managerOnly, checklistHandlers.create);
router.patch('/checklists/:id', managerOnly, checklistHandlers.update);
router.delete('/checklists/:id', managerOnly, checklistHandlers.deactivate);

// Handovers: authenticated managers and staff can view and record them.
router.get('/handovers', handoverHandlers.list);
router.get('/handovers/:id', handoverHandlers.find);
router.post('/handovers', handoverHandlers.create);
router.patch('/handovers/:id', handoverHandlers.updateHandover);
router.patch('/handovers/:id/complete', handoverHandlers.completeHandover);

// Manager-only assignment information and actions.
router.get('/options', managerOnly, controller.getOptions);
router.get('/reports/summary', managerOnly, reportController.getSummary);
router.post('/', managerOnly, controller.createTask);
router.post('/:id/transfer', managerOnly, controller.transferAssignment);
router.patch('/:id/assignee', managerOnly, controller.updateAssignee);
router.patch('/:id', managerOnly, controller.updateAssignment);
router.patch('/:id/cancel', managerOnly, controller.cancelAssignment);

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