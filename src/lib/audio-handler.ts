/**
 * Audio handling utilities for microphone input and audio playback.
 * Handles PCM conversion and audio context management for the Gemini Live API.
 *
 * @module audio-handler
 */

/**
 * Configuration options for the AudioHandler.
 */
export type AudioHandlerConfig = {
  /** Callback when audio data is captured from the microphone */
  onAudioData: (audioBuffer: ArrayBuffer) => void;
  /** Sample rate for input audio capture (default: 16000 Hz - Gemini requirement) */
  inputSampleRate?: number;
  /** Sample rate for output audio playback (default: 24000 Hz - Gemini output format) */
  outputSampleRate?: number;
  /** Callback when audio capture starts */
  onCaptureStart?: () => void;
  /** Callback when audio capture stops */
  onCaptureStop?: () => void;
  /** Callback when audio playback starts */
  onPlaybackStart?: () => void;
  /** Callback when audio playback stops */
  onPlaybackStop?: () => void;
  /** Callback with audio level for visualization (0-1 range) */
  onAudioLevel?: (level: number) => void;
};

/**
 * AudioHandler manages microphone input capture and audio playback.
 * Converts between browser audio formats and PCM formats required by Gemini.
 *
 * Audio Formats:
 * - Input: Captures at configurable sample rate, converts to 16-bit PCM
 * - Output: Receives 16-bit PCM at 24kHz, converts to Float32 for Web Audio API
 *
 * @example
 * ```typescript
 * const handler = new AudioHandler({
 *   onAudioData: (buffer) => geminiClient.sendAudio(buffer),
 *   onAudioLevel: (level) => updateVisualizer(level),
 * });
 *
 * await handler.startCapture();
 * // ... user speaks ...
 * handler.stopCapture();
 *
 * // Play AI response
 * handler.playAudio(responseAudioBuffer);
 * ```
 */
/**
 * Internal config type with required sample rates and optional callbacks.
 */
type InternalConfig = {
  inputSampleRate: number;
  outputSampleRate: number;
  onAudioData: (audioBuffer: ArrayBuffer) => void;
  onCaptureStart?: () => void;
  onCaptureStop?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackStop?: () => void;
  onAudioLevel?: (level: number) => void;
};

export class AudioHandler {
  /** Configuration options */
  private config: InternalConfig;

  /** Blob URL for the AudioWorklet processor. Shared across instances to avoid re-creation. */
  private static workletModuleUrl: string | undefined;

  /** Tracks contexts that already loaded the worklet module to prevent duplicate registrations. */
  private static registeredCaptureContexts: WeakSet<AudioContext> = new WeakSet();

  /** AudioContext for capture operations */
  private captureContext: AudioContext | undefined;

  /** AudioContext for playback operations */
  private playbackContext: AudioContext | undefined;

  /** MediaStream from microphone */
  private mediaStream: MediaStream | undefined;

  /** AudioWorklet node that streams PCM data off the audio thread */
  private captureWorklet: AudioWorkletNode | undefined;

  /** Silent sink to keep the capture graph alive without audible feedback */
  private captureSink: GainNode | undefined;

  /** Source node from microphone */
  private sourceNode: MediaStreamAudioSourceNode | undefined;

  /** Analyser node for audio level monitoring */
  private analyserNode: AnalyserNode | undefined;

  /** Whether audio capture is active */
  private isCapturing = false;

  /** Queue of audio buffers waiting to be played */
  private playbackQueue: ArrayBuffer[] = [];

  /** Whether audio is currently being played */
  private isPlaying = false;

  /** Animation frame ID for audio level monitoring */
  private levelMonitorFrame: number | undefined;

  /**
   * Creates a new AudioHandler instance.
   *
   * @param config - Configuration options
   */
  constructor(config: AudioHandlerConfig) {
    this.config = {
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      onAudioData: config.onAudioData,
      onCaptureStart: config.onCaptureStart,
      onCaptureStop: config.onCaptureStop,
      onPlaybackStart: config.onPlaybackStart,
      onPlaybackStop: config.onPlaybackStop,
      onAudioLevel: config.onAudioLevel
    };
  }

