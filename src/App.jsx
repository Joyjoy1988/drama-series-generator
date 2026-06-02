import { useState, useRef } from "react";

const TOOLS = [
  { id: "flow", label: "Google Flow", sublabel: "Omni Flash", icon: "◈" },
  { id: "dola", label: "Dola", sublabel: "10 sec", icon: "◆" },
  { id: "jimeng", label: "Jimeng", sublabel: "Seedance", icon: "◉" },
];

// ─── PROMPTS ─────────────────────────────────────────────────────────────────

const SERIES_PROMPT = (tool) => `You are an expert AI video prompt writer for TikTok short dramas.
Generate prompts optimized for ${tool === "jimeng" ? "Jimeng/Seedance" : tool === "dola" ? "Dola AI" : "Google Flow/Omni Flash"}.

RULES: NO background music. NO text on screen. NO subtitles. Clean audio. 10 seconds per episode.
${tool === "jimeng" ? "JIMENG: Scene/camera directions in 简体中文. Dialogue in English." : tool === "dola" ? "DOLA: Punchy, fast-cut, bold visual language." : "FLOW: Cinematic, filmic, director-level language."}

Output ONLY this JSON (no markdown, no backticks):
{
  "title": "Series title",
  "genre": "Genre",
  "hook": "One scroll-stopping line",
  "tool": "${tool}",
  "episodes": [
    {
      "episode": 1,
      "title": "Episode title",
      "n4": { "hook": 8, "hold": 8, "emotion": 9, "share": 8, "score": 8.25, "rating": "Winner" },
      "video_prompt": "Full video prompt. Micro-expressions, micro-movements, 4Ps vocal technique, subtext. NO BGM. NO text. 10 seconds.",
      "subtext": "What is not said but felt",
      "cliffhanger": "Hook into next episode"
    }
  ],
  "characters": [
    { "name": "Name", "role": "Role", "arc": "Arc", "conflict": "Internal conflict", "base_look": "Signature look" }
  ]
}

Rules: 5 episodes, each 10 seconds. N4 rating: 9-10=Unicorn, 8-8.9=Winner, 7-7.9=Solid, 6-6.9=Risky, <6=Trash. End every episode with cliffhanger.`;

const LOOKS_PROMPT = (tool) => `You are a costume and visual designer for AI video production.
Generate character looks for ONE character for ONE episode.
${tool === "jimeng" ? "Write all scene/visual descriptions in 简体中文. Keep character name and dialogue in English." : "Write everything in English."}

Output ONLY this JSON (no markdown, no backticks):
{
  "episode_attire": "Detailed outfit — fabric, color, cut, accessories",
  "episode_hairstyle": "Exact hairstyle — length, texture, color, styling",
  "front_view_prompt": "Full body, face forward, neutral expression, arms slightly away from body, full outfit visible, white background, studio lighting, fashion reference sheet style. NO BGM. NO text.",
  "side_view_prompt": "90 degree profile, same outfit and hairstyle, neutral pose, white background. NO BGM. NO text.",
  "back_view_prompt": "Full back visible, same outfit, hairstyle from back, white background. NO BGM. NO text.",
  "closeup_prompt": "Face close-up chin to forehead, neutral expression, soft studio lighting, skin texture visible. NO BGM. NO text."
}`;

const REFSHEET_PROMPT = `You are a character visual designer for AI video production.
Analyze the uploaded photo — face structure, skin tone, eye shape, features.
Output ONLY this JSON (no markdown, no backticks):
{
  "face_description": "Detailed face — bone structure, eye shape/color, nose, lips, skin tone, eyebrows, jawline",
  "signature_features": ["3-5 most distinctive features"],
  "flow_face_anchor": "One paragraph to prepend to ALL video prompts for face consistency.",
  "jimeng_face_anchor": "Same paragraph in 简体中文 for Jimeng prompts"
}`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const ratingColor = (r) => ({ Unicorn:"#FFD700", Winner:"#00FF88", Solid:"#60A5FA", Risky:"#FB923C" }[r] || "#F87171");
const ratingEmoji = (r) => ({ Unicorn:"🦄", Winner:"🏆", Solid:"✅", Risky:"⚠️" }[r] || "🗑️");

