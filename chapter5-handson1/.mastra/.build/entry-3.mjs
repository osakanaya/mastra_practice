import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { process } from 'zod/v4/core';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const githubCreateIssueTool = createTool({
  id: "githubCreateIssue",
  description: "GitHub\u4E0A\u3067\u8907\u6570\u306EIssue\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002\u30D0\u30B0\u5831\u544A\u3001\u6A5F\u80FD\u8981\u6C42\u3001\u8CEA\u554F\u306A\u3069\u306B\u4F7F\u7528\u3067\u304D\u307E\u3059\u3002",
  inputSchema: z.object({
    owner: z.string().describe("\u30EA\u30DD\u30B8\u30C8\u30EA\u306E\u6240\u6709\u8005\u540D\uFF08\u30E6\u30FC\u30B6\u30FC\u540D\u307E\u305F\u306Fornigazation\u540D\uFF09"),
    repo: z.string().describe("\u30EC\u30DD\u30B8\u30C8\u30EA\u540D"),
    issues: z.array(z.object({
      title: z.string().describe("Issue\u306E\u30BF\u30A4\u30C8\u30EB"),
      body: z.string().optional().describe("Issue\u306E\u672C\u6587\u30FB\u8A73\u7D30\u8AAC\u660E")
    })).describe("\u4F5C\u6210\u3059\u308BIssue\u306E\u30EA\u30B9\u30C8")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    createdIssues: z.array(z.object({
      issueNumber: z.number().optional(),
      issueUrl: z.string().optional(),
      title: z.string()
    })),
    errors: z.array(z.string()).optional()
  }),
  execute: async ({ input }) => {
    const { owner, repo, issues } = input;
    const createdIssues = [];
    const errors = [];
    for (const issue of issues) {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: issue.title,
            body: issue.body
          })
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = `GitHub API \u30A8\u30E9\u30FC: ${response.status} - ${errorData.message || "Unknown error"}`;
          errors.push(`Failed to create issue "${issue.title}": ${errorMessage}`);
          continue;
        }
        const issueData = await response.json();
        createdIssues.push({
          issueNumber: issueData.number,
          issueUrl: issueData.html_url,
          title: issue.title
        });
      } catch (error) {
        const errorMessage = `\u30EA\u30AF\u30A8\u30B9\u30C8\u5931\u6557: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(`Error creating issue "${issue.title}": ${errorMessage}`);
      }
    }
    return {
      success: createdIssues.length,
      createdIssues,
      errors: errors.length > 0 ? errors : void 0
    };
  }
});

export { githubCreateIssueTool };
