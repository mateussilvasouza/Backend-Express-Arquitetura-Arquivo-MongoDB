const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const { createStudentSchema } = require('../validation/studentSchema');
const studentController = require('../controllers/studentController');

const router = Router();

router.post('/', validate(createStudentSchema), asyncHandler(studentController.create));
router.get('/', asyncHandler(studentController.list));

module.exports = router;
