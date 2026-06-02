import { useState, useRef } from "react";

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

const SERIES_SYSTEM_PROMPT = `You are an expert AI video prompt writer for Google Flow/Omni (Gemini Omni Flash).
You specialize in short drama series for TikTok.

When given a story concept and character descriptions, output a JSON object with this exact structure:
{
  "title": "Series title",
  "genre": "Genre",
  "hook": "One line that makes people stop scrolling",
  "episodes": [
    {
      "episode": 1,
      "title": "Episode title",
      "duration": "10 seconds",
      "n4": { "hook": 8, "hold": 8, "emotion": 9, "share": 8, "total": 33, "score": 8.25, "rating": "Winner" },
      "flow_prompt": "Full Google Flow/Omni video prompt with camera directions, character micro-expressions (contempt/happiness/anger/sadness/fear/disgust/surprise), micro-movements (gait, posture, eye movement, jaw tension), vocal techniques (Power, Pitch, Pace, Pause), subtext through physical contradiction, presence over performance. Cinematic, detailed, ready to paste into Flow.",
      "subtext": "What is NOT said but felt",
      "cliffhanger": "The hook into next episode",
      "character_looks": [
        {
          "character": "Character name",
          "episode_attire": "Detailed outfit description for this episode — fabric, color, cut, fit, accessories",
          "episode_hairstyle": "Exact hairstyle for this episode — length, texture, color, styling",
          "front_view_prompt": "Google Flow/Omni prompt for FRONT VIEW full body character reference — face forward, neutral expression, arms slightly away from body, full outfit visible, studio lighting, white background, fashion reference sheet style",
          "side_view_prompt": "Google Flow/Omni prompt for SIDE VIEW — 90 degree profile, same outfit, same hairstyle, neutral pose, white background",
          "back_view_prompt": "Google Flow/Omni prompt for BACK VIEW — full back visible, same outfit, hairstyle from back, white background",
          "closeup_prompt": "Google Flow/Omni prompt for FACE CLOSE-UP — chin to top of head, front facing, neutral expression, soft studio lighting, shows skin texture, facial features clearly"
        }
      ]
    }
  ],
  "characters": [
    { "name": "Name", "role": "Role", "arc": "Character arc", "conflict": "Internal conflict", "base_look": "Overall signature look across the series" }
  ]
}

Rules:
- Generate 5 episodes per series
- Each episode is exactly 10 seconds (Google Flow Omni Flash cap)
- Every Flow prompt must include: micro-expressions, micro-movements, 4Ps vocal technique, subtext through physical contradiction, presence over performance
- N4 scoring: Hook/Hold/Emotion/Share each 0-10, total /40 converted to /10
- Rating: 9-10=Unicorn, 8-8.9=Winner, 7-7.9=Solid, 6-6.9=Risky, below 6=Trash
- If any dimension below 7, rewrite that dimension until it passes
- End every episode with a cliffhanger
- character_looks must include ALL characters for EVERY episode, with attire/hairstyle changing per episode to match the scene/mood
- Each of the 4 view prompts must be self-contained and ready to paste directly into Google Flow
- Output ONLY valid JSON, no markdown, no backticks, no preamble`;

const REFSHEET_SYSTEM_PROMPT = `You are a character visual designer for AI video production.
The user will provide a character image and character details.
Analyze the face, features, skin tone, and physical attributes from the image carefully.
Generate a detailed character reference sheet as JSON:
{
  "character_name": "Name",
  "face_description": "Extremely detailed face description for AI video consistency — bone structure, eye shape/color, nose shape, lip shape, skin tone (use specific terms like 'warm honey', 'deep ebony', 'porcelain'), eyebrow shape, jawline",
  "body_type": "Body type and build description",
  "height_estimate": "Estimated height/build for scene proportion",
  "signature_features": ["List of 3-5 most distinctive features to maintain across all episodes"],
  "flow_face_anchor": "A single paragraph to prepend to ALL Google Flow prompts featuring this character — locks in face consistency. Include all key facial features, skin tone, eye details."
}
Output ONLY valid JSON, no markdown, no backticks.`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const ratingColor = (r) => ({ Unicorn:"#FFD700", Winner:"#00FF88", Solid:"#60A5FA", Risky:"#FB923C" }[r] || "#F87171");
const ratingEmoji = (r) => ({ Unicorn:"🦄", Winner:"🏆", Solid:"✅", Risky:"⚠️" }[r] || "🗑️");

