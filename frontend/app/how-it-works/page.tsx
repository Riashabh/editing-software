"use client";
import { useState } from "react";
import Link from "next/link";

// ── Inline SVG logos for tech stack ──────────────────────────────────────────
const LOGOS: Record<string, React.ReactNode> = {
  react: (
    <svg viewBox="-11.5 -10.232 23 20.463" width="18" height="18">
      <circle r="2.05" fill="#61DAFB"/>
      <g stroke="#61DAFB" strokeWidth="1" fill="none">
        <ellipse rx="11" ry="4.2"/>
        <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
        <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
      </g>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.05 14.518A4.501 4.501 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387 2.019-1.168a.076.076 0 0 1 .071 0l4.764 2.752a4.502 4.502 0 0 1-.676 8.105v-5.678a.786.786 0 0 0-.345-.624zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.765-2.752a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  groq: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect width="24" height="24" rx="5" fill="#F55036"/>
      <text x="4" y="17" fontSize="11" fontWeight="800" fill="white" fontFamily="monospace">G</text>
    </svg>
  ),
  ffmpeg: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <rect width="24" height="24" rx="4" fill="#007808"/>
      <text x="3" y="16" fontSize="8" fontWeight="700" fill="white" fontFamily="monospace">FF</text>
    </svg>
  ),
  remotion: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect width="24" height="24" rx="4" fill="#0B84F3"/>
      <polygon points="9,6 19,12 9,18" fill="white"/>
    </svg>
  ),
  docker: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#2496ED">
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.186v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
    </svg>
  ),
  fastapi: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#009688">
      <path d="M12 0C5.376 0 0 5.376 0 12c0 6.624 5.376 12 12 12 6.624 0 12-5.376 12-12C24 5.376 18.624 0 12 0zm-.624 21.552v-7.44H7.08L13.08 2.448v7.44h4.296z"/>
    </svg>
  ),
  python: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.963 3.403 5.963h2.031v-2.868s-.109-3.402 3.35-3.402h5.762s3.239.052 3.239-3.13V3.13S18.28 0 11.914 0zm-3.2 1.814a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1z" fill="#3776AB"/>
      <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752h-5.814v-.826h8.121S24 18.211 24 12.031c0-6.18-3.403-5.963-3.403-5.963h-2.031v2.868s.109 3.402-3.35 3.402H9.454s-3.239-.052-3.239 3.13v5.402S5.72 24 12.086 24zm3.2-1.814a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z" fill="#FFD43B"/>
    </svg>
  ),
  nextjs: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
      <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.859 8.292 8.208 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z"/>
    </svg>
  ),
  typescript: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <rect width="24" height="24" rx="2" fill="#3178C6"/>
      <path d="M13.3 12.6h2.3v-.7h-5.4v.7h2.2V19H13.3V12.6zm3.5-.7v.7c.5-.1 1-.1 1.5-.1.8 0 1.4.4 1.4 1.1 0 .6-.3 1-1.2 1.7l-.7.5c-1.1.8-1.5 1.5-1.5 2.6V19h4.2v-.7h-3.4c0-.8.3-1.3 1.2-1.9l.7-.5c1.1-.8 1.6-1.5 1.6-2.5 0-1.2-.8-1.8-2.2-1.8-.6 0-1.1.1-1.6.3z" fill="white"/>
    </svg>
  ),
  opencv: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect width="24" height="24" rx="4" fill="#5C3EE8"/>
      <text x="4" y="16" fontSize="9" fontWeight="700" fill="white" fontFamily="monospace">CV</text>
    </svg>
  ),
  whisper: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
      <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.859 8.292 8.208 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0z"/>
    </svg>
  ),
};

const TECH_TAGS = [
  "React", "TypeScript", "Next.js", "FastAPI", "Python",
  "Whisper / Groq", "GPT-4o", "FFmpeg", "Remotion", "Docker",
];

interface PipelineStep {
  n: string;
  title: string;
  desc: string;
  tag: string;
  logo: React.ReactNode;
  detail: {
    what: string;
    how: string;
    why: string;
    tradeoff: string;
    techBadges: { label: string; logo?: React.ReactNode }[];
  };
}

