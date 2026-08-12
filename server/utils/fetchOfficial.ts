import { config } from '../config.js';

const ALLOWED_HOST = 'www.lincolnhs.org';
const MAX_BYTES = 5 * 1024 * 1024;

type ExpectedSource = 'html' | 'calendar';

function validateSourceBody(text: string, contentType: string, expected: ExpectedSource) {
  const sample = text.slice(0, 2048).trimStart();
  if (expected === 'calendar') {
    if (!/^BEGIN:VCALENDAR\b/m.test(sample) && !contentType.includes('text/calendar')) {
      throw new Error(`Unexpected calendar response type: ${contentType || 'unknown'}`);
    }
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Calendar source did not contain VCALENDAR data');
    return;
  }
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !/^<!doctype\s+html|^<html\b/i.test(sample)) {
    throw new Error(`Unexpected HTML response type: ${contentType || 'unknown'}`);
  }
}

async function readBodyLimited(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel('response too large');
        throw new Error('Source response too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function fetchOfficial(url: string, accept: string, expected: ExpectedSource): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_HOST || parsed.username || parsed.password) {
    throw new Error('Blocked outbound source');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetch(parsed, {
        signal: controller.signal,
        redirect: 'error',
        headers: { 'user-agent': config.userAgent, accept }
      });
      if (!res.ok) throw new Error(`Source returned HTTP ${res.status}`);

      const finalUrl = new URL(res.url || parsed.toString());
      if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== ALLOWED_HOST) throw new Error('Blocked redirected source');

      const length = Number(res.headers.get('content-length') || 0);
      if (Number.isFinite(length) && length > MAX_BYTES) throw new Error('Source response too large');
      const text = await readBodyLimited(res);
      if (!text.trim()) throw new Error('Source returned an empty response');
      validateSourceBody(text, (res.headers.get('content-type') || '').toLowerCase(), expected);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Source request failed');
}
