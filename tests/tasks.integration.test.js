const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store/taskStore');

beforeEach(() => store.reset());

const DAY = 24 * 60 * 60 * 1000;
const past = () => new Date(Date.now() - DAY).toISOString();
const future = () => new Date(Date.now() + DAY).toISOString();
const create = async (body = { title: 'T' }) => (await request(app).post('/tasks').send(body)).body;

describe('GET /tasks', () => {
  test('empty list', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tasks: [], page: 1, limit: 10, total: 0, totalPages: 0 });
  });
  test('multiple tasks', async () => {
    await create({ title: 'a' });
    await create({ title: 'b' });
    const res = await request(app).get('/tasks');
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });
  test('status filtering', async () => {
    await create({ title: 'a' });
    await create({ title: 'b', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body.tasks.map((t) => t.title)).toEqual(['b']);
    expect((await request(app).get('/tasks?status=bogus')).status).toBe(400);
  });
  test('pagination', async () => {
    for (let i = 0; i < 3; i++) await create({ title: `t${i}` });
    const res = await request(app).get('/tasks?page=2&limit=2');
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.tasks).toHaveLength(1);
  });
  test.each(['page=0', 'page=-1', 'page=abc', 'page=1abc'])('invalid page: %s', async (q) => {
    const res = await request(app).get(`/tasks?${q}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
  test.each(['limit=0', 'limit=101', 'limit=abc', 'limit=5.5'])('invalid limit: %s', async (q) => {
    expect((await request(app).get(`/tasks?${q}`)).status).toBe(400);
  });
});

describe('POST /tasks', () => {
  test('valid creation with all fields', async () => {
    const res = await request(app).post('/tasks').send({
      title: 'Learn Node.js', description: 'Study Express', status: 'in_progress', priority: 'high', dueDate: '2026-10-01T10:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Learn Node.js', description: 'Study Express', status: 'in_progress', priority: 'high', dueDate: '2026-10-01T10:00:00.000Z', completedAt: null });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });
  test('defaults and title trimming', async () => {
    const res = await request(app).post('/tasks').send({ title: '  Hello ' });
    expect(res.body).toMatchObject({ title: 'Hello', description: '', status: 'todo', priority: 'medium', dueDate: null, completedAt: null });
  });
  test.each([[{}], [{ title: '' }], [{ title: '   ' }], [{ title: 1 }]])('invalid title %j', async (body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
  test('invalid status / priority / dueDate', async () => {
    expect((await request(app).post('/tasks').send({ title: 'a', status: 'x' })).status).toBe(400);
    expect((await request(app).post('/tasks').send({ title: 'a', priority: 'x' })).status).toBe(400);
    expect((await request(app).post('/tasks').send({ title: 'a', dueDate: 'not-a-date' })).status).toBe(400);
  });
  test.each(['1', '2026', 'Oct 1', 12345, true])('rejects non-ISO dueDate %j', async (dueDate) => {
    const res = await request(app).post('/tasks').send({ title: 'a', dueDate });
    expect(res.status).toBe(400);
  });
  test('valid and null dueDate', async () => {
    expect((await request(app).post('/tasks').send({ title: 'a', dueDate: future() })).status).toBe(201);
    expect((await request(app).post('/tasks').send({ title: 'a', dueDate: null })).status).toBe(201);
  });
  test('malformed JSON returns 400', async () => {
    const res = await request(app).post('/tasks').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });
});

describe('PUT /tasks/:id', () => {
  test('successful update', async () => {
    const t = await create({ title: 'a' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'b', priority: 'low' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'b', priority: 'low' });
  });
  test('partial update keeps other fields', async () => {
    const t = await create({ title: 'a', description: 'keep', priority: 'high' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ status: 'in_progress' });
    expect(res.body).toMatchObject({ title: 'a', description: 'keep', priority: 'high', status: 'in_progress' });
  });
  test('404 for unknown task', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Task not found' });
  });
  test('invalid fields', async () => {
    const t = await create();
    expect((await request(app).put(`/tasks/${t.id}`).send({ title: ' ' })).status).toBe(400);
    expect((await request(app).put(`/tasks/${t.id}`).send({ status: 'x' })).status).toBe(400);
    expect((await request(app).put(`/tasks/${t.id}`).send({ priority: 'x' })).status).toBe(400);
    expect((await request(app).put(`/tasks/${t.id}`).send({ dueDate: 'x' })).status).toBe(400);
  });
  test('reopening a done task clears completedAt', async () => {
    const t = await create();
    await request(app).patch(`/tasks/${t.id}/complete`);
    const res = await request(app).put(`/tasks/${t.id}`).send({ status: 'todo' });
    expect(res.body.completedAt).toBeNull();
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes task', async () => {
    const t = await create();
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(t.id);
    expect((await request(app).get('/tasks')).body.total).toBe(0);
  });
  test('404 for unknown task', async () => {
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('completes task', async () => {
    const t = await create();
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(new Date(res.body.completedAt).toISOString()).toBe(res.body.completedAt);
  });
  test('404 for unknown task', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });
  test('already completed keeps original completedAt', async () => {
    const t = await create();
    const first = await request(app).patch(`/tasks/${t.id}/complete`);
    const second = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(second.status).toBe(200);
    expect(second.body.completedAt).toBe(first.body.completedAt);
  });
});

describe('GET /tasks/stats', () => {
  test('empty store', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
  test('status and overdue counts', async () => {
    await create({ title: 'a', dueDate: past() });
    await create({ title: 'b', status: 'in_progress' });
    await create({ title: 'c', status: 'done' });
    await create({ title: 'd', dueDate: future() });
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 1 });
  });
  test('completed overdue task is not overdue', async () => {
    const t = await create({ title: 'a', dueDate: past() });
    expect((await request(app).get('/tasks/stats')).body.overdue).toBe(1);
    await request(app).patch(`/tasks/${t.id}/complete`);
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toMatchObject({ done: 1, overdue: 0 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns and trims', async () => {
    const t = await create();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: '  Harsh  ' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Harsh');
    expect(res.body.id).toBe(t.id);
  });
  test.each([[{}], [{ assignee: '' }], [{ assignee: '   ' }], [{ assignee: 42 }], [{ assignee: null }], [{ assignee: ['a'] }]])('rejects %j', async (body) => {
    const t = await create();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send(body);
    expect(res.status).toBe(400);
  });
  test('rejects missing body', async () => {
    const t = await create();
    expect((await request(app).patch(`/tasks/${t.id}/assign`)).status).toBe(400);
  });
  test('404 for unknown task', async () => {
    expect((await request(app).patch('/tasks/nope/assign').send({ assignee: 'x' })).status).toBe(404);
  });
  test('reassignment allowed', async () => {
    const t = await create();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Rahul' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Harsh' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Harsh');
  });
});

describe('misc', () => {
  test('unknown route -> 404 JSON', async () => {
    const res = await request(app).get('/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
  test('unexpected errors -> 500 without stack trace', async () => {
    const spy = jest.spyOn(store, 'all').mockImplementation(() => { throw new Error('boom'); });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
