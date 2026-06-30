import sys
import os
import time

RESOLVE_SCRIPT_PATH = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"

def ok(msg):   print(f"✓ {msg}")
def step(msg): print(f"  {msg}")
def fail(msg):
    print(f"✗ {msg}")
    sys.exit(1)


# ── 1. Connect ────────────────────────────────────────────────────────────────
print("\n── Connecting to DaVinci Resolve 20 ──")
if RESOLVE_SCRIPT_PATH not in sys.path:
    sys.path.append(RESOLVE_SCRIPT_PATH)

try:
    import DaVinciResolveScript as dvr
except ImportError:
    fail("Could not import DaVinciResolveScript. Is Resolve 20 open?\n"
         "  Preferences → General → External scripting using = Local")

resolve = dvr.scriptapp("Resolve")
if not resolve:
    fail("Resolve is not running or scripting is disabled.")
ok(f"Connected: {resolve.GetVersionString()}")


# ── 2. Use current open project ───────────────────────────────────────────────
print("\n── Using current project ──")
project = resolve.GetProjectManager().GetCurrentProject()
if not project:
    fail("No project is open in Resolve. Open one first.")
ok(f"Project: {project.GetName()}")


# ── 3. Use current timeline (or create one) ───────────────────────────────────
print("\n── Using current timeline ──")
timeline = project.GetCurrentTimeline()
if not timeline:
    step("No active timeline — creating one from media pool...")
    media_pool = project.GetMediaPool()
    clips = media_pool.GetRootFolder().GetClipList()
    mp4_clips = [c for c in clips if c.GetClipProperty("Type") == "Video"]
    if not mp4_clips:
        step("Media pool empty — importing from temp/clips_out...")
        import glob
        mp4s = sorted(glob.glob(os.path.join(os.path.abspath("temp/clips_out"), "*.mp4")), key=os.path.getmtime, reverse=True)
        if not mp4s:
            fail("No clips in temp/clips_out either. Process a video first.")
        imported = media_pool.ImportMedia([mp4s[0]])
        if not imported:
            fail(f"ImportMedia failed for {mp4s[0]}")
        mp4_clips = imported
        step(f"Imported: {os.path.basename(mp4s[0])}")
    timeline = media_pool.CreateTimelineFromClips("FusionTestTimeline", [mp4_clips[0]])
    if not timeline:
        fail("Could not create timeline.")
    project.SetCurrentTimeline(timeline)
    step(f"Created timeline from: {mp4_clips[0].GetName()}")
ok(f"Timeline: {timeline.GetName()} ({timeline.GetEndFrame() - timeline.GetStartFrame()} frames)")


# ── 4. Get first video clip ───────────────────────────────────────────────────
print("\n── Getting first video clip ──")
clips = timeline.GetItemListInTrack("video", 1)
if not clips:
    fail("No clips on video track 1.")
clip_item = clips[0]
ok(f"Clip: {clip_item.GetName()}")


# ── 5. Add Fusion comp ────────────────────────────────────────────────────────
print("\n── Opening Fusion page ──")
resolve.OpenPage("fusion")
time.sleep(1)

comp = clip_item.AddFusionComp()
if not comp:
    fail("AddFusionComp() failed. Try clicking the clip in Resolve first.")
ok("Fusion comp created")


# ── 6. Build animation via Lua (Fusion's native language) ────────────────────
print("\n── Building lower third via Lua ──")

total_frames = clip_item.GetDuration()
step(f"Clip: {total_frames} frames")

lua_script = """
local mediaOut = comp:FindTool("MediaOut1")

local bar = comp:AddTool("Background")
bar.TopLeftRed   = 0.05
bar.TopLeftGreen = 0.05
bar.TopLeftBlue  = 0.85
bar.TopLeftAlpha = 1.0

local txt = comp:AddTool("TextPlus")
txt.StyledText = "RISHABH"
txt.Size = 0.06

local barMerge = comp:AddTool("Merge")
barMerge:ConnectInput("Background", bar)
barMerge:ConnectInput("Foreground", txt)

local xf = comp:AddTool("Transform")
xf:ConnectInput("Input", barMerge)
xf.Center[0]   = Point(-0.6, 0.12)
xf.Center[15]  = Point(0.22, 0.12)
xf.Center[105] = Point(0.22, 0.12)
xf.Center[120] = Point(-0.6, 0.12)

local finalMerge = comp:AddTool("Merge")
finalMerge:SetAttrs({TOOLS_Name = "LowerThirdFinalMerge"})
finalMerge:ConnectInput("Foreground", xf)
mediaOut:ConnectInput("Input", finalMerge)

-- Find MediaIn by type (name may vary)
local mediaIn = nil
for _, tool in pairs(comp:GetToolList(false)) do
    if tool:GetAttrs().TOOLS_RegID == "MediaIn" then
        mediaIn = tool
        break
    end
end
if mediaIn then
    finalMerge:ConnectInput("Background", mediaIn)
    print("LUA_OK_WITH_VIDEOIN")
else
    print("LUA_OK_NO_MEDIAIN")
end
"""

result = comp.Execute(lua_script)
step(f"Execute returned: {result}")

# Fallback: try from Python too
tools = comp.GetToolList(False)
media_in = next((t for t in tools.values() if t.GetAttrs().get("TOOLS_RegID") == "MediaIn"), None)
final_merge = comp.FindTool("LowerThirdFinalMerge")
step(f"Python found: MediaIn={media_in}  FinalMerge={final_merge}")
if media_in and final_merge:
    final_merge.ConnectInput("Background", media_in)
    ok("Video connected")


sys.exit(0)

# ── 7. Render ─────────────────────────────────────────────────────────────────
print("\n── Rendering ──")
project.SetCurrentTimeline(timeline)
resolve.OpenPage("deliver")
time.sleep(2)

out_dir  = os.path.expanduser("~/Downloads")
out_name = "fusion_test_out"

presets = project.GetRenderPresetList()
project.LoadRenderPreset("H.264 Master")
project.SetRenderSettings({
    "SelectAllFrames": True,
    "TargetDir":       out_dir,
    "CustomName":      out_name,
    "ExportVideo":     True,
    "ExportAudio":     True,
})

project.DeleteAllRenderJobs()
job_id = project.AddRenderJob()
step(f"AddRenderJob: {job_id!r}")
if not job_id:
    fail("AddRenderJob() failed. Check the Deliver page in Resolve manually.")

project.StartRendering(job_id)
step("Rendering... (polling every 2s)")
while project.IsRenderingInProgress():
    time.sleep(2)
    sys.stdout.write(".")
    sys.stdout.flush()
print()

import glob, time as _time
start = _time.time() - 10
mp4s = [f for f in glob.glob(os.path.join(out_dir, "*.mp4")) if os.path.getmtime(f) > start]
if mp4s:
    ok(f"Done → {sorted(mp4s, key=os.path.getmtime)[-1]}")
else:
    fail(f"No new MP4 found in {out_dir} — check Resolve's Deliver page for the actual output path")

print("\n✓ All done. Check temp/fusion_test_out.mp4\n")
