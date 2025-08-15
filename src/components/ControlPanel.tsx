import { Mic, MicOff, Phone, PhoneOff, Trash2, Download, Bug } from 'lucide-react'
import { clsx } from 'clsx'
import type { AgentRuntime, AgentIdentifier, DebugSession } from '@/types'
import { AgentRuntimeSchema, AgentIdentifierSchema } from '@/types'

interface ControlPanelProps {
  isConnected: boolean
  isMicActive: boolean
  runtime: AgentRuntime
  agent: AgentIdentifier
  onConnect: () => void
  onDisconnect: () => void
  onToggleMic: () => void
  onRuntimeChange: (runtime: AgentRuntime) => void
  onAgentChange: (agent: AgentIdentifier) => void
  onClearEvents: () => void
  onExportSession: (session: DebugSession) => void
  onSendMessage: (text: string) => void
  onDebugMode: () => void
  session: DebugSession | null
}

export function ControlPanel({
  isConnected,
  isMicActive,
  runtime,
  agent,
  onConnect,
  onDisconnect,
  onToggleMic,
  onRuntimeChange,
  onAgentChange,
  onClearEvents,
  onExportSession,
  onSendMessage,
  onDebugMode,
  session,
}: ControlPanelProps) {
  const handleExport = () => {
    if (!session) return
    onExportSession(session)
  }

  return (
    <div className="border-b border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={isConnected ? onDisconnect : onConnect}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors',
              isConnected
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            )}
          >
            {isConnected ? (
              <>
                <PhoneOff size={16} />
                Disconnect
              </>
            ) : (
              <>
                <Phone size={16} />
                Connect
              </>
            )}
          </button>

          <button
            onClick={onDebugMode}
            disabled={isConnected}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors',
              'bg-purple-600 hover:bg-purple-700 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Bug size={16} />
            Debug
          </button>

          <input
            type="text"
            placeholder="Type a message..."
            disabled={!isConnected}
            className="px-3 py-2 bg-gray-800 text-gray-200 rounded text-sm disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const text = e.currentTarget.value.trim()
                onSendMessage(text)
                e.currentTarget.value = ''
              }
            }}
          />

          <button
            onClick={onToggleMic}
            disabled={!isConnected}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isMicActive
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            )}
          >
            {isMicActive ? (
              <>
                <Mic size={16} />
                Mic On
              </>
            ) : (
              <>
                <MicOff size={16} />
                Mic Off
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Runtime:</label>
            <select
              value={runtime}
              onChange={(e) => onRuntimeChange(AgentRuntimeSchema.parse(e.target.value))}
              disabled={isConnected}
              className="bg-gray-800 text-gray-200 px-3 py-1 rounded text-sm disabled:opacity-50"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Agent:</label>
            <select
              value={agent}
              onChange={(e) => onAgentChange(AgentIdentifierSchema.parse(e.target.value))}
              disabled={isConnected}
              className="bg-gray-800 text-gray-200 px-3 py-1 rounded text-sm disabled:opacity-50"
            >
              <option value="retail">Retail</option>
              <option value="travel">Travel</option>
              <optgroup label="Retail Agents">
                <option value="retail-greeter">Retail Greeter</option>
                <option value="retail-faq">Retail FAQ</option>
                <option value="retail-products">Retail Products</option>
                <option value="retail-checkout">Retail Checkout</option>
              </optgroup>
              <optgroup label="Travel Agents">
                <option value="travel-index">Travel Index</option>
                <option value="travel-trip">Travel Trip</option>
                <option value="travel-faq">Travel FAQ</option>
                <option value="travel-checkout">Travel Checkout</option>
                <option value="travel-event">Travel Event</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearEvents}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            <Trash2 size={14} />
            Clear
          </button>
          <button
            onClick={handleExport}
            disabled={!session || session.events.length === 0}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {isConnected && (
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Connected
          </span>
          <span>Runtime: {runtime}</span>
          <span>Agent: {agent}</span>
          {session && (
            <>
              <span>Events: {session.events.length}</span>
              <span>Tools: {session.toolCalls.length}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}