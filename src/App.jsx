import { useState, useRef, useEffect } from "react";

const SERIES_SYSTEM = `You are a TikTok short drama series writer and AI video prompt expert specializing in acting direction.

CRITICAL OUTPUT RULES: Output ONLY valid JSON. No markdown. No backticks. No explanation. Raw JSON only. All strings use double quotes. No line breaks inside string values.

Output this exact structure:
{"title":"Series title","genre":"Genre","hook":"One viral hook line","characters":[{"name":"Name","role":"Role","arc":"Character arc","conflict":"Internal conflict"}],"episodes":[{"episode":1,"title":"Episode title","n4":{"hook":8,"hold":8,"emotion":8,"share":8,"total":32,"score":8.0,"rating":"Winner"},"prompt":"Video prompt here","subtext":"What is not said but felt","cliffhanger":"Hook to next episode"}]}

PROMPT FORMAT: Each prompt must weave in: (1) one micro-expression from contempt/happiness/anger/sadness/fear/disgust/surprise, (2) a micro-movement like gait/posture/eye shift/jaw tension, (3) vocal 4Ps: power pitch pace pause, (4) physical contradiction showing subtext, (5) presence not performance. NO BGM. NO text on screen. NO subtitles. 10 seconds. Keep each prompt under 80 words.
N4: Hook/Hold/Emotion/Share 0-10 each. Total/40 to /10. 9-10=Unicorn 8-8.9=Winner 7-7.9=Solid 6-6.9=Risky below 6=Trash.
5 episodes. 10 seconds each. Cliffhanger every episode. Output ONLY the JSON.`;

const LOOKS_SYSTEM = (tool) => `You are a costume and visual designer for AI video production.
Generate character looks for ONE episode as ONLY valid JSON:
{
  "character": "Name",
  "episode": 1,
  "attire": "Detailed outfit — fabric, color, cut, fit, accessories",
  "hairstyle": "Exact hairstyle — length, texture, color, styling",
  "front_prompt": "${tool==="jimeng"?"场景描述用中文。":""}Full body front view reference prompt. Neutral expression, arms slightly away from body, white background, fashion reference style. NO BGM. NO text.",
  "side_prompt": "${tool==="jimeng"?"场景描述用中文。":""}90 degree side profile, same outfit, white background. NO BGM. NO text.",
  "back_prompt": "${tool==="jimeng"?"场景描述用中文。":""}Full back view, same outfit, white background. NO BGM. NO text.",
  "closeup_prompt": "${tool==="jimeng"?"场景描述用中文。":""}Face close-up chin to top of head, soft studio lighting, neutral expression. NO BGM. NO text."
}
Output ONLY the JSON, nothing else`;

const FACE_SYSTEM = `You are a character visual analyst for AI video production.
Analyze the uploaded photo and output ONLY valid JSON:
{
  "face_description": "Extremely detailed face — bone structure, eye shape/color, nose, lips, skin tone (specific: warm honey/deep ebony/porcelain etc), eyebrows, jawline",
  "signature_features": ["3-5 most distinctive features"],
  "face_anchor_en": "One paragraph to prepend to ALL video prompts for face consistency. Specific facial features, skin tone, eye details.",
  "face_anchor_zh": "同上但用简体中文写，用于即梦提示词"
}
Output ONLY the JSON, nothing else`;

const ratingColor = (r) => ({Unicorn:"#FFD700",Winner:"#00FF88",Solid:"#60A5FA",Risky:"#FB923C"}[r]||"#F87171");
const ratingEmoji = (r) => ({Unicorn:"🦄",Winner:"🏆",Solid:"✅",Risky:"⚠️"}[r]||"🗑️");
const VIEWS = [{key:"front_prompt",label:"Front"},{key:"side_prompt",label:"Side"},{key:"back_prompt",label:"Back"},{key:"closeup_prompt",label:"Close-Up"}];
const toBase64 = (file) => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});

const callAPI = async (system, messages, maxTokens=2000) => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`API ${res.status}: ${msg}`);
  }
  const text = data.content?.find(b=>b.type==="text")?.text || "";
  if (!text) throw new Error("Empty response — no text block returned");
  return JSON.parse(text.replace(/```json|```/g,"").trim());
};

