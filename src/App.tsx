import { useState, useCallback, useRef, useEffect } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { EventViewer } from './components/EventViewer'
import { ToolCallViewer } from './components/ToolCallViewer'
import { AudioControls } from './components/AudioControls'
import { defaultEventFilters, type EventFilters } from './components/EventFilter'
import { DebugWebSocketClient } from './lib/websocket-client'
import { MicrophoneManager } from './lib/microphone-manager'
import { AudioPlayer } from './lib/audio-player'
import type { 
  EventMessage, 
  DebugSession, 
  AgentRuntime, 
  AgentIdentifier,
  ToolCall,
  ToolResponse 
} from './types'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [runtime, setRuntime] = useState<AgentRuntime>('openai')
  const [agent, setAgent] = useState<AgentIdentifier>('retail')
  const [session, setSession] = useState<DebugSession | null>(null)
  const [eventFilters, setEventFilters] = useState<EventFilters>(defaultEventFilters)
  
  const wsClientRef = useRef<DebugWebSocketClient | null>(null)
  const micManagerRef = useRef<MicrophoneManager | null>(null)
  const audioPlayerRef = useRef<AudioPlayer | null>(null)

  useEffect(() => {
    micManagerRef.current = new MicrophoneManager()
    audioPlayerRef.current = new AudioPlayer()
    
    // Initialize audio player
    audioPlayerRef.current.initialize().then(success => {
      if (success) {
        console.log('🔊 Audio player initialized')
      } else {
        console.error('❌ Failed to initialize audio player')
      }
    })
    
    return () => {
      micManagerRef.current?.stop()
      audioPlayerRef.current?.stopAllAudio()
      wsClientRef.current?.disconnect()
    }
  }, [])

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
        }
      }
      
      setSession(prev => {
        if (!prev) return null
        
        // Extract tool calls and responses
        if (event.type === 'ToolCall' && event.payload) {
          const toolCall: ToolCall = {
            id: event.payload.id as string || crypto.randomUUID(),
            name: event.payload.name as string || 'unknown',
            arguments: event.payload.arguments as Record<string, unknown> || {},
            timestamp: event.timestamp,
          }
          return {
            ...prev,
            events: [...prev.events, event],
            toolCalls: [...prev.toolCalls, toolCall],
          }
        } else if (event.type === 'ToolResponse' && event.payload) {
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
    micManagerRef.current?.stop()
    audioPlayerRef.current?.setMicrophoneActive(false)
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

  return (
    <div className="h-screen flex flex-col bg-gray-950">
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
        <div className="flex-1 border-r border-gray-800">
          <EventViewer 
            events={session?.events || []} 
            eventFilters={eventFilters}
            onEventFiltersChange={setEventFilters}
          />
        </div>
        <div className="w-96 space-y-4 p-4">
          <AudioControls audioPlayer={audioPlayerRef.current} />
          <ToolCallViewer 
            toolCalls={session?.toolCalls || []} 
            toolResponses={session?.toolResponses || []}
          />
        </div>
      </div>
    </div>
  )
}

export default App