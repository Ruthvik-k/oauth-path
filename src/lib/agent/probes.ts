import type { GuideContent, ProbeResult } from "../guide-schema";
import type { ComposioStatus } from "../composio";
import type { Emit } from "./events";
import { fetchWithTimeout } from "./web";

const PROBE_CLIENT_ID = "oauth-path-probe-invalid-client";
const PROBE_REDIRECT = "https://example.com/oauth/callback";

async function probePortal(url: string): Promise<ProbeResult> {
  try {
    const res = await fetchWithTimeout(url, { redirect: "follow" });
    const blocked = res.status === 403 || res.status === 429;
    return {
      name: "Developer portal reachable",
      target: url,
      ok: res.ok || blocked,
      result: res.ok
        ? `HTTP ${res.status}${res.redirected ? ` (redirected to ${new URL(res.url).host})` : ""}`
        : blocked
          ? `HTTP ${res.status}: the site blocks automated requests; open it in a browser.`
          : `HTTP ${res.status}: the link may have moved.`,
    };
  } catch (e) {
    return { name: "Developer portal reachable", target: url, ok: false, result: `Unreachable (${(e as Error).message})` };
  }
}

async function probeAuthorize(endpoint: string): Promise<ProbeResult> {
  let url: URL;
  try {
    // Multi-tenant providers document templated endpoints, e.g. Microsoft's /{tenant}/oauth2/v2.0/authorize.
    url = new URL(endpoint.replace("{tenant}", "common").replace(/\{[^}]+\}/g, "x"));
  } catch {
    return { name: "OAuth authorize endpoint", target: endpoint, ok: false, result: "Not a valid URL" };
  }
  url.searchParams.set("client_id", PROBE_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", PROBE_REDIRECT);
  url.searchParams.set("state", "probe");
  try {
    const res = await fetchWithTimeout(url.toString(), { redirect: "manual" });
    const location = res.headers.get("location");
    let detail = `HTTP ${res.status}`;
    if (location) {
      try {
        const loc = new URL(location, url);
        const err = loc.searchParams.get("error") ?? loc.searchParams.get("error_description");
        detail += ` → redirects to ${loc.host}${loc.pathname}${err ? ` (error=${err})` : ""}`;
      } catch {
        detail += " → redirect";
      }
    } else {
      const body = (await res.text()).slice(0, 4000).toLowerCase();
      const hint = ["invalid_client", "invalid client", "aadsts700016", "unknown client", "client_id", "invalid_request", "app not found", "redirect_uri"].find(
        (h) => body.includes(h),
      );
      if (hint) detail += ` (page mentions "${hint}")`;
    }
    const live = res.status < 500;
    return {
      name: "OAuth authorize endpoint",
      target: endpoint,
      ok: live,
      result: live
        ? `${detail}. The endpoint is live and handled a request with a fake client_id, as expected.`
        : `${detail}. The server errored; the documented endpoint may be wrong or need extra parameters.`,
    };
  } catch (e) {
    return { name: "OAuth authorize endpoint", target: endpoint, ok: false, result: `Unreachable (${(e as Error).message})` };
  }
}

async function probeDiscovery(endpoint: string): Promise<ProbeResult> {
  let url: URL;
  try {
    url = new URL(endpoint.replace("{tenant}", "common").replace(/\{[^}]+\}/g, "x"));
  } catch {
    return { name: "OAuth/OIDC discovery metadata", target: endpoint, ok: false, result: "No valid endpoint to derive from" };
  }
  const prefix = url.pathname.replace(/\/(oauth2?\/)?(v\d(\.\d)?\/)?authori[sz]e.*$/i, "").replace(/\/$/, "");
  const candidates = Array.from(
    new Set([
      `${url.origin}${prefix}/v2.0/.well-known/openid-configuration`,
      `${url.origin}${prefix}/.well-known/openid-configuration`,
      `${url.origin}/.well-known/openid-configuration`,
      `${url.origin}/.well-known/oauth-authorization-server`,
    ]),
  );
  for (const candidate of candidates) {
    try {
      const res = await fetchWithTimeout(candidate, { headers: { accept: "application/json" } }, 6_000);
      if (!res.ok) continue;
      const meta = (await res.json()) as Record<string, unknown>;
      if (typeof meta.authorization_endpoint !== "string") continue;
      const pkce = Array.isArray(meta.code_challenge_methods_supported)
        ? `PKCE: ${(meta.code_challenge_methods_supported as string[]).join(", ")}`
        : "PKCE methods not advertised";
      const scopes = Array.isArray(meta.scopes_supported) ? `${(meta.scopes_supported as string[]).length} scopes advertised` : "scopes not advertised";
      return {
        name: "OAuth/OIDC discovery metadata",
        target: candidate,
        ok: true,
        result: `Found. authorization_endpoint=${meta.authorization_endpoint}; ${pkce}; ${scopes}.`,
      };
    } catch {
      // try next candidate
    }
  }
  return {
    name: "OAuth/OIDC discovery metadata",
    target: candidates[0],
    ok: false,
    result: "No discovery document found. Common for OAuth-only providers; take endpoints from the docs.",
  };
}

async function probeSources(sources: GuideContent["sources"]): Promise<ProbeResult> {
  const list = sources.slice(0, 40);
  const results = await Promise.all(
    list.map(async (s) => {
      try {
        const res = await fetchWithTimeout(s.url, { redirect: "follow" }, 8_000);
        return { s, status: res.status };
      } catch {
        return { s, status: 0 };
      }
    }),
  );
  const okCount = results.filter((r) => r.status >= 200 && r.status < 400).length;
  const blocked = results.filter((r) => r.status === 403 || r.status === 429);
  const broken = results.filter((r) => r.status === 0 || r.status === 404 || r.status === 410 || r.status >= 500);
  const parts = [`${okCount}/${list.length} cited pages load${sources.length > list.length ? ` (checked the first ${list.length} of ${sources.length})` : ""}`];
  if (blocked.length) parts.push(`${blocked.length} block automated requests (${blocked.map((r) => r.s.id).join(", ")})`);
  if (broken.length) parts.push(`${broken.length} broken or unreachable (${broken.map((r) => `${r.s.id}: ${r.status || "no response"}`).join(", ")})`);
  return { name: "Cited source links", target: `${list.length} sources`, ok: broken.length === 0, result: parts.join("; ") + "." };
}

export async function runProbes(content: GuideContent, composio: ComposioStatus, emit: Emit): Promise<ProbeResult[]> {
  const composioProbe: ProbeResult = {
    name: "Composio managed auth",
    target: "docs.composio.dev/toolkits/managed-auth",
    ok: composio.managed !== null,
    result:
      composio.managed === true
        ? `Managed OAuth available (toolkit ${composio.toolkitSlug}).`
        : composio.managed === false
          ? `Listed as bring-your-own OAuth app (toolkit ${composio.toolkitSlug}).`
          : "Not listed in the directory.",
  };
  emit({ type: "probe", probe: composioProbe });

  const tasks: Promise<ProbeResult>[] = [];
  if (content.app.developerPortalUrl) tasks.push(probePortal(content.app.developerPortalUrl));
  if (content.app.authorizationEndpoint) {
    tasks.push(probeAuthorize(content.app.authorizationEndpoint));
    tasks.push(probeDiscovery(content.app.authorizationEndpoint));
  }
  if (content.sources.length) tasks.push(probeSources(content.sources));

  const results = await Promise.all(
    tasks.map((t) =>
      t.then((r) => {
        emit({ type: "probe", probe: r });
        return r;
      }),
    ),
  );
  return [composioProbe, ...results];
}
