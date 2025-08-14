/**
 * Manual UI test that mimics what happens when user clicks "Connect" button
 * This simulates the exact flow the UI goes through
 */

const io = require('socket.io-client')
const { randomUUID } = require('crypto')

async function testUIFlow(runtime = 'openai', agent = 'retail') {
  console.log(`\n🧪 Testing UI flow with runtime: ${runtime}, agent: ${agent}`)
  
  const url = 'http://localhost:6090'
  const tenantId = '3b894d3f-13d3-41d0-b48a-3d8cd0075b32'
  const conversationId = randomUUID()
  const participantId = randomUUID()

  // Agent configs (same as UI)
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

  // Step 1: Connect with same query as UI
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
    let receivedResponses = []

    const timeout = setTimeout(() => {
      socket.disconnect()
      console.log(`❌ ${runtime.toUpperCase()}: Timeout - no agent response`)
      resolve({
        runtime,
        agent,
        success: false,
        conversationReady,
        userIdSent,
        testMessageSent,
        receivedResponses,
        error: 'Timeout'
      })
    }, 5000)

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
        conversationReady: false,
        userIdSent: false,
        testMessageSent: false,
        receivedResponses: [],
        error: error.message
      })
    })

    socket.on('conversation_ready', (data) => {
      console.log(`📋 ${runtime.toUpperCase()}: Conversation ready`)
      conversationReady = true
      
      // Step 2: Send User identification (like UI does)
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

        // Step 3: Send a test message (like UI sendMessage function)
        setTimeout(() => {
          const companyName = agentConfig.company
          const testMessage = {
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
              text: 'Hello, can you help me?',
              leg_id: randomUUID(),
              direction: 'inbound',
            },
          }
          
          console.log(`📤 ${runtime.toUpperCase()}: Sending test message`)
          socket.emit('send_message', testMessage)
          testMessageSent = true
        }, 200)
      }, 100)
    })

    socket.on('conversation_message', (data) => {
      if (data && data.data) {
        const msgData = data.data
        const msgType = msgData.name || 'Unknown'
        receivedResponses.push(msgType)
        
        console.log(`📨 ${runtime.toUpperCase()}: Received ${msgType}`)
        
        // Check for various types of agent responses
        if (msgType === 'AgentMessage' || 
            msgType === 'IntermediateAgentMessage' ||
            msgType === 'InterruptResponse' ||
            msgType === 'PongFrame') {
          
          clearTimeout(timeout)
          socket.disconnect()
          
          console.log(`🎉 ${runtime.toUpperCase()}: SUCCESS - Agent responded with ${msgType}`)
          resolve({
            runtime,
            agent,
            success: true,
            conversationReady,
            userIdSent,
            testMessageSent,
            receivedResponses,
            finalResponseType: msgType
          })
        }
      }
    })

    socket.on('message_sent', (data) => {
      console.log(`📤 ${runtime.toUpperCase()}: Message sent confirmation`)
    })

    socket.on('error', (error) => {
      clearTimeout(timeout)
      socket.disconnect()
      console.log(`❌ ${runtime.toUpperCase()}: Socket error:`, error)
      resolve({
        runtime,
        agent,
        success: false,
        conversationReady,
        userIdSent,
        testMessageSent,
        receivedResponses,
        error: error.toString()
      })
    })
  })
}

async function runTests() {
  console.log('🚀 Starting Manual UI Flow Tests')
  console.log('This simulates exactly what happens when you click "Connect" in the UI\n')
  
  // Test both runtimes
  const results = []
  
  // Test OpenAI
  const openaiResult = await testUIFlow('openai', 'retail')
  results.push(openaiResult)
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test Gemini
  const geminiResult = await testUIFlow('gemini', 'retail')
  results.push(geminiResult)
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 MANUAL UI TEST RESULTS SUMMARY')
  console.log('='.repeat(60))
  
  results.forEach(result => {
    console.log(`\n${result.runtime.toUpperCase()} Runtime:`)
    console.log(`  ✅ Connection: ${result.conversationReady ? 'SUCCESS' : 'FAILED'}`)
    console.log(`  ✅ User ID Sent: ${result.userIdSent ? 'SUCCESS' : 'FAILED'}`)
    console.log(`  ✅ Test Message Sent: ${result.testMessageSent ? 'SUCCESS' : 'FAILED'}`)
    console.log(`  ✅ Agent Response: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    
    if (result.success) {
      console.log(`  🎯 Final Response: ${result.finalResponseType}`)
      console.log(`  📋 All Responses: ${result.receivedResponses.join(', ')}`)
    } else {
      console.log(`  ❌ Error: ${result.error || 'No agent response'}`)
      if (result.receivedResponses.length > 0) {
        console.log(`  📋 Received: ${result.receivedResponses.join(', ')}`)
      }
    }
  })
  
  const workingRuntimes = results.filter(r => r.success).length
  console.log(`\n🏆 Overall: ${workingRuntimes}/${results.length} runtimes working correctly`)
  
  if (workingRuntimes === results.length) {
    console.log('🎉 ALL RUNTIMES WORKING! UI should function correctly.')
  } else if (workingRuntimes > 0) {
    console.log('⚠️  PARTIAL SUCCESS: Some runtimes working, others need debugging.')
  } else {
    console.log('❌ NO RUNTIMES WORKING: UI will not function correctly.')
  }
  
  process.exit(0)
}

runTests().catch(console.error)
