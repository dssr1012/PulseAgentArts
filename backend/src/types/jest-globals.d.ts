/**
 * Ambient Jest global type declarations.
 *
 * This file provides TypeScript types for Jest globals (describe, it, expect,
 * jest, beforeEach, afterEach, beforeAll, afterAll) without requiring the
 * external @types/jest package. It re-exports types from @jest/globals which
 * is bundled with jest itself.
 *
 * This file is ONLY included in the test compilation (tsconfig.spec.json),
 * never in the production build (tsconfig.json excludes spec files and the
 * types directory).
 */
import type { Jest } from '@jest/environment';
import type { Global } from '@jest/types';
import type {
  ClassLike,
  FunctionLike,
  Mock as JestMock,
  Mocked as JestMocked,
  MockedClass as JestMockedClass,
  MockedFunction as JestMockedFunction,
  MockedObject as JestMockedObject,
  Replaced as JestReplaced,
  Spied as JestSpied,
  SpiedClass as JestSpiedClass,
  SpiedFunction as JestSpiedFunction,
  SpiedGetter as JestSpiedGetter,
  SpiedSetter as JestSpiedSetter,
  UnknownFunction,
} from 'jest-mock';
import {
  expect as _expect,
  it as _it,
  test as _test,
  describe as _describe,
  beforeAll as _beforeAll,
  beforeEach as _beforeEach,
  afterEach as _afterEach,
  afterAll as _afterAll,
  jest as _jest,
  fit as _fit,
  xit as _xit,
  xtest as _xtest,
  xdescribe as _xdescribe,
  fdescribe as _fdescribe,
} from '@jest/globals';

declare global {
  const jest: typeof _jest;
  namespace jest {
    type Mock<T extends FunctionLike = UnknownFunction> = JestMock<T>;
    type Mocked<T extends object> = JestMocked<T>;
    type MockedClass<T extends ClassLike> = JestMockedClass<T>;
    type MockedFunction<T extends FunctionLike> = JestMockedFunction<T>;
    type MockedObject<T extends object> = JestMockedObject<T>;
    type Replaced<T> = JestReplaced<T>;
    type Spied<T extends ClassLike | FunctionLike> = JestSpied<T>;
    type SpiedClass<T extends ClassLike> = JestSpiedClass<T>;
    type SpiedFunction<T extends FunctionLike> = JestSpiedFunction<T>;
    type SpiedGetter<T> = JestSpiedGetter<T>;
    type SpiedSetter<T> = JestSpiedSetter<T>;
  }
  const expect: typeof _expect;
  const it: typeof _it;
  const test: typeof _test;
  const describe: typeof _describe;
  const beforeAll: typeof _beforeAll;
  const beforeEach: typeof _beforeEach;
  const afterEach: typeof _afterEach;
  const afterAll: typeof _afterAll;
  const fit: typeof _fit;
  const xit: typeof _xit;
  const xtest: typeof _xtest;
  const xdescribe: typeof _xdescribe;
  const fdescribe: typeof _fdescribe;
}

export {};
