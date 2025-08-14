import io, { Socket } from 'socket.io-client'
import type { EventMessage, AgentRuntime, AgentIdentifier } from '@/types'

export interface WebSocketConfig {
  url: string
  runtime: AgentRuntime
  agent: AgentIdentifier
  tenantId?: string
  conversationId?: string
  participantId?: string
}

type EventHandler = (data: unknown) => void

export class DebugWebSocketClient {
  private socket: Socket | null = null
  private config: WebSocketConfig
  private eventHandlers: Record<string, EventHandler[]> = {}
  private isConnected = false
  private conversationInfo: {
    conversationId: string
    stream: string
    ingressSubject: string
  } | null = null

  constructor(config: WebSocketConfig) {
    this.config = {
      tenantId: config.tenantId || '3b894d3f-13d3-41d0-b48a-3d8cd0075b32',
      conversationId: config.conversationId || crypto.randomUUID(),
      participantId: config.participantId || crypto.randomUUID(),
      ...config,
    }
  }

  connect(): void {
    if (this.socket) {
      console.warn('Already connected')
      return
    }

    // Configure agent-specific settings like frontend does
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
    
    // For sub-agents (e.g., retail-faq), extract the main category
    const agentType = this.config.agent.startsWith('retail') ? 'retail' : 
                      this.config.agent.startsWith('travel') ? 'travel' : 'retail'
    const agentConfig = agentConfigs[agentType] || agentConfigs.retail
    
    const query = {
      tenantId: this.config.tenantId,
      conversationId: this.config.conversationId,
      participantId: this.config.participantId,
      agentRuntime: this.config.runtime,
      agent: this.config.agent,
      welcomeMessage: agentConfig.welcomeMessage,
      memory: 'false',
      company: agentConfig.company,
    }

    console.log('🔌 Connecting to WebSocket:', this.config.url, query)

    this.socket = io(this.config.url, {
      transports: ['websocket'],
      query,
    })

    this.setupEventListeners()
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnected = false
    this.conversationInfo = null
  }

  sendMessage(text: string): void {
    if (!this.isConnected || !this.socket) {
      console.error('Not connected')
      return
    }

    // Get company metadata for the agent
    const agentConfigs = {
      retail: { company: 'Parloa Retail' },
      travel: { company: 'Parloa Travel' },
    }
    const agentType = this.config.agent.startsWith('retail') ? 'retail' : 
                      this.config.agent.startsWith('travel') ? 'travel' : 'retail'
    const companyName = agentConfigs[agentType].company

    const message = {
      id: crypto.randomUUID(),
      version: '1',
      tenant_id: this.config.tenantId!,
      conversation_id: this.conversationInfo?.conversationId || this.config.conversationId!,
      participant_id: this.config.participantId!,
      timestamp: Date.now(),
      correlation_id: crypto.randomUUID(),
      name: 'UserMessage',
      metadata: { 
        companyName 
      },
      payload: {
        text,
        leg_id: crypto.randomUUID(),
        direction: 'inbound',
      },
    }

    console.log('📤 Sending message:', message)
    this.socket.emit('send_message', message)
  }

