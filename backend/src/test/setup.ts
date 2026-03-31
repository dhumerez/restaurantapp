// Set test environment variables before anything imports env.ts
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/restaurant_pos";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-vitest-minimum-32-chars";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-for-vitest-min-32-chars";
process.env.NODE_ENV = "test";
