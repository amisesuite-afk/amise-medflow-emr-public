// Vitest global setup — runs before each test file.
// Sets minimum required env vars so module-level code (e.g. Anthropic SDK init)
// doesn't throw on import. No real network connections are made in tests.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.test';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.ANTHROPIC_API_KEY = 'sk-test';
process.env.SESSION_SECRET = 'test-session-secret';
