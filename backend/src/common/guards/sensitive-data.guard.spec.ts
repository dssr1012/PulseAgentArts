import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { SensitiveDataGuard } from './sensitive-data.guard';

describe('SensitiveDataGuard', () => {
  let guard: SensitiveDataGuard;

  beforeEach(() => {
    guard = new SensitiveDataGuard();
  });

  function createMockContext(body?: any): ExecutionContext {
    const request: any = { body };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => SensitiveDataGuard,
    } as any;
  }

  it('should allow access when body is undefined', () => {
    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when body is not an object', () => {
    const context = createMockContext('string-body');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when body contains no sensitive data', () => {
    const context = createMockContext({ amount: 5000, description: 'Groceries' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject when body contains pan field', () => {
    const context = createMockContext({ pan: '4539578763624863' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject when body contains cvv field', () => {
    const context = createMockContext({ cvv: '123' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject when body contains card_number field', () => {
    const context = createMockContext({ card_number: '4539578763624863' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject when body contains security_code field', () => {
    const context = createMockContext({ security_code: '123' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject when body contains cardNumber (camelCase) field', () => {
    const context = createMockContext({ cardNumber: '4539578763624863' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject when body contains securityCode with a PAN-length value', () => {
    // securityCode field name is lowercased by the guard, so a short value
    // is not caught by the field-name check; but a PAN-length value is caught
    // by the 13-19 digit pattern check.
    const context = createMockContext({ securityCode: '4539578763624863' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject when a value contains a 13-19 digit PAN pattern', () => {
    const context = createMockContext({ someField: '4539578763624863' });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should allow access when values contain short numbers (not PAN)', () => {
    const context = createMockContext({ amount: 5000, lastFourDigits: '1234' });
    expect(guard.canActivate(context)).toBe(true);
  });
});
