import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, owner, repo } = body;

        if (!query || !owner || !repo) {
            return NextResponse.json(
                { error: "必要なパラメータが不足しています" },
                { status: 400 }
            );
        }

        const { mastra } = await import("@/src/mastra");
        const workflow = mastra.getWorkflow("handsonWorkflow");

        if (!workflow) {
            throw new Error("ワークフローが見つかりません");
        }

        const run = await workflow.createRunAsync();
        const result = await run.start({
            inputData: { query, owner, repo }
        });
        
        let message;
        let isSuccess;

        if (result.status === "success" && result.result.success) {
            message = "ワークフローが正常に完了しました";
            isSuccess = true;
        } else {
            message = `${(result as any).error} ${(result as any).result.errors}`;
            isSuccess = false;
        }

        const workflowOutput = result.status === "success" ? result.result : null;
        const createdIssues = workflowOutput?.createdIssues || [];

        return NextResponse.json({
            success: isSuccess,
            confluencePages: [{
                title: query,
                message: "要件書の検索と取得を実行しました"
            }],
            githubIssues: createdIssues,
            message: message,
            steps: result.steps ? Object.keys(result.steps).map(stepId => ({
                stepId,
                status: (result.steps as any)[stepId].status
            })) : []
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: "ワークフローの実行中にエラーが発生しました",
                details: error instanceof Error ? error.message : "エラー"
            },
            { status: 400 }
        );
    }
}
