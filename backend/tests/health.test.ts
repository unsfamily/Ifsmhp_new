import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns the success envelope defined in spec §40', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.message).toBe('string');
  });

  it('sets a correlation id header', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('unmatched routes', () => {
  it('returns the failure envelope with a 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('does not leak a stack trace', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });
});
