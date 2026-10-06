const SERVER_INFO={name:"google-docs-api",version:"1.6.1"};
const PROTOCOL_VERSION="2024-11-05",TOKEN_URL="https://oauth2.googleapis.com/token",AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth",KV_KEY="google_oauth_tokens";
const SCOPES="https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";
async function getTokens(e){const x=await e.GOOGLE_TOKENS.get(KV_KEY);return x?JSON.parse(x):null}
async function saveTokens(e,t){const o=await getTokens(e);await e.GOOGLE_TOKENS.put(KV_KEY,JSON.stringify({access_token:t.access_token,refresh_token:t.refresh_token||o?.refresh_token,expires_at:Date.now()+(t.expires_in||3600)*1000-60000}))}
async function refresh(e){const t=await getTokens(e);if(!t?.refresh_token)throw Error("No refresh token. Visit /auth to authorize.");const r=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(t.refresh_token)}&client_id=${encodeURIComponent(e.GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(e.GOOGLE_CLIENT_SECRET)}`});if(!r.ok)throw Error(`Token refresh failed (${r.status}): ${await r.text()}`);const d=await r.json();await saveTokens(e,d);return d.access_token}
async function token(e){const t=await getTokens(e);if(!t)throw Error("Not authorized. Visit /auth to connect Google.");return Date.now()<t.expires_at?t.access_token:refresh(e)}
async function api(e,b,m,p,x){const h={Authorization:`Bearer ${await token(e)}`,Accept:"application/json"};if(x!==undefined)h["Content-Type"]="application/json";const r=await fetch(b+p,{method:m,headers:h,body:x===undefined?undefined:JSON.stringify(x)}),s=await r.text();if(!r.ok)return{_error:true,status:r.status,body:s};try{return JSON.parse(s)}catch{return s}}
const docs=(e,m,p,b)=>api(e,"https://docs.googleapis.com/v1",m,p,b),drive=(e,m,p,b)=>api(e,"https://www.googleapis.com/drive/v3",m,p,b);
const out=x=>({content:[{type:"text",text:typeof x==="string"?x:JSON.stringify(x,null,2)}]}),url=id=>`https://docs.google.com/document/d/${id}/edit`;
const S={type:"string"},N={type:"number"},B={type:"boolean"},O={type:"object"};
function T(name,description,properties,required=[]){return{name,description,inputSchema:{type:"object",properties,required}}}
const TOOLS=[
 T("doc_create","Create a Google Doc with initial text.",{title:S,content:S,folderId:S},["title","content"]),
 T("doc_create_with_flow","Create a proposal Google Doc: lines wrapped in **double asterisks** become bold headings (markers stripped), and a Mermaid flowchart image of the plan steps is embedded right after the numbered list. Steps default to the numbered lines in content. Auto-shared anyone-with-link.",{title:S,content:S,steps:{type:"array",items:S},folderId:S,imageWidthPt:N},["title","content"]),
 T("doc_get","Read a Google Doc, including all tab content, as plain text.",{documentId:S},["documentId"]),
 T("doc_get_structure","Read the full structured Google Docs model, including tabs, paragraphs, tables, styles, and indexes.",{documentId:S},["documentId"]),
 T("doc_list_tabs","List all tabs and nested child tabs in a Google Doc.",{documentId:S},["documentId"]),
 T("doc_add_tab","Add a named tab, optionally as a child of another tab.",{documentId:S,title:S,parentTabId:S},["documentId","title"]),
 T("doc_update_tab","Rename or reorder an existing tab.",{documentId:S,tabId:S,title:S,index:N},["documentId","tabId"]),
 T("doc_delete_tab","Delete a tab by ID.",{documentId:S,tabId:S},["documentId","tabId"]),
 T("doc_append","Append text to the end of a selected tab.",{documentId:S,content:S,tabId:S},["documentId","content"]),
 T("doc_replace","Replace a selected tab's body with text.",{documentId:S,content:S,tabId:S},["documentId","content"]),
 T("doc_insert_text","Insert text at an exact index in a selected tab.",{documentId:S,index:N,content:S,tabId:S},["documentId","index","content"]),
 T("doc_delete_range","Delete a range in a selected tab.",{documentId:S,startIndex:N,endIndex:N,tabId:S},["documentId","startIndex","endIndex"]),
 T("doc_find_replace","Find and replace text throughout a document or selected tab.",{documentId:S,find:S,replace:S,matchCase:B,tabId:S},["documentId","find","replace"]),
 T("doc_update_text_style","Apply text formatting to a range in a selected tab.",{documentId:S,startIndex:N,endIndex:N,style:O,fields:S,tabId:S},["documentId","startIndex","endIndex","style","fields"]),
 T("doc_update_paragraph_style","Apply paragraph formatting to a range in a selected tab.",{documentId:S,startIndex:N,endIndex:N,style:O,fields:S,tabId:S},["documentId","startIndex","endIndex","style","fields"]),
 T("doc_insert_table","Insert a table in a selected tab.",{documentId:S,rows:N,columns:N,index:N,tabId:S},["documentId","rows","columns","index"]),
 T("doc_insert_image","Insert a public image in a selected tab.",{documentId:S,imageUrl:S,index:N,widthPt:N,heightPt:N,tabId:S},["documentId","imageUrl","index"]),
 T("doc_share","Share a Doc by link.",{documentId:S,role:S},["documentId"]),
 T("doc_build_proposal","Build a complete, fully formatted Upwork proposal Google Doc in ONE call. Validates the content first and creates nothing if any rule fails (5-6 steps; 3-6 word lead-ins ending in a period; max 2 steps with I'll; no I'd; exactly 3 deliverables; 350-450 words; no URLs or markdown in content; US spelling; link texts present). Then builds: greeting, intro, optional extra paragraphs, credibility paragraph with real links on the anchor text, the step-by-step line, the plan heading (Heading 3) with the flowchart directly under it (200pt wide, height from the real image ratio, labels = lead-ins), bold lead-ins, blank lines, optional closer line, What you'll get bullets, Timeline, 1.15 spacing, shared by link. Reads the doc back and returns code-verified layout checks.",{title:S,greeting:S,intro:S,extraParagraphs:{type:"array",items:S},credibility:S,links:{type:"array",items:{type:"object",properties:{text:S,url:S},required:["text","url"]}},heading:S,steps:{type:"array",items:{type:"object",properties:{leadin:S,body:S},required:["leadin","body"]}},closer:S,deliverables:{type:"array",items:S},timeline:S,folderId:S,diagramWidthPt:N},["title","greeting","intro","credibility","links","heading","steps","deliverables","timeline"]),
 T("doc_lint_application","Code check of an Upwork Application field (reference lines, letter, screening answers). Returns pass/fail plus counts: letter chars, I'd, hourly mentions, [ADAM] markers, bio intact, opener, flat-fee close, ending, markdown, British spelling, internal notes leaking into client text, answer paragraphs vs questionCount.",{application:S,gatePhrase:S,platform:S,questionCount:N},["application"])
];
function tabDoc(d,id){const tabs=d.tabs||[];function walk(a){for(const t of a){if(!id||t.tabProperties?.tabId===id)return t;const z=walk(t.childTabs||[]);if(z)return z}}return walk(tabs)}
function body(d,id){const t=tabDoc(d,id);return t?.documentTab?.body||d.body||{content:[]}}
function end(d,id){const c=body(d,id).content||[],x=c[c.length-1];return x?.endIndex?x.endIndex-1:1}
function flatTabs(ts=[],parent=null){return ts.flatMap(t=>[{tabId:t.tabProperties?.tabId,title:t.tabProperties?.title,index:t.tabProperties?.index,parentTabId:parent},...flatTabs(t.childTabs||[],t.tabProperties?.tabId)])}
function range(a,s,e){const r={startIndex:s,endIndex:e};if(a.tabId)r.tabId=a.tabId;return r}
function loc(a,i){const r={index:i};if(a.tabId)r.tabId=a.tabId;return r}
function b64u(s){const b=new TextEncoder().encode(s);let x="";for(const c of b)x+=String.fromCharCode(c);return btoa(x).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function lbl(s){s=String(s).replace(/^\d+[.)]\s*/,"").split(/\s[-:]\s/)[0].replace(/["`]/g,"'").replace(/[\[\]{}()<>|#;]/g," ").trim();return s.length>48?s.slice(0,45).trim()+"...":s}
function mermaid(steps){let m="flowchart TD\n";steps.forEach((s,i)=>{m+=`  S${i+1}["${i+1}. ${lbl(s)}"]\n`;if(i)m+=`  S${i} --> S${i+1}\n`});return m}
function prep(content){const lines=String(content).split("\n"),heads=[],nums=[];let text="",i=1;for(const raw of lines){const h=raw.trim().match(/^\*\*(.+?)\*\*:?$/);const line=h?h[1].trim():raw;const len=line.length;if(h&&len)heads.push([i,i+len]);if(/^\s*\d+[.)]\s+\S/.test(line))nums.push({text:line.trim(),end:i+len+1});text+=line+"\n";i+=len+1}return{text,heads,nums}}
async function perm(e,id,role="reader"){return fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`,{method:"POST",headers:{Authorization:`Bearer ${await token(e)}`,"Content-Type":"application/json"},body:JSON.stringify({role,type:"anyone"})})}
// ---- v1.6: one-call Upwork proposal builder + application lint ----
const STEP_LINE="Here's a step-by-step, along with my reasoning at every point:";
const FLAT_CLOSE="Flat fee, we agree on the outcome up front - no hourly meter. Send a couple of times that work and we'll do a quick 15 minutes.";
const BIO_RE=/A bit about me: I'm new to Upwork, but not new to (.+?) - I've been doing it for 10\+ years, using a testing process I developed at Harvard\. (?:We're the #1-rated conversion agency in Unbounce's directory \(verify: https:\/\/unbounce\.partnerpage\.io\/\), and I've|I've) been a featured speaker at Wharton and Google's Digital Breakfast\./;
const BRIT=/\b(optimis\w*|colour\w*|analys(?:e|ed|es|ing)|centre\w*|licence|defence|programme\w*|behaviour\w*|organis\w*|favour\w*|enquir\w*)\b/gi;
const LEAK=/(I won't invent|role log|person-by-person|scraper|Lead Score|as an AI|placeholder)/gi;
const WC=s=>(String(s||"").match(/\S+/g)||[]).length;
const norm=s=>String(s||"").replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"');
function paras(a){const P=[],add=(t,k,x={})=>P.push({t:String(t),k,...x}),gap=()=>add("","blank");
 add(norm(a.greeting).trim(),"p");gap();add(norm(a.intro).trim(),"p");gap();
 for(const x of a.extraParagraphs||[])if(String(x).trim()){add(norm(x).trim(),"p");gap()}
 add(norm(a.credibility).trim(),"p");gap();add(STEP_LINE,"p");gap();
 add(norm(a.heading).trim(),"h");add("","img");gap();
 (a.steps||[]).forEach((s,i)=>{const n=`${i+1}. `,L=norm(s.leadin).trim();add(`${n}${L} ${norm(s.body).trim()}`,"step",{ls:n.length,ll:L.length});gap()});
 if(String(a.closer||"").trim()){add(norm(a.closer).trim(),"p");gap()}
 add("What you'll get","h");for(const d of a.deliverables||[])add(`• ${norm(d).trim()}`,"bullet");gap();
 add("Timeline","h");add(norm(a.timeline).trim(),"p");return P}
function proposalErrors(a){const E=[],Wn=[],st=Array.isArray(a.steps)?a.steps:[];
 for(const k of["title","greeting","intro","credibility","heading","timeline"])if(!String(a[k]||"").trim())E.push(`${k} is required`);
 if(a.greeting&&!/^Hey\b/.test(a.greeting.trim()))E.push('greeting must start with "Hey"');
 if(st.length<5||st.length>6)E.push(`need 5 or 6 steps, got ${st.length}`);
 let ill=0;st.forEach((s,i)=>{const L=norm(s.leadin).trim(),Bd=norm(s.body).trim();
  if(!/\.$/.test(L))E.push(`step ${i+1} lead-in must end with a period`);
  const lw=WC(L);if(lw<3||lw>6)E.push(`step ${i+1} lead-in is ${lw} words, needs 3-6`);
  if(!Bd)E.push(`step ${i+1} body is empty`);
  const sw=WC(L)+WC(Bd);if(sw>50)E.push(`step ${i+1} is ${sw} words, max about 40`);else if(sw>44)Wn.push(`step ${i+1} is ${sw} words`);
  if(/\bI'll\b/i.test(L+" "+Bd))ill++;
  const sn=(Bd.match(/[.!?](?=\s|$)/g)||[]).length;if(sn>2)Wn.push(`step ${i+1} body may have ${sn} sentences, max 2`)});
 if(ill>2)E.push(`${ill} steps contain "I'll", max 2`);
 const dl=Array.isArray(a.deliverables)?a.deliverables:[];if(dl.length!==3)E.push(`need exactly 3 deliverables, got ${dl.length}`);
 dl.forEach((d,i)=>{if(WC(d)>12)Wn.push(`deliverable ${i+1} is ${WC(d)} words, keep it short`)});
 if(/\n/.test(a.timeline||""))E.push("timeline must be one line");
 if(st.length!==5&&st.length!==6)return{errors:E,warnings:Wn,wordCount:0};
 const all=paras(a).map(p=>p.t).join("\n");
 if(/\bI'd\b/i.test(all))E.push(`"I'd" found`);
 if(/https?:\/\/|www\./i.test(all))E.push("raw URL in content; use anchor text and pass links");
 if(/\[[^\]]+\]\([^)]*\)/.test(all)||/\*\*/.test(all))E.push("markdown found in content");
 const br=all.match(BRIT);if(br)E.push(`British spelling: ${[...new Set(br)].join(", ")}`);
 const lk=Array.isArray(a.links)?a.links:[];if(!lk.length)E.push("links required (Unbounce partner directory and the case study)");
 lk.forEach(l=>{if(!all.includes(norm(l.text)))E.push(`link text not found in content: "${l.text}"`);if(!/^https?:\/\//.test(l.url||""))E.push(`bad url for "${l.text}"`)});
 const wc=WC(all);if(wc<350||wc>450)E.push(`word count ${wc}, needs 350-450`);
 return{errors:E,warnings:Wn,wordCount:wc}}
async function zlibB64u(s){const cs=new CompressionStream("deflate"),w=cs.writable.getWriter();w.write(new TextEncoder().encode(s));w.close();const b=new Uint8Array(await new Response(cs.readable).arrayBuffer());let x="";for(const c of b)x+=String.fromCharCode(c);return btoa(x).replace(/\+/g,"-").replace(/\//g,"_")}
async function pngDims(u){try{const r=await fetch(u);if(!r.ok)return null;const b=new Uint8Array(await r.arrayBuffer());if(b.length<24||b[1]!==0x50||b[2]!==0x4E||b[3]!==0x47)return null;const v=new DataView(b.buffer,b.byteOffset);return{w:v.getUint32(16),h:v.getUint32(20)}}catch{return null}}
const ptxt=x=>(x?.paragraph?.elements||[]).map(y=>y.textRun?.content||"").join("");
const pimg=x=>(x?.paragraph?.elements||[]).some(y=>y.inlineObjectElement);
function verifyDoc(d,a){const C=(d.body?.content||[]).filter(x=>x.paragraph),ck={};
 const isH=x=>x.paragraph.paragraphStyle?.namedStyleType==="HEADING_3";
 const hs=C.map((x,i)=>i).filter(i=>isH(C[i]));
 ck.threeHeadingsAreH3=hs.length===3;
 const hi=C.findIndex(x=>ptxt(x).trim()===norm(a.heading).trim()),ii=C.findIndex(pimg),s1=C.findIndex(x=>/^1\. /.test(ptxt(x)));
 ck.diagramDirectlyUnderHeading=hi>=0&&ii===hi+1&&s1>ii&&C.filter(pimg).length===1;
 const ob=Object.values(d.inlineObjects||{})[0]?.inlineObjectProperties?.embeddedObject?.size;
 ck.diagramWidth200WithHeight=!!ob&&Math.abs((ob.width?.magnitude||0)-(a.diagramWidthPt||200))<0.5&&(ob.height?.magnitude||0)>50;
 ck.lineSpacing115=C.slice(0,-1).every(x=>x.paragraph.paragraphStyle?.lineSpacing===115);
 ck.threeBulletLines=C.filter(x=>ptxt(x).startsWith("• ")).length===3;
 const steps=C.filter(x=>/^\d+\. /.test(ptxt(x)));
 ck.stepCountMatches=steps.length===(a.steps||[]).length;
 ck.blankLineBetweenSteps=steps.every((x,k)=>{if(k===steps.length-1)return true;const j=C.indexOf(x);return ptxt(C[j+1]).trim()===""&&!pimg(C[j+1])&&C[j+2]===steps[k+1]});
 ck.leadinsBoldBodyNot=steps.every((x,k)=>{const L=norm(a.steps[k].leadin).trim(),b=(x.paragraph.elements||[]).filter(y=>y.textRun?.textStyle?.bold).map(y=>y.textRun.content).join("");return b.trim()===L});
 ck.noBlankUnderHeadings=hs.every(i=>C[i+1]&&(pimg(C[i+1])||ptxt(C[i+1]).trim()!==""));
 ck.blankAfterGreeting=ptxt(C[1]).trim()===""&&ptxt(C[2]).trim()!=="";
 const lt=C.flatMap(x=>(x.paragraph.elements||[]).filter(y=>y.textRun?.textStyle?.link).map(y=>y.textRun.content)).join("|");
 ck.linksApplied=(a.links||[]).every(l=>lt.includes(norm(l.text)));
 ck.noRawUrlsOrMarkdown=!/https?:\/\/|\*\*|\]\(/.test(C.map(ptxt).join(""));
 const keys=Object.keys(ck),failed=keys.filter(k=>!ck[k]);return{checks:ck,passed:keys.length-failed.length,total:keys.length,failed}}
async function buildProposal(e,a){const chk=proposalErrors(a);
 if(chk.errors.length)return out({built:false,errors:chk.errors,warnings:chk.warnings,wordCount:chk.wordCount,next:"Nothing was created. Fix every error in the content and call doc_build_proposal again."});
 const P=paras(a);let i=1;for(const p of P){p.s=i;i+=p.t.length+1}const text=P.map(p=>p.t).join("\n"),endI=1+text.length;
 const title=String(a.title).replace(/\s+/g," ").trim();
 let id,discarded=0;for(let k=0;k<10;k++){const d=await docs(e,"POST","/documents",{title});if(d._error)return out({built:false,stage:"create",error:d,discarded});if(!String(d.documentId).includes("_")){id=d.documentId;break}const x=await drive(e,"DELETE",`/files/${d.documentId}`);if(x&&x._error)await drive(e,"PATCH",`/files/${d.documentId}`,{trashed:true});discarded++}
 if(!id)return out({built:false,stage:"create",error:"10 tries and every doc ID had an underscore. Call again.",discarded});
 const q=[{insertText:{location:{index:1},text}},{updateParagraphStyle:{range:{startIndex:1,endIndex:endI},paragraphStyle:{lineSpacing:115},fields:"lineSpacing"}}];
 for(const p of P){if(p.k==="h")q.push({updateParagraphStyle:{range:{startIndex:p.s,endIndex:p.s+p.t.length+1},paragraphStyle:{namedStyleType:"HEADING_3"},fields:"namedStyleType"}});
  if(p.k==="step")q.push({updateTextStyle:{range:{startIndex:p.s+p.ls,endIndex:p.s+p.ls+p.ll},textStyle:{bold:true},fields:"bold"}})}
 for(const l of a.links||[]){const t=norm(l.text),at=text.indexOf(t);if(at>=0)q.push({updateTextStyle:{range:{startIndex:1+at,endIndex:1+at+t.length},textStyle:{link:{url:l.url},underline:true,foregroundColor:{color:{rgbColor:{red:0.067,green:0.333,blue:0.8}}}},fields:"link,underline,foregroundColor"}})}
 let r=await docs(e,"POST",`/documents/${id}:batchUpdate`,{requests:q});if(r._error)return out({built:false,documentId:id,url:url(id),stage:"text",error:r});
 const labels=a.steps.map(s=>norm(s.leadin).trim().replace(/\.$/,"")),m=mermaid(labels),slot=P.find(p=>p.k==="img"),W0=a.diagramWidthPt||200;
 const srcs=[`https://mermaid.ink/img/${b64u(m)}?type=png&bgColor=FFFFFF`,`https://kroki.io/mermaid/png/${await zlibB64u(m)}`];
 let diagram={embedded:false,attempts:[]};
 for(const src of srcs){const host=src.split("/")[2],dim=await pngDims(src);if(!dim){diagram.attempts.push({host,error:"image fetch failed"});continue}
  const H=Math.round(W0*dim.h/dim.w*100)/100;
  for(let t=0;t<2&&!diagram.embedded;t++){r=await docs(e,"POST",`/documents/${id}:batchUpdate`,{requests:[{insertInlineImage:{location:{index:slot.s},uri:src,objectSize:{width:{magnitude:W0,unit:"PT"},height:{magnitude:H,unit:"PT"}}}}]});
   if(!r._error)diagram={embedded:true,host,widthPt:W0,heightPt:H,labels};else diagram.attempts.push({host,status:r.status})}
  if(diagram.embedded)break}
 if(a.folderId)await drive(e,"PATCH",`/files/${id}?addParents=${encodeURIComponent(a.folderId)}&fields=id`,{});
 const sh=await perm(e,id);
 const v=await docs(e,"GET",`/documents/${id}`),vr=v._error?{checks:{},passed:0,total:0,failed:["could not read doc back"]}:verifyDoc(v,a);
 return out({built:true,documentId:id,title,url:url(id),underscoreRetries:discarded,shared:sh.ok,wordCount:chk.wordCount,warnings:chk.warnings,diagram,layout:`${vr.passed}/${vr.total}`,failed:vr.failed,checks:vr.checks})}
function lintApplication(a){const raw=norm(a.application||""),parts=raw.split(/\n-{3,}\s*\n\s*Screening question answers[^\n]*\n/i);
 const letter=parts[0].split("\n").filter(l=>!/^(Proposal doc|Hello video|Job post):/.test(l.trim())).join("\n").trim(),answers=(parts[1]||"").trim(),both=letter+"\n"+answers,E=[],Wn=[];
 const lc=letter.length;if(lc>=5000)E.push(`letter is ${lc} chars, Upwork max is 5000`);else if(lc>3500)Wn.push(`letter is ${lc} chars, aim for 3500 or less`);
 const idc=(both.match(/\bI'd\b/gi)||[]).length;if(idc)E.push(`${idc} "I'd"`);
 const hr=(both.replace(/no hourly meter/gi,"").match(/\bhourly\b|\/\s?hr\b|per hour|\$\d+\s?\/\s?h\b/gi)||[]).length;if(hr)E.push(`${hr} hourly-rate mention(s)`);
 const am=(both.match(/\[ADAM:/g)||[]).length;if(am>2)E.push(`${am} [ADAM] markers, max 2`);
 const bio=letter.match(BIO_RE);if(!bio)E.push("bio is not intact (only the service may change; Unbounce sentence drops on GHL/ClickFunnels/Webflow)");
 if(a.platform&&/ghl|clickfunnels|webflow/i.test(a.platform)&&/unbounce/i.test(both))E.push("Unbounce mentioned on a GHL/ClickFunnels/Webflow job");
 const L=letter.split("\n");
 if(a.gatePhrase){if(L[0].trim()!==String(a.gatePhrase).trim())E.push("gate phrase is not alone on line 1, verbatim")}
 if(!/^(?:[^\n]+\n\s*\n)?Hi - I already built you a specific plan to /.test(letter))E.push('opener must be "Hi - I already built you a specific plan to ..."');
 if(!letter.includes(FLAT_CLOSE))E.push("flat-fee close is missing or edited");
 if(!/\n\s*Adam\s*$/.test(letter))E.push('letter must end with "Adam"');
 if(/\[[^\]]+\]\(https?:[^)]*\)|\*\*/.test(letter))E.push("markdown in letter (Upwork prints it literally)");
 const br=both.match(BRIT);if(br)E.push(`British spelling: ${[...new Set(br)].join(", ")}`);
 const lk=both.match(LEAK);if(lk)E.push(`internal note in client-facing text: ${[...new Set(lk)].join(", ")}`);
 const ac=answers?answers.split(/\n\s*\n/).filter(x=>x.trim()).length:0;
 if(a.questionCount!=null&&ac!==a.questionCount)E.push(`${ac} answer paragraphs for ${a.questionCount} screening questions`);
 return{pass:!E.length,errors:E,warnings:Wn,letterChars:lc,applicationChars:raw.length,idCount:idc,hourlyCount:hr,adamMarkers:am,bioService:bio?bio[1]:null,answerParagraphs:ac}}

async function handle(e,n,a={}){let d,r;
 switch(n){
 case"doc_create":d=await docs(e,"POST","/documents",{title:a.title});if(d._error)return out(d);if(a.content)await docs(e,"POST",`/documents/${d.documentId}:batchUpdate`,{requests:[{insertText:{location:{index:1},text:a.content}}]});if(a.folderId)await drive(e,"PATCH",`/files/${d.documentId}?addParents=${encodeURIComponent(a.folderId)}&fields=id`,{});await perm(e,d.documentId);return out({documentId:d.documentId,title:a.title,url:url(d.documentId),shared:true});
 case"doc_create_with_flow":{d=await docs(e,"POST","/documents",{title:a.title});if(d._error)return out(d);const id=d.documentId,p=prep(a.content||""),q=[{insertText:{location:{index:1},text:p.text}}];for(const[s,z]of p.heads)q.push({updateTextStyle:{range:{startIndex:s,endIndex:z},textStyle:{bold:true},fields:"bold"}});r=await docs(e,"POST",`/documents/${id}:batchUpdate`,{requests:q});if(r._error)return out({documentId:id,url:url(id),textInserted:false,error:r});const steps=(Array.isArray(a.steps)&&a.steps.length?a.steps:p.nums.map(x=>x.text)).filter(Boolean);let flow={embedded:false,reason:"no steps found"};if(steps.length){const m=mermaid(steps),img=`https://mermaid.ink/img/${b64u(m)}?type=png&bgColor=FFFFFF`;const at=p.nums.length?p.nums[p.nums.length-1].end:p.text.length+1;const w=await docs(e,"POST",`/documents/${id}:batchUpdate`,{requests:[{insertText:{location:{index:at},text:"\n"}},{insertInlineImage:{location:{index:at},uri:img,objectSize:{width:{magnitude:a.imageWidthPt||440,unit:"PT"}}}}]});flow=w._error?{embedded:false,imageUrl:img,mermaid:m,error:w}:{embedded:true,imageUrl:img,steps:steps.length}}if(a.folderId)await drive(e,"PATCH",`/files/${id}?addParents=${encodeURIComponent(a.folderId)}&fields=id`,{});await perm(e,id);return out({documentId:id,title:a.title,url:url(id),shared:true,headingsBolded:p.heads.length,flow})}
 case"doc_get":d=await docs(e,"GET",`/documents/${a.documentId}?includeTabsContent=true`);if(d._error)return out(d);return out({documentId:d.documentId,title:d.title,tabs:flatTabs(d.tabs||[]),content:(d.tabs||[]).map(t=>({tabId:t.tabProperties?.tabId,title:t.tabProperties?.title,text:(()=>{let s="";for(const x of t.documentTab?.body?.content||[])for(const y of x.paragraph?.elements||[])if(y.textRun?.content)s+=y.textRun.content;return s})()})),url:url(d.documentId)});
 case"doc_get_structure":d=await docs(e,"GET",`/documents/${a.documentId}?includeTabsContent=true`);return out(d);
 case"doc_list_tabs":d=await docs(e,"GET",`/documents/${a.documentId}?includeTabsContent=false`);return out(d._error?d:{documentId:a.documentId,tabs:flatTabs(d.tabs||[])});
 case"doc_add_tab":{const q={tabProperties:{title:a.title}};if(a.parentTabId)q.tabProperties.parentTabId=a.parentTabId;r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{addDocumentTab:q}]});return out({documentId:a.documentId,added:!r._error,response:r})}
 case"doc_update_tab":{const p={};if(a.title!==undefined)p.title=a.title;if(a.index!==undefined)p.index=a.index;r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{updateDocumentTabProperties:{tabProperties:{tabId:a.tabId,...p},fields:Object.keys(p).join(",")}}]});return out({documentId:a.documentId,updated:!r._error,response:r})}
 case"doc_delete_tab":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{deleteTab:{tabId:a.tabId}}]});return out({documentId:a.documentId,deleted:!r._error,response:r});
 case"doc_append":d=await docs(e,"GET",`/documents/${a.documentId}?includeTabsContent=true`);if(d._error)return out(d);r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{insertText:{location:loc(a,end(d,a.tabId)),text:a.content}}]});return out({documentId:a.documentId,appended:!r._error,response:r,url:url(a.documentId)});
 case"doc_replace":d=await docs(e,"GET",`/documents/${a.documentId}?includeTabsContent=true`);if(d._error)return out(d);{const z=end(d,a.tabId),q=[];if(z>1)q.push({deleteContentRange:{range:range(a,1,z)}});q.push({insertText:{location:loc(a,1),text:a.content}});r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:q});return out({documentId:a.documentId,replaced:!r._error,response:r,url:url(a.documentId)})}
 case"doc_insert_text":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{insertText:{location:loc(a,a.index),text:a.content}}]});return out({documentId:a.documentId,inserted:!r._error,response:r,url:url(a.documentId)});
 case"doc_delete_range":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{deleteContentRange:{range:range(a,a.startIndex,a.endIndex)}}]});return out({documentId:a.documentId,deleted:!r._error,response:r,url:url(a.documentId)});
 case"doc_find_replace":{const cr={text:a.find,matchCase:a.matchCase!==false};if(a.tabId)cr.tabIds=[a.tabId];r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{replaceAllText:{containsText:cr,replaceText:a.replace}}]});return out({documentId:a.documentId,replaced:!r._error,response:r,url:url(a.documentId)})}
 case"doc_update_text_style":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{updateTextStyle:{range:range(a,a.startIndex,a.endIndex),textStyle:a.style,fields:a.fields}}]});return out({documentId:a.documentId,styled:!r._error,response:r,url:url(a.documentId)});
 case"doc_update_paragraph_style":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{updateParagraphStyle:{range:range(a,a.startIndex,a.endIndex),paragraphStyle:a.style,fields:a.fields}}]});return out({documentId:a.documentId,styled:!r._error,response:r,url:url(a.documentId)});
 case"doc_insert_table":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{insertTable:{rows:a.rows,columns:a.columns,location:loc(a,a.index)}}]});return out({documentId:a.documentId,inserted:!r._error,response:r,url:url(a.documentId)});
 case"doc_insert_image":r=await docs(e,"POST",`/documents/${a.documentId}:batchUpdate`,{requests:[{insertInlineImage:{location:loc(a,a.index),uri:a.imageUrl,objectSize:{width:{magnitude:a.widthPt||300,unit:"PT"},height:{magnitude:a.heightPt||200,unit:"PT"}}}}]});return out({documentId:a.documentId,inserted:!r._error,response:r,url:url(a.documentId)});
 case"doc_share":r=await perm(e,a.documentId,a.role||"reader");return out({documentId:a.documentId,shared:r.ok,role:a.role||"reader",url:url(a.documentId)});
 case"doc_build_proposal":return buildProposal(e,a);
 case"doc_lint_application":return out(lintApplication(a));
 default:throw Error(`Unknown tool: ${n}`)}}
