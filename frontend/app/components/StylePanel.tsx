"use client";

export interface Subtitle {
  start: number;
  end: number;
  text: string;
}

export interface SubStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  shadow: boolean;
  positionY: number;
}

export const DEFAULT_STYLE: SubStyle = {
  fontFamily: "Arial",
  fontSize: 100,
  color: "#ffffff",
  outline: true,
  outlineColor: "#000000",
  outlineWidth: 8,
  shadow: true,
  positionY: 80,
};

const FONTS = ["Arial", "Impact", "Georgia", "Helvetica", "Courier New", "Verdana", "Trebuchet MS"];

const PRESETS: { name: string; style: Partial<SubStyle> }[] = [
  {
    name: "Clean",
    style: { fontFamily: "Arial", fontSize: 100, color: "#ffffff", outline: true, outlineColor: "#000000", outlineWidth: 6, shadow: false, positionY: 80 },
  },
  {
    name: "Punchy",
    style: { fontFamily: "Impact", fontSize: 110, color: "#ffe600", outline: true, outlineColor: "#000000", outlineWidth: 10, shadow: true, positionY: 80 },
  },
  {
    name: "Neon",
    style: { fontFamily: "Arial", fontSize: 100, color: "#00f0ff", outline: true, outlineColor: "#003a3f", outlineWidth: 8, shadow: true, positionY: 80 },
  },
  {
    name: "Minimal",
    style: { fontFamily: "Helvetica", fontSize: 90, color: "#ffffff", outline: false, outlineColor: "#000000", outlineWidth: 4, shadow: true, positionY: 80 },
  },
  {
    name: "Hype",
    style: { fontFamily: "Impact", fontSize: 140, color: "#ffffff", outline: true, outlineColor: "#000000", outlineWidth: 14, shadow: true, positionY: 80 },
  },
  {
    name: "Negative",
    style: { fontFamily: "Arial", fontSize: 100, color: "#000000", outline: true, outlineColor: "#ffffff", outlineWidth: 8, shadow: false, positionY: 80 },
  },
];

interface Props {
  style: SubStyle;
  onChange: (s: SubStyle) => void;
  onExport: () => void;
  exporting: boolean;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? "bg-black" : "bg-neutral-200"}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function StylePanel({ style, onChange, onExport, exporting }: Props) {
  const set = (key: keyof SubStyle, val: SubStyle[keyof SubStyle]) =>
    onChange({ ...style, [key]: val });

  return (
    <div className="flex flex-col gap-5 h-full">
      <p className="text-xs font-medium text-black">Subtitle Style</p>
      {/* Presets */}
      <div>
        <label className="text-xs text-neutral-400 mb-2 block">Presets</label>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => onChange({ ...style, ...p.style })}
              className="py-2 px-1 text-xs font-medium rounded-xl bg-black/[0.04] hover:bg-black/[0.08] border border-black/5 transition-all text-black"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>


      {/* Font */}
      <div>
        <label className="text-xs text-neutral-400 mb-1.5 block">Font</label>
        <select
          value={style.fontFamily}
          onChange={(e) => set("fontFamily", e.target.value)}
          className="w-full bg-black/[0.04] border border-black/8 rounded-xl px-3 py-2 text-xs text-black outline-none"
        >
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Size */}
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-xs text-neutral-400">Size</label>
          <span className="text-xs text-black font-medium">{style.fontSize}</span>
        </div>
        <input
          type="range" min={40} max={160} value={style.fontSize}
          onChange={(e) => set("fontSize", Number(e.target.value))}
          className="w-full accent-black"
        />
      </div>

      {/* Text color */}
      <div>
        <label className="text-xs text-neutral-400 mb-1.5 block">Text Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color" value={style.color}
            onChange={(e) => set("color", e.target.value)}
            className="w-9 h-9 rounded-lg cursor-pointer border border-black/8"
          />
          <span className="text-xs text-neutral-400 font-mono">{style.color}</span>
        </div>
      </div>

      {/* Outline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-neutral-400">Outline</label>
          <Toggle on={style.outline} onClick={() => set("outline", !style.outline)} />
        </div>
        {style.outline && (
          <div className="flex gap-3 items-center mt-2">
            <input
              type="color" value={style.outlineColor}
              onChange={(e) => set("outlineColor", e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer border border-black/8 flex-shrink-0"
            />
            <input
              type="range" min={1} max={20} value={style.outlineWidth}
              onChange={(e) => set("outlineWidth", Number(e.target.value))}
              className="flex-1 accent-black"
            />
            <span className="text-xs text-neutral-400 w-4">{style.outlineWidth}</span>
          </div>
        )}
      </div>

      {/* Shadow */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-neutral-400">Shadow</label>
        <Toggle on={style.shadow} onClick={() => set("shadow", !style.shadow)} />
      </div>

      {/* Position */}
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-xs text-neutral-400">Vertical Position</label>
          <span className="text-xs text-black font-medium">{style.positionY}%</span>
        </div>
        <input
          type="range" min={10} max={92} value={style.positionY}
          onChange={(e) => set("positionY", Number(e.target.value))}
          className="w-full accent-black"
        />
      </div>

      {/* Export */}
      <button
        onClick={onExport}
        disabled={exporting}
        className="mt-auto w-full py-3 rounded-xl bg-black text-white text-xs font-medium transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
      >
        {exporting ? "Exporting..." : "Export Clip"}
      </button>
    </div>
  );
}
