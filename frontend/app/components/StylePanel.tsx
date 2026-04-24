"use client";
import React from "react";

export interface Subtitle {
  start: number;
  end: number;
  text: string;
  words: { word: string; start: number; end: number }[];
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
  karaoke: boolean;
  karaokeColor: string;
  aspectRatio: string;
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
  karaoke: false,
  karaokeColor: "#ffe600",
  aspectRatio: "original",
};

const FONTS = [
  "Arial", "Impact", "Georgia", "Helvetica", "Courier New", "Verdana",
  "Bebas Neue", "Anton", "Bungee", "Righteous", "Archivo Black", "Black Han Sans",
  "Oswald", "Barlow Condensed",
  "Playfair Display", "DM Serif Display",
  "Permanent Marker",
];

const PRESETS: { name: string; style: Partial<SubStyle> }[] = [
  { name: "Clean",    style: { fontFamily: "Arial", fontSize: 100, color: "#ffffff", outline: true, outlineColor: "#000000", outlineWidth: 6, shadow: false, positionY: 80, karaoke: false } },
  { name: "Karaoke",  style: { fontFamily: "Impact", fontSize: 110, color: "#ffffff", outline: true, outlineColor: "#000000", outlineWidth: 8, shadow: true, positionY: 80, karaoke: true, karaokeColor: "#ffe600" } },
  { name: "Hype",     style: { fontFamily: "Impact", fontSize: 140, color: "#ffffff", outline: true, outlineColor: "#000000", outlineWidth: 14, shadow: true, positionY: 80, karaoke: false } },
  { name: "Minimal",  style: { fontFamily: "Helvetica", fontSize: 90, color: "#ffffff", outline: false, outlineColor: "#000000", outlineWidth: 4, shadow: true, positionY: 80, karaoke: false } },
  { name: "Neon",     style: { fontFamily: "Arial", fontSize: 100, color: "#00f0ff", outline: true, outlineColor: "#003a3f", outlineWidth: 8, shadow: true, positionY: 80, karaoke: false } },
  { name: "Negative", style: { fontFamily: "Arial", fontSize: 100, color: "#000000", outline: true, outlineColor: "#ffffff", outlineWidth: 8, shadow: false, positionY: 80, karaoke: false } },
];

const COLOR_SWATCHES = ["#ffffff", "#ffe600", "#00f0ff", "#ff4d00", "#000000"];

interface Props {
  style: SubStyle;
  onChange: (s: SubStyle) => void;
  onExport: () => void;
  exporting: boolean;
}

function Section({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-40)", fontWeight: 600 }}>{label}</label>
        {right}
      </div>
      {children}
    </div>
  );
}

function Slider({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ position: "relative", height: 16 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 3, marginTop: -1.5, borderRadius: 2, background: "var(--surface-2)" }} />
      <div style={{ position: "absolute", left: 0, width: `${pct}%`, top: "50%", height: 3, marginTop: -1.5, borderRadius: 2, background: "var(--ink)", pointerEvents: "none" }} />
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, cursor: "pointer" }}
      />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 32, height: 18, borderRadius: 999, position: "relative", flexShrink: 0,
      background: on ? "var(--ink)" : "rgba(255,255,255,0.1)",
      border: "none", cursor: "pointer", transition: "background .15s",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: on ? "var(--bg)" : "rgba(255,255,255,0.6)",
        transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,0.4)", display: "block",
      }} />
    </button>
  );
}