const PIPELINE: PipelineStep[] = [
  {
    n: "01",
    title: "Upload",
    desc: "Drop in a video and say what you want. That one message becomes the starting point for the whole pipeline.",
    tag: "multipart/form-data",
    logo: LOGOS.react,
    detail: {
      what: `The user drops a video into the chat and types something like "find the best moment and add captions." That plain sentence is all the system needs to kick off the entire editing workflow.`,
      how: "The frontend sends the video as multipart/form-data to POST /process alongside a randomly generated job_id (e.g. abc123). The backend writes the file to temp/abc123_input.mp4 on disk. The text message goes separately to POST /parse-intent in parallel.",
      why: "Separating the file upload from intent parsing lets the backend start handling the file while GPT is still reading the prompt. The job_id ties every intermediate file together so each downstream step knows exactly where to read from and write to.",
      tradeoff: "Files are stored locally on the server by default. That is fast for development but means concurrent users share the same disk. Cloudflare R2 is wired in as an optional layer when you need proper production storage.",
      techBadges: [
        { label: "React 19", logo: LOGOS.react },
        { label: "Next.js 15", logo: LOGOS.nextjs },
        { label: "TypeScript", logo: LOGOS.typescript },
        { label: "FastAPI", logo: LOGOS.fastapi },
      ],
    },
  },
  {
    n: "02",
    title: "Intent parsing",
    desc: "This is where messy human language gets turned into a clean list of steps the system can actually execute.",
    tag: "POST /parse-intent",
    logo: LOGOS.openai,
    detail: {
      what: "The user's message gets converted into a structured sequence of editing actions: find_best_moments, crop, add_subtitles, animate, export. The system figures out what you meant and in what order.",
      how: "The message hits POST /parse-intent with context about the current editor state (has the user already cropped? are there subtitles?). GPT-4o-mini returns a JSON array like [{\"action\":\"find_best_moments\",\"count\":1},{\"action\":\"crop\",\"aspectRatio\":\"9/16\"}]. The frontend loops through that array and fires the right endpoint for each step.",
      why: `This design makes the whole system composable. Adding a new capability just means adding a new action type. Nothing else has to change. The intent layer is also context-aware so "add subtitles" does not re-trigger transcription if it already ran.`,
      tradeoff: "Every message costs an LLM call, even simple ones. GPT-4o-mini is cheap but adds 300 to 600ms of latency per interaction. A rule-based fallback for obvious commands like export or undo would be faster but a lot less flexible.",
      techBadges: [
        { label: "GPT-4o-mini", logo: LOGOS.openai },
        { label: "FastAPI", logo: LOGOS.fastapi },
        { label: "Python", logo: LOGOS.python },
      ],
    },
  },
  {
    n: "03",
    title: "Transcription",
    desc: "Once every word has a timestamp, the video becomes searchable, cuttable, and editable through language.",
    tag: "Whisper large-v3-turbo",
    logo: LOGOS.groq,
    detail: {
      what: "Every spoken word in the video gets a precise start and end timestamp. That word-level timing becomes the spine of the whole editor. Clip detection, subtitle generation, and speech-synced animations all depend on it.",
      how: "FFmpeg strips the audio and re-encodes it to mono 16 kHz MP3, which is exactly what Whisper expects. That file gets sent to Groq's hosted Whisper large-v3-turbo model. The response comes back with both sentence-level segments and word-level timing objects: [{word: \"hello\", start: 1.24, end: 1.58}].",
      why: "Groq runs Whisper on custom LPU hardware, making it 10 to 20 times faster than the OpenAI Whisper API. Word-level timestamps rather than just sentence-level ones are what unlock karaoke-style subtitle highlighting and speech-synced animations later on.",
      tradeoff: "Whisper can hallucinate on low-quality audio, background music, or long silences. If the transcript is wrong, everything downstream is wrong too. There is no correction step right now. That is a known gap worth fixing.",
      techBadges: [
        { label: "Whisper v3-turbo", logo: LOGOS.whisper },
        { label: "Groq LPU", logo: LOGOS.groq },
        { label: "FFmpeg", logo: LOGOS.ffmpeg },
        { label: "Python", logo: LOGOS.python },
      ],
    },
  },
  {
    n: "04",
    title: "Semantic segmentation",
    desc: "This was one of the most interesting parts to build. The system finds moments based on meaning, not just silence or scene changes.",
    tag: "POST /process",
    logo: LOGOS.openai,
    detail: {
      what: "The full transcript text gets sent to GPT-4o, which reads it for meaning and identifies the most narratively compelling 30 to 45 second windows. It returns precise cut points with its reasoning.",
      how: "GPT-4o receives the transcript with a system prompt asking it to return [{start: 12.4, end: 47.8, reason: \"Peak moment, speaker describes the breakthrough\"}]. It enforces the 30 to 45 second constraint: clips under 30s get extended for context, clips over 45s get trimmed at a natural pause. Multi-clip mode returns several non-overlapping segments.",
      why: "Keyword matching or silence detection would miss the point entirely. GPT-4o can find narrative arcs, emotional peaks, and quotable moments because it actually understands what is being said. The reasoning field also helps a lot when debugging why it made a particular cut.",
      tradeoff: "GPT-4o costs more than GPT-4o-mini. A 10-minute video might produce 2,000 tokens of transcript, which is affordable per request but adds up at scale. The model also has no sense of what is on screen, only what is said.",
      techBadges: [
        { label: "GPT-4o", logo: LOGOS.openai },
        { label: "FastAPI", logo: LOGOS.fastapi },
        { label: "Python", logo: LOGOS.python },
      ],
    },
  },
  {
    n: "05",
    title: "Video processing",
    desc: "This is where I realized the hard part was not the AI. FFmpeg has to make the edit real.",
    tag: "FFmpeg + OpenCV",
    logo: LOGOS.ffmpeg,
    detail: {
      what: "The raw video gets cut into segments, concatenated, reframed to the target aspect ratio using face detection, and prepped for subtitle burning. No AI here. Just video engineering.",
      how: "Each moment becomes an FFmpeg -ss/-t cut command. Segments get joined using FFmpeg's concat demuxer. For 9:16 reframing, OpenCV's Haar Cascade face detector samples one frame every two seconds to find the average face X position, then FFmpeg crops a 9:16 window centered on that point. Subtitles are generated as SRT from word-level timestamps, converted to ASS format for per-word styling, and burned in using FFmpeg's libass filter.",
      why: "FFmpeg runs everywhere, handles nearly every codec, and costs nothing. OpenCV face detection adds intelligent reframing without needing a cloud vision API call. Together they cover almost every real-world editing operation.",
      tradeoff: "FFmpeg's flag syntax is unforgiving. Variable framerates, unusual codecs, HDR content, and non-square pixels can all silently produce broken output. Face detection also falls back to center-crop when no face is found, which is wrong if the subject is off to one side.",
      techBadges: [
        { label: "FFmpeg", logo: LOGOS.ffmpeg },
        { label: "OpenCV", logo: LOGOS.opencv },
        { label: "libass", logo: LOGOS.ffmpeg },
        { label: "Python", logo: LOGOS.python },
      ],
    },
  },
  {
    n: "06",
    title: "Render & export",
    desc: "Everything the user built in the editor has to line up exactly with what comes out the other end as an MP4.",
    tag: "POST /export",
    logo: LOGOS.remotion,
    detail: {
      what: "Optional motion graphics get generated by AI and rendered to video. The final export composites all timeline segments, video clips, animation overlays, and burned subtitles into one downloadable MP4.",
      how: "For animations: GPT-4o writes a self-contained React component using Remotion primitives (spring, interpolate, AbsoluteFill). That code gets written to Generated.tsx, bundled by webpack, and rendered frame-by-frame using Remotion's headless Chromium renderer. On export: FastAPI receives the full timeline state as a segment array with track assignments and timestamps. It concatenates video segments, overlays FX tracks, applies the final crop, burns subtitles via ASS, and returns an H.264 MP4.",
      why: "Using React components for animation means GPT can generate arbitrary motion graphics with full programmatic control, not just template selection. The dual-track timeline lets animations be repositioned without re-rendering. The subtitle preview on canvas uses the same parameters as the final ASS burn so what you see actually matches the output.",
      tradeoff: "Remotion spins up a headless Chromium instance for each render. That is 1 to 2 GB of RAM just to start the browser, which causes OOM kills on small containers. Current fixes: render at 720p max then upscale, CRF 30, single-threaded x264. Long-term: replace with Hyperframes, HeyGen's HTML-to-video renderer built for exactly this workload.",
      techBadges: [
        { label: "Remotion", logo: LOGOS.remotion },
        { label: "GPT-4o", logo: LOGOS.openai },
        { label: "FFmpeg", logo: LOGOS.ffmpeg },
        { label: "Docker", logo: LOGOS.docker },
        { label: "Node.js" },
      ],
    },
  },
];

