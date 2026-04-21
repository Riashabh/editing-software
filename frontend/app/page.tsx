"use client";
import { useState, useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import StylePanel, { SubStyle, Subtitle, DEFAULT_STYLE } from "./components/StylePanel";

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

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
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
  const [editedSubtitles, setEditedSubtitles] = useState<Subtitle[] | null>(null);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(88);
  const [zoomPct, setZoomPct] = useState(20);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleVideoMount = (el: HTMLVideoElement) => {
    videoRef.current = el;
    el.ontimeupdate = () => setCurrentTime(el.currentTime);
    el.onloadedmetadata = () => setDuration(el.duration);
    el.onplay = () => setIsPlaying(true);
    el.onpause = () => setIsPlaying(false);
  };

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    isPlaying ? v.pause() : v.play();
  };

  const handlePrevSub = () => {
    const v = videoRef.current;
    if (!v || !displaySubtitles.length) return;
    const prev = [...displaySubtitles].reverse().find(s => s.start < v.currentTime - 0.3);
    if (prev) v.currentTime = prev.start;
  };

  const handleNextSub = () => {
    const v = videoRef.current;
    if (!v || !displaySubtitles.length) return;
    const next = displaySubtitles.find(s => s.start > v.currentTime + 0.1);
    if (next) v.currentTime = next.start;
  };

  const onTimelineDrag = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startH = timelineHeight;
    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(60, Math.min(220, startH + (startY - ev.clientY)));
      setTimelineHeight(newH);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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
    setSelectedSub(null);

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
      setEditedSubtitles(null);
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

  const displaySubtitles = editedSubtitles ?? activeClip?.subtitles ?? [];

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden">
      {/* Nav */}
      <nav className="flex-shrink-0 w-full px-8 py-4 flex items-center justify-between bg-white border-b border-black/8 z-50">
        <span className="text-sm font-semibold tracking-tight">ClipForge</span>
        <span className="text-xs text-neutral-400 bg-black/5 px-3 py-1 rounded-full">AI Video Editor</span>
      </nav>

      {/* Upload view */}
      {!result && (
        <main className="flex-1 flex flex-col items-center justify-start pt-16 px-4 bg-white overflow-auto">
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
            <div className="flex gap-2 mb-3 p-1 bg-black/[0.04] rounded-xl">
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
        </main>
      )}

      {/* Editor view */}
      {result && activeClip && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main row: video + sidebar */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left — video stage */}
            <div className="flex-1 bg-neutral-50 flex flex-col items-center justify-center p-8 relative overflow-auto">
              {/* Clip tabs */}
              {result.mode === "multi" && (
                <div className="flex gap-2 p-1 bg-black/[0.04] rounded-xl mb-6">
                  {result.clips?.map((_, i) => (
                    <button key={i} onClick={() => { setSelectedClip(i); setEditedSubtitles(null); setSelectedSub(null); }}
                      className={`px-5 py-1.5 text-xs font-medium rounded-lg transition-all ${selectedClip === i ? "bg-white shadow-sm text-black" : "text-neutral-400 hover:text-black"}`}>
                      Clip {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Video */}
              <div
                className="w-full"
                style={{
                  maxWidth: style.aspectRatio === "9/16" ? "300px"
                    : style.aspectRatio === "4/5" ? "380px"
                    : style.aspectRatio === "1/1" ? "500px"
                    : "760px",
                }}
              >
                <VideoPlayer
                  key={activeClip.video_url}
                  videoUrl={`http://localhost:8000${activeClip.video_url}`}
                  subtitles={displaySubtitles}
                  style={style}
                  onVideoMount={handleVideoMount}
                />
              </div>

              {/* Back button */}
              <button
                onClick={() => setResult(null)}
                className="absolute bottom-6 left-6 text-xs text-neutral-300 hover:text-black transition-colors"
              >
                ← New video
              </button>
            </div>

            {/* Right — sidebar */}
            <div className="w-80 bg-white border-l border-black/8 flex flex-col overflow-y-auto">
              <div className="p-6 flex-1">
                {selectedSub !== null ? (
                  /* Subtitle editor mode */
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-black">Edit Subtitle</p>
                      <button onClick={() => setSelectedSub(null)} className="text-xs text-neutral-400 hover:text-black transition-colors">← Back</button>
                    </div>
                    <p className="text-xs text-neutral-400 font-mono">
                      {formatTime(displaySubtitles[selectedSub].start)} → {formatTime(displaySubtitles[selectedSub].end)}
                    </p>
                    <textarea
                      value={displaySubtitles[selectedSub].text}
                      onChange={(e) => {
                        const updated = [...displaySubtitles];
                        updated[selectedSub] = { ...updated[selectedSub], text: e.target.value };
                        setEditedSubtitles(updated);
                      }}
                      autoFocus
                      className="w-full bg-black/[0.04] border border-black/8 rounded-xl px-4 py-3 text-sm text-black outline-none resize-none"
                      rows={5}
                    />
                    <button
                      onClick={() => setSelectedSub(null)}
                      className="w-full py-3 rounded-xl bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-all"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  /* Style panel mode */
                  <StylePanel style={style} onChange={setStyle} onExport={handleExport} exporting={exporting} />
                )}
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex-shrink-0 h-11 bg-white border-t border-black/8 flex items-center justify-center gap-4 px-4 relative">
            {/* Prev / Play / Next */}
            <button onClick={handlePrevSub} className="text-neutral-400 hover:text-black transition-colors text-base">⏮</button>
            <button onClick={handlePlayPause} className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-sm hover:bg-neutral-800 transition-colors">
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={handleNextSub} className="text-neutral-400 hover:text-black transition-colors text-base">⏭</button>
            <span className="text-xs text-neutral-400 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>

            {/* Zoom slider — right side */}
            <div className="absolute right-4 flex items-center gap-2">
              <button onClick={() => setZoomPct(z => Math.max(5, z - 15))} className="text-neutral-400 hover:text-black text-base transition-colors">−</button>
              <div className="relative w-24">
                <input
                  type="range" min={5} max={100} value={zoomPct}
                  onChange={e => setZoomPct(Number(e.target.value))}
                  className="w-full accent-black"
                />
                {/* Tooltip */}
                <div
                  className="pointer-events-none absolute -top-6 bg-black text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                  style={{ left: `calc(${zoomPct}% - 14px)` }}
                >
                  {zoomPct}%
                </div>
              </div>
              <button onClick={() => setZoomPct(z => Math.min(100, z + 15))} className="text-neutral-400 hover:text-black text-base transition-colors">+</button>
            </div>
          </div>

          {/* Bottom — subtitle timeline */}
          {(() => {
            const PX_PER_SEC = 10 + (zoomPct / 100) * 150;
            const RULER_H = 20;
            const clipStart = displaySubtitles[0]?.start ?? 0;
            const clipEnd = displaySubtitles[displaySubtitles.length - 1]?.end ?? 1;
            const totalDuration = clipEnd - clipStart;
            const totalWidth = Math.max(totalDuration * PX_PER_SEC + 80, 600);
            const ticks: number[] = [];
            const step = PX_PER_SEC >= 80 ? 1 : PX_PER_SEC >= 40 ? 2 : PX_PER_SEC >= 20 ? 5 : 10;
            for (let t = 0; t <= totalDuration + step; t += step) ticks.push(parseFloat(t.toFixed(1)));

            return (
              <div className="relative flex-shrink-0 bg-white border-t border-black/8" style={{ height: timelineHeight }}>
                {/* Drag handle */}
                <div onMouseDown={onTimelineDrag} className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-black/10 transition-colors z-20" />
                {/* Right fade */}
                <div className="pointer-events-none absolute top-0 right-0 w-10 h-full bg-gradient-to-l from-white to-transparent z-10" />

                <div className="h-full overflow-x-auto overflow-y-hidden">
                  <div className="relative h-full" style={{ width: totalWidth }}>
                    {/* Timecode ruler */}
                    <div className="relative h-5 border-b border-black/8">
                      {ticks.map(t => (
                        <div key={t} className="absolute top-0 flex items-center gap-1" style={{ left: t * PX_PER_SEC + 16 }}>
                          <div className="w-px h-2 bg-black/10" />
                          <span className="text-[9px] text-neutral-400 font-mono leading-none">{formatTime(clipStart + t)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Subtitle track */}
                    <div className="relative mx-4" style={{ height: timelineHeight - RULER_H }}>
                      {displaySubtitles.map((sub, i) => {
                        const left = (sub.start - clipStart) * PX_PER_SEC;
                        const width = Math.max((sub.end - sub.start) * PX_PER_SEC - 3, 20);
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedSub(i)}
                            style={{ position: "absolute", left, width, top: 6, bottom: 6 }}
                            className={`rounded-md px-2 text-left text-[11px] font-medium truncate transition-all overflow-hidden ${selectedSub === i ? "bg-black text-white" : "bg-black/[0.06] text-black hover:bg-black/[0.12]"}`}
                          >
                            {sub.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
