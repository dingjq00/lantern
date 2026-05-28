#!/usr/bin/env python3
# 扫描 JSY 南厂酿酒车间 Backend/Controllers，提取每一个 HTTP endpoint。
# 规则：[RoutePrefix("xxx")] + [Route("yyy")|nameof(Method)] + [Http*]，方法签名 + XML summary。
# 输出 markdown 表，按 controller 文件分组，便于同事接手。

import re
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/dingjq/IdeaProjects/JSYSmartFactoryII/南厂酿酒车间/Backend/Controllers")
OUT = Path("/Users/dingjq/projects/lantern/docs/jsy-endpoints.md")

# 抓 RoutePrefix("...")
RE_PREFIX = re.compile(r'\[RoutePrefix\("([^"]*)"\)\]')
# 抓 Route("xxx") 或 Route(nameof(Xxx))
RE_ROUTE_LIT = re.compile(r'\[Route\("([^"]*)"\)\]')
RE_ROUTE_NAMEOF = re.compile(r'\[Route\(nameof\(([A-Za-z_][A-Za-z0-9_]*)\)\)\]')
RE_HTTP = re.compile(r'\[Http(Get|Post|Put|Delete|Patch|Options|Head)\]')
RE_AUTH_DISABLE = re.compile(r'\[Authorization\([^)]*Disable\s*=\s*true[^)]*\)\]')
RE_UNPACKAGE = re.compile(r'\[UnPackage\]')
# 方法签名 — 简化：public|protected|internal 修饰符 + 返回类型 + 方法名 + (
# 兼容 async Task<T> / 多泛型 / 多行参数
RE_METHOD = re.compile(
    r'^\s*(?:public|protected|internal)\s+'
    r'(?:async\s+)?'
    r'([\w<>\[\],\s\?\.]+?)\s+'  # 返回类型
    r'(\w+)\s*'                   # 方法名
    r'\(([^)]*)\)',               # 参数列表（不跨行很简化）
    re.MULTILINE
)
RE_SUMMARY = re.compile(r'///\s*<summary>\s*\n((?:\s*///[^\n]*\n)+)\s*///\s*</summary>', re.MULTILINE)

def extract_summary_lines(block: str) -> str:
    """从 /// <summary>...</summary> 块抽出纯文本，单行返回。"""
    lines = []
    for ln in block.splitlines():
        s = ln.strip().lstrip('/').strip()
        if s:
            lines.append(s)
    return ' '.join(lines).replace('|', '\\|').strip()

def join_path(prefix: str, route: str) -> str:
    p = (prefix or '').strip('/')
    r = (route or '').strip('/')
    if not p and not r:
        return '/'
    if not p:
        return '/' + r
    if not r:
        return '/' + p
    return '/' + p + '/' + r

def parse_controller(fp: Path) -> list[dict]:
    """逐行扫描，把每段 attribute 块 + 紧跟的方法签名配对。"""
    text = fp.read_text(encoding='utf-8', errors='replace')
    lines = text.splitlines()
    n = len(lines)

    # 找 RoutePrefix（通常在 class 上方）
    m = RE_PREFIX.search(text)
    prefix = m.group(1) if m else ''

    endpoints = []
    i = 0
    while i < n:
        # 收集 [Xxx] 属性块 + 紧邻的 /// 注释块
        attr_lines = []
        doc_lines = []
        # 向上看：从当前行开始累积属性
        start = i
        # 跳过空行与注释
        while i < n and (not lines[i].strip() or lines[i].strip().startswith('//') or lines[i].strip().startswith('[')):
            stripped = lines[i].strip()
            if stripped.startswith('['):
                attr_lines.append(stripped)
            elif stripped.startswith('///'):
                doc_lines.append(stripped)
            elif not stripped:
                # 空行 — 如果还没遇到 [ 也没遇到 ///，重置；否则保持
                if not attr_lines and not doc_lines:
                    pass
            else:
                pass
            i += 1

        if not attr_lines:
            i = max(i, start + 1)
            continue

        # 现在 lines[i] 应该是方法签名行（或方法体首行）
        # 抓最多 3 行拼接（处理跨行参数）
        sig_block = ''
        for j in range(i, min(i + 4, n)):
            sig_block += lines[j] + '\n'
            if ')' in lines[j]:
                break

        m_meth = RE_METHOD.search(sig_block)
        if not m_meth:
            i += 1
            continue

        ret_type = ' '.join(m_meth.group(1).split())
        method_name = m_meth.group(2)
        params = m_meth.group(3).strip()

        # 从属性块抓路由信息
        route_seg = None
        http_verb = None
        auth_disabled = False
        unpackage = False
        for a in attr_lines:
            mr = RE_ROUTE_LIT.search(a)
            if mr:
                route_seg = mr.group(1)
            else:
                mrn = RE_ROUTE_NAMEOF.search(a)
                if mrn:
                    route_seg = mrn.group(1)
            mh = RE_HTTP.search(a)
            if mh:
                http_verb = mh.group(1).upper()
            if RE_AUTH_DISABLE.search(a):
                auth_disabled = True
            if RE_UNPACKAGE.search(a):
                unpackage = True

        if not http_verb:
            # 不是 HTTP endpoint（可能只是普通方法/属性），跳过
            i += 1
            continue

        # 路径
        path = join_path(prefix, route_seg or method_name)

        # 参数 — 只保留类型，去 attribute 比如 [FromBody]
        param_types = []
        if params:
            for p in re.split(r',(?![^<>]*>)', params):  # 不分泛型逗号
                p = p.strip()
                # 去掉 [FromBody] 等属性
                p = re.sub(r'\[[^\]]*\]\s*', '', p).strip()
                if p:
                    # 取首个 token = 类型
                    toks = p.split()
                    if len(toks) >= 2:
                        param_types.append(toks[0])
                    elif toks:
                        param_types.append(toks[0])
        params_str = ', '.join(param_types) if param_types else '—'

        summary = ''
        if doc_lines:
            block = '\n'.join(doc_lines)
            m_sum = re.search(r'<summary>\s*(.*?)\s*</summary>', block, re.DOTALL)
            if m_sum:
                summary = extract_summary_lines(m_sum.group(1))
            else:
                # 没有 <summary> 标签，把 /// 文本拼一行
                summary = extract_summary_lines(block)

        endpoints.append({
            'method': http_verb,
            'path': path,
            'action': method_name,
            'params': params_str,
            'ret': ret_type.replace('|', '\\|'),
            'auth': '公开' if auth_disabled else 'JWT',
            'unpkg': '✓' if unpackage else '',
            'summary': summary or '',
        })
        i += 1

    return endpoints

