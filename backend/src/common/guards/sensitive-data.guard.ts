import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Guard that inspects request payloads for prohibited sensitive data
 * (PAN, CVV, card_number, security_code)
 */
@Injectable()
export class SensitiveDataGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return true;
    }

    const prohibitedFields = ['pan', 'card_number', 'cvv', 'security_code', 'cardNumber', 'securityCode'];
    const bodyStr = JSON.stringify(body).toLowerCase();

    // Check for prohibited field names
    for (const field of prohibitedFields) {
      if (bodyStr.includes(`"${field}"`)) {
        throw new BadRequestException({
          errorCode: 'CARD_SENSITIVE_DATA_REJECTED',
          message: `Field '${field}' is prohibited. We do not store complete card numbers or security codes.`,
        });
      }
    }

    // Check for 13-19 digit numeric patterns (potential PAN)
    const panPattern = /\b\d{13,19}\b/;
    for (const key of Object.keys(body)) {
      const value = String(body[key]);
      if (panPattern.test(value)) {
        throw new BadRequestException({
          errorCode: 'CARD_SENSITIVE_DATA_REJECTED',
          message: 'Complete card numbers (PAN) are prohibited. Only the last 4 digits are accepted.',
        });
      }
    }

    return true;
  }
}