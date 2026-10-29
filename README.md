# risense-ai/.github

Risense AI 的组织主页配置仓库。

- `profile/README.md` —— 显示在 https://github.com/risense-ai 的主页正文
- `assets/banner.svg` —— 主页顶部横幅
- `repos.json` —— 项目分组与外部项目配置
- `scripts/update-profile.mjs` —— 拉取仓库数据并刷新主页统计/表格
- `.github/workflows/update-profile.yml` —— 每天 01:00 UTC 自动运行

## 修改主页

1. 手写内容直接编辑 `profile/README.md`，保留 `<!-- STATS:START -->`、`<!-- PROJECTS:START -->` 等标记。
2. 增删项目、调整分组编辑 `repos.json`；外部项目写成 `owner/repo`。
3. 提交后 Action 会自动刷新数据，也可在 Actions 页面手动触发。

详细说明见 [docs/SETUP.md](docs/SETUP.md)。

## 本地刷新

```bash
node scripts/update-profile.mjs
```

公开仓库无需 token；读取私有仓库时设置 `GITHUB_TOKEN` 或 `PROFILE_TOKEN`。
