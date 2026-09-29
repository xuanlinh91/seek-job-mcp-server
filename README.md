# seek-job-mcp-server

A free [MCP](https://modelcontextprotocol.io) server for searching jobs on [SEEK](https://www.seek.com.au) Australia and New Zealand. No API key or account needed.

> [!WARNING]
> **This project uses an unofficial API.** SEEK does not publish or support these endpoints. It calls the same internal endpoints the seek.com.au website uses (`/api/jobsearch/v5/search` and `/graphql`). SEEK can change or block them at any time without notice, and this server will then stop working.
>
> This project is not affiliated with or endorsed by SEEK Limited. Use it only for personal job searching, keep request volume low, and follow [SEEK's terms of use](https://www.seek.com.au/terms). Do not use it for bulk scraping or to redistribute SEEK data.

## Tools

| Tool | What it does |
|---|---|
| `search_jobs` | Searches listings by keywords and location, with optional filters for work type, work arrangement, days listed, salary range and classification. You can sort by relevance or date. Returns job summaries and the total count. |
| `get_job_detail` | Gets the full description of a job, including salary, location, work type and classification. Accepts a job id or a SEEK job URL. |

### `search_jobs` parameters

| Param | Type | Notes |
|---|---|---|
| `keywords` | string | e.g. `software engineer` |
| `where` | string | e.g. `All Sydney NSW`, `Melbourne`, `Brisbane QLD` |
| `country` | `AU` \| `NZ` | default `AU` |
| `workType` | array | `full-time`, `part-time`, `contract`, `casual` |
| `workArrangement` | array | `on-site`, `hybrid`, `remote` |
| `daysListed` | int 1–31 | only jobs listed in the last N days |
| `salaryMin` / `salaryMax` | int | annual salary |
| `classification` | string | SEEK classification id, e.g. `6281` = Information & Communication Technology |
| `sortBy` | `relevance` \| `date` | default `relevance` |
| `page` | int | default 1 |
| `pageSize` | int 10–100 | default 20. SEEK returns wrong results below 10. |

## Install

Requires Node.js 18 or newer.

```bash
git clone <this repo> seek-job-mcp-server
cd seek-job-mcp-server
npm install
```

### Claude Code

```bash
claude mcp add --scope user seek -- node /absolute/path/to/seek-job-mcp-server/index.js
```

### Claude Desktop / other MCP clients

```json
{
  "mcpServers": {
    "seek": {
      "command": "node",
      "args": ["/absolute/path/to/seek-job-mcp-server/index.js"]
    }
  }
}
```

## Example prompts

- "Find full-time remote data analyst jobs in Melbourne listed in the last 7 days"
- "Search SEEK for software engineer jobs in All Sydney NSW paying $150k+, newest first"
- "Show me the full description of SEEK job 94835917"

## License

MIT
