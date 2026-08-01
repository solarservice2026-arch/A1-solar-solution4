export class AppError extends Error {
  constructor(status, message, code, errors = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const success = (res, message, data, meta = {}) =>
  res.json({ success: true, message, data, meta });
