#!/bin/bash
# 一键启动 Insight68 Platform
# MCP Server 由 Next.js API route 自动通过 stdio 启动，无需手动管理

set -e

cd "$(dirname "$0")/.."

echo "=== Insight68 Platform ==="
echo "确保 MCP Server 依赖已安装..."
(cd mcp-server && npm install --silent)

echo "启动 Next.js..."
npm run dev
