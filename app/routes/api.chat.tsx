import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { message, conversationId } = await request.json();

  // Find or create conversation
  let conversation = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : await prisma.conversation.create({
        data: { shop: session.shop, sessionId: session.id },
        include: { messages: true },
      });

  // Save user message
  await prisma.message.create({
    data: { conversationId: conversation!.id, role: "user", content: message },
  });

  // Build message history for Anthropic
  const history = (conversation!.messages ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Call Anthropic with Haiku
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: `You are ShopMate, a helpful AI assistant for the Shopify store ${session.shop}. You help customers with order tracking, product recommendations, returns, and general questions. Be friendly, concise, and helpful. If asked about a specific order, ask for their order number and email to verify.`,
    messages: [...history, { role: "user", content: message }],
  });

  const assistantMessage =
    response.content[0].type === "text"
      ? response.content[0].text
      : "Sorry, I could not process that.";

  // Save assistant response
  await prisma.message.create({
    data: {
      conversationId: conversation!.id,
      role: "assistant",
      content: assistantMessage,
    },
  });

  return Response.json({
    reply: assistantMessage,
    conversationId: conversation!.id,
  });
};
