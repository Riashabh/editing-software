"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import VideoPlayer from "./components/VideoPlayer";
import StylePanel, { SubStyle, Subtitle, DEFAULT_STYLE } from "./components/StylePanel";
import { Ico } from "./components/icons";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const toUrl = (path: string) => path.startsWith("http") ? path : `${API}${path}`;

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
  mode: "single" | "multi" | "transcribe" | "animation";
  video_url?: string;
  subtitles?: Subtitle[];
  job_id?: string;
  srt_key?: string;
  clips?: ClipResult[];
  anim_duration?: number;
  track?: string;
  position?: number;
}

interface Segment {
  id: string;
  type: "clip" | "animation";
  track: "video" | "fx";
  sourceUrl: string;
  timelineStart: number;
  duration: number;
  label: string;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const PLACEHOLDERS = [
  "find the best 30 seconds, make it 9:16, add captions…",
  "cut this into 3 clips with hype intros…",
  "transcribe and add karaoke subtitles…",
  "reframe to vertical with face tracking…",
  "describe what you want, or drop a video…",
];

const CHIPS = [
  { label: "Best moment", icon: Ico.sparkle, text: "find the best moment and make a clip" },
  { label: "3 clips",     icon: Ico.scissors, text: "find the 3 best moments" },
  { label: "Subtitles",   icon: Ico.type, text: "add subtitles" },
  { label: "Make 9:16",   icon: Ico.crop, text: "make it 9:16 vertical" },
  { label: "Hype intro",  icon: Ico.wand, text: "find the best moment and add a hype intro animation" },
  { label: "Transcribe",  icon: Ico.mic, text: "transcribe this video" },
];

const PIPELINE_STEPS = ["Upload", "Transcribe", "Find", "Reframe", "Caption", "Export"];

const DEMO_STEPS = [
  { label: "Uploading demo.mp4",           detail: "sending to backend…" },
  { label: "Parsing intent",               detail: "GPT-4o-mini · figuring out your steps" },
  { label: "Transcribing audio",           detail: "Whisper · word-level timestamps" },
  { label: "Finding best moment",          detail: "GPT-4o-mini · scanning highlights" },
  { label: "Reframing",                    detail: "FFmpeg · aspect ratio crop" },
  { label: "Generating subtitles",         detail: "word timings · karaoke blocks" },
  { label: "Rendering animation",          detail: "Remotion · React → MP4" },
  { label: "Exporting",                    detail: "burning subtitles · final cut" },
];

function LandingNLETimeline() {
  const samples = useMemo(() => {
    const out: number[] = []; let seed = 17;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 320; i++) {
      const b = 0.28 + Math.sin(i * 0.08) * 0.22 + Math.sin(i * 0.31) * 0.14 + Math.sin(i * 0.6) * 0.08;
      out.push(Math.max(0.05, Math.min(1, b + r() * 0.22)));
    }
    return out;
  }, []);
  const videoBlocks = [[0, 22], [24, 48], [52, 78], [82, 100]];
  const captionBlocks = [[2, 14], [16, 26], [28, 40], [44, 58], [62, 74], [78, 92]];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 156, pointerEvents: "none", borderTop: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.25) 100%)" }}>
      <div style={{ height: 22, display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingLeft: 56 }}>
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} style={{ flex: 1, position: "relative", borderLeft: `1px solid ${i % 5 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}` }}>
            {i % 5 === 0 && <span style={{ position: "absolute", left: 4, top: 4, fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "ui-monospace, monospace" }}>0:{String(i * 2).padStart(2, "0")}</span>}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, top: 22, width: 56, bottom: 0, borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", fontSize: 8, fontFamily: "ui-monospace, monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
        <div style={{ height: 32, display: "flex", alignItems: "center", paddingLeft: 10 }}>V1</div>
        <div style={{ height: 42, display: "flex", alignItems: "center", paddingLeft: 10 }}>A1</div>
        <div style={{ height: 28, display: "flex", alignItems: "center", paddingLeft: 10 }}>Sub</div>
      </div>
      <div style={{ position: "absolute", left: 56, right: 0, top: 22, bottom: 0 }}>
        <div style={{ height: 32, position: "relative" }}>
          {videoBlocks.map(([a, b], i) => (
            <div key={i} style={{ position: "absolute", left: `${a}%`, width: `${b - a}%`, top: 4, bottom: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 8px)" }} />
          ))}
        </div>
        <div style={{ height: 42, position: "relative", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${samples.length} 40`} preserveAspectRatio="none">
            {samples.map((v, i) => { const h = Math.round(v * 340) / 10; const y = Math.round((20 - h / 2) * 1000) / 1000; return <rect key={i} x={i + 0.2} y={y} width="0.6" height={h} fill="rgba(255,255,255,0.14)" />; })}
          </svg>
        </div>
        <div style={{ height: 28, position: "relative", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {captionBlocks.map(([a, b], i) => (
            <div key={i} style={{ position: "absolute", left: `${a}%`, width: `${b - a}%`, top: 4, bottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: "34%", top: -22, bottom: 0, width: 1, background: "rgba(255,255,255,0.25)" }}>
          <div style={{ position: "absolute", top: -4, left: -4, width: 9, height: 7, background: "rgba(255,255,255,0.4)", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
        </div>
      </div>
    </div>
  );
}

function DemoOverlay({ step, onClose }: { step: number; onClose: () => void }) {
  const total = DEMO_STEPS.length;
  const isDone = step >= total;
  const current = DEMO_STEPS[Math.min(step, total - 1)];
  const progress = isDone ? 1 : (step + 1) / total;
  const accentColor = isDone ? "#6EE7B7" : "#60a5fa";
  return (
    <div style={{ position: "absolute", right: 24, bottom: 200, zIndex: 20, width: 320, background: "rgba(8,9,11,0.96)", border: `1px solid ${isDone ? "rgba(110,231,183,0.3)" : "rgba(96,165,250,0.2)"}`, borderRadius: 14, backdropFilter: "blur(24px)", boxShadow: `0 24px 64px -16px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`, color: "rgba(255,255,255,0.85)", overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: accentColor, boxShadow: `0 0 8px 2px ${accentColor}`, display: "inline-block", animation: isDone ? "none" : "demoPulse 1.2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.13em", color: "rgba(255,255,255,0.45)", fontWeight: 700, fontFamily: "ui-monospace,monospace" }}>{isDone ? "Complete" : "Running"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, padding: "2px 7px", background: isDone ? "rgba(110,231,183,0.12)" : "rgba(96,165,250,0.1)", borderRadius: 4, fontFamily: "ui-monospace,monospace", color: isDone ? "#6EE7B7" : "#93c5fd" }}>{isDone ? "✓ done" : `${step + 1} / ${total}`}</span>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", padding: 2 }}><Ico.close size={11} /></button>
          </div>
        </div>
      </div>
      {/* current step hero */}
      <div style={{ padding: "14px 14px 10px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: isDone ? "#6EE7B7" : "#fff", marginBottom: 4, letterSpacing: "-0.01em" }}>{isDone ? "Your clip is ready — downloading" : current.label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "ui-monospace,monospace" }}>{isDone ? "clip_exported.mp4" : current.detail}</div>
      </div>
      {/* step list */}
      <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
        {DEMO_STEPS.map((s, i) => {
          const done = i < step || isDone;
          const active = i === step && !isDone;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11, fontFamily: "ui-monospace,monospace", color: active ? "#fff" : done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)", transition: "color 0.3s" }}>
              <span style={{ flexShrink: 0, width: 16, textAlign: "center", fontSize: done && !active ? 11 : 10, color: active ? accentColor : done ? "#6EE7B7" : "rgba(255,255,255,0.15)" }}>
                {done && !active ? "✓" : active ? "▶" : "○"}
              </span>
              <span style={{ fontWeight: active ? 600 : 400 }}>{s.label}</span>
              {active && <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>LIVE</span>}
            </div>
          );
        })}
      </div>
      {/* progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: isDone ? "#6EE7B7" : "linear-gradient(90deg, #3b82f6, #60a5fa)", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", boxShadow: isDone ? "0 0 8px #6EE7B7" : "0 0 8px #60a5fa" }} />
      </div>
      <style>{`@keyframes demoPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.5); } }`}</style>
    </div>
  );
}

const ASPECT_RATIOS = [
  { v: "original", label: "Original" },
  { v: "9/16", label: "9:16" },
  { v: "16/9", label: "16:9" },
  { v: "1/1", label: "1:1" },
  { v: "4/5", label: "4:5" },
];

function iconBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 28, height: 28,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: active ? "var(--ink)" : "var(--ink-60)",
    background: active ? "var(--surface-1)" : "transparent",
    border: `1px solid ${active ? "var(--line)" : "transparent"}`,
    borderRadius: 6, cursor: "pointer",
  };
}

function Waveform({ currentTime, duration }: { currentTime: number; duration: number }) {
  const bars = 200;
  const data = useMemo(() => Array.from({ length: bars }, (_, i) =>
    Math.max(0.06, Math.min(1,
      0.3 + 0.35 * Math.abs(Math.sin(i * 0.34)) + 0.25 * Math.abs(Math.sin(i * 0.11 + 1.3)) + 0.1 * Math.sin(i * 1.7)
    ))
  ), []);
  const playheadPct = duration > 0 ? currentTime / duration : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1, height: "100%", padding: "3px 0" }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${v * 100}%`, borderRadius: 1,
          background: i / bars <= playheadPct ? "var(--ink)" : "var(--ink-20)",
        }} />
      ))}
    </div>
  );
}

