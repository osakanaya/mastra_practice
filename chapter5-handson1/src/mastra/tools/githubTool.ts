import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const githubCreateIssueTool = createTool({
    id: "githubCreateIssue",
    description: "GitHub上で複数のIssueを作成します。バグ報告、機能要求、質問などに使用できます。",
    inputSchema: z.object({
        owner: z.string().describe("リポジトリの所有者名（ユーザー名またはornigazation名）"),
        repo: z.string().describe("レポジトリ名"),
        issues: z.array(z.object({
            title: z.string().describe("Issueのタイトル"),
            body: z.string().optional().describe("Issueの本文・詳細説明")
        })).describe("作成するIssueのリスト")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        createdIssues: z.array(z.object({
            issueNumber: z.number().optional(),
            issueUrl: z.string().optional(),
            title: z.string()
        })),
        errors: z.array(z.string()).optional(),
    }),
    execute: async(input) => {
        console.log(input)
        const { owner, repo, issues } = input;
        const createdIssues: Array<{ issueNumber?: number; issueUrl?: string; title: string }> = [];
        const errors: string[] = [];

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
                        body: issue.body,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = `GitHub API エラー: ${response.status} - ${errorData.message || "Unknown error"}`;
                    errors.push(`Failed to create issue "${issue.title}": ${errorMessage}`);
                    
                    continue;
                }

                const issueData = await response.json();
                createdIssues.push({
                    issueNumber: issueData.number,
                    issueUrl: issueData.html_url,
                    title: issue.title,
                });
            } catch (error) {
                const errorMessage = `リクエスト失敗: ${error instanceof Error ? error.message : "Unknown error"}`;
                errors.push(`Error creating issue "${issue.title}": ${errorMessage}`);
            }
        }

        return {
            success: createdIssues.length,
            createdIssues,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
});