const ARCH = [
  {
    layer: "Frontend",
    desc: "This is where the user feels the product: chat, preview, timeline, subtitles, and controls. The challenge was making AI automation still feel editable and personal, not like a black box.",
    tags: ["React 19", "Next.js 15", "TypeScript", "Canvas API"],
    color: "#2450ff",
  },
  {
    layer: "Backend orchestration",
    desc: "The backend acts like the conductor. It figures out which step runs next, keeps track of files, calls the AI models, and hands work off to the video tools at the right time.",
    tags: ["FastAPI", "Python 3.11", "OpenAI SDK", "Groq SDK", "Boto3"],
    color: "#6EE7B7",
  },
  {
    layer: "Video workers",
    desc: "This layer does the heavy lifting. FFmpeg and Remotion turn decisions into actual frames, clips, subtitles, and exports. Most of the production pain lived here.",
    tags: ["FFmpeg", "Remotion", "Chromium", "OpenCV", "libx264"],
    color: "#f59e0b",
  },
];

const HARD = [
  {
    title: "Video pipeline reliability",
    body: "I thought the AI would be the hardest part. It wasn't. The hard part was making FFmpeg reliably cut, reframe, concatenate, and burn subtitles across formats, resolutions, codecs, and edge cases I didn't know existed.",
  },
  {
    title: "Timeline state coherence",
    body: "The editor is constantly balancing multiple truths at once: what the user sees in the preview, what the timeline stores, what the backend has processed, and what will actually come out in the export.",
  },
  {
    title: "Preview vs. final render parity",
    body: "The canvas preview has to feel instant. The export has to be accurate. Matching those two worlds, an HTML5 canvas and FFmpeg's ASS subtitle engine, was harder than it looks because they handle text layout differently.",
  },
  {
    title: "Infrastructure constraints",
    body: "Rendering video is expensive. Remotion is powerful, but running Chromium inside a small container taught me a lot about memory limits, OOM kills, and what production deployment actually costs.",
  },
];