export default function App() {
  const [tool, setTool] = useState(() => localStorage.getItem("dsg_tool") || "flow");
  const [concept, setConcept] = useState(() => localStorage.getItem("dsg_concept") || "");
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState(() => { try { const s = localStorage.getItem("dsg_series"); return s ? JSON.parse(s) : null; } catch(e) { return null; } });
  const [activeEp, setActiveEp] = useState(0);
  const [activeTab, setActiveTab] = useState("prompt");
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState("");
  const [gdLoading, setGdLoading] = useState(false);

  // Character refs
  const [charImages, setCharImages] = useState({});
  const [faceSheets, setFaceSheets] = useState({});
  const [looksData, setLooksData] = useState({});
  const [faceLoading, setFaceLoading] = useState({});
  const [looksLoading, setLooksLoading] = useState({});
  const [activeChar, setActiveChar] = useState(null);
  const [activeView, setActiveView] = useState("front_prompt");
  const fileRefs = useRef({});

  // Auto-save to localStorage whenever series/concept/tool changes
  useEffect(() => { if (series) localStorage.setItem("dsg_series", JSON.stringify(series)); }, [series]);
  useEffect(() => { localStorage.setItem("dsg_concept", concept); }, [concept]);
  useEffect(() => { localStorage.setItem("dsg_tool", tool); }, [tool]);

  const exportToGoogleDrive = async () => {
    if (!series) return;
    setGdLoading(true);
    try {
      let content = `DRAMA SERIES: ${series.title}\nGENRE: ${series.genre}\nHOOK: ${series.hook}\nTOOL: ${tool.toUpperCase()}\n\n`;
      content += `CHARACTERS:\n`;
      series.characters?.forEach(c => { content += `- ${c.name} (${c.role}): ${c.arc}\n`; });
      content += `\n${"=".repeat(50)}\n\n`;
      series.episodes?.forEach(ep => {
        content += `EPISODE ${ep.episode}: ${ep.title}\n`;
        content += `N4 Score: ${ep.n4?.score}/10 (${ep.n4?.rating})\n`;
        content += `\nVIDEO PROMPT:\n${ep.prompt}\n`;
        content += `\nSUBTEXT: ${ep.subtext}\n`;
        content += `CLIFFHANGER: ${ep.cliffhanger}\n`;
        content += `\n${"-".repeat(40)}\n\n`;
      });
      const blob = new Blob([content], {type:"text/plain"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${series.title} - Drama Series.txt`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch(e) { console.error(e); }
    setGdLoading(false);
  };

  const generate = async () => {
    if (!concept.trim()) return;
    setLoading(true); setError(""); setSeries(null);
    try {
      const parsed = await callAPI(SERIES_SYSTEM, [{role:"user",content:`Story concept: ${concept}\nTool: ${tool}${tool==="jimeng"?" — write scene directions in Chinese, dialogue in English":""}`}]);
      setSeries(parsed);
      setActiveEp(0);
      setActiveTab("prompt");
      if (parsed.characters?.length) setActiveChar(parsed.characters[0].name);
    } catch(e) { setError(e.message||"Failed — try again"); }
    setLoading(false);
  };

  const handleImage = async (charName, file) => {
    if (!file) return;
    const base64 = await toBase64(file);
    const preview = URL.createObjectURL(file);
    setCharImages(prev=>({...prev,[charName]:{base64,mediaType:file.type||"image/jpeg",preview}}));
    setFaceSheets(prev=>{const n={...prev};delete n[charName];return n;});
  };

  const analyseFace = async (charName) => {
    const img = charImages[charName];
    if (!img) return;
    setFaceLoading(prev=>({...prev,[charName]:true}));
    try {
      const parsed = await callAPI(FACE_SYSTEM, [{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:img.mediaType,data:img.base64}},
        {type:"text",text:`Analyse this character: ${charName}`}
      ]}], 1000);
      setFaceSheets(prev=>({...prev,[charName]:parsed}));
    } catch(e) { console.error(e); }
    setFaceLoading(prev=>({...prev,[charName]:false}));
  };

  const generateLooks = async (charName, epNum) => {
    const key = `${charName}-ep${epNum}`;
    setLooksLoading(prev=>({...prev,[key]:true}));
    try {
      const ep = series?.episodes?.find(e=>e.episode===epNum);
      const char = series?.characters?.find(c=>c.name===charName);
      const parsed = await callAPI(LOOKS_SYSTEM(tool), [{role:"user",content:`Character: ${charName}\nRole: ${char?.role||""}\nEpisode ${epNum}: ${ep?.title||""}\nScene: ${ep?.prompt?.substring(0,100)||""}`}], 1000);
      setLooksData(prev=>({...prev,[key]:parsed}));
    } catch(e) { console.error(e); }
    setLooksLoading(prev=>({...prev,[key]:false}));
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(()=>setCopied(null),2000);
  };

  const ep = series?.episodes?.[activeEp];
  const looksKey = activeChar ? `${activeChar}-ep${ep?.episode}` : null;
  const currentLooks = looksKey ? looksData[looksKey] : null;
  const faceSheet = activeChar ? faceSheets[activeChar] : null;
  const faceAnchor = faceSheet ? (tool==="jimeng" ? faceSheet.face_anchor_zh : faceSheet.face_anchor_en) : null;

  return (
    <div style={{minHeight:"100vh",background:"#09090f",color:"#e8e0d0",fontFamily:"Georgia,serif",padding:"24px 16px"}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        button:hover{opacity:0.85;} textarea:focus{border-color:#ff4d6d!important;outline:none;}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#333}
      `}</style>

      {/* Header */}
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#ff4d6d",textTransform:"uppercase",marginBottom:8}}>TikTok Drama Series</div>
        <h1 style={{fontSize:"clamp(24px,5vw,44px)",fontWeight:400,margin:0,background:"linear-gradient(135deg,#FFD700,#ff4d6d,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Drama Generator
        </h1>
        <p style={{color:"#606080",fontSize:12,marginTop:6}}>Concept → 5 Episodes + Character Sheets → Paste into your AI video tool</p>
      </div>

      {/* Tool selector */}
      <div style={{display:"flex",gap:8,marginBottom:16,justifyContent:"center"}}>
        {[{id:"flow",label:"Google Flow"},{id:"dola",label:"Dola"},{id:"jimeng",label:"Jimeng 中文"}].map(t=>(
          <button key={t.id} onClick={()=>setTool(t.id)}
            style={{padding:"8px 16px",background:tool===t.id?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)",border:tool===t.id?"1px solid #ff4d6d":"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:tool===t.id?"#ff4d6d":"#808090",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{textAlign:"center",fontSize:11,color:"#504040",marginBottom:16,padding:"5px 12px",background:"rgba(255,215,0,0.03)",border:"1px solid rgba(255,215,0,0.08)",borderRadius:8}}>
        ✦ No BGM · No text on screen · No subtitles · 10 seconds
      </div>

      {/* Input */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:18,marginBottom:16}}>
        <label style={{fontSize:10,letterSpacing:4,color:"#ff4d6d",textTransform:"uppercase",display:"block",marginBottom:8}}>Your Story Concept</label>
        <textarea value={concept} onChange={e=>setConcept(e.target.value)}
          placeholder="e.g. A CEO discovers the cleaner at his office is his company's secret investor..."
          style={{width:"100%",minHeight:80,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#e8e0d0",fontSize:14,padding:"12px",resize:"vertical",fontFamily:"Georgia,serif",lineHeight:1.6,boxSizing:"border-box"}}
        />
        <button onClick={generate} disabled={loading||!concept.trim()}
          style={{marginTop:12,width:"100%",padding:"14px",background:loading?"rgba(255,77,109,0.3)":"linear-gradient(135deg,#ff4d6d,#c084fc)",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontFamily:"Georgia,serif",cursor:loading?"not-allowed":"pointer",fontWeight:600,letterSpacing:1}}>
          {loading?"✦ Generating…":`✦ Generate for ${tool==="flow"?"Google Flow":tool==="dola"?"Dola":"Jimeng"}`}
        </button>
        {error && <div style={{marginTop:10,padding:"8px 12px",background:"rgba(248,65,65,0.08)",border:"1px solid rgba(248,65,65,0.2)",borderRadius:8,fontSize:12,color:"#f87171",fontFamily:"monospace",wordBreak:"break-all"}}>{error}</div>}
      </div>

      {/* Results */}
      {series && (
        <div style={{animation:"fadeIn 0.4s ease"}}>

          {/* Series banner */}
          <div style={{background:"linear-gradient(135deg,rgba(255,77,109,0.08),rgba(192,132,252,0.08))",border:"1px solid rgba(255,77,109,0.25)",borderRadius:14,padding:18,marginBottom:14}}>
            <div style={{fontSize:10,letterSpacing:4,color:"#ff4d6d",textTransform:"uppercase",marginBottom:4}}>{series.genre}</div>
            <h2 style={{margin:"0 0 6px",fontSize:20,fontWeight:400}}>{series.title}</h2>
            <p style={{margin:0,color:"#ffd700",fontStyle:"italic",fontSize:13}}>"{series.hook}"</p>
          </div>

          {/* Characters */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}}>
            {series.characters?.map((c,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  {charImages[c.name]
                    ? <img src={charImages[c.name].preview} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:"2px solid #c084fc"}} alt="" />
                    : <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(192,132,252,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>◈</div>}
                  <div>
                    <div style={{color:"#c084fc",fontWeight:600,fontSize:13}}>{c.name}</div>
                    <div style={{color:"#8080a0",fontSize:10}}>{c.role}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:"#b0a090",marginBottom:6}}>{c.arc}</div>
                <div style={{fontSize:10,color:"#ff4d6d",fontStyle:"italic",marginBottom:8}}>↯ {c.conflict}</div>
                <input ref={el=>fileRefs.current[c.name]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImage(c.name,e.target.files[0])} />
                <button onClick={()=>fileRefs.current[c.name]?.click()}
                  style={{width:"100%",padding:"4px 0",background:"rgba(192,132,252,0.1)",border:"1px solid rgba(192,132,252,0.2)",borderRadius:6,color:"#c084fc",fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif"}}>
                  {charImages[c.name]?"✓ Photo · Change":"+ Upload Photo"}
                </button>
                {charImages[c.name] && !faceSheets[c.name] && (
                  <button onClick={()=>analyseFace(c.name)} disabled={faceLoading[c.name]}
                    style={{width:"100%",marginTop:4,padding:"4px 0",background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:6,color:"#ffd700",fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif"}}>
                    {faceLoading[c.name]?"Analysing…":"✦ Analyse Face"}
                  </button>
                )}
                {faceSheets[c.name] && <div style={{marginTop:4,fontSize:9,color:"#00ff88",textAlign:"center"}}>✓ Face anchor ready</div>}
              </div>
            ))}
          </div>

          {/* Episode tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {series.episodes?.map((e,i)=>(
              <button key={i} onClick={()=>{setActiveEp(i);setActiveTab("prompt");}}
                style={{padding:"7px 14px",background:activeEp===i?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)",border:activeEp===i?"1px solid #ff4d6d":"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:activeEp===i?"#ff4d6d":"#8080a0",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
                EP {e.episode}
              </button>
            ))}
          </div>

          {/* Episode panel */}
          {ep && (
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:18}}>

              {/* Ep header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:16}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:3,color:"#8080a0",textTransform:"uppercase",marginBottom:4}}>Episode {ep.episode} · 10s</div>
                  <h3 style={{margin:0,fontSize:18,fontWeight:400}}>{ep.title}</h3>
                </div>
                {ep.n4 && (
                  <div style={{background:"rgba(0,0,0,0.3)",border:`1px solid ${ratingColor(ep.n4.rating)}25`,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#606080",textTransform:"uppercase",letterSpacing:2,marginBottom:2}}>N4</div>
                    <div style={{fontSize:20,fontWeight:700,color:ratingColor(ep.n4.rating)}}>{ep.n4.score}/10</div>
                    <div style={{fontSize:10,color:ratingColor(ep.n4.rating)}}>{ratingEmoji(ep.n4.rating)} {ep.n4.rating}</div>
                    <div style={{display:"flex",gap:6,marginTop:4,justifyContent:"center"}}>
                      {["hook","hold","emotion","share"].map(k=>(
                        <div key={k} style={{textAlign:"center"}}>
                          <div style={{fontSize:8,color:"#505070",textTransform:"uppercase"}}>{k[0]}</div>
                          <div style={{fontSize:11,color:ep.n4[k]>=8?"#00ff88":ep.n4[k]>=7?"#60a5fa":"#f87171"}}>{ep.n4[k]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Inner tabs */}
              <div style={{display:"flex",gap:6,marginBottom:16}}>
                {["prompt","refsheet"].map(t=>(
                  <button key={t} onClick={()=>setActiveTab(t)}
                    style={{padding:"7px 16px",background:activeTab===t?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)",border:activeTab===t?"1px solid #ff4d6d":"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:activeTab===t?"#ff4d6d":"#8080a0",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
                    {t==="prompt"?"◈ Video Prompt":"◧ Character Refs"}
                  </button>
                ))}
              </div>

              {/* PROMPT TAB */}
              {activeTab==="prompt" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:10,letterSpacing:3,color:"#ff4d6d",textTransform:"uppercase"}}>Video Prompt · EP{ep.episode}</div>
                    <button onClick={()=>copy(ep.prompt,`p${activeEp}`)}
                      style={{padding:"4px 12px",background:copied===`p${activeEp}`?"rgba(0,255,136,0.15)":"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:copied===`p${activeEp}`?"#00ff88":"#e8e0d0",cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif"}}>
                      {copied===`p${activeEp}`?"✓ Copied!":"Copy"}
                    </button>
                  </div>
                  <div style={{background:"rgba(255,77,109,0.04)",border:"1px solid rgba(255,77,109,0.12)",borderRadius:8,padding:14,fontSize:13,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap",marginBottom:14}}>
                    {ep.prompt}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div style={{background:"rgba(192,132,252,0.04)",border:"1px solid rgba(192,132,252,0.12)",borderRadius:8,padding:12}}>
                      <div style={{fontSize:10,letterSpacing:3,color:"#c084fc",textTransform:"uppercase",marginBottom:6}}>Subtext</div>
                      <p style={{margin:0,fontSize:12,color:"#a090b0",fontStyle:"italic",lineHeight:1.6}}>"{ep.subtext}"</p>
                    </div>
                    <div style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.12)",borderRadius:8,padding:12}}>
                      <div style={{fontSize:10,letterSpacing:3,color:"#ffd700",textTransform:"uppercase",marginBottom:6}}>⚡ Cliffhanger</div>
                      <p style={{margin:0,fontSize:12,color:"#c0a860",lineHeight:1.6}}>{ep.cliffhanger}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* REF SHEET TAB */}
              {activeTab==="refsheet" && (
                <div>
                  {/* Character selector */}
                  <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                    {series.characters?.map((c,i)=>(
                      <button key={i} onClick={()=>{setActiveChar(c.name);setActiveView("front_prompt");}}
                        style={{padding:"6px 14px",display:"flex",alignItems:"center",gap:6,background:activeChar===c.name?"rgba(192,132,252,0.2)":"rgba(255,255,255,0.04)",border:activeChar===c.name?"1px solid #c084fc":"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:activeChar===c.name?"#c084fc":"#8080a0",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
                        {charImages[c.name] && <img src={charImages[c.name].preview} style={{width:18,height:18,borderRadius:"50%",objectFit:"cover"}} alt="" />}
                        {c.name} {faceSheets[c.name] && <span style={{color:"#00ff88",fontSize:10}}>✓</span>}
                      </button>
                    ))}
                  </div>

                  {activeChar && (
                    <div>
                      {/* Face anchor */}
                      {faceAnchor && (
                        <div style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:10,padding:14,marginBottom:14}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <div style={{fontSize:10,letterSpacing:3,color:"#ffd700",textTransform:"uppercase"}}>◉ Face Anchor — Prepend to ALL prompts</div>
                            <button onClick={()=>copy(faceAnchor,`fa-${activeChar}`)}
                              style={{padding:"3px 10px",background:copied===`fa-${activeChar}`?"rgba(0,255,136,0.15)":"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:copied===`fa-${activeChar}`?"#00ff88":"#e8e0d0",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>
                              {copied===`fa-${activeChar}`?"✓ Copied!":"Copy"}
                            </button>
                          </div>
                          <p style={{margin:"0 0 8px",fontSize:12,color:"#c0a860",lineHeight:1.7,fontStyle:"italic"}}>{faceAnchor}</p>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {faceSheets[activeChar]?.signature_features?.map((f,i)=>(
                              <span key={i} style={{padding:"2px 8px",background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:20,fontSize:10,color:"#c0a860"}}>{f}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upload / Analyse */}
                      {!charImages[activeChar] && (
                        <div style={{textAlign:"center",padding:"24px",background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:10,marginBottom:14}}>
                          <div style={{fontSize:24,marginBottom:8}}>📸</div>
                          <p style={{color:"#8080a0",fontSize:12,marginBottom:12}}>Upload a photo of {activeChar} for face anchor + reference views</p>
                          <input ref={el=>fileRefs.current[activeChar]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImage(activeChar,e.target.files[0])} />
                          <button onClick={()=>fileRefs.current[activeChar]?.click()}
                            style={{padding:"8px 20px",background:"rgba(192,132,252,0.15)",border:"1px solid rgba(192,132,252,0.3)",borderRadius:8,color:"#c084fc",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
                            Upload Photo
                          </button>
                        </div>
                      )}

                      {charImages[activeChar] && !faceSheets[activeChar] && (
                        <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:10,padding:12,marginBottom:14}}>
                          <img src={charImages[activeChar].preview} style={{width:44,height:44,borderRadius:"50%",objectFit:"cover",border:"2px solid #ffd700"}} alt="" />
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:"#e8e0d0",marginBottom:2}}>Photo ready for {activeChar}</div>
                            <div style={{fontSize:10,color:"#8080a0"}}>Analyse to generate face anchor {tool==="jimeng"?"in Chinese":""}</div>
                          </div>
                          <button onClick={()=>analyseFace(activeChar)} disabled={faceLoading[activeChar]}
                            style={{padding:"8px 14px",background:"linear-gradient(135deg,#ffd700,#fb923c)",border:"none",borderRadius:8,color:"#000",cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif",fontWeight:700,whiteSpace:"nowrap"}}>
                            {faceLoading[activeChar]?"Analysing…":"✦ Analyse"}
                          </button>
                        </div>
                      )}

                      {/* Generate Looks button */}
                      <div style={{marginBottom:14}}>
                        <button onClick={()=>generateLooks(activeChar,ep.episode)} disabled={looksLoading[looksKey]}
                          style={{width:"100%",padding:"10px",background:currentLooks?"rgba(0,255,136,0.1)":"rgba(255,77,109,0.15)",border:`1px solid ${currentLooks?"rgba(0,255,136,0.3)":"rgba(255,77,109,0.3)"}`,borderRadius:8,color:currentLooks?"#00ff88":"#ff4d6d",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif",fontWeight:600}}>
                          {looksLoading[looksKey]?"✦ Generating looks…":currentLooks?"✓ Looks generated · Regenerate":"✦ Generate EP"+ep.episode+" Looks for "+activeChar}
                        </button>
                      </div>

                      {/* Attire & Hairstyle */}
                      {currentLooks && (
                        <div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                            <div style={{background:"rgba(255,77,109,0.04)",border:"1px solid rgba(255,77,109,0.15)",borderRadius:8,padding:12}}>
                              <div style={{fontSize:10,letterSpacing:3,color:"#ff4d6d",textTransform:"uppercase",marginBottom:6}}>EP{ep.episode} Attire</div>
                              <p style={{margin:0,fontSize:12,color:"#c8c0b0",lineHeight:1.7}}>{currentLooks.attire}</p>
                            </div>
                            <div style={{background:"rgba(192,132,252,0.04)",border:"1px solid rgba(192,132,252,0.15)",borderRadius:8,padding:12}}>
                              <div style={{fontSize:10,letterSpacing:3,color:"#c084fc",textTransform:"uppercase",marginBottom:6}}>EP{ep.episode} Hairstyle</div>
                              <p style={{margin:0,fontSize:12,color:"#c8c0b0",lineHeight:1.7}}>{currentLooks.hairstyle}</p>
                            </div>
                          </div>

                          {/* 4 Views */}
                          <div style={{fontSize:10,letterSpacing:4,color:"#8080a0",textTransform:"uppercase",marginBottom:10}}>Reference View Prompts</div>
                          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                            {VIEWS.map(v=>(
                              <button key={v.key} onClick={()=>setActiveView(v.key)}
                                style={{padding:"6px 12px",background:activeView===v.key?"rgba(255,77,109,0.2)":"rgba(255,255,255,0.04)",border:activeView===v.key?"1px solid #ff4d6d":"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:activeView===v.key?"#ff4d6d":"#8080a0",cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif"}}>
                                {v.label}
                              </button>
                            ))}
                          </div>

                          {VIEWS.map(v => activeView===v.key && currentLooks[v.key] && (
                            <div key={v.key}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                                <div style={{fontSize:11,color:"#c084fc"}}>{v.label} · EP{ep.episode} · {activeChar}</div>
                                <button onClick={()=>copy(faceAnchor?`${faceAnchor}\n\n${currentLooks[v.key]}`:currentLooks[v.key],`v-${activeChar}-${v.key}`)}
                                  style={{padding:"4px 12px",background:copied===`v-${activeChar}-${v.key}`?"rgba(0,255,136,0.15)":"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:copied===`v-${activeChar}-${v.key}`?"#00ff88":"#e8e0d0",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>
                                  {copied===`v-${activeChar}-${v.key}`?"✓ Copied!":faceAnchor?"Copy with Face Anchor":"Copy"}
                                </button>
                              </div>
                              <div style={{background:"rgba(192,132,252,0.03)",border:"1px solid rgba(192,132,252,0.12)",borderRadius:8,padding:14,fontSize:12,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap"}}>
                                {faceAnchor?`[FACE ANCHOR]\n${faceAnchor}\n\n[VIEW PROMPT]\n${currentLooks[v.key]}`:currentLooks[v.key]}
                              </div>
                              {faceAnchor && <p style={{fontSize:10,color:"#505070",marginTop:6,fontStyle:"italic"}}>✦ Face anchor prepended for consistency</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Nav */}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:18}}>
                <button onClick={()=>setActiveEp(Math.max(0,activeEp-1))} disabled={activeEp===0}
                  style={{padding:"8px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:activeEp===0?"#404060":"#e8e0d0",cursor:activeEp===0?"not-allowed":"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
                  ← Prev
                </button>
                <button onClick={()=>copy(ep.prompt,`m${activeEp}`)}
                  style={{padding:"8px 20px",background:copied===`m${activeEp}`?"rgba(0,255,136,0.15)":"linear-gradient(135deg,#ff4d6d,#c084fc)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif",fontWeight:600}}>
                  {copied===`m${activeEp}`?"✓ Copied!":"Copy → Paste into "+tool.toUpperCase()}
                </button>
                <button onClick={()=>setActiveEp(Math.min(series.episodes.length-1,activeEp+1))} disabled={activeEp===series.episodes.length-1}
                  style={{padding:"8px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:activeEp===series.episodes.length-1?"#404060":"#e8e0d0",cursor:activeEp===series.episodes.length-1?"not-allowed":"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
                  Next →
                </button>
              </div>
            </div>
          )}

          <div style={{textAlign:"center",marginTop:14,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={exportToGoogleDrive} disabled={gdLoading}
              style={{padding:"8px 20px",background:"rgba(0,200,100,0.1)",border:"1px solid rgba(0,200,100,0.25)",borderRadius:8,color:"#00c864",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
              {gdLoading?"Exporting…":"⬇ Download / Export"}
            </button>
            <button onClick={()=>{setSeries(null);setConcept("");setCharImages({});setFaceSheets({});setLooksData({});localStorage.removeItem("dsg_series");localStorage.removeItem("dsg_concept");}}
              style={{padding:"8px 20px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#606080",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>
              ↺ New Series
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
