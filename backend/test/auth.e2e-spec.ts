import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { RedisService } from '../src/common/redis.service';

/**
 * E2E spec for the full authentication flow:
 *   register → login → refresh → logout
 *
 * Uses in-memory mocks for PrismaService and RedisService so no real
 * database or Redis instance is required.  argon2 and the JWT module
 * run with their real implementations (RSA keys from /keys/*.pem).
 *
 * NOTE: requires `supertest` and `@types/supertest` to be installed:
 *   npm i -D supertest @types/supertest
 */
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let agent: request.SuperAgentTest;

  // ─── In-memory Prisma mock ───────────────────────────────────────
  const users = new Map<string, any>();
  const refreshTokens = new Map<string, any>();
  const memberships = new Map<string, any>();
  let userCounter = 0;
  let rtCounter = 0;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.email) {
          for (const u of users.values()) {
            if (u.email === where.email) return u;
          }
          return null;
        }
        if (where.id) return users.get(where.id) || null;
        return null;
      }),
      create: jest.fn(({ data }: any) => {
        const id = `user-${++userCounter}`;
        const user = {
          id,
          failedLoginAttempts: 0,
          lockedUntil: null,
          pictureUrl: null,
          ...data,
        };
        users.set(id, user);
        return user;
      }),
      update: jest.fn(({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user) throw new Error('User not found');
        const updated = { ...user, ...data };
        users.set(where.id, updated);
        return updated;
      }),
    },
    refreshToken: {
      findFirst: jest.fn(({ where, include }: any) => {
        for (const token of refreshTokens.values()) {
          if (token.tokenHash === where.tokenHash) {
            if (include?.user) {
              return { ...token, user: users.get(token.userId) };
            }
            return token;
          }
        }
        return null;
      }),
      create: jest.fn(({ data }: any) => {
        const id = `rt-${++rtCounter}`;
        const token = { id, isRevoked: false, ...data };
        refreshTokens.set(id, token);
        return token;
      }),
      update: jest.fn(({ where, data }: any) => {
        const token = refreshTokens.get(where.id);
        if (!token) throw new Error('Token not found');
        const updated = { ...token, ...data };
        refreshTokens.set(where.id, updated);
        return updated;
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        let count = 0;
        for (const token of refreshTokens.values()) {
          if (token.tokenHash === where.tokenHash && token.userId === where.userId) {
            Object.assign(token, data);
            count++;
          }
        }
        return { count };
      }),
    },
    familyGroupMember: {
      findUnique: jest.fn(({ where }: any) => memberships.get(where.userId) || null),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  // ─── In-memory Redis mock ────────────────────────────────────────
  const redisStore = new Map<string, any>();
  const mockRedis = {
    del: jest.fn((key: string) => {
      redisStore.delete(key);
      return Promise.resolve();
    }),
    setJSON: jest.fn((key: string, value: any) => {
      redisStore.set(key, value);
      return Promise.resolve();
    }),
    getJSON: jest.fn((key: string) => Promise.resolve(redisStore.get(key) || null)),
    get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) || null)),
    set: jest.fn((key: string, value: any) => {
      redisStore.set(key, value);
      return Promise.resolve();
    }),
  };

  // ─── Minimal cookie parser (avoids cookie-parser dependency) ──────
  function parseCookies(req: any, _res: any, next: any) {
    req.cookies = {};
    const header = req.headers.cookie;
    if (header) {
      for (const part of header.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        req.cookies[name] = rest.join('=');
      }
    }
    next();
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    // Parse cookies so refresh/logout can read refresh_token
    (app as any).use(parseCookies);
    await app.init();

    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  // Test data
  const testEmail = `e2e-auth-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123';
  const testName = 'E2E Auth User';

  // ─── Register ────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return accessToken + user', async () => {
      const res = await agent
        .post('/api/v1/auth/register')
        .send({ email: testEmail, password: testPassword, givenName: testName })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.givenName).toBe(testName);
      expect(res.body.user.authProvider).toBe('traditional');

      // refresh_token cookie should be set
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toContain('refresh_token=');
    });

    it('should reject duplicate email with 409', async () => {
      await agent
        .post('/api/v1/auth/register')
        .send({ email: testEmail, password: testPassword, givenName: testName })
        .expect(409);
    });

    it('should reject invalid email with 400', async () => {
      await agent
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: testPassword, givenName: testName })
        .expect(400);
    });

    it('should reject weak password with 400', async () => {
      await agent
        .post('/api/v1/auth/register')
        .send({ email: 'weak@example.com', password: 'weak', givenName: testName })
        .expect(400);
    });
  });

  // ─── Login ───────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials and return accessToken + user', async () => {
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user.email).toBe(testEmail);

      // refresh_token cookie should be set
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toContain('refresh_token=');
    });

    it('should reject invalid password with 401', async () => {
      await agent
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword123' })
        .expect(401);
    });

    it('should reject non-existent user with 401', async () => {
      await agent
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: testPassword })
        .expect(401);
    });
  });

  // ─── Refresh ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('should issue a new accessToken using the refresh_token cookie', async () => {
      // The supertest agent persists cookies from the login response
      const res = await agent
        .post('/api/v1/auth/refresh')
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('should reject refresh without cookie with 400', async () => {
      // Use a fresh agent (no cookies)
      const freshAgent = request.agent(app.getHttpServer());
      await freshAgent
        .post('/api/v1/auth/refresh')
        .expect(400);
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should logout and clear the refresh_token cookie (204)', async () => {
      // First login to get a fresh accessToken
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      const accessToken = loginRes.body.accessToken;

      const res = await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // refresh_token cookie should be cleared
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        expect(setCookie[0]).toContain('refresh_token=');
        // Cleared cookie has maxAge=0 or expires in the past
        expect(setCookie[0]).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/);
      }
    });

    it('should reject logout without auth token with 401', async () => {
      // Use a fresh agent (no cookies, no auth header)
      const freshAgent = request.agent(app.getHttpServer());
      await freshAgent
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });
});
