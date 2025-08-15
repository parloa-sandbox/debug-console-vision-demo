import { useState, useCallback, useRef, useEffect } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { EventViewer } from './components/EventViewer'
import { ToolCallViewer } from './components/ToolCallViewer'
import { defaultEventFilters, type EventFilters } from './components/EventFilter'
import { MessageScheduler, type ScheduledMessage } from './components/MessageScheduler'
import { DebugWebSocketClient } from './lib/websocket-client'
import { MicrophoneManager } from './lib/microphone-manager'
import { AudioPlayer } from './lib/audio-player'
import type { 
  EventMessage, 
  DebugSession, 
  AgentRuntime, 
  AgentIdentifier,
  ToolCall,
  ToolResponse,
  ToolInput,
  ToolOutput
} from './types'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [runtime, setRuntime] = useState<AgentRuntime>('openai')
  const [agent, setAgent] = useState<AgentIdentifier>('retail')
  const [session, setSession] = useState<DebugSession | null>(null)
  const [eventFilters, setEventFilters] = useState<EventFilters>(defaultEventFilters)
  const [schedulerEnabled, setSchedulerEnabled] = useState(false)
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([
    { text: "What's the weather like today?" },
    { text: "Can you help me book a flight?", delay: 1000 },
    { text: "I need a hotel in Paris" },
    { text: "What are the best restaurants there?" }
  ])
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [schedulerCompleted, setSchedulerCompleted] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(384) // Default width (w-96)
  const [isResizing, setIsResizing] = useState(false)
  
  const wsClientRef = useRef<DebugWebSocketClient | null>(null)
  const micManagerRef = useRef<MicrophoneManager | null>(null)
  const audioPlayerRef = useRef<AudioPlayer | null>(null)
  const schedulerEnabledRef = useRef(schedulerEnabled)
  const scheduledMessagesRef = useRef(scheduledMessages)
  const currentMessageIndexRef = useRef(currentMessageIndex)
  const lastScheduledSendRef = useRef<number>(0)
  const schedulerCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAudioFrameRef = useRef<number>(0)
  const audioSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingAgentMessageRef = useRef<string | null>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = window.innerWidth - e.clientX
    setSidebarWidth(Math.max(200, Math.min(800, newWidth)))
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    }, [isResizing, handleMouseMove, handleMouseUp])
  
  // Keep refs in sync with state
  useEffect(() => {
    schedulerEnabledRef.current = schedulerEnabled
  }, [schedulerEnabled])
  
  useEffect(() => {
    scheduledMessagesRef.current = scheduledMessages
  }, [scheduledMessages])
  
  useEffect(() => {
    currentMessageIndexRef.current = currentMessageIndex
  }, [currentMessageIndex])
  
  useEffect(() => {
    micManagerRef.current = new MicrophoneManager()
    // Configure audio player with runtime-specific settings
    audioPlayerRef.current = new AudioPlayer({
      sampleRate: runtime === 'gemini' ? 24000 : 24000, // 24 kHz for both, but explicit for clarity
      bitDepth: 16,
      channels: 1
    })
    
    // Initialize audio player
    audioPlayerRef.current.initialize().then(success => {
      if (success) {
        console.log(`🔊 Audio player initialized for ${runtime} runtime`)
      } else {
        console.error('❌ Failed to initialize audio player')
      }
    })
    
    return () => {
      micManagerRef.current?.stop()
      audioPlayerRef.current?.stopAllAudio()
      wsClientRef.current?.disconnect()
    }
  }, [runtime])

  const handleScheduledMessageSend = () => {
    // Clear any existing scheduled send
    if (schedulerCooldownRef.current) {
      clearTimeout(schedulerCooldownRef.current)
    }
    
    const currentIdx = currentMessageIndexRef.current
    const messages = scheduledMessagesRef.current
    const messageToSend = messages[currentIdx]
    
    if (messageToSend) {
      const delay = Math.max(1500, messageToSend.delay || 0) // Minimum 1.5s delay
      console.log(`📧 Scheduler: Will send message ${currentIdx + 1}/${messages.length} after ${delay}ms delay`)
      
      schedulerCooldownRef.current = setTimeout(() => {
        if (wsClientRef.current && wsClientRef.current.getConnectionStatus() && schedulerEnabledRef.current) {
          wsClientRef.current.sendMessage(messageToSend.text)
          lastScheduledSendRef.current = Date.now()
          
          // Add the sent message to the event log
          const sentEvent: EventMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'UserMessage',
            direction: 'outbound',
            payload: { text: messageToSend.text, scheduled: true },
            raw: { text: messageToSend.text, scheduled: true }
          }
          setSession(prev => prev ? { ...prev, events: [...prev.events, sentEvent] } : prev)
          
          // Move to next message
          const nextIdx = currentIdx + 1
          if (nextIdx >= messages.length) {
            // All messages sent - stop scheduler
            console.log('📧 Scheduler: All messages sent, stopping')
            setSchedulerEnabled(false)
            setSchedulerCompleted(true)
            setCurrentMessageIndex(0)
          } else {
            setCurrentMessageIndex(nextIdx)
          }
        }
      }, delay)
    }
    
    // Clear pending agent message
    pendingAgentMessageRef.current = null
  }

  const handleConnect = useCallback(() => {
    const wsUrl = 'http://localhost:6090'
    
    const newSession: DebugSession = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      runtime,
      agent,
      events: [],
      toolCalls: [],
      toolResponses: [],
      toolInputs: [],
      toolOutputs: [],
    }
    setSession(newSession)

    const client = new DebugWebSocketClient({
      url: wsUrl,
      runtime,
      agent,
    })

    client.on('connected', () => {
      setIsConnected(true)
      console.log('✅ Connected to WebSocket')
    })

    client.on('disconnected', () => {
      setIsConnected(false)
      setIsMicActive(false)
      micManagerRef.current?.stop()
      audioPlayerRef.current?.setMicrophoneActive(false)
      if (session) {
        setSession(prev => prev ? { ...prev, endTime: Date.now() } : null)
      }
      console.log('❌ Disconnected from WebSocket')
    })

    client.on('debug_event', (data: unknown) => {
      const event = data as EventMessage
      
      // Handle audio frames for playback
      if ((event.type === 'AudioFrame' || event.type === 'AudioFrame2') && event.payload && audioPlayerRef.current) {
        const audioChunk = (event.payload as any).chunk
        const frameId = event.id
        const responseId = (event.payload as any).response_id
        
        if (audioChunk && typeof audioChunk === 'string') {
          audioPlayerRef.current.playAudioChunk(audioChunk, frameId, responseId)
          // Track last audio frame time for Gemini scheduling
          lastAudioFrameRef.current = Date.now()
        }
      }
      
      // Handle automatic message scheduling with runtime-specific behavior
      if (event.type === 'AgentMessage' && event.payload && schedulerEnabledRef.current) {
        const agentText = (event.payload as any).text
        // Only process non-empty messages with at least 10 characters
        if (agentText && typeof agentText === 'string' && agentText.trim().length > 10) {
          const now = Date.now()
          const timeSinceLastSend = now - lastScheduledSendRef.current
          
          // Prevent sending if less than 3 seconds since last scheduled send
          if (timeSinceLastSend < 3000) {
            console.log('⏸️ Scheduler: Skipping - cooldown period (3s)')
            return
          }
          
          // For Gemini runtime, store the agent message and wait for audio silence
          if (runtime === 'gemini') {
            console.log('📧 Scheduler: Agent message received (Gemini mode - waiting for audio silence)')
            pendingAgentMessageRef.current = agentText
            
            // Clear any existing audio silence timer
            if (audioSilenceTimerRef.current) {
              clearTimeout(audioSilenceTimerRef.current)
            }
            
            // Start/restart the 2-second audio silence timer
            audioSilenceTimerRef.current = setTimeout(() => {
              const timeSinceLastAudio = Date.now() - lastAudioFrameRef.current
              console.log(`📧 Scheduler: Audio silence detected (${timeSinceLastAudio}ms since last audio)`)
              
              // If we have a pending agent message and enough time has passed
              if (pendingAgentMessageRef.current && timeSinceLastAudio >= 2000) {
                handleScheduledMessageSend()
              }
            }, 2000)
          } else {
            // For non-Gemini runtimes, use the original behavior
            console.log('📧 Scheduler: Agent message received, scheduling next message')
            handleScheduledMessageSend()
          }
        }
      }
      
      setSession(prev => {
        if (!prev) return null
        

        
        // Extract tool calls and responses
        // Check for multiple possible event type names for tool calls
        if ((event.type === 'ToolCall' || event.type === 'FunctionCall' || event.type === 'ToolUse') && event.payload) {

          const toolCall: ToolCall = {
            id: event.payload.id as string || crypto.randomUUID(),
            name: event.payload.name as string || event.payload.tool_name as string || event.payload.function as string || 'unknown',
            arguments: event.payload.arguments as Record<string, unknown> || event.payload.parameters as Record<string, unknown> || {},
            timestamp: event.timestamp,
          }
          return {
            ...prev,
            events: [...prev.events, event],
            toolCalls: [...prev.toolCalls, toolCall],
          }
        } else if ((event.type === 'ToolResponse' || event.type === 'ToolCallResult' || event.type === 'FunctionResponse') && event.payload) {
          const toolResponse: ToolResponse = {
            id: crypto.randomUUID(),
            callId: event.payload.callId as string || '',
            result: event.payload.result,
            error: event.payload.error as string | undefined,
            timestamp: event.timestamp,
          }
          return {
            ...prev,
            events: [...prev.events, event],
            toolResponses: [...prev.toolResponses, toolResponse],
          }
        } else if (event.type === 'ToolInput' && event.payload) {

          const toolName = event.payload.toolName as string || event.payload.tool_name as string || event.payload.name as string || event.payload.tool as string || 'unknown'
          const toolInput: ToolInput = {
            id: crypto.randomUUID(),
            toolName,
            input: event.payload.input || event.payload.arguments || event.payload,
            timestamp: event.timestamp,
          }

          
          // If we don't have a tool call for this tool, create one from the input
          const callId = event.payload.callId as string || event.payload.call_id as string || event.payload.id as string
          const existingToolCall = callId ? prev.toolCalls.find(tc => tc.id === callId) : null
          
          if (!existingToolCall) {
            const toolCall: ToolCall = {
              id: callId || crypto.randomUUID(),
              name: toolName,
              arguments: (event.payload.input || event.payload.arguments || {}) as Record<string, unknown>,
              timestamp: event.timestamp,
            }
            return {
              ...prev,
              events: [...prev.events, event],
              toolCalls: [...prev.toolCalls, toolCall],
              toolInputs: [...prev.toolInputs, toolInput],
            }
          }
          
          return {
            ...prev,
            events: [...prev.events, event],
            toolInputs: [...prev.toolInputs, toolInput],
          }
        } else if (event.type === 'ToolOutput' && event.payload) {

          const toolName = event.payload.toolName as string || event.payload.tool_name as string || event.payload.name as string || event.payload.tool as string || 'unknown'
          const toolOutput: ToolOutput = {
            id: crypto.randomUUID(),
            toolName,
            output: event.payload.output || event.payload.result || event.payload,
            error: event.payload.error as string | undefined,
            timestamp: event.timestamp,
          }

          return {
            ...prev,
            events: [...prev.events, event],
            toolOutputs: [...prev.toolOutputs, toolOutput],
          }
        }
        
        return {
          ...prev,
          events: [...prev.events, event],
        }
      })
    })

    client.on('error', (error: unknown) => {
      console.error('WebSocket error:', error)
    })

    client.connect()
    wsClientRef.current = client
  }, [runtime, agent, session])

  const handleDisconnect = useCallback(() => {
    wsClientRef.current?.disconnect()
    wsClientRef.current = null
    setIsConnected(false)
    setIsMicActive(false)
    setSchedulerEnabled(false)
    micManagerRef.current?.stop()
    audioPlayerRef.current?.setMicrophoneActive(false)
    if (schedulerCooldownRef.current) {
      clearTimeout(schedulerCooldownRef.current)
    }
    if (audioSilenceTimerRef.current) {
      clearTimeout(audioSilenceTimerRef.current)
    }
    pendingAgentMessageRef.current = null
    lastAudioFrameRef.current = 0
  }, [])

  const handleToggleMic = useCallback(async () => {
    if (!isConnected || !wsClientRef.current || !micManagerRef.current) return

    if (isMicActive) {
      micManagerRef.current.stop()
      audioPlayerRef.current?.setMicrophoneActive(false)
      setIsMicActive(false)
    } else {
      try {
        await micManagerRef.current.start((chunk) => {
          wsClientRef.current?.sendAudioFrame(chunk)
        })
        audioPlayerRef.current?.setMicrophoneActive(true)
        setIsMicActive(true)
      } catch (error) {
        console.error('Failed to start microphone:', error)
      }
    }
  }, [isConnected, isMicActive])

  const handleClearEvents = useCallback(() => {
    setSession(prev => {
      if (!prev) return null
      return {
        ...prev,
        events: [],
        toolCalls: [],
        toolResponses: [],
        toolInputs: [],
        toolOutputs: [],
      }
    })
  }, [])

  const handleExportSession = useCallback((sessionData: DebugSession) => {
    const data = JSON.stringify(sessionData, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-session-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleSendMessage = useCallback((text: string) => {
    if (!wsClientRef.current || !isConnected) return
    
    wsClientRef.current.sendMessage(text)
    
    // Add the sent message to the event log
    const event: EventMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'UserMessage',
      direction: 'outbound',
      payload: { text },
      raw: { text }
    }
    setSession(prev => prev ? { ...prev, events: [...prev.events, event] } : prev)
  }, [isConnected])
  
  const handleManualSchedulerTrigger = useCallback(() => {
    if (!wsClientRef.current || !isConnected || !schedulerEnabled) return
    
    const now = Date.now()
    const timeSinceLastSend = now - lastScheduledSendRef.current
    
    // Prevent sending if less than 1 second since last scheduled send
    if (timeSinceLastSend < 1000) {
      console.log('⏸️ Scheduler: Manual trigger blocked - cooldown period')
      return
    }
    
    const currentIdx = currentMessageIndexRef.current
    const messages = scheduledMessagesRef.current
    const messageToSend = messages[currentIdx]
    
    if (messageToSend) {
      console.log(`📧 Scheduler: Manually sending message ${currentIdx + 1}/${messages.length}`)
      wsClientRef.current.sendMessage(messageToSend.text)
      lastScheduledSendRef.current = now
      
      // Add the sent message to the event log
      const event: EventMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'UserMessage',
        direction: 'outbound',
        payload: { text: messageToSend.text, scheduled: true, manual: true },
        raw: { text: messageToSend.text, scheduled: true, manual: true }
      }
      setSession(prev => prev ? { ...prev, events: [...prev.events, event] } : prev)
      
      // Move to next message
      const nextIdx = currentIdx + 1
      if (nextIdx >= messages.length) {
        // All messages sent - stop scheduler
        console.log('📧 Scheduler: All messages sent, stopping')
        setSchedulerEnabled(false)
        setSchedulerCompleted(true)
        setCurrentMessageIndex(0)
      } else {
        setCurrentMessageIndex(nextIdx)
      }
    }
  }, [isConnected, schedulerEnabled])

  return (
    <div className={`h-screen flex flex-col bg-gray-950 ${isResizing ? 'select-none' : ''}`}>
      <ControlPanel
        isConnected={isConnected}
        isMicActive={isMicActive}
        runtime={runtime}
        agent={agent}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onToggleMic={handleToggleMic}
        onRuntimeChange={setRuntime}
        onAgentChange={setAgent}
        onClearEvents={handleClearEvents}
        onExportSession={handleExportSession}
        onSendMessage={handleSendMessage}
        session={session}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-gray-800 min-w-0">
          <EventViewer 
            events={session?.events || []} 
            eventFilters={eventFilters}
            onEventFiltersChange={setEventFilters}
          />
        </div>
        
        {/* Resize Handle */}
        <div
          className="w-1 bg-gray-800 hover:bg-gray-600 cursor-col-resize transition-colors flex-shrink-0"
          onMouseDown={() => setIsResizing(true)}
        />
        
        <div 
          className="space-y-4 p-4 overflow-y-auto bg-gray-950 flex-shrink-0"
          style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '800px' }}
        >
          <MessageScheduler
            isEnabled={schedulerEnabled}
            isConnected={isConnected}
            runtime={runtime}
            onToggleEnabled={() => {
              const newEnabled = !schedulerEnabled
              setSchedulerEnabled(newEnabled)
              setCurrentMessageIndex(0)
              setSchedulerCompleted(false)
              console.log('📧 Scheduler:', newEnabled ? 'Enabled' : 'Disabled')
              
              // Auto-start conversation when enabling scheduler
              if (newEnabled && isConnected && scheduledMessages.length > 0) {
                setTimeout(() => {
                  handleManualSchedulerTrigger()
                }, 500)
              }
            }}
            scheduledMessages={scheduledMessages}
            onMessagesChange={(messages) => {
              setScheduledMessages(messages)
              setSchedulerCompleted(false)
            }}
            currentMessageIndex={currentMessageIndex}
            onManualTrigger={handleManualSchedulerTrigger}
            completed={schedulerCompleted}
          />
          <ToolCallViewer 
            toolCalls={session?.toolCalls || []} 
            toolResponses={session?.toolResponses || []}
            toolInputs={session?.toolInputs || []}
            toolOutputs={session?.toolOutputs || []}
          />
        </div>
      </div>
    </div>
  )
}

export default App