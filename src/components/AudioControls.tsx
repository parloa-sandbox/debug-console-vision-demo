import { useState, useEffect } from 'react'
import { AudioPlayer, AudioStats } from '../lib/audio-player'

interface AudioControlsProps {
  audioPlayer: AudioPlayer | null
}

export function AudioControls({ audioPlayer }: AudioControlsProps) {
  const [volume, setVolume] = useState(50)
  const [isMuted, setIsMuted] = useState(false)
  const [stats, setStats] = useState<AudioStats | null>(null)

  useEffect(() => {
    if (!audioPlayer) return

    const interval = setInterval(() => {
      setStats(audioPlayer.getStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [audioPlayer])

  const handleVolumeChange = (value: number) => {
    setVolume(value)
    audioPlayer?.setVolume(value)
  }

  const handleToggleMute = () => {
    if (audioPlayer) {
      const muted = audioPlayer.toggleMute()
      setIsMuted(muted)
    }
  }

  const handleStopAudio = () => {
    audioPlayer?.stopAllAudio()
  }

  if (!audioPlayer) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Audio Controls</h3>
        <p className="text-sm text-gray-500">Audio player not initialized</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Audio Controls</h3>
      
      {/* Volume Control */}
      <div className="space-y-2">
        <label className="text-xs text-gray-600">Volume: {volume}%</label>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isMuted}
          />
          <button
            onClick={handleToggleMute}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isMuted
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleStopAudio}
          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors"
        >
          Stop All Audio
        </button>
      </div>

      {/* Audio Stats */}
      {stats && (
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={stats.isEnabled ? 'text-green-600' : 'text-red-600'}>
              {stats.isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Audio Frames:</span>
            <span>{stats.frameCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Sources:</span>
            <span>{stats.activeSourcesCount}</span>
          </div>
          {stats.currentResponseId && (
            <div className="flex justify-between">
              <span>Current Response:</span>
              <span className="font-mono text-xs truncate max-w-20" title={stats.currentResponseId}>
                {stats.currentResponseId.slice(-8)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
