import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Redis 환경변수가 없습니다. Vercel 프로젝트에 Upstash Redis(또는 KV) 스토리지를 연결하세요."
    );
  }
  redis = new Redis({ url, token });
  return redis;
}

export const INDEX_KEY = "cs-quiz:sets:index";
export const setKey = (id: string) => `cs-quiz:sets:${id}`;