const VIEWS = [
  { key: "front_view_prompt", label: "Front View", icon: "◈" },
  { key: "side_view_prompt",  label: "Side View",  icon: "◧" },
  { key: "back_view_prompt",  label: "Back View",  icon: "◪" },
  { key: "closeup_prompt",    label: "Close-Up",   icon: "◉" },
];

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function DramaGenerator() {
  const [concept, setConcept]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [series, setSeries]         = useState(null);
  const [activeEp, setActiveEp]     = useState(0);
  const [activeTab, setActiveTab]   = useState("prompt"); // prompt | refsheet
  const [copied, setCopied]         = useState(null);
  const [error, setError]           = useState("");

  // Character images & ref sheets
  const [charImages, setCharImages]     = useState({}); // { charName: { file, base64, mediaType, preview } }
  const [refSheets, setRefSheets]       = useState({}); // { charName: { ...sheet data } }
  const [refLoading, setRefLoading]     = useState({}); // { charName: bool }
  const [activeCharRef, setActiveCharRef] = useState(null);
  const [activeView, setActiveView]     = useState("front_view_prompt");

  const fileRefs = useRef({});

  // ── Generate Series ───────────────────────────────────────────────────────
  const generate = async () => {
    if (!concept.trim()) return;
    setLoading(true); setError(""); setSeries(null);
    try {
      const charCtx = Object.keys(charImages).length
        ? `\nUploaded character images for: ${Object.keys(charImages).join(", ")}`
        : "";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          system: SERIES_SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Story concept: ${concept}${charCtx}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setSeries(parsed);
      setActiveEp(0);
      setActiveTab("prompt");
      if (parsed.characters?.length) setActiveCharRef(parsed.characters[0].name);
    } catch(e) { setError("Generation failed — check your concept and try again."); }
    setLoading(false);
  };

  // ── Upload character image ────────────────────────────────────────────────
  const handleImageUpload = async (charName, file) => {
    if (!file) return;
    const base64 = await toBase64(file);
    const mediaType = file.type || "image/jpeg";
    const preview = URL.createObjectURL(file);
    setCharImages(prev => ({ ...prev, [charName]: { file, base64, mediaType, preview } }));
    setRefSheets(prev => { const n = {...prev}; delete n[charName]; return n; });
  };

  // ── Generate ref sheet from image ────────────────────────────────────────
  const generateRefSheet = async (charName) => {
    const img = charImages[charName];
    if (!img) return;
    setRefLoading(prev => ({ ...prev, [charName]: true }));
    try {
      const char = series?.characters?.find(c => c.name === charName);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: REFSHEET_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
              { type: "text", text: `Character name: ${charName}\nRole: ${char?.role || ""}\nArc: ${char?.arc || ""}` }
            ]
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setRefSheets(prev => ({ ...prev, [charName]: parsed }));
    } catch(e) { console.error(e); }
    setRefLoading(prev => ({ ...prev, [charName]: false }));
  };

  const copyPrompt = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const ep = series?.episodes?.[activeEp];
  const charLook = ep?.character_looks?.find(c => c.character === activeCharRef);

  // ─── UI ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#080810", fontFamily:"'Georgia',serif", color:"#E8E0D0", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .btn-hover:hover { opacity:0.85; }
        .tab-btn:hover { background:rgba(255,77,109,0.12) !important; }
        textarea:focus { border-color:#FF4D6D !important; outline:none; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#333}
      `}</style>

      {/* BG */}
      <div style={{ position:"fixed", inset:0, zIndex:0, background:"radial-gradient(ellipse at 20% 20%,#1a0a2e 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,#0a1a2e 0%,transparent 50%)", pointerEvents:"none" }} />

      <div style={{ position:"relative", zIndex:2, maxWidth:960, margin:"0 auto", padding:"40px 20px" }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <div style={{ fontSize:10, letterSpacing:8, color:"#FF4D6D", textTransform:"uppercase", marginBottom:10 }}>◈ Google Flow / Omni Flash ◈</div>
          <h1 style={{ fontSize:"clamp(28px,5vw,52px)", fontWeight:400, margin:0, lineHeight:1.1, letterSpacing:"-1px", background:"linear-gradient(135deg,#FFD700 0%,#FF4D6D 50%,#C084FC 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Drama Series Generator
          </h1>
          <p style={{ color:"#8080A0", marginTop:12, fontSize:13, letterSpacing:1 }}>Concept → 5 Episodes + Character Reference Sheets → Paste into Flow</p>
        </div>

        {/* ── CONCEPT INPUT ── */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:24, backdropFilter:"blur(10px)" }}>
          <label style={{ fontSize:10, letterSpacing:4, color:"#FF4D6D", textTransform:"uppercase", display:"block", marginBottom:10 }}>Your Story Concept</label>
          <textarea
            value={concept} onChange={e=>setConcept(e.target.value)}
            placeholder="e.g. A CEO falls in love with the cleaner at his office, but she's actually his company's secret investor watching him fail..."
            style={{ width:"100%", minHeight:90, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#E8E0D0", fontSize:14, padding:"12px 14px", resize:"vertical", fontFamily:"'Georgia',serif", lineHeight:1.6, boxSizing:"border-box" }}
          />

          {/* Character image uploads — shown before series generated */}
          {!series && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"#C084FC", textTransform:"uppercase", marginBottom:10 }}>
                Optional: Upload Character Photos
              </div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                {["Character 1","Character 2","Character 3"].map(name => (
                  <div key={name} style={{ flex:"1 1 140px", minWidth:120 }}>
                    <input ref={el=>fileRefs.current[name]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImageUpload(name, e.target.files[0])} />
                    <div
                      onClick={()=>fileRefs.current[name]?.click()}
                      style={{ border:`1px dashed ${charImages[name]?"#C084FC":"rgba(255,255,255,0.15)"}`, borderRadius:10, padding:"10px 8px", textAlign:"center", cursor:"pointer", background:charImages[name]?"rgba(192,132,252,0.07)":"transparent", transition:"all 0.2s" }}
                    >
                      {charImages[name]
                        ? <><img src={charImages[name].preview} style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", marginBottom:4 }} alt="" /><div style={{ fontSize:11, color:"#C084FC" }}>✓ {name}</div></>
                        : <><div style={{ fontSize:20, marginBottom:4, color:"#404060" }}>+</div><div style={{ fontSize:11, color:"#606080" }}>{name}</div></>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={generate} disabled={loading||!concept.trim()} className="btn-hover"
            style={{ marginTop:16, width:"100%", padding:"15px 32px", background:loading?"rgba(255,77,109,0.3)":"linear-gradient(135deg,#FF4D6D,#C084FC)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontFamily:"'Georgia',serif", letterSpacing:2, cursor:loading?"not-allowed":"pointer", fontWeight:600 }}>
            {loading ? "✦ Generating your series…" : "✦ Generate Drama Series"}
          </button>
          {error && <p style={{ color:"#F87171", marginTop:10, fontSize:13, textAlign:"center" }}>{error}</p>}
        </div>

        {/* ── RESULTS ── */}
        {series && (
          <div style={{ animation:"fadeIn 0.5s ease" }}>

            {/* Series banner */}
            <div style={{ background:"linear-gradient(135deg,rgba(255,77,109,0.1),rgba(192,132,252,0.1))", border:"1px solid rgba(255,77,109,0.3)", borderRadius:16, padding:24, marginBottom:20 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"#FF4D6D", textTransform:"uppercase", marginBottom:6 }}>{series.genre}</div>
              <h2 style={{ margin:"0 0 10px", fontSize:26, fontWeight:400, letterSpacing:"-0.5px" }}>{series.title}</h2>
              <p style={{ margin:0, color:"#FFD700", fontStyle:"italic", fontSize:15 }}>"{series.hook}"</p>
            </div>

            {/* Characters row */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:10 }}>Characters</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
                {series.characters?.map((c,i) => (
                  <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:16 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      {charImages[c.name]
                        ? <img src={charImages[c.name].preview} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", border:"2px solid #C084FC" }} alt="" />
                        : <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(192,132,252,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>◈</div>
                      }
                      <div>
                        <div style={{ fontWeight:600, color:"#C084FC", fontSize:14 }}>{c.name}</div>
                        <div style={{ fontSize:11, color:"#8080A0" }}>{c.role}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:"#B0A090", marginBottom:4 }}>{c.arc}</div>
                    <div style={{ fontSize:11, color:"#FF4D6D", fontStyle:"italic" }}>↯ {c.conflict}</div>

                    {/* Upload button per character (after series generated) */}
                    <div style={{ marginTop:10 }}>
                      <input ref={el=>fileRefs.current[c.name]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImageUpload(c.name, e.target.files[0])} />
                      <button onClick={()=>fileRefs.current[c.name]?.click()} className="btn-hover"
                        style={{ width:"100%", padding:"6px 0", background:"rgba(192,132,252,0.1)", border:"1px solid rgba(192,132,252,0.25)", borderRadius:6, color:"#C084FC", fontSize:11, cursor:"pointer", fontFamily:"'Georgia',serif", letterSpacing:1 }}>
                        {charImages[c.name] ? "✓ Photo uploaded · Change" : "+ Upload Photo"}
                      </button>
                      {charImages[c.name] && !refSheets[c.name] && (
                        <button onClick={()=>generateRefSheet(c.name)} disabled={refLoading[c.name]} className="btn-hover"
                          style={{ width:"100%", marginTop:6, padding:"6px 0", background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.25)", borderRadius:6, color:"#FFD700", fontSize:11, cursor:"pointer", fontFamily:"'Georgia',serif", letterSpacing:1 }}>
                          {refLoading[c.name] ? "Analysing…" : "✦ Analyse Face"}
                        </button>
                      )}
                      {refSheets[c.name] && <div style={{ marginTop:6, fontSize:10, color:"#00FF88", textAlign:"center" }}>✓ Reference sheet ready</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Episode tabs */}
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              {series.episodes?.map((e,i) => (
                <button key={i} className="tab-btn" onClick={()=>{setActiveEp(i);setActiveTab("prompt");}}
                  style={{ padding:"9px 18px", background:activeEp===i?"rgba(255,77,109,0.25)":"rgba(255,255,255,0.04)", border:activeEp===i?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeEp===i?"#FF4D6D":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", transition:"all 0.2s" }}>
                  EP {e.episode}
                </button>
              ))}
            </div>

            {/* Episode content */}
            {ep && (
              <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24 }}>

                {/* Episode header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:6 }}>Episode {ep.episode} · {ep.duration}</div>
                    <h3 style={{ margin:0, fontSize:20, fontWeight:400 }}>{ep.title}</h3>
                  </div>
                  {ep.n4 && (
                    <div style={{ background:"rgba(0,0,0,0.4)", border:`1px solid ${ratingColor(ep.n4.rating)}40`, borderRadius:12, padding:"10px 18px", textAlign:"center", minWidth:130 }}>
                      <div style={{ fontSize:10, letterSpacing:3, color:"#8080A0", textTransform:"uppercase", marginBottom:4 }}>N4 Score</div>
                      <div style={{ fontSize:26, fontWeight:700, color:ratingColor(ep.n4.rating), lineHeight:1 }}>{ep.n4.score}/10</div>
                      <div style={{ fontSize:12, color:ratingColor(ep.n4.rating), marginTop:4 }}>{ratingEmoji(ep.n4.rating)} {ep.n4.rating}</div>
                      <div style={{ display:"flex", gap:8, marginTop:8, justifyContent:"center" }}>
                        {["hook","hold","emotion","share"].map(k=>(
                          <div key={k} style={{ textAlign:"center" }}>
                            <div style={{ fontSize:9, color:"#606080", textTransform:"uppercase" }}>{k[0]}</div>
                            <div style={{ fontSize:13, color:ep.n4[k]>=8?"#00FF88":ep.n4[k]>=7?"#60A5FA":"#F87171" }}>{ep.n4[k]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inner tabs: Prompt | Ref Sheet */}
                <div style={{ display:"flex", gap:6, marginBottom:20 }}>
                  {["prompt","refsheet"].map(t=>(
                    <button key={t} onClick={()=>setActiveTab(t)} className="tab-btn"
                      style={{ padding:"8px 20px", background:activeTab===t?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)", border:activeTab===t?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeTab===t?"#FF4D6D":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", transition:"all 0.2s" }}>
                      {t==="prompt" ? "◈ Flow Prompt" : "◧ Character Reference Sheets"}
                    </button>
                  ))}
                </div>

                {/* ── TAB: FLOW PROMPT ── */}
                {activeTab==="prompt" && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div style={{ fontSize:10, letterSpacing:4, color:"#FF4D6D", textTransform:"uppercase" }}>Google Flow / Omni Prompt</div>
                      <button onClick={()=>copyPrompt(ep.flow_prompt,`flow-${activeEp}`)} className="btn-hover"
                        style={{ padding:"5px 14px", background:copied===`flow-${activeEp}`?"rgba(0,255,136,0.2)":"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:copied===`flow-${activeEp}`?"#00FF88":"#E8E0D0", cursor:"pointer", fontSize:11, fontFamily:"'Georgia',serif" }}>
                        {copied===`flow-${activeEp}`?"✓ Copied!":"Copy Prompt"}
                      </button>
                    </div>
                    <div style={{ background:"rgba(255,77,109,0.05)", border:"1px solid rgba(255,77,109,0.15)", borderRadius:10, padding:16, fontSize:13, lineHeight:1.8, color:"#C8C0B0", whiteSpace:"pre-wrap", marginBottom:16 }}>
                      {ep.flow_prompt}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
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

                {/* ── TAB: CHARACTER REFERENCE SHEETS ── */}
                {activeTab==="refsheet" && (
                  <div>
                    {/* Character selector */}
                    <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                      {series.characters?.map((c,i)=>(
                        <button key={i} onClick={()=>{ setActiveCharRef(c.name); setActiveView("front_view_prompt"); }} className="tab-btn"
                          style={{ padding:"8px 16px", display:"flex", alignItems:"center", gap:8, background:activeCharRef===c.name?"rgba(192,132,252,0.2)":"rgba(255,255,255,0.04)", border:activeCharRef===c.name?"1px solid #C084FC":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeCharRef===c.name?"#C084FC":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                          {charImages[c.name] && <img src={charImages[c.name].preview} style={{ width:20, height:20, borderRadius:"50%", objectFit:"cover" }} alt="" />}
                          {c.name}
                          {refSheets[c.name] && <span style={{ color:"#00FF88", fontSize:10 }}>✓</span>}
                        </button>
                      ))}
                    </div>

                    {activeCharRef && (() => {
                      const look = ep?.character_looks?.find(c=>c.character===activeCharRef);
                      const sheet = refSheets[activeCharRef];
                      const img = charImages[activeCharRef];
                      return (
                        <div>
                          {/* Attire & Hairstyle for this episode */}
                          {look && (
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                              <div style={{ background:"rgba(255,77,109,0.05)", border:"1px solid rgba(255,77,109,0.2)", borderRadius:12, padding:16 }}>
                                <div style={{ fontSize:10, letterSpacing:3, color:"#FF4D6D", textTransform:"uppercase", marginBottom:8 }}>EP{ep.episode} Attire</div>
                                <p style={{ margin:0, fontSize:13, color:"#C8C0B0", lineHeight:1.7 }}>{look.episode_attire}</p>
                              </div>
                              <div style={{ background:"rgba(192,132,252,0.05)", border:"1px solid rgba(192,132,252,0.2)", borderRadius:12, padding:16 }}>
                                <div style={{ fontSize:10, letterSpacing:3, color:"#C084FC", textTransform:"uppercase", marginBottom:8 }}>EP{ep.episode} Hairstyle</div>
                                <p style={{ margin:0, fontSize:13, color:"#C8C0B0", lineHeight:1.7 }}>{look.episode_hairstyle}</p>
                              </div>
                            </div>
                          )}

                          {/* Face anchor from ref sheet */}
                          {sheet && (
                            <div style={{ background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:12, padding:16, marginBottom:20 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                                <div style={{ fontSize:10, letterSpacing:3, color:"#FFD700", textTransform:"uppercase" }}>◉ Face Anchor — Prepend to ALL Flow prompts</div>
                                <button onClick={()=>copyPrompt(sheet.flow_face_anchor,`anchor-${activeCharRef}`)} className="btn-hover"
                                  style={{ padding:"4px 12px", background:copied===`anchor-${activeCharRef}`?"rgba(0,255,136,0.2)":"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:copied===`anchor-${activeCharRef}`?"#00FF88":"#E8E0D0", cursor:"pointer", fontSize:10, fontFamily:"'Georgia',serif" }}>
                                  {copied===`anchor-${activeCharRef}`?"✓ Copied!":"Copy"}
                                </button>
                              </div>
                              <p style={{ margin:0, fontSize:12, color:"#C0A860", lineHeight:1.7, fontStyle:"italic" }}>{sheet.flow_face_anchor}</p>
                              <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                                {sheet.signature_features?.map((f,i)=>(
                                  <span key={i} style={{ padding:"3px 10px", background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:20, fontSize:11, color:"#C0A860" }}>{f}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Upload prompt if no image yet */}
                          {!img && (
                            <div style={{ textAlign:"center", padding:"32px 20px", background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:12, marginBottom:20 }}>
                              <div style={{ fontSize:32, marginBottom:12 }}>📸</div>
                              <p style={{ color:"#8080A0", fontSize:13, marginBottom:16 }}>Upload a photo of {activeCharRef} to generate their reference sheet</p>
                              <input ref={el=>fileRefs.current[activeCharRef]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImageUpload(activeCharRef, e.target.files[0])} />
                              <button onClick={()=>fileRefs.current[activeCharRef]?.click()} className="btn-hover"
                                style={{ padding:"10px 28px", background:"rgba(192,132,252,0.15)", border:"1px solid rgba(192,132,252,0.3)", borderRadius:8, color:"#C084FC", cursor:"pointer", fontSize:13, fontFamily:"'Georgia',serif" }}>
                                Upload Photo
                              </button>
                            </div>
                          )}

                          {/* Analyse button */}
                          {img && !sheet && (
                            <div style={{ display:"flex", alignItems:"center", gap:14, background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.2)", borderRadius:12, padding:16, marginBottom:20 }}>
                              <img src={img.preview} style={{ width:56, height:56, borderRadius:"50%", objectFit:"cover", border:"2px solid #FFD700" }} alt="" />
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, color:"#E8E0D0", marginBottom:4 }}>Photo uploaded for {activeCharRef}</div>
                                <div style={{ fontSize:11, color:"#8080A0" }}>Analyse to generate face anchor + reference sheet</div>
                              </div>
                              <button onClick={()=>generateRefSheet(activeCharRef)} disabled={refLoading[activeCharRef]} className="btn-hover"
                                style={{ padding:"10px 20px", background:"linear-gradient(135deg,#FFD700,#FB923C)", border:"none", borderRadius:8, color:"#000", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", fontWeight:700, whiteSpace:"nowrap" }}>
                                {refLoading[activeCharRef] ? "Analysing…" : "✦ Analyse Face"}
                              </button>
                            </div>
                          )}

                          {/* 4 View prompts */}
                          {look && (
                            <div>
                              <div style={{ fontSize:10, letterSpacing:4, color:"#8080A0", textTransform:"uppercase", marginBottom:12 }}>
                                Reference View Prompts — Paste into Flow to generate character sheets
                              </div>
                              {/* View selector */}
                              <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                                {VIEWS.map(v=>(
                                  <button key={v.key} onClick={()=>setActiveView(v.key)} className="tab-btn"
                                    style={{ padding:"8px 16px", background:activeView===v.key?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)", border:activeView===v.key?"1px solid #FF4D6D":"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeView===v.key?"#FF4D6D":"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                                    {v.icon} {v.label}
                                  </button>
                                ))}
                              </div>

                              {/* Active view prompt */}
                              {VIEWS.map(v => activeView===v.key && look[v.key] && (
                                <div key={v.key}>
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                                    <div style={{ fontSize:11, color:"#C084FC" }}>{v.icon} {v.label} · EP{ep.episode} · {activeCharRef}</div>
                                    <button onClick={()=>copyPrompt(
                                      sheet ? `${sheet.flow_face_anchor}\n\n${look[v.key]}` : look[v.key],
                                      `view-${activeCharRef}-${v.key}`
                                    )} className="btn-hover"
                                      style={{ padding:"5px 14px", background:copied===`view-${activeCharRef}-${v.key}`?"rgba(0,255,136,0.2)":"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:copied===`view-${activeCharRef}-${v.key}`?"#00FF88":"#E8E0D0", cursor:"pointer", fontSize:11, fontFamily:"'Georgia',serif" }}>
                                      {copied===`view-${activeCharRef}-${v.key}` ? "✓ Copied!" : sheet ? "Copy with Face Anchor" : "Copy Prompt"}
                                    </button>
                                  </div>
                                  <div style={{ background:"rgba(192,132,252,0.04)", border:"1px solid rgba(192,132,252,0.15)", borderRadius:10, padding:16, fontSize:13, lineHeight:1.8, color:"#C8C0B0", whiteSpace:"pre-wrap" }}>
                                    {sheet ? `[FACE ANCHOR]\n${sheet.flow_face_anchor}\n\n[VIEW PROMPT]\n${look[v.key]}` : look[v.key]}
                                  </div>
                                  {sheet && <p style={{ fontSize:11, color:"#606080", marginTop:8, fontStyle:"italic" }}>✦ Face anchor automatically prepended for consistency across Google Flow generations</p>}
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
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:24 }}>
                  <button onClick={()=>setActiveEp(Math.max(0,activeEp-1))} disabled={activeEp===0} className="btn-hover"
                    style={{ padding:"9px 22px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeEp===0?"#404060":"#E8E0D0", cursor:activeEp===0?"not-allowed":"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                    ← Previous
                  </button>
                  <button onClick={()=>copyPrompt(ep.flow_prompt,`main-${activeEp}`)} className="btn-hover"
                    style={{ padding:"9px 28px", background:copied===`main-${activeEp}`?"rgba(0,255,136,0.2)":"linear-gradient(135deg,#FF4D6D,#C084FC)", border:"none", borderRadius:8, color:"#fff", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif", fontWeight:600 }}>
                    {copied===`main-${activeEp}`?"✓ Copied! Paste into Flow →":"Copy EP Prompt → Paste into Flow"}
                  </button>
                  <button onClick={()=>setActiveEp(Math.min(series.episodes.length-1,activeEp+1))} disabled={activeEp===series.episodes.length-1} className="btn-hover"
                    style={{ padding:"9px 22px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:activeEp===series.episodes.length-1?"#404060":"#E8E0D0", cursor:activeEp===series.episodes.length-1?"not-allowed":"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Reset */}
            <div style={{ textAlign:"center", marginTop:20 }}>
              <button onClick={()=>{setSeries(null);setConcept("");setCharImages({});setRefSheets({});}} className="btn-hover"
                style={{ padding:"9px 24px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#8080A0", cursor:"pointer", fontSize:12, fontFamily:"'Georgia',serif" }}>
                ↺ Start New Series
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
