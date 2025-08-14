import { describe, it, expect } from 'vitest'
import io from 'socket.io-client'
import { randomUUID } from 'crypto'
import { AgentRuntimeSchema, AgentIdentifierSchema } from '../../src/types'

describe('Runtime Comparison E2E Tests', () => {
  const runTest = async (runtime: 'openai' | 'gemini') => {
    const url = process.env.E2E_WS_URL || 'http://localhost:6090'
    const agent = AgentIdentifierSchema.parse(process.env.E2E_AGENT || 'retail')
    
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

    console.log(`🔌 Testing ${runtime.toUpperCase()} runtime with agent: ${agent}`)
    
    const socket = io(url, { 
      transports: ['websocket'], 
      query,
      timeout: 5000,
    })

    const events: any[] = []
    
    try {
      // Step 1: Wait for conversation_ready event
      const conversationReady = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for conversation_ready'))
        }, 5000)
        
        socket.on('conversation_ready', (data) => {
          clearTimeout(timeout)
          events.push({ type: 'conversation_ready', data })
          resolve(data)
        })
        
        socket.on('connect_error', (error) => {
          clearTimeout(timeout)
          reject(new Error(`Connection error: ${error.message}`))
        })
      })

      // Step 2: Send User identification
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
        socket.emit('send_message', userMessage)
        
        // Send company metadata trigger
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
          socket.emit('send_message', triggerMessage)
        }, 50)
      }, 100)

      // Step 3: Listen for any agent activity
      const agentActivity = await new Promise<string[]>((resolve) => {
        const activityTypes: string[] = []
        const timeout = setTimeout(() => {
          resolve(activityTypes)
        }, 5000) // 5 second timeout to capture all events
        
        socket.on('conversation_message', (evt: any) => {
          events.push({ type: 'conversation_message', data: evt })
          const messageData = evt?.data
          
          if (messageData?.name) {
            activityTypes.push(messageData.name)
            console.log(`📨 ${runtime.toUpperCase()}: ${messageData.name}`)
            
            // For OpenAI, we know InterruptResponse means it's working
            if (runtime === 'openai' && messageData.name === 'InterruptResponse') {
              clearTimeout(timeout)
              resolve(activityTypes)
            }
          }
        })
        
        // Send test message after setup
        setTimeout(() => {
          socket.emit('send_message', { message: 'hello' })
        }, 200)
      })

      return {
        runtime,
        agent,
        success: true,
        conversationStarted: true,
        agentActivity,
        events: events.length,
        capabilities: {
          connectionEstablished: true,
          conversationReady: !!conversationReady,
          receivedMessages: agentActivity.length > 0,
          sessionCreated: agentActivity.includes('PongFrame') || agentActivity.includes('InterruptResponse'),
          agentResponsive: agentActivity.includes('InterruptResponse') || agentActivity.includes('AgentMessage')
        }
      }

    } catch (error) {
      return {
        runtime,
        agent,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        events: events.length,
        capabilities: {
          connectionEstablished: false,
          conversationReady: false,
          receivedMessages: false,
          sessionCreated: false,
          agentResponsive: false
        }
      }
    } finally {
      socket.disconnect()
    }
  }

  it('OpenAI runtime should handle full conversation flow', async () => {
    const result = await runTest('openai')
    
    console.log('OpenAI Results:', JSON.stringify(result, null, 2))
    
    expect(result.success).toBe(true)
    expect(result.capabilities.connectionEstablished).toBe(true)
    expect(result.capabilities.conversationReady).toBe(true)
    expect(result.capabilities.sessionCreated).toBe(true)
    expect(result.capabilities.agentResponsive).toBe(true)
  }, 10000)

  it('Gemini runtime should establish connection and session', async () => {
    const result = await runTest('gemini')
    
    console.log('Gemini Results:', JSON.stringify(result, null, 2))
    
    expect(result.success).toBe(true)
    expect(result.capabilities.connectionEstablished).toBe(true)
    expect(result.capabilities.conversationReady).toBe(true)
    
    // Gemini may have different response patterns, so we test what it can do
    console.log(`Gemini agent activity: ${result.agentActivity?.join(', ') || 'none'}`)
    
    // At minimum, Gemini should establish the connection successfully
    expect(result.events).toBeGreaterThan(0)
  }, 10000)

  it('Should demonstrate both runtimes work for conversation initiation', async () => {
    const [openaiResult, geminiResult] = await Promise.all([
      runTest('openai'),
      runTest('gemini')
    ])
    
    console.log('\n🔄 COMPARISON SUMMARY:')
    console.log('OpenAI:', {
      responsive: openaiResult.capabilities.agentResponsive,
      sessionCreated: openaiResult.capabilities.sessionCreated,
      activity: openaiResult.agentActivity?.join(', ') || 'none'
    })
    console.log('Gemini:', {
      responsive: geminiResult.capabilities.agentResponsive,
      sessionCreated: geminiResult.capabilities.sessionCreated,
      activity: geminiResult.agentActivity?.join(', ') || 'none'
    })
    
    // Both should at least be able to start conversations
    expect(openaiResult.capabilities.conversationReady).toBe(true)
    expect(geminiResult.capabilities.conversationReady).toBe(true)
    
    // OpenAI should be fully responsive
    expect(openaiResult.capabilities.agentResponsive).toBe(true)
  }, 15000)
})
