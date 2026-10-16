import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const assistantAgent = new Agent({
  name: "assistant",
  instructions: "\u3042\u306A\u305F\u306F\u89AA\u5207\u3067\u77E5\u8B58\u8C4A\u5BCC\u306AAI\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u306B\u5BFE\u3057\u3066\u3001\u5224\u308A\u3084\u3059\u304F\u4E01\u5BE7\u306B\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  model: bedrock("us.anthropic.claude-sonnet-5-5")
});

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

const confluenceSearchPageStep = createStep(confluenceSearchPagesTool);
const confluenceGetPageStep = createStep(confluenceGetPageTool);
const handsonWorkflow = createWorkflow({
  id: "handsonWorkflow",
  description: "\u81EA\u7136\u8A00\u8A9E\u306E\u8CEA\u554F\u304B\u3089Confluence\u3067\u8981\u4EF6\u6240\u3092\u691C\u7D22\u3057\u3001\u5185\u5BB9\u3092\u8981\u7D04\u3057\u3066\u56DE\u7B54\u3057\u307E\u3059\u3002",
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u3057\u305F\u3044\u5185\u5BB9\u3092\u81EA\u7136\u8A00\u8A9E\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B\uFF1A\u300CAI\u306B\u3064\u3044\u3066\u306E\u60C5\u5831\u300D\u300C\u6700\u65B0\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u60C5\u5831\u300D\uFF09")
  }),
  outputSchema: z.object({
    text: z.string().describe("\u8981\u7D04\u3055\u308C\u305F\u56DE\u7B54")
  })
}).then(
  createStep({
    id: "generate-cql-query",
    inputSchema: z.object({
      query: z.string()
    }),
    outputSchema: z.object({
      cql: z.string()
    }),
    execute: async ({ inputData }) => {
      const prompt = `
\u4EE5\u4E0B\u306E\u81EA\u7136\u8A00\u8A9E\u306E\u691C\u7D22\u8981\u6C42\u3092Confluence CQL (Confluence Query Language)\u306B\u5909\u63DB\u3057\u3066\u304F\u3060\u3055\u3044\u3002
CQL\u306E\u57FA\u672C\u7684\u306A\u69CB\u6587\uFF1A
- text ~ "\u691C\u7D22\u8A9E"\uFF1A\u5168\u6587\u691C\u7D22
- title ~ "\u30BF\u30A4\u30C8\u30EB"\uFF1A\u30BF\u30A4\u30C8\u30EB\u691C\u7D22
- space = "\u30B9\u30DA\u30FC\u30B9\u30AD\u30FC"\uFF1A\u7279\u5B9A\u306E\u30B9\u30DA\u30FC\u30B9\u5185\u691C\u7D22
- type = page\uFF1A\u30DA\u30FC\u30B8\u306E\u307F\u691C\u7D22
- created >= "2024-01-01"\uFF1A\u65E5\u4ED8\u30D5\u30A3\u30EB\u30BF


\u691C\u7D22\u8981\u6C42: ${inputData.query}


\u91CD\u8981\uFF1A
- \u5358\u7D14\u306A\u5358\u8A9E\u691C\u7D22\u306E\u5834\u5408\u306F\u3001text ~ "\u5358\u8A9E" \u306E\u5F62\u5F0F\u3092\u4F7F\u7528
- \u8907\u6570\u306E\u5358\u8A9E\u3092\u542B\u3080\u5834\u5408\u306F AND \u3067\u7D50\u5408
- \u65E5\u672C\u8A9E\u306E\u691C\u7D22\u8A9E\u3082\u305D\u306E\u307E\u307E\u4F7F\u7528\u53EF\u80FD
- \u30EC\u30B9\u30DD\u30F3\u30B9\u306FCQL\u30AF\u30A8\u30EA\u306E\u307F\u3092\u8FD4\u3057\u3066\u304F\u3060\u3055\u3044


CQL\u30AF\u30A8\u30EA:`;
      try {
        const result = await assistantAgent.generate(prompt);
        const cql = result.text.trim();
        return { cql };
      } catch (error) {
        const fallbackCql = `text ~ "${inputData.query}"`;
        return { cql: fallbackCql };
      }
    }
  })
).then(confluenceSearchPageStep).then(
  createStep({
    id: "select-first-page",
    inputSchema: z.object({
      pages: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          url: z.string().optional()
        })
      )
    }),
    outputSchema: z.object({
      pageId: z.string(),
      expand: z.string().optional()
    }),
    execute: async ({ inputData }) => {
      const { pages, error } = inputData;
      if (error) {
        throw new Error(`\u691C\u7D22\u30A8\u30E9\u30FC: ${error}`);
      }
      if (!pages || pages.length == 0) {
        throw new Error("\u691C\u7D22\u7D50\u679C\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
      }
      const firstPage = pages[0];
      return {
        pageId: firstPage.id,
        expand: "body.storage"
      };
    }
  })
).then(confluenceGetPageStep).then(
  createStep({
    id: "prepare-prompt",
    inputSchema: z.object({
      page: z.object({
        id: z.string(),
        title: z.string(),
        url: z.string(),
        content: z.string().optional()
      }),
      error: z.string().optional()
    }),
    outputSchema: z.object({
      prompt: z.string(),
      originalQuery: z.string(),
      pageTitle: z.string(),
      pageUrl: z.string()
    }),
    execute: async ({ inputData, getInitData }) => {
      const { page, error } = inputData;
      const initData = getInitData();
      if (error || !page || !page.content) {
        return {
          prompt: "\u30DA\u30FC\u30B8\u306E\u5185\u5BB9\u304C\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          originalQuery: initData.query || "",
          pageTitle: page?.title || "\u4E0D\u660E",
          pageUrl: page?.url || ""
        };
      }
      const prompt = `\u4EE5\u4E0B\u306EConfluence\u30DA\u30FC\u30B8\u306E\u5185\u5BB9\u306B\u57FA\u3065\u3044\u3066\u3001\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u306B\u7B54\u3048\u3066\u304F\u3060\u3055\u3044\u3002

\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F: ${initData.query}

\u30DA\u30FC\u30B8\u30BF\u30A4\u30C8\u30EB: ${page.title}
\u30DA\u30FC\u30B8\u5185\u5BB9:
${page.content}

\u56DE\u7B54\u306F\u7C21\u6F54\u3067\u5206\u304B\u308A\u3084\u3059\u304F\u3001\u5FC5\u8981\u306B\u5FDC\u3058\u3066\u7B87\u6761\u66F8\u304D\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
      return {
        prompt,
        originalQuery: initData.query || "",
        pageTitle: page.title,
        pageUrl: page.url
      };
    }
  })
).then(
  createStep({
    id: "assistant-response",
    inputSchema: z.object({
      prompt: z.string(),
      originalQuery: z.string(),
      pageTitle: z.string(),
      pageUrl: z.string()
    }),
    outputSchema: z.object({ text: z.string() }),
    execute: async ({ inputData }) => {
      try {
        const result = await assistantAgent.generate(inputData.prompt);
        return {
          text: result.txt
        };
      } catch (error) {
        return { text: "\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\uFF1A " + String(errror) };
      }
    }
  })
).commit();

const mastra = new Mastra({
  agents: {
    assistantAgent
  },
  workflows: {
    handsonWorkflow
  }
});

export { mastra };