export default function StylePanel({ style, onChange, onExport, exporting }: Props) {
  const set = (key: keyof SubStyle, val: SubStyle[keyof SubStyle]) =>
    onChange({ ...style, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 18 }}>

      <Section label="Preset">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
          {PRESETS.map(p => {
            const active = style.color === p.style.color && style.fontFamily === p.style.fontFamily && style.outline === p.style.outline;
            return (
              <button key={p.name} onClick={() => onChange({ ...style, ...p.style })}
                style={{
                  padding: "7px 6px", fontSize: 11, fontWeight: 500,
                  color: active ? "var(--bg)" : "var(--ink)",
                  background: active ? "var(--ink)" : "var(--surface-1)",
                  border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                  borderRadius: 8, cursor: "pointer",
                }}>
                {p.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Font">
        <div style={{ position: "relative" }}>
          <select value={style.fontFamily} onChange={e => set("fontFamily", e.target.value)}
            style={{
              width: "100%", padding: "8px 28px 8px 10px", fontSize: 12,
              background: "var(--surface-1)", color: "var(--ink)",
              border: "1px solid var(--line)", borderRadius: 8,
              appearance: "none", cursor: "pointer", outline: "none",
            }}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-40)", display: "flex" }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
      </Section>

      <Section label="Size" right={<span style={{ fontSize: 11, color: "var(--ink)", fontFamily: "ui-monospace, monospace" }}>{style.fontSize}</span>}>
        <Slider min={40} max={160} value={style.fontSize} onChange={v => set("fontSize", v)} />
      </Section>

      <Section label="Text Color">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {COLOR_SWATCHES.map(c => (
            <button key={c} onClick={() => set("color", c)}
              style={{
                width: 22, height: 22, borderRadius: 6,
                background: c, cursor: "pointer",
                border: style.color === c ? "2px solid var(--ink)" : "1px solid var(--line)",
              }} />
          ))}
          <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--ink-60)", cursor: "pointer" }}>
            <input type="color" value={style.color} onChange={e => set("color", e.target.value)}
              style={{ width: 20, height: 20, border: "1px solid var(--line)", borderRadius: 5, background: style.color, cursor: "pointer", padding: 0 }} />
            {style.color.toUpperCase()}
          </label>
        </div>
      </Section>

      <Section label="Outline">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Toggle on={style.outline} onClick={() => set("outline", !style.outline)} />
          {style.outline && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--ink-60)", cursor: "pointer" }}>
              <input type="color" value={style.outlineColor} onChange={e => set("outlineColor", e.target.value)}
                style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", padding: 0 }} />
              {style.outlineColor.toUpperCase()}
            </label>
          )}
          {style.outline && (
            <div style={{ flex: 1 }}>
              <Slider min={1} max={20} value={style.outlineWidth} onChange={v => set("outlineWidth", v)} />
            </div>
          )}
          {style.outline && (
            <span style={{ fontSize: 10, color: "var(--ink-40)", fontFamily: "ui-monospace, monospace", minWidth: 14 }}>{style.outlineWidth}</span>
          )}
        </div>
      </Section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-40)", fontWeight: 600 }}>Shadow</label>
        <Toggle on={style.shadow} onClick={() => set("shadow", !style.shadow)} />
      </div>

      <Section label="Karaoke Highlight">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Toggle on={style.karaoke} onClick={() => set("karaoke", !style.karaoke)} />
          {style.karaoke && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--ink-60)", cursor: "pointer" }}>
              <input type="color" value={style.karaokeColor} onChange={e => set("karaokeColor", e.target.value)}
                style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", padding: 0 }} />
              {style.karaokeColor.toUpperCase()}
            </label>
          )}
        </div>
      </Section>

      <Section label="Vertical Position" right={<span style={{ fontSize: 11, color: "var(--ink)", fontFamily: "ui-monospace, monospace" }}>{style.positionY}%</span>}>
        <Slider min={10} max={92} value={style.positionY} onChange={v => set("positionY", v)} />
      </Section>

      <div style={{ height: 1, background: "var(--line)", margin: "2px 0" }} />

      <div>
        <button onClick={onExport} disabled={exporting}
          style={{
            width: "100%", padding: "11px 12px", fontSize: 13, fontWeight: 600,
            color: "var(--bg)", background: "var(--ink)",
            border: "none", borderRadius: 10, cursor: exporting ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: exporting ? 0.5 : 1, transition: "opacity .15s",
          }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {exporting ? "Exporting…" : "Export Clip"}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-40)", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>
          <span>H.264 · MP4</span>
          <span>original quality</span>
        </div>
      </div>
    </div>
  );
}
