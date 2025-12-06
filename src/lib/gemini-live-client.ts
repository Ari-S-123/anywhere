/**
 * Gemini Live API client for real-time voice interaction.
 * Handles WebSocket connection, audio streaming, and function call execution.
 *
 * @module gemini-live-client
 */

import { GoogleGenAI, Modality, type FunctionDeclaration, type LiveServerMessage } from "@google/genai";

/**
 * Configuration options for creating a Gemini Live session.
 */
export type LiveSessionConfig = {
  /** Gemini API key */
  apiKey: string;
  /** System prompt defining the AI agent's behavior */
  systemInstruction: string;
  /** Function declarations for navigation tools */
  tools: FunctionDeclaration[];
  /** Callback when audio response data is received */
  onAudioResponse: (audioData: ArrayBuffer) => void;
  /** Callback when a function call is requested by the AI */
  onFunctionCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Callback when text response is received */
  onTextResponse: (text: string) => void;
  /** Callback when connection state changes */
  onConnectionChange: (connected: boolean) => void;
  /** Callback for error handling */
  onError: (error: Error) => void;
  /** Optional callback when AI turn is complete */
  onTurnComplete?: () => void;
  /** Optional callback when transcription is received */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
};

/**
 * Current state of the live session.
 */
export type SessionState = {
  /** Whether the WebSocket connection is established */
  isConnected: boolean;
  /** Whether the AI is currently processing a request */
  isProcessing: boolean;
  /** Whether the AI is currently speaking (audio output) */
  isSpeaking: boolean;
};

/**
 * Internal type for the live session returned by the SDK.
 */
type LiveSession = Awaited<ReturnType<GoogleGenAI["live"]["connect"]>>;

/**
 * GeminiLiveClient manages the WebSocket connection to Gemini Live API.
 * Provides methods for sending audio, text, and context updates, and
 * handles incoming audio, text, and function call responses.
 *
 * @example
 * ```typescript
 * const client = new GeminiLiveClient({
 *   apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
 *   systemInstruction: SYSTEM_PROMPT,
 *   tools: navigationFunctions,
 *   onAudioResponse: (audio) => audioHandler.playAudio(audio),
 *   onFunctionCall: async (name, args) => executeNavigation(name, args),
 *   onTextResponse: (text) => setAiResponse(text),
 *   onConnectionChange: (connected) => setIsConnected(connected),
 *   onError: (error) => console.error(error),
 * });
 *
 * await client.connect();
 * client.sendAudio(audioBuffer);
 * ```
 */
export class GeminiLiveClient {
  /** Google GenAI SDK instance */
  private ai: GoogleGenAI;

  /** Active WebSocket session */
  private session: LiveSession | undefined;

  /** Configuration options */
  private config: LiveSessionConfig;

  /** Current session state */
  private state: SessionState;

  /** Queue for pending function call responses */
  private pendingFunctionCalls: Map<string, { resolve: (value: unknown) => void }> = new Map();

