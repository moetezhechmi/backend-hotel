const express = require('express');
const router = express.Router();
const { orderController, serviceController, notificationController } = require('../controllers/clientController');

router.post('/commandes', orderController.create);
router.post('/demandes', serviceController.create);
router.get('/notifications', notificationController.getAll);
router.post('/notifications/subscribe', notificationController.subscribe);

module.exports = router;
