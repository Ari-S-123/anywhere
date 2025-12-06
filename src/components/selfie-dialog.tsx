"use client";

/**
 * Selfie Dialog component.
 * Allows users to upload a photo and generate AI selfie composites.
 *
 * @module selfie-dialog
 */

import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Camera, Loader2, Download, X, Sparkles, Check } from "lucide-react";
import { useStreetViewStore } from "@/stores/street-view-store";
import { cn } from "@/lib/utils";

/**
 * Available selfie styles (matches server-side API).
 */
type SelfieStyle = "natural" | "polaroid" | "vintage" | "professional" | "fun";

/**
 * Props for the SelfieDialog component.
 */
export type SelfieDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
};

/**
 * Available selfie styles with display names and descriptions.
 */
const SELFIE_STYLES: {
  id: SelfieStyle;
  name: string;
  description: string;
}[] = [
  { id: "natural", name: "Natural", description: "Seamless, realistic composite" },
  { id: "polaroid", name: "Polaroid", description: "Classic instant photo frame" },
  { id: "vintage", name: "Vintage", description: "Warm, nostalgic film look" },
  { id: "professional", name: "Professional", description: "Clean, polished portrait" },
  { id: "fun", name: "Fun", description: "Vibrant, social media ready" }
];

/**
 * SelfieDialog provides the UI for creating AI-generated selfie composites.
 * Users can upload their photo, select a style, and generate a composite
 * image that places them in the current Street View location.
 *
 * @example
 * ```tsx
 * <SelfieDialog
 *   open={selfieDialogOpen}
 *   onOpenChange={setSelfieDialogOpen}
 * />
 * ```
 */
export function SelfieDialog({ open, onOpenChange }: SelfieDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStyle, setSelectedStyle] = useState<SelfieStyle>("natural");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const {
    userPhoto,
    userPhotoMimeType,
    setUserPhoto,
    currentPosition,
    currentPov,
    currentAddress,
    addSelfieImage,
    isGeneratingSelfie,
    setIsGeneratingSelfie
  } = useStreetViewStore();

  /**
   * Converts a File to base64 string (without data URL prefix).
   */
  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Handle file selection from input.
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      // Validate file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        setError("Image must be less than 4MB");
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        setUserPhoto(base64, file.type);
        setError(undefined);
        setGeneratedImage(undefined);
      } catch {
        setError("Failed to read image file");
      }
    },
    [setUserPhoto, fileToBase64]
  );

  /**
   * Trigger file input click.
   */
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Remove the uploaded photo.
   */
  const handleRemovePhoto = useCallback(() => {
    setUserPhoto(undefined);
    setGeneratedImage(undefined);
    setError(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [setUserPhoto]);

  /**
   * Fetches Street View image and converts to base64.
   * Uses Google Maps Static Street View API.
   */
  const fetchStreetViewBackground = useCallback(
    async (lat: number, lng: number, heading: number, pitch: number): Promise<string> => {
      const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!mapsApiKey) {
        throw new Error("Google Maps API key not configured");
      }

      const url = new URL("https://maps.googleapis.com/maps/api/streetview");
      url.searchParams.set("size", "1920x1080");
      url.searchParams.set("location", `${lat},${lng}`);
      url.searchParams.set("heading", heading.toString());
      url.searchParams.set("pitch", pitch.toString());
      url.searchParams.set("fov", "90");
      url.searchParams.set("key", mapsApiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch Street View image: ${response.status}`);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to convert image to base64"));
        reader.readAsDataURL(blob);
      });
    },
    []
  );

  /**
   * Generate the selfie composite using server-side API.
   * Routes requests through /api/selfie to keep API keys secure.
   */
  const handleGenerate = useCallback(async () => {
    if (!userPhoto || !currentPosition) {
      setError("Please upload a photo first");
      return;
    }

    setIsGenerating(true);
    setIsGeneratingSelfie(true);
    setError(undefined);

    try {
      // Fetch the Street View background
      const backgroundBase64 = await fetchStreetViewBackground(
        currentPosition.lat,
        currentPosition.lng,
        currentPov.heading,
        currentPov.pitch
      );

      // Call the server-side API to generate the composite
      // This keeps the Gemini API key secure on the server
      const response = await fetch("/api/selfie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userPhotoBase64: userPhoto,
          backgroundBase64,
          style: selectedStyle,
          userPhotoMimeType: userPhotoMimeType || "image/jpeg",
          backgroundMimeType: "image/jpeg"
        })
      });

      const result = await response.json();

      if (result.success && result.imageBase64) {
        setGeneratedImage(`data:${result.mimeType};base64,${result.imageBase64}`);

        // Save to store
        addSelfieImage({
          imageBase64: result.imageBase64,
          mimeType: result.mimeType || "image/jpeg",
          location: {
            position: currentPosition,
            address: currentAddress
          },
          style: selectedStyle
        });
      } else {
        setError(result.error || "Failed to generate selfie");
      }
    } catch (err) {
      console.error("[Selfie] Generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate selfie");
    } finally {
      setIsGenerating(false);
      setIsGeneratingSelfie(false);
    }
  }, [
    userPhoto,
    userPhotoMimeType,
    currentPosition,
    currentPov,
    currentAddress,
    selectedStyle,
    addSelfieImage,
    setIsGeneratingSelfie,
    fetchStreetViewBackground
  ]);

  /**
   * Download the generated image.
   */
  const handleDownload = useCallback(() => {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `anywhere-selfie-${Date.now()}.jpg`;
    link.click();
  }, [generatedImage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Take a Selfie
          </DialogTitle>
          <DialogDescription>Upload your photo to create an AI-generated souvenir at this location.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-1">
            {/* Photo upload area */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Photo</label>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

              {userPhoto ? (
                <Card className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${userPhotoMimeType || "image/jpeg"};base64,${userPhoto}`}
                    alt="Your photo"
                    className="w-full h-48 object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={handleRemovePhoto}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </Card>
              ) : (
                <Card
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-8 cursor-pointer",
                    "border-dashed hover:bg-muted/50 transition-colors"
                  )}
                  onClick={handleUploadClick}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 4MB</p>
                </Card>
              )}
            </div>

            {/* Style selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Style</label>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {SELFIE_STYLES.map((style) => (
                    <Button
                      key={style.id}
                      variant={selectedStyle === style.id ? "default" : "outline"}
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => setSelectedStyle(style.id)}
                    >
                      {selectedStyle === style.id && <Check className="h-3 w-3 mr-1" />}
                      {style.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {SELFIE_STYLES.find((s) => s.id === selectedStyle)?.description}
              </p>
            </div>

            {/* Location info */}
            {currentAddress && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Current Location</p>
                <p className="text-sm font-medium truncate">{currentAddress}</p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Generated image */}
            {generatedImage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Generated
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>

                <Card className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={generatedImage} alt="Generated selfie" className="w-full" />
                </Card>
              </div>
            )}

            {/* Generate button */}
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!userPhoto || isGenerating || isGeneratingSelfie}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Selfie
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
