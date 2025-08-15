import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Play, Square } from 'lucide-react'

export interface ScheduledMessage {
  text: string
  delay?: number
}

interface MessageSchedulerProps {
  isEnabled: boolean
  onToggleEnabled: () => void
  scheduledMessages: ScheduledMessage[]
  onMessagesChange: (messages: ScheduledMessage[]) => void
  currentMessageIndex: number
  onManualTrigger?: () => void
  isConnected?: boolean
  completed?: boolean
  runtime?: 'openai' | 'gemini'
}

export function MessageScheduler({ 
  isEnabled, 
  onToggleEnabled, 
  scheduledMessages,
  onMessagesChange,
  currentMessageIndex,
  onManualTrigger,
  isConnected = false,
  completed = false,
  runtime = 'openai'
}: MessageSchedulerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  useEffect(() => {
    setJsonInput(JSON.stringify(scheduledMessages, null, 2))
  }, [scheduledMessages])
  
  // Update cooldown timer
  useEffect(() => {
    if (!isEnabled) {
      setCooldownRemaining(0)
      return
    }
    
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 100))
    }, 100)
    
    return () => clearInterval(interval)
  }, [isEnabled])

  const handleJsonChange = (value: string) => {
    setJsonInput(value)
    setError(null)
    
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        setError('Messages must be an array')
        return
      }
      
      const validMessages = parsed.every((msg: unknown) => 
        typeof msg === 'object' && 
        msg !== null && 
        'text' in msg &&
        typeof (msg as any).text === 'string'
      )
      
      if (!validMessages) {
        setError('Each message must have a "text" property')
        return
      }
      
      onMessagesChange(parsed as ScheduledMessage[])
    } catch (e) {
      setError('Invalid JSON')
    }
  }

  const exampleMessages: ScheduledMessage[] = [
    { text: "What's the weather like today?" },
    { text: "Can you help me book a flight?", delay: 1000 },
    { text: "I need a hotel in Paris" },
    { text: "What are the best restaurants there?" }
  ]

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center space-x-2">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
          <h3 className="text-sm font-medium text-gray-200">Message Scheduler</h3>
          {isEnabled && (
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded-full animate-pulse">
                Active ({currentMessageIndex + 1}/{scheduledMessages.length}{currentMessageIndex === scheduledMessages.length - 1 ? ' - last' : ''})
              </span>
              {scheduledMessages[currentMessageIndex] && (
                <span className="text-xs text-gray-500 max-w-[150px] truncate">
                  Next: "{scheduledMessages[currentMessageIndex].text}"
                </span>
              )}
            </div>
          )}
          {completed && !isEnabled && (
            <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">
              Completed all messages
            </span>
          )}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleEnabled()
          }}
          className={`
            flex items-center space-x-1 px-3 py-1 rounded text-xs font-medium transition-colors
            ${isEnabled 
              ? 'bg-red-900/50 text-red-400 hover:bg-red-900/70' 
              : 'bg-green-900/50 text-green-400 hover:bg-green-900/70'
            }
            ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          disabled={!isConnected}
        >
          {isEnabled ? (
            <>
              <Square className="h-3 w-3" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              <span>Start</span>
            </>
          )}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="p-3 pt-0 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">
                Scheduled Messages (JSON)
              </label>
              <button
                onClick={() => handleJsonChange(JSON.stringify(exampleMessages, null, 2))}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Load Example
              </button>
            </div>
            
            <textarea
              value={jsonInput}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-48 px-3 py-2 text-xs font-mono bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-200 resize-none"
              placeholder={`[\n  { "text": "Hello" },\n  { "text": "How are you?", "delay": 1000 }\n]`}
            />
            
            {error && (
              <p className="mt-1 text-xs text-red-400">{error}</p>
            )}
                    </div>
          
          <div className="space-y-3">
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Messages will be sent automatically after each non-empty agent response</p>
              {runtime === 'gemini' && (
                <p className="text-blue-400">• Gemini mode: Waits 4 seconds after audio stops before sending</p>
              )}
              {runtime === 'openai' && (
                <p className="text-blue-400">• OpenAI mode: Waits 2 seconds after response before sending</p>
              )}
              <p>• Optional "delay" in milliseconds before sending (default: 0)</p>
              <p>• The scheduler will stop after sending all messages</p>
              {isEnabled && (
                <p className="text-yellow-400 mt-2">
                  ⚡ Scheduler is active - {isConnected ? 
                    runtime === 'gemini' ? 
                      'waiting for audio silence before sending messages' : 
                      'waiting 2s after responses before sending messages'
                    : 'connect to start'}
                </p>
              )}
              {completed && !isEnabled && (
                <p className="text-green-400 mt-2">
                  ✅ All messages have been sent successfully
                </p>
              )}
            </div>
            
            {isEnabled && onManualTrigger && isConnected && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    onManualTrigger()
                    setCooldownRemaining(1000) // Set 1 second cooldown after manual trigger
                  }}
                  className="w-full px-3 py-2 text-xs bg-blue-900/50 text-blue-400 rounded hover:bg-blue-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isConnected || scheduledMessages.length === 0 || cooldownRemaining > 0}
                >
                  {cooldownRemaining > 0 
                    ? `Cooldown (${(cooldownRemaining / 1000).toFixed(1)}s)` 
                    : `Send Next Message Now ${scheduledMessages.length === 0 ? '(No messages)' : ''}`
                  }
                </button>
                {cooldownRemaining > 0 && (
                  <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-100"
                      style={{ width: `${(cooldownRemaining / 1000) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