function rpc(id,result){return{jsonrpc:"2.0",id,result}}function err(id,c,m){return{jsonrpc:"2.0",id,error:{code:c,message:m}}}
async function route(e,q){const{method,params,id}=q;switch(method){case"initialize":return rpc(id,{protocolVersion:PROTOCOL_VERSION,capabilities:{tools:{listChanged:false}},serverInfo:SERVER_INFO});case"notifications/initialized":case"notifications/cancelled":return null;case"ping":return rpc(id,{});case"tools/list":return rpc(id,{tools:TOOLS});case"tools/call":try{return rpc(id,await handle(e,params?.name,params?.arguments))}catch(x){return rpc(id,{content:[{type:"text",text:`Error: ${x.message}`}],isError:true})}default:return err(id,-32601,`Method not found: ${method}`)}}
function auth(e,u){const r=`${u.origin}/callback`;return Response.redirect(`${AUTH_URL}?client_id=${encodeURIComponent(e.GOOGLE_CLIENT_ID)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(r)}&access_type=offline&prompt=consent`,302)}
async function callback(e,u){const c=u.searchParams.get("code"),x=u.searchParams.get("error");if(x)return new Response(`OAuth error: ${x}`,{status:400});if(!c)return new Response("Missing authorization code",{status:400});const r=`${u.origin}/callback`,z=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:`grant_type=authorization_code&code=${encodeURIComponent(c)}&redirect_uri=${encodeURIComponent(r)}&client_id=${encodeURIComponent(e.GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(e.GOOGLE_CLIENT_SECRET)}`});if(!z.ok)return new Response(`Token exchange failed: ${await z.text()}`,{status:500});await saveTokens(e,await z.json());return new Response("<h1>Connected to Google Docs</h1><p>You can close this window.</p>",{headers:{"Content-Type":"text/html"}})}
export default{async fetch(req,e){const u=new URL(req.url);if(u.pathname==="/health")return Response.json({status:"ok",google_connected:!!(await getTokens(e))?.refresh_token,version:SERVER_INFO.version});if(u.pathname==="/auth")return auth(e,u);if(u.pathname==="/callback")return callback(e,u);if(req.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, Mcp-Session-Id"}});if(e.MCP_AUTH_TOKEN&&req.headers.get("Authorization")!==`Bearer ${e.MCP_AUTH_TOKEN}`)return new Response("Unauthorized",{status:401});if(!u.pathname.startsWith("/mcp"))return new Response("Not found",{status:404});if(req.method!=="POST")return new Response("Use POST for MCP requests",{status:405});let b;try{b=await req.json()}catch{return Response.json(err(null,-32700,"Parse error"),{status:400})}const h={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};if(Array.isArray(b)){const o=[];for(const q of b){const x=await route(e,q);if(x)o.push(x)}return o.length?Response.json(o,{headers:h}):new Response(null,{status:202,headers:h})}const o=await route(e,b);return o?Response.json(o,{headers:h}):new Response(null,{status:202,headers:h})}};
