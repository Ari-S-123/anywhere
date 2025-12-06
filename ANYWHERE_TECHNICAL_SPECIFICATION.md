# Anywhere — Technical Specification

**Version:** 1.0.0  
**Last Updated:** December 6, 2025  
**Tagline:** Go _Anywhere_

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Naming Recommendation](#2-project-naming-recommendation)
3. [Architecture Overview](#3-architecture-overview)
4. [Technology Stack (Verified December 2025)](#4-technology-stack-verified-december-2025)
5. [Core Features](#5-core-features)
6. [Detailed Implementation Guide](#6-detailed-implementation-guide)
7. [API Integration Specifications](#7-api-integration-specifications)
8. [UI/UX Design System](#8-uiux-design-system)
9. [Prompt Engineering Strategy](#9-prompt-engineering-strategy)
10. [Project Structure](#10-project-structure)
11. [Development Phases & Timeline](#11-development-phases--timeline)
12. [Deployment Configuration](#12-deployment-configuration)
13. [Environment Variables](#13-environment-variables)
14. [Testing Strategy](#14-testing-strategy)
15. [Known Limitations & Mitigations](#15-known-limitations--mitigations)
16. [References & Documentation Links](#16-references--documentation-links)

---

## 1. Executive Summary

Anywhere is a next-generation, voice-controlled virtual explorer that transforms Google Street View into an interactive, AI-guided tour experience. Unlike existing solutions (such as Google's Talking Tours experiment which has limited predetermined locations and static images), Anywhere provides:

- **Unrestricted Global Exploration**: Access any location available on Google Maps Street View
- **Real-Time Voice Interaction**: Bidirectional audio streaming with Gemini Live API
- **Intelligent Navigation**: AI-controlled camera movements via function calling (not pixel-based browser automation)
- **Live Knowledge Grounding**: Real-time web searches for accurate, up-to-date information about landmarks
- **AI-Generated Souvenirs**: Nano Banana Pro integration for creating personalized "selfie" composites

### Core Innovation

The critical architectural decision that differentiates this project is the use of **Agentic Function Calling** instead of browser automation libraries like "Browser Use". Browser automation fails on WebGL canvases (like Street View) because the `<canvas>` element has no DOM buttons to click. Instead, the AI directly commands the Google Maps JavaScript API through structured tool calls.

---

## 2. Project Naming Recommendation

### Selected Name: **Anywhere**

**Tagline:** Go _Anywhere_

**Rationale:**

- **Universal Appeal**: The name directly communicates the core value proposition—explore any location on Earth
- **Action-Oriented**: Combined with "Go," it creates an imperative that invites exploration
- **Memorable**: Simple, one-word name that's easy to remember and share
- **Aspirational**: Evokes freedom, possibility, and unlimited exploration
- **Brand Potential**: Works well standalone or as "Anywhere AI"

### Alternative Names Considered

| Rank | Name         | Reasoning                                                |
| ---- | ------------ | -------------------------------------------------------- |
| 1    | **Meridian** | Geographic term, unique, professional                    |
| 2    | **Vantage**  | "A place affording a good view"—perfect for tour guide   |
| 3    | **Polaris**  | The North Star, navigation symbolism                     |
| 4    | **Azimuth**  | Direction measurement, technical but memorable           |
| 5    | **Panorama** | 360° view, directly describes the Street View experience |

### Names to Avoid

- **Atlas** — Overused, generic
- **Explorer** — Too generic, conflicts with Microsoft browser
- **Navigator** — Conflicts with deprecated browser APIs

---

## 3. Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Next.js 16)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Street View     │  │  Audio Stream    │  │  UI Controls     │          │
│  │  Panorama        │  │  Handler         │  │  (Shadcn UI)     │          │
│  │  (Google Maps)   │  │  (WebSocket)     │  │                  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                           │
│                    ┌────────────▼────────────┐                              │
│                    │    Zustand State Store   │                              │
│                    │  - Current Position      │                              │
│                    │  - POV (heading/pitch)   │                              │
│                    │  - Session State         │                              │
│                    │  - Tour History          │                              │
│                    └────────────┬────────────┘                              │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    API Route Handler       │
                    │    /api/live-session       │
                    └─────────────┬─────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                         GEMINI LIVE API                                      │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                    ┌────────────▼────────────┐                              │
│                    │   WebSocket Connection   │                              │
│                    │   (Bidirectional Audio)  │                              │
│                    └────────────┬────────────┘                              │
│                                 │                                           │
│    ┌────────────────────────────┼────────────────────────────┐              │
│    │                            │                            │              │
│    ▼                            ▼                            ▼              │
│ ┌──────────────┐  ┌──────────────────────┐  ┌──────────────────────┐       │
│ │ Voice Input  │  │  Function Calling     │  │  Google Search       │       │
│ │ Processing   │  │  (Navigation Tools)   │  │  Grounding           │       │
│ │ (VAD)        │  │                       │  │                      │       │
│ └──────────────┘  └──────────────────────┘  └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   NANO BANANA PRO API     │
                    │   (Selfie Generation)     │
                    └───────────────────────────┘
```

### Data Flow

1. **User Speaks** → Microphone captures audio → Streamed to Gemini Live API via WebSocket
2. **Gemini Processes** → VAD detects speech end → Model generates response
3. **Response Types**:
   - **Audio**: Streamed back to client speakers
   - **Function Call**: `pan_camera`, `move_forward`, `teleport`, `look_at`
   - **Search Query**: Grounded information retrieval
4. **Frontend Executes** → GSAP animates Street View camera → State updates in Zustand
5. **Context Loop** → New POV coordinates sent back to model for awareness

---

## 4. Technology Stack (Verified December 2025)

### Frontend Framework

| Technology       | Version | Purpose                                        |
| ---------------- | ------- | ---------------------------------------------- |
| **Next.js**      | 16.0.7  | App Router, React Server Components, Turbopack |
| **React**        | 19.2.x  | View Transitions, useEffectEvent, Activity     |
| **TypeScript**   | 5.7.x   | Type safety, strict mode                       |
| **Tailwind CSS** | 4.x     | Utility-first styling                          |

**Key Next.js 16 Features Used:**

- `use cache` directive for caching components
- Turbopack as default bundler (5-10x faster builds)
- View Transitions API for smooth page animations
- React 19.2 features including View Transitions

### UI Component Library

| Technology       | Version | Purpose                           |
| ---------------- | ------- | --------------------------------- |
| **Shadcn UI**    | Latest  | Pre-styled, accessible components |
| **Radix UI**     | Latest  | Underlying primitive components   |
| **Lucide React** | Latest  | Icon library                      |

**Installation:**

```bash
pnpx shadcn@latest init
pnpx shadcn@latest add button card dialog slider tooltip sheet
```

### State Management

| Technology  | Version | Purpose                       |
| ----------- | ------- | ----------------------------- |
| **Zustand** | 5.x     | Lightweight client-side state |

### Animation

| Technology      | Version | Purpose                             |
| --------------- | ------- | ----------------------------------- |
| **GSAP**        | 3.12.x  | High-performance animations         |
| **@gsap/react** | 2.x     | React integration with useGSAP hook |

**Installation:**

```bash
pnpm add gsap @gsap/react
```

### Maps Integration

| Technology                     | Version | Purpose                      |
| ------------------------------ | ------- | ---------------------------- |
| **Google Maps JavaScript API** | 3.60+   | Street View panorama control |
| **@googlemaps/js-api-loader**  | 1.16.x  | Dynamic script loading       |

### AI/ML APIs

| Technology                  | Model ID                                        | Purpose                         |
| --------------------------- | ----------------------------------------------- | ------------------------------- |
| **Gemini 3 Pro**            | `gemini-3-pro-preview`                          | Primary orchestrator, reasoning |
| **Gemini Live API**         | `gemini-2.5-flash-native-audio-preview-09-2025` | Real-time voice streaming       |
| **Nano Banana Pro**         | `gemini-3-pro-image-preview`                    | AI selfie generation            |
| **Google Search Grounding** | N/A (tool)                                      | Real-time knowledge retrieval   |

### SDK

| Package           | Version | Purpose                              |
| ----------------- | ------- | ------------------------------------ |
| **@google/genai** | Latest  | Official Google Gen AI SDK for JS/TS |

**Installation:**

```bash
pnpm add @google/genai
```

### Audio Processing

| Technology            | Purpose                                   |
| --------------------- | ----------------------------------------- |
| **Web Audio API**     | Audio capture and playback                |
| **PCM 16-bit, 16kHz** | Input audio format (Live API requirement) |
| **PCM 24kHz**         | Output audio format                       |

---

## 5. Core Features

### Feature A: Ghost Navigator (AI-Controlled Street View)

**Problem Solved:** Browser automation tools like "Browser Use" fail on WebGL canvases because Street View is rendered as a single `<canvas>` element with no DOM buttons for navigation.

**Solution:** Agentic Function Calling — the AI issues structured commands that the frontend interprets and executes against the Google Maps API.

#### Navigation Tool Schema

```typescript
/**
 * Navigation tools available to the Gemini agent.
 * These are declared as function definitions and passed to the Live API config.
 */
type NavigationTools = {
  /**
   * Smoothly rotate the camera view.
   * @param heading_degrees - Target heading (0-360, where 0=North, 90=East)
   * @param pitch_degrees - Target pitch (-90 to 90, where 0=horizon)
   */
  pan_camera: {
    heading_degrees: number;
    pitch_degrees: number;
  };

  /**
   * Move forward along the current street.
   * @param steps - Number of panorama steps to advance (1-5)
   */
  move_forward: {
    steps: number;
  };

  /**
   * Teleport to a named location.
   * @param location_name - Natural language location (e.g., "Eiffel Tower")
   */
  teleport: {
    location_name: string;
  };

  /**
   * Center the view on a described object.
   * @param object_description - What to look at (e.g., "the red building on the left")
   */
  look_at: {
    object_description: string;
  };

  /**
   * Get information about the current location.
   * Triggers Google Search grounding to retrieve facts.
   */
  get_location_info: {};

  /**
   * Take a selfie at the current location.
   * @param style - Optional style modifier (e.g., "polaroid", "vintage")
   */
  take_selfie: {
    style?: string;
  };
};
```

#### Function Declaration Format (for Gemini API)

```typescript
const navigationFunctions = [
  {
    name: "pan_camera",
    description:
      "Smoothly rotate the Street View camera to a new heading and pitch. Use this when the user asks to 'turn', 'look', or 'face' a direction.",
    parameters: {
      type: "object",
      properties: {
        heading_degrees: {
          type: "number",
          description: "Target heading in degrees (0-360). 0=North, 90=East, 180=South, 270=West."
        },
        pitch_degrees: {
          type: "number",
          description: "Target pitch in degrees (-90 to 90). 0=horizon, positive=up, negative=down."
        }
      },
      required: ["heading_degrees", "pitch_degrees"]
    }
  },
  {
    name: "move_forward",
    description:
      "Advance along the current street. Use when the user says 'go forward', 'keep walking', or 'continue down the street'.",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "number",
          description: "Number of panorama positions to advance (1-5). Each step is roughly 10-20 meters."
        }
      },
      required: ["steps"]
    }
  },
  {
    name: "teleport",
    description:
      "Instantly travel to a named location anywhere in the world. Use when the user asks to 'go to', 'take me to', or 'visit' a place.",
    parameters: {
      type: "object",
      properties: {
        location_name: {
          type: "string",
          description:
            "Natural language location name (e.g., 'Eiffel Tower', 'Times Square New York', 'Tokyo Shibuya Crossing')."
        }
      },
      required: ["location_name"]
    }
  },
  {
    name: "look_at",
    description:
      "Center the view on a specific object or feature visible in the current scene. Use when the user asks to 'look at', 'focus on', or 'show me' something.",
    parameters: {
      type: "object",
      properties: {
        object_description: {
          type: "string",
          description:
            "Description of what to look at (e.g., 'the church steeple', 'the red car on the left', 'the mountain in the distance')."
        }
      },
      required: ["object_description"]
    }
  },
  {
    name: "get_location_info",
    description:
      "Search for interesting facts and history about the current location. Use when the user asks 'tell me about this place', 'what's the history here', or 'any interesting facts'.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "take_selfie",
    description:
      "Generate an AI composite image inserting the user into the current Street View scene. Use when the user says 'take a selfie', 'put me in this photo', or 'souvenir picture'.",
    parameters: {
      type: "object",
      properties: {
        style: {
          type: "string",
          description: "Optional style for the image (e.g., 'polaroid', 'vintage', 'professional', 'fun')."
        }
      }
    }
  }
];
```

### Feature B: Rick Steves Brain (Live Context & Knowledge)

The agent maintains awareness of its current location and can retrieve real-time information.

#### Context Injection Strategy

Every 5 seconds (or after movement), the frontend sends a context update:

```typescript
type ViewportContext = {
  position: {
    lat: number;
    lng: number;
  };
  pov: {
    heading: number;
    pitch: number;
    fov: number;
  };
  address: string | undefined; // Reverse geocoded address
  nearby_places: string[]; // From Places API
  visible_text: string[]; // OCR'd text from signage (optional)
  timestamp: string;
};
```

#### Google Search Grounding Configuration

```typescript
const tools = [
  { googleSearch: {} }, // Enable search grounding
  { functionDeclarations: navigationFunctions }
];

const config = {
  responseModalities: ["AUDIO"],
  tools: tools,
  systemInstruction: SYSTEM_PROMPT
};
```

### Feature C: Nano Banana Pro Selfie Souvenirs

Users can upload their photo and have AI composite them into the current Street View scene.

#### Workflow

1. **Capture Background**: Use Google Maps Static Street View API

   ```
   https://maps.googleapis.com/maps/api/streetview
     ?size=1920x1080
     &location={lat},{lng}
     &heading={heading}
     &pitch={pitch}
     &fov={fov}
     &key={API_KEY}
   ```

2. **Upload User Photo**: Client-side file picker with validation

3. **Compose with Nano Banana Pro**:

   ```typescript
   const response = await ai.models.generateContent({
     model: "gemini-3-pro-image-preview",
     contents: [
       {
         parts: [
           {
             text: `Insert the person from the first image into the scene of the second image.
                    Match the lighting (detect if overcast, sunny, golden hour).
                    Scale them to appear 3 meters from the camera.
                    Maintain facial features exactly. Do not distort.
                    Style: ${style || "natural photograph"}`
           },
           { inlineData: { mimeType: "image/jpeg", data: userPhotoBase64 } },
           { inlineData: { mimeType: "image/jpeg", data: streetViewBase64 } }
         ]
       }
     ],
     config: {
       responseModalities: ["IMAGE", "TEXT"]
     }
   });
   ```

4. **Display Result**: Animated overlay with download option

---

## 6. Detailed Implementation Guide

### Phase 1: Project Setup (Hours 1-3)

#### Step 1.1: Initialize Next.js 16 Project

```bash
pnpx create-next-app@latest anywhere --typescript --tailwind --eslint --app --src-dir
cd anywhere
```

#### Step 1.2: Install Dependencies

```bash
# Core dependencies
pnpm add @google/genai zustand gsap @gsap/react

# Google Maps
pnpm add @googlemaps/js-api-loader

# Shadcn UI setup
pnpx shadcn@latest init

# Add required Shadcn components
pnpx shadcn@latest add button card dialog sheet slider tooltip avatar badge separator scroll-area

# Audio processing utilities
pnpm add wavefile

# Development dependencies
pnpm add -D @types/google.maps
```

#### Step 1.3: Configure TypeScript

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["google.maps"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### Step 1.4: Configure Next.js

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com"
      },
      {
        protocol: "https",
        hostname: "streetviewpixels-pa.googleapis.com"
      }
    ]
  }
};

export default nextConfig;
```

### Phase 2: Street View Integration (Hours 3-6)

#### Step 2.1: Create Maps Loader Utility

Create `src/lib/maps-loader.ts`:

````typescript
/**
 * Google Maps API loader utility.
 * Ensures the Google Maps script is loaded only once and provides
 * typed access to the google.maps namespace.
 */

import { Loader } from "@googlemaps/js-api-loader";

/** Singleton loader instance */
let loaderInstance: Loader | undefined;

/** Promise that resolves when the API is loaded */
let loadPromise: Promise<typeof google> | undefined;

/**
 * Configuration options for the Google Maps loader.
 */
type MapsLoaderConfig = {
  /** Google Maps API key */
  apiKey: string;
  /** API version to load (default: "weekly") */
  version?: string;
  /** Additional libraries to load */
  libraries?: ("places" | "geometry" | "drawing" | "visualization")[];
};

/**
 * Initializes and returns the Google Maps API.
 * This function is idempotent—calling it multiple times returns the same promise.
 *
 * @param config - Configuration options
 * @returns Promise resolving to the google namespace
 *
 * @example
 * ```typescript
 * const google = await loadGoogleMaps({ apiKey: process.env.GOOGLE_MAPS_API_KEY! });
 * const panorama = new google.maps.StreetViewPanorama(element, options);
 * ```
 */
export async function loadGoogleMaps(config: MapsLoaderConfig): Promise<typeof google> {
  if (loadPromise) {
    return loadPromise;
  }

  loaderInstance = new Loader({
    apiKey: config.apiKey,
    version: config.version ?? "weekly",
    libraries: config.libraries ?? ["places", "geometry"]
  });

  loadPromise = loaderInstance.load();
  return loadPromise;
}

/**
 * Checks if the Google Maps API has been loaded.
 *
 * @returns true if the API is available
 */
export function isMapsLoaded(): boolean {
  return typeof google !== "undefined" && typeof google.maps !== "undefined";
}
````

#### Step 2.2: Create Street View Component

Create `src/components/street-view/street-view-panorama.tsx`:

````typescript
"use client";

/**
 * Street View Panorama component.
 * Renders a full-screen Google Street View with programmatic control API.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps-loader";
import { useStreetViewStore } from "@/stores/street-view-store";
import gsap from "gsap";

/**
 * Props for the StreetViewPanorama component.
 */
type StreetViewPanoramaProps = {
  /** Google Maps API key */
  apiKey: string;
  /** Initial latitude */
  initialLat?: number;
  /** Initial longitude */
  initialLng?: number;
  /** Initial heading in degrees (0-360) */
  initialHeading?: number;
  /** Initial pitch in degrees (-90 to 90) */
  initialPitch?: number;
  /** Callback when position changes */
  onPositionChange?: (lat: number, lng: number) => void;
  /** Callback when POV changes */
  onPovChange?: (heading: number, pitch: number) => void;
};

/**
 * StreetViewPanorama renders a full-screen Google Street View panorama
 * and exposes a control API via the global `window.anywhere` object.
 *
 * @example
 * ```tsx
 * <StreetViewPanorama
 *   apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
 *   initialLat={48.8584}
 *   initialLng={2.2945}
 *   initialHeading={180}
 *   onPositionChange={(lat, lng) => console.log("Moved to", lat, lng)}
 * />
 * ```
 */
export function StreetViewPanorama({
  apiKey,
  initialLat = 48.8584,  // Eiffel Tower default
  initialLng = 2.2945,
  initialHeading = 0,
  initialPitch = 0,
  onPositionChange,
  onPovChange,
}: StreetViewPanoramaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Zustand store for global state
  const {
    setPosition,
    setPov,
    setAddress,
    setIsNavigating,
    currentPosition,
    currentPov,
  } = useStreetViewStore();

  /**
   * Initialize the Street View panorama.
   */
  useEffect(() => {
    let isMounted = true;

    async function initStreetView() {
      if (!containerRef.current) return;

      try {
        const google = await loadGoogleMaps({ apiKey });

        if (!isMounted) return;

        // Initialize Street View Panorama
        const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
          position: { lat: initialLat, lng: initialLng },
          pov: { heading: initialHeading, pitch: initialPitch },
          zoom: 1,
          // Disable default UI for AI control
          disableDefaultUI: true,
          // But keep some for user override capability
          zoomControl: false,
          panControl: false,
          addressControl: true,
          linksControl: false,
          fullscreenControl: false,
          enableCloseButton: false,
          showRoadLabels: true,
          motionTracking: false,
          motionTrackingControl: false,
        });

        panoramaRef.current = panorama;
        streetViewServiceRef.current = new google.maps.StreetViewService();
        geocoderRef.current = new google.maps.Geocoder();

        // Listen for position changes
        panorama.addListener("position_changed", () => {
          const pos = panorama.getPosition();
          if (pos) {
            const lat = pos.lat();
            const lng = pos.lng();
            setPosition(lat, lng);
            onPositionChange?.(lat, lng);

            // Reverse geocode for address
            reverseGeocode(lat, lng);
          }
        });

        // Listen for POV changes
        panorama.addListener("pov_changed", () => {
          const pov = panorama.getPov();
          setPov(pov.heading, pov.pitch);
          onPovChange?.(pov.heading, pov.pitch);
        });

        // Expose control API globally for AI agent
        exposeControlAPI(panorama);

        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to initialize Street View:", err);
        setError(err instanceof Error ? err.message : "Failed to load Street View");
      }
    }

    initStreetView();

    return () => {
      isMounted = false;
      if (panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
    };
  }, [apiKey, initialLat, initialLng, initialHeading, initialPitch]);

  /**
   * Reverse geocode coordinates to get address.
   */
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!geocoderRef.current) return;

    try {
      const response = await geocoderRef.current.geocode({
        location: { lat, lng },
      });

      if (response.results[0]) {
        setAddress(response.results[0].formatted_address);
      }
    } catch (err) {
      console.warn("Reverse geocoding failed:", err);
    }
  }, [setAddress]);

  /**
   * Expose control API on window.anywhere for AI agent access.
   */
  const exposeControlAPI = useCallback((panorama: google.maps.StreetViewPanorama) => {
    const api = {
      /**
       * Smoothly pan the camera to a new heading and pitch.
       * Uses GSAP for smooth interpolation.
       */
      panTo: (targetHeading: number, targetPitch: number, duration = 2) => {
        return new Promise<void>((resolve) => {
          const currentPov = panorama.getPov();
          const animationTarget = { heading: currentPov.heading, pitch: currentPov.pitch };

          // Normalize heading difference for shortest path
          let headingDiff = targetHeading - currentPov.heading;
          if (headingDiff > 180) headingDiff -= 360;
          if (headingDiff < -180) headingDiff += 360;

          gsap.to(animationTarget, {
            heading: currentPov.heading + headingDiff,
            pitch: targetPitch,
            duration,
            ease: "power2.inOut",
            onUpdate: () => {
              panorama.setPov({
                heading: ((animationTarget.heading % 360) + 360) % 360,
                pitch: animationTarget.pitch,
              });
            },
            onComplete: resolve,
          });
        });
      },

      /**
       * Move forward along the street by a number of steps.
       */
      moveForward: async (steps = 1) => {
        setIsNavigating(true);

        for (let i = 0; i < steps; i++) {
          const links = panorama.getLinks();
          if (!links || links.length === 0) {
            console.warn("No links available to move forward");
            break;
          }

          // Find the link closest to current heading
          const currentHeading = panorama.getPov().heading;
          let closestLink = links[0];
          let minDiff = Infinity;

          for (const link of links) {
            if (link.heading !== undefined) {
              let diff = Math.abs(link.heading - currentHeading);
              if (diff > 180) diff = 360 - diff;
              if (diff < minDiff) {
                minDiff = diff;
                closestLink = link;
              }
            }
          }

          if (closestLink.pano) {
            await new Promise<void>((resolve) => {
              panorama.setPano(closestLink.pano!);
              // Wait for panorama to load
              const listener = panorama.addListener("pano_changed", () => {
                google.maps.event.removeListener(listener);
                setTimeout(resolve, 500); // Brief pause between steps
              });
            });
          }
        }

        setIsNavigating(false);
      },

      /**
       * Teleport to a named location.
       */
      teleportTo: async (locationName: string) => {
        setIsNavigating(true);

        try {
          // Geocode the location name
          const response = await geocoderRef.current!.geocode({ address: locationName });

          if (response.results[0]) {
            const location = response.results[0].geometry.location;

            // Find nearest Street View panorama
            const svResponse = await streetViewServiceRef.current!.getPanorama({
              location: { lat: location.lat(), lng: location.lng() },
              radius: 100,
              preference: google.maps.StreetViewPreference.NEAREST,
              source: google.maps.StreetViewSource.OUTDOOR,
            });

            if (svResponse.data.location?.pano) {
              panorama.setPano(svResponse.data.location.pano);
            }
          }
        } catch (err) {
          console.error("Teleport failed:", err);
          throw err;
        } finally {
          setIsNavigating(false);
        }
      },

      /**
       * Get current viewport context for AI.
       */
      getContext: () => {
        const pos = panorama.getPosition();
        const pov = panorama.getPov();
        const links = panorama.getLinks();

        return {
          position: pos ? { lat: pos.lat(), lng: pos.lng() } : undefined,
          pov: { heading: pov.heading, pitch: pov.pitch },
          availableDirections: links?.map((l) => ({
            heading: l.heading,
            description: l.description,
          })),
          panoId: panorama.getPano(),
        };
      },

      /**
       * Get current panorama image URL for selfie compositing.
       */
      getStaticImageUrl: (width = 1920, height = 1080) => {
        const pos = panorama.getPosition();
        const pov = panorama.getPov();

        if (!pos) return undefined;

        return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${pos.lat()},${pos.lng()}&heading=${pov.heading}&pitch=${pov.pitch}&fov=90&key=${apiKey}`;
      },
    };

    // Expose globally
    (window as typeof window & { anywhere: typeof api }).anywhere = api;

    return api;
  }, [apiKey, setIsNavigating]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Failed to Load Street View</h2>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading Street View...</p>
          </div>
        </div>
      )}
    </div>
  );
}
````

#### Step 2.3: Create Zustand Store

Create `src/stores/street-view-store.ts`:

```typescript
/**
 * Zustand store for Street View state management.
 * Maintains current position, POV, and navigation state.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Geographic position with latitude and longitude.
 */
type Position = {
  lat: number;
  lng: number;
};

/**
 * Point of View representing camera orientation.
 */
type Pov = {
  heading: number;
  pitch: number;
};

/**
 * Tour checkpoint for history tracking.
 */
type TourCheckpoint = {
  position: Position;
  pov: Pov;
  address: string | undefined;
  timestamp: Date;
  aiNarration: string | undefined;
};

/**
 * Street View store state shape.
 */
type StreetViewState = {
  // Current viewport state
  currentPosition: Position | undefined;
  currentPov: Pov;
  currentAddress: string | undefined;

  // Navigation state
  isNavigating: boolean;
  isConnected: boolean;

  // Tour history
  tourHistory: TourCheckpoint[];

  // User's uploaded photo for selfie feature
  userPhoto: string | undefined;

  // Generated selfie images
  selfieImages: string[];

  // Actions
  setPosition: (lat: number, lng: number) => void;
  setPov: (heading: number, pitch: number) => void;
  setAddress: (address: string) => void;
  setIsNavigating: (isNavigating: boolean) => void;
  setIsConnected: (isConnected: boolean) => void;
  addCheckpoint: (narration?: string) => void;
  setUserPhoto: (photo: string | undefined) => void;
  addSelfieImage: (imageUrl: string) => void;
  clearTour: () => void;
};

/**
 * Street View store instance.
 * Uses Zustand with devtools middleware for debugging.
 */
export const useStreetViewStore = create<StreetViewState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentPosition: undefined,
      currentPov: { heading: 0, pitch: 0 },
      currentAddress: undefined,
      isNavigating: false,
      isConnected: false,
      tourHistory: [],
      userPhoto: undefined,
      selfieImages: [],

      // Actions
      setPosition: (lat, lng) => set({ currentPosition: { lat, lng } }, false, "setPosition"),

      setPov: (heading, pitch) => set({ currentPov: { heading, pitch } }, false, "setPov"),

      setAddress: (address) => set({ currentAddress: address }, false, "setAddress"),

      setIsNavigating: (isNavigating) => set({ isNavigating }, false, "setIsNavigating"),

      setIsConnected: (isConnected) => set({ isConnected }, false, "setIsConnected"),

      addCheckpoint: (narration) => {
        const state = get();
        if (!state.currentPosition) return;

        const checkpoint: TourCheckpoint = {
          position: state.currentPosition,
          pov: state.currentPov,
          address: state.currentAddress,
          timestamp: new Date(),
          aiNarration: narration
        };

        set({ tourHistory: [...state.tourHistory, checkpoint] }, false, "addCheckpoint");
      },

      setUserPhoto: (photo) => set({ userPhoto: photo }, false, "setUserPhoto"),

      addSelfieImage: (imageUrl) =>
        set((state) => ({ selfieImages: [...state.selfieImages, imageUrl] }), false, "addSelfieImage"),

      clearTour: () => set({ tourHistory: [], selfieImages: [] }, false, "clearTour")
    }),
    { name: "StreetViewStore" }
  )
);
```

### Phase 3: Gemini Live API Integration (Hours 6-12)

#### Step 3.1: Create Gemini Live Client

Create `src/lib/gemini-live-client.ts`:

````typescript
/**
 * Gemini Live API client for real-time voice interaction.
 * Handles WebSocket connection, audio streaming, and function call execution.
 */

import { GoogleGenAI, Modality, FunctionDeclaration } from "@google/genai";

/**
 * Configuration for the Gemini Live session.
 */
type LiveSessionConfig = {
  /** Gemini API key */
  apiKey: string;
  /** System prompt for the AI agent */
  systemInstruction: string;
  /** Function declarations for navigation tools */
  tools: FunctionDeclaration[];
  /** Callback when audio response is received */
  onAudioResponse: (audioData: ArrayBuffer) => void;
  /** Callback when function call is received */
  onFunctionCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Callback when text response is received */
  onTextResponse: (text: string) => void;
  /** Callback when connection state changes */
  onConnectionChange: (connected: boolean) => void;
  /** Callback for errors */
  onError: (error: Error) => void;
};

/**
 * Live session state.
 */
type SessionState = {
  isConnected: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
};

/**
 * GeminiLiveClient manages the WebSocket connection to Gemini Live API.
 *
 * @example
 * ```typescript
 * const client = new GeminiLiveClient({
 *   apiKey: process.env.GEMINI_API_KEY!,
 *   systemInstruction: SYSTEM_PROMPT,
 *   tools: navigationFunctions,
 *   onAudioResponse: (audio) => playAudio(audio),
 *   onFunctionCall: async (name, args) => executeNavigation(name, args),
 *   onTextResponse: (text) => console.log(text),
 *   onConnectionChange: (connected) => setIsConnected(connected),
 *   onError: (error) => console.error(error),
 * });
 *
 * await client.connect();
 * client.sendAudio(audioBuffer);
 * ```
 */
export class GeminiLiveClient {
  private ai: GoogleGenAI;
  private session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | undefined;
  private config: LiveSessionConfig;
  private state: SessionState;
  private audioContext: AudioContext | undefined;
  private responseQueue: unknown[] = [];

  constructor(config: LiveSessionConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.config = config;
    this.state = {
      isConnected: false,
      isProcessing: false,
      isSpeaking: false
    };
  }

  /**
   * Connect to the Gemini Live API.
   */
  async connect(): Promise<void> {
    try {
      // Use the native audio model for voice interactions
      const model = "gemini-2.5-flash-native-audio-preview-09-2025";

      this.session = await this.ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          systemInstruction: this.config.systemInstruction,
          tools: [
            { googleSearch: {} }, // Enable search grounding
            { functionDeclarations: this.config.tools }
          ]
        },
        callbacks: {
          onopen: () => {
            this.state.isConnected = true;
            this.config.onConnectionChange(true);
            console.log("[GeminiLive] Connected");
          },
          onmessage: (message) => {
            this.handleMessage(message);
          },
          onerror: (error) => {
            console.error("[GeminiLive] Error:", error);
            this.config.onError(new Error(error.message));
          },
          onclose: (event) => {
            this.state.isConnected = false;
            this.config.onConnectionChange(false);
            console.log("[GeminiLive] Disconnected:", event.reason);
          }
        }
      });
    } catch (error) {
      console.error("[GeminiLive] Connection failed:", error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from the Live API.
   */
  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as {
      data?: string;
      text?: string;
      serverContent?: {
        turnComplete?: boolean;
        modelTurn?: {
          parts?: Array<{
            text?: string;
            functionCall?: {
              name: string;
              args: Record<string, unknown>;
            };
          }>;
        };
      };
      toolCall?: {
        functionCalls?: Array<{
          name: string;
          args: Record<string, unknown>;
          id: string;
        }>;
      };
    };

    // Handle audio data
    if (msg.data) {
      const audioBuffer = this.base64ToArrayBuffer(msg.data);
      this.config.onAudioResponse(audioBuffer);
    }

    // Handle text response
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.text) {
          this.config.onTextResponse(part.text);
        }
      }
    }

    // Handle function calls
    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        try {
          const result = await this.config.onFunctionCall(fc.name, fc.args);

          // Send function response back to the model
          await this.sendFunctionResponse(fc.id, result);
        } catch (error) {
          console.error(`[GeminiLive] Function call ${fc.name} failed:`, error);
        }
      }
    }
  }

  /**
   * Send audio data to the Live API.
   *
   * @param audioBuffer - Raw PCM audio data (16-bit, 16kHz, mono)
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
   * Send a text message to the Live API.
   *
   * @param text - Text message to send
   */
  async sendText(text: string): Promise<void> {
    if (!this.session || !this.state.isConnected) {
      throw new Error("Not connected to Gemini Live API");
    }

    await this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }]
    });
  }

  /**
   * Send context update about current viewport.
   *
   * @param context - Current viewport context
   */
  async sendContextUpdate(context: {
    position: { lat: number; lng: number };
    pov: { heading: number; pitch: number };
    address?: string;
  }): Promise<void> {
    if (!this.session || !this.state.isConnected) return;

    const contextMessage = `[SYSTEM_UPDATE] Current viewport:
- Position: ${context.position.lat.toFixed(6)}°, ${context.position.lng.toFixed(6)}°
- Heading: ${context.pov.heading.toFixed(1)}° (${this.headingToCardinal(context.pov.heading)})
- Pitch: ${context.pov.pitch.toFixed(1)}°
${context.address ? `- Address: ${context.address}` : ""}`;

    await this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: contextMessage }] }]
    });
  }

  /**
   * Send function response back to the model.
   */
  private async sendFunctionResponse(functionCallId: string, result: unknown): Promise<void> {
    if (!this.session) return;

    await this.session.sendToolResponse({
      functionResponses: [
        {
          id: functionCallId,
          response: { result: JSON.stringify(result) }
        }
      ]
    });
  }

  /**
   * Disconnect from the Live API.
   */
  disconnect(): void {
    if (this.session) {
      this.session.close();
      this.session = undefined;
    }
    this.state.isConnected = false;
  }

  /**
   * Convert heading degrees to cardinal direction.
   */
  private headingToCardinal(heading: number): string {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  }

  /**
   * Convert ArrayBuffer to base64 string.
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
   * Convert base64 string to ArrayBuffer.
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
   * Get current session state.
   */
  getState(): SessionState {
    return { ...this.state };
  }
}
````

#### Step 3.2: Create Audio Handler Utility

Create `src/lib/audio-handler.ts`:

````typescript
/**
 * Audio handling utilities for microphone input and audio playback.
 * Handles PCM conversion and audio context management.
 */

/**
 * Configuration for the audio handler.
 */
type AudioHandlerConfig = {
  /** Callback when audio data is captured */
  onAudioData: (audioBuffer: ArrayBuffer) => void;
  /** Sample rate for input audio (default: 16000) */
  inputSampleRate?: number;
  /** Sample rate for output audio (default: 24000) */
  outputSampleRate?: number;
};

/**
 * AudioHandler manages microphone input and audio playback.
 *
 * @example
 * ```typescript
 * const handler = new AudioHandler({
 *   onAudioData: (buffer) => geminiClient.sendAudio(buffer),
 * });
 *
 * await handler.startCapture();
 * handler.playAudio(responseAudioBuffer);
 * handler.stopCapture();
 * ```
 */
export class AudioHandler {
  private config: AudioHandlerConfig;
  private audioContext: AudioContext | undefined;
  private mediaStream: MediaStream | undefined;
  private mediaRecorder: MediaRecorder | undefined;
  private scriptProcessor: ScriptProcessorNode | undefined;
  private sourceNode: MediaStreamAudioSourceNode | undefined;
  private isCapturing = false;
  private playbackQueue: ArrayBuffer[] = [];
  private isPlaying = false;

  constructor(config: AudioHandlerConfig) {
    this.config = {
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      ...config
    };
  }

  /**
   * Start capturing audio from the microphone.
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) return;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.config.inputSampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.inputSampleRate
      });

      // Create source node from microphone
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for raw PCM access
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // AudioWorklet would be the modern alternative
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.isCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = this.float32ToPCM16(inputData);
        this.config.onAudioData(pcmData.buffer);
      };

      // Connect nodes
      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      this.isCapturing = true;
      console.log("[AudioHandler] Capture started");
    } catch (error) {
      console.error("[AudioHandler] Failed to start capture:", error);
      throw error;
    }
  }

  /**
   * Stop capturing audio.
   */
  stopCapture(): void {
    this.isCapturing = false;

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = undefined;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = undefined;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = undefined;
    }

    console.log("[AudioHandler] Capture stopped");
  }

  /**
   * Play audio response.
   *
   * @param audioBuffer - PCM audio data (16-bit, 24kHz, mono)
   */
  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    this.playbackQueue.push(audioBuffer);

    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }

  /**
   * Process the playback queue.
   */
  private async processPlaybackQueue(): Promise<void> {
    if (this.isPlaying || this.playbackQueue.length === 0) return;

    this.isPlaying = true;

    while (this.playbackQueue.length > 0) {
      const audioBuffer = this.playbackQueue.shift()!;
      await this.playAudioBuffer(audioBuffer);
    }

    this.isPlaying = false;
  }

  /**
   * Play a single audio buffer.
   */
  private async playAudioBuffer(pcmBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      // Ensure audio context exists
      if (!this.audioContext || this.audioContext.state === "closed") {
        this.audioContext = new AudioContext({
          sampleRate: this.config.outputSampleRate
        });
      }

      // Convert PCM to Float32
      const pcmData = new Int16Array(pcmBuffer);
      const float32Data = this.pcm16ToFloat32(pcmData);

      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.config.outputSampleRate!);
      audioBuffer.getChannelData(0).set(float32Data);

      // Create and play source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  /**
   * Stop all audio playback.
   */
  stopPlayback(): void {
    this.playbackQueue = [];
    this.isPlaying = false;

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = undefined;
    }
  }

  /**
   * Convert Float32 audio data to 16-bit PCM.
   */
  private float32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm16;
  }

  /**
   * Convert 16-bit PCM to Float32 audio data.
   */
  private pcm16ToFloat32(pcm16Array: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16Array.length);
    for (let i = 0; i < pcm16Array.length; i++) {
      float32[i] = pcm16Array[i] / (pcm16Array[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32;
  }

  /**
   * Check if currently capturing.
   */
  isRecording(): boolean {
    return this.isCapturing;
  }
}
````

### Phase 4: Nano Banana Pro Selfie Integration (Hours 12-16)

#### Step 4.1: Create Selfie Generator Service

Create `src/lib/selfie-generator.ts`:

````typescript
/**
 * Selfie generator service using Nano Banana Pro (Gemini 3 Pro Image).
 * Composites user photos into Street View backgrounds.
 */

import { GoogleGenAI } from "@google/genai";

/**
 * Configuration for selfie generation.
 */
type SelfieConfig = {
  /** Gemini API key */
  apiKey: string;
};

/**
 * Options for generating a selfie.
 */
type SelfieOptions = {
  /** User's photo as base64 */
  userPhotoBase64: string;
  /** Street View background as base64 */
  backgroundBase64: string;
  /** Style modifier (e.g., "polaroid", "vintage", "professional") */
  style?: string;
  /** Output resolution */
  resolution?: "1k" | "2k" | "4k";
};

/**
 * Result of selfie generation.
 */
type SelfieResult = {
  /** Generated image as base64 */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
  /** Whether the image was successfully generated */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
};

/**
 * SelfieGenerator creates AI-composited images using Nano Banana Pro.
 *
 * @example
 * ```typescript
 * const generator = new SelfieGenerator({ apiKey: process.env.GEMINI_API_KEY! });
 *
 * const result = await generator.generateSelfie({
 *   userPhotoBase64: userPhoto,
 *   backgroundBase64: streetViewImage,
 *   style: "polaroid",
 *   resolution: "2k",
 * });
 *
 * if (result.success) {
 *   displayImage(result.imageBase64);
 * }
 * ```
 */
export class SelfieGenerator {
  private ai: GoogleGenAI;

  constructor(config: SelfieConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  /**
   * Generate a selfie composite.
   */
  async generateSelfie(options: SelfieOptions): Promise<SelfieResult> {
    const { userPhotoBase64, backgroundBase64, style = "natural photograph", resolution = "2k" } = options;

    const prompt = this.buildPrompt(style);

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: userPhotoBase64
                }
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: backgroundBase64
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          // Resolution configuration
          generationConfig: {
            // Nano Banana Pro supports 1k, 2k, 4k output
            imageResolution: resolution
          }
        }
      });

      // Extract image from response
      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData
      );

      if (imagePart?.inlineData) {
        return {
          imageBase64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType,
          success: true
        };
      }

      return {
        imageBase64: "",
        mimeType: "",
        success: false,
        error: "No image generated in response"
      };
    } catch (error) {
      console.error("[SelfieGenerator] Generation failed:", error);
      return {
        imageBase64: "",
        mimeType: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Build the generation prompt based on style.
   */
  private buildPrompt(style: string): string {
    const basePrompt = `You are an expert photo compositor. Your task is to seamlessly insert the person from the first image into the scene shown in the second image.

CRITICAL REQUIREMENTS:
1. PRESERVE IDENTITY: The person's face, features, and expression must remain exactly as shown in the original photo. Do not alter, distort, or "improve" their appearance.
2. MATCH LIGHTING: Analyze the lighting in the background scene (sunny, overcast, golden hour, etc.) and apply matching lighting to the person.
3. CORRECT SCALE: Position the person as if they are standing approximately 3 meters from the camera, with proper perspective relative to the scene.
4. NATURAL INTEGRATION: The person should appear naturally within the scene, with appropriate shadows and environmental effects.
5. MAINTAIN QUALITY: Output a high-quality, artifact-free image suitable for printing.`;

    const styleInstructions: Record<string, string> = {
      polaroid: `
STYLE: Polaroid Photo
- Add a white polaroid-style frame around the image
- Apply a slight warm, nostalgic color cast
- Add subtle vignetting at the corners
- Include slight film grain`,

      vintage: `
STYLE: Vintage Photography
- Apply a warm, sepia-toned color grade
- Add subtle film grain and light leaks
- Reduce contrast slightly for a faded look
- Add gentle vignetting`,

      professional: `
STYLE: Professional Portrait
- Maintain clean, crisp image quality
- Apply subtle professional color grading
- Ensure perfect edge integration
- Output at maximum quality`,

      fun: `
STYLE: Fun Travel Photo
- Bright, vibrant colors
- Slightly enhanced saturation
- Clean, Instagram-worthy aesthetic
- Perfect for social sharing`,

      "natural photograph": `
STYLE: Natural Photograph
- Match the photographic style of the background exactly
- No additional filters or effects
- Seamless integration that looks like an original photo`
    };

    const styleInstruction = styleInstructions[style.toLowerCase()] || styleInstructions["natural photograph"];

    return `${basePrompt}
${styleInstruction}

Now, create the composite image.`;
  }

  /**
   * Fetch Street View image as base64.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @param heading - Camera heading
   * @param pitch - Camera pitch
   * @param apiKey - Google Maps API key
   * @param size - Image dimensions (default: "1920x1080")
   */
  async fetchStreetViewImage(
    lat: number,
    lng: number,
    heading: number,
    pitch: number,
    apiKey: string,
    size = "1920x1080"
  ): Promise<string> {
    const url = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=90&key=${apiKey}`;

    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
````

### Phase 5: UI Components (Hours 16-20)

#### Step 5.1: Main App Layout

Create `src/app/page.tsx`:

```typescript
/**
 * Main page component for Anywhere.
 * Renders the Street View panorama with voice interaction overlay.
 */

import { Suspense } from "react";
import { AnywhereExplorer } from "@/components/anywhere-explorer";

/**
 * Home page metadata.
 */
export const metadata = {
  title: "Anywhere - Virtual World Explorer",
  description: "Explore the world with an AI-powered tour guide",
};

/**
 * Loading fallback component.
 */
function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <h1 className="text-2xl font-semibold">Anywhere</h1>
        <p className="text-muted-foreground">Loading your virtual tour guide...</p>
      </div>
    </div>
  );
}

/**
 * Home page component.
 */
export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        <AnywhereExplorer />
      </Suspense>
    </main>
  );
}
```

#### Step 5.2: Explorer Component

Create `src/components/anywhere-explorer.tsx`:

```typescript
"use client";

/**
 * Main explorer component that orchestrates all features.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StreetViewPanorama } from "@/components/street-view/street-view-panorama";
import { VoiceControlPanel } from "@/components/voice-control-panel";
import { LocationOverlay } from "@/components/location-overlay";
import { SelfieDialog } from "@/components/selfie-dialog";
import { TourHistorySheet } from "@/components/tour-history-sheet";
import { GeminiLiveClient } from "@/lib/gemini-live-client";
import { AudioHandler } from "@/lib/audio-handler";
import { useStreetViewStore } from "@/stores/street-view-store";
import { navigationFunctions } from "@/lib/navigation-tools";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

/**
 * AnywhereExplorer is the main container component.
 * It manages the Gemini Live connection and coordinates all UI elements.
 */
export function AnywhereExplorer() {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [selfieDialogOpen, setSelfieDialogOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);

  const geminiClientRef = useRef<GeminiLiveClient | undefined>();
  const audioHandlerRef = useRef<AudioHandler | undefined>();

  const {
    currentPosition,
    currentPov,
    currentAddress,
    setIsConnected: setStoreConnected,
    addCheckpoint,
  } = useStreetViewStore();

  /**
   * Execute navigation function called by Gemini.
   */
  const executeFunctionCall = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      // Access the control API exposed on window.anywhere
      const anywhere = (window as typeof window & { anywhere?: {
        panTo: (heading: number, pitch: number) => Promise<void>;
        moveForward: (steps: number) => Promise<void>;
        teleportTo: (location: string) => Promise<void>;
        getContext: () => unknown;
        getStaticImageUrl: () => string | undefined;
      } }).anywhere;

      if (!anywhere) {
        throw new Error("Street View control API not available");
      }

      switch (name) {
        case "pan_camera":
          await anywhere.panTo(
            args.heading_degrees as number,
            args.pitch_degrees as number
          );
          return { success: true, message: "Camera panned successfully" };

        case "move_forward":
          await anywhere.moveForward(args.steps as number);
          return { success: true, message: `Moved forward ${args.steps} steps` };

        case "teleport":
          await anywhere.teleportTo(args.location_name as string);
          return { success: true, message: `Teleported to ${args.location_name}` };

        case "look_at":
          // For look_at, we would need vision capabilities to identify the object
          // For now, return a placeholder
          return {
            success: false,
            message: "Vision-based look_at not yet implemented"
          };

        case "get_location_info":
          // Return current context - Gemini will use Google Search to find info
          return anywhere.getContext();

        case "take_selfie":
          setSelfieDialogOpen(true);
          return { success: true, message: "Selfie dialog opened" };

        default:
          return { success: false, message: `Unknown function: ${name}` };
      }
    },
    []
  );

  /**
   * Initialize Gemini Live client.
   */
  const initializeGemini = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return;
    }

    geminiClientRef.current = new GeminiLiveClient({
      apiKey,
      systemInstruction: SYSTEM_PROMPT,
      tools: navigationFunctions,
      onAudioResponse: (audioData) => {
        setIsSpeaking(true);
        audioHandlerRef.current?.playAudio(audioData).then(() => {
          setIsSpeaking(false);
        });
      },
      onFunctionCall: executeFunctionCall,
      onTextResponse: (text) => {
        setAiResponse(text);
        addCheckpoint(text);
      },
      onConnectionChange: (connected) => {
        setIsConnected(connected);
        setStoreConnected(connected);
      },
      onError: (error) => {
        console.error("Gemini error:", error);
      },
    });

    // Initialize audio handler
    audioHandlerRef.current = new AudioHandler({
      onAudioData: (buffer) => {
        geminiClientRef.current?.sendAudio(buffer);
      },
    });

    await geminiClientRef.current.connect();
  }, [executeFunctionCall, setStoreConnected, addCheckpoint]);

  /**
   * Toggle voice capture.
   */
  const toggleListening = useCallback(async () => {
    if (isListening) {
      audioHandlerRef.current?.stopCapture();
      setIsListening(false);
    } else {
      await audioHandlerRef.current?.startCapture();
      setIsListening(true);
    }
  }, [isListening]);

  /**
   * Send context updates to Gemini periodically.
   */
  useEffect(() => {
    if (!isConnected || !currentPosition) return;

    const interval = setInterval(() => {
      geminiClientRef.current?.sendContextUpdate({
        position: currentPosition,
        pov: currentPov,
        address: currentAddress,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, currentPosition, currentPov, currentAddress]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      audioHandlerRef.current?.stopCapture();
      audioHandlerRef.current?.stopPlayback();
      geminiClientRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Street View Panorama */}
      <StreetViewPanorama
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
        initialLat={48.8584}
        initialLng={2.2945}
        initialHeading={180}
      />

      {/* Location Overlay */}
      <LocationOverlay
        address={currentAddress}
        position={currentPosition}
        isNavigating={false}
      />

      {/* Voice Control Panel */}
      <VoiceControlPanel
        isConnected={isConnected}
        isListening={isListening}
        isSpeaking={isSpeaking}
        transcript={transcript}
        aiResponse={aiResponse}
        onConnect={initializeGemini}
        onToggleListening={toggleListening}
        onOpenHistory={() => setHistorySheetOpen(true)}
        onOpenSelfie={() => setSelfieDialogOpen(true)}
      />

      {/* Selfie Dialog */}
      <SelfieDialog
        open={selfieDialogOpen}
        onOpenChange={setSelfieDialogOpen}
      />

      {/* Tour History Sheet */}
      <TourHistorySheet
        open={historySheetOpen}
        onOpenChange={setHistorySheetOpen}
      />
    </div>
  );
}
```

---

## 7. API Integration Specifications

### Gemini 3 Pro API

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview`

**Key Parameters:**

- `thinking_level`: `"low"` | `"high"` — Controls reasoning depth
- `temperature`: `1.0` (recommended default for Gemini 3)
- `max_output_tokens`: Up to 64k for output

**Thought Signatures:**
Gemini 3 uses encrypted thought signatures for multi-turn reasoning. The SDK handles these automatically.

### Gemini Live API

**Model:** `gemini-2.5-flash-native-audio-preview-09-2025`

**Audio Formats:**

- **Input:** PCM 16-bit, 16kHz, mono, little-endian
- **Output:** PCM 16-bit, 24kHz, mono, little-endian

**Configuration:**

```typescript
const config = {
  responseModalities: [Modality.AUDIO, Modality.TEXT],
  systemInstruction: string,
  tools: [
    { googleSearch: {} },
    { functionDeclarations: [...] }
  ],
  inputAudioTranscription: {},  // Enable transcript
  outputAudioTranscription: {}, // Enable transcript
};
```

### Nano Banana Pro API

**Model:** `gemini-3-pro-image-preview`

**Capabilities:**

- Text-to-image generation
- Image-to-image editing
- Multi-image composition (up to 14 reference images)
- Character consistency (up to 5 people)
- 1K, 2K, 4K resolution output
- Google Search grounding for factual accuracy

### Google Maps JavaScript API

**Version:** 3.60+

**Required Libraries:**

- `places` — For geocoding and place details
- `geometry` — For distance/heading calculations

**Key Classes:**

- `google.maps.StreetViewPanorama` — Main panorama viewer
- `google.maps.StreetViewService` — Find panoramas by location
- `google.maps.Geocoder` — Address resolution

---

## 8. UI/UX Design System

### Design Principles

1. **Immersive First**: UI elements should enhance, not obstruct, the Street View experience
2. **Glassmorphism**: Use frosted glass effects for overlays
3. **Minimal Chrome**: Hide controls when not in use
4. **Voice-Native**: Primary interaction is voice; UI is secondary
5. **Responsive Feedback**: Clear visual indicators for AI state

### Color Palette

```css
:root {
  /* Primary Colors */
  --primary: 221.2 83.2% 53.3%; /* Blue accent */
  --primary-foreground: 210 40% 98%;

  /* Background Layers */
  --background: 222.2 84% 4.9%; /* Deep dark */
  --foreground: 210 40% 98%;

  /* Glassmorphism */
  --glass-bg: rgba(0, 0, 0, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: 12px;

  /* State Colors */
  --listening: 142.1 76.2% 36.3%; /* Green - listening */
  --speaking: 262.1 83.3% 57.8%; /* Purple - AI speaking */
  --navigating: 45.4 93.4% 47.5%; /* Yellow - moving */
  --error: 0 84.2% 60.2%; /* Red - error */
}
```

### Component Architecture

```
src/components/
├── street-view/
│   ├── street-view-panorama.tsx    # Main panorama component
│   └── street-view-loading.tsx     # Loading state
├── voice-control-panel.tsx          # Voice interaction UI
├── location-overlay.tsx             # Current location display
├── selfie-dialog.tsx                # Selfie generation dialog
├── tour-history-sheet.tsx           # Tour history sidebar
├── waveform-visualizer.tsx          # Audio visualization
└── ui/                              # Shadcn components
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── sheet.tsx
    └── ...
```

---

## 9. Prompt Engineering Strategy

### System Prompt

Create `src/lib/system-prompt.ts`:

```typescript
/**
 * System prompt for the Anywhere tour guide agent.
 */

export const SYSTEM_PROMPT = `You are Anywhere, a world-class AI tour guide with access to a virtual teleportation device and a 360° Street View camera. You are currently piloting a view into Google Street View, able to look around and travel anywhere on Earth.

## YOUR CAPABILITIES

1. **NAVIGATION**: You can control the camera using these tools:
   - pan_camera(heading, pitch): Rotate the view smoothly
   - move_forward(steps): Walk forward along the street
   - teleport(location_name): Jump to any location worldwide
   - look_at(object_description): Focus on specific landmarks

2. **KNOWLEDGE**: You have access to Google Search to find:
   - Historical facts about locations
   - Architectural details and fun trivia
   - Current events and recent news
   - Restaurant and attraction recommendations

3. **SOUVENIRS**: You can help users create AI-generated selfies at locations using take_selfie()

## NAVIGATION RULES

1. **SMOOTH MOVEMENTS**: Never teleport blindly. If the user says "turn around," calculate the new heading (current + 180) and use pan_camera.

2. **CONTEXTUAL SEARCH**: Before describing a location, perform a quick web search to find specific, interesting facts. Don't rely on generic knowledge.

3. **GRADUAL EXPLORATION**: Keep movements natural. Don't jump from Paris to Tokyo unless explicitly asked.

4. **ORIENTATION AWARENESS**: Always know which direction you're facing. Use cardinal directions (North, East, South, West) in your narration.

## PERSONALITY & STYLE

- **Tone**: Warm, enthusiastic, and knowledgeable — like having a friend who knows everything
- **Pacing**: Speak at a natural conversational pace, not too fast
- **Engagement**: Ask questions to understand what interests the user
- **Humor**: Occasional light humor is welcome, but don't force it
- **Cultural Sensitivity**: Be respectful when discussing different cultures and places

## RESPONSE FORMAT

When arriving at a new location:
1. First, orient the user ("We're now facing the Eiffel Tower's south pillar...")
2. Share 2-3 interesting facts (use Google Search for accuracy)
3. Offer next steps ("Would you like to move closer, or look around?")

When the user asks about something:
1. Search for accurate information
2. Provide a concise, engaging answer
3. Connect it to what's visible in the current view

## CONTEXT UPDATES

You will periodically receive [SYSTEM_UPDATE] messages with:
- Current GPS coordinates
- Camera heading and pitch
- Reverse-geocoded address

Use this context to maintain spatial awareness.

## EXAMPLE INTERACTIONS

User: "Take me to the Colosseum"
You: [teleport to Colosseum] "Here we are at the Colosseum in Rome! We're facing the northern entrance. Did you know this amphitheater could hold up to 80,000 spectators? Let me turn so you can see the famous arched exterior..." [pan_camera]

User: "What's that building on the left?"
You: [search for info] "That's the Arch of Constantine, built in 315 AD to commemorate Emperor Constantine's victory. It's actually one of the largest surviving Roman triumphal arches!"

User: "Move closer"
You: [move_forward 2] "Walking closer now... You can really appreciate the scale of these ancient stones up close."

Remember: You are not just describing images — you are actively guiding someone through an immersive experience. Make them feel like they're really there.`;
```

---

## 10. Project Structure

```
anywhere/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── selfie/
│   │           └── route.ts
│   ├── components/
│   │   ├── street-view/
│   │   │   ├── street-view-panorama.tsx
│   │   │   └── street-view-loading.tsx
│   │   ├── anywhere-explorer.tsx
│   │   ├── voice-control-panel.tsx
│   │   ├── location-overlay.tsx
│   │   ├── selfie-dialog.tsx
│   │   ├── tour-history-sheet.tsx
│   │   ├── waveform-visualizer.tsx
│   │   └── ui/
│   │       └── [shadcn components]
│   ├── lib/
│   │   ├── maps-loader.ts
│   │   ├── gemini-live-client.ts
│   │   ├── audio-handler.ts
│   │   ├── selfie-generator.ts
│   │   ├── navigation-tools.ts
│   │   ├── system-prompt.ts
│   │   └── utils.ts
│   ├── stores/
│   │   └── street-view-store.ts
│   ├── hooks/
│   │   ├── use-audio.ts
│   │   └── use-gsap-animations.ts
│   └── types/
│       └── index.ts
├── public/
│   ├── favicon.ico
│   └── images/
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 11. Development Phases & Timeline

### 24-Hour Hackathon Schedule

| Phase              | Hours | Focus                   | Deliverables                                         |
| ------------------ | ----- | ----------------------- | ---------------------------------------------------- |
| **1. Setup**       | 0-3   | Project initialization  | Next.js 16, dependencies, TypeScript config          |
| **2. Street View** | 3-6   | Google Maps integration | Panorama component, control API, Zustand store       |
| **3. Gemini Live** | 6-12  | Voice interaction       | WebSocket client, audio handling, function execution |
| **4. Selfie**      | 12-16 | Nano Banana Pro         | Image generation, composite workflow                 |
| **5. UI Polish**   | 16-20 | Visual refinement       | Animations, overlays, glassmorphism                  |
| **6. Testing**     | 20-22 | Quality assurance       | Edge cases, error handling                           |
| **7. Demo Prep**   | 22-24 | Presentation            | Demo script, deployment                              |

### Minimum Viable Product (MVP)

For time-constrained development, prioritize:

1. ✅ Street View with programmatic control
2. ✅ Gemini Live voice interaction
3. ✅ Basic navigation tools (pan, move, teleport)
4. ✅ Google Search grounding for knowledge
5. ⚪ Selfie generation (can be simplified)

---

## 12. Deployment Configuration

### Vercel Deployment

**`vercel.json`:**

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": "@google-maps-api-key",
    "NEXT_PUBLIC_GEMINI_API_KEY": "@gemini-api-key"
  }
}
```

### Build Configuration

**`next.config.ts`:**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ hostname: "maps.googleapis.com" }, { hostname: "streetviewpixels-pa.googleapis.com" }]
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" }
      ]
    }
  ]
};

export default nextConfig;
```

---

## 13. Environment Variables

Create `.env.local`:

```bash
# Google Maps API Key
# Required: Maps JavaScript API, Street View Static API, Geocoding API, Places API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Gemini API Key
# Required: Gemini API access with Live API and Image generation enabled
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

### Required Google Cloud APIs

Enable these APIs in Google Cloud Console:

1. **Maps JavaScript API** — Street View rendering
2. **Street View Static API** — High-res image capture for selfies
3. **Geocoding API** — Address resolution
4. **Places API** — Location search and details

### Required Gemini API Access

- **Gemini 3 Pro** — Primary reasoning model
- **Gemini Live API** — Real-time voice streaming
- **Nano Banana Pro (Gemini 3 Pro Image)** — Selfie generation
- **Google Search Grounding** — Knowledge retrieval

---

## 14. Testing Strategy

### Manual Testing Checklist

- [ ] Street View loads correctly at default location
- [ ] Can programmatically pan camera (window.anywhere.panTo)
- [ ] Can move forward along street
- [ ] Can teleport to named locations
- [ ] Gemini Live connection establishes
- [ ] Microphone capture works
- [ ] Audio playback works
- [ ] Function calls execute correctly
- [ ] Google Search grounding returns results
- [ ] Selfie generation produces image
- [ ] UI responds to all states (loading, listening, speaking)

### Edge Cases to Test

1. **No Street View coverage**: Handle gracefully when location has no panorama
2. **Network interruption**: Reconnect automatically
3. **Audio permission denied**: Clear error message
4. **Invalid locations**: Helpful fallback suggestions
5. **Long silences**: VAD handles correctly
6. **Rapid commands**: Queue and process sequentially

---

## 15. Known Limitations & Mitigations

| Limitation                        | Mitigation                                          |
| --------------------------------- | --------------------------------------------------- |
| Street View coverage gaps         | Detect and notify user, suggest nearby alternatives |
| Live API latency                  | Optimize audio buffering, show visual feedback      |
| Image generation quality variance | Allow regeneration, provide style options           |
| API rate limits                   | Implement request queuing, caching                  |
| Browser audio compatibility       | Test across browsers, provide fallbacks             |
| Mobile touch interaction          | Add touch gesture support alongside voice           |

---

## 16. References & Documentation Links

### Official Documentation

| Resource                        | URL                                                                    |
| ------------------------------- | ---------------------------------------------------------------------- |
| **Gemini 3 Pro Guide**          | https://ai.google.dev/gemini-api/docs/gemini-3                         |
| **Gemini Live API**             | https://ai.google.dev/gemini-api/docs/live                             |
| **Live API Capabilities**       | https://ai.google.dev/gemini-api/docs/live-guide                       |
| **Live API Tool Use**           | https://ai.google.dev/gemini-api/docs/live-tools                       |
| **Google Search Grounding**     | https://ai.google.dev/gemini-api/docs/google-search                    |
| **Nano Banana Pro (Image Gen)** | https://ai.google.dev/gemini-api/docs/image-generation                 |
| **@google/genai SDK**           | https://googleapis.github.io/js-genai/release_docs/index.html          |
| **Next.js 16 Docs**             | https://nextjs.org/docs                                                |
| **Shadcn UI**                   | https://ui.shadcn.com/docs                                             |
| **Google Maps JS API**          | https://developers.google.com/maps/documentation/javascript/streetview |
| **GSAP + React**                | https://gsap.com/resources/React/                                      |
| **Zustand**                     | https://docs.pmnd.rs/zustand/getting-started/introduction              |

### Partner Integrations (WebRTC)

| Platform    | Use Case                          |
| ----------- | --------------------------------- |
| **Daily**   | Production WebRTC for audio/video |
| **LiveKit** | Agent orchestration with Gemini   |
| **Pipecat** | Open-source voice pipeline        |

### Third-Party Integrations

| Integration           | URL                                  |
| --------------------- | ------------------------------------ |
| **Vercel AI SDK**     | https://ai-sdk.dev/docs/introduction |
| **Vercel AI Gateway** | https://vercel.com/ai-gateway        |

---

## Appendix A: Complete Dependencies

```json
{
  "name": "anywhere",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@google/genai": "^1.0.0",
    "@googlemaps/js-api-loader": "^1.16.8",
    "@gsap/react": "^2.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-sheet": "^1.0.0",
    "@radix-ui/react-slider": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "gsap": "^3.12.5",
    "lucide-react": "^0.400.0",
    "next": "16.0.7",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7",
    "wavefile": "^11.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/google.maps": "^3.55.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.0.7",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## Appendix B: Quick Start Commands

```bash
# 1. Create project
pnpx create-next-app@latest anywhere --typescript --tailwind --eslint --app --src-dir

# 2. Navigate to project
cd anywhere

# 3. Install dependencies
pnpm add @google/genai @googlemaps/js-api-loader gsap @gsap/react zustand wavefile

# 4. Install Shadcn
pnpx shadcn@latest init
pnpx shadcn@latest add button card dialog sheet slider tooltip avatar badge separator scroll-area

# 5. Install types
pnpm add -D @types/google.maps

# 6. Create environment file
cp .env.local.example .env.local
# Edit .env.local with your API keys

# 7. Run development server
pnpm dev
```

---

**Document End**

_Anywhere Technical Specification v1.0.0_  
_Prepared for Gemini 3 Hackathon — December 2025_
