const router = require('express').Router();
const controller = require('../controllers/taskController');
const sectionController = require('../controllers/taskSectionController');

for (const section of ['templates', 'checklists', 'handovers']) {
  const handlers = sectionController(section);
  router.get(`/${section}`, handlers.list);
  router.get(`/${section}/:id`, handlers.find);
  router.post(`/${section}`, handlers.create);
}

router.get('/', controller.listTasks);
router.get('/options', controller.getOptions);
router.get('/:id', controller.getTask);
router.post('/', controller.createTask);

module.exports = router;
