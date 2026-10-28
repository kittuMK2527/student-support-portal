export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}
export const notFound = (what = 'Not found') => new ApiError(404, what);
export const forbidden = (what = 'You do not have access to this') => new ApiError(403, what);
export const unauthorized = () => new ApiError(401, 'Please log in');