  /**
   * Requests microphone permission and starts audio capture.
   *
   * @throws {Error} If microphone access is denied or unavailable
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) {
      console.warn("[AudioHandler] Already capturing");
      return;
    }

    try {
      // Request microphone access with audio constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.config.inputSampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create AudioContext for capture
      this.captureContext = new AudioContext({
        sampleRate: this.config.inputSampleRate
      });

      if (!this.captureContext.audioWorklet) {
        throw new Error(
          "AudioWorklet is not supported in this browser. Please update to a modern browser to use voice capture."
        );
      }

      // Create source node from microphone stream
      this.sourceNode = this.captureContext.createMediaStreamSource(this.mediaStream);

      // Create analyser for audio level monitoring
      this.analyserNode = this.captureContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Create AudioWorkletNode for low-latency PCM capture
      this.captureWorklet = await this.createCaptureWorklet(this.captureContext);
      this.captureWorklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!this.isCapturing) return;
        const messageData = event.data;

        if (messageData instanceof ArrayBuffer) {
          this.config.onAudioData(messageData);
        } else {
          console.warn("[AudioHandler] Received unexpected message from worklet");
        }
      };

      // Silent sink to keep the processing graph alive without audible feedback
      this.captureSink = this.captureContext.createGain();
      this.captureSink.gain.value = 0;

      // Connect the audio graph: microphone -> analyser -> worklet -> silent sink -> destination
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.captureWorklet);
      this.captureWorklet.connect(this.captureSink);
      this.captureSink.connect(this.captureContext.destination);

      this.isCapturing = true;
      this.config.onCaptureStart?.();

      // Start audio level monitoring
      this.startLevelMonitor();

      console.log("[AudioHandler] Capture started");
    } catch (error) {
      console.error("[AudioHandler] Failed to start capture:", error);
      this.cleanup();

      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error("Microphone access denied. Please allow microphone access to use voice features.");
      }

      throw error;
    }
  }

  /**
   * Stops audio capture and releases microphone resources.
   */
  stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;
    this.stopLevelMonitor();

    // Disconnect and cleanup nodes
    if (this.captureWorklet) {
      this.captureWorklet.port.onmessage = null;
      this.captureWorklet.disconnect();
      this.captureWorklet = undefined;
    }

    if (this.captureSink) {
      this.captureSink.disconnect();
      this.captureSink = undefined;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = undefined;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = undefined;
    }