export default function HowItWorks() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const expandedStep = expanded !== null ? PIPELINE[expanded] : null;

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .pipeline-grid { flex-direction: column !important; }
          .pipeline-arrow { display: none !important; }
          .arch-grid { flex-direction: column !important; }
          .hard-grid { grid-template-columns: 1fr !important; }
          .hero-title { font-size: 36px !important; }
          .cta-row { flex-direction: column !important; align-items: stretch !important; }
          .cta-row a, .cta-row a button { width: 100% !important; text-align: center !important; }
          .section-inner { padding: 0 20px !important; }
          .modal-inner { padding: 32px 20px !important; flex-direction: column !important; }
          .modal-detail-grid { grid-template-columns: 1fr !important; }
        }
        .pipeline-card {
          cursor: pointer;
          transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .pipeline-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.82);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 0.18s ease;
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .modal-box {
          position: relative;
          background: #0e0f13;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          width: 100%; max-width: 860px;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .modal-box::-webkit-scrollbar { width: 6px; }
        .modal-box::-webkit-scrollbar-track { background: transparent; }
        .modal-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .detail-section { padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.06); }
        .detail-label {
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); font-family: var(--font-mono);
          margin-bottom: 8px;
        }
        .detail-body {
          font-size: 14px; line-height: 1.75; color: rgba(255,255,255,0.7);
        }
      `}</style>

      {/* ── EXPANDED MODAL ──────────────────────────────────────────────── */}
      {expandedStep && (
        <div className="modal-backdrop" onClick={() => setExpanded(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {/* modal header */}
            <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {expandedStep.logo}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.1em", display: "block", marginBottom: 4 }}>
                      Step {expandedStep.n}
                    </span>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.2 }}>
                      {expandedStep.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(null)}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
              {/* tech badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                {expandedStep.detail.techBadges.map((b) => (
                  <span key={b.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)", padding: "4px 10px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }}>
                    {b.logo && <span style={{ display: "flex", alignItems: "center" }}>{b.logo}</span>}
                    {b.label}
                  </span>
                ))}
              </div>
            </div>

            {/* modal body */}
            <div style={{ padding: "0 32px 32px" }}>
              <div className="detail-section" style={{ paddingTop: 24 }}>
                <p className="detail-label">What it does</p>
                <p className="detail-body">{expandedStep.detail.what}</p>
              </div>
              <div className="detail-section">
                <p className="detail-label">How it works</p>
                <p className="detail-body">{expandedStep.detail.how}</p>
              </div>
              <div className="detail-section">
                <p className="detail-label">Why it was designed this way</p>
                <p className="detail-body">{expandedStep.detail.why}</p>
              </div>
              <div className="detail-section">
                <p className="detail-label">Known tradeoff</p>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, marginTop: 1 }}>⚠</span>
                  <p className="detail-body" style={{ color: "rgba(245,158,11,0.85)" }}>{expandedStep.detail.tradeoff}</p>
                </div>
              </div>

              {/* step nav */}
              <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "space-between" }}>
                <button
                  onClick={() => setExpanded(expanded! > 0 ? expanded! - 1 : null)}
                  disabled={expanded === 0}
                  style={{ fontSize: 12, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, background: "transparent", color: expanded === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", cursor: expanded === 0 ? "default" : "pointer", fontFamily: "var(--font-ui)" }}
                >
                  ← Previous step
                </button>
                <button
                  onClick={() => setExpanded(expanded! < PIPELINE.length - 1 ? expanded! + 1 : null)}
                  disabled={expanded === PIPELINE.length - 1}
                  style={{ fontSize: 12, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, background: "transparent", color: expanded === PIPELINE.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", cursor: expanded === PIPELINE.length - 1 ? "default" : "pointer", fontFamily: "var(--font-ui)" }}
                >
                  Next step →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "var(--font-ui)" }}>
        <div className="dot-grid" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
        <div className="vignette" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />

        {/* nav */}
        <nav style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid var(--border)" }}>
          <Link href="/" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text)", textDecoration: "none", fontFamily: "var(--font-ui)" }}>
            Wordcut
          </Link>
          <div style={{ display: "flex", gap: 28, fontSize: 12, color: "var(--text-muted)" }}>
            <Link href="/how-it-works" style={{ color: "var(--text)", textDecoration: "none", fontWeight: 500 }}>How it works</Link>
            <span>Pricing</span>
            <span>Docs</span>
          </div>
          <Link href="/" style={{ fontSize: 12, padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", textDecoration: "none" }}>
            ← Home
          </Link>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 5, padding: "96px 32px 80px", textAlign: "center" }}>
          <div className="section-inner" style={{ maxWidth: 760, margin: "0 auto" }}>
            <p style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 24 }}>
              Technical overview
            </p>
            <h1 className="hero-title" style={{ fontSize: 56, fontWeight: 700, fontFamily: "var(--font-display)", lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.02em" }}>
              How WordCut works
            </h1>
            <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 580, margin: "0 auto 40px" }}>
              WordCut started as one question: how much of video editing can be automated without taking creative control away from the editor?
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {TECH_TAGS.map((t) => (
                <span key={t} style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "4px 10px", border: "1px solid var(--border-strong)", borderRadius: 20, background: "var(--bg-elevated)", color: "var(--accent)", letterSpacing: "0.04em" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── PIPELINE ─────────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 5, padding: "0 32px 96px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <h2 style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8, textAlign: "center" }}>
              The pipeline
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", marginBottom: 40, fontFamily: "var(--font-mono)" }}>
              Click any step to expand
            </p>
            <div className="pipeline-grid" style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
              {PIPELINE.map((step, i) => (
                <div key={step.n} style={{ display: "contents" }}>
                  <div
                    className="pipeline-card"
                    onClick={() => setExpanded(i)}
                    onMouseEnter={() => setHovered(`p-${i}`)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      flex: 1, minWidth: 0, padding: "24px 20px",
                      background: hovered === `p-${i}` ? "rgba(255,255,255,0.05)" : "var(--bg-panel)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      display: "flex", flexDirection: "column", gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.1em" }}>{step.n}</span>
                      <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>{step.logo}</span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{step.title}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0, flex: 1 }}>{step.desc}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", letterSpacing: "0.04em" }}>
                        {step.tag}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>expand →</span>
                    </div>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className="pipeline-arrow" style={{ display: "flex", alignItems: "center", padding: "0 6px", color: "var(--text-faint)", fontSize: 14, flexShrink: 0 }}>
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ARCHITECTURE ─────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 5, padding: "0 32px 96px" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h2 style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 40, textAlign: "center" }}>
              Architecture
            </h2>
            <div className="arch-grid" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ARCH.map((layer, i) => (
                <div key={layer.layer} onMouseEnter={() => setHovered(`a-${i}`)} onMouseLeave={() => setHovered(null)} style={{ display: "flex", alignItems: "flex-start", gap: 24, padding: "24px 28px", background: hovered === `a-${i}` ? "rgba(255,255,255,0.05)" : "var(--bg-elevated)", border: "1px solid var(--border)", borderLeft: `3px solid ${layer.color}`, borderRadius: 12, transition: "background 0.15s" }}>
                  <div style={{ minWidth: 180, flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>{layer.layer}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {layer.tags.map((t) => (
                        <span key={t} style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "rgba(255,255,255,0.03)", color: "var(--text-dim)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>{layer.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHAT WAS HARD ────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 5, padding: "0 32px 96px" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h2 style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8, textAlign: "center" }}>
              What was hard
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", marginBottom: 40, fontFamily: "var(--font-mono)" }}>
              The engineering challenges that aren&apos;t obvious from the outside
            </p>
            <div className="hard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {HARD.map((card, i) => (
                <div key={card.title} onMouseEnter={() => setHovered(`h-${i}`)} onMouseLeave={() => setHovered(null)} style={{ padding: "24px 24px 24px 20px", background: hovered === `h-${i}` ? "rgba(255,255,255,0.05)" : "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderLeft: "3px solid var(--border-strong)", borderRadius: 12, transition: "background 0.15s" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "0 0 10px" }}>{card.title}</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY IT MATTERS ───────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 5, padding: "0 32px 96px", textAlign: "center" }}>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <h2 style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 24 }}>
              Why it matters
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.8, margin: 0 }}>
              WordCut is not about replacing editors. It is about removing the repetitive parts so creators can spend more time on taste, pacing, and story. Building it made me realize that the future of creative tools is not just automation. It is giving people faster ways to stay in control.
            </p>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 5, padding: "0 32px 120px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ width: 1, height: 48, background: "var(--border)", margin: "0 auto 40px" }} />
            <div className="cta-row" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <button style={{ padding: "12px 28px", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                  Try WordCut
                </button>
              </Link>
              <Link href="/" style={{ textDecoration: "none" }}>
                <button style={{ padding: "12px 28px", fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                  ← Back to home
                </button>
              </Link>
              <a href="https://github.com/Riashabh/editing-software" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ padding: "12px 28px", fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                  GitHub ↗
                </button>
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
