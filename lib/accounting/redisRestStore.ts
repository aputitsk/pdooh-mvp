export type RedisRestConfig = {
  token: string;
  url: string;
};

type RedisRestCommand = readonly unknown[];

type RedisRestResponse = {
  error?: unknown;
  result?: unknown;
};

export function getVercelKvRedisRestConfig(): RedisRestConfig | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return {
    token,
    url: url.replace(/\/+$/, ""),
  };
}

export async function runRedisCommand(
  config: RedisRestConfig,
  command: RedisRestCommand
) {
  const response = await fetch(config.url, {
    body: JSON.stringify(command),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as RedisRestResponse;

  if (!response.ok) {
    throw new Error(`Redis command failed with status ${response.status}.`);
  }

  if (typeof payload.error === "string") {
    throw new Error(`Redis command failed: ${payload.error}`);
  }

  return payload.result;
}
