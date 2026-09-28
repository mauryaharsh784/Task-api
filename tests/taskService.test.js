const store = require('../src/store/taskStore');
const service = require('../src/services/taskService');
const { ValidationError, NotFoundError } = require('../src/utils/validation');

beforeEach(() => store.reset());

const DAY = 24 * 60 * 60 * 1000;
const past = () => new Date(Date.now() - DAY).toISOString();
const future = () => new Date(Date.now() + DAY).toISOString();

describe('createTask', () => {
  test('applies defaults and generates id/createdAt', () => {
    const t = service.createTask({ title: 'A' });
    expect(t).toMatchObject({ title: 'A', description: '', status: 'todo', priority: 'medium', dueDate: null, completedAt: null });
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(t.createdAt).toISOString()).toBe(t.createdAt);
  });
  test('trims title', () => {
    expect(service.createTask({ title: '  Hi  ' }).title).toBe('Hi');
  });
  test.each([[{}], [{ title: '' }], [{ title: '   ' }], [{ title: 5 }], [null], [[]]])('rejects invalid body %j', (body) => {
    expect(() => service.createTask(body)).toThrow(ValidationError);
  });
  test('rejects invalid status, priority, description, dueDate', () => {
    expect(() => service.createTask({ title: 'a', status: 'x' })).toThrow(ValidationError);
    expect(() => service.createTask({ title: 'a', priority: 'urgent' })).toThrow(ValidationError);
    expect(() => service.createTask({ title: 'a', description: 3 })).toThrow(ValidationError);
    expect(() => service.createTask({ title: 'a', dueDate: 'garbage' })).toThrow(ValidationError);
  });
  test('accepts null and ISO dueDate', () => {
    expect(service.createTask({ title: 'a', dueDate: null }).dueDate).toBeNull();
    expect(service.createTask({ title: 'a', dueDate: '2026-10-01T10:00:00.000Z' }).dueDate).toBe('2026-10-01T10:00:00.000Z');
  });
  test('creating a task as done sets completedAt', () => {
    expect(service.createTask({ title: 'a', status: 'done' }).completedAt).not.toBeNull();
  });
});

describe('getTasks', () => {
  test('empty store', () => {
    expect(service.getTasks()).toEqual({ tasks: [], page: 1, limit: 10, total: 0, totalPages: 0 });
  });
  test('filters by status', () => {
    service.createTask({ title: 'a' });
    service.createTask({ title: 'b', status: 'in_progress' });
    const r = service.getTasks({ status: 'in_progress' });
    expect(r.total).toBe(1);
    expect(r.tasks[0].title).toBe('b');
  });
  test('rejects invalid status filter', () => {
    expect(() => service.getTasks({ status: 'nope' })).toThrow(ValidationError);
  });
  test('paginates', () => {
    for (let i = 0; i < 5; i++) service.createTask({ title: `t${i}` });
    const p2 = service.getTasks({ page: '2', limit: '2' });
    expect(p2.tasks.map((t) => t.title)).toEqual(['t2', 't3']);
    expect(p2.totalPages).toBe(3);
    expect(service.getTasks({ page: '9', limit: '2' }).tasks).toEqual([]);
  });
  test.each([['0'], ['-1'], ['abc'], ['1abc'], ['1.5']])('rejects invalid page %s', (page) => {
    expect(() => service.getTasks({ page })).toThrow(ValidationError);
  });
  test.each([['0'], ['101'], ['x'], ['5.5'], ['10abc']])('rejects invalid limit %s', (limit) => {
    expect(() => service.getTasks({ limit })).toThrow(ValidationError);
  });
});

describe('updateTask', () => {
  test('partial update keeps other fields', () => {
    const t = service.createTask({ title: 'a', description: 'd', priority: 'high', dueDate: future() });
    const u = service.updateTask(t.id, { title: 'b' });
    expect(u).toMatchObject({ title: 'b', description: 'd', priority: 'high', dueDate: t.dueDate, id: t.id, createdAt: t.createdAt });
  });
  test('status to done sets completedAt; away from done clears it', () => {
    const t = service.createTask({ title: 'a' });
    const done = service.updateTask(t.id, { status: 'done' });
    expect(done.completedAt).not.toBeNull();
    const reopened = service.updateTask(t.id, { status: 'in_progress' });
    expect(reopened.completedAt).toBeNull();
  });
  test('can clear dueDate with null', () => {
    const t = service.createTask({ title: 'a', dueDate: future() });
    expect(service.updateTask(t.id, { dueDate: null }).dueDate).toBeNull();
  });
  test('cannot overwrite id/createdAt/completedAt via body', () => {
    const t = service.createTask({ title: 'a' });
    const u = service.updateTask(t.id, { id: 'x', createdAt: 'x', completedAt: 'x' });
    expect(u.id).toBe(t.id);
    expect(u.createdAt).toBe(t.createdAt);
    expect(u.completedAt).toBeNull();
  });
  test('404 and validation errors', () => {
    expect(() => service.updateTask('nope', { title: 'a' })).toThrow(NotFoundError);
    const t = service.createTask({ title: 'a' });
    expect(() => service.updateTask(t.id, { title: '  ' })).toThrow(ValidationError);
    expect(() => service.updateTask(t.id, { status: 'bad' })).toThrow(ValidationError);
  });
});

