const { Router } = require('express');
const healthController = require('../controllers/healthController');

const router = Router();

router.get('/', healthController.health);

module.exports = router;
