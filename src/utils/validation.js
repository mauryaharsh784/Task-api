const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const MAX_LIMIT = 100;
// Strict ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm[:ss[.sss]] with optional Z / +hh:mm offset.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const INT_RE = /^\d+$/;

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  // Reject impossible calendar days (e.g. Feb 31) that Date would silently roll over.
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const cal = new Date(Date.UTC(y, m - 1, d));
  if (cal.getUTCFullYear() !== y || cal.getUTCMonth() !== m - 1 || cal.getUTCDate() !== d) return false;
  return !isNaN(new Date(value).getTime());
}

class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; this.status = 400; }
}
class NotFoundError extends Error {
  constructor(message = 'Task not found') { super(message); this.name = 'NotFoundError'; this.status = 404; }
}

function validateTaskFields(body, { partial = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const out = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      throw new ValidationError('title is required and must be a non-empty string');
    }
    out.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') throw new ValidationError('description must be a string');
    out.description = body.description;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new ValidationError(`status must be one of: ${STATUSES.join(', ')}`);
    out.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) throw new ValidationError(`priority must be one of: ${PRIORITIES.join(', ')}`);
    out.priority = body.priority;
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null) out.dueDate = null;
    else if (isValidIsoDate(body.dueDate)) {
      out.dueDate = new Date(body.dueDate).toISOString();
    } else throw new ValidationError('dueDate must be null or a valid ISO date string');
  }
  return out;
}

function parsePagination(query) {
  let page = 1;
  let limit = 10;
  if (query.page !== undefined) {
    page = INT_RE.test(String(query.page)) ? parseInt(query.page, 10) : NaN;
    if (!Number.isInteger(page) || page < 1) throw new ValidationError('page must be a positive integer');
  }
  if (query.limit !== undefined) {
    limit = INT_RE.test(String(query.limit)) ? parseInt(query.limit, 10) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`);
    }
  }
  return { page, limit };
}

function validateAssignee(body) {
  if (!body || typeof body.assignee !== 'string' || body.assignee.trim() === '') {
    throw new ValidationError('assignee is required and must be a non-empty string');
  }
  return body.assignee.trim();
}

module.exports = { STATUSES, PRIORITIES, MAX_LIMIT, ValidationError, NotFoundError, validateTaskFields, parsePagination, validateAssignee };
