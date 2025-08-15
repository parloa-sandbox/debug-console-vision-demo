import { z } from 'zod'

export const AgentRuntimeSchema = z.enum(['openai', 'gemini'])
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>

export const AgentIdentifierSchema = z.enum([
  'retail',
  'travel',
  'retail-greeter',
  'retail-faq',
  'retail-products',
  'retail-checkout',
  'travel-index',
  'travel-trip',
  'travel-faq',
  'travel-checkout',
  'travel-event'
])
export type AgentIdentifier = z.infer<typeof AgentIdentifierSchema>

export const MessageTypeSchema = z.enum([
  'UserMessage',
  'AgentMessage',
  'AudioFrame',
  'AudioFrame2',
  'User',
  'ConversationStarted',
  'ConversationEnded',
  'UserSpeakingStatus',
  'IntermediateUserMessage',
  'IntermediateAgentMessage',
  'ToolCall',
  'ToolResponse',
  'ToolOutput',
  'ToolInput',
  'Debug',
  'Error',
  'System'
])
export type MessageType = z.infer<typeof MessageTypeSchema>

export interface BaseMessage {
  id: string
  version: string
  tenant_id: string
  conversation_id: string
  participant_id: string
  timestamp: number
  correlation_id: string
  name: MessageType
  metadata?: Record<string, unknown>
}

export interface EventMessage {
  id: string
  timestamp: number
  type: MessageType
  direction: 'inbound' | 'outbound'
  payload: Record<string, unknown>
  raw?: unknown
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  timestamp: number
}

export interface ToolResponse {
  id: string
  callId: string
  result: unknown
  error?: string
  timestamp: number
}

export interface DebugSession {
  id: string
  startTime: number
  endTime?: number
  runtime: AgentRuntime
  agent: AgentIdentifier
  events: EventMessage[]
  toolCalls: ToolCall[]
  toolResponses: ToolResponse[]
}