describe('deleteTask', () => {
  test('deletes and returns task', () => {
    const t = service.createTask({ title: 'a' });
    expect(service.deleteTask(t.id)).toEqual(t);
    expect(service.getTasks().total).toBe(0);
  });
  test('404 for unknown id', () => {
    expect(() => service.deleteTask('nope')).toThrow(NotFoundError);
  });
});

describe('completeTask', () => {
  test('marks done with completedAt', () => {
    const t = service.createTask({ title: 'a' });
    const c = service.completeTask(t.id);
    expect(c.status).toBe('done');
    expect(c.completedAt).not.toBeNull();
  });
  test('already completed is idempotent', () => {
    const t = service.createTask({ title: 'a' });
    const first = service.completeTask(t.id);
    const second = service.completeTask(t.id);
    expect(second.completedAt).toBe(first.completedAt);
  });
  test('404 for unknown id', () => {
    expect(() => service.completeTask('nope')).toThrow(NotFoundError);
  });
});

describe('assignTask', () => {
  test('assigns, trims, and allows reassignment', () => {
    const t = service.createTask({ title: 'a' });
    expect(service.assignTask(t.id, { assignee: '  Rahul ' }).assignee).toBe('Rahul');
    expect(service.assignTask(t.id, { assignee: 'Harsh' }).assignee).toBe('Harsh');
  });
  test.each([[{}], [{ assignee: '' }], [{ assignee: '  ' }], [{ assignee: 5 }], [undefined]])('rejects %j', (body) => {
    const t = service.createTask({ title: 'a' });
    expect(() => service.assignTask(t.id, body)).toThrow(ValidationError);
  });
  test('404 for unknown id', () => {
    expect(() => service.assignTask('nope', { assignee: 'x' })).toThrow(NotFoundError);
  });
});

describe('getStats', () => {
  test('empty store', () => {
    expect(service.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
  test('counts statuses and overdue; done tasks are never overdue', () => {
    service.createTask({ title: 'a', dueDate: past() });
    service.createTask({ title: 'b', status: 'in_progress', dueDate: past() });
    service.createTask({ title: 'c', status: 'done', dueDate: past() });
    service.createTask({ title: 'd', dueDate: future() });
    service.createTask({ title: 'e' });
    expect(service.getStats()).toEqual({ todo: 3, in_progress: 1, done: 1, overdue: 2 });
  });
  test('accepts an injected clock', () => {
    service.createTask({ title: 'a', dueDate: '2026-01-01T00:00:00.000Z' });
    expect(service.getStats(new Date('2025-12-31T00:00:00Z')).overdue).toBe(0);
    expect(service.getStats(new Date('2026-01-02T00:00:00Z')).overdue).toBe(1);
  });
});

describe('regression: lenient parsing (see BUG_REPORT.md)', () => {
  test.each(['1', '2026', 'Oct 1', '2026-13-45', '2026-02-31T00:00:00Z'])('createTask rejects non-ISO / impossible dueDate %s', (dueDate) => {
    expect(() => service.createTask({ title: 'a', dueDate })).toThrow(ValidationError);
  });
  test('updateTask rejects non-ISO dueDate', () => {
    const t = service.createTask({ title: 'a' });
    expect(() => service.updateTask(t.id, { dueDate: '1' })).toThrow(ValidationError);
  });
  test('date-only ISO string is accepted', () => {
    expect(service.createTask({ title: 'a', dueDate: '2026-10-01' }).dueDate).toBe('2026-10-01T00:00:00.000Z');
  });
  test('page/limit strictness', () => {
    expect(() => service.getTasks({ page: '1abc' })).toThrow(ValidationError);
    expect(() => service.getTasks({ limit: '5.5' })).toThrow(ValidationError);
    expect(service.getTasks({ page: '1', limit: '100' }).limit).toBe(100);
  });
});
