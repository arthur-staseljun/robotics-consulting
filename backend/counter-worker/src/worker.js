async function verifyTurnstile(token, secretKey, ip) {
  const body = new URLSearchParams({ secret: secretKey, response: token, remoteip: ip || "" });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
	status,
	headers: {
	  "Content-Type": "application/json; charset=utf-8",
	  "Access-Control-Allow-Origin": origin,
	  "Access-Control-Allow-Methods": "GET, OPTIONS",
	  "Access-Control-Allow-Headers": "Content-Type",
	  "Cache-Control": "no-store"
	}
  });
}

function resolveOrigin(request, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  if (allowed === "*") return "*";
  const incoming = request.headers.get("Origin") || "";
  if (!incoming) return allowed;
  return incoming === allowed ? allowed : "";
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getCurrentValue(env) {
  const key = env.COUNTER_KEY || "site-unique-visitors";
  const start = toNumber(env.COUNTER_START, 32);
  const raw = await env.COUNTER_KV.get(key);
  if (raw === null) {
	await env.COUNTER_KV.put(key, String(start));
	return start;
  }
  return toNumber(raw, start);
}

async function setCurrentValue(env, value) {
  const key = env.COUNTER_KEY || "site-unique-visitors";
  await env.COUNTER_KV.put(key, String(value));
}

export default {
  async fetch(request, env) {
	const url = new URL(request.url);
	const origin = resolveOrigin(request, env);

	if (request.method === "OPTIONS") {
	  return json({ ok: true }, 204, origin || "*");
	}

	if (!origin) {
	  return json({ error: "Origin is not allowed" }, 403, "*");
	}

	if (request.method !== "GET" || url.pathname !== "/api/counter") {
	  return json({ error: "Not found" }, 404, origin);
	}

	if (!env.COUNTER_KV) {
	  return json({ error: "COUNTER_KV is not configured" }, 500, origin);
	}

	try {
	  const mode = url.searchParams.get("mode") || "get";
	  let current = await getCurrentValue(env);

	if (mode === "hit") {
		if (env.TURNSTILE_SECRET) {
		  const tsToken = url.searchParams.get("ts_token");
		  if (!tsToken) return json({ error: "Turnstile token required" }, 403, origin);
		  const ip = request.headers.get("CF-Connecting-IP") || "";
		  const valid = await verifyTurnstile(tsToken, env.TURNSTILE_SECRET, ip);
		  if (!valid) return json({ error: "Turnstile verification failed" }, 403, origin);
		}
		current += 1;
		await setCurrentValue(env, current);
	  } else if (mode !== "get") {
		return json({ error: "Unsupported mode" }, 400, origin);
	  }

	  return json({ value: current }, 200, origin);
	} catch {
	  return json({ error: "Counter backend failed" }, 500, origin);
	}
  }
};


