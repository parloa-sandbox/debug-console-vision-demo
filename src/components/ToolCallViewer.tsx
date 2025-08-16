import { format } from 'date-fns'
import { Wrench, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { ToolCall, ToolResponse, ToolInput, ToolOutput } from '@/types'
import { useState } from 'react'
import { clsx } from 'clsx'

function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function formatValue(value: any): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }
  
  // Handle strings that might be JSON
  if (typeof value === 'string') {
    const parsed = tryParseJSON(value)
    if (parsed !== value) {
      // Successfully parsed, now format the result recursively
      return formatValue(parsed)
    }
    return value
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => formatValue(item))
  }
  
  // Handle objects
  if (typeof value === 'object') {
    const formatted: any = {}
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        formatted[key] = formatValue(value[key])
      }
    }
    return formatted
  }
  
  // Return primitives as-is
  return value
}

interface ToolCallViewerProps {
  toolCalls: ToolCall[]
  toolResponses: ToolResponse[]
  toolInputs: ToolInput[]
  toolOutputs: ToolOutput[]
}

function ToolCallItem({ 
  call, 
  response,
  inputs,
  outputs
}: { 
  call: ToolCall
  response?: ToolResponse
  inputs: ToolInput[]
  outputs: ToolOutput[]
}) {
  const [expanded, setExpanded] = useState(false)

  const status = response ? (response.error ? 'error' : 'success') : 'pending'
  const statusIcon = {
    success: <CheckCircle size={16} className="text-green-400" />,
    error: <XCircle size={16} className="text-red-400" />,
    pending: <Clock size={16} className="text-yellow-400 animate-pulse" />,
  }[status]

  // Calculate latencies between inputs and outputs
  const latencies = inputs.map(input => {
    const matchingOutput = outputs.find(output => 
      output.timestamp > input.timestamp && 
      output.toolName === input.toolName
    )
    if (matchingOutput) {
      return {
        inputId: input.id,
        outputId: matchingOutput.id,
        latency: matchingOutput.timestamp - input.timestamp
      }
    }
    return null
  }).filter(Boolean)

  const avgLatency = latencies.length > 0 
    ? Math.round(latencies.reduce((sum, l) => sum + l.latency, 0) / latencies.length)
    : null

  return (
    <div className="border-b border-gray-800 py-3">
      <div
        className="flex items-center gap-3 cursor-pointer hover:bg-gray-900 px-2 py-1 rounded"
        onClick={() => setExpanded(!expanded)}
      >
        <Wrench size={16} className="text-purple-400" />
        {statusIcon}
        <span className="font-medium text-purple-300">{call.name}</span>
        <span className="text-gray-600 text-xs font-mono ml-2">#{call.id.slice(0, 8)}</span>
        {avgLatency !== null && (
          <span className="text-blue-400 text-xs font-mono ml-2">
            {avgLatency}ms avg
          </span>
        )}
        <span className="text-gray-500 text-xs font-mono ml-auto">
          {format(call.timestamp, 'HH:mm:ss.SSS')}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 px-8 space-y-3">
          <div>
            <h4 className="text-xs text-gray-400 mb-1">Arguments</h4>
            <div className="bg-gray-900 rounded p-3 text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(formatValue(call.arguments), null, 2)}</pre>
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
                <pre>{JSON.stringify(formatValue(response.error || response.result), null, 2)}</pre>
              </div>
            </div>
          )}
          {inputs.length > 0 && (
            <div>
              <h4 className="text-xs text-gray-400 mb-1">Tool Inputs ({inputs.length})</h4>
              {inputs.map((input) => {
                const latencyInfo = latencies.find(l => l.inputId === input.id)
                return (
                  <div key={input.id} className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{format(input.timestamp, 'HH:mm:ss.SSS')}</span>
                      {latencyInfo && (
                        <span className="text-blue-400">
                          → {latencyInfo.latency}ms latency
                        </span>
                      )}
                    </div>
                    <div className="bg-indigo-950 rounded p-3 text-xs font-mono overflow-x-auto">
                      <pre>{JSON.stringify(formatValue(input.input), null, 2)}</pre>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {outputs.length > 0 && (
            <div>
              <h4 className="text-xs text-gray-400 mb-1">Tool Outputs ({outputs.length})</h4>
              {outputs.map((output) => (
                <div key={output.id} className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">
                    {format(output.timestamp, 'HH:mm:ss.SSS')}
                    {output.error && <span className="text-red-400 ml-2">(Error)</span>}
                  </div>
                  <div className={clsx(
                    'rounded p-3 text-xs font-mono overflow-x-auto',
                    output.error ? 'bg-red-950' : 'bg-orange-950'
                  )}>
                    <pre>{JSON.stringify(formatValue(output.error || output.output), null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolCallViewer({ toolCalls, toolResponses, toolInputs, toolOutputs }: ToolCallViewerProps) {

  
  const responseMap = new Map(
    toolResponses.map(r => [r.callId, r])
  )

  // Function to find inputs/outputs that are temporally close to a tool call
  const findRelatedInputsOutputs = (call: ToolCall) => {
    const timeWindow = 10000 // 10 seconds
    const relatedInputs = toolInputs.filter(input => 
      input.toolName === call.name && 
      Math.abs(input.timestamp - call.timestamp) < timeWindow
    )
    const relatedOutputs = toolOutputs.filter(output => 
      output.toolName === call.name && 
      Math.abs(output.timestamp - call.timestamp) < timeWindow
    )
    return { inputs: relatedInputs, outputs: relatedOutputs }
  }

  // Calculate overall latency statistics
  const allLatencies: number[] = []
  toolInputs.forEach(input => {
    const matchingOutput = toolOutputs.find(output => 
      output.timestamp > input.timestamp && 
      output.toolName === input.toolName
    )
    if (matchingOutput) {
      allLatencies.push(matchingOutput.timestamp - input.timestamp)
    }
  })

  const latencyStats = allLatencies.length > 0 ? {
    avg: Math.round(allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length),
    min: Math.round(Math.min(...allLatencies)),
    max: Math.round(Math.max(...allLatencies)),
    count: allLatencies.length
  } : null

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800 p-3">
        <h3 className="text-sm font-medium text-gray-300">
          Tool Calls ({toolCalls.length})
        </h3>
        <div className="text-xs text-gray-500 mt-1">
          Inputs: {toolInputs.length} | Outputs: {toolOutputs.length}
          {latencyStats && (
            <span className="text-blue-400 ml-2">
              | Latency: {latencyStats.avg}ms avg ({latencyStats.min}-{latencyStats.max}ms)
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {toolCalls.length === 0 && toolInputs.length === 0 && toolOutputs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No tool calls yet</div>
        ) : toolCalls.length > 0 ? (
          toolCalls.map(call => {
            const { inputs, outputs } = findRelatedInputsOutputs(call)

            return (
              <ToolCallItem
                key={call.id}
                call={call}
                response={responseMap.get(call.id)}
                inputs={inputs}
                outputs={outputs}
              />
            )
          })
        ) : (
          // If we have inputs/outputs but no tool calls, show them directly
          <div className="p-4 space-y-4">
            {toolInputs.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Tool Inputs (No associated calls)</h4>
                {toolInputs.map(input => (
                  <div key={input.id} className="mb-3 border-b border-gray-800 pb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-indigo-400 font-medium">{input.toolName}</span>
                      <span className="text-xs text-gray-500">{format(input.timestamp, 'HH:mm:ss.SSS')}</span>
                    </div>
                    <div className="bg-indigo-950 rounded p-2 text-xs font-mono overflow-x-auto">
                      <pre>{JSON.stringify(formatValue(input.input), null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {toolOutputs.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Tool Outputs (No associated calls)</h4>
                {toolOutputs.map(output => (
                  <div key={output.id} className="mb-3 border-b border-gray-800 pb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-orange-400 font-medium">{output.toolName}</span>
                      <span className="text-xs text-gray-500">{format(output.timestamp, 'HH:mm:ss.SSS')}</span>
                    </div>
                    <div className={clsx(
                      'rounded p-2 text-xs font-mono overflow-x-auto',
                      output.error ? 'bg-red-950' : 'bg-orange-950'
                    )}>
                      <pre>{JSON.stringify(formatValue(output.error || output.output), null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