function PipelineRail({ currentStep }: { currentStep: string }) {
  const currentIndex = PIPELINE_STEPS.findIndex(s => s.toLowerCase() === currentStep);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      padding: "0 12px", height: 28,
      background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 999,
    }}>
      {PIPELINE_STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <span key={s} style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, padding: "3px 7px",
              color: active ? "var(--ink)" : done ? "var(--ink-60)" : "var(--ink-40)",
              background: active ? "var(--bg)" : "transparent",
              border: active ? "1px solid var(--line)" : "1px solid transparent",
              borderRadius: 5, fontWeight: active ? 600 : 500,
            }}>
              {done
                ? <span style={{ color: "oklch(0.62 0.16 145)", display: "inline-flex" }}><Ico.check size={11} strokeWidth={2.2} /></span>
                : null}
              {s}
            </span>
            {i < PIPELINE_STEPS.length - 1 && (
              <span style={{ width: 8, height: 1, background: "var(--line)", display: "inline-block" }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function SegmentedControl({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { v: string; label: string }[] }) {
  return (
    <div style={{ display: "inline-flex", padding: 2, background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 8 }}>
      {items.map(it => {
        const active = it.v === value;
        return (
          <button key={it.v} onClick={() => onChange(it.v)} style={{
            padding: "4px 9px", fontSize: 11, fontWeight: active ? 600 : 500,
            color: active ? "var(--ink)" : "var(--ink-60)",
            background: active ? "var(--bg)" : "transparent",
            border: active ? "1px solid var(--line)" : "1px solid transparent",
            borderRadius: 6, cursor: "pointer",
          }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}


function SubtitleEditor({ sub, index, total, onPrev, onNext, onClose, onSave }: {
  sub: Subtitle; index: number; total: number;
  onPrev: () => void; onNext: () => void; onClose: () => void; onSave: (text: string) => void;
}) {
  const [text, setText] = useState(sub.text);
  return (
    <div style={{ flexShrink: 0, padding: "12px 14px", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={onPrev} disabled={index === 0} style={{ color: "var(--ink-40)", background: "transparent", border: "none", cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.3 : 1, display: "flex" }}>
            <Ico.prev size={11} />
          </button>
          <span style={{ fontSize: 10, color: "var(--ink-40)", fontFamily: "ui-monospace, monospace" }}>
            {index + 1} / {total} · {formatTime(sub.start)}–{formatTime(sub.end)}
          </span>
          <button onClick={onNext} disabled={index === total - 1} style={{ color: "var(--ink-40)", background: "transparent", border: "none", cursor: index === total - 1 ? "default" : "pointer", opacity: index === total - 1 ? 0.3 : 1, display: "flex" }}>
            <Ico.next size={11} />
          </button>
        </div>
        <button onClick={onClose} style={{ color: "var(--ink-40)", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}>
          <Ico.close size={11} />
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(text); } if (e.key === "Escape") onClose(); }}
        autoFocus rows={2}
        style={{
          width: "100%", resize: "none", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 7, padding: "8px 10px", fontSize: 13,
          color: "var(--ink)", background: "rgba(255,255,255,0.04)",
          outline: "none", fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "6px", fontSize: 11, color: "var(--ink-60)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={() => onSave(text)} style={{ flex: 2, padding: "6px", fontSize: 11, fontWeight: 600, color: "var(--bg)", background: "var(--ink)", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Save  ↵
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hey! Drop a video and tell me what you want to do with it." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatDragging, setChatDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [view, setView] = useState<"chat" | "editor">("chat");

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedClip, setSelectedClip] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [activeVideoSegId, setActiveVideoSegId] = useState<string | null>(null);
  const [style, setStyle] = useState<SubStyle>(DEFAULT_STYLE);
  const [exporting, setExporting] = useState(false);
  const [jobId, setJobId] = useState("");
  const [editedSubtitles, setEditedSubtitles] = useState<Subtitle[] | null>(null);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(160);
  const [chatPanelWidth, setChatPanelWidth] = useState(300);
  const [zoomPct, setZoomPct] = useState(20);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showChat, setShowChat] = useState(true);
  const [showProps, setShowProps] = useState(true);
  const [demoStep, setDemoStep] = useState(-1);
  const [demoRunning, setDemoRunning] = useState(false);
  const demoAbortRef = useRef(false);
  const demoAutoExportRef = useRef(false);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Advance demo overlay step as real assistant messages arrive
  useEffect(() => {
    if (demoStep < 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const t = last.text.toLowerCase();
    if (t.includes("figuring out")) setDemoStep(1);
    else if (t.includes("transcrib")) setDemoStep(2);
    else if (t.includes("finding") || t.includes("best moment")) setDemoStep(3);
    else if (t.includes("reframe") || t.includes("crop")) setDemoStep(4);
    else if (t.includes("subtitle") || t.includes("caption")) setDemoStep(5);
    else if (t.includes("animat") || t.includes("intro") || t.includes("outro")) setDemoStep(6);
    else if (t.includes("done") || t.includes("opening")) setDemoStep(7);
  }, [messages, demoStep]);

  // Auto-export when demo finishes processing
  useEffect(() => {
    if (!demoAutoExportRef.current || !result) return;
    demoAutoExportRef.current = false;
    setDemoStep(7);
    // Small delay so the editor has time to mount the video
    const t = setTimeout(() => {
      setDemoStep(DEMO_STEPS.length); // "Done" state
      handleExport();
    }, 1800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % PLACEHOLDERS.length; setPlaceholder(PLACEHOLDERS[i]); }, 2800);
    return () => clearInterval(id);
  }, []);

  const addMessage = (msg: Message) => setMessages(prev => [...prev, msg]);

  type Step = { action: string; count?: number; aspectRatio?: string; subtitles?: boolean; overlay?: boolean; position?: number };

  const stepMessage = (step: Step) => {
    if (step.action === "find_best_moments") return step.count && step.count > 1 ? `Finding ${step.count} best moments…` : "Finding the best moment…";
    if (step.action === "crop") return "Cropping your video…";
    if (step.action === "add_subtitles") return "Adding subtitles…";
    if (step.action === "transcribe") return "Transcribing your video…";
    if (step.action === "animate") return "Generating animation with GPT-4o + Remotion…";
    if (step.action === "revert") return "Reverting…";
    return "Processing…";
  };

  const executeStep = async (step: Step, job_id: string, text: string, file: File, prevResult: ProcessResult | null): Promise<ProcessResult | null> => {
    const formData = new FormData();
    formData.append("file", file);

    if (step.action === "crop") {
      const res = await fetch(`${API}/crop?job_id=${job_id}&aspectRatio=${step.aspectRatio ?? "9/16"}`, { method: "POST", body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      return res.json();
    }

    if (step.action === "transcribe") {
      const res = await fetch(`${API}/process?mode=transcribe&job_id=${job_id}`, { method: "POST", body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      const data = await res.json();
      const preview = data.transcript.length > 300 ? data.transcript.slice(0, 300) + "…" : data.transcript;
      addMessage({ role: "assistant", text: preview });
      return null;
    }

    if (step.action === "add_subtitles") {
      const activeClipResult = prevResult?.mode === "multi" ? prevResult.clips?.[selectedClip] : prevResult;
      const existingSrtKey = activeClipResult && "srt_key" in activeClipResult ? (activeClipResult as ClipResult).srt_key : undefined;
      if (existingSrtKey || job_id) {
        const params = existingSrtKey ? `srt_key=${existingSrtKey}` : `job_id=${job_id}`;
        const res = await fetch(`${API}/add-subtitles?${params}`, { method: "POST" });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
        return res.json();
      } else {
        const res = await fetch(`${API}/process?mode=add_subtitles&job_id=${job_id}&aspectRatio=${step.aspectRatio ?? "original"}`, { method: "POST", body: formData });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
        return res.json();
      }
    }

    if (step.action === "animate") {
      const srtKey = prevResult?.srt_key;
      const params = new URLSearchParams({
        prompt: text, job_id,
        track: (step as Step & { track?: string }).track ?? "video",
        position: String(step.position ?? 0),
        ...(srtKey ? { srt_key: srtKey } : {}),
      });
      const res = await fetch(`${API}/animate?${params}`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      return res.json();
    }

    const mode = (step.count ?? 1) > 1 ? "multi" : "single";
    const res = await fetch(
      `${API}/process?mode=${mode}&job_id=${job_id}&count=${step.count ?? 1}&aspectRatio=${step.aspectRatio ?? "original"}&subtitles=${step.subtitles ?? false}`,
      { method: "POST", body: formData }
    );
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
    return res.json();
  };

  const handleStartFresh = () => {
    fetch(`${API}/cleanup`, { method: "POST" }).catch(() => {});
    setMessages([{ role: "assistant", text: "Hey! Drop a video and tell me what you want to do with it." }]);
    setResult(null); setSegments([]); setActiveVideoSegId(null); setSelectedSegmentId(null);
    setJobId(""); setUploadedFile(null); setChatFile(null); setChatInput("");
    setEditedSubtitles(null); setSelectedClip(0); setSelectedSub(null);
    setCurrentTime(0); setDuration(0); videoRefs.current.clear(); setView("chat");
  };

  const handleSend = async (overrideText?: string, overrideFile?: File) => {
    const text = (overrideText !== undefined ? overrideText : chatInput).trim();
    const file = overrideFile ?? chatFile ?? uploadedFile;
    if (!text && !file) return;
    if (!file) {
      addMessage({ role: "user", text });
      setChatInput("");
      addMessage({ role: "assistant", text: "Please attach a video first — drag it into the chat or click the attach button." });
      return;
    }

    if (overrideFile ?? chatFile) setUploadedFile(overrideFile ?? chatFile!);
    addMessage({ role: "user", text: text || "Process this video", fileName: (overrideFile ?? chatFile)?.name });
    setChatInput(""); setChatFile(null); setProcessing(true);

    try {
      addMessage({ role: "assistant", text: "Got it, figuring out what you want…" });
      let steps: Step[] = [{ action: "find_best_moments", count: 1, aspectRatio: "original", subtitles: false }];
      if (text) {
        const intentContext = result ? {
          hasActiveClip: true,
          hasSubtitles: displaySubtitles.length > 0,
          subtitleCount: displaySubtitles.length,
          clipMode: result.mode,
          clipCount: result.clips?.length,
        } : {};
        const intentRes = await fetch(`${API}/parse-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, context: intentContext }),
        });
        if (intentRes.ok) {
          const parsed = await intentRes.json();
          if (parsed.steps?.length) steps = parsed.steps;
        }
      }

      const clipOps = ["animate", "add_subtitles", "crop"];
      const needsNewJob = result ? steps.some(s => s.action === "find_best_moments") : steps.some(s => !clipOps.includes(s.action));
      const job_id = needsNewJob ? Math.random().toString(36).slice(2, 10) : jobId;
      if (needsNewJob) setJobId(job_id);

      let currentResult: ProcessResult | null = result;
      let finalResult: ProcessResult | null = null;

      for (const step of steps) {
        if (step.action === "revert") {
          const animSegs = segments.filter(s => s.type === "animation");
          if (animSegs.length > 0) {
            setSegments(prev => prev.filter(s => s.type !== "animation"));
            setSelectedSegmentId(null);
            addMessage({ role: "assistant", text: "Removed animations — back to the original clip." });
          } else {
            addMessage({ role: "assistant", text: "Nothing to revert." });
          }
          continue;
        }

        addMessage({ role: "assistant", text: stepMessage(step) });
        const stepResult = await executeStep(step, job_id, text, file, currentResult);
        if (!stepResult) continue;
        currentResult = stepResult;

        if (step.action === "animate" && stepResult.mode === "animation") {
          const animId = `anim-${Date.now()}`;
          const pos = stepResult.position ?? 0;
          const animDur = stepResult.anim_duration ?? 3;
          const animTrack = (stepResult.track ?? "video") as "video" | "fx";
          const label = pos === 0 ? "Intro" : pos < 0 ? "Outro" : "Animation";
          setSegments(prev => {
            const videoSegs = prev.filter(s => s.track === "video").sort((a, b) => a.timelineStart - b.timelineStart);
            let timelineStart: number;
            if (pos === 0) {
              const shifted = prev.map(s => ({ ...s, timelineStart: s.timelineStart + animDur }));
              return [...shifted, { id: animId, type: "animation" as const, track: animTrack, sourceUrl: toUrl(stepResult.video_url!), timelineStart: 0, duration: animDur, label }];
            } else if (pos < 0) {
              const lastEnd = videoSegs.length > 0 ? videoSegs[videoSegs.length - 1].timelineStart + videoSegs[videoSegs.length - 1].duration : 0;
              timelineStart = lastEnd;
            } else {
              timelineStart = pos;
            }
            return [...prev, { id: animId, type: "animation" as const, track: animTrack, sourceUrl: toUrl(stepResult.video_url!), timelineStart, duration: animDur, label }];
          });
          setActiveVideoSegId(prev => prev ?? animId);
          continue;
        }

        finalResult = stepResult;
        if (step.action === "crop" && step.aspectRatio) setStyle(s => ({ ...s, aspectRatio: step.aspectRatio! }));
        if (step.action === "transcribe") { setProcessing(false); return; }

        if (stepResult.video_url && stepResult.mode !== "transcribe") {
          const clipId = `clip-${job_id}`;
          setSegments([{ id: clipId, type: "clip", track: "video", sourceUrl: toUrl(stepResult.video_url!), timelineStart: 0, duration: 0, label: "Clip" }]);
          setActiveVideoSegId(clipId);
          setSelectedSegmentId(null);
        }
      }

      if (finalResult) {
        addMessage({ role: "assistant", text: "Done! Opening in the editor." });
        setTimeout(() => { setResult(finalResult!); setEditedSubtitles(null); setSelectedClip(0); setView("editor"); }, 800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      addMessage({ role: "assistant", text: `Error: ${msg}` });
    } finally {
      setProcessing(false);
    }
  };

  const activeVideoEl = () => activeVideoSegId ? videoRefs.current.get(activeVideoSegId) ?? null : null;

  const handleSegmentMount = (segId: string, el: HTMLVideoElement | null) => {
    if (!el) { videoRefs.current.delete(segId); return; }
    videoRefs.current.set(segId, el);
    el.onloadedmetadata = () => {
      setSegments(prev => prev.map(s => s.id === segId && s.duration === 0 ? { ...s, duration: el.duration } : s));
      if (segId === activeVideoSegId) setDuration(el.duration);
    };
    el.ontimeupdate = () => {
      if (segId !== activeVideoSegId) return;
      const seg = segments.find(s => s.id === segId);
      if (seg) setCurrentTime(seg.timelineStart + el.currentTime);
    };
    el.onplay = () => { if (segId === activeVideoSegId) setIsPlaying(true); };
    el.onpause = () => { if (segId === activeVideoSegId) setIsPlaying(false); };
    el.onended = () => {
      if (segId !== activeVideoSegId) return;
      const videoSegs = segments.filter(s => s.track === "video").sort((a, b) => a.timelineStart - b.timelineStart);
      const idx = videoSegs.findIndex(s => s.id === segId);
      const next = videoSegs[idx + 1];
      if (next) {
        const nextEl = videoRefs.current.get(next.id);
        if (nextEl) { nextEl.currentTime = 0; nextEl.play(); }
        setActiveVideoSegId(next.id);
      } else { setIsPlaying(false); }
    };
  };

  const handlePlayPause = () => {
    const v = activeVideoEl();
    if (!v) return;
    isPlaying ? v.pause() : v.play();
  };

  const handlePrevSub = () => {
    const v = activeVideoEl();
    if (!v || !displaySubtitles.length) return;
    const prev = [...displaySubtitles].reverse().find(s => s.start < v.currentTime - 0.3);
    if (prev) v.currentTime = prev.start;
  };

  const handleNextSub = () => {
    const v = activeVideoEl();
    if (!v || !displaySubtitles.length) return;
    const next = displaySubtitles.find(s => s.start > v.currentTime + 0.1);
    if (next) v.currentTime = next.start;
  };

  const seekToTime = (virtualTime: number) => {
    const videoSegs = segments.filter(s => s.track === "video").sort((a, b) => a.timelineStart - b.timelineStart);
    const target = videoSegs.find(s => virtualTime >= s.timelineStart && virtualTime < s.timelineStart + s.duration) ?? videoSegs[videoSegs.length - 1];
    if (!target) return;
    setCurrentTime(virtualTime);
    if (target.id !== activeVideoSegId) {
      const prevEl = activeVideoEl();
      if (prevEl) prevEl.pause();
      setActiveVideoSegId(target.id);
    }
    const el = videoRefs.current.get(target.id);
    if (el) el.currentTime = Math.max(0, virtualTime - target.timelineStart);
  };

  const startSegmentDrag = (seg: Segment, e: React.MouseEvent, PX_PER_SEC: number) => {
    if (seg.type === "clip") return;
    e.stopPropagation();
    const startX = e.clientX;
    const origStart = seg.timelineStart;
    const onMove = (ev: MouseEvent) => {
      const newStart = Math.max(0, origStart + (ev.clientX - startX) / PX_PER_SEC);
      setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, timelineStart: newStart } : s));
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const activeVideoSegIdRef = useRef(activeVideoSegId);
  useEffect(() => { activeVideoSegIdRef.current = activeVideoSegId; }, [activeVideoSegId]);
  const selectedSegmentIdRef = useRef(selectedSegmentId);
  useEffect(() => { selectedSegmentIdRef.current = selectedSegmentId; }, [selectedSegmentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      if (e.code === "Space") {
        e.preventDefault();
        const el = activeVideoSegIdRef.current ? videoRefs.current.get(activeVideoSegIdRef.current) ?? null : null;
        if (el) el.paused ? el.play() : el.pause();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const selId = selectedSegmentIdRef.current;
        if (selId) { e.preventDefault(); setSegments(prev => prev.filter(s => s.id !== selId)); setSelectedSegmentId(null); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runDemo = async () => {
    if (demoRunning) {
      demoAbortRef.current = true;
      setDemoRunning(false);
      setChatInput("");
      setChatFile(null);
      return;
    }

    demoAbortRef.current = false;
    setDemoRunning(true);
    setDemoStep(0);

    const DEMO_PROMPT = "find best moment, add subtitles";
    for (let i = 0; i <= DEMO_PROMPT.length; i++) {
      if (demoAbortRef.current) { setDemoRunning(false); setDemoStep(-1); return; }
      setChatInput(DEMO_PROMPT.slice(0, i));
      await new Promise(r => setTimeout(r, 60));
    }

    if (demoAbortRef.current) { setChatInput(""); setDemoRunning(false); setDemoStep(-1); return; }

    await new Promise(r => setTimeout(r, 400));

    const job_id = Math.random().toString(36).slice(2, 10);
    setJobId(job_id);

    addMessage({ role: "user", text: DEMO_PROMPT });
    setChatInput("");
    setDemoRunning(false);
    setProcessing(true);

    try {
      addMessage({ role: "assistant", text: "Got it, figuring out what you want…" });
      await new Promise(r => setTimeout(r, 300));
      addMessage({ role: "assistant", text: "Transcribing the video…" });
      setDemoStep(2);

      const res = await fetch(
        `${API}/demo-process?job_id=${job_id}&mode=single&subtitles=true`,
        { method: "POST" }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: "Demo failed" }));
        throw new Error(e.detail);
      }
      const data: ProcessResult = await res.json();
      setDemoStep(DEMO_STEPS.length);
      demoAutoExportRef.current = false;

      addMessage({ role: "assistant", text: "Done! Opening your clip…" });
      setResult(data);
      setEditedSubtitles(null);
      setSelectedClip(0);
      const clipId = `clip-${job_id}`;
      setSegments([{ id: clipId, type: "clip", track: "video", sourceUrl: toUrl(data.video_url ?? ""), timelineStart: 0, duration: 0, label: "Clip" }]);
      setActiveVideoSegId(clipId);
      setSelectedSegmentId(null);
      setTimeout(() => setView("editor"), 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo failed";
      addMessage({ role: "assistant", text: `Demo video not available — ${msg}` });
      setDemoStep(-1);
    } finally {
      setProcessing(false);
    }
  };

  const cancelDemo = () => {
    demoAbortRef.current = true;
    demoAutoExportRef.current = false;
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    setDemoStep(-1);
    setDemoRunning(false);
    setChatInput("");
    setChatFile(null);
  };

  useEffect(() => () => { demoTimers.current.forEach(clearTimeout); }, []);

  const onChatPanelDrag = (e: React.MouseEvent) => {
    const startX = e.clientX, startW = chatPanelWidth;
    const onMove = (ev: MouseEvent) => setChatPanelWidth(Math.max(220, Math.min(480, startW + (ev.clientX - startX))));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const onTimelineDrag = (e: React.MouseEvent) => {
    const startY = e.clientY, startH = timelineHeight;
    const onMove = (ev: MouseEvent) => setTimelineHeight(Math.max(80, Math.min(260, startH + (startY - ev.clientY))));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const handleExport = async () => {
    if (segments.length === 0 && !result) return;
    setExporting(true);
    const srtKey = result?.srt_key ?? "";
    const params = new URLSearchParams({ job_id: jobId, ...(srtKey ? { srt_key: srtKey } : {}) });
    try {
      const exportSegments = segments.map(s => ({
        source_url: s.sourceUrl.startsWith(API) ? s.sourceUrl.replace(API, "") : s.sourceUrl,
        timeline_start: s.timelineStart, track: s.track, duration: s.duration,
      }));
      const res = await fetch(`${API}/export?${params}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...style, subtitles: displaySubtitles, segments: exportSegments }),
      });
      if (!res.ok) { const err = await res.json(); alert("Export failed: " + err.detail); return; }
      const contentType = res.headers.get("content-type") ?? "";
      let downloadUrl: string;
      if (contentType.includes("application/json")) {
        const data = await res.json();
        downloadUrl = data.url;
      } else {
        const blob = await res.blob();
        downloadUrl = URL.createObjectURL(blob);
      }
      const a = document.createElement("a");
      a.href = downloadUrl; a.download = "clip_exported.mp4"; a.click();
    } catch { alert("Export failed."); }
    finally { setExporting(false); }
  };

  const activeClip: ClipResult | null = result?.mode === "single"
    ? { video_url: result.video_url!, subtitles: result.subtitles! }
    : result?.mode === "multi" ? (result.clips?.[selectedClip] ?? null) : null;

  const displaySubtitles = editedSubtitles ?? activeClip?.subtitles ?? [];

  const clipSeg = useMemo(() => segments.find(s => s.type === "clip" && s.track === "video"), [segments]);

  const pipelineStep = result
    ? (displaySubtitles.length > 0 ? "export" : result.mode === "single" || result.mode === "multi" ? "caption" : "transcribe")
    : "upload";

  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg)" }}>
        <Ico.scissors size={12} strokeWidth={2} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>Wordcut</span>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)", color: "var(--ink)", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ── CHAT VIEW ── */}
      {view === "chat" && (
        <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}
          onDragOver={e => { e.preventDefault(); setChatDragging(true); }}
          onDragLeave={() => setChatDragging(false)}
          onDrop={e => { e.preventDefault(); setChatDragging(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("video/")) setChatFile(f); }}>

          {/* Dot grid covers full area including behind nav */}
          <div className="dot-grid" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />
          <div className="vignette" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />

          <nav style={{
            flexShrink: 0, position: "relative", zIndex: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 32px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text)", fontFamily: "var(--font-ui)" }}>Wordcut</span>
            <div style={{ display: "flex", gap: 28, fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-ui)" }}>
              <span style={{ cursor: "pointer" }}>How it works</span>
              <span style={{ cursor: "pointer" }}>Pricing</span>
              <span style={{ cursor: "pointer" }}>Docs</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {result && (
                <button onClick={() => setView("editor")} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                  Open editor →
                </button>
              )}
            </div>
          </nav>

          <main style={{ flex: 1, position: "relative", zIndex: 5, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {chatDragging && (
              <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(255,255,255,0.03)", border: "2px dashed var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ padding: "12px 20px", background: "var(--ink)", color: "var(--bg)", borderRadius: 12, fontSize: 13, fontWeight: 500 }}>Drop to upload</div>
              </div>
            )}

            {messages.length > 1 ? (
              /* Messages list */
              <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "24px 0", display: "flex", flexDirection: "column", gap: 10, maxWidth: 640, width: "100%", margin: "0 auto", paddingLeft: 16, paddingRight: 16 }}>
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "82%", padding: "9px 13px", fontSize: 13, lineHeight: 1.45,
                        color: msg.role === "user" ? "var(--bg)" : "var(--ink)",
                        background: msg.role === "user" ? "var(--ink)" : "var(--surface-1)",
                        border: msg.role === "user" ? "none" : "1px solid var(--line)",
                        borderRadius: 12,
                        borderBottomRightRadius: msg.role === "user" ? 3 : 12,
                        borderBottomLeftRadius: msg.role === "user" ? 12 : 3,
                      }}>
                        {msg.fileName && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 7px", marginBottom: 5, background: "rgba(255,255,255,0.1)", borderRadius: 5, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "inherit" }}>
                            <Ico.file size={10} /> {msg.fileName}
                          </div>
                        )}
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {processing && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ padding: "9px 13px", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 12, borderBottomLeftRadius: 3, display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 150, 300].map(d => <div key={d} className="animate-bounce" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ink-40)", animationDelay: `${d}ms` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {/* Input for chat state */}
                <div style={{ flexShrink: 0, padding: "12px 16px 20px", maxWidth: 640, width: "100%", margin: "0 auto" }}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    {CHIPS.map(c => (
                      <button key={c.label} onClick={() => setChatInput(prev => prev ? `${prev}, ${c.text}` : c.text)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, color: "var(--ink-60)", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 999, cursor: "pointer" }}>
                        <c.icon size={10} />{c.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(14,15,19,0.7)", backdropFilter: "blur(14px)", border: "1px solid var(--line-strong)", borderRadius: 12 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ color: "var(--ink-60)", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}><Ico.attach size={14} /></button>
                    <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) setChatFile(e.target.files[0]); }} />
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Describe what you want…"
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--ink)", fontFamily: "inherit" }} />
                    <button onClick={() => handleSend()} disabled={processing || (!chatInput.trim() && !chatFile)}
                      style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg)", background: "var(--ink)", border: "none", borderRadius: 7, cursor: "pointer", opacity: (!chatInput.trim() && !chatFile) ? 0.3 : 1 }}>
                      <Ico.send size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Hero — anchored toward the NLE timeline */
              <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "0 24px 192px", gap: 0 }}>

                {/* Headline + subtitle pinned above composer */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <h1 style={{
                    margin: "0 0 16px", fontFamily: "var(--font-display)",
                    fontSize: "clamp(48px, 6vw, 72px)", lineHeight: 1.02, fontWeight: 400,
                    letterSpacing: "-0.035em", color: "var(--text)", whiteSpace: "nowrap",
                  }}>
                    Edit video with just{" "}
                    <span style={{ fontFamily: "var(--font-italic)", fontStyle: "normal", fontWeight: 400, color: "#2450ff", letterSpacing: "-0.02em" }}>words</span>
                    <span style={{ color: "var(--text-faint)" }}>.</span>
                  </h1>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, fontFamily: "var(--font-ui)" }}>
                    A chat-driven video editor. One message — transcribe, reframe, caption, export.
                  </p>
                </div>

                {/* Main composer card */}
                <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Video drop zone — prominent when no file */}
                  {!(chatFile ?? uploadedFile) ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setChatDragging(true); }}
                      onDragLeave={() => setChatDragging(false)}
                      onDrop={e => { e.preventDefault(); setChatDragging(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("video/")) setChatFile(f); }}
                      style={{
                        width: "100%", padding: "28px 24px", cursor: "pointer",
                        background: chatDragging ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                        border: `2px dashed ${chatDragging ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}`,
                        borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                        transition: "all .15s",
                      }}>
                      {/* Upload icon */}
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-ui)" }}>Drop your video here</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-ui)" }}>or click to browse · MP4, MOV, AVI · up to 2 GB</p>
                      </div>
                    </button>
                  ) : (
                    /* File attached strip */
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(36,80,255,0.15)", border: "1px solid rgba(36,80,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Ico.file size={16} style={{ color: "#2450ff" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(chatFile ?? uploadedFile)!.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-ui)" }}>Ready to process</p>
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 11, color: "var(--text-muted)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", flexShrink: 0, fontFamily: "var(--font-ui)" }}>Change</button>
                      {chatFile && <button onClick={() => setChatFile(null)} style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}><Ico.close size={14} /></button>}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) setChatFile(e.target.files[0]); }} />

                  {/* Text prompt composer */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 12px 16px", background: "rgba(14,15,19,0.7)", backdropFilter: "blur(14px)", border: `1px solid ${chatDragging ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, transition: "border-color .15s" }}>
                    <textarea ref={textareaRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder={placeholder} rows={1}
                      style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 13, lineHeight: 1.4, color: "var(--text)", padding: "5px 0", fontFamily: "var(--font-ui)" }} />
                    <button onClick={() => handleSend()} disabled={processing || (!chatInput.trim() && !(chatFile ?? uploadedFile))}
                      style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0b0d", background: "#fff", border: "none", borderRadius: 9, cursor: "pointer", flexShrink: 0, opacity: (!chatInput.trim() && !(chatFile ?? uploadedFile)) ? 0.25 : 1, transition: "opacity .15s" }}>
                      <Ico.send size={12} />
                    </button>
                  </div>

                  {/* Chips */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    {CHIPS.map(c => (
                      <button key={c.label} onClick={() => setChatInput(prev => prev ? `${prev}, ${c.text}` : c.text)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", fontSize: 11, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                        <c.icon size={10} />{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA row */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20 }}>
                  <button onClick={runDemo} disabled={processing && !demoRunning} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 12, fontWeight: 500, color: demoRunning ? "rgba(255,255,255,0.7)" : "#0a0b0d", background: demoRunning ? "transparent" : "#fff", border: demoRunning ? "1px solid rgba(255,255,255,0.2)" : "none", borderRadius: 8, cursor: (processing && !demoRunning) ? "not-allowed" : "pointer", fontFamily: "var(--font-ui)" }}>
                    {demoRunning ? <><Ico.close size={10} /> Cancel demo</> : <><Ico.play size={10} /> Try it yourself — one click</>}
                  </button>
                  {result && (
                    <button onClick={() => setView("editor")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                      Open editor <Ico.arrow size={10} />
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", marginTop: 16 }}>
                  <span>MP4 · MOV · AVI</span><span>·</span><span>WHISPER · GPT-4o</span><span>·</span><span>FFMPEG · REMOTION</span>
                </div>
              </div>
            )}

            {/* NLE timeline (hero only) */}
            {messages.length === 1 && <LandingNLETimeline />}

            {/* Demo overlay */}
            {demoStep >= 0 && <DemoOverlay step={demoStep} onClose={cancelDemo} />}
          </main>
        </div>
      )}

      {/* ── EDITOR VIEW ── */}
      {view === "editor" && result && activeClip && (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ position: "relative" }}>

          {/* Editor nav */}
          <nav style={{
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px", height: 48, borderBottom: "1px solid var(--line)", background: "var(--bg)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setView("chat")} style={{ ...iconBtnStyle(false), gap: 5, paddingLeft: 8, paddingRight: 8, width: "auto" }}>
                <Ico.back size={12} /> Back
              </button>
              <div style={{ width: 1, height: 16, background: "var(--line)" }} />
              <Logo />
              {uploadedFile && (
                <span style={{ fontSize: 12, color: "var(--ink-40)", fontFamily: "ui-monospace, monospace" }}>
                  / {uploadedFile.name.replace(/\.[^.]+$/, "")}
                </span>
              )}
            </div>

            <PipelineRail currentStep={pipelineStep} />

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setShowChat(v => !v)} style={iconBtnStyle(showChat)} title="Toggle chat">
                <Ico.panelL size={14} />
              </button>
              <button onClick={() => setShowProps(v => !v)} style={iconBtnStyle(showProps)} title="Toggle properties">
                <Ico.panelR size={14} />
              </button>
              <div style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
              <button onClick={handleExport} disabled={exporting} style={{
                padding: "7px 12px", fontSize: 12, fontWeight: 500,
                color: "var(--bg)", background: "var(--ink)",
                border: "none", borderRadius: 7, cursor: exporting ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                opacity: exporting ? 0.6 : 1,
              }}>
                <Ico.download size={12} /> {exporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </nav>

          {/* Main row */}
          <div className="flex-1 flex overflow-hidden">

            {/* Left — chat panel */}
            {showChat && (
              <div style={{ width: chatPanelWidth, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg)", borderRight: "1px solid var(--line)", position: "relative" }}>
                <div onMouseDown={onChatPanelDrag} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--line)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")} />

                <div style={{ flexShrink: 0, padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-40)", fontWeight: 600 }}>Session</span>
                  </div>
                  <button onClick={handleStartFresh} style={{ fontSize: 11, color: "var(--ink-60)", background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Ico.plus size={11} /> New
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "88%", padding: "7px 10px", fontSize: 12, lineHeight: 1.45,
                        color: msg.role === "user" ? "var(--bg)" : "var(--ink)",
                        background: msg.role === "user" ? "var(--ink)" : "var(--surface-1)",
                        border: msg.role === "user" ? "none" : "1px solid var(--line)",
                        borderRadius: 9, borderBottomRightRadius: msg.role === "user" ? 2 : 9, borderBottomLeftRadius: msg.role === "user" ? 9 : 2,
                      }}>
                        {msg.fileName && <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 4, fontFamily: "ui-monospace, monospace", fontSize: 10.5, opacity: 0.7 }}><Ico.file size={9} />{msg.fileName}</div>}
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {processing && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ padding: "7px 10px", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 9, borderBottomLeftRadius: 2, display: "flex", gap: 3, alignItems: "center" }}>
                        {[0, 150, 300].map(d => <div key={d} className="animate-bounce" style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ink-40)", animationDelay: `${d}ms` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div style={{ flexShrink: 0, padding: "8px 12px 12px", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {CHIPS.slice(0, 4).map(c => (
                      <button key={c.label} onClick={() => setChatInput(prev => prev ? `${prev}, ${c.text}` : c.text)}
                        style={{ fontSize: 10, padding: "3px 8px", color: "var(--ink-60)", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 999, cursor: "pointer" }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  {chatFile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", marginBottom: 6, background: "var(--surface-1)", borderRadius: 7, fontSize: 10.5, fontFamily: "ui-monospace, monospace" }}>
                      <Ico.file size={10} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chatFile.name}</span>
                      <button onClick={() => setChatFile(null)} style={{ color: "var(--ink-40)", background: "transparent", border: "none", cursor: "pointer" }}><Ico.close size={10} /></button>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: 9 }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ color: "var(--ink-40)", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}><Ico.attach size={12} /></button>
                    <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) setChatFile(e.target.files[0]); }} />
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Edit this clip…"
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--ink)", fontFamily: "inherit", minWidth: 0 }} />
                    <button onClick={() => handleSend()} disabled={processing || (!chatInput.trim() && !chatFile)}
                      style={{ width: 24, height: 24, borderRadius: 6, background: "var(--ink)", color: "var(--bg)", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: (!chatInput.trim() && !chatFile) ? 0.3 : 1 }}>
                      <Ico.send size={9} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Center — stage */}
            <section style={{
              flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
              background: "var(--canvas)",
              backgroundImage: "radial-gradient(circle, rgba(23,23,23,0.10) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}>
              {/* Stage toolbar */}
              <div style={{
                flexShrink: 0, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--bg)", borderBottom: "1px solid var(--line)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {result.mode === "multi" && (
                    <div style={{ display: "flex", gap: 0, padding: 2, background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 8 }}>
                      {result.clips?.map((_, i) => (
                        <button key={i} onClick={() => { setSelectedClip(i); setEditedSubtitles(null); setSelectedSub(null); }}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: selectedClip === i ? 600 : 500,
                            color: selectedClip === i ? "var(--ink)" : "var(--ink-60)",
                            background: selectedClip === i ? "var(--bg)" : "transparent",
                            border: selectedClip === i ? "1px solid var(--line)" : "1px solid transparent",
                            borderRadius: 6, cursor: "pointer",
                          }}>
                          Clip {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  <SegmentedControl value={style.aspectRatio} onChange={v => setStyle(s => ({ ...s, aspectRatio: v }))} items={ASPECT_RATIOS} />
                  <div style={{ width: 1, height: 16, background: "var(--line)" }} />
                  <span style={{ fontSize: 11, color: "var(--ink-40)", fontFamily: "ui-monospace, monospace" }}>
                    {style.aspectRatio === "9/16" ? "1080 × 1920" : style.aspectRatio === "16/9" ? "1920 × 1080" : style.aspectRatio === "1/1" ? "1080 × 1080" : "original"}
                  </span>
                </div>
              </div>

              {/* Video */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 24, minHeight: 0 }}>
                <div style={{
                  position: "relative", width: "100%",
                  maxWidth: style.aspectRatio === "9/16" ? 300 : style.aspectRatio === "4/5" ? 380 : style.aspectRatio === "1/1" ? 500 : 760,
                }}>
                  {segments.filter(s => s.track === "video").map(seg => (
                    <div key={seg.id} style={{ display: seg.id === activeVideoSegId ? "block" : "none" }}>
                      <VideoPlayer videoUrl={seg.sourceUrl} subtitles={seg.id === activeVideoSegId ? displaySubtitles : []} style={style} onVideoMount={el => handleSegmentMount(seg.id, el)} />
                    </div>
                  ))}
                  {segments.filter(s => s.track === "video").length === 0 && activeClip && (
                    <VideoPlayer key={activeClip.video_url} videoUrl={toUrl(activeClip.video_url)} subtitles={displaySubtitles} style={style} onVideoMount={el => handleSegmentMount("legacy", el)} />
                  )}
                </div>
              </div>

              {/* Transport */}
              <div style={{
                flexShrink: 0, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10,
                background: "var(--bg)", borderTop: "1px solid var(--line)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={handlePrevSub} style={iconBtnStyle(false)}><Ico.prev size={12} /></button>
                  <button onClick={handlePlayPause} style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--ink)", color: "var(--bg)", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {isPlaying ? <Ico.pause size={11} /> : <Ico.play size={11} />}
                  </button>
                  <button onClick={handleNextSub} style={iconBtnStyle(false)}><Ico.next size={12} /></button>
                </div>
                <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "var(--ink)", minWidth: 80 }}>
                  {formatTime(currentTime)} <span style={{ color: "var(--ink-40)" }}>/ {formatTime(duration)}</span>
                </span>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <Ico.zoomOut size={12} style={{ color: "var(--ink-40)" }} />
                  {/* Zoom slider with visible track */}
                  <div style={{ position: "relative", width: 80, height: 16, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
                    <div style={{ position: "absolute", left: 0, width: `${(zoomPct - 5) / 95 * 100}%`, height: 2, background: "rgba(255,255,255,0.55)", borderRadius: 1, pointerEvents: "none" }} />
                    <input type="range" min={5} max={100} value={zoomPct} onChange={e => setZoomPct(Number(e.target.value))}
                      style={{ position: "relative", width: "100%", margin: 0, cursor: "pointer" }} />
                  </div>
                  <Ico.zoomIn size={12} style={{ color: "var(--ink-40)" }} />
                  <span style={{ fontSize: 11, color: "var(--ink-40)", fontFamily: "ui-monospace, monospace", minWidth: 28 }}>{zoomPct}%</span>
                </div>
              </div>
            </section>

            {/* Right — properties */}
            {showProps && (
              <aside style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg)", borderLeft: "1px solid var(--line)", minHeight: 0 }}>
                <div style={{ flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "flex", gap: 0 }}>
                  {["Subtitles", "Motion", "Audio"].map(tab => (
                    <button key={tab} style={{
                      padding: "10px 10px", fontSize: 12, fontWeight: 500,
                      color: tab === "Subtitles" ? "var(--ink)" : "var(--ink-40)",
                      background: "transparent", border: "none", cursor: "pointer",
                      borderBottom: tab === "Subtitles" ? "2px solid var(--ink)" : "2px solid transparent",
                      marginBottom: -1,
                    }}>{tab}</button>
                  ))}
                </div>

                {/* Inline caption editor — shown at top of panel when a sub is selected */}
                {selectedSub !== null && displaySubtitles[selectedSub] && (
                  <SubtitleEditor
                    key={selectedSub}
                    sub={displaySubtitles[selectedSub]}
                    index={selectedSub}
                    total={displaySubtitles.length}
                    onPrev={() => setSelectedSub(i => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setSelectedSub(i => Math.min(displaySubtitles.length - 1, (i ?? 0) + 1))}
                    onClose={() => setSelectedSub(null)}
                    onSave={(text: string) => {
                      const updated = [...displaySubtitles];
                      updated[selectedSub] = { ...updated[selectedSub], text };
                      setEditedSubtitles(updated);
                    }}
                  />
                )}

                <div style={{ flex: 1, overflowY: "auto" }}>
                  <StylePanel style={style} onChange={setStyle} onExport={handleExport} exporting={exporting} />
                </div>
              </aside>
            )}
          </div>

          {/* Timeline */}
          {(() => {
            const PX_PER_SEC = 10 + (zoomPct / 100) * 150;
            const RULER_H = 22;
            const V_H = 32;
            const AUDIO_H = 38;
            const SUB_H = Math.max(timelineHeight - RULER_H - V_H - AUDIO_H, 28);
            const subOffset = clipSeg?.timelineStart ?? 0;
            const totalDuration = Math.max(
              ...segments.map(s => s.timelineStart + s.duration),
              (displaySubtitles[displaySubtitles.length - 1]?.end ?? 0) + subOffset, 1
            );
            const totalWidth = Math.max(totalDuration * PX_PER_SEC + 80, 600);
            const tickStep = PX_PER_SEC >= 80 ? 1 : PX_PER_SEC >= 40 ? 2 : PX_PER_SEC >= 20 ? 5 : 10;
            const ticks: number[] = [];
            for (let t = 0; t <= totalDuration + tickStep; t += tickStep) ticks.push(parseFloat(t.toFixed(1)));
            const LABEL_W = 44;

            return (
              <div style={{ flexShrink: 0, background: "var(--bg)", borderTop: "1px solid var(--line)", height: timelineHeight, display: "flex", flexDirection: "column", position: "relative" }}>
                <div onMouseDown={onTimelineDrag} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, cursor: "row-resize", zIndex: 5 }} />

                {/* Timeline header */}
                <div style={{ flexShrink: 0, padding: "4px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", height: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-40)", fontWeight: 600 }}>Timeline</span>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--ink-60)" }}>{segments.length} clip{segments.length !== 1 ? "s" : ""} · {displaySubtitles.length} captions</span>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                  {/* Track labels */}
                  <div style={{ flexShrink: 0, width: LABEL_W, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", fontSize: 9, color: "var(--ink-40)", fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <div style={{ height: RULER_H }} />
                    <div style={{ height: V_H, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--line)" }}>V1</div>
                    <div style={{ height: AUDIO_H, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--line)" }}>A1</div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>Sub</div>
                  </div>

                  {/* Scrollable content */}
                  <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
                    <div style={{ position: "relative", height: "100%", width: totalWidth }}>

                      {/* Playhead */}
                      <div style={{ position: "absolute", top: 0, bottom: 0, width: 1, background: "var(--accent)", zIndex: 20, pointerEvents: "none", left: currentTime * PX_PER_SEC + 12 }}>
                        <div style={{ position: "absolute", top: -2, left: -5, width: 11, height: 8, background: "var(--accent)", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
                      </div>

                      {/* Ruler */}
                      <div style={{ height: RULER_H, borderBottom: "1px solid var(--line)", cursor: "pointer", position: "relative", background: "var(--surface-1)" }}
                        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seekToTime(Math.max(0, (e.clientX - rect.left - 12) / PX_PER_SEC)); }}>
                        {ticks.map(t => (
                          <div key={t} style={{ position: "absolute", left: t * PX_PER_SEC + 12, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                            <div style={{ width: 1, height: t % (tickStep * 5) === 0 ? 8 : 4, background: "var(--ink-40)" }} />
                            {t % (tickStep * 5) === 0 && <span style={{ fontSize: 9, color: "var(--ink-40)", marginLeft: 3, fontFamily: "ui-monospace, monospace" }}>{formatTime(t)}</span>}
                          </div>
                        ))}
                      </div>

                      {/* V1 track — filmstrip + clip segments */}
                      <div style={{ height: V_H, borderBottom: "1px solid var(--line)", position: "relative", cursor: "pointer" }}
                        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seekToTime(Math.max(0, (e.clientX - rect.left - 12) / PX_PER_SEC)); }}>
                        {/* Filmstrip background for clip segments */}
                        {segments.filter(s => s.track === "video" && s.type === "clip").map(seg => (
                          <div key={`film-${seg.id}`} style={{
                            position: "absolute", left: seg.timelineStart * PX_PER_SEC + 12, width: Math.max(seg.duration * PX_PER_SEC - 2, 20), top: 4, bottom: 4,
                            display: "flex", overflow: "hidden", borderRadius: 3, gap: 1,
                          }}>
                            {Array.from({ length: Math.max(1, Math.floor(Math.max(seg.duration * PX_PER_SEC, 20) / 30)) }, (_, i) => (
                              <div key={i} style={{ flex: 1, minWidth: 28, background: `linear-gradient(135deg, oklch(${0.25 + (i % 3) * 0.04} 0.02 ${220 + i * 9}), oklch(${0.18 + (i % 2) * 0.03} 0.02 ${200 + i * 12}))` }} />
                            ))}
                          </div>
                        ))}
                        {segments.filter(s => s.track === "video").map(seg => (
                          <div key={seg.id}
                            onClick={e => { e.stopPropagation(); setSelectedSegmentId(seg.id); if (seg.id !== activeVideoSegId) { const el = videoRefs.current.get(seg.id); if (el) el.currentTime = 0; setActiveVideoSegId(seg.id); } }}
                            onMouseDown={e => startSegmentDrag(seg, e, PX_PER_SEC)}
                            style={{
                              position: "absolute", left: seg.timelineStart * PX_PER_SEC + 12, width: Math.max(seg.duration * PX_PER_SEC - 2, 20), top: 4, bottom: 4,
                              borderRadius: 3, paddingLeft: 6, display: "flex", alignItems: "center",
                              fontSize: 10, fontWeight: 500, color: seg.type === "clip" ? "rgba(255,255,255,0.7)" : "var(--ink)",
                              background: seg.type === "animation" ? (seg.label === "Intro" ? "rgba(59,130,246,0.15)" : seg.label === "Outro" ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)") : "transparent",
                              border: seg.type === "animation" ? `1px solid ${selectedSegmentId === seg.id ? "var(--accent)" : "rgba(59,130,246,0.3)"}` : `1px solid ${selectedSegmentId === seg.id ? "var(--accent)" : "transparent"}`,
                              cursor: seg.type === "animation" ? "ew-resize" : "default",
                              backdropFilter: seg.type === "clip" ? "none" : "none",
                              outline: selectedSegmentId === seg.id ? `2px solid var(--accent)` : "none",
                              outlineOffset: 1,
                            }}>
                            {seg.type === "animation" ? seg.label : ""}
                          </div>
                        ))}
                        {/* Draggable playhead handle */}
                        <div style={{ position: "absolute", top: 0, bottom: 0, width: 12, marginLeft: -6, zIndex: 10, cursor: "ew-resize", left: currentTime * PX_PER_SEC + 12 }}
                          onMouseDown={e => { e.stopPropagation(); const r = e.currentTarget.parentElement!.getBoundingClientRect(); const onMove = (ev: MouseEvent) => seekToTime(Math.max(0, (ev.clientX - r.left - 12) / PX_PER_SEC)); const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }; window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); }} />
                      </div>

                      {/* A1 track — waveform */}
                      <div style={{ height: AUDIO_H, borderBottom: "1px solid var(--line)", position: "relative", padding: "0 12px", cursor: "pointer" }}
                        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seekToTime(Math.max(0, (e.clientX - rect.left - 12) / PX_PER_SEC)); }}>
                        <Waveform currentTime={currentTime} duration={totalDuration} />
                      </div>

                      {/* Subtitle track */}
                      <div style={{ position: "relative", flex: 1, height: SUB_H, cursor: "pointer" }}
                        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seekToTime(Math.max(0, (e.clientX - rect.left - 12) / PX_PER_SEC)); }}>
                        {displaySubtitles.map((sub, i) => {
                          const left = (sub.start + subOffset) * PX_PER_SEC + 12;
                          const width = Math.max((sub.end - sub.start) * PX_PER_SEC - 2, 18);
                          const active = currentTime >= sub.start + subOffset && currentTime < sub.end + subOffset;
                          const selected = selectedSub === i;
                          return (
                            <button key={i} onClick={e => { e.stopPropagation(); setSelectedSub(i); }}
                              style={{
                                position: "absolute", left, width, top: 5, bottom: 5,
                                padding: "0 5px", fontSize: 10.5, fontWeight: 500,
                                color: selected ? "var(--bg)" : active ? "var(--ink)" : "var(--ink-60)",
                                background: selected ? "var(--ink)" : active ? "var(--bg)" : "var(--surface-1)",
                                border: `1px solid ${selected ? "var(--ink)" : active ? "var(--accent)" : "var(--line)"}`,
                                borderRadius: 4, textAlign: "left", overflow: "hidden",
                                whiteSpace: "nowrap", textOverflow: "ellipsis", cursor: "pointer",
                              }}
                              title={sub.text}>
                              {sub.text}
                            </button>
                          );
                        })}
                      </div>
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
