import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../server/index';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('API hardening', () => {
  it('keeps health cheap and minimal', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: 'lincoln-bell-live' });
  });

  it('returns JSON for unknown API routes', async () => {
    const response = await fetch(`${baseUrl}/api/not-a-route`);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'API route not found.' });
  });

  it('rejects an empty or backwards half-open event range before source work', async () => {
    const equal = await fetch(`${baseUrl}/api/events?start=2026-08-20&end=2026-08-20`);
    const backwards = await fetch(`${baseUrl}/api/events?start=2026-08-21&end=2026-08-20`);
    expect(equal.status).toBe(400);
    expect(backwards.status).toBe(400);
  });

  it('rejects malformed dates and excessive ranges', async () => {
    expect((await fetch(`${baseUrl}/api/events?start=08-01-2026&end=2026-09-01`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/events?start=2026-01-01&end=2027-02-01`)).status).toBe(400);
  });
});
