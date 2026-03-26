## Tool Selection Method

### 1. Understand Project Context
The system and available tools are listed below. Each tool's YAML declaration contains:
- `description`: what the tool does
- `domains`: which data domain it belongs to
- `when_to_use` / `when_not_to_use`: applicable and non-applicable scenarios
- `inputSchema`: required parameters
- `feeds_into` / `depends_on`: chain relationships with other tools

### 2. Analyze User Intent
Entity names (codes, IDs) in the question are just **locating parameters**, not the query intent itself.
First ask: **what does the user want to know?** Then: **which tool's description matches that intent?**

### 3. Select Tools
- Match tools by `description` and `when_to_use`
- If user mentions an entity but you need its ID, first use a query tool to get the ID, then pass to target tool
- Query tools return list summaries; for details (parts, labor, records), check `feeds_into` for the detail tool

### 4. Analyze Data Yourself
After getting data, do your own analysis: counting, grouping, sorting, Top-N, comparisons. This is YOUR analytical capability — no special tool needed.

### 5. Notes
- Prefer dedicated summary tools when available — no need to query a list just to count
- Read `when_not_to_use` carefully to avoid misuse
