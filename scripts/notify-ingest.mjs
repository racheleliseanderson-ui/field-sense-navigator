#!/usr/bin/env node
/**
 * Failure notifier for scheduled ingest.
 *
 * Always-on path: GitHub issue titled "Live ingest health".
 * Optional: Discord or Slack incoming webhooks via repo secrets
 * DISCORD_WEBHOOK_URL / SLACK_WEBHOOK_URL.
 *
 * Does nothing on a clean success or on a carry-forward-only degrade
 * (USBR timeout that retained the last official observation). --failed
 * forces a notification even when status.json was never written.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldNotify } from "./ingest-live.lib.mjs";

const failed = process.argv.includes("--failed");
const runUrlArg = process.argv.find((a) => a.startsWith("--run="));
const runUrl =
  runUrlArg?.slice("--run=".length) ||
  (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "");

function loadStatus() {
  for (const path of ["public/live/status.json", "status.json", "/tmp/live-pub/status.json"]) {
    try {
      return JSON.parse(readFileSync(resolve(path), "utf8"));
    } catch {
      /* try next */
    }
  }
  return null;
}

function summarize(status) {
  const lines = [];
  lines.push(failed ? "Live ingest failed." : "Live ingest finished with hard errors.");
  if (runUrl) lines.push(runUrl);
  if (!status) {
    lines.push("status.json was not written.");
    return lines.join("\n");
  }
  const stats = status.stats ?? {};
  lines.push(
    `mode ${status.mode} · ${stats.withReadings ?? "?"}/${stats.boundStations ?? "?"} gauges · NWS ${stats.nwsWithObs ?? "?"}/${stats.nwsStations ?? "?"}`,
  );
  lines.push(
    `errors ${status.errorCount ?? 0} (${status.hardErrorCount ?? 0} hard) · USBR timeouts ${status.usbr?.timeouts ?? 0}`,
  );
  for (const err of (status.errors ?? []).slice(0, 12)) {
    lines.push(`- ${err.agency ?? err.kind} ${err.siteId}: ${err.error}`);
  }
  return lines.join("\n");
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error(`webhook ${res.status}`);
}

async function notifyGithub(text) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return;
  const [owner, name] = repo.split("/");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "field-sense-ingest-notify",
  };
  const query = new URL("https://api.github.com/search/issues");
  query.searchParams.set(
    "q",
    `repo:${owner}/${name} is:issue is:open in:title "Live ingest health"`,
  );
  const found = await fetch(query, { headers }).then((r) => r.json());
  const existing = found.items?.[0];
  const body = `## Live ingest health\n\n\`\`\`\n${text}\n\`\`\`\n`;
  if (existing) {
    await fetch(
      `https://api.github.com/repos/${owner}/${name}/issues/${existing.number}/comments`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    return;
  }
  await fetch(`https://api.github.com/repos/${owner}/${name}/issues`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Live ingest health", body }),
  });
}

const status = loadStatus();
if (!shouldNotify(status, { failed })) {
  console.error("notify: nothing to send (success or carry-forward only)");
  process.exit(0);
}

const text = summarize(status);
console.error(text);

if (process.env.DISCORD_WEBHOOK_URL) {
  await postJson(process.env.DISCORD_WEBHOOK_URL, { content: text.slice(0, 1800) });
}
if (process.env.SLACK_WEBHOOK_URL) {
  await postJson(process.env.SLACK_WEBHOOK_URL, { text });
}
await notifyGithub(text);
