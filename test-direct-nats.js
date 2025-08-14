import { connect, StringCodec } from 'nats'

const sc = StringCodec()

async function testDirectNATS() {
  console.log('🧪 Direct NATS Test')
  console.log('Testing if messages reach the ingress.in subject')
  console.log('=' .repeat(60))
  
  try {
    const nc = await connect({ servers: 'nats://localhost:4222' })
    console.log('✅ Connected to NATS')
    
    // Create a test conversation ID
    const conversationId = 'test-direct-' + Date.now()
    const legId = crypto.randomUUID()
    const subject = `cp.conv.${conversationId}.${legId}.ingress.in`
    
    console.log(`📡 Subscribing to: ${subject}`)
    
    // Subscribe to the subject
    const sub = nc.subscribe(subject)
    let messageReceived = false
    
    // Process messages
    ;(async () => {
      for await (const msg of sub) {
        const data = JSON.parse(sc.decode(msg.data))
        console.log('✅ Message received!')
        console.log('   Type:', data.name)
        console.log('   Text:', data.payload?.text)
        messageReceived = true
      }
    })()
    
    // Wait a moment for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Publish a test message
    const testMessage = {
      id: crypto.randomUUID(),
      version: '1',
      tenant_id: '3b894d3f-13d3-41d0-b48a-3d8cd0075b32',
      conversation_id: conversationId,
      participant_id: 'test-participant',
      timestamp: Date.now(),
      correlation_id: crypto.randomUUID(),
      name: 'UserMessage',
      payload: {
        text: 'Test message direct to NATS',
        leg_id: legId,
        direction: 'inbound',
      }
    }
    
    console.log(`\n📤 Publishing test message to: ${subject}`)
    await nc.publish(subject, sc.encode(JSON.stringify(testMessage)))
    
    // Wait to see if we receive it
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (messageReceived) {
      console.log('\n✅ SUCCESS: Message loop works!')
    } else {
      console.log('\n❌ FAILED: Message was not received')
    }
    
    await nc.close()
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testDirectNATS()
