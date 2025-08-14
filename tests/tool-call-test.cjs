/**
 * Test tool calls by asking the agent to do something that requires tools
 */

const io = require('socket.io-client')
const { randomUUID } = require('crypto')

async function testToolCalls(runtime = 'gemini', agent = 'retail') {
  console.log(`\n🧪 Testing Tool Calls with runtime: ${runtime}, agent: ${agent}`)
  
  const url = 'http://localhost:6090'
  const tenantId = '3b894d3f-13d3-41d0-b48a-3d8cd0075b32'
  const conversationId = randomUUID()
  const participantId = randomUUID()

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
  const agentConfig = agentConfigs[agentType] || agentConfigs.retail

  const query = {
    tenantId,
    conversationId,
    participantId,
    agentRuntime: runtime,
    agent,
    welcomeMessage: agentConfig.welcomeMessage,
    memory: 'false',
    company: agentConfig.company,
  }

  console.log('🔌 Connecting with query:', query)

  return new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ['websocket'],
      query,
    })

    let conversationReady = false
    let userIdSent = false
    let testMessageSent = false
    let toolCallsReceived = []
    let toolResponsesReceived = []
    let agentMessagesReceived = []

    const timeout = setTimeout(() => {
      socket.disconnect()
      console.log(`⏰ ${runtime.toUpperCase()}: Test completed after 15 seconds`)
      resolve({
        runtime,
        agent,
        conversationReady,
        userIdSent,
        testMessageSent,
        toolCallsReceived,
        toolResponsesReceived,
        agentMessagesReceived,
        totalEvents: toolCallsReceived.length + toolResponsesReceived.length + agentMessagesReceived.length
      })
    }, 15000) // 15 second test

    socket.on('connect', () => {
      console.log(`✅ ${runtime.toUpperCase()}: Connected to WebSocket`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`❌ ${runtime.toUpperCase()}: Disconnected:`, reason)
    })

    socket.on('connect_error', (error) => {
      clearTimeout(timeout)
      socket.disconnect()
      console.log(`❌ ${runtime.toUpperCase()}: Connection error:`, error.message)
      resolve({
        runtime,
        agent,
        success: false,
        error: error.message
      })
    })

    socket.on('conversation_ready', (data) => {
      console.log(`📋 ${runtime.toUpperCase()}: Conversation ready`)
      conversationReady = true
      
      // Send User identification
      setTimeout(() => {
        const userMessage = {
          id: randomUUID(),
          version: '1',
          tenant_id: tenantId,
          conversation_id: data.conversation_id,
          participant_id: participantId,
          timestamp: Date.now(),
          correlation_id: randomUUID(),
          name: 'User',
          payload: {
            user_id: participantId,
            leg_id: randomUUID(),
            direction: 'inbound',
          },
        }
        
        console.log(`📤 ${runtime.toUpperCase()}: Sending user identification`)
        socket.emit('send_message', userMessage)
        userIdSent = true

        // Send company metadata in a separate message
        setTimeout(() => {
          const companyName = agentConfig.company
          const metadataMessage = {
            id: randomUUID(),
            version: '1',
            tenant_id: tenantId,
            conversation_id: data.conversation_id,
            participant_id: participantId,
            timestamp: Date.now(),
            correlation_id: randomUUID(),
            name: 'UserMessage',
            metadata: { 
              companyName 
            },
            payload: {
              text: 'I want to find some shoes for running', // This should trigger product search tools
              leg_id: randomUUID(),
              direction: 'inbound',
            },
          }
          
          console.log(`📤 ${runtime.toUpperCase()}: Sending product search request`)
          socket.emit('send_message', metadataMessage)
          testMessageSent = true
        }, 300)
      }, 100)
    })

    socket.on('conversation_message', (data) => {
      if (data && data.data) {
        const msgData = data.data
        const msgType = msgData.name || 'Unknown'
        
        console.log(`📨 ${runtime.toUpperCase()}: Received ${msgType}`)
        
        if (msgType === 'ToolCall') {
          toolCallsReceived.push({
            name: msgData.payload?.name || 'unknown',
            arguments: msgData.payload?.arguments || {},
            timestamp: msgData.timestamp
          })
          console.log(`🔧 ${runtime.toUpperCase()}: TOOL CALL - ${msgData.payload?.name}`)
        } else if (msgType === 'ToolResponse' || msgType === 'ToolCallResult') {
          toolResponsesReceived.push({
            tool: msgData.payload?.tool_name || 'unknown',
            result: msgData.payload?.result || {},
            timestamp: msgData.timestamp
          })
          console.log(`📦 ${runtime.toUpperCase()}: TOOL RESPONSE - ${msgData.payload?.tool_name}`)
        } else if (msgType === 'AgentMessage') {
          agentMessagesReceived.push({
            text: msgData.payload?.text || '',
            timestamp: msgData.timestamp
          })
          console.log(`🤖 ${runtime.toUpperCase()}: AGENT MESSAGE - ${msgData.payload?.text?.substring(0, 50)}...`)
        }
      }
    })

    socket.on('message_sent', (data) => {
      console.log(`📤 ${runtime.toUpperCase()}: Message sent confirmation`)
    })

    socket.on('error', (error) => {
      console.log(`❌ ${runtime.toUpperCase()}: Socket error:`, error)
    })
  })
}

async function runToolCallTests() {
  console.log('🔧 Starting Tool Call Tests')
  console.log('Testing if agents make tool calls when asked to search for products\n')
  
  // Test Gemini (should now show tool calls!)
  const geminiResult = await testToolCalls('gemini', 'retail')
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Test OpenAI for comparison
  const openaiResult = await testToolCalls('openai', 'retail')
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('🔧 TOOL CALL TEST RESULTS')
  console.log('='.repeat(60))
  
  [geminiResult, openaiResult].forEach(result => {
    console.log(`\n${result.runtime.toUpperCase()} Results:`)
    console.log(`  📋 Connection: ${result.conversationReady ? 'SUCCESS' : 'FAILED'}`)
    console.log(`  📤 Messages Sent: ${result.testMessageSent ? 'SUCCESS' : 'FAILED'}`)
    console.log(`  🔧 Tool Calls: ${result.toolCallsReceived?.length || 0}`)
    console.log(`  📦 Tool Responses: ${result.toolResponsesReceived?.length || 0}`)
    console.log(`  🤖 Agent Messages: ${result.agentMessagesReceived?.length || 0}`)
    console.log(`  📊 Total Events: ${result.totalEvents || 0}`)
    
    if (result.toolCallsReceived?.length > 0) {
      console.log(`  🎯 Tool Calls Made:`)
      result.toolCallsReceived.forEach(call => {
        console.log(`    - ${call.name}`)
      })
    }
    
    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`)
    }
  })
  
  const totalToolCalls = (geminiResult.toolCallsReceived?.length || 0) + (openaiResult.toolCallsReceived?.length || 0)
  console.log(`\n🏆 Overall: ${totalToolCalls} total tool calls detected`)
  
  if (totalToolCalls > 0) {
    console.log('🎉 SUCCESS: Tool calls are working!')
  } else {
    console.log('❌ ISSUE: No tool calls detected. Check agent configuration.')
  }
  
  process.exit(0)
}

runToolCallTests().catch(console.error)
