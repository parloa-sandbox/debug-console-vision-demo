# Debug Console

A debug tool that mirrors the frontend's WebSocket connection to monitor agent conversations in real-time.

## Features

- **Identical Flow**: Mirrors frontend's WebSocket/NATS connection exactly
- **Real-time Monitoring**: Observe all conversation events, tool calls, and agent responses
- **Configurable**: Supports different agent runtimes (OpenAI, Gemini) and agent types
- **E2E Tests**: Automated tests verify end-to-end agent communication
- **Standalone**: Will eventually live in a separate repository for external monitoring

## Quick Start

### Prerequisites

Ensure the main stack is running:

```bash
cd /path/to/hackathon-2025
docker-compose -f docker-compose.dev.yaml up
```

### Install & Run

```bash
cd debug-console
pnpm install
pnpm dev
```

The debug console will be available at `http://localhost:5173`

### Environment Variables

- `VITE_WS_URL` - WebSocket gateway URL (default: `http://localhost:6090`)

## Testing

### E2E Tests

Run automated tests that verify full agent communication:

```bash
pnpm test
```

### Test Configuration

Environment variables for E2E tests:

- `E2E_WS_URL` - WebSocket URL for tests (default: `http://localhost:6090`)
- `E2E_RUNTIME` - Agent runtime: `openai` | `gemini` (default: `openai`)  
- `E2E_AGENT` - Agent type: `retail` | `travel` | `retail-faq` | etc. (default: `retail`)

Example:
```bash
E2E_RUNTIME=gemini E2E_AGENT=travel pnpm test
```

## How It Works

### Connection Flow

1. **Connect**: Establishes WebSocket connection to `cpl-channel` on port 6090
2. **Handshake**: Sends agent runtime, agent type, company, and welcome message  
3. **Conversation Ready**: Receives conversation stream and ingress subjects
4. **User ID**: Sends user identification message
5. **Trigger Session**: Sends message with company metadata to initialize agent session
6. **Monitor**: Observes all conversation events (messages, tool calls, responses)

### Message Types Monitored

- `AgentMessage` - Final agent text responses
- `IntermediateAgentMessage` - Streaming agent responses  
- `ToolCall` - Function calls made by agent
- `ToolResponse` - Function call results
- `InterruptResponse` - Agent acknowledgment of user input
- `AudioFrame` - Audio chunks (if using voice)
- `UserMessage` - User text input
- `ConversationStarted/Ended` - Session lifecycle events

### File Structure

```
debug-console/
├── src/
│   ├── components/
│   │   ├── ControlPanel.tsx     # Connection controls and settings
│   │   ├── EventViewer.tsx      # Real-time event stream display  
│   │   └── ToolCallViewer.tsx   # Tool calls and responses
│   ├── lib/
│   │   ├── websocket-client.ts  # WebSocket client (mirrors frontend)
│   │   └── microphone-manager.ts # Audio recording manager
│   ├── types/
│   │   └── index.ts             # Type definitions
│   └── App.tsx                  # Main application
├── tests/
│   └── e2e/
│       └── websocket.e2e.test.ts # End-to-end tests
├── package.json                 # Dependencies and scripts
└── vite.config.ts              # Vite config with test setup
```

## Development

### Adding New Agent Types

1. Update `AgentIdentifierSchema` in `src/types/index.ts`
2. Add agent configuration in `websocket-client.ts`
3. Test with `E2E_AGENT=new-agent pnpm test`

### Debugging Connection Issues

1. Check docker-compose services: `docker-compose ps`
2. View agent logs: `docker-compose logs realtime-agent --tail=50`
3. Verify NATS connectivity: `docker-compose logs nats --tail=20`
4. Test WebSocket directly: Use browser dev tools on `localhost:6090`

## Architecture

The debug console replicates the frontend's exact connection pattern:

```
Debug Console → WebSocket (cpl-channel:6090) → NATS → Realtime Agent
     ↑                                                        ↓
     ←← Conversation Events ←← Message Bus ←←←←←←←←←←←←←←←←←←←←←
```

This ensures identical behavior to the production frontend, making it perfect for monitoring, debugging, and testing agent interactions.

## Future Plans

- **Standalone Deployment**: Will be extracted to separate repository
- **Enhanced Filtering**: Filter events by type, agent, or time range  
- **Session Recording**: Save and replay conversation sessions
- **Performance Metrics**: Track response times and success rates
- **Multi-tenant Support**: Monitor multiple tenants simultaneously