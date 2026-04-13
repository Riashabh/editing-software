"use client";
import { useState, useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import StylePanel, { SubStyle, Subtitle, DEFAULT_STYLE } from "./components/StylePanel";

const STEP_MAP: Record<string, number> = {
  extracting: 0,
  transcribing: 1,
  finding_moments: 2,
  cutting: 3,
  reframing: 4,
  subtitles: 5,
  done: 6,
};

const steps = [
  "Extracting audio",
  "Transcribing with Whisper",
  "Finding best moments with GPT-4o",
  "Cutting & merging clips",
  "Reframing to vertical",
  "Burning subtitles",
];

interface ClipResult {
  video_url: string;
  subtitles: Subtitle[];
  srt_key?: string;
}

interface ProcessResult {
  mode: "single" | "multi";
  video_url?: string;
  subtitles?: Subtitle[];
  job_id?: string;
  clips?: ClipResult[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [errorStep, setErrorStep] = useState(-1);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selectedClip, setSelectedClip] = useState(0);
  const [style, setStyle] = useState<SubStyle>(DEFAULT_STYLE);
  const [exporting, setExporting] = useState(false);
  const [jobId, setJobId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setCurrentStep(-1);
    setErrorStep(-1);
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    setCurrentStep(-1);
    setErrorStep(-1);

    const job_id = Math.random().toString(36).slice(2, 10);
    setJobId(job_id);

    const formData = new FormData();
    formData.append("file", file);

    const timings = [0, 3000, 16000, 26000, 36000, 46000];
    timings.forEach((t, i) => setTimeout(() => setCurrentStep(i), t));

    try {
      const res = await fetch(`http://localhost:8000/process?mode=${mode}&job_id=${job_id}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Error: " + err.detail);
        return;
      }
      const data: ProcessResult = await res.json();
      setResult(data);
      setSelectedClip(0);
    } catch {
      alert("Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);

    const isMulti = result.mode === "multi";
    const clip = isMulti ? result.clips?.[selectedClip] : null;
    const params = new URLSearchParams({
      job_id: jobId,
      ...(clip?.srt_key ? { srt_key: clip.srt_key } : {}),
    });

    try {
      const res = await fetch(`http://localhost:8000/export?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(style),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Export failed: " + err.detail);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clip_exported.mp4";
      a.click();
    } catch {
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const activeClip: ClipResult | null = result
    ? result.mode === "single"
      ? { video_url: result.video_url!, subtitles: result.subtitles! }
      : result.clips?.[selectedClip] ?? null
    : null;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 font-sans pb-16">
      {/* Nav */}
      <nav className="fixed top-0 w-full px-12 py-5 flex items-center justify-between backdrop-blur-xl bg-white/60 border-b border-black/5 z-50">
        <span className="text-sm font-semibold tracking-tight">ClipForge</span>
        <span className="text-xs text-neutral-400 bg-black/5 px-3 py-1 rounded-full">AI Video Editor</span>
      </nav>

      {/* Upload card */}
      {!result && (
        <div className="flex flex-col items-center justify-center mt-40 w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-semibold tracking-tight leading-tight text-black">
              Turn long videos<br />into viral clips.
            </h1>
            <p className="mt-4 text-neutral-400 text-base font-light">
              Drop a video. Get a polished short-form clip, automatically.
            </p>
          </div>

          <div className="w-full max-w-lg bg-white/70 backdrop-blur-2xl border border-black/8 rounded-3xl p-10 shadow-xl shadow-black/5">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-black/[0.04] rounded-xl">
              <button onClick={() => setMode("single")} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${mode === "single" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}>Best Clip</button>
              <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${mode === "multi" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}>3 Clips</button>
            </div>

            {/* Drop Zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`border-dashed border rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 ${dragging ? "border-black bg-black/5" : "border-black/15 bg-black/[0.02] hover:border-black/30"}`}
            >
              <div className="text-3xl mb-4">↑</div>
              <p className="text-sm font-medium text-black">Drop your video here</p>
              <p className="text-xs text-neutral-400 mt-1">MP4, MOV up to 2GB</p>
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>

            {file && (
              <div className="mt-4 flex items-center justify-between bg-black/[0.04] rounded-xl px-4 py-3">
                <span className="text-xs text-neutral-500 truncate max-w-xs">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-neutral-300 hover:text-black ml-4 text-base transition-colors">✕</button>
              </div>
            )}

            <button onClick={handleProcess} disabled={!file || processing} className="mt-4 w-full py-3.5 rounded-xl bg-black text-white text-sm font-medium transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed">
              {processing ? "Processing..." : mode === "single" ? "Generate Clip" : "Generate 3 Clips"}
            </button>

            {/* Steps */}
            {processing && (
              <div className="mt-8 flex flex-col gap-3">
                {errorStep >= 0 && <p className="text-xs text-red-400 font-medium mb-1">Failed at: {steps[errorStep]}.</p>}
                {steps.map((step, i) => (
                  <div key={i} className={`flex items-center gap-3 text-xs transition-all duration-300 ${i === errorStep ? "text-red-400 font-medium" : i < currentStep ? "text-neutral-400" : i === currentStep ? "text-black font-medium" : "text-neutral-200"}`}>
                    {i === currentStep && errorStep < 0
                      ? <div className="w-3 h-3 rounded-full border border-black border-t-transparent animate-spin flex-shrink-0" />
                      : <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === errorStep ? "bg-red-400" : i < currentStep ? "bg-neutral-300" : "bg-neutral-100"}`} />}
                    {step}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor view */}
      {result && activeClip && (
        <div className="w-full max-w-6xl mt-24">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setResult(null)} className="text-xs text-neutral-400 hover:text-black transition-colors">← New video</button>
            {result.mode === "multi" && (
              <div className="flex gap-2 p-1 bg-black/[0.04] rounded-xl">
                {result.clips?.map((_, i) => (
                  <button key={i} onClick={() => setSelectedClip(i)} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${selectedClip === i ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}>
                    Clip {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-6">
            {/* Video */}
            <div className="flex-1 max-w-xs">
              <VideoPlayer
                key={activeClip.video_url}
                videoUrl={`http://localhost:8000${activeClip.video_url}`}
                subtitles={activeClip.subtitles}
                style={style}
              />
            </div>

            {/* Style panel */}
            <div className="w-72 bg-white/70 backdrop-blur-2xl border border-black/8 rounded-3xl p-6 shadow-xl shadow-black/5 self-start sticky top-24">
              <StylePanel style={style} onChange={setStyle} onExport={handleExport} exporting={exporting} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
