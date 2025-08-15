/**
 * Event filter component for debug console
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'

export interface EventFilters {
  showAudioFrames: boolean
  showAgentMessages: boolean
  showToolCalls: boolean
  showToolResponses: boolean
  showConversationControl: boolean
  showUserMessages: boolean
  showPingPong: boolean
  showAll: boolean
}

interface EventFilterProps {
  filters: EventFilters
  onFiltersChange: (filters: EventFilters) => void
}

const EVENT_CATEGORIES = [
  { key: 'showAll' as keyof EventFilters, label: 'Show All', description: 'Toggle all events' },
  { key: 'showAudioFrames' as keyof EventFilters, label: 'Audio Frames', description: 'Audio chunks and frames' },
  { key: 'showAgentMessages' as keyof EventFilters, label: 'Agent Messages', description: 'Text responses from agents' },
  { key: 'showToolCalls' as keyof EventFilters, label: 'Tool Calls', description: 'Function/tool invocations' },
  { key: 'showToolResponses' as keyof EventFilters, label: 'Tool Responses', description: 'Results from tool calls' },
  { key: 'showConversationControl' as keyof EventFilters, label: 'Conversation Control', description: 'Start, ready, interrupt events' },
  { key: 'showUserMessages' as keyof EventFilters, label: 'User Messages', description: 'Messages from user' },
  { key: 'showPingPong' as keyof EventFilters, label: 'Ping/Pong', description: 'Keepalive frames' }
]

export const EventFilter: React.FC<EventFilterProps> = ({ filters, onFiltersChange }) => {
  const [collapsed, setCollapsed] = useState(true)
  
  const handleFilterToggle = (key: keyof EventFilters) => {
    if (key === 'showAll') {
      // Toggle all filters
      const newValue = !filters.showAll
      const newFilters = Object.keys(filters).reduce((acc, filterKey) => {
        acc[filterKey as keyof EventFilters] = newValue
        return acc
      }, {} as EventFilters)
      onFiltersChange(newFilters)
    } else {
      // Toggle individual filter
      const newFilters = {
        ...filters,
        [key]: !filters[key]
      }
      
      // Update showAll based on whether all other filters are enabled
      const allOtherFilters = Object.keys(newFilters)
        .filter(k => k !== 'showAll')
        .every(k => newFilters[k as keyof EventFilters])
      
      newFilters.showAll = allOtherFilters
      onFiltersChange(newFilters)
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length - (filters.showAll ? 1 : 0)
  const totalFilterCount = EVENT_CATEGORIES.length - 1

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <h3 className="text-sm font-medium text-white">Event Filters</h3>
          <span className="text-xs text-gray-400">
            ({activeFilterCount}/{totalFilterCount} active)
          </span>
        </div>
        {collapsed ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronUp size={16} className="text-gray-400" />
        )}
      </div>
      
      {!collapsed && (
        <div className="p-3 pt-0 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            {EVENT_CATEGORIES.map(({ key, label, description }) => (
              <label
                key={key}
                className={`
                  flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors
                  ${filters[key] 
                    ? 'bg-blue-600/20 border border-blue-500/30' 
                    : 'bg-gray-700/50 border border-gray-600/30'
                  }
                  hover:bg-gray-600/50
                  ${key === 'showAll' ? 'col-span-2 font-medium' : ''}
                `}
                title={description}
              >
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={() => handleFilterToggle(key)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className={`text-sm ${filters[key] ? 'text-white' : 'text-gray-300'}`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Helper function to determine if an event should be shown based on filters
 */
export const shouldShowEvent = (eventType: string, filters: EventFilters): boolean => {
  if (filters.showAll) return true

  const eventTypeLower = eventType.toLowerCase()
  
  // Audio-related events
  if (eventTypeLower.includes('audio') || eventTypeLower.includes('frame')) {
    return filters.showAudioFrames
  }
  
  // Agent messages
  if (eventTypeLower.includes('agent') && eventTypeLower.includes('message')) {
    return filters.showAgentMessages
  }
  
  // Tool calls and responses
  if (eventTypeLower.includes('tool') && eventTypeLower.includes('call')) {
    return filters.showToolCalls
  }
  if (eventTypeLower.includes('function') && eventTypeLower.includes('call')) {
    return filters.showToolCalls
  }
  if (eventTypeLower === 'tooluse') {
    return filters.showToolCalls
  }
  if (eventTypeLower.includes('tool') && (eventTypeLower.includes('response') || eventTypeLower.includes('result'))) {
    return filters.showToolResponses
  }
  if (eventTypeLower.includes('function') && eventTypeLower.includes('response')) {
    return filters.showToolResponses
  }
  
  // Tool Input and Output Messages
  if (eventTypeLower.includes('tooloutput') || eventTypeLower.includes('toolinput')) {
    return filters.showToolCalls
  }
  
  // Conversation control
  if (eventTypeLower.includes('conversation') || eventTypeLower.includes('started') || 
      eventTypeLower.includes('ready') || eventTypeLower.includes('interrupt')) {
    return filters.showConversationControl
  }
  
  // User messages
  if (eventTypeLower.includes('user') && eventTypeLower.includes('message')) {
    return filters.showUserMessages
  }
  
  // Ping/Pong frames
  if (eventTypeLower.includes('ping') || eventTypeLower.includes('pong')) {
    return filters.showPingPong
  }
  
  // Default: show unknown events if any filter is active
  return filters.showConversationControl
}

export const defaultEventFilters: EventFilters = {
  showAll: false,
  showAudioFrames: true,
  showAgentMessages: true,
  showToolCalls: true,
  showToolResponses: true,
  showConversationControl: true,
  showUserMessages: true,
  showPingPong: false
}
