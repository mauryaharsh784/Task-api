const tasks = new Map();

module.exports = {
  all: () => Array.from(tasks.values()),
  get: (id) => tasks.get(id),
  set: (task) => { tasks.set(task.id, task); return task; },
  remove: (id) => tasks.delete(id),
  reset: () => tasks.clear(),
};
