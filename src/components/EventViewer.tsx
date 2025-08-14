import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { EventMessage } from '@/types'
import { clsx } from 'clsx'
import { EventFilter, shouldShowEvent, type EventFilters } from './EventFilter'

interface EventViewerProps {
  events: EventMessage[]
  eventFilters?: EventFilters
  onEventFiltersChange?: (filters: EventFilters) => void
  autoScroll?: boolean
}

function EventItem({ event }: { event: EventMessage }) {
  const [expanded, setExpanded] = useState(false)

  const typeColor = clsx({
    'text-blue-400': event.type === 'UserMessage',
    'text-green-400': event.type === 'AgentMessage',
    'text-yellow-400': event.type === 'AudioFrame2',
    'text-purple-400': event.type === 'ToolCall',
    'text-pink-400': event.type === 'ToolResponse',
    'text-orange-400': event.type === 'McpToolMessage',
    'text-indigo-400': event.type === 'AgentToolMessage',
    'text-gray-400': event.type === 'System',
    'text-red-400': event.type === 'Error',
    'text-cyan-400': !['UserMessage', 'AgentMessage', 'AudioFrame2', 'ToolCall', 'ToolResponse', 'McpToolMessage', 'AgentToolMessage', 'System', 'Error'].includes(event.type),
  })

  const directionIcon = event.direction === 'inbound' ? '→' : '←'

  return (
    <div className="border-b border-gray-800 py-2">
      <div
        className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 px-2 py-1 rounded"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-500">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="text-gray-500 text-xs font-mono">
          {format(event.timestamp, 'HH:mm:ss.SSS')}
        </span>
        <span className="text-gray-500">{directionIcon}</span>
        <span className={clsx('font-medium', typeColor)}>{event.type}</span>
        {(() => {
          const text = event.payload?.text
          if (text && typeof text === 'string') {
            return (
              <span className="text-gray-300 truncate flex-1">
                {text.substring(0, 50)}...
              </span>
            )
          }
          return null
        })()}
      </div>
      {expanded && (
        <div className="mt-2 px-8">
          <div className="bg-gray-900 rounded p-3 text-xs font-mono overflow-x-auto">
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </div>
          {event.raw !== undefined && event.raw !== null && (
            <details className="mt-2">
              <summary className="cursor-pointer text-gray-500 text-xs">Raw Data</summary>
              <div className="bg-gray-950 rounded p-3 text-xs font-mono overflow-x-auto mt-1">
                <pre>{JSON.stringify(event.raw, null, 2)}</pre>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export function EventViewer({ events, eventFilters, onEventFiltersChange, autoScroll = true }: EventViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredEvents = eventFilters 
    ? events.filter(event => shouldShowEvent(event.type, eventFilters))
    : events

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filteredEvents, autoScroll])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800 p-3">
        <h3 className="text-sm font-medium text-gray-300">
          Events ({filteredEvents.length}{events.length !== filteredEvents.length ? ` / ${events.length}` : ''})
        </h3>
      </div>
      
      {eventFilters && onEventFiltersChange && (
        <div className="p-3">
          <EventFilter filters={eventFilters} onFiltersChange={onEventFiltersChange} />
        </div>
      )}
      
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {events.length === 0 ? 'No events yet' : 'No events match current filters'}
          </div>
        ) : (
          filteredEvents.map(event => <EventItem key={event.id} event={event} />)
        )}
      </div>
    </div>
  )
}