  sendAudioFrame(chunk: string): void {
    if (!this.isConnected || !this.socket) {
      console.error('Not connected')
      return
    }

    const frame = {
      id: crypto.randomUUID(),
      version: '1',
      tenant_id: this.config.tenantId!,
      conversation_id: this.conversationInfo?.conversationId || this.config.conversationId!,
      participant_id: this.config.participantId!,
      timestamp: Date.now(),
      correlation_id: crypto.randomUUID(),
      name: 'AudioFrame2',
      payload: {
        chunk,
        leg_id: crypto.randomUUID(),
        direction: 'inbound',
      },
    }

    this.socket.emit('send_message', frame)
  }

  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = []
    }
    this.eventHandlers[event].push(handler)
  }

  off(event: string, handler: EventHandler): void {
    if (!this.eventHandlers[event]) return
    const index = this.eventHandlers[event].indexOf(handler)
    if (index > -1) {
      this.eventHandlers[event].splice(index, 1)
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.isConnected = true
      console.log('✅ Connected to WebSocket! Socket ID:', this.socket!.id)
      this.emit('connected', { socketId: this.socket!.id })
    })

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false
      console.log('❌ Disconnected:', reason)
      this.emit('disconnected', { reason })
    })

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Connection error:', error.message)
      this.emit('error', { type: 'connect_error', message: error.message })
    })

    this.socket.on('conversation_ready', (data: unknown) => {
      console.log('📋 Conversation ready data:', data)
      if (
        typeof data === 'object' &&
        data &&
        'conversation_id' in data &&
        'conversation_stream' in data &&
        'ingress_input_subject' in data
      ) {
        const typedData = data as {
          conversation_id: string
          conversation_stream: string
          ingress_input_subject: string
        }
        this.conversationInfo = {
          conversationId: typedData.conversation_id,
          stream: typedData.conversation_stream,
          ingressSubject: typedData.ingress_input_subject,
        }
        this.config.conversationId = typedData.conversation_id
        
        console.log('🔗 Conversation info:', {
          conversationId: typedData.conversation_id,
          stream: typedData.conversation_stream,
          ingressSubject: typedData.ingress_input_subject,
          runtime: this.config.runtime,
          agent: this.config.agent
        })
        
        this.emit('conversation_ready', typedData)

        // Send user identification after conversation is ready (like frontend does)
        setTimeout(() => {
          this.sendUserIdentification()
        }, 100)
      }
    })

    // Handle conversation messages
    this.socket.on('conversation_message', (data: unknown) => {
      console.log('📨 Conversation message received:', data)
      this.emit('conversation_message', data)
      
      // Parse the conversation message and emit as debug_event
      if (typeof data === 'object' && data && 'data' in data) {
        const msgData = data as any
        const innerData = msgData.data
        
        // Create event from the message
        const event: EventMessage = {
          id: crypto.randomUUID(),
          timestamp: msgData.timestamp || innerData?.timestamp || Date.now(),
          type: innerData?.name || msgData.type || 'Unknown',
          direction: 'inbound',
          payload: innerData?.payload || innerData || msgData,
          raw: data,
        }
        
        this.emit('debug_event', event)
        
        // Log specific message types
        if (innerData?.name === 'AgentMessage') {
          console.log('🤖 Agent message:', innerData.payload?.text || innerData.payload)
        } else if (innerData?.name === 'AudioFrame' || innerData?.name === 'AudioFrame2') {
          console.log('🔊 Audio frame received')
        } else if (innerData?.name === 'IntermediateAgentMessage') {
          console.log('📝 Intermediate agent message:', innerData.payload?.text)
        } else if (innerData?.name === 'ToolCall') {
          console.log('🔧 Tool call:', innerData.payload?.name)
        } else if (innerData?.name === 'ToolResponse') {
          console.log('📦 Tool response received')
        }
      }
    })

    this.socket.on('message_received', (data: unknown) => {
      console.log('📬 Message received event:', data)
      this.emit('message_received', data)
    })

    this.socket.on('message_sent', (data: unknown) => {
      console.log('📤 Message sent confirmation:', data)
      this.emit('message_sent', data)
    })

    this.socket.on('error', (error: unknown) => {
      this.emit('error', error)
    })
  }

  private sendUserIdentification(): void {
    if (!this.socket || !this.isConnected) return

    const userMessage = {
      id: crypto.randomUUID(),
      version: '1',
      tenant_id: this.config.tenantId!,
      conversation_id: this.conversationInfo?.conversationId || this.config.conversationId!,
      participant_id: this.config.participantId!,
      timestamp: Date.now(),
      correlation_id: crypto.randomUUID(),
      name: 'User',
      payload: {
        user_id: this.config.participantId!,
        leg_id: crypto.randomUUID(),
        direction: 'inbound',
      },
    }

    console.log('📤 Sending user identification')
    this.socket.emit('send_message', userMessage)

    // Also send an audio frame with company metadata to trigger session creation (like frontend does)
    setTimeout(() => {
      this.sendInitialAudioFrame()
    }, 150)
  }

  private sendInitialAudioFrame(): void {
    if (!this.socket || !this.isConnected) return

    const agentConfigs = {
      retail: { company: 'Parloa Retail' },
      travel: { company: 'Parloa Travel' },
    }
    const agentType = this.config.agent.startsWith('retail') ? 'retail' : 
                      this.config.agent.startsWith('travel') ? 'travel' : 'retail'
    const companyName = agentConfigs[agentType].company

    const audioFrame = {
      id: crypto.randomUUID(),
      version: '1',
      tenant_id: this.config.tenantId!,
      conversation_id: this.conversationInfo?.conversationId || this.config.conversationId!,
      participant_id: this.config.participantId!,
      timestamp: Date.now(),
      correlation_id: crypto.randomUUID(),
      name: 'AudioFrame2',
      metadata: { 
        companyName 
      },
      payload: {
        chunk: '', // Empty audio chunk to trigger session creation
        leg_id: crypto.randomUUID(),
        direction: 'inbound',
      },
    }

    console.log('📤 Sending initial audio frame with company metadata')
    this.socket.emit('send_message', audioFrame)
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers[event]
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      })
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  getConversationInfo() {
    return this.conversationInfo
  }
}