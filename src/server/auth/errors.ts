import { AuthorizationContextErrorCode } from '@/types/authorization.types';

export class AuthorizationContextError extends Error {
  public readonly code: AuthorizationContextErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: AuthorizationContextErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthorizationContextError';
    this.code = code;
    this.details = details;

    switch (code) {
      case 'UNAUTHENTICATED':
        this.statusCode = 401;
        break;
      case 'NO_ACTIVE_MEMBERSHIP':
      case 'MEMBERSHIP_INACTIVE':
      case 'TENANT_MISMATCH':
      case 'BRANCH_ACCESS_DENIED':
      case 'PERMISSION_DENIED':
      case 'OUTSIDE_SCOPE':
      case 'EXPLICIT_DENY':
        this.statusCode = 403;
        break;
      case 'RESOURCE_NOT_FOUND':
        this.statusCode = 404;
        break;
      case 'INVALID_RESOURCE_TYPE':
      default:
        this.statusCode = 400;
        break;
    }

    Object.setPrototypeOf(this, AuthorizationContextError.prototype);
  }
}
