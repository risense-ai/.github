#!/usr/bin/env node
/**
 * 根据 repos.json 拉取 GitHub 仓库实时数据，重写 profile/README.md 中
 * <!-- PROJECTS:START --> ... <!-- PROJECTS:END --> 之间的内容。
 * 无第三方依赖，Node 20+ 直接运行。
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, "repos.json");
const README_PATH = join(ROOT, "profile", "README.md");
const START = "<!-- PROJECTS:START -->";
const END = "<!-- PROJECTS:END -->";
const STATS_START = "<!-- STATS:START -->";
const STATS_END = "<!-- STATS:END -->";

const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
const org = config.org;
const token = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN || "";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "risense-profile-readme-bot",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (token) headers.Authorization = `Bearer ${token}`;

const cache = new Map();
const failures = [];
const displayed = new Map();

const fullName = (entry) => (entry.includes("/") ? entry : `${org}/${entry}`);

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function loadRepo(entry) {
  const full = fullName(entry);
  if (cache.has(full)) return cache.get(full);

  const promise = (async () => {
    try {
      const d = await fetchJson(`https://api.github.com/repos/${full}`);
      return {
        full,
        url: d.html_url,
        name: d.name,
        description: d.description || "",
        language: d.language || "—",
        stars: d.stargazers_count ?? 0,
        forks: d.forks_count ?? 0,
        pushedAt: d.pushed_at || d.updated_at,
        archived: Boolean(d.archived),
        fork: Boolean(d.fork),
      };
    } catch (error) {
      failures.push(`${full}: ${error.message}`);
      return null;
    }
  })();

  cache.set(full, promise);
  return promise;
}

function cleanDescription(text) {
  if (!text) return "—";
  const flat = text.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
  return flat.length > 96 ? `${flat.slice(0, 95)}…` : flat;
}

const dateOnly = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
};

async function renderGroup(title, entries) {
  const repos = (await Promise.all(entries.map(loadRepo))).filter(Boolean);
  if (repos.length === 0) return "";

  for (const repo of repos) displayed.set(repo.full, repo);

  const rows = repos.map((repo) => {
    const flags = repo.archived ? "已归档" : "";
    const suffix = flags ? ` <sub>(${flags})</sub>` : "";
    return `| **[${repo.name}](${repo.url})** | ${cleanDescription(repo.description)}${suffix} | ${repo.language} | ${repo.stars} | ${repo.forks} | ${dateOnly(repo.pushedAt)} |`;
  });

  return [
    `### ${title}`,
    "",
    "| 项目 | 简介 | 语言 | ⭐ | 🍴 | 最近更新 |",
    "| :-- | :-- | :-- | --: | --: | :-- |",
    ...rows,
    "",
  ].join("\n");
}

// 1) 已配置的分组
const configured = new Set();
const blocks = [];
for (const group of config.groups || []) {
  for (const repo of group.repos || []) configured.add(fullName(repo));
  blocks.push(await renderGroup(group.title, group.repos || []));
}

// 2) 外部项目（可来自其他组织或个人账号）
for (const group of config.external || []) {
  for (const repo of group.repos || []) {
    if (!repo.includes("/")) {
      failures.push(`${repo}: external 项目必须写成 owner/repo`);
    }
  }
  blocks.push(await renderGroup(group.group, group.repos || []));
}

// 3) 自动纳入未配置的本组织仓库
if (config.autoInclude) {
  try {
    const all = await fetchJson(
      `https://api.github.com/orgs/${org}/repos?per_page=100&type=public&sort=pushed`,
    );
    const rest = all
      .filter((repo) => !repo.name.startsWith(".github"))
      .filter((repo) => !configured.has(repo.full_name))
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
      .map((repo) => repo.full_name);
    if (rest.length > 0) {
      blocks.push(await renderGroup(config.autoIncludeTitle || "更多仓库", rest));
    }
  } catch (error) {
    failures.push(`自动补全组织仓库失败: ${error.message}`);
  }
}

const body = blocks.filter(Boolean).join("\n").trim();
if (!body) {
  console.error("没有生成任何项目数据，保留原 README。");
  process.exit(1);
}

// 组织级统计（只统计本组织仓库，排除 .github 配置仓库与外部项目）
const orgRepos = [...displayed.values()].filter(
  (repo) => repo.full.startsWith(`${org}/`) && !repo.name.startsWith(".github"),
);
const publicRepoCount = orgRepos.length;

const totalStars = orgRepos.reduce((sum, repo) => sum + repo.stars, 0);
const totalForks = orgRepos.reduce((sum, repo) => sum + repo.forks, 0);
const languageCount = new Set(
  orgRepos.map((repo) => repo.language).filter((lang) => lang && lang !== "—"),
).size;

const stats = [
  "<table>",
  "  <tr>",
  `    <td align="center" width="25%"><h3>${publicRepoCount}</h3><sub>PUBLIC REPOS</sub></td>`,
  `    <td align="center" width="25%"><h3>${totalStars}</h3><sub>STARS</sub></td>`,
  `    <td align="center" width="25%"><h3>${totalForks}</h3><sub>FORKS</sub></td>`,
  `    <td align="center" width="25%"><h3>${languageCount}</h3><sub>LANGUAGES</sub></td>`,
  "  </tr>",
  "</table>",
].join("\n");

const readme = await readFile(README_PATH, "utf8");
const statsPattern = new RegExp(
  `${STATS_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${STATS_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
);
const withStats = statsPattern.test(readme)
  ? readme.replace(statsPattern, `${STATS_START}\n${stats}\n${STATS_END}`)
  : readme;

const pattern = new RegExp(
  `${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
);
if (!pattern.test(withStats)) {
  console.error(`README 缺少 ${START} / ${END} 标记，未写入。`);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 10);
const footer = `\n\n<sub>数据更新于 ${stamp}（UTC）· 由 GitHub Actions 自动生成</sub>`;
const next = withStats.replace(pattern, `${START}\n${body}${footer}\n${END}`);
await writeFile(README_PATH, next, "utf8");

if (failures.length > 0) {
  console.warn(`有 ${failures.length} 个项目未能读取：`);
  for (const line of failures) console.warn(`  - ${line}`);
}
console.log(`已更新 ${README_PATH}`);
