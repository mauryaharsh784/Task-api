const { randomUUID } = require('crypto');
const store = require('../store/taskStore');
const {
  STATUSES, NotFoundError, ValidationError,
  validateTaskFields, parsePagination, validateAssignee,
} = require('../utils/validation');

function getOrThrow(id) {
  const task = store.get(id);
  if (!task) throw new NotFoundError();
  return task;
}

function createTask(body) {
  const fields = validateTaskFields(body);
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    title: fields.title,
    description: fields.description ?? '',
    status: fields.status ?? 'todo',
    priority: fields.priority ?? 'medium',
    dueDate: fields.dueDate ?? null,
    completedAt: null,
    createdAt: now,
  };
  if (task.status === 'done') task.completedAt = now;
  return store.set(task);
}

function getTasks(query = {}) {
  if (query.status !== undefined && !STATUSES.includes(query.status)) {
    throw new ValidationError(`status must be one of: ${STATUSES.join(', ')}`);
  }
  const { page, limit } = parsePagination(query);
  let list = store.all();
  if (query.status) list = list.filter((t) => t.status === query.status);
  const total = list.length;
  const start = (page - 1) * limit;
  return { tasks: list.slice(start, start + limit), page, limit, total, totalPages: Math.ceil(total / limit) };
}

function updateTask(id, body) {
  const task = getOrThrow(id);
  const fields = validateTaskFields(body, { partial: true });
  const updated = { ...task, ...fields };
  if (fields.status !== undefined && fields.status !== task.status) {
    updated.completedAt = fields.status === 'done' ? new Date().toISOString() : null;
  }
  return store.set(updated);
}

function deleteTask(id) {
  const task = getOrThrow(id);
  store.remove(id);
  return task;
}

function completeTask(id) {
  const task = getOrThrow(id);
  // Already completed: idempotent, keep original completedAt.
  if (task.status === 'done') return task;
  return store.set({ ...task, status: 'done', completedAt: new Date().toISOString() });
}

function assignTask(id, body) {
  const task = getOrThrow(id);
  const assignee = validateAssignee(body);
  // Reassignment is allowed: the new assignee simply replaces the old one.
  return store.set({ ...task, assignee });
}

function getStats(now = new Date()) {
  const stats = { todo: 0, in_progress: 0, done: 0, overdue: 0 };
  for (const t of store.all()) {
    stats[t.status] += 1;
    if (t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now) stats.overdue += 1;
  }
  return stats;
}

module.exports = { createTask, getTasks, updateTask, deleteTask, completeTask, assignTask, getStats };
