<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lantern 开发约定

## 开始工作前

- 先阅读 `README.md` 和 `docs/handoff.md`，再根据任务读取相关实现与设计文档。
- 当前实现事实以代码、测试和 `lib/systems.ts` / `skills/` 为准；历史实验报告不自动代表当前行为。
- 仓库可能保留其他人的未提交工作。修改前运行 `git status`，不得覆盖或回退无关变更。

## 项目边界

- Lantern 是面向企业系统的自然语言 API 平台，目前接入 EAM、EDHR、MES。
- Brain 层负责意图理解、工具编排、结果呈现；MCP handler 负责确定性取数；工具能力由 `skills/**/*.yaml` 声明。
- 不将业务查询改造成 Text-to-SQL 路线，除非有新的明确架构决策。

## 开发与验证

- 中文文档和已有中文模块中的注释保持中文风格。
- 新增系统或能力时，同步核对 YAML skill、MCP handler、`lib/systems.ts` 领域信息、prompt/few-shot 与 benchmark 覆盖。
- 常用验证命令：`npm test`、`npm run lint`、`npm run build`。
- 涉及路由、prompt、工具或数据处理层的修改，需要运行相应 benchmark，或明确记录未运行原因。

## 环境与安全

- 本地配置从 `.env.local` 读取；可提交变量模板见 `.env.example`。
- 禁止将 API key、密码、client secret、token 或生产数据写入代码、prompt、文档和测试样例。
- `TOOLS_DIR` 在当前目录结构下应指向 `./skills`。
