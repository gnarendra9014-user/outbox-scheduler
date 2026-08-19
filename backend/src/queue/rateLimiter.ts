import IORedis from 'ioredis';
import { config } from '../config';

/**
 * Redis-backed per-sender hourly rate limiter.
 *
 * Uses Redis INCR + EXPIRE for atomic counting.
 * Key pattern: rate:sender:{senderEmail}:{hourWindow}
 * Where hourWindow = Math.floor(Date.now() / 3600000)
 *
 * Returns:
 *  - { allowed: true } if under limit
 *  - { allowed: false, retryAfterMs } if limit exceeded (delay until next hour)
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  currentCount?: number;
}

// Separate Redis connection for rate limiting
let rateLimitRedis: IORedis | null = null;

function getRedis(): IORedis {
  if (!rateLimitRedis) {
    rateLimitRedis = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return rateLimitRedis;
}

/**
 * Check and increment the per-sender rate limit.
 * Uses a Lua script for atomic check-and-increment.
 */
export async function checkSenderRateLimit(
  senderEmail: string,
  maxPerHour: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);
  const key = `rate:sender:${senderEmail}:${hourWindow}`;

  // Atomic increment and check using Lua script
  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local current = redis.call('INCR', key)
    if current == 1 then
      redis.call('EXPIRE', key, 3600)
    end
    return current
  `;

  const currentCount = (await redis.eval(luaScript, 1, key, maxPerHour)) as number;

  if (currentCount > maxPerHour) {
    // Decrement since we won't actually use this slot
    await redis.decr(key);

    // Calculate ms until next hour window
    const nextHourStart = (hourWindow + 1) * 3600000;
    const retryAfterMs = nextHourStart - now + 1000; // +1s buffer

    return {
      allowed: false,
      retryAfterMs,
      currentCount: currentCount - 1,
    };
  }

  return {
    allowed: true,
    currentCount,
  };
}

/**
 * Check the global rate limit (across all senders).
 */
export async function checkGlobalRateLimit(): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);
  const key = `rate:global:${hourWindow}`;

  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local current = redis.call('INCR', key)
    if current == 1 then
      redis.call('EXPIRE', key, 3600)
    end
    return current
  `;

  const currentCount = (await redis.eval(luaScript, 1, key, config.maxEmailsPerHour)) as number;

  if (currentCount > config.maxEmailsPerHour) {
    await redis.decr(key);

    const nextHourStart = (hourWindow + 1) * 3600000;
    const retryAfterMs = nextHourStart - now + 1000;

    return {
      allowed: false,
      retryAfterMs,
      currentCount: currentCount - 1,
    };
  }

  return {
    allowed: true,
    currentCount,
  };
}

/**
 * Cleanup Redis connection on shutdown.
 */
export async function closeRateLimiter(): Promise<void> {
  if (rateLimitRedis) {
    await rateLimitRedis.quit();
    rateLimitRedis = null;
  }
}
