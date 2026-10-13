'use server';
/**
 * @fileOverview Flow for handling conversational chat with Hermes Agent in WSL.
 *
 * - chat - A function that takes user input and optional image data and returns a text response from Hermes.
 * - ChatInput - The input type for the chat function.
 * - ChatOutput - The return type for the chat function.
 */

import { z } from 'genkit';
import { executeHermesChat } from '@/lib/hermes';

const ChatInputSchema = z.object({
  history: z.array(z.any()).optional().describe('The chat history.'),
  message: z.string().describe("The user's message."),
  photoDataUri: z.optional(z.string()).describe(
    "A photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  sessionId: z.optional(z.string()).describe("Hermes session ID to continue."),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export type ChatOutput = string;

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const result = await executeHermesChat(input.message, {
    sessionId: input.sessionId,
  });
  return result.text;
}