const VIEWS = [
  { key:"front_view_prompt", label:"Front",   icon:"◈" },
  { key:"side_view_prompt",  label:"Side",    icon:"◧" },
  { key:"back_view_prompt",  label:"Back",    icon:"◪" },
  { key:"closeup_prompt",    label:"Close-Up",icon:"◉" },
];

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

async function callAPI(body) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("[api] status:", res.status);
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`API ${res.status}: ${msg}`);
  }
  const text = data.content?.find(b => b.type === "text")?.text || "";
  if (!text) throw new Error("Empty response — no text block returned");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function DramaGenerator() {
  const [tool, setTool]               = useState("flow");
  const [concept, setConcept]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [series, setSeries]           = useState(null);
  const [activeEp, setActiveEp]       = useState(0);
  const [activeTab, setActiveTab]     = useState("prompt");
  const [copied, setCopied]           = useState(null);
  const [error, setError]             = useState("");

  // Character photos + face ref sheets
  const [charImages, setCharImages]   = useState({});
  const [refSheets, setRefSheets]     = useState({});
  const [refLoading, setRefLoading]   = useState({});
  const [activeCharRef, setActiveCharRef] = useState(null);

  // On-demand character looks: keyed "charName::ep1"
  const [charLooks, setCharLooks]     = useState({});
  const [looksLoading, setLooksLoading] = useState({});
  const [activeView, setActiveView]   = useState("front_view_prompt");

  const fileRefs = useRef({});

  // ── Generate series ────────────────────────────────────────────────────────
  const generate = async () => {
    if (!concept.trim()) return;
    setLoading(true); setError(""); setSeries(null); setCharLooks({});
    try {
      const parsed = await callAPI({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SERIES_PROMPT(tool),
        messages: [{ role: "user", content: `Story concept: ${concept}` }],
      });
      setSeries(parsed);
      setActiveEp(0);
      setActiveTab("prompt");
      if (parsed.characters?.length) setActiveCharRef(parsed.characters[0].name);
    } catch (e) {
      console.error("[generate]", e);
      setError(`Generation failed: ${e.message}`);
    }
    setLoading(false);
  };

  // ── Generate looks for one character + episode (on demand) ─────────────────
  const generateLooks = async (charName, epNum) => {
    const key = `${charName}::ep${epNum}`;
    setLooksLoading(prev => ({ ...prev, [key]: true }));
    try {
      const char = series?.characters?.find(c => c.name === charName);
      const ep   = series?.episodes?.find(e => e.episode === epNum);
      const parsed = await callAPI({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: LOOKS_PROMPT(tool),
        messages: [{ role: "user", content:
          `Character: ${charName}. Role: ${char?.role || ""}. Base look: ${char?.base_look || ""}. Episode ${epNum}: "${ep?.title || ""}". Episode context: ${ep?.video_prompt?.slice(0, 200) || ""}` }],
      });
      setCharLooks(prev => ({ ...prev, [key]: parsed }));
    } catch (e) {
      console.error("[looks]", e);
    }
    setLooksLoading(prev => ({ ...prev, [key]: false }));
  };

  // ── Face ref sheet ─────────────────────────────────────────────────────────
  const handleImageUpload = async (charName, file) => {
    if (!file) return;
    const base64 = await toBase64(file);
    const preview = URL.createObjectURL(file);
    setCharImages(prev => ({ ...prev, [charName]: { base64, mediaType: file.type || "image/jpeg", preview } }));
    setRefSheets(prev => { const n = { ...prev }; delete n[charName]; return n; });
  };

  const generateRefSheet = async (charName) => {
    const img = charImages[charName];
    if (!img) return;
    setRefLoading(prev => ({ ...prev, [charName]: true }));
    try {
      const char = series?.characters?.find(c => c.name === charName);
      const parsed = await callAPI({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: REFSHEET_PROMPT,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
          { type: "text", text: `Character: ${charName}. Role: ${char?.role || ""}. Arc: ${char?.arc || ""}.` },
        ]}],
      });
      setRefSheets(prev => ({ ...prev, [charName]: parsed }));
    } catch (e) {
      console.error("[refsheet]", e);
    }
    setRefLoading(prev => ({ ...prev, [charName]: false }));
  };

  const copyPrompt = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const ep          = series?.episodes?.[activeEp];
  const currentTool = TOOLS.find(t => t.id === tool);
  const looksKey    = activeCharRef && ep ? `${activeCharRef}::ep${ep.episode}` : null;
  const look        = looksKey ? charLooks[looksKey] : null;
  const faceAnchor  = activeCharRef
    ? (tool === "jimeng" ? refSheets[activeCharRef]?.jimeng_face_anchor : refSheets[activeCharRef]?.flow_face_anchor)
    : null;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#080810", fontFamily:"'Georgia',serif", color:"#E8E0D0", position:"relative" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .btn:hover{opacity:0.82;} .tab:hover{background:rgba(255,77,109,0.12)!important;}
        textarea:focus{border-color:#FF4D6D!important;outline:none;}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#333}
      `}</style>
      <div style={{ position:"fixed", inset:0, zIndex:0, background:"radial-gradient(ellipse at 20% 20%,#1a0a2e 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,#0a1a2e 0%,transparent 50%)", pointerEvents:"none" }} />

      <div style={{ position:"relative", zIndex:2, maxWidth:960, margin:"0 auto", padding:"40px 20px" }}>

        {/* HEADER */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:10, letterSpacing:8, color:"#FF4D6D", textTransform:"uppercase", marginBottom:10 }}>◈ TikTok Drama Series ◈</div>
          <h1 style={{ fontSize:"clamp(26px,5vw,50px)", fontWeight:400, margin:0, lineHeight:1.1, background:"linear-gradient(135deg,#FFD700 0%,#FF4D6D 50%,#C084FC 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Drama Series Generator
          </h1>
          <p style={{ color:"#8080A0", marginTop:10, fontSize:12, letterSpacing:1 }}>
            Concept → 5 Episodes · Character Sheets · Ready to paste into your AI video tool
          </p>
        </div>

        {/* TOOL SELECTOR */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:12 }}>Select Video Tool</div>
          <div style={{ display:"flex", gap:10 }}>
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} className="btn"
                style={{ flex:1, padding:"14px 10px", background:tool===t.id?"rgba(255,77,109,0.15)":"rgba(255,255,255,0.03)", border:tool===t.id?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:12, cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{t.icon}</div>
                <div style={{ fontSize:13, color:tool===t.id?"#FF4D6D":"#E8E0D0", fontFamily:"'Georgia',serif", fontWeight:tool===t.id?600:400 }}>{t.label}</div>
                <div style={{ fontSize:10, color:"#606080", marginTop:2 }}>{t.sublabel}</div>
                {t.id==="jimeng" && tool===t.id && <div style={{ fontSize:9, color:"#FFD700", marginTop:4 }}>中文 · EN dialogue</div>}
              </button>
            ))}
          </div>
          <div style={{ marginTop:10, padding:"8px 14px", background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.15)", borderRadius:8, fontSize:11, color:"#806040" }}>
            ✦ All prompts: No BGM · No text on screen · No subtitles · Clean audio · 10 seconds
          </div>
        </div>

        {/* CONCEPT INPUT */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:24 }}>
          <label style={{ fontSize:10, letterSpacing:4, color:"#FF4D6D", textTransform:"uppercase", display:"block", marginBottom:10 }}>Your Story Concept</label>
          <textarea value={concept} onChange={e => setConcept(e.target.value)}
            placeholder="e.g. A CEO falls in love with the cleaner at his office, but she's actually his company's secret investor watching him fail..."
            style={{ width:"100%", minHeight:90, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#E8E0D0", fontSize:14, padding:"12px 14px", resize:"vertical", fontFamily:"'Georgia',serif", lineHeight:1.6, boxSizing:"border-box" }}
          />

          {!series && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"#C084FC", textTransform:"uppercase", marginBottom:10 }}>Optional: Upload Character Photos</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {["Character 1","Character 2","Character 3"].map(name => (
                  <div key={name} style={{ flex:"1 1 120px" }}>
                    <input ref={el => fileRefs.current[name] = el} type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleImageUpload(name, e.target.files[0])} />
                    <div onClick={() => fileRefs.current[name]?.click()}
                      style={{ border:`1px dashed ${charImages[name]?"#C084FC":"rgba(255,255,255,0.12)"}`, borderRadius:10, padding:"10px 8px", textAlign:"center", cursor:"pointer", background:charImages[name]?"rgba(192,132,252,0.07)":"transparent" }}>
                      {charImages[name]
                        ? <><img src={charImages[name].preview} style={{ width:40,height:40,borderRadius:"50%",objectFit:"cover",marginBottom:4 }} alt="" /><div style={{ fontSize:10,color:"#C084FC" }}>✓ {name}</div></>
                        : <><div style={{ fontSize:18,color:"#303050",marginBottom:4 }}>+</div><div style={{ fontSize:10,color:"#505070" }}>{name}</div></>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={generate} disabled={loading || !concept.trim()} className="btn"
            style={{ marginTop:16, width:"100%", padding:"15px", background:loading?"rgba(255,77,109,0.3)":"linear-gradient(135deg,#FF4D6D,#C084FC)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontFamily:"'Georgia',serif", letterSpacing:2, cursor:loading?"not-allowed":"pointer", fontWeight:600 }}>
            {loading ? `✦ Generating for ${currentTool?.label}…` : `✦ Generate Drama Series for ${currentTool?.label}`}
          </button>

          {error && (
            <div style={{ marginTop:12, padding:"12px 14px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.35)", borderRadius:8 }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#F87171", textTransform:"uppercase", marginBottom:6 }}>Error</div>
              <pre style={{ margin:0, color:"#F87171", fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-all", fontFamily:"monospace", maxHeight:160, overflowY:"auto" }}>{error}</pre>
            </div>
          )}
        </div>

        {/* RESULTS */}
        {series && (
          <div style={{ animation:"fadeIn 0.5s ease" }}>

            {/* Series banner */}
            <div style={{ background:"linear-gradient(135deg,rgba(255,77,109,0.1),rgba(192,132,252,0.1))", border:"1px solid rgba(255,77,109,0.3)", borderRadius:16, padding:24, marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:10, letterSpacing:4, color:"#FF4D6D", textTransform:"uppercase", marginBottom:6 }}>{series.genre}</div>
                  <h2 style={{ margin:"0 0 8px", fontSize:24, fontWeight:400 }}>{series.title}</h2>
                  <p style={{ margin:0, color:"#FFD700", fontStyle:"italic", fontSize:14 }}>"{series.hook}"</p>
                </div>
                <div style={{ padding:"8px 16px", background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#606080", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Optimised for</div>
                  <div style={{ fontSize:16, color:"#FF4D6D" }}>{currentTool?.icon} {currentTool?.label}</div>
                  {tool==="jimeng" && <div style={{ fontSize:10, color:"#FFD700", marginTop:4 }}>中文 directions · EN dialogue</div>}
                </div>
              </div>
            </div>

            {/* Characters */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:10 }}>Characters</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12 }}>
                {series.characters?.map((c, i) => (
                  <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      {charImages[c.name]
                        ? <img src={charImages[c.name].preview} style={{ width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid #C084FC" }} alt="" />
                        : <div style={{ width:34,height:34,borderRadius:"50%",background:"rgba(192,132,252,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>◈</div>}
                      <div>
                        <div style={{ fontWeight:600, color:"#C084FC", fontSize:13 }}>{c.name}</div>
                        <div style={{ fontSize:11, color:"#8080A0" }}>{c.role}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:"#B0A090", marginBottom:4 }}>{c.arc}</div>
                    <div style={{ fontSize:11, color:"#FF4D6D", fontStyle:"italic", marginBottom:10 }}>↯ {c.conflict}</div>
                    <input ref={el => fileRefs.current[c.name] = el} type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleImageUpload(c.name, e.target.files[0])} />
                    <button onClick={() => fileRefs.current[c.name]?.click()} className="btn"
                      style={{ width:"100%", padding:"5px 0", background:"rgba(192,132,252,0.1)", border:"1px solid rgba(192,132,252,0.2)", borderRadius:6, color:"#C084FC", fontSize:10, cursor:"pointer", fontFamily:"'Georgia',serif" }}>
                      {charImages[c.name] ? "✓ Photo · Change" : "+ Upload Photo"}
                    </button>
                    {charImages[c.name] && !refSheets[c.name] && (
                      <button onClick={() => generateRefSheet(c.name)} disabled={refLoading[c.name]} className="btn"
                        style={{ width:"100%", marginTop:6, padding:"5px 0", background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:6, color:"#FFD700", fontSize:10, cursor:"pointer", fontFamily:"'Georgia',serif" }}>
                        {refLoading[c.name] ? "Analysing…" : "✦ Analyse Face"}
                      </button>
                    )}
                    {refSheets[c.name] && <div style={{ marginTop:6, fontSize:10, color:"#00FF88", textAlign:"center" }}>✓ Face ref ready</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Episode tabs */}
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              {series.episodes?.map((e, i) => (
                <button key={i} className="tab" onClick={() => { setActiveEp(i); setActiveTab("prompt"); }}
                  style={{ padding:"8px 16px", background:activeEp===i?"rgba(255,77,109,0.25)":"rgba(255,255,255,0.04)", border:activeEp===i?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeEp===i?"#FF4D6D":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", transition:"all 0.2s" }}>
                  EP {e.episode}
                </button>
              ))}
            </div>

            {/* Episode panel */}
            {ep && (
              <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24 }}>

                {/* Ep header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:6 }}>Episode {ep.episode} · 10s · {currentTool?.label}</div>
                    <h3 style={{ margin:0, fontSize:20, fontWeight:400 }}>{ep.title}</h3>
                  </div>
                  {ep.n4 && (
                    <div style={{ background:"rgba(0,0,0,0.4)", border:`1px solid ${ratingColor(ep.n4.rating)}40`, borderRadius:12, padding:"10px 16px", textAlign:"center", minWidth:120 }}>
                      <div style={{ fontSize:10, letterSpacing:2, color:"#8080A0", textTransform:"uppercase", marginBottom:4 }}>N4 Score</div>
                      <div style={{ fontSize:24, fontWeight:700, color:ratingColor(ep.n4.rating), lineHeight:1 }}>{ep.n4.score}/10</div>
                      <div style={{ fontSize:12, color:ratingColor(ep.n4.rating), marginTop:4 }}>{ratingEmoji(ep.n4.rating)} {ep.n4.rating}</div>
                      <div style={{ display:"flex", gap:8, marginTop:8, justifyContent:"center" }}>
                        {["hook","hold","emotion","share"].map(k => (
                          <div key={k} style={{ textAlign:"center" }}>
                            <div style={{ fontSize:9, color:"#606080", textTransform:"uppercase" }}>{k[0]}</div>
                            <div style={{ fontSize:13, color:ep.n4[k]>=8?"#00FF88":ep.n4[k]>=7?"#60A5FA":"#F87171" }}>{ep.n4[k]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inner tabs */}
                <div style={{ display:"flex", gap:6, marginBottom:20 }}>
                  {["prompt","refsheet"].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className="tab"
                      style={{ padding:"8px 18px", background:activeTab===t?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)", border:activeTab===t?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeTab===t?"#FF4D6D":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                      {t === "prompt" ? `◈ ${currentTool?.label} Prompt` : "◧ Character Ref Sheets"}
                    </button>
                  ))}
                </div>

                {/* PROMPT TAB */}
                {activeTab === "prompt" && (
                  <div>
                    {tool === "jimeng" && (
                      <div style={{ padding:"8px 14px", background:"rgba(255,215,0,0.06)", border:"1px solid rgba(255,215,0,0.15)", borderRadius:8, fontSize:11, color:"#806040", marginBottom:14 }}>
                        ◉ Jimeng: Scene directions in 中文 · Dialogue in English · No BGM · No text
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div style={{ fontSize:10, letterSpacing:4, color:"#FF4D6D", textTransform:"uppercase" }}>{currentTool?.icon} {currentTool?.label} Prompt — EP{ep.episode}</div>
                      <button onClick={() => copyPrompt(ep.video_prompt, `vp-${activeEp}`)} className="btn"
                        style={{ padding:"5px 12px", background:copied===`vp-${activeEp}`?"rgba(0,255,136,0.2)":"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:copied===`vp-${activeEp}`?"#00FF88":"#E8E0D0", cursor:"pointer", fontSize:11, fontFamily:"'Georgia',serif" }}>
                        {copied===`vp-${activeEp}` ? "✓ Copied!" : "Copy Prompt"}
                      </button>
                    </div>
                    <div style={{ background:"rgba(255,77,109,0.05)", border:"1px solid rgba(255,77,109,0.15)", borderRadius:10, padding:16, fontSize:13, lineHeight:1.8, color:"#C8C0B0", whiteSpace:"pre-wrap", marginBottom:16 }}>
                      {ep.video_prompt}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div style={{ background:"rgba(192,132,252,0.05)", border:"1px solid rgba(192,132,252,0.15)", borderRadius:10, padding:14 }}>
                        <div style={{ fontSize:10, letterSpacing:3, color:"#C084FC", textTransform:"uppercase", marginBottom:6 }}>Subtext</div>
                        <p style={{ margin:0, fontSize:12, color:"#A090B0", fontStyle:"italic", lineHeight:1.6 }}>"{ep.subtext}"</p>
                      </div>
                      <div style={{ background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:10, padding:14 }}>
                        <div style={{ fontSize:10, letterSpacing:3, color:"#FFD700", textTransform:"uppercase", marginBottom:6 }}>⚡ Cliffhanger</div>
                        <p style={{ margin:0, fontSize:12, color:"#C0A860", lineHeight:1.6 }}>{ep.cliffhanger}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* REF SHEET TAB */}
                {activeTab === "refsheet" && (
                  <div>
                    {/* Character selector */}
                    <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
                      {series.characters?.map((c, i) => (
                        <button key={i} onClick={() => { setActiveCharRef(c.name); setActiveView("front_view_prompt"); }} className="tab"
                          style={{ padding:"7px 14px", display:"flex", alignItems:"center", gap:8, background:activeCharRef===c.name?"rgba(192,132,252,0.2)":"rgba(255,255,255,0.04)", border:activeCharRef===c.name?"1px solid #C084FC":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeCharRef===c.name?"#C084FC":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                          {charImages[c.name] && <img src={charImages[c.name].preview} style={{ width:18,height:18,borderRadius:"50%",objectFit:"cover" }} alt="" />}
                          {c.name} {refSheets[c.name] && <span style={{ color:"#00FF88",fontSize:10 }}>✓</span>}
                        </button>
                      ))}
                    </div>

                    {activeCharRef && (() => {
                      const sheet = refSheets[activeCharRef];
                      const img   = charImages[activeCharRef];

                      return (
                        <div>
                          {/* Face anchor */}
                          {sheet && faceAnchor && (
                            <div style={{ background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:12, padding:16, marginBottom:18 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                                <div style={{ fontSize:10, letterSpacing:3, color:"#FFD700", textTransform:"uppercase" }}>
                                  ◉ Face Anchor {tool==="jimeng"?"(中文)":"(EN)"} — Prepend to ALL prompts
                                </div>
                                <button onClick={() => copyPrompt(faceAnchor, `anchor-${activeCharRef}`)} className="btn"
                                  style={{ padding:"4px 10px", background:copied===`anchor-${activeCharRef}`?"rgba(0,255,136,0.2)":"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:copied===`anchor-${activeCharRef}`?"#00FF88":"#E8E0D0", cursor:"pointer", fontSize:10, fontFamily:"'Georgia',serif" }}>
                                  {copied===`anchor-${activeCharRef}` ? "✓ Copied!" : "Copy"}
                                </button>
                              </div>
                              <p style={{ margin:0, fontSize:12, color:"#C0A860", lineHeight:1.7, fontStyle:"italic" }}>{faceAnchor}</p>
                              <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                                {sheet.signature_features?.map((f, i) => (
                                  <span key={i} style={{ padding:"3px 10px", background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:20, fontSize:10, color:"#C0A860" }}>{f}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Upload / analyse */}
                          {!img && (
                            <div style={{ textAlign:"center", padding:"28px 20px", background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:12, marginBottom:18 }}>
                              <div style={{ fontSize:28, marginBottom:10 }}>📸</div>
                              <p style={{ color:"#8080A0", fontSize:12, marginBottom:14 }}>Upload a photo of {activeCharRef} to generate a face anchor</p>
                              <input ref={el => fileRefs.current[activeCharRef] = el} type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleImageUpload(activeCharRef, e.target.files[0])} />
                              <button onClick={() => fileRefs.current[activeCharRef]?.click()} className="btn"
                                style={{ padding:"9px 24px", background:"rgba(192,132,252,0.15)", border:"1px solid rgba(192,132,252,0.3)", borderRadius:8, color:"#C084FC", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                                Upload Photo
                              </button>
                            </div>
                          )}

                          {img && !sheet && (
                            <div style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:12, padding:14, marginBottom:18 }}>
                              <img src={img.preview} style={{ width:50,height:50,borderRadius:"50%",objectFit:"cover",border:"2px solid #FFD700" }} alt="" />
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:12, color:"#E8E0D0", marginBottom:3 }}>Photo ready — {activeCharRef}</div>
                                <div style={{ fontSize:11, color:"#8080A0" }}>Analyse to generate face anchor {tool==="jimeng"?"in Chinese":""}</div>
                              </div>
                              <button onClick={() => generateRefSheet(activeCharRef)} disabled={refLoading[activeCharRef]} className="btn"
                                style={{ padding:"9px 18px", background:"linear-gradient(135deg,#FFD700,#FB923C)", border:"none", borderRadius:8, color:"#000", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", fontWeight:700, whiteSpace:"nowrap" }}>
                                {refLoading[activeCharRef] ? "Analysing…" : "✦ Analyse Face"}
                              </button>
                            </div>
                          )}

                          {/* Generate Looks button */}
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, padding:"12px 16px", background:"rgba(255,77,109,0.05)", border:"1px solid rgba(255,77,109,0.2)", borderRadius:12 }}>
                            <div>
                              <div style={{ fontSize:12, color:"#E8E0D0", fontWeight:600 }}>EP{ep.episode} Looks — {activeCharRef}</div>
                              <div style={{ fontSize:11, color:"#8080A0", marginTop:2 }}>Attire, hairstyle & 4 reference view prompts</div>
                            </div>
                            {look
                              ? <div style={{ fontSize:11, color:"#00FF88" }}>✓ Generated</div>
                              : <button onClick={() => generateLooks(activeCharRef, ep.episode)} disabled={looksLoading[looksKey]} className="btn"
                                  style={{ padding:"8px 18px", background:looksLoading[looksKey]?"rgba(255,77,109,0.2)":"linear-gradient(135deg,#FF4D6D,#C084FC)", border:"none", borderRadius:8, color:"#fff", cursor:looksLoading[looksKey]?"not-allowed":"pointer", fontSize:12, fontFamily:"'Georgia',serif", fontWeight:600, whiteSpace:"nowrap" }}>
                                  {looksLoading[looksKey] ? "Generating…" : "✦ Generate Looks"}
                                </button>
                            }
                          </div>

                          {/* Attire & Hairstyle */}
                          {look && (
                            <div>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                                <div style={{ background:"rgba(255,77,109,0.05)", border:"1px solid rgba(255,77,109,0.2)", borderRadius:12, padding:14 }}>
                                  <div style={{ fontSize:10, letterSpacing:3, color:"#FF4D6D", textTransform:"uppercase", marginBottom:6 }}>EP{ep.episode} Attire</div>
                                  <p style={{ margin:0, fontSize:12, color:"#C8C0B0", lineHeight:1.7 }}>{look.episode_attire}</p>
                                </div>
                                <div style={{ background:"rgba(192,132,252,0.05)", border:"1px solid rgba(192,132,252,0.2)", borderRadius:12, padding:14 }}>
                                  <div style={{ fontSize:10, letterSpacing:3, color:"#C084FC", textTransform:"uppercase", marginBottom:6 }}>EP{ep.episode} Hairstyle</div>
                                  <p style={{ margin:0, fontSize:12, color:"#C8C0B0", lineHeight:1.7 }}>{look.episode_hairstyle}</p>
                                </div>
                              </div>

                              {/* 4 view prompts */}
                              <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:10 }}>
                                Reference View Prompts — Paste into {currentTool?.label}
                              </div>
                              <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                                {VIEWS.map(v => (
                                  <button key={v.key} onClick={() => setActiveView(v.key)} className="tab"
                                    style={{ padding:"7px 14px", background:activeView===v.key?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)", border:activeView===v.key?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeView===v.key?"#FF4D6D":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                                    {v.icon} {v.label}
                                  </button>
                                ))}
                              </div>

                              {VIEWS.map(v => activeView === v.key && look[v.key] && (
                                <div key={v.key}>
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                                    <div style={{ fontSize:11, color:"#C084FC" }}>{v.icon} {v.label} · EP{ep.episode} · {activeCharRef}</div>
                                    <button onClick={() => copyPrompt(faceAnchor ? `${faceAnchor}\n\n${look[v.key]}` : look[v.key], `view-${activeCharRef}-${v.key}`)} className="btn"
                                      style={{ padding:"5px 12px", background:copied===`view-${activeCharRef}-${v.key}`?"rgba(0,255,136,0.2)":"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:copied===`view-${activeCharRef}-${v.key}`?"#00FF88":"#E8E0D0", cursor:"pointer", fontSize:11, fontFamily:"'Georgia',serif" }}>
                                      {copied===`view-${activeCharRef}-${v.key}` ? "✓ Copied!" : faceAnchor ? "Copy with Face Anchor" : "Copy Prompt"}
                                    </button>
                                  </div>
                                  <div style={{ background:"rgba(192,132,252,0.04)", border:"1px solid rgba(192,132,252,0.15)", borderRadius:10, padding:16, fontSize:13, lineHeight:1.8, color:"#C8C0B0", whiteSpace:"pre-wrap" }}>
                                    {faceAnchor ? `[FACE ANCHOR]\n${faceAnchor}\n\n[VIEW PROMPT]\n${look[v.key]}` : look[v.key]}
                                  </div>
                                  {faceAnchor && <p style={{ fontSize:10, color:"#606080", marginTop:6, fontStyle:"italic" }}>✦ Face anchor prepended for consistency</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Nav */}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:20 }}>
                  <button onClick={() => setActiveEp(Math.max(0, activeEp-1))} disabled={activeEp===0} className="btn"
                    style={{ padding:"8px 20px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeEp===0?"#404060":"#E8E0D0", cursor:activeEp===0?"not-allowed":"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                    ← Previous
                  </button>
                  <button onClick={() => copyPrompt(ep.video_prompt, `main-${activeEp}`)} className="btn"
                    style={{ padding:"8px 24px", background:copied===`main-${activeEp}`?"rgba(0,255,136,0.2)":"linear-gradient(135deg,#FF4D6D,#C084FC)", border:"none", borderRadius:8, color:"#fff", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", fontWeight:600 }}>
                    {copied===`main-${activeEp}` ? `✓ Paste into ${currentTool?.label} →` : `Copy → Paste into ${currentTool?.label}`}
                  </button>
                  <button onClick={() => setActiveEp(Math.min(series.episodes.length-1, activeEp+1))} disabled={activeEp===series.episodes.length-1} className="btn"
                    style={{ padding:"8px 20px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeEp===series.episodes.length-1?"#404060":"#E8E0D0", cursor:activeEp===series.episodes.length-1?"not-allowed":"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Reset */}
            <div style={{ textAlign:"center", marginTop:18 }}>
              <button onClick={() => { setSeries(null); setConcept(""); setCharImages({}); setRefSheets({}); setCharLooks({}); }} className="btn"
                style={{ padding:"8px 22px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                ↺ Start New Series
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
