export class MicrophoneManager {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private isRecording = false
  private onDataCallback: ((chunk: string) => void) | null = null

  async start(onData: (chunk: string) => void): Promise<void> {
    try {
      this.onDataCallback = onData
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 16 kHz sample rate matches Gemini's input requirements
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return

        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = this.float32ToPCM16(inputData)
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)))
        
        if (this.onDataCallback) {
          this.onDataCallback(base64)
        }
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      this.isRecording = true
    } catch (error) {
      console.error('Failed to start microphone:', error)
      throw error
    }
  }

  stop(): void {
    this.isRecording = false

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    this.onDataCallback = null
  }

  private float32ToPCM16(float32Array: Float32Array): Int16Array {
    // Convert Float32 audio data to 16-bit PCM, little-endian format
    // This matches Gemini's input requirements
    const pcm16 = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return pcm16
  }

  isActive(): boolean {
    return this.isRecording
  }
}
