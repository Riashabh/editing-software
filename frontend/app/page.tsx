"use client";
import { useState, useRef, useEffect } from "react";
import VideoPlayer from "./components/VideoPlayer";
import StylePanel, { SubStyle, Subtitle, DEFAULT_STYLE } from "./components/StylePanel";

interface Message {
  role: "user" | "assistant";
  text: string;
  fileName?: string;
}

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

const CHIPS = [
  { label: "Best Moment", text: "find the best moment and make a clip" },
  { label: "3 Clips", text: "find the 3 best moments" },
  { label: "Transcribe", text: "just transcribe this video" },
  { label: "Make 9:16", text: "make it 9:16 vertical" },
];

export default function Home() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hey! Drop a video and tell me what you want to do with it." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatDragging, setChatDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View state
  const [view, setView] = useState<"chat" | "editor">("chat");

  // Editor state
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dotCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (msg: Message) => setMessages(prev => [...prev, msg]);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text && !chatFile) return;
    if (!chatFile) {
      addMessage({ role: "user", text });
      setChatInput("");
      addMessage({ role: "assistant", text: "Please attach a video first — drag it into the chat or click the paperclip." });
      return;
    }

    // Add user message
    addMessage({ role: "user", text: text || "Process this video", fileName: chatFile.name });
    setChatInput("");
    const file = chatFile;
    setChatFile(null);
    setProcessing(true);

    try {
      // Parse intent
      addMessage({ role: "assistant", text: "Got it, figuring out what you want..." });
      let intent = { mode: "single", count: 1, aspectRatio: "original" };
      if (text) {
        const intentRes = await fetch("http://localhost:8000/parse-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        if (intentRes.ok) intent = await intentRes.json();
      }

      const mode = intent.mode === "best_moments"
        ? (intent.count > 1 ? "multi" : "single")
        : "single";

      addMessage({ role: "assistant", text: "Transcribing your video with Whisper..." });

      const job_id = Math.random().toString(36).slice(2, 10);
      setJobId(job_id);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `http://localhost:8000/process?mode=${mode}&job_id=${job_id}&count=${intent.count}&aspectRatio=${intent.aspectRatio}`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const err = await res.json();
        addMessage({ role: "assistant", text: `Something went wrong: ${err.detail}` });
        return;
      }

      const data: ProcessResult = await res.json();

      // Apply aspect ratio from intent
      if (intent.aspectRatio && intent.aspectRatio !== "original") {
        setStyle(s => ({ ...s, aspectRatio: intent.aspectRatio }));
      }

      addMessage({ role: "assistant", text: `Done! Opening your clip in the editor.` });
      setTimeout(() => {
        setResult(data);
        setEditedSubtitles(null);
        setSelectedClip(0);
        setView("editor");
      }, 800);

    } catch {
      addMessage({ role: "assistant", text: "Something went wrong. Please try again." });
    } finally {
      setProcessing(false);
    }
  };

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        v.paused ? v.play() : v.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (view !== "chat") return;
    const canvas = dotCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SPACING = 24;
    const BASE_R = 1.5;
    const MAX_R = 7;
    const INFLUENCE = 90;

    let mx = -999, my = -999;
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    };
    window.addEventListener("mousemove", onMove);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * SPACING;
          const y = row * SPACING;
          const dist = Math.hypot(mx - x, my - y);
          const t = Math.max(0, 1 - dist / INFLUENCE);
          const r = BASE_R + (MAX_R - BASE_R) * t * t;
          const alpha = 0.09 + 0.4 * t * t;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [view]);

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
        body: JSON.stringify({ ...style, subtitles: displaySubtitles }),
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
      <nav className={`flex-shrink-0 w-full px-8 py-4 flex items-center justify-between z-50 border-b ${view === "editor" ? "bg-white border-black/8" : "border-white/5"}`} style={view === "chat" ? { backgroundColor: "#0a0a0a" } : {}}>
        <span className={`text-sm font-semibold tracking-tight ${view === "editor" ? "text-black" : "text-white"}`}>Wordcut</span>
        <div className="flex items-center gap-3">
          {view === "editor" && (
            <button onClick={() => setView("chat")} className="text-xs text-neutral-400 hover:text-black transition-colors">← Back to chat</button>
          )}
          {view === "chat" && result && (
            <button onClick={() => setView("editor")} className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">Back to editor →</button>
          )}
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${view === "editor" ? "text-neutral-400 bg-black/5" : "text-white/30 bg-white/5"}`}>AI Video Editor</span>
      </nav>

      {/* Chat view */}
      {view === "chat" && (
        <main
          className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative"
          onDragOver={(e) => { e.preventDefault(); setChatDragging(true); }}
          onDragLeave={() => setChatDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setChatDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && f.type.startsWith("video/")) setChatFile(f);
          }}
        >
          {/* Kinetic dot grid canvas */}
          <canvas ref={dotCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />

          {/* Drag overlay */}
          {chatDragging && (
            <div className="absolute inset-0 z-50 bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center">
              <p className="text-sm font-medium text-white">Drop your video</p>
            </div>
          )}

          {/* Messages — only show when there's more than the initial greeting */}
          {messages.length > 1 ? (
            <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-3 max-w-2xl w-full mx-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-white text-black rounded-br-sm" : "bg-white/[0.08] text-white rounded-bl-sm"}`}>
                    {msg.fileName && (
                      <p className="text-[11px] opacity-50 mb-1 font-mono">📎 {msg.fileName}</p>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}
              {processing && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.08] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            /* Hero — shown before first message */
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 gap-10">
              <h1 className="text-white text-center" style={{ fontFamily: "'RomauntGaolines', serif", fontSize: "5rem", fontWeight: 400, lineHeight: 0.9 }}>
                Edit video with<br />just <span style={{ color: "#1e90ff", fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 100, fontSize: "7rem", lineHeight: 0.9 }}>words.</span>
              </h1>

              {/* Big drop zone */}
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setChatDragging(true); }}
                onDragLeave={() => setChatDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setChatDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f && f.type.startsWith("video/")) setChatFile(f);
                }}
                className={`w-full max-w-lg flex flex-col items-center justify-center gap-3 py-12 rounded-3xl border-2 border-dashed transition-all cursor-pointer ${chatDragging ? "border-white/40 bg-white/10" : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]"}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.07] flex items-center justify-center text-2xl">▶</div>
                <p className="text-white text-sm font-medium">Drop your video here</p>
                <p className="text-white/30 text-xs">or click to browse · MP4, MOV, AVI</p>
              </button>

              {chatFile && (
                <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-4 py-2">
                  <span className="text-xs text-white/60 font-mono">📎 {chatFile.name}</span>
                  <button onClick={() => setChatFile(null)} className="text-white/30 hover:text-white text-sm ml-2">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Input area */}
          <div className="relative z-10 flex-shrink-0 px-4 pb-8 max-w-2xl w-full mx-auto">

            {/* Quick chips */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {CHIPS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => setChatInput(prev => prev ? `${prev} ${chip.text}` : chip.text)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white border border-white/8 transition-all"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input box with gradient border */}
            <div className="p-px rounded-2xl" style={{ background: "linear-gradient(135deg, #ffffff22, #ffffff08)" }}>
              <div className="bg-neutral-900 rounded-2xl px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 text-white/30 hover:text-white transition-colors text-lg"
                  title="Attach video"
                >
                  ⊕
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setChatFile(e.target.files[0]); }}
                />
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Describe what you want, or just drop a video..."
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                />
                <button
                  onClick={handleSend}
                  disabled={processing || (!chatInput.trim() && !chatFile)}
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-white flex items-center justify-center text-black text-sm font-bold transition-all hover:bg-white/90 disabled:bg-white/10 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Editor view */}
      {view === "editor" && result && activeClip && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main row: video + sidebar */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left — video stage */}
            <div className="flex-1 bg-neutral-50 flex flex-col items-center justify-center p-8 relative overflow-auto" style={{ backgroundImage: "radial-gradient(circle, #b0b0b0 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
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
            </div>

            {/* Right — sidebar */}
            <div className="w-80 bg-white border-l border-black/8 flex flex-col overflow-y-auto">
              <div className="p-6 flex-1">
                {selectedSub !== null ? (
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
                  <StylePanel style={style} onChange={setStyle} onExport={handleExport} exporting={exporting} />
                )}
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex-shrink-0 h-11 bg-white border-t border-black/8 flex items-center justify-center gap-4 px-4 relative">
            <div onMouseDown={onTimelineDrag} className="absolute top-0 left-0 right-0 h-1 cursor-row-resize" />
            <button onClick={handlePrevSub} className="text-neutral-400 hover:text-black transition-colors text-base">⏮</button>
            <button onClick={handlePlayPause} className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-sm hover:bg-neutral-800 transition-colors">
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={handleNextSub} className="text-neutral-400 hover:text-black transition-colors text-base">⏭</button>
            <span className="text-xs text-neutral-400 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <div className="absolute right-4 flex items-center gap-1.5">
              <button onClick={() => setZoomPct(z => Math.max(5, z - 15))} className="text-neutral-300 hover:text-black text-xs leading-none transition-colors">−</button>
              <input
                type="range" min={5} max={100} value={zoomPct}
                onChange={e => setZoomPct(Number(e.target.value))}
                className="w-20 accent-black cursor-pointer"
                style={{ height: 2 }}
              />
              <button onClick={() => setZoomPct(z => Math.min(100, z + 15))} className="text-neutral-300 hover:text-black text-xs leading-none transition-colors">+</button>
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
              <div className="relative flex-shrink-0 bg-white" style={{ height: timelineHeight }}>
                <div className="pointer-events-none absolute top-0 right-0 w-10 h-full bg-gradient-to-l from-white to-transparent z-10" />
                <div className="h-full overflow-x-auto overflow-y-hidden">
                  <div className="relative h-full" style={{ width: totalWidth }}>
                    <div className="relative h-5 border-b border-black/8 cursor-pointer" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const time = clipStart + (e.clientX - rect.left - 16) / PX_PER_SEC;
                      if (videoRef.current) videoRef.current.currentTime = Math.max(0, time);
                    }}>
                      <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none" style={{ left: (currentTime - clipStart) * PX_PER_SEC + 16 }} />
                      {ticks.map(t => (
                        <div key={t} className="absolute top-0 flex items-center gap-1" style={{ left: t * PX_PER_SEC + 16 }}>
                          <div className="w-px h-2 bg-black/10" />
                          <span className="text-[9px] text-neutral-400 font-mono leading-none">{formatTime(clipStart + t)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="relative mx-4 cursor-pointer" style={{ height: timelineHeight - RULER_H }} onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const time = clipStart + (e.clientX - rect.left) / PX_PER_SEC;
                      if (videoRef.current) videoRef.current.currentTime = Math.max(0, time);
                    }}>
                      <div
                        className="absolute top-0 bottom-0 w-3 -ml-1.5 z-20 cursor-ew-resize flex justify-center"
                        style={{ left: (currentTime - clipStart) * PX_PER_SEC }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const trackRect = e.currentTarget.parentElement!.getBoundingClientRect();
                          const onMove = (ev: MouseEvent) => {
                            const time = Math.max(0, clipStart + (ev.clientX - trackRect.left) / PX_PER_SEC);
                            if (videoRef.current) videoRef.current.currentTime = time;
                            setCurrentTime(time);
                          };
                          const onUp = () => {
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                      >
                        <div className="w-px h-full bg-red-500" />
                      </div>
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
