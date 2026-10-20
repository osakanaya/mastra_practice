import { Agent } from "@mastra/core/agent";
import { getBedrockModel } from "../../../lib/aws-config";
// import { bedrock } from "@ai-sdk/amazon-bedrock";

const model = await getBedrockModel();

export const assistantAgent = new Agent({
    name: "assistant",
    instructions: "あなたは親切で知識豊富なAIアシスタントです。ユーザーの質問に対して、判りやすく丁寧に回答してください。",
    model: model
});