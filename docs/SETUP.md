# risense-ai 组织主页改造包

把本目录当成一个独立的公开仓库 `risense-ai/.github` 推上去，组织主页就会出现 README。
项目数据由 GitHub Actions 每天自动刷新。

## 一、这些设置到底在哪里操作

| 想改什么 | 操作位置 |
| :-- | :-- |
| 组织名称、简介、官网、所在地、社交链接 | `https://github.com/organizations/risense-ai/settings/profile` |
| 组织主页 README（公开视图） | 新建公开仓库 `risense-ai/.github`，文件固定为 `profile/README.md` |
| 组织主页 README（成员视图） | 新建**私有**仓库 `risense-ai/.github-private`，文件同样为 `profile/README.md` |
| 主页置顶仓库（最多 6 个） | 组织主页 → 「Pinned」区域右上角 **Customize pins**（没有置顶时是右侧 **pin repositories**） |
| 组织头像 | `https://github.com/organizations/risense-ai/settings/profile` → Profile picture |
| 公开成员 | `https://github.com/orgs/risense-ai/people`，由成员本人把组织成员身份设为 Public |
| 仓库简介 / 语言 / Topics | 各仓库 → Settings / About 齿轮 |

> 改造前 `risense-ai` 没有 `.github` 仓库，也没有填写简介、官网、社交链接，所以主页只有一个裸的仓库列表。
> 本仓库的视觉是独立设计的（深色横幅 + 呼吸波形 + 数据条），只使用 GitHub 允许的 Markdown/HTML/SVG，没有自定义 CSS/JS。

## 二、发布步骤

1. 在 `risense-ai` 下新建 **Public** 仓库，名字必须是 `.github`（不要勾选自动生成 README）。
2. 把本目录全部内容推到该仓库 `main` 分支：

   ```bash
   cd risense-profile-kit
   git init -b main
   git add .
   git commit -m "feat: add organization profile"
   git remote add origin https://github.com/risense-ai/.github.git
   git push -u origin main
   ```

3. 打开 `https://github.com/risense-ai`，README 应立即显示。
4. 进入 **Actions → Refresh organization profile → Run workflow**，手动跑一次，确认机器人能提交。
5. 组织主页 → **Customize pins**，选 6 个最重要的仓库（建议：`respire-cli`、`respire-server`、`respire-client`、`respire-site`、`respire-codex`、`skills`）。
6. 到 `settings/profile` 补全简介、官网 `https://rsrs.rs`、社交链接；头像可上传 `assets/avatar.png`。

## 三、如何把“团队其他项目”加进来

编辑 `repos.json`：

- `groups`：本组织仓库，按你想要的顺序分组；写成 `repo-name` 即可。
- `external`：本组织之外的项目，必须写 `owner/repo`，会出现在「团队其他项目」表格里。
- `autoInclude: true`：以后新建的组织仓库没写进配置，也会自动出现在「更多仓库」，不会漏掉。

当前 `external` 预置了 `imthewiner` 下的 4 个项目，按需删改：

```json
"external": [
  {
    "group": "团队其他项目 / More from the team",
    "repos": ["imthewiner/cocurdex", "imthewiner/editor", "imthewiner/komari-zig-agent", "imthewiner/perfectPixel"]
  }
]
```

改完 push 到 `main`，workflow 会自动重跑。

## 四、数据是怎么来的

`scripts/update-profile.mjs` 调用 GitHub REST API `GET /repos/{owner}/{repo}`，读取：

- 仓库简介、主语言、Star、Fork、最近 push 时间、是否归档

然后只替换 `profile/README.md` 里两处自动区块，其余手写内容不动：

- `<!-- STATS:START -->` 与 `<!-- STATS:END -->`：仓库数、Star、Fork、语言数
- `<!-- PROJECTS:START -->` 与 `<!-- PROJECTS:END -->`：完整项目表格

本地预览：

```bash
$env:GITHUB_TOKEN="ghp_xxx"   # 可选，公开仓库不填也能跑，只是限额低
node scripts/update-profile.mjs
```

## 五、注意事项

- **自定义 CSS / JS 会被 GitHub 过滤**，只能使用 Markdown、HTML 的有限标签、表格和图片。
- 组织置顶通常只能选本组织仓库；外部项目只能通过 README 表格展示，这是 GitHub 的限制。
- `GITHUB_TOKEN` 只能读公开仓库；要统计其他账号的私有仓库，需新建 PAT 并保存为仓库 Secret `PROFILE_TOKEN`（Fine-grained PAT，至少 `Metadata: Read`）。
- 定时 workflow 在仓库连续 60 天无提交时可能被 GitHub 自动暂停，收到邮件后点一下启用即可。
- `.github` 仓库还会被 GitHub 当作组织级社区健康文件仓库（Issue 模板、贡献指南等），后续可以复用。
- 若组织开启了分支保护，需要允许 GitHub Actions 直接 push `main`，或改成提 PR 的方式。
