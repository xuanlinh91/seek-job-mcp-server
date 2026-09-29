#!/usr/bin/env node
// Free SEEK (AU/NZ) job search MCP server — uses SEEK's public web endpoints, no API key.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const SITES = {
  AU: { host: "https://au.seek.com", siteKey: "AU-Main", locale: "en-AU", timezone: "Australia/Sydney" },
  NZ: { host: "https://www.seek.co.nz", siteKey: "NZ-Main", locale: "en-NZ", timezone: "Pacific/Auckland" },
};

const WORK_TYPES = { "full-time": 242, "part-time": 243, contract: 244, casual: 245 };
const WORK_ARRANGEMENTS = { "on-site": 1, hybrid: 2, remote: 3 };

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`SEEK returned HTTP ${res.status} for ${url}`);
  return res.json();
}

function htmlToText(html = "") {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(p|h\d|div|ul|ol)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeJob(j, site) {
  const cls = j.classifications?.[0];
  return {
    id: j.id,
    title: j.title,
    company: j.companyName || j.advertiser?.description,
    location: j.locations?.map((l) => l.label).join("; "),
    workType: j.workTypes?.join(", "),
    workArrangement: j.workArrangements?.displayText,
    salary: j.salaryLabel || null,
    classification: cls
      ? `${cls.classification.description} > ${cls.subclassification.description}`
      : null,
    listed: j.listingDate,
    listedAgo: j.listingDateDisplay,
    teaser: j.teaser,
    bulletPoints: j.bulletPoints,
    promoted: j.displayType === "promoted" || undefined,
    url: `${site.host}/job/${j.id}`,
  };
}

const server = new McpServer({ name: "seek", version: "1.0.0" });

server.registerTool(
  "search_jobs",
  {
    title: "Search SEEK jobs",
    description:
      "Search job listings on SEEK Australia or New Zealand. Returns a page of job summaries (id, title, company, location, salary, work type, listing date, URL). Use get_job_detail for the full description.",
    inputSchema: {
      keywords: z.string().optional().describe("Job title, skills or company, e.g. 'software engineer'"),
      where: z.string().optional().describe("Location, e.g. 'Sydney NSW', 'Melbourne', 'All Australia'"),
      country: z.enum(["AU", "NZ"]).default("AU"),
      workType: z.array(z.enum(["full-time", "part-time", "contract", "casual"])).optional(),
      workArrangement: z.array(z.enum(["on-site", "hybrid", "remote"])).optional(),
      daysListed: z.number().int().min(1).max(31).optional().describe("Only jobs listed in the last N days"),
      salaryMin: z.number().int().optional().describe("Minimum annual salary"),
      salaryMax: z.number().int().optional().describe("Maximum annual salary"),
      classification: z.string().optional().describe("SEEK classification id(s), comma-separated, e.g. '6281' for ICT"),
      sortBy: z.enum(["relevance", "date"]).default("relevance"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(10).max(100).default(20).describe("10-100; SEEK returns wrong results below 10"),
    },
  },
  async (a) => {
    const site = SITES[a.country];
    const p = new URLSearchParams({
      siteKey: site.siteKey,
      locale: site.locale,
      page: String(a.page),
      pageSize: String(a.pageSize),
    });
    if (a.keywords) p.set("keywords", a.keywords);
    if (a.where) p.set("where", a.where);
    if (a.workType?.length) p.set("worktype", a.workType.map((w) => WORK_TYPES[w]).join(","));
    if (a.workArrangement?.length)
      p.set("workarrangement", a.workArrangement.map((w) => WORK_ARRANGEMENTS[w]).join(","));
    if (a.daysListed) p.set("daterange", String(a.daysListed));
    if (a.salaryMin || a.salaryMax) {
      p.set("salaryrange", `${a.salaryMin ?? 0}-${a.salaryMax ?? ""}`);
      p.set("salarytype", "annual");
    }
    if (a.classification) p.set("classification", a.classification);
    if (a.sortBy === "date") p.set("sortmode", "ListedDate");

    const d = await fetchJson(`${site.host}/api/jobsearch/v5/search?${p}`);
    const result = {
      totalCount: d.totalCount,
      page: a.page,
      pageSize: a.pageSize,
      jobs: (d.data || []).map((j) => summarizeJob(j, site)),
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const DETAIL_QUERY = `query jobDetails($jobId: ID!, $jobDetailsViewedCorrelationId: String!, $sessionId: String!, $zone: Zone!, $locale: Locale!, $languageCode: LanguageCodeIso!, $timezone: Timezone!) {
  jobDetails(id: $jobId, tracking: {channel: "WEB", jobDetailsViewedCorrelationId: $jobDetailsViewedCorrelationId, sessionId: $sessionId}) {
    job {
      id title phoneNumber isExpired isLinkOut content(platform: WEB)
      advertiser { name(locale: $locale) }
      salary { label currencyLabel(zone: $zone) }
      shareLink(platform: WEB, zone: $zone, locale: $locale)
      workTypes { label(locale: $locale) }
      location { label(locale: $locale, type: LONG) }
      classifications { label(languageCode: $languageCode) }
      listedAt { label(context: JOB_POSTED, length: SHORT, timezone: $timezone, locale: $locale) dateTimeUtc }
    }
  }
}`;

server.registerTool(
  "get_job_detail",
  {
    title: "Get SEEK job detail",
    description: "Get the full description and details of a SEEK job by its id (from search_jobs or a seek.com.au/job/<id> URL).",
    inputSchema: {
      jobId: z.string().describe("SEEK job id, e.g. '94835917'"),
      country: z.enum(["AU", "NZ"]).default("AU"),
    },
  },
  async ({ jobId, country }) => {
    const site = SITES[country];
    const id = jobId.match(/\d{6,}/)?.[0] ?? jobId;
    const sid = crypto.randomUUID();
    const d = await fetchJson(`${site.host}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "seek-request-brand": "seek",
        "seek-request-country": country,
      },
      body: JSON.stringify({
        operationName: "jobDetails",
        query: DETAIL_QUERY,
        variables: {
          jobId: id,
          jobDetailsViewedCorrelationId: sid,
          sessionId: sid,
          zone: "anz-1",
          locale: site.locale,
          languageCode: "en",
          timezone: site.timezone,
        },
      }),
    });
    if (d.errors?.length) throw new Error(d.errors.map((e) => e.message).join("; "));
    const j = d.data?.jobDetails?.job;
    if (!j) throw new Error(`Job ${id} not found`);
    const result = {
      id: j.id,
      title: j.title,
      company: j.advertiser?.name,
      location: j.location?.label,
      workType: j.workTypes?.label,
      salary: j.salary?.label ?? null,
      classification: j.classifications?.map((c) => c.label).join("; "),
      listed: j.listedAt?.dateTimeUtc,
      listedLabel: j.listedAt?.label,
      expired: j.isExpired,
      appliesExternally: j.isLinkOut,
      phone: j.phoneNumber,
      url: j.shareLink || `${site.host}/job/${j.id}`,
      description: htmlToText(j.content),
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

await server.connect(new StdioServerTransport());
