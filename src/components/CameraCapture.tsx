import { useEffect, useRef, useState } from "react";
import { X, Camera, Video, RotateCcw, Circle, Square, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, type: "photo" | "video") => void;
  /** Hide video mode — onboarding selfie only */
  photoOnly?: boolean;
  defaultFacing?: "user" | "environment";
  /** Let user pick an image file when camera is unavailable */
  onUpload?: (file: File) => void;
}

export function CameraCapture({
  open,
  onClose,
  onCapture,
  photoOnly = false,
  defaultFacing = "environment",
  onUpload,
}: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(defaultFacing);

  useEffect(() => {
    if (open) {
      setFacingMode(defaultFacing);
      if (photoOnly) setMode("photo");
    }
  }, [open, defaultFacing, photoOnly]);
  const [error, setError] = useState<string | null>(null);

  // Start camera
  useEffect(() => {
    if (!open) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: mode === "video",
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
        setError(null);
      } catch (err) {
        console.error("Camera error:", err);
        setError("Could not access camera. Please check permissions.");
      }
    };

    startCamera();

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [open, facingMode, mode]);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (isRecording) {
      stopRecording();
    }
    onClose();
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file, "photo");
          handleClose();
        }
      }, "image/jpeg", 0.95);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) return;

    try {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm;codecs=vp9",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], `video-${Date.now()}.webm`, { type: "video/webm" });
        onCapture(file, "video");
        handleClose();
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Could not start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black"
        >
          {/* Video Preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center px-6">
                <p className="text-white text-sm mb-4">{error}</p>
                {photoOnly && onUpload && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f?.type.startsWith("image/")) {
                          onUpload(f);
                          handleClose();
                        }
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mb-3 w-full px-4 py-2.5 rounded-xl bg-white/15 text-white font-medium flex items-center justify-center gap-2"
                    >
                      <ImagePlus className="size-5" />
                      Upload from device
                    </button>
                  </>
                )}
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-white text-black rounded-xl font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Top Controls */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
            <button
              onClick={handleClose}
              className="size-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
            >
              <X className="size-6" />
            </button>

            {isRecording && (
              <div className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold flex items-center gap-2">
                <div className="size-2 rounded-full bg-white animate-pulse" />
                {formatTime(recordingTime)}
              </div>
            )}

            <button
              onClick={toggleCamera}
              className="size-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
            >
              <RotateCcw className="size-5" />
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center justify-center gap-8">
              {!photoOnly && (
                <button
                  onClick={() => setMode("photo")}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-opacity",
                    mode === "photo" ? "opacity-100" : "opacity-50"
                  )}
                >
                  <Camera className="size-6 text-white" />
                  <span className="text-xs text-white font-medium">Photo</span>
                </button>
              )}

              {/* Capture/Record Button */}
              <button
                onClick={() => {
                  if (mode === "photo" || photoOnly) {
                    capturePhoto();
                  } else if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                className={cn(
                  "size-20 rounded-full flex items-center justify-center transition-all",
                  isRecording
                    ? "bg-red-500"
                    : "bg-white border-4 border-white/30"
                )}
              >
                {mode === "photo" || photoOnly ? (
                  <Circle className="size-16 text-white fill-white" />
                ) : isRecording ? (
                  <Square className="size-8 text-white fill-white" />
                ) : (
                  <Circle className="size-16 text-red-500 fill-red-500" />
                )}
              </button>

              {!photoOnly && (
                <button
                  onClick={() => setMode("video")}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-opacity",
                    mode === "video" ? "opacity-100" : "opacity-50"
                  )}
                >
                  <Video className="size-6 text-white" />
                  <span className="text-xs text-white font-medium">Video</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
