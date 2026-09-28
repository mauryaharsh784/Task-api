const express = require('express');
const service = require('../services/taskService');

const router = express.Router();

router.get('/stats', (req, res) => res.json(service.getStats()));
router.get('/', (req, res) => res.json(service.getTasks(req.query)));
router.post('/', (req, res) => res.status(201).json(service.createTask(req.body)));
router.put('/:id', (req, res) => res.json(service.updateTask(req.params.id, req.body)));
router.delete('/:id', (req, res) => res.json(service.deleteTask(req.params.id)));
router.patch('/:id/complete', (req, res) => res.json(service.completeTask(req.params.id)));
router.patch('/:id/assign', (req, res) => res.json(service.assignTask(req.params.id, req.body)));

module.exports = router;
