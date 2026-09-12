const router = require('express').Router();
const controller = require('../controllers/taskController');

router.get('/', controller.listTasks);
router.get('/options', controller.getOptions);
router.get('/:id', controller.getTask);
router.post('/', controller.createTask);

module.exports = router;
