const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const validate = require('../middlewares/validate');
const {
  createEnrollmentSchema,
  listEnrollmentsSchema,
} = require('../validation/enrollmentSchema');
const enrollmentController = require('../controllers/enrollmentController');

const router = Router();

router.post('/', validate(createEnrollmentSchema), asyncHandler(enrollmentController.create));
router.get('/', validate(listEnrollmentsSchema, 'query'), asyncHandler(enrollmentController.list));
router.patch('/:id/cancel', asyncHandler(enrollmentController.cancel));

module.exports = router;