def main():
    files = sorted(ROOT.rglob('*.cs'))
    by_dir = defaultdict(list)  # dir -> list of (filename, [endpoints])
    total = 0
    public_count = 0
    verb_counts = defaultdict(int)

    for fp in files:
        # 二级目录名作为业务域；根目录的归"_root"
        rel = fp.relative_to(ROOT)
        if len(rel.parts) == 1:
            domain = '_root'
        else:
            domain = rel.parts[0]
        eps = parse_controller(fp)
        if eps:
            by_dir[domain].append((rel, eps))
            total += len(eps)
            for e in eps:
                if e['auth'] == '公开':
                    public_count += 1
                verb_counts[e['method']] += 1

    # 写 markdown
    out_lines = []
    out_lines.append('# JSY 南厂酿酒车间 — Endpoint 全清单')
    out_lines.append('')
    out_lines.append('> 生成时间：2026-05-28  ')
    out_lines.append(f'> 来源：扫描 `{ROOT}`  ')
    out_lines.append(f'> 控制器文件数：{sum(len(v) for v in by_dir.values())}  ')
    out_lines.append(f'> Endpoint 总数：**{total}**  ')
    out_lines.append('> 提取方式：Python 静态扫描 `[RoutePrefix]` + `[Route]` + `[Http*]` 属性  ')
    out_lines.append('')
    out_lines.append('## 统计概览')
    out_lines.append('')
    out_lines.append(f'- HTTP 动词分布：' + ' / '.join(f'{v}={c}' for v, c in sorted(verb_counts.items(), key=lambda x: -x[1])))
    out_lines.append(f'- 公开（Authorization.Disable=true）：{public_count}')
    out_lines.append(f'- 受保护（默认 JWT）：{total - public_count}')
    out_lines.append('')
    out_lines.append('### 按业务域统计')
    out_lines.append('')
    out_lines.append('| 业务域目录 | 控制器数 | Endpoint 数 |')
    out_lines.append('|---|---:|---:|')
    domain_order = sorted(by_dir.keys(), key=lambda d: -sum(len(eps) for _, eps in by_dir[d]))
    for d in domain_order:
        files_in_d = by_dir[d]
        n_ep = sum(len(eps) for _, eps in files_in_d)
        out_lines.append(f'| `{d}/` | {len(files_in_d)} | {n_ep} |')
    out_lines.append('')
    out_lines.append('---')
    out_lines.append('')
    out_lines.append('## 全量 Endpoint 表')
    out_lines.append('')

    for d in domain_order:
        out_lines.append(f'### {d}/')
        out_lines.append('')
        for rel, eps in sorted(by_dir[d]):
            out_lines.append(f'#### `Controllers/{rel}` — {len(eps)} endpoints')
            out_lines.append('')
            out_lines.append('| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |')
            out_lines.append('|---|---|---|---|---|---|---|')
            for e in eps:
                out_lines.append(
                    f"| {e['method']} | `{e['path']}` | {e['action']} | {e['params']} | "
                    f"{e['ret']} | {e['auth']}{(' /UnPkg' if e['unpkg'] else '')} | {e['summary']} |"
                )
            out_lines.append('')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(out_lines), encoding='utf-8')
    print(f'写入 {OUT}')
    print(f'  控制器文件：{sum(len(v) for v in by_dir.values())}')
    print(f'  Endpoint 总数：{total}')
    print(f'  公开：{public_count}  受保护：{total - public_count}')
    print(f'  动词分布：' + ', '.join(f'{v}={c}' for v, c in sorted(verb_counts.items(), key=lambda x: -x[1])))

if __name__ == '__main__':
    main()
