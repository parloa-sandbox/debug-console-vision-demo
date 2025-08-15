/**
 * Audio player for debug console - handles AudioFrame playback
 * Based on frontend AudioProcessor implementation
 * 
 * Audio Format Requirements:
 * - OpenAI: Flexible, typically 24 kHz output
 * - Gemini: Strict requirements
 *   - Input: Raw 16-bit PCM at 16 kHz, little-endian (handled by microphone)
 *   - Output: Raw 16-bit PCM at 24 kHz, little-endian (handled here)
 */

export interface AudioPlayerConfig {
  sampleRate?: number
  bitDepth?: number
  channels?: number
}

export interface AudioStats {
  frameCount: number
  activeSourcesCount: number
  currentResponseId: string | null
  isEnabled: boolean
  isMuted: boolean
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private isEnabled = false
  private isMuted = false
  private processedIds = new Set<string>()
  private frameCount = 0
  private microphoneActive = false
  private originalVolume = 0.5
  private sampleRate = 24000 // Hz (24 kHz for Gemini, standard for other runtimes)
  private bitDepth = 16 // bits per sample
  private channels = 1 // mono output
  private nextPlaybackTime = 0
  private currentResponseId: string | null = null
  private activeAudioSources = new Set<AudioBufferSourceNode>()

  constructor(config?: AudioPlayerConfig) {
    if (config) {
      this.sampleRate = config.sampleRate ?? this.sampleRate
      this.bitDepth = config.bitDepth ?? this.bitDepth
      this.channels = config.channels ?? this.channels
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const AudioContextConstructor = window.AudioContext || 
        (window as any).webkitAudioContext
      this.audioContext = new AudioContextConstructor()

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 0.5 // 50% volume

      // Create analyser node for frequency analysis (future feature)
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 512
      this.analyserNode.smoothingTimeConstant = 0.3

      // Connect: sources -> gainNode -> analyserNode -> destination
      this.gainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.audioContext.destination)

      this.isEnabled = true
      console.log('🔊 Audio player initialized successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize audio player:', error)
      return false
    }
  }

  async playAudioChunk(
    base64Data: string,
    frameId?: string,
    responseId?: string
  ): Promise<boolean> {
    if (!this.isEnabled || !this.audioContext || this.isMuted) return false

    if (this.isDuplicate(frameId)) return false

    // Track the current response ID
    if (responseId && responseId !== this.currentResponseId) {
      this.currentResponseId = responseId
      console.log(`🎵 Starting audio for response: ${responseId}`)
    }

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const audioBuffer = this.convertPcmToAudioBuffer(base64Data)
      const src = this.audioContext.createBufferSource()
      src.buffer = audioBuffer
      src.connect(this.gainNode!)

      // Track active audio source BEFORE scheduling it
      this.activeAudioSources.add(src)

      // Clean up when audio finishes
      src.onended = () => {
        this.activeAudioSources.delete(src)
      }

      const now = this.audioContext.currentTime
      // Use more conservative scheduling to improve audio quality
      if (this.nextPlaybackTime < now + 0.05) this.nextPlaybackTime = now + 0.05

      // Schedule the audio with small gap to prevent audio artifacts
      src.start(this.nextPlaybackTime)
      this.nextPlaybackTime += audioBuffer.duration + 0.01 // Small gap between chunks
      this.frameCount++
      
      console.log(`🔊 Played audio chunk ${this.frameCount} (${audioBuffer.duration.toFixed(3)}s)`)
      return true
    } catch (error) {
      console.error('❌ Audio playback failed:', error)
      return false
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode && !this.isMuted) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume / 100))
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted
    if (this.gainNode) {
      this.gainNode.gain.value = this.isMuted ? 0 : 0.5
    }
    console.log(`🔊 Audio ${this.isMuted ? 'muted' : 'unmuted'}`)
    return this.isMuted
  }

  stopAllAudio(): void {
    // Stop all active audio sources
    const count = this.activeAudioSources.size
    if (count > 0) {
      console.log(`🛑 Stopping ${count} audio source(s)`)
    }

    this.activeAudioSources.forEach(source => {
      try {
        source.stop()
      } catch {
        // Source might already be stopped, ignore error
      }
    })
    this.activeAudioSources.clear()

    // Reset timing
    if (this.audioContext) {
      this.nextPlaybackTime = this.audioContext.currentTime
    }

    // Clear cache
    this.processedIds.clear()
    console.log('🛑 All audio stopped')
  }

  interrupt(responseId?: string): boolean {
    const targetResponseId = responseId || this.currentResponseId
    this.stopAllAudio()
    console.log(`🛑 Audio interrupted for response ${targetResponseId || 'unknown'}`)
    return true
  }

  getStats(): AudioStats {
    return {
      frameCount: this.frameCount,
      activeSourcesCount: this.activeAudioSources.size,
      currentResponseId: this.currentResponseId,
      isEnabled: this.isEnabled,
      isMuted: this.isMuted,
    }
  }

  private isDuplicate(frameId?: string): boolean {
    if (!frameId) return false

    if (this.processedIds.has(frameId)) {
      return true
    }

    this.processedIds.add(frameId)
    this.cleanupProcessedIds()
    return false
  }

  private cleanupProcessedIds(): void {
    if (this.processedIds.size > 1000) {
      const idsArray = Array.from(this.processedIds)
      const toRemove = idsArray.slice(0, 100)
      toRemove.forEach(id => this.processedIds.delete(id))
    }
  }

  private convertPcmToAudioBuffer(base64Data: string): AudioBuffer {
    const arrayBuffer = this.base64ToArrayBuffer(base64Data)
    const dataView = new DataView(arrayBuffer)

    const sampleRate = this.sampleRate
    const bytesPerSample = this.bitDepth / 8
    const samples = arrayBuffer.byteLength / bytesPerSample
    const audioBuffer = this.audioContext!.createBuffer(
      this.channels,
      samples,
      sampleRate
    )
    const channelData = audioBuffer.getChannelData(0)

    const normalizationFactor = Math.pow(2, this.bitDepth - 1)
    for (let i = 0; i < samples; i++) {
      const sample = dataView.getInt16(i * bytesPerSample, true)
      channelData[i] = sample / normalizationFactor
    }

    return audioBuffer
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Set microphone active state to adjust audio playback accordingly
   */
  setMicrophoneActive(active: boolean): void {
    if (this.microphoneActive === active) return
    
    this.microphoneActive = active
    console.log(`🎤 Microphone ${active ? 'activated' : 'deactivated'}`)
    
    if (!this.gainNode) return

    if (active) {
      // Duck audio volume when microphone is active to prevent feedback
      this.originalVolume = this.gainNode.gain.value
      this.gainNode.gain.setValueAtTime(this.originalVolume * 0.3, this.audioContext!.currentTime)
      console.log('🔇 Audio ducked for microphone usage')
    } else {
      // Restore original volume when microphone is off
      this.gainNode.gain.setValueAtTime(this.originalVolume, this.audioContext!.currentTime)
      console.log('🔊 Audio volume restored')
    }
  }

  /**
   * Check if microphone is currently active
   */
  isMicrophoneActive(): boolean {
    return this.microphoneActive
  }
}
