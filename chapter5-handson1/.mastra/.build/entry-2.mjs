import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || "";
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || "";
const CONFLUENCE_USER_EMAIL = process.env.CONFLUENCE_USER_EMAIL || "";
function getAuthHeaders() {
  const auth = Buffer.from(
    `${CONFLUENCE_USER_EMAIL}:${CONFLUENCE_API_TOKEN}`
  ).toString("base64");
  return {
    Authorization: `Bassic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}
async function callConfluenceAPI(endpoint, options = {}) {
  const url = `${CONFLUENCE_BASE_URL}/wiki/rest/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Confluence API error: ${response.status}`);
  }
}
const confluenceSearchPagesTool = createTool({
  id: "confluence-search-pages",
  description: "Confluence\u3067\u30DA\u30FC\u30B8\u3092\u691C\u7D22\u3057\u307E\u3059\uFF08CQL\u30AF\u30A8\u30EA\u5BFE\u5FDC\uFF09",
  inputSchema: z.object({
    cql: z.string().describe("CQL(Confluence Query Language)\u691C\u7D22\u30AF\u30A8\u30EA")
  }),
  outputSchema: z.object({
    pages: z.array(
      z.object({
        id: z.string().describe("\u30DA\u30FC\u30B8\u306EID"),
        title: z.string().describe("\u30DA\u30FC\u30B8\u306E\u30BF\u30A4\u30C8\u30EB"),
        url: z.string().optional().describe("\u30DA\u30FC\u30B8\u306EURL")
      })
    ),
    total: z.number().describe("\u691C\u7D22\u7D50\u679C\u306E\u7DCF\u6570"),
    error: z.string().optional().describe("\u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8")
  }),
  execute: async ({ context }) => {
    console.log(context);
    const params = new URLSearchParams();
    params.append("cql", context.cql);
    try {
      const data = await callConfluenceAPI(`/search?${params.toString()}`);
      const pages = data.results.map((result) => ({
        id: result.content?.id,
        title: result.content?.title,
        url: result.url ? `${CONFLUENCE_BASE_URL}/wiki${result.url}` : void 0
      }));
      return { pages, total: data.totalSize };
    } catch (error) {
      return { pages: [], total: 0, error: String(error) };
    }
  }
});
const confluenceGetPageTool = createTool({
  id: "confluence-get-page",
  description: "\u6307\u5B9A\u3055\u308C\u305FID\u306EConfluence\u30DA\u30FC\u30B8\u306E\u8A73\u7D30\u3092\u53D6\u5F97\u3057\u307E\u3059",
  inputSchema: z.object({
    pageId: z.string().describe("\u53D6\u5F97\u3059\u308B\u30DA\u30FC\u30B8\u306EID"),
    expand: z.string().optional().describe("\u8FFD\u52A0\u3067\u53D6\u5F97\u3059\u308B\u60C5\u5831\uFF08body.storage,version,space\uFF09")
  }),
  outputSchema: z.object({
    page: z.object({
      id: z.string().describe("\u30DA\u30FC\u30B8\u306EID"),
      title: z.string().describe("\u30DA\u30FC\u30B8\u306E\u30BF\u30A4\u30C8\u30EB"),
      url: z.string().describe("\u30DA\u30FC\u30B8\u306EURL"),
      content: z.string().optional().describe("\u30DA\u30FC\u30B8\u306E\u30B3\u30F3\u30C6\u30F3\u30C4\uFF08HTML\u5F62\u5F0F\uFF09")
    }),
    error: z.string().optional().describe("\u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8")
  }),
  execute: async ({ context }) => {
    const params = new URLSearchParams();
    if (context.expand) params.append("expand", context.expand);
    try {
      const endpoint = `/content/${context.pageId}${params.toString() ? `?${params.toString()}` : ""}`;
      const page = await callConfluenceAPI(endpoint);
      return {
        page: {
          id: page.id,
          title: page.title,
          url: `${CONFLUENCE_BASE_URL}/wiki${page._links?.webui}`,
          content: page.body?.strage?.value || void 0
        }
      };
    } catch (error) {
      return {
        error: String(error),
        page: { id: "", title: "", url: "", content: void 0 }
      };
    }
  }
});

export { confluenceGetPageTool, confluenceSearchPagesTool };
