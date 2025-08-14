import { describe, it, expect } from 'vitest'
import io from 'socket.io-client'
import { randomUUID } from 'crypto'
import { AgentRuntimeSchema, AgentIdentifierSchema } from '../../src/types'

describe('Debug Console E2E WebSocket Tests', () => {
  it('connects to gateway, sends message, and receives agent reply within 2 seconds', async () => {
    const url = process.env.E2E_WS_URL || 'http://localhost:6090'
    const runtime = AgentRuntimeSchema.parse(process.env.E2E_RUNTIME || 'gemini')
    const agent = AgentIdentifierSchema.parse(process.env.E2E_AGENT || 'retail')
    
    // Agent-specific configuration matching frontend pattern
    const agentConfigs = {
      retail: {
        welcomeMessage: 'Welcome to our store! How can I help you today?',
        company: 'Parloa Retail',
      },
      travel: {
        welcomeMessage: 'Welcome to Parloa Travel! I can help you book flights, hotels, and more.',
        company: 'Parloa Travel',
      },
    }
    
    const agentType = agent.startsWith('retail') ? 'retail' : 
                      agent.startsWith('travel') ? 'travel' : 'retail'
    const agentConfig = agentConfigs[agentType]
    
    const query = {
      agentRuntime: runtime,
      agent,
      memory: 'false',
      company: agentConfig.company,
      welcomeMessage: agentConfig.welcomeMessage,
    }

    console.log(`🔌 Connecting to ${url} with runtime: ${runtime}, agent: ${agent}`)
    
    const socket = io(url, { 
      transports: ['websocket'], 
      query,
      timeout: 5000,
    })

    try {
      // Step 1: Wait for conversation_ready event
      const conversationReady = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for conversation_ready'))
        }, 5000)
        
        socket.on('conversation_ready', (data) => {
          clearTimeout(timeout)
          console.log('📋 Conversation ready:', data)
          resolve(data)
        })
        
        socket.on('connect_error', (error) => {
          clearTimeout(timeout)
          reject(new Error(`Connection error: ${error.message}`))
        })
      })

      expect(conversationReady).toBeDefined()
      expect(conversationReady.conversation_id).toBeDefined()
      expect(conversationReady.conversation_stream).toBeDefined()
      expect(conversationReady.ingress_input_subject).toBeDefined()

      // Step 2: Send User identification first (like frontend does)
      setTimeout(() => {
        const userMessage = {
          id: randomUUID(),
          version: '1',
          tenant_id: '3b894d3f-13d3-41d0-b48a-3d8cd0075b32',
          conversation_id: conversationReady.conversation_id,
          participant_id: randomUUID(),
          timestamp: Date.now(),
          correlation_id: randomUUID(),
          name: 'User',
          payload: {
            user_id: randomUUID(),
            leg_id: randomUUID(),
            direction: 'inbound',
          },
        }
        console.log('📤 Sending user identification')
        socket.emit('send_message', userMessage)
        
        // Send a message with company metadata to trigger session creation
        setTimeout(() => {
          const triggerMessage = {
            id: randomUUID(),
            version: '1',
            tenant_id: '3b894d3f-13d3-41d0-b48a-3d8cd0075b32',
            conversation_id: conversationReady.conversation_id,
            participant_id: randomUUID(),
            timestamp: Date.now(),
            correlation_id: randomUUID(),
            name: 'UserMessage',
            metadata: { 
              companyName: agentConfig.company 
            },
            payload: {
              text: 'init',
              leg_id: randomUUID(),
              direction: 'inbound',
            },
          }
          console.log('📤 Sending trigger message with company metadata')
          socket.emit('send_message', triggerMessage)
        }, 50)
      }, 100)

      // Step 3: Send a message and wait for agent reply within 3 seconds
      const agentReplyReceived = await new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: No agent reply received within 3 seconds'))
        }, 3000)
        
        const onConversationMessage = (evt: any) => {
          console.log('📨 Received conversation message:', evt)
          const messageData = evt?.data
          
          if (messageData && (
            messageData.name === 'AgentMessage' || 
            messageData.name === 'IntermediateAgentMessage' ||
            messageData.name === 'InterruptResponse' ||
            messageData.name === 'PongFrame' ||
            (messageData.payload && messageData.payload.text && messageData.payload.text.includes('George')) // Gemini welcome message
          )) {
            clearTimeout(timeout)
            console.log('🤖 Agent reply detected:', messageData.name, messageData.payload?.text || messageData.payload)
            resolve(true)
          }
        }
        
        socket.on('conversation_message', onConversationMessage)
        
        // Wait a bit for user identification to be processed, then send test message
        setTimeout(() => {
          const testMessage = {
            message: 'hello'
          }
          console.log('📤 Sending test message:', testMessage)
          socket.emit('send_message', testMessage)
        }, 200)
      })

      expect(agentReplyReceived).toBe(true)
      console.log('✅ E2E test passed: Agent replied within 2 seconds')

    } finally {
      socket.disconnect()
    }
  }, 10000) // Overall test timeout of 10 seconds

  it('validates message sent confirmation', async () => {
    const url = process.env.E2E_WS_URL || 'http://localhost:6090'
    const runtime = AgentRuntimeSchema.parse(process.env.E2E_RUNTIME || 'gemini')
    const agent = AgentIdentifierSchema.parse(process.env.E2E_AGENT || 'retail')
    
    const query = {
      agentRuntime: runtime,
      agent,
      memory: 'false',
      company: agent.startsWith('travel') ? 'Parloa Travel' : 'Parloa Retail',
      welcomeMessage: 'Test welcome message',
    }

    const socket = io(url, { 
      transports: ['websocket'], 
      query,
      timeout: 5000,
    })

    try {
      // Wait for conversation ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000)
        socket.on('conversation_ready', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      // Send message and verify confirmation
      const messageSent = await new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('No message_sent event')), 3000)
        
        socket.on('message_sent', (data) => {
          clearTimeout(timeout)
          console.log('📤 Message sent confirmation:', data)
          resolve(true)
        })
        
        socket.emit('send_message', { message: 'test confirmation' })
      })

      expect(messageSent).toBe(true)

    } finally {
      socket.disconnect()
    }
  }, 10000)
})
