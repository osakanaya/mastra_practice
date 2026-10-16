import { Agent } from "@mastra/core/agent";
import { bedrock } from "@ai-sdk/amazon-bedrock";

export const assistantAgent = new Agent({
    name: "assistant",
    instructions: "あなたは親切で知識豊富なAIアシスタントです。ユーザーの質問に対して、判りやすく丁寧に回答してください。",
    model: bedrock("us.anthropic.claude-sonnet-5-5")
});