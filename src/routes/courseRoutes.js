const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const courseController = require('../controllers/courseController');

const router = Router();

router.get('/', asyncHandler(courseController.list));

module.exports = router;
