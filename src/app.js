const express = require('express');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
app.use(express.json());
app.use('/tasks', taskRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