  /**
   * Creates a new GeminiLiveClient instance.
   *
   * @param config - Configuration options for the session
   * @throws {Error} If apiKey is not provided
   */
  constructor(config: LiveSessionConfig) {
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new Error("Gemini API key is required");
    }

    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.config = config;
    this.state = {
      isConnected: false,
      isProcessing: false,
      isSpeaking: false
    };
  }

  /**
   * Establishes a WebSocket connection to the Gemini Live API.
   * Waits for the WebSocket open event and fails fast if the connection
   * does not reach a ready state within the timeout window. This prevents
   * callers from attempting to stream audio or text before the session is
   * actually connected.
   *
   * @throws {Error} If connection fails or times out
   */
  async connect(): Promise<void> {
    try {
      // Use the native audio model for voice interactions as specified in the technical spec
      // Model: gemini-2.5-flash-native-audio-preview-09-2025 supports bidirectional audio streaming
      const model = "gemini-2.5-flash-native-audio-preview-09-2025";

      let resolveConnectionReady: (() => void) | undefined;
      let rejectConnectionReady: ((error: Error) => void) | undefined;
      let isConnectionSettled = false;

      const resolveReady = (): void => {
        if (isConnectionSettled) {
          return;
        }
        isConnectionSettled = true;
        clearTimeout(timeoutId);
        resolveConnectionReady?.();
      };

      const rejectReady = (error: Error): void => {
        if (isConnectionSettled) {
          return;
        }
        isConnectionSettled = true;
        clearTimeout(timeoutId);
        rejectConnectionReady?.(error);
      };

      const timeoutId = setTimeout(() => {
        rejectReady(new Error("Timed out while waiting for Gemini Live API connection"));
      }, 10000);

      const connectionReady = new Promise<void>((resolve, reject) => {
        resolveConnectionReady = resolve;
        rejectConnectionReady = reject;
      });

      this.session = await this.ai.live.connect({
        model,
        config: {
          // Per Live API docs, only one response modality is allowed per session.
          // Selecting AUDIO preserves speech output while we rely on
          // outputAudioTranscription for UI text.
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.config.systemInstruction,
          tools: [
            { googleSearch: {} }, // Enable search grounding for knowledge retrieval
            { functionDeclarations: this.config.tools }
          ],
          // Enable transcription for both input and output audio
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            this.handleOpen();
            resolveReady();
          },
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onerror: (error: ErrorEvent) => {
            this.handleError(error);
            rejectReady(new Error(error.message || "WebSocket connection error"));
          },
          onclose: (event: CloseEvent) => {
            this.handleClose(event);
            if (!isConnectionSettled) {
              rejectReady(
                new Error(`Connection closed before ready: ${event.code}${event.reason ? ` - ${event.reason}` : ""}`)
              );
            }
          }
        }
      });

      await connectionReady;

      console.log("[GeminiLive] Connection initiated");
    } catch (error) {
      console.error("[GeminiLive] Connection failed:", error);
      this.state.isConnected = false;
      this.config.onConnectionChange(false);
      throw error;
    }
  }

  /**
   * Handles WebSocket connection open event.
   */
  private handleOpen(): void {
    this.state.isConnected = true;
    this.config.onConnectionChange(true);
    console.log("[GeminiLive] Connected successfully");
  }

  /**
   * Handles incoming messages from the Gemini Live API.
   *
   * @param message - The server message to process
   */
  private handleMessage(message: LiveServerMessage): void {
    // Handle audio data
    if (message.data) {
      this.state.isSpeaking = true;
      const audioBuffer = this.base64ToArrayBuffer(message.data);
      this.config.onAudioResponse(audioBuffer);
    }

    // Handle server content (text responses, turn completion)
    if (message.serverContent) {
      const serverContent = message.serverContent;

      // Check for turn completion
      if (serverContent.turnComplete) {
        this.state.isProcessing = false;
        this.state.isSpeaking = false;
        this.config.onTurnComplete?.();
      }

      // Process model turn parts (text and function calls)
      if (serverContent.modelTurn?.parts) {
        for (const part of serverContent.modelTurn.parts) {
          // Handle text response
          if (part.text) {
            this.config.onTextResponse(part.text);
          }

          // Handle inline function calls in model turn
          if (part.functionCall && part.functionCall.name) {
            this.executeFunctionCall(
              part.functionCall.name,
              (part.functionCall.args as Record<string, unknown>) ?? {},
              ""
            );
          }
        }
      }

      // Handle input transcription (what the user said)
      if (serverContent.inputTranscription?.text) {
        this.config.onTranscript?.(serverContent.inputTranscription.text, true);
      }

      // Handle output transcription (what the AI said)
      if (serverContent.outputTranscription?.text) {
        this.config.onTextResponse(serverContent.outputTranscription.text);
      }
    }

    // Handle tool calls (function call requests)
    if (message.toolCall?.functionCalls) {
      this.state.isProcessing = true;

      for (const fc of message.toolCall.functionCalls) {
        if (fc.name) {
          this.executeFunctionCall(fc.name, (fc.args as Record<string, unknown>) ?? {}, fc.id ?? "");
        }
      }
    }
  }

  /**
   * Executes a function call requested by the AI and sends the response back.
   *
   * @param name - Name of the function to execute
   * @param args - Arguments for the function
   * @param id - Function call ID for response correlation
   */
  private async executeFunctionCall(name: string, args: Record<string, unknown>, id: string): Promise<void> {
    try {
      console.log(`[GeminiLive] Executing function: ${name}`, args);
      const result = await this.config.onFunctionCall(name, args);

      // Send function response back to the model if we have an ID
      if (id && this.session) {
        const responsePayload = this.normalizeFunctionResponsePayload(result);

        await this.session.sendToolResponse({
          functionResponses: [
            {
              id,
              name,
              response: responsePayload
            }
          ]
        });
      }
    } catch (error) {
      console.error(`[GeminiLive] Function call ${name} failed:`, error);

      // Send error response back to the model
      if (id && this.session) {
        await this.session.sendToolResponse({
          functionResponses: [
            {
              id,
              name,
              response: {
                error: error instanceof Error ? error.message : "Unknown error"
              }
            }
          ]
        });
      }
    }
  }

  /**
   * Handles WebSocket error events.
   *
   * @param error - The error event
   */
  private handleError(error: ErrorEvent): void {
    console.error("[GeminiLive] WebSocket error:", error);
    this.config.onError(new Error(error.message || "WebSocket connection error"));
  }

  /**
   * Handles WebSocket close events.
   *
   * @param event - The close event
   */
  private handleClose(event: CloseEvent): void {
    this.state.isConnected = false;
    this.state.isProcessing = false;
    this.state.isSpeaking = false;
    this.config.onConnectionChange(false);
    console.log(`[GeminiLive] Connection closed: ${event.code} - ${event.reason}`);
  }

  /**
   * Sends audio data to the Gemini Live API for processing.
   *
   * @param audioBuffer - Raw PCM audio data (16-bit, 16kHz, mono)
   * @throws {Error} If not connected
   */
  async sendAudio(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.session || !this.state.isConnected) {
      throw new Error("Not connected to Gemini Live API");
    }

    const base64Audio = this.arrayBufferToBase64(audioBuffer);

    await this.session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000"
      }
    });
  }

  /**
   * Sends a text message to the Gemini Live API.
   *
   * @param text - Text message to send
   * @throws {Error} If not connected
   */
  async sendText(text: string): Promise<void> {
    if (!this.session || !this.state.isConnected) {
      throw new Error("Not connected to Gemini Live API");
    }

    this.state.isProcessing = true;

    await this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true
    });
  }

  /**
   * Sends a context update about the current viewport to the AI.
   * This keeps the AI informed about the current position and view.
   *
   * @param context - Current viewport context
   */
  async sendContextUpdate(context: {
    position: { lat: number; lng: number };
    pov: { heading: number; pitch: number };
    address?: string;
  }): Promise<void> {
    if (!this.session || !this.state.isConnected) {
      return;
    }

    const contextMessage = this.formatContextMessage(context);

    // Send as a system-like message that doesn't require a response
    await this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: contextMessage }] }],
      turnComplete: false // Don't require AI response for context updates
    });
  }

  /**
   * Formats a context update message for the AI.
   *
   * @param context - Viewport context data
   * @returns Formatted context message string
   */
  private formatContextMessage(context: {
    position: { lat: number; lng: number };
    pov: { heading: number; pitch: number };
    address?: string;
  }): string {
    const headingCardinal = this.headingToCardinal(context.pov.heading);

    return `[SYSTEM_UPDATE] Current viewport:
- Position: ${context.position.lat.toFixed(6)}°, ${context.position.lng.toFixed(6)}°
- Heading: ${context.pov.heading.toFixed(1)}° (${headingCardinal})
- Pitch: ${context.pov.pitch.toFixed(1)}°
${context.address ? `- Address: ${context.address}` : "- Address: Unknown"}`;
  }

  /**
   * Converts heading degrees to a cardinal direction string.
   *
   * @param heading - Heading in degrees (0-360)
   * @returns Cardinal direction (N, NE, E, SE, S, SW, W, NW)
   */
  private headingToCardinal(heading: number): string {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const normalizedHeading = ((heading % 360) + 360) % 360;
    const index = Math.round(normalizedHeading / 45) % 8;
    return directions[index];
  }

  /**
   * Disconnects from the Gemini Live API.
   */
  disconnect(): void {
    if (this.session) {
      this.session.close();
      this.session = undefined;
    }

    this.state = {
      isConnected: false,
      isProcessing: false,
      isSpeaking: false
    };

    this.pendingFunctionCalls.clear();
    console.log("[GeminiLive] Disconnected");
  }

  /**
   * Interrupts the current AI response.
   * Useful when the user starts speaking while the AI is still talking.
   */
  async interrupt(): Promise<void> {
    if (!this.session || !this.state.isConnected) {
      return;
    }

    // Send an empty realtime input to signal interruption
    await this.session.sendRealtimeInput({});
    this.state.isSpeaking = false;
  }

  /**
   * Normalizes arbitrary function results into a JSON-serializable payload
   * suitable for Live API tool responses.
   *
   * @param result - Raw result returned by the navigation handler
   * @returns Plain object that can be safely sent back to Gemini
   */
  private normalizeFunctionResponsePayload(result: unknown): Record<string, unknown> {
    if (result === undefined || result === null) {
      return {};
    }

    if (typeof result === "object") {
      try {
        return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
      } catch (serializationError) {
        console.warn(
          "[GeminiLive] Failed to serialize function result, returning stringified output",
          serializationError
        );
        return { output: String(result) };
      }
    }

    return { output: result };
  }

  /**
   * Converts an ArrayBuffer to a base64 string.
   *
   * @param buffer - The ArrayBuffer to convert
   * @returns Base64 encoded string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts a base64 string to an ArrayBuffer.
   *
   * @param base64 - The base64 string to convert
   * @returns Decoded ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Gets the current session state.
   *
   * @returns Copy of the current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Checks if the client is currently connected.
   *
   * @returns true if connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Checks if the AI is currently processing a request.
   *
   * @returns true if processing
   */
  isProcessing(): boolean {
    return this.state.isProcessing;
  }

  /**
   * Checks if the AI is currently speaking.
   *
   * @returns true if speaking
   */
  isSpeaking(): boolean {
    return this.state.isSpeaking;
  }
}
