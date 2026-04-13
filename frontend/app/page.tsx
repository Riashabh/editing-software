"use client";
import { useState, useRef } from "react";

const steps = [
  "Extracting audio",
  "Transcribing with Whisper",
  "Finding best moments with GPT-4o",
  "Cutting & merging clips",
  "Reframing to vertical",
  "Burning subtitles",
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [clipUrls, setClipUrls] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setDownloadUrl(null);
    setClipUrls([]);
    setCurrentStep(-1);
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setDownloadUrl(null);
    setClipUrls([]);

    const timings = [0, 3000, 16000, 26000, 36000, 46000];
    timings.forEach((t, i) => setTimeout(() => setCurrentStep(i), t));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`http://localhost:8000/process?mode=${mode}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Error: " + err.detail);
        setProcessing(false);
        return;
      }

      setCurrentStep(steps.length);

      if (mode === "multi") {
        const data = await res.json();
        setClipUrls(data.clips.map((url: string) => `http://localhost:8000${url}`));
      } else {
        const blob = await res.blob();
        setDownloadUrl(URL.createObjectURL(blob));
      }
    } catch {
      alert("Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 font-sans">
      {/* Nav */}
      <nav className="fixed top-0 w-full px-12 py-5 flex items-center justify-between backdrop-blur-xl bg-white/60 border-b border-black/5 z-50">
        <span className="text-sm font-semibold tracking-tight">ClipForge</span>
        <span className="text-xs text-neutral-400 bg-black/5 px-3 py-1 rounded-full">AI Video Editor</span>
      </nav>

      {/* Hero */}
      <div className="text-center mb-12 mt-20">
        <h1 className="text-5xl font-semibold tracking-tight leading-tight text-black">
          Turn long videos<br />into viral clips.
        </h1>
        <p className="mt-4 text-neutral-400 text-base font-light">
          Drop a video. Get a polished short-form clip, automatically.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-6xl bg-white/70 backdrop-blur-2xl border border-black/8 rounded-3xl p-10 shadow-xl shadow-black/5">

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-black/[0.04] rounded-xl">
          <button
            onClick={() => setMode("single")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${mode === "single" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}
          >
            Best Clip
          </button>
          <button
            onClick={() => setMode("multi")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${mode === "multi" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}
          >
            3 Clips
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={`border-dashed border rounded-2xl p-14 text-center cursor-pointer transition-all duration-200
            ${dragging ? "border-black bg-black/5" : "border-black/15 bg-black/[0.02] hover:border-black/30 hover:bg-black/[0.03]"}`}
        >
          <div className="text-3xl mb-4">↑</div>
          <p className="text-sm font-medium text-black">Drop your video here</p>
          <p className="text-xs text-neutral-400 mt-1">MP4, MOV up to 2GB</p>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {/* File name */}
        {file && (
          <div className="mt-4 flex items-center justify-between bg-black/[0.04] rounded-xl px-4 py-3">
            <span className="text-xs text-neutral-500 truncate max-w-xs">{file.name}</span>
            <button onClick={() => { setFile(null); setDownloadUrl(null); setClipUrls([]); }} className="text-neutral-300 hover:text-black ml-4 text-base transition-colors">✕</button>
          </div>
        )}

        {/* Process button */}
        <button
          onClick={handleProcess}
          disabled={!file || processing}
          className="mt-4 w-full py-3.5 rounded-xl bg-black text-white text-sm font-medium transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
        >
          {processing ? "Processing..." : mode === "single" ? "Generate Clip" : "Generate 3 Clips"}
        </button>

        {/* Steps */}
        {processing && (
          <div className="mt-8 flex flex-col gap-3">
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 text-xs transition-all duration-300
                ${i < currentStep ? "text-neutral-400" : i === currentStep ? "text-black font-medium" : "text-neutral-200"}`}>
                {i === currentStep ? (
                  <div className="w-3 h-3 rounded-full border border-black border-t-transparent animate-spin flex-shrink-0" />
                ) : (
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i < currentStep ? "bg-neutral-300" : "bg-neutral-100"}`} />
                )}
                {step}
              </div>
            ))}
          </div>
        )}

                {/* Single download */}
        {downloadUrl && (
          <div className="mt-6 bg-black/[0.03] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-black">Your clip is ready.</span>
              <a href={downloadUrl} download="clip.mp4" className="text-xs text-neutral-400 hover:text-black transition-colors">
                Download ↓
              </a>
            </div>
            <video
              src={downloadUrl}
              controls
              className="w-full rounded-xl"
              style={{ aspectRatio: "9/16", background: "#000" }}
            />
          </div>
        )}


        {/* Multi download */}
        {clipUrls.length > 0 && (
          <div className="mt-6 flex flex-row gap-3">
            {clipUrls.map((url, i) => (
              <div key={i} className="bg-black/[0.03] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-black">Clip {i + 1}</span>
                  <a
                    href={url}
                    download={`clip_${i + 1}.mp4`}
                    className="text-xs text-neutral-400 hover:text-black transition-colors"
                  >
                    Download ↓
                  </a>
                </div>
                <video
                  src={url}
                  controls
                  className="w-full rounded-xl"
                  style={{ aspectRatio: "9/16", background: "#000" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
