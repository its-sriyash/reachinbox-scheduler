import { redis } from '../db/redis.js';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterMs: number;
  resetAt: Date;
}

export interface DelayReservationResult {
  allowed: boolean;
  waitMs: number;
}

export function getWindowSizeSeconds(): number {
  return parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '3600', 10);
}

export function getCurrentWindowInfo(windowSeconds: number = getWindowSizeSeconds()): {
  windowId: number;
  windowStartMs: number;
  windowEndMs: number;
  nextWindowStartMs: number;
  key: string;
} {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const windowStartMs = windowId * windowMs;
  const nextWindowStartMs = (windowId + 1) * windowMs;
  const windowEndMs = nextWindowStartMs - 1;
  const key = `ratelimit:emails:${windowId}`;

  return { windowId, windowStartMs, windowEndMs, nextWindowStartMs, key };
}

const RATE_LIMIT_LUA = `
local current = redis.call('GET', KEYS[1])
local count = current and tonumber(current) or 0
local limit = tonumber(ARGV[1])

if count >= limit then
    return {0, count}
else
    local newCount = redis.call('INCR', KEYS[1])
    if newCount == 1 then
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
    end
    return {1, newCount}
end
`;

export async function checkAndConsumeRateLimit(limit: number): Promise<RateLimitResult> {
  const windowSeconds = getWindowSizeSeconds();
  const { key, nextWindowStartMs } = getCurrentWindowInfo(windowSeconds);
  const ttl = windowSeconds * 2; // Keep key alive long enough for clean window rollover

  const result = (await redis.eval(RATE_LIMIT_LUA, 1, key, limit, ttl)) as [number, number];
  const allowed = result[0] === 1;
  const currentCount = result[1];
  const now = Date.now();
  const retryAfterMs = allowed ? 0 : Math.max(1000, nextWindowStartMs - now);
  const resetAt = new Date(nextWindowStartMs);

  return {
    allowed,
    currentCount,
    limit,
    retryAfterMs,
    resetAt,
  };
}

const MIN_DELAY_LUA = `
local nextAllowed = redis.call('GET', KEYS[1])
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])

if nextAllowed then
    local nextTime = tonumber(nextAllowed)
    if now < nextTime then
        return nextTime - now
    end
end

redis.call('SET', KEYS[1], tostring(now + delay), 'EX', 86400)
return 0
`;

export async function checkAndReserveMinimumDelay(
  delayBetweenEmailsSeconds: number
): Promise<DelayReservationResult> {
  if (!delayBetweenEmailsSeconds || delayBetweenEmailsSeconds <= 0) {
    return { allowed: true, waitMs: 0 };
  }

  const delayMs = delayBetweenEmailsSeconds * 1000;
  const now = Date.now();
  const key = 'email:next_allowed_send_timestamp';

  const waitMs = (await redis.eval(MIN_DELAY_LUA, 1, key, now, delayMs)) as number;

  if (waitMs > 0) {
    return { allowed: false, waitMs };
  }

  return { allowed: true, waitMs: 0 };
}

// Helpers for test setup and verification
export async function getRateLimitStatus(): Promise<{ currentCount: number; key: string }> {
  const { key } = getCurrentWindowInfo();
  const val = await redis.get(key);
  return { currentCount: val ? parseInt(val, 10) : 0, key };
}

export async function resetRateLimit(): Promise<void> {
  const { key } = getCurrentWindowInfo();
  await redis.del(key);
  await redis.del('email:last_send_timestamp');
  await redis.del('email:next_allowed_send_timestamp');
}

