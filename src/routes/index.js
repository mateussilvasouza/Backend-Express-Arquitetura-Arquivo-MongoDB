const { Router } = require('express');
const healthRoutes = require('./healthRoutes');
const courseRoutes = require('./courseRoutes');
const studentRoutes = require('./studentRoutes');
const enrollmentRoutes = require('./enrollmentRoutes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/courses', courseRoutes);
router.use('/students', studentRoutes);
router.use('/enrollments', enrollmentRoutes);

module.exports = router;
