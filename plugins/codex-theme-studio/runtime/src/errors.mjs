export class CtsError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'CtsError';
    this.code = code;
    this.details = details;
  }
}

export function fail(code, message, details) {
  throw new CtsError(code, message, details);
}