    // Stop all tracks in the media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = undefined;
    }

    // Close the capture context
    if (this.captureContext && this.captureContext.state !== "closed") {
      this.captureContext.close();
      this.captureContext = undefined;
    }

    this.config.onCaptureStop?.();
    console.log("[AudioHandler] Capture stopped");
  }

  /**
   * Adds an audio buffer to the playback queue.
   * Buffers are played in order, one after another.
   *
   * @param audioBuffer - PCM audio data (16-bit, 24kHz, mono)
   */
  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    this.playbackQueue.push(audioBuffer);

    // Start processing queue if not already playing
    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }

  /**
   * Processes the playback queue, playing buffers sequentially.
   */
  private async processPlaybackQueue(): Promise<void> {
    if (this.isPlaying || this.playbackQueue.length === 0) {
      return;
    }

    this.isPlaying = true;
    this.config.onPlaybackStart?.();

    while (this.playbackQueue.length > 0) {
      const audioBuffer = this.playbackQueue.shift()!;
      await this.playAudioBuffer(audioBuffer);
    }

    this.isPlaying = false;
    this.config.onPlaybackStop?.();
  }

  /**
   * Plays a single audio buffer through the speakers.
   *
   * @param pcmBuffer - PCM audio data (16-bit, 24kHz, mono)
   * @returns Promise that resolves when playback completes
   */
  private async playAudioBuffer(pcmBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      // Ensure playback context exists
      if (!this.playbackContext || this.playbackContext.state === "closed") {
        this.playbackContext = new AudioContext({
          sampleRate: this.config.outputSampleRate
        });
      }

      // Resume context if suspended (browser autoplay policy)
      if (this.playbackContext.state === "suspended") {
        this.playbackContext.resume();
      }

      // Convert PCM to Float32 for Web Audio API
      const pcmData = new Int16Array(pcmBuffer);
      const float32Data = this.pcm16ToFloat32(pcmData);

      // Create and configure audio buffer
      const audioBuffer = this.playbackContext.createBuffer(1, float32Data.length, this.config.outputSampleRate);
      audioBuffer.getChannelData(0).set(float32Data);

      // Create source node and play
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  /**
   * Stops all audio playback immediately.
   * Clears the playback queue and closes the playback context.
   */
  stopPlayback(): void {
    this.playbackQueue = [];
    this.isPlaying = false;

    if (this.playbackContext && this.playbackContext.state !== "closed") {
      this.playbackContext.close();
      this.playbackContext = undefined;
    }

    this.config.onPlaybackStop?.();
  }

  /**
   * Starts monitoring audio level for visualization.
   */
  private startLevelMonitor(): void {
    if (!this.analyserNode || !this.config.onAudioLevel) {
      return;
    }

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const monitor = () => {
      if (!this.isCapturing || !this.analyserNode) {
        return;
      }

      this.analyserNode.getByteFrequencyData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = Math.min(1, rms / 128); // Normalize to 0-1

      this.config.onAudioLevel?.(level);
      this.levelMonitorFrame = requestAnimationFrame(monitor);
    };

    this.levelMonitorFrame = requestAnimationFrame(monitor);
  }

  /**
   * Stops audio level monitoring.
   */
  private stopLevelMonitor(): void {
    if (this.levelMonitorFrame !== undefined) {
      cancelAnimationFrame(this.levelMonitorFrame);
      this.levelMonitorFrame = undefined;
    }
  }

  /**
   * Registers (once per AudioContext) and instantiates the AudioWorklet node that captures PCM16.
   *
   * @param context - AudioContext used for microphone capture
   * @returns Configured AudioWorkletNode ready to receive microphone input
   */
  private async createCaptureWorklet(context: AudioContext): Promise<AudioWorkletNode> {
    const moduleUrl = AudioHandler.getOrCreateWorkletModuleUrl();

    if (!AudioHandler.registeredCaptureContexts.has(context)) {
      await context.audioWorklet.addModule(moduleUrl);
      AudioHandler.registeredCaptureContexts.add(context);
    }

    return new AudioWorkletNode(context, "pcm-capture-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1
    });
  }

  /**
   * Lazily builds a Blob URL for the capture AudioWorklet processor script.
   *
   * The processor converts Float32 audio frames to 16-bit PCM on the audio thread
   * and posts the ArrayBuffer back to the main thread to avoid blocking UI work.
   *
   * @returns Blob URL that can be passed to `audioWorklet.addModule`
   */
  private static getOrCreateWorkletModuleUrl(): string {
    if (!AudioHandler.workletModuleUrl) {
      const workletSource = `
        class PcmCaptureProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (!input || input.length === 0) {
              return true;
            }

            const channelData = input[0];
            const pcmBuffer = new ArrayBuffer(channelData.length * 2);
            const view = new DataView(pcmBuffer);

            for (let i = 0; i < channelData.length; i++) {
              const sample = Math.max(-1, Math.min(1, channelData[i]));
              const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
              view.setInt16(i * 2, intSample, true);
            }

            this.port.postMessage(pcmBuffer, [pcmBuffer]);
            return true;
          }
        }

        registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
      `;

      const workletBlob = new Blob([workletSource], { type: "application/javascript" });
      AudioHandler.workletModuleUrl = URL.createObjectURL(workletBlob);
    }

    return AudioHandler.workletModuleUrl;
  }

  /**
   * Converts 16-bit PCM audio samples to Float32.
   *
   * @param pcm16Array - Int16 PCM samples
   * @returns Float32Array of samples (-1 to 1 range)
   */
  private pcm16ToFloat32(pcm16Array: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16Array.length);

    for (let i = 0; i < pcm16Array.length; i++) {
      // Convert from 16-bit integer to float
      float32[i] = pcm16Array[i] / (pcm16Array[i] < 0 ? 0x8000 : 0x7fff);
    }

    return float32;
  }

  /**
   * Cleans up all resources.
   */
  private cleanup(): void {
    this.stopCapture();
    this.stopPlayback();
  }

  /**
   * Checks if audio is currently being captured.
   *
   * @returns true if capturing
   */
  isRecording(): boolean {
    return this.isCapturing;
  }

  /**
   * Checks if audio is currently being played.
   *
   * @returns true if playing
   */
  isPlayingAudio(): boolean {
    return this.isPlaying;
  }

  /**
   * Gets the number of buffers in the playback queue.
   *
   * @returns Number of queued buffers
   */
  getPlaybackQueueLength(): number {
    return this.playbackQueue.length;
  }

  /**
   * Disposes of all resources. Call this when done with the handler.
   */
  dispose(): void {
    this.cleanup();
    console.log("[AudioHandler] Disposed");
  }
}
