import { format } from 'date-fns'
import { Wrench, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { ToolCall, ToolResponse } from '@/types'
import { useState } from 'react'
import { clsx } from 'clsx'

interface ToolCallViewerProps {
  toolCalls: ToolCall[]
  toolResponses: ToolResponse[]
}

function ToolCallItem({ 
  call, 
  response 
}: { 
  call: ToolCall
  response?: ToolResponse 
}) {
  const [expanded, setExpanded] = useState(false)

  const status = response ? (response.error ? 'error' : 'success') : 'pending'
  const statusIcon = {
    success: <CheckCircle size={16} className="text-green-400" />,
    error: <XCircle size={16} className="text-red-400" />,
    pending: <Clock size={16} className="text-yellow-400 animate-pulse" />,
  }[status]

  return (
    <div className="border-b border-gray-800 py-3">
      <div
        className="flex items-center gap-3 cursor-pointer hover:bg-gray-900 px-2 py-1 rounded"
        onClick={() => setExpanded(!expanded)}
      >
        <Wrench size={16} className="text-purple-400" />
        {statusIcon}
        <span className="font-medium text-purple-300">{call.name}</span>
        <span className="text-gray-500 text-xs font-mono ml-auto">
          {format(call.timestamp, 'HH:mm:ss.SSS')}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 px-8 space-y-3">
          <div>
            <h4 className="text-xs text-gray-400 mb-1">Arguments</h4>
            <div className="bg-gray-900 rounded p-3 text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(call.arguments, null, 2)}</pre>
            </div>
          </div>
          {response && (
            <div>
              <h4 className="text-xs text-gray-400 mb-1">
                Response
                {response.error && <span className="text-red-400 ml-2">(Error)</span>}
              </h4>
              <div className={clsx(
                'rounded p-3 text-xs font-mono overflow-x-auto',
                response.error ? 'bg-red-950' : 'bg-gray-900'
              )}>
                <pre>{JSON.stringify(response.error || response.result, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolCallViewer({ toolCalls, toolResponses }: ToolCallViewerProps) {
  const responseMap = new Map(
    toolResponses.map(r => [r.callId, r])
  )

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800 p-3">
        <h3 className="text-sm font-medium text-gray-300">
          Tool Calls ({toolCalls.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {toolCalls.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No tool calls yet</div>
        ) : (
          toolCalls.map(call => (
            <ToolCallItem
              key={call.id}
              call={call}
              response={responseMap.get(call.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
