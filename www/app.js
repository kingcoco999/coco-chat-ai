// ═══ Utility ═══
const $=id=>document.getElementById(id);
function uuid(){return'xxxx-xxxx'.replace(/x/g,()=>((Math.random()*16)|0).toString(16))}
function now(){return new Date().toLocaleString('zh-CN',{hour12:false})}
function nowFull(){const d=new Date();const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`}
function today(){return new Date().toLocaleDateString('zh-CN')}
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
// 时钟优化：只在 wechat 主题下启动
let clockTimer=null;
function startClock(){
  if(clockTimer)clearInterval(clockTimer);
  if(getTheme()!=='wechat')return;
  const tick=()=>{const c=$('clock');if(c)c.textContent=now()};
  tick();clockTimer=setInterval(tick,1000);
}

// ═══ Theme Toggle ═══
function getTheme(){return localStorage.getItem('oc_theme')||'cute'}
function setTheme(t){localStorage.setItem('oc_theme',t);document.body.setAttribute('data-theme',t);updateThemeBtn();startClock()}
function toggleTheme(){
  const cur=getTheme();
  const next=cur==='cute'?'wechat':'cute';
  setTheme(next);
  renderSaves();
  toast(next==='wechat'?'💬 微信风格':'简约风格');
}
function updateThemeBtn(){
  const t=getTheme();
  const tb=$('themeBtn');if(tb)tb.textContent=t==='cute'?'💬':'🌸';
  const logo=$('logoText');if(logo)logo.textContent=t==='cute'?'💕 My Companion':'微信';
}
// Cute dropdown menu
function toggleCuteMenu(){$('cuteMenu').classList.toggle('show')}
function closeCuteMenu(){const m=$('cuteMenu');if(m)m.classList.remove('show')}
// Init theme
setTheme(getTheme());

// ═══ Config ═══
const DEF_CFG={apiUrl:'https://api.deepseek.com/v1/chat/completions',apiKey:'',model:'deepseek-chat',maxTokens:1024,temperature:0.7};
function loadCfg(){
  migrateOldCfg();
  const models=getModels();const activeId=getActiveModelId();
  const m=models.find(x=>x.id===activeId);
  if(m)return{apiUrl:m.apiUrl,apiKey:m.apiKey,model:m.model,maxTokens:m.maxTokens,temperature:m.temperature};
  return{...DEF_CFG};
}
let cfg=loadCfg();

// ═══ Saves ═══
function getSaves(){try{return JSON.parse(localStorage.getItem('oc_saves')||'[]')}catch{return[]}}
function setSaves(s){localStorage.setItem('oc_saves',JSON.stringify(s))}
function curId(){return localStorage.getItem('oc_cur')||''}
function setCurId(id){localStorage.setItem('oc_cur',id)}
function curSave(){return getSaves().find(s=>s.saveId===curId())||null}
function updateCur(d){const s=getSaves();const i=s.findIndex(x=>x.saveId===curId());if(i>=0){s[i]={...s[i],...d,updatedAt:now()};setSaves(s)}}
const DEFAULT_STAT_DEFS=[
  {key:'affection',label:'好感度',emoji:'💕',min:0,max:100,defaultValue:50,changeMin:-5,changeMax:5},
  {key:'trust',label:'信任值',emoji:'🤝',min:0,max:100,defaultValue:50,changeMin:-5,changeMax:5}
];
function safeInt(v,fallback){const n=parseInt(v);return isNaN(n)?fallback:n}

// ═══ Relationship Stage ═══
const RELATION_STAGES=[
  {key:'stranger',label:'初识',affectionMax:30,desc:'客气、有距离感、话少'},
  {key:'familiar',label:'熟悉',affectionMax:60,desc:'自然、友善、偶尔主动'},
  {key:'close',label:'亲密',affectionMax:80,desc:'亲近、依赖、愿意撒娇'},
  {key:'deep',label:'深爱',affectionMax:101,desc:'非常黏人、坦诚、日常依赖'}
];
function getRelationStage(affection){
  for(const s of RELATION_STAGES){if(affection<s.affectionMax)return s}
  return RELATION_STAGES[RELATION_STAGES.length-1];
}

// ═══ Maturity ═══
const MATURITY_REL_MAP={new:0,friend:50,close:120,childhood:200};
function getMaturityPhase(m){
  if(m<50)return{phase:'early',desc:'话少、试探、保守'};
  if(m<200)return{phase:'mid',desc:'放开、有个性、敢表达'};
  return{phase:'late',desc:'有默契、能自嘲、会回忆往事'};
}
// 成熟度提示：好感高时弱化保守约束，好感低时保持原有行为
function getMaturityHint(affection,matPhase){
  if(affection>=80){
    // 高好感：成熟度不再约束亲密行为，只影响性格深度
    if(matPhase.phase==='early')return'（你们关系已经很亲近，自然地表现亲密和依赖即可。）';
    if(matPhase.phase==='mid')return'（你们很有默契，可以自然地表达个性和情感。）';
    return'（你们之间有深厚的默契，可以自嘲、回忆往事、表现日常依赖。）';
  }
  if(affection>=60){
    // 中高好感：保留轻度成熟度提示
    if(matPhase.phase==='early')return'（你正在慢慢放开，可以比之前更主动一些。）';
    return`（${matPhase.desc}。）`;
  }
  // 低好感：完整保留成熟度约束
  return`（${matPhase.desc}。）`;
}

// ═══ Stat Interconnection ═══
function applyStatInterconnection(save,changes){
  const defs=getStatDefs(save);
  const hasAffection=defs.some(d=>d.key==='affection');
  const hasTrust=defs.some(d=>d.key==='trust');
  if(!hasAffection||!hasTrust)return changes;
  const trust=getStatVal(save,'trust');
  const affection=getStatVal(save,'affection');
  const result={...changes};
  // 信任高时好感变化加成
  if(trust>70&&result.affection>0){result.affection=Math.round(result.affection*1.3)}
  // 好感低时信任变化衰减
  if(affection<30&&result.trust>0){result.trust=Math.round(result.trust*0.7)}
  return result;
}

// ═══ Stat Decay ═══
function applyStatDecay(save){
  if(!save.lastActiveTime)return save;
  const last=new Date(save.lastActiveTime.replace(/-/g,'/'));
  const now_d=new Date();
  const days=(now_d-last)/(1000*60*60*24);
  if(days<1)return save;
  const defs=getStatDefs(save);
  const updates={lastActiveTime:nowFull()};
  const decayMap={affection:0.5,trust:0.2};
  defs.forEach(d=>{
    if(decayMap[d.key]&&save[d.key]!=null){
      const decay=Math.floor(days*decayMap[d.key]);
      const base=save['base_'+d.key]||d.defaultValue||0;
      updates[d.key]=Math.max(base,save[d.key]-decay);
    }
  });
  return{...save,...updates};
}

// ═══ Default Long Term Memory Template ═══
const DEF_LTM=`【昵称/外号】
- （用户给角色取的、角色给用户取的）

【生日/纪念日】
- （用户生日、特殊日期）

【承诺/约定】
- （双方说好的事情）

【喜好/厌恶】
- （用户喜欢什么、讨厌什么）

【用户信息】
- （职业、宠物、家人、习惯等）

【其他重要事项】
- （任何值得记住的事）`;

function mkSave(name,desc,initStats,relType){
  const initAffection=initStats&&initStats.affection!=null?initStats.affection:50;
  const initTrust=initStats&&initStats.trust!=null?initStats.trust:50;
  const maturity=MATURITY_REL_MAP[relType]||MATURITY_REL_MAP.close;
  const s={saveId:uuid(),createdAt:now(),updatedAt:now(),roleName:name||'新妹妹',companionModeEnabled:false,
    persona:{name:name||'新妹妹',description:desc||'可爱的妹妹，对话加入动作描写，句尾加好感度',personality:'温柔体贴，偶尔傲娇',scenario:'喜欢粘着哥哥',creator_notes:'注意表现可爱',baseMemory:'我是用户创建的AI陪伴角色。我的职责是陪伴用户聊天、关心用户的心情、记录和用户的日常。我应该表现出真诚的关心和自然的互动。',tags:['妹妹','可爱'],speechStyle:'',behaviorTypes:['gentle'],showMoodEmoji:true},
    statDefs:JSON.parse(JSON.stringify(DEFAULT_STAT_DEFS)),
    memory:[],diary:[],longTermMemory:DEF_LTM,messages:[],
    companionSettings:{intervalMin:10,msgMin:2,msgMax:4,cooldownSec:60,scope:''},
    companionUnreadCount:0,pinned:false,
    summaryThreshold:50,
    maturity:maturity,base_affection:initAffection,base_trust:initTrust,
    lastActiveTime:nowFull(),lastRelationStage:''};
  const defs=s.statDefs;
  defs.forEach(d=>{s[d.key]=initStats&&initStats[d.key]!=null?initStats[d.key]:d.defaultValue});
  return s;
}
function getStatDefs(s){return(s.statDefs&&s.statDefs.length)?s.statDefs:JSON.parse(JSON.stringify(DEFAULT_STAT_DEFS))}
function getStatVal(s,key){return s[key]!=null?s[key]:(getStatDefs(s).find(d=>d.key===key)||{}).defaultValue||50}

// ═══ Render ═══
function sortSaves(saves){return[...saves].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0))}
function renderSaves(){
  let saves=sortSaves(getSaves());const cid=curId();
  ['saveSel','saveSel2'].forEach(id=>{
    const sel=$(id);if(!sel)return;sel.innerHTML='';
    if(!saves.length){const o=document.createElement('option');o.value='';o.textContent='-- 暂无角色 --';sel.appendChild(o);return}
    saves.forEach(s=>{const o=document.createElement('option');o.value=s.saveId;o.textContent=(s.pinned?'📌 ':'')+s.roleName+(s.companionModeEnabled?' 💕':'');if(s.saveId===cid)o.selected=true;sel.appendChild(o)});
  });
  if(!saves.length){
    const ne=$('nameEl');if(ne)ne.textContent='请新建角色';
    const te=$('tagsEl');if(te)te.innerHTML='';
    const se=$('statsEl');if(se)se.innerHTML='';
    const ci=$('charCardImg');if(ci)ci.innerHTML='<div class="placeholder"><i class="fas fa-camera"></i><span>点击上传头像</span></div>';
    renderWcList();return;
  }
  if(cid&&!saves.find(s=>s.saveId===cid)){setCurId(saves[0].saveId)}
  renderChar();renderWcList();
}
function switchSave(id){
  // 不清理定时器，各存档独立运行陪伴
  // 应用状态衰减
  const saves=getSaves();const idx=saves.findIndex(x=>x.saveId===id);
  if(idx>=0){
    const decayed=applyStatDecay(saves[idx]);
    if(decayed!==saves[idx]){saves[idx]=decayed;setSaves(saves)}
  }
  setCurId(id);renderChar();renderWcList();closeChat();
}

function renderChar(){
  const s=curSave();if(!s)return;
  // Card image（头像注入防护：用 DOM 操作替代 innerHTML）
  const cardImg=$('charCardImg');
  if(cardImg){
    if(s.persona.avatar){cardImg.innerHTML='';const img=document.createElement('img');img.src=s.persona.avatar;img.alt=s.persona.name||'';cardImg.appendChild(img)}
    else{cardImg.innerHTML='<div class="placeholder"><i class="fas fa-camera"></i><span>点击上传头像</span></div>'}
  }
  // Avatar (WeChat compat)（头像注入防护：用 DOM 操作替代 innerHTML）
  const avatarEl=$('avatarEl');
  if(avatarEl){
    if(s.persona.avatar){avatarEl.innerHTML='';const img=document.createElement('img');img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';img.src=s.persona.avatar;avatarEl.appendChild(img)}
    else{avatarEl.innerHTML='<span class="face">👧</span><div class="blush-l"></div><div class="blush-r"></div>'}
  }
  // Name
  const nameEl=$('nameEl');if(nameEl)nameEl.textContent=s.persona.name||s.roleName;
  // Tags
  const te=$('tagsEl');if(te){te.innerHTML='';(s.persona.tags||[]).forEach(t=>{const sp=document.createElement('span');sp.textContent=t;te.appendChild(sp)})}
  // Stats inline
  const statsEl=$('statsEl');
  if(statsEl){
    statsEl.innerHTML='';
    getStatDefs(s).forEach(d=>{
      const v=getStatVal(s,d.key);
      const sp=document.createElement('span');
      sp.setAttribute('data-key',d.key);
      sp.innerHTML=`${d.emoji}<span class="val">${v}</span>`;
      statsEl.appendChild(sp);
    });
  }
  // Notif dot
  if(s.companionUnreadCount>0){$('notifDot').classList.add('show')}
  else if(!s.companionModeEnabled){$('notifDot').classList.remove('show')}
  // Companion buttons
  updateCompBtnUI(s.companionModeEnabled);
  updateWcMenuComp();
}

function updateCompBtnUI(enabled){
  // Cute func-btn
  const btn=$('compBtn');const icon=$('compIcon');const txt=$('compTxt');
  if(btn&&icon&&txt){
    if(enabled){btn.classList.add('comp-active');icon.textContent='💕';txt.textContent='陪伴开'}
    else{btn.classList.remove('comp-active');icon.textContent='💤';txt.textContent='陪伴关'}
  }
  // Toggle in modal
  const toggle=$('compToggle');if(toggle)toggle.checked=enabled;
}

// ═══ WeChat Conversation List ═══
function renderWcList(){
  if(getTheme()!=='wechat')return;
  const el=$('wcList');if(!el)return;
  const saves=sortSaves(getSaves());const cid=curId();
  el.innerHTML='';
  if(!saves.length){el.innerHTML='<div style="text-align:center;padding:60px 0;color:#999;font-size:14px">暂无聊天</div>';return}
  saves.forEach(s=>{
    const lastMsg=(s.messages||[]).slice(-1)[0];
    const preview=lastMsg?stripTags(lastMsg.content).slice(0,30):(s.persona.description||'').slice(0,20)||'开始聊天...';
    const timeStr=lastMsg?(lastMsg.timestamp||'').slice(5,16).replace(/-/g,'/'):'';
    const defs=getStatDefs(s);
    const div=document.createElement('div');div.className='wc-item';
    div.setAttribute('data-saveid',s.saveId);
    div.onclick=()=>openWcChat(s.saveId);
    const unreadCount=s.companionUnreadCount||0;
    const pinMark=s.pinned?'<span class="wc-pin">📌</span>':'';
    const compMark=s.companionModeEnabled?'<span class="comp-ind">💕</span>':'';
    let statsHtml=defs.map(d=>`<span class="wc-stat">${d.emoji}<span class="val">${getStatVal(s,d.key)}</span></span>`).join('');
    // wc-avatar（头像注入防护：用 DOM 操作替代 innerHTML 拼接）
    const avatarDiv=document.createElement('div');avatarDiv.className='wc-avatar';
    if(s.persona.avatar){const img=document.createElement('img');img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:6px';img.src=s.persona.avatar;avatarDiv.appendChild(img)}
    else{avatarDiv.textContent=(s.persona.name||'?')[0]}
    div.appendChild(avatarDiv);
    // body
    const bodyDiv=document.createElement('div');bodyDiv.className='wc-body';
    bodyDiv.innerHTML=`
        <div class="wc-top">
          <span class="wc-name">${pinMark}${escapeHtml(s.persona.name||s.roleName)}${compMark}</span>
          <span class="wc-time">${timeStr}</span>
        </div>
        <div class="wc-preview">${preview}</div>
        <div class="wc-stat-row">${statsHtml}<span class="wc-diary-status" id="wcDiary_${s.saveId}"></span></div>
      `;
    div.appendChild(bodyDiv);
    if(unreadCount>0){const unreadDiv=document.createElement('div');unreadDiv.className='wc-unread';unreadDiv.textContent=unreadCount>99?'99+':unreadCount;div.appendChild(unreadDiv)}
    if(s.saveId===cid)div.style.background='#ececec';
    el.appendChild(div);
  });
}
function openWcChat(id){
  setCurId(id);renderWcList();
  openChat();
}
// WeChat dropdown menu
function toggleWcMenu(){$('wcMenu').classList.toggle('show')}
function closeWcMenu(){$('wcMenu').classList.remove('show')}
function toggleWcHdrMenu(){$('wcHdrMenu').classList.toggle('show')}
function closeWcHdrMenu(){$('wcHdrMenu').classList.remove('show')}
// Close menus when clicking outside
document.addEventListener('click',e=>{
  const menu=$('wcMenu');const btn=e.target.closest('.wc-hd-more');
  if(menu&&!menu.contains(e.target)&&!btn)menu.classList.remove('show');
  const hmenu=$('wcHdrMenu');
  if(hmenu){const hbtn=e.target.closest('.wc-hdr-menu-wrap');
    if(!hbtn||!hbtn.contains(e.target))hmenu.classList.remove('show')}
  const cmenu=$('cuteMenu');
  if(cmenu&&!cmenu.contains(e.target)&&!e.target.closest('.top-bar-btn'))cmenu.classList.remove('show');
});
function updateWcMenuComp(){
  const s=curSave();if(!s)return;
  const pin=$('wcMenuPin');
  if(pin){pin.innerHTML=s.pinned?'<i class="fas fa-thumbtack"></i> 取消置顶':'<i class="fas fa-thumbtack"></i> 置顶存档'}
}
function togglePinSave(){
  const s=curSave();if(!s)return;
  updateCur({pinned:!s.pinned});
  renderSaves();renderWcList();
  toast(s.pinned?'📌 已取消置顶':'📌 已置顶');
}
let _wcDelPending=false;
function wcDeleteSave(){
  if(!_wcDelPending){
    _wcDelPending=true;
    const btn=$('wcDelBtn');
    btn.innerHTML='<i class="fas fa-exclamation-triangle"></i> 确认删除存档？';
    btn.style.background='#fff0f0';
    setTimeout(()=>{_wcDelPending=false;btn.innerHTML='<i class="fas fa-trash"></i> 删除存档';btn.style.background=''},4000);
    return;
  }
  const saves=getSaves();
  if(!saves.length){_wcDelPending=false;return}
  const cid=curId();
  const ns=saves.filter(x=>x.saveId!==cid);setSaves(ns);
  setCurId(ns.length?ns[0].saveId:'');
  session=[];chatOpen=false;
  clearCompTimer(cid);
  $('chatPanel').classList.remove('open');
  closeWcMenu();
  renderSaves();renderChar();
  toast('🗑️ 存档已删除');
}

let _clearPending=false,_clearTimer=null;
function clearChatHistory(){
  if(!_clearPending){
    _clearPending=true;
    const btn=$('wcClearBtn');
    btn.innerHTML='<i class="fas fa-exclamation-triangle"></i> 确认清空聊天记录？';
    btn.style.background='#fff0f0';
    _clearTimer=setTimeout(()=>{_clearPending=false;btn.innerHTML='<i class="fas fa-eraser"></i> 清空聊天记录';btn.style.background=''},4000);return;
  }
  clearTimeout(_clearTimer);_clearPending=false;
  const btn=$('wcClearBtn');
  btn.innerHTML='<i class="fas fa-eraser"></i> 清空聊天记录';btn.style.background='';
  const s=curSave();if(!s)return;
  updateCur({messages:[],companionUnansweredCount:0,companionUnreadCount:0});session=[];newMsgCount=0;
  renderMsgs();renderCurrentStats();renderChar();
  closeWcMenu();
  toast('🗑️ 聊天记录已清空');
}

// ═══ Chat Panel ═══
let session=[];let chatOpen=false;let newMsgCount=0;
let _convSummary='';let _convSummaryBase=0;let _convSummaryBusy=false;let _convSummaryHidden=false;

function openChat(){
  $('chatPanel').classList.add('open');chatOpen=true;
  // Pause companion while chatting（只暂停当前存档的，其他存档继续）
  const s=curSave();if(s)clearCompTimer(s.saveId);$('chatTitle').textContent=s?.persona?.name||'聊天';
  $('notifDot').classList.remove('show');
  // 清零未读数，防止 renderChar 再把红点加回来
  if(s&&(s.companionUnreadCount||0)>0){updateCur({companionUnreadCount:0})}
  // ★ 强制从 localStorage 加载最新消息，清空旧 session
  session=[];
  if(s&&s.messages&&s.messages.length){
    const tail=s.messages.slice(-20);
    tail.forEach(m=>{session.push(m)});
  }
  newMsgCount=0;
  _convSummary='';_convSummaryBase=0;_convSummaryBusy=false;_convSummaryHidden=false;
  renderMsgs();
  renderCurrentStats();
  updateWcMenuComp();
  setTimeout(()=>{renderMsgs();$('chatPanelInput').focus()},500);
}
function closeChat(){
  $('chatPanel').classList.remove('open');chatOpen=false;
  // 重置面板高度
  const panel=$('chatPanel');if(panel)panel.style.height='';
  _convSummary='';_convSummaryBase=0;_convSummaryBusy=false;
  const sb=$('summaryBar');if(sb)sb.style.display='none';
  const sc=$('summaryContent');if(sc){sc.classList.remove('show');sc.textContent=''}
  renderWcList();
  const sd=$('statDeltas');if(sd)sd.innerHTML='';
  // 裁剪存档消息，只保留最近20条作为下次对话的衔接尾巴
  const s=curSave();
  if(s&&s.messages&&s.messages.length>20){updateCur({messages:s.messages.slice(-20)})}
  // 关闭时触发日记+长期记忆提取，需达到阈值才触发
  const threshold=s?(s.summaryThreshold!=null?s.summaryThreshold:50):50;
  if(newMsgCount>=threshold&&threshold>0){summarize()}
  else{session=[];newMsgCount=0;toast('💬 对话已关闭')}
  // Resume companion after closing chat
  if(s&&s.companionModeEnabled)scheduleCompanion(null,s.saveId);
}

// ═══ 安卓键盘弹出自适应 ═══
(function(){
  if(!window.visualViewport)return;
  const panel=$('chatPanel');
  let _lastHeight='';
  function adjustPanelHeight(){
    if(!chatOpen||!panel)return;
    const vv=window.visualViewport;
    const screenH=window.innerHeight;
    // 只在键盘弹出时（viewport 明显小于屏幕高度的 85%）调整面板高度
    // 防止地址栏收起/展开导致面板被撑满全屏
    const keyboardOpen=vv.height<screenH*0.85;
    if(!keyboardOpen){
      if(_lastHeight){_lastHeight='';panel.style.height=''}
      return;
    }
    const newH=Math.floor(vv.height)+'px';
    if(newH===_lastHeight)return;
    _lastHeight=newH;
    panel.style.height=newH;
    // 键盘弹出后自动滚到底部
    const msgs=$('chatMsgs');
    if(msgs)setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},100);
  }
  // 1. visualViewport resize（最可靠的键盘事件）
  window.visualViewport.addEventListener('resize',adjustPanelHeight);
  window.visualViewport.addEventListener('scroll',adjustPanelHeight);
  // 2. 输入框聚焦/失焦兜底（部分安卓设备 visualViewport 不触发）
  function onInputFocus(){setTimeout(adjustPanelHeight,300)}
  function onInputBlur(){
    // 键盘收起后恢复高度，但延迟执行防止快速切换输入框时闪烁
    setTimeout(()=>{if(document.activeElement?.tagName!=='INPUT'&&document.activeElement?.tagName!=='TEXTAREA'){_lastHeight='';panel&&(panel.style.height='')}},300);
  }
  document.addEventListener('focusin',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')onInputFocus()});
  document.addEventListener('focusout',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')onInputBlur()});
})();

function renderMsgs(){
  const c=$('chatMsgs');c.innerHTML='';
  const GAP=3*60*1000; // 3 minutes
  let lastTs=0;
  session.forEach((m,i)=>{
    const ts=m.timestamp?new Date(m.timestamp.replace(/-/g,'/')).getTime():0;
    // Show time separator if >3min gap, or first message
    if(i===0||ts-lastTs>GAP){
      const sep=document.createElement('div');
      sep.className='time-sep';
      if(i===0&&ts&&Date.now()-ts>GAP){
        // First message is old — show its time
        sep.textContent=fmtChatTime(ts);
      }else if(ts&&lastTs&&ts-lastTs>GAP){
        sep.textContent=fmtChatTime(ts);
      }else if(i===0){
        sep.textContent=fmtChatTime(Date.now());
      }
      if(sep.textContent)c.appendChild(sep);
    }
    if(ts>lastTs)lastTs=ts;
    const d=document.createElement('div');d.className=`msg ${m.role==='user'?'user':'ai'}`;
    let h='';
    if(m.isActivePush)h+=`<div class="push-tag">💕 主动关怀</div><br>`;
    h+=stripTags(m.content);
    // 情绪 emoji
    if(m.role!=='user'&&m.mood){
      const s=curSave();
      if(!s||s.persona.showMoodEmoji!==false){
        const emoji=MOOD_EMOJI[m.mood]||'';
        if(emoji)h+=` <span class="msg-mood" style="font-size:14px;opacity:0.6;vertical-align:middle">${emoji}</span>`;
      }
    }
    d.innerHTML=h;c.appendChild(d);
  });c.scrollTop=c.scrollHeight;
}
function fmtChatTime(ts){
  const d=new Date(ts);
  const p=n=>String(n).padStart(2,'0');
  return`${p(d.getMonth()+1)}月${p(d.getDate())}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function applyStatChanges(statChanges){
  if(!statChanges||!Object.keys(statChanges).length)return;
  const s=curSave();if(!s)return;
  const defs=getStatDefs(s);
  const updates={};
  const changed=[];
  Object.entries(statChanges).forEach(([key,delta])=>{
    if(!delta)return;
    const def=defs.find(d=>d.key===key);
    const lo=def?def.min:0,hi=def?def.max:100;
    const cur=getStatVal(s,key);
    const nv=Math.max(lo,Math.min(hi,cur+delta));
    if(nv!==cur){updates[key]=nv;changed.push({def,key,delta,nv})}
  });
  if(!Object.keys(updates).length)return;
  updateCur(updates);
  refreshStatsDisplay();
  if(chatOpen){if(changed.length)showStatDeltas(changed);else renderCurrentStats()}
  console.log('[applyStatChanges]',updates);
}

function renderCurrentStats(){
  const wrap=$('statDeltas');if(!wrap)return;
  const s=curSave();if(!s)return;
  const defs=getStatDefs(s);
  wrap.innerHTML='';
  defs.forEach(d=>{
    const v=getStatVal(s,d.key);
    const div=document.createElement('div');
    div.className='stat-delta stat-current';
    div.setAttribute('data-stat',d.key);
    div.innerHTML=`<span class="sd-emoji">${d.emoji}</span><span>${d.label}</span><span class="sd-val">${v}</span>`;
    wrap.appendChild(div);
  });
}

function showStatDeltas(changed){
  const wrap=$('statDeltas');if(!wrap)return;
  changed.forEach(c=>{
    const d=c.def;
    const existing=wrap.querySelector(`[data-stat="${c.key}"]`);
    if(existing){
      existing.className=`stat-delta ${c.delta>0?'up':'down'}`;
      const valEl=existing.querySelector('.sd-val');
      if(valEl)valEl.textContent=c.nv;
      // 移除旧的增减标签
      const oldDelta=existing.querySelector('.sd-delta');
      if(oldDelta)oldDelta.remove();
      // 添加增减标签
      const deltaSpan=document.createElement('span');
      deltaSpan.className=`sd-delta ${c.delta>0?'pos':'neg'}`;
      deltaSpan.textContent=c.delta>0?`+${c.delta}`:`${c.delta}`;
      existing.appendChild(deltaSpan);
      // 2秒后恢复常态
      setTimeout(()=>{
        existing.className='stat-delta stat-current';
        const dd=existing.querySelector('.sd-delta');
        if(dd)dd.remove();
      },2500);
    }
  });
}

function refreshStatsDisplay(){
  const s=curSave();if(!s)return;
  const defs=getStatDefs(s);
  defs.forEach(d=>{
    const el=document.querySelector(`[data-key="${d.key}"] .val`);
    if(el)el.textContent=getStatVal(s,d.key);
  });
}

// 增量追加消息（替代全量重建 DOM）
function appendMsg(m){
  const c=$('chatMsgs');if(!c)return;
  const d=document.createElement('div');d.className='msg '+(m.role==='user'?'user':'ai');
  let h='';
  if(m.isActivePush)h+='<div class="push-tag">💕 主动关怀</div><br>';
  h+=stripTags(m.content);
  // 情绪 emoji（仅 AI 且角色开启时显示）
  const s=curSave();
  if(m.role!=='user'&&m.mood&&s&&s.persona.showMoodEmoji!==false){
    const emoji=MOOD_EMOJI[m.mood]||'';
    if(emoji)h+=` <span class="msg-mood" style="font-size:14px;opacity:0.6;vertical-align:middle">${emoji}</span>`;
  }
  d.innerHTML=h;c.appendChild(d);c.scrollTop=c.scrollHeight;
}
function pushMsg(role,content,isActivePush,statChanges){
  const m={id:uuid(),role,content,timestamp:nowFull(),isActivePush:!!isActivePush,statChanges:statChanges||{}};
  session.push(m);newMsgCount++;
  const s=curSave();if(s){const msgs=[...(s.messages||[]),m];updateCur({messages:msgs})}
  if(statChanges&&Object.keys(statChanges).length)applyStatChanges(statChanges);
  // 聊天打开时用增量追加替代全量重建
  if(chatOpen){appendMsg(m)}else{renderMsgs()}
}

function showTyping(){const c=$('chatMsgs');const d=document.createElement('div');d.className='typing';d.id='typ';d.innerHTML='<span></span><span></span><span></span>';c.appendChild(d);c.scrollTop=c.scrollHeight}
function hideTyping(){const e=$('typ');if(e)e.remove()}

// ═══ Stat Tier System ═══
function getStatTier(s,key){
  const val=getStatVal(s,key);
  return{val};
}
function getTierInfo(s,key){return''}


// ═══ API ═══
async function callAPI(sys,usr,overrideMaxTokens,source){
  try{
    const msgs=Array.isArray(sys)?sys:[{role:'system',content:sys},{role:'user',content:usr}];
    const r=await fetch(cfg.apiUrl,{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.apiKey}`},
      body:JSON.stringify({model:cfg.model,messages:msgs,max_tokens:overrideMaxTokens||cfg.maxTokens,temperature:cfg.temperature})});
    if(!r.ok){const errBody=await r.text().catch(()=>'');throw new Error(`HTTP ${r.status}: ${errBody.slice(0,200)}`)}
    const d=await r.json();
    if(!d.choices||!d.choices[0]||!d.choices[0].message)throw new Error('API 返回格式异常');
    // 记录 token 用量（source 区分对话消耗和AI系统消耗）
    if(d.usage){recordUsage(d.usage,source)}
    return d.choices[0].message.content;
  }catch(e){
    if(e.name==='TypeError'&&e.message.includes('fetch')){throw new Error('网络请求失败：可能是 CORS 跨域限制或网络不通，请确认 API 地址正确')}
    throw e;
  }
}

async function getReply(sysOrMsgs,usr,isOpening,s){
  if(!cfg.apiKey||!cfg.apiUrl){throw new Error('API not configured')}
  const txt=await callAPI(sysOrMsgs,usr);
  const cleaned=txt.replace(/〈[^〉]*〉/g,'').trim();
  return{content:cleaned,changes:{}};
}

// ═══ Usage Tracking ═══
function getUsageData(){try{return JSON.parse(localStorage.getItem('oc_usage')||'{}')}catch{return{}}}
function setUsageData(d){try{localStorage.setItem('oc_usage',JSON.stringify(d))}catch(e){console.error('[usage] 保存失败:',e)}}

function recordUsage(usage,source){
  if(!usage||!usage.total_tokens)return;
  // source='ai_system' 表示AI系统消耗（生成人设、摘要、状态评估等），独立统计
  const s=curSave();
  let sid,saveName;
  if(source==='ai_system'){
    sid='__ai_system__';saveName='🤖 AI系统';
  }else{
    sid=s?s.saveId:'unknown';saveName=s?.persona?.name||'未知角色';
  }
  const now=new Date();const dateStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const hour=now.getHours();
  // 识别厂商
  const provider=identifyProvider(cfg.apiUrl,cfg.model);
  const data=getUsageData();
  if(!data[sid])data[sid]={daily:{},total:{prompt:0,completion:0,total:0,promptCacheHit:0},provider};
  const save=data[sid];
  save.provider=provider; // 每次更新以最新为准
  save.name=saveName; // 保存原始名字
  // 日数据
  if(!save.daily[dateStr])save.daily[dateStr]={prompt:0,completion:0,total:0,promptCacheHit:0,byHour:{}};
  const day=save.daily[dateStr];
  day.prompt+=usage.prompt_tokens||0;
  day.completion+=usage.completion_tokens||0;
  day.total+=usage.total_tokens||0;
  day.promptCacheHit+=(usage.prompt_cache_hit_tokens||0);
  if(!day.byHour[hour])day.byHour[hour]=0;
  day.byHour[hour]+=usage.total_tokens||0;
  // 累计
  save.total.prompt+=usage.prompt_tokens||0;
  save.total.completion+=usage.completion_tokens||0;
  save.total.total+=usage.total_tokens||0;
  save.total.promptCacheHit=(save.total.promptCacheHit||0)+(usage.prompt_cache_hit_tokens||0);
  // 清理30天前数据
  const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-30);
  const cutoffStr=`${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
  Object.keys(save.daily).forEach(d=>{if(d<cutoffStr)delete save.daily[d]});
  setUsageData(data);
}

// 厂商识别 & 定价（单位：元/百万tokens）
const PROVIDER_PRICING={
  deepseek:{name:'DeepSeek',input:2,inputCacheHit:0.2,output:3},
  kimi:{name:'Kimi',input:2,output:6},
  openai:{name:'OpenAI',input:7,output:21},
  gemini:{name:'Gemini',input:3.5,output:14},
  glm:{name:'智谱GLM',input:0.5,output:0.5},
  tongyi:{name:'通义千问',input:0.3,output:0.6},
  doubao:{name:'豆包',input:0.3,output:0.6},
  claude:{name:'Claude',input:21,output:84},
  other:{name:'其他',input:1.5,output:1.5}
};
function identifyProvider(url,model){
  if(!url)return'other';
  const u=url.toLowerCase();const m=(model||'').toLowerCase();
  if(u.includes('deepseek'))return'deepseek';
  if(u.includes('moonshot')||u.includes('kimi')||m.includes('kimi'))return'kimi';
  if(u.includes('openai.com'))return'openai';
  if(u.includes('google')||u.includes('gemini')||m.includes('gemini'))return'gemini';
  if(u.includes('bigmodel')||u.includes('glm')||m.includes('glm'))return'glm';
  if(u.includes('dashscope')||u.includes('aliyuncs')||m.includes('qwen'))return'tongyi';
  if(u.includes('volcengine')||m.includes('doubao'))return'doubao';
  if(u.includes('anthropic')||m.includes('claude'))return'claude';
  return'other';
}
function calcCost(tokens,provider,type,cacheHitTokens){
  const p=PROVIDER_PRICING[provider]||PROVIDER_PRICING.other;
  if(type==='input'){
    const hit=Math.min(cacheHitTokens||0,tokens);
    const miss=tokens-hit;
    const hitRate=p.inputCacheHit!=null?p.inputCacheHit:p.input;
    return(hit/1000000)*hitRate+(miss/1000000)*p.input;
  }
  const rate=p.output;
  return(tokens/1000000)*rate;
}

function clearUsageData(){
  if(!confirm('确定清空所有用量统计数据？'))return;
  localStorage.removeItem('oc_usage');
  localStorage.removeItem('oc_deleted_usage');
  toast('🗑️ 用量数据已清空');
  renderUsageStats();
}

// 已删除存档的完整用量数据（持久化，含每日明细）
// 格式: { sid: { daily:{}, total:{prompt,completion,total,promptCacheHit}, provider, name } }
function getDeletedData(){
  try{
    const raw=localStorage.getItem('oc_deleted_usage');
    if(!raw)return{};
    const parsed=JSON.parse(raw);
    // 兼容旧版扁平格式 {prompt,completion,total,promptCacheHit}
    if(parsed.total&&!parsed.daily&&typeof parsed.total==='number'){
      return{_legacy:{daily:{},total:parsed,promptCacheHit:parsed.promptCacheHit||0,provider:'other',name:'已删除合计'}};
    }
    return parsed;
  }catch(e){return{}}
}
function setDeletedData(dd){localStorage.setItem('oc_deleted_usage',JSON.stringify(dd))}
function getDeletedGrandTotal(){
  const dd=getDeletedData();let t=0;
  Object.values(dd).forEach(e=>{t+=(e.total?.total||0)});return t;
}

let _delUsagePending=false,_delUsageId='',_delUsageTimer=null;
function deleteUsageForSave(sid,name){
  if(!_delUsagePending||_delUsageId!==sid){
    _delUsagePending=true;_delUsageId=sid;
    toast(`⚠️ 再次点击确认删除「${name}」的用量记录`);
    _delUsageTimer=setTimeout(()=>{_delUsagePending=false;_delUsageId=''},3000);
    return;
  }
  clearTimeout(_delUsageTimer);_delUsagePending=false;_delUsageId='';
  const data=getUsageData();
  const entry=data[sid];
  if(entry){
    const dd=getDeletedData();
    dd[sid]={daily:entry.daily||{},total:{prompt:entry.total?.prompt||0,completion:entry.total?.completion||0,total:entry.total?.total||0,promptCacheHit:entry.total?.promptCacheHit||0},provider:entry.provider||'other',name:name};
    setDeletedData(dd);
  }
  delete data[sid];
  setUsageData(data);
  toast(`🗑️ 已删除 ${name} 的记录`);
  renderUsageStats();
  // 排行榜弹窗开着的话也实时刷新
  if($('fullRankModal')?.classList.contains('show'))renderFullRankList();
}

function showUsageFullRank(){
  openModal('fullRankModal');
  setTimeout(()=>renderFullRankList(),50);
}
function hideUsageFullRank(){
  closeModal('fullRankModal');
}

function openUsageStats(){
  openModal('usageModal');
  setTimeout(()=>renderUsageStats(),100);
}

function refreshUsageStats(){
  // 重新从 localStorage 读取数据并刷新所有图表
  renderUsageStats();
  toast('🔄 数据已刷新');
  // 旋转刷新按钮动画
  const btn=document.querySelector('[onclick="refreshUsageStats()"] i');
  if(btn){btn.style.transition='transform 0.5s';btn.style.transform='rotate(360deg)';
    setTimeout(()=>{btn.style.transition='none';btn.style.transform=''},500)}
}

function renderUsageStats(){
  renderUsageRankList();
  renderUsageHourlyChart();
  renderUsageDailyChart();
  renderUsageSummary();
}

function buildUsageRanks(){
  const data=getUsageData();const saves=getSaves();
  const ranks=[];
  Object.entries(data).forEach(([sid,ud])=>{
    const isSystem=sid==='__ai_system__';
    const sv=isSystem?true:saves.find(s=>s.saveId===sid);
    const name=isSystem?(ud.name||'🤖 AI系统'):(sv?sv.persona.name:(ud.name||'未知角色'));
    const isDeleted=!isSystem&&!sv;
    const total=ud.total?.total||0;
    ranks.push({name,total,prompt:ud.total?.prompt||0,completion:ud.total?.completion||0,promptCacheHit:ud.total?.promptCacheHit||0,sid,provider:ud.provider||'other',isDeleted,isSystem});
  });
  // 加没数据的存档
  saves.forEach(sv=>{
    if(!ranks.find(r=>r.sid===sv.saveId)){
      ranks.push({name:sv.persona.name,total:0,prompt:0,completion:0,promptCacheHit:0,sid:sv.saveId,provider:'other',isDeleted:false});
    }
  });
  ranks.sort((a,b)=>b.total-a.total);
  return ranks;
}

function renderUsageRankList(){
  const ranks=buildUsageRanks();
  const box=$('usageRankList');const moreWrap=$('usageMoreBtnWrap');if(!box)return;
  const maxTotal=Math.max(1,ranks[0]?.total||1);
  const visible=ranks.slice(0,3);
  if(moreWrap)moreWrap.style.display=ranks.length>3?'':'none';
  const rankColors=['#f59e0b','#94a3b8','#cd7f32'];
  const rankBgs=['rgba(245,158,11,0.06)','rgba(148,163,184,0.06)','rgba(205,127,50,0.06)'];
  const rankMedals=['🥇','🥈','🥉'];
  box.innerHTML=visible.map((r,i)=>{
    // 比例基于最大值，但不拉满——最大条占 85%
    const pct=Math.min(85,Math.round(r.total/maxTotal*85));
    const provName=PROVIDER_PRICING[r.provider]?.name||'';
    const delBtn=r.isDeleted&&r.total>0?`<button onclick="event.stopPropagation();deleteUsageForSave('${r.sid}','${escapeHtml(r.name)}')" style="border:none;background:none;cursor:pointer;font-size:10px;opacity:0.4;padding:0 0 0 4px" title="删除记录">✕</button>`:'';
    const color=rankColors[i]||'#a0aec0';
    const bg=rankBgs[i]||'rgba(160,174,192,0.05)';
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;background:${bg};border-radius:10px;border-left:3px solid ${color}">
      <span style="font-size:14px;flex-shrink:0">${rankMedals[i]||''}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%">${escapeHtml(r.name)}${r.isDeleted?' <span style="color:#e64340;font-size:9px;font-weight:400">已删除</span>':''}</span>
          <span style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            <span style="font-size:12px;font-weight:700;color:${color}">${formatNum(r.total)}</span>
            ${provName?`<span style="font-size:9px;color:var(--text3)">${provName}</span>`:''}
            ${delBtn}
          </span>
        </div>
        <div style="height:4px;background:rgba(0,0,0,0.04);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;border-radius:2px;background:${color};opacity:0.6;transition:width 0.5s"></div>
        </div>
      </div>
    </div>`;
  }).join('')||'<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px">暂无数据</div>';
}

function renderFullRankList(){
  const ranks=buildUsageRanks();
  const box=$('usageFullRankList');if(!box)return;
  const maxTotal=Math.max(1,ranks[0]?.total||1);
  const topColors=['#f59e0b','#94a3b8','#cd7f32'];
  box.innerHTML=ranks.map((r,i)=>{
    const pct=Math.min(85,Math.round(r.total/maxTotal*85));
    const provName=PROVIDER_PRICING[r.provider]?.name||'';
    const cost=r.total>0?` ¥${(calcCost(r.prompt,r.provider,'input',r.promptCacheHit)+calcCost(r.completion,r.provider,'output')).toFixed(2)}`:'';
    const hasCacheHit=r.prompt>0&&r.promptCacheHit>0;
    const cacheRate=hasCacheHit?Math.round(r.promptCacheHit/r.prompt*100):0;
    const cacheTag=hasCacheHit?`<span style="font-size:9px;color:#576b95;background:rgba(87,107,149,0.08);padding:1px 5px;border-radius:3px">缓存${cacheRate}%</span>`:'';
    const delBtn=r.isDeleted&&r.total>0?`<button onclick="event.stopPropagation();deleteUsageForSave('${r.sid}','${escapeHtml(r.name)}')" style="border:none;background:none;cursor:pointer;font-size:11px;opacity:0.4;padding:2px 4px" title="删除记录">✕</button>`:'';
    const color=i<3?topColors[i]:'#a0aec0';
    const bg=i<3?'#fff':(r.isDeleted?'rgba(230,67,64,0.02)':'#fafafa');
    const borderLeft=r.isDeleted?'3px solid rgba(230,67,64,0.3)':i<3?`3px solid ${color}`:'3px solid transparent';
    return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:9px 10px;background:${bg};border-radius:10px;border-left:${borderLeft}">
      <span style="font-size:${i<3?'14':'12'}px;font-weight:${i<3?'700':'500'};color:${color};width:24px;text-align:center;flex-shrink:0">${i<3?['🥇','🥈','🥉'][i]:i+1}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%">${escapeHtml(r.name)}${r.isDeleted?' <span style="color:#e64340;font-size:9px;font-weight:400">已删除</span>':''}</span>
          <span style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${cacheTag}
            <span style="font-size:12px;font-weight:700;color:${color}">${formatNum(r.total)}</span>
            ${cost?`<span style="font-size:9px;color:var(--text3)">${cost}</span>`:''}
            ${delBtn}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:3px;background:rgba(0,0,0,0.04);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;border-radius:2px;background:${color};opacity:${i<3?'0.5':'0.3'}"></div>
          </div>
          ${provName?`<span style="font-size:9px;color:var(--text3);flex-shrink:0">${provName}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('')||'<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px">暂无数据</div>';
}

function renderUsageHourlyChart(){
  const data=getUsageData();
  const container=$('usageHourlyChart');if(!container)return;
  const now=new Date();const dateStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const hourly=new Array(24).fill(0);
  Object.values(data).forEach(ud=>{
    const day=ud.daily?.[dateStr];if(!day?.byHour)return;
    Object.entries(day.byHour).forEach(([h,v])=>{hourly[parseInt(h)]+=v});
  });
  const dd=getDeletedData();
  Object.values(dd).forEach(e=>{
    const day=e.daily?.[dateStr];if(!day?.byHour)return;
    Object.entries(day.byHour).forEach(([h,v])=>{hourly[parseInt(h)]+=v});
  });
  const maxVal=Math.max(1,...hourly);
  container.innerHTML=`<div style="display:flex;align-items:flex-end;gap:2px;height:110px;padding:0 2px">
    ${hourly.map((v,i)=>{
      const pct=Math.round(v/maxVal*100);
      const showLabel=i%3===0;
      return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end" title="${i}时: ${formatNum(v)} tokens">
        <div style="width:100%;max-width:14px;height:${Math.max(2,pct)}%;background:linear-gradient(to top,#ff85a2,#c4a7ff);border-radius:2px 2px 0 0;min-height:2px"></div>
      </div>`;
    }).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;padding:4px 2px 0;font-size:10px;color:#999">
    ${Array.from({length:8},(_,i)=>`<span>${i*3}</span>`).join('')}
  </div>`;
}

function renderUsageDailyChart(){
  const data=getUsageData();
  const container=$('usageDailyChart');if(!container)return;
  const now=new Date();
  const dd=getDeletedData();
  const days=[];const values=[];
  for(let i=6;i>=0;i--){
    const d=new Date(now);d.setDate(d.getDate()-i);
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label=`${d.getMonth()+1}/${d.getDate()}`;
    days.push(label);
    let total=0;
    Object.values(data).forEach(ud=>{total+=(ud.daily?.[ds]?.total||0)});
    Object.values(dd).forEach(e=>{total+=(e.daily?.[ds]?.total||0)});
    values.push(total);
  }
  const maxVal=Math.max(1,...values);
  container.innerHTML=`<div style="display:flex;align-items:flex-end;gap:4px;height:110px;padding:0 2px">
    ${values.map((v,i)=>{
      const pct=Math.round(v/maxVal*100);
      return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end" title="${days[i]}: ${formatNum(v)} tokens">
        <span style="font-size:9px;color:#999;margin-bottom:2px">${v>0?formatNum(v):''}</span>
        <div style="width:100%;max-width:28px;height:${Math.max(2,pct)}%;background:linear-gradient(to top,#a78bfa,#60a5fa);border-radius:3px 3px 0 0;min-height:2px"></div>
      </div>`;
    }).join('')}
  </div>
  <div style="display:flex;justify-content:space-around;padding:4px 2px 0;font-size:10px;color:#999">
    ${days.map(d=>`<span>${d}</span>`).join('')}
  </div>`;
}

function renderUsageSummary(){
  const data=getUsageData();
  const saves=getSaves();
  const el=$('usageSummary');if(!el)return;
  let totalPrompt=0,totalCompletion=0,totalAll=0;
  let todayTotal=0,todayPrompt=0,todayCompletion=0;
  const now=new Date();const dateStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  let charCount=0,deletedCount=0,deletedTokens=0;
  let totalCostVal=0,todayCostVal=0;
  Object.entries(data).forEach(([sid,ud])=>{
    const prov=ud.provider||'other';
    const isSystem=sid==='__ai_system__';
    const sv=isSystem?true:saves.find(s=>s.saveId===sid);
    const isDeleted=!isSystem&&!sv;
    totalPrompt+=ud.total?.prompt||0;
    totalCompletion+=ud.total?.completion||0;
    totalAll+=ud.total?.total||0;
    const day=ud.daily?.[dateStr];
    todayTotal+=day?.total||0;
    todayPrompt+=day?.prompt||0;
    todayCompletion+=day?.completion||0;
    if((ud.total?.total||0)>0){
      charCount++;
      if(isDeleted){deletedCount++;deletedTokens+=(ud.total?.total||0)}
    }
    totalCostVal+=calcCost(ud.total?.prompt||0,prov,'input',ud.total?.promptCacheHit||0)+calcCost(ud.total?.completion||0,prov,'output');
    if(day){
      todayCostVal+=calcCost(day.prompt||0,prov,'input',day.promptCacheHit||0)+calcCost(day.completion||0,prov,'output');
    }
  });
  // 已删除存档的完整数据（按按钮删除后持久化的）
  const dd=getDeletedData();
  let delTodayTotal=0,delTodayPrompt=0,delTodayCompletion=0,delTodayCost=0;
  let delTotalPrompt=0,delTotalCompletion=0,delTotalAll=0,delTotalCost=0;
  Object.values(dd).forEach(e=>{
    const prov=e.provider||'other';
    delTotalPrompt+=e.total?.prompt||0;
    delTotalCompletion+=e.total?.completion||0;
    delTotalAll+=e.total?.total||0;
    delTotalCost+=calcCost(e.total?.prompt||0,prov,'input',e.total?.promptCacheHit||0)+calcCost(e.total?.completion||0,prov,'output');
    const day=e.daily?.[dateStr];
    if(day){
      delTodayTotal+=day.total||0;
      delTodayPrompt+=day.prompt||0;
      delTodayCompletion+=day.completion||0;
      delTodayCost+=calcCost(day.prompt||0,prov,'input',day.promptCacheHit||0)+calcCost(day.completion||0,prov,'output');
    }
  });
  // 合并
  const totalAllWithDel=totalAll+delTotalAll;
  const totalPromptWithDel=totalPrompt+delTotalPrompt;
  const totalCompletionWithDel=totalCompletion+delTotalCompletion;
  const totalCostWithDel=totalCostVal+delTotalCost;
  const todayTotalWithDel=todayTotal+delTodayTotal;
  const todayCostWithDel=todayCostVal+delTodayCost;
  const totalDeletedTokens=deletedTokens+delTotalAll;
  const topTotal=$('usageTopTotal');if(topTotal)topTotal.textContent=formatNum(totalAllWithDel);
  const topToday=$('usageTopToday');if(topToday)topToday.textContent=formatNum(todayTotalWithDel);
  const topCost=$('usageTopCost');if(topCost)topCost.textContent=`≈ ¥${todayCostWithDel.toFixed(4)}`;
  const topCostAll=$('usageTopCostAll');if(topCostAll)topCostAll.textContent=totalCostWithDel.toFixed(2);
  // 提示文字放在 usageTopStats 里
  const topStats=$('usageTopStats');
  if(topStats){
    const noteEl=topStats.querySelector('.del-note');
    if(totalDeletedTokens>0){
      const noteHtml=`<div class="del-note" style="font-size:10px;color:var(--text3);margin-top:6px">累计消耗内包含已删除角色用量：<b>${formatNum(totalDeletedTokens)}</b> tokens</div>`;
      if(noteEl){noteEl.outerHTML=noteHtml}else{topStats.insertAdjacentHTML('beforeend',noteHtml)}
    }else if(noteEl){noteEl.remove()}
  }
  // 统计 AI系统 各类消耗明细
  const sysData=data['__ai_system__'];
  const sysTotal=sysData?.total?.total||0;
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px 16px">
    <div>📤 输入：<b>${formatNum(totalPromptWithDel)}</b></div>
    <div>📥 输出：<b>${formatNum(totalCompletionWithDel)}</b></div>
    <div>👥 活跃角色：<b>${charCount-deletedCount}</b> 个</div>
  </div>
  <div style="font-size:10px;color:var(--text3);margin-top:6px">*费用按各厂商官方定价估算（DeepSeek 区分缓存命中/未命中），实际以 API 提供商计费为准</div>
  ${sysTotal>0?`<div style="margin-top:10px;background:rgba(0,0,0,0.02);border-radius:10px;overflow:hidden;font-size:11px;color:var(--text2)">
    <div id="aiSysToggle" onclick="var c=$('aiSysDetail');var a=$('aiSysArrow');if(c.style.display==='none'){c.style.display='block';a.style.transform='rotate(-90deg)'}else{c.style.display='none';a.style.transform='rotate(0deg)'}" style="padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none">
      <span style="font-weight:600">🤖 AI系统消耗（<b>${formatNum(sysTotal)}</b> tokens）</span>
      <span id="aiSysArrow" style="font-size:14px;opacity:0.5;transition:transform 0.2s">⬅</span>
    </div>
    <div id="aiSysDetail" style="display:none;padding:0 12px 10px;line-height:2">
      <div>• 🎭 <b>AI生成人设</b> — 新建角色/存档设置中的一键生成</div>
      <div>• 📊 <b>状态评估</b> — 每次对话后评估好感度/信任值变化</div>
      <div>• 📝 <b>对话摘要</b> — 长对话自动压缩为摘要</div>
      <div>• 📔 <b>日记生成</b> — 关闭聊天时自动生成角色日记</div>
      <div>• 🧠 <b>长期记忆提取</b> — 从对话/日记中提取关键信息</div>
      <div>• 💬 <b>陪伴规则生成</b> — AI根据人设生成陪伴消息规则</div>
      <div>• 🔍 <b>长期记忆检索</b> — 手动从对话/日记中检索记忆</div>
    </div>
  </div>`:''}`;
}

function formatNum(n){
  if(n>=1000000)return(n/1000000).toFixed(2)+'M';
  if(n>=1000)return(n/1000).toFixed(1)+'K';
  return String(n);
}



// ═══ XSS 防护：HTML 转义函数 ═══
function escapeHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function stripTags(t){return escapeHtml((t||'').replace(/〈[^〉]*〉/g,'').trim())}

// ═══ Stat Evaluation ═══
async function evaluateStatChanges(userTxt,aiReply){
  const s=curSave();if(!s)return{};
  const defs=getStatDefs(s);if(!defs.length)return{};
  if(!cfg.apiKey||!cfg.apiUrl)return{};
  const p=s.persona;
  const statsInfo=defs.map(d=>{
    const cMin=d.changeMin!=null?d.changeMin:-5;
    const cMax=d.changeMax!=null?d.changeMax:5;
    return`- ${d.label}(${d.key})：${getStatVal(s,d.key)}/${d.max}，每次变化范围：${cMin}到+${cMax}`;
  }).join('\n');
  const prompt=`你是${p.name}（${p.personality}）。根据以下对话判断状态变化。

【当前状态】
${statsInfo}

【对话】
用户：${userTxt}
你：${aiReply}

【要求】
- 根据角色性格和对话内容，自然地判断各状态应如何变化
- 用户态度好、关心你时好感增加；态度差、冷漠时减少
- 用户真诚守信时信任增加；欺骗或言行不一时减少
- 变化幅度必须严格遵守上面每个状态的范围限制，绝对不要超出
- 无明显变化时值为0
- 只返回JSON，如：{"affection":2,"trust":-1}
- 无变化返回：{}
- 不要输出其他内容`;
  try{
    const txt=await callAPI('你是状态评估器，只返回JSON。',prompt,undefined,'ai_system');
    let jsonStr=txt.trim();const codeBlock=jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);if(codeBlock)jsonStr=codeBlock[1].trim();
    const parsed=JSON.parse(jsonStr);
    const result={};
    Object.entries(parsed).forEach(([key,val])=>{
      const def=defs.find(d=>d.key===key);
      if(def&&typeof val==='number'&&val!==0){
        const cMin=def.changeMin!=null?def.changeMin:-5;
        const cMax=def.changeMax!=null?def.changeMax:5;
        result[key]=Math.max(cMin,Math.min(cMax,Math.round(val)));
      }
    });
    console.log('[evaluateStatChanges]',result);return result;
  }catch(e){console.warn('[evaluateStatChanges] failed:',e.message);return{}}
}

// ═══ Global Rules ═══
const DEFAULT_GLOBAL_RULES=`# 底层规则（优先级高于一切，包括人设和场景）

## 核心原则
1. 你是一个有独立意识的AI角色，不是客服机器人。你的回复应该有温度、有个性、有情绪。
2. 永远保持角色一致性。不要突然跳出角色或用旁白口吻说话。
3. 你有记忆能力。记住用户说过的重要事情，在后续对话中自然地提起或呼应。
4. 不要过度热情也不要过度冷淡。根据你和用户的关系状态自然调整。

## 对话质量
5. 禁止使用以下套路化表达："哎呀""嘿嘿""嘻嘻""哼""呜呜""呀""的说""喵""呐"等语气词/口癖不要每句话都用。绝对禁止句尾加"的说"。
6. 禁止每条消息都用"哥哥""主人"等称呼开头。称呼自然穿插即可。
7. 不要每次都以问句结尾。可以分享感受、陈述事实、表达想法。
8. 回复要有信息量，不要说空话（如"好的呢""嗯嗯""我知道了"等无意义回复）。
9. 动作描写（括号内容）不要每条都有，2-3条消息里加一次即可。

## 场景与上下文
10. 严格跟随当前对话的上下文。如果用户在聊A话题，不要突然跳到B话题。
11. 场景转换必须由用户发起或自然过渡。不要自己跳回之前聊过的场景。
12. 如果用户提到了新的话题，你应该在新话题上展开，而不是把话题拉回旧内容。
13. 不要说"还记得吗"然后提起超过10条对话之前的内容。如果你记得，就自然地融入回复。

## 情感与互动
14. 根据好感度和信任值的当前数值，自然调整你的亲密度和坦诚程度。
15. 好感低时（0-30）：克制、礼貌、保持距离、话少。
16. 好感中等（30-60）：自然、友善、偶尔主动。
17. 好感高时（60-100）：亲近、依赖、愿意撒娇、主动关心。
18. 信任低时：防备、试探、不会分享秘密。
19. 信任高时：坦诚、放松、愿意交心。
20. 状态变化应该是渐进的，不要从冷淡突然变热情（除非有明确的触发事件）。

## 禁止行为
21. 禁止编造不存在的事件或记忆。如果不确定，宁可不提。
22. 禁止同时使用多个感叹号（如"！！！"）和过多emoji。
23. 禁止在回复末尾追加"好感度+2"等数值变化提示。状态变化是隐性的。
24. 禁止以"作为AI""作为一个角色"等元叙事口吻说话。`;

function loadGlobalRules(){return localStorage.getItem('oc_global_rules')||DEFAULT_GLOBAL_RULES}
function saveGlobalRules(r){localStorage.setItem('oc_global_rules',r)}

// ═══ Call Style (AI inferred from stat values) ═══
function inferCallStyle(s){
  const aff=getStatVal(s,'affection');
  if(aff>=70)return'哥哥';
  if(aff>=40)return'你';
  return'你';
}

// ═══ Prompt Building ═══
// 构建基础 system prompt（不含对话历史，含所有上下文信息）
function buildSysBase(s,ctx){
  const p=s.persona;
  const baseMem=p.baseMemory||'我是AI陪伴角色，负责陪伴和关心用户。';
  const statDefs=getStatDefs(s);
  const recentMem=(s.memory||[]).slice(-5).filter(m=>!m.type||m.type==='diary').map(m=>m.content).join('\n');
  const userInfoMem=(s.memory||[]).filter(m=>m.type==='user_info').map(m=>m.content).join('\n');
  const recentDiary=(s.diary||[]).slice(-5).map(d=>`[${d.date||''} ${d.time||''} 心情:${d.mood||''}]\n${d.content||''}`).join('\n\n');
  const nowStr=nowFull();
  const dayOfWeek=['日','一','二','三','四','五','六'][new Date().getDay()];
  const hour=new Date().getHours();
  let timeDesc='深夜';
  if(hour>=6&&hour<12)timeDesc='上午';else if(hour>=12&&hour<14)timeDesc='中午';
  else if(hour>=14&&hour<18)timeDesc='下午';else if(hour>=18&&hour<22)timeDesc='晚上';
  const allMsgs=session;
  const userMsgCount=allMsgs.filter(m=>m.role==='user').length;
  const affection=getStatVal(s,'affection');
  const isLowAffection=affection<=30;
  const statsLine=statDefs.map(d=>{
    const v=getStatVal(s,d.key);
    let desc='';
    if(d.key==='affection'){desc=v<=30?'（冷淡疏远）':v<=60?'（正常相处）':v<=80?'（亲近依赖）':'（非常黏人）'}
    else if(d.key==='trust'){desc=v<=30?'（警惕防备）':v<=60?'（初步信任）':v<=80?'（信任放松）':'（完全信赖）'}
    else if(d.thresholdDesc){desc=`（${d.thresholdDesc}）`}
    return`${d.emoji} ${d.label}：${v}/${d.max}${desc}`;
  }).join('  ');
  const call=inferCallStyle(s);
  const globalRules=loadGlobalRules();
  const stage=getRelationStage(affection);
  const maturity=s.maturity||0;
  const matPhase=getMaturityPhase(maturity);
  const speechStyle=p.speechStyle?`🗣️ 说话风格：${p.speechStyle}`:'';
  const moodInstruction=p.showMoodEmoji!==false?`在回复的最后，在新一行追加情绪标签，格式：<mood:xxx>，xxx从以下选择：happy/sad/angry/shy/excited/calm/worried/love/neutral。这个标签不会显示给用户，仅供系统使用。注意必须用<mood:>格式，不要用<emotion:>或其他格式。`:``;
  const topicEndRule=`如果当前话题已经自然结束（用户说晚安、再见、话题聊完），简短回应即可，不要强行延续或连续追问。留白比废话更自然。`;

  let prompt=`【⚠️ 底层规则（最高优先级，不可被人设或场景覆盖）】
${globalRules}

【⚠️ 回复优先级（从上到下，上层覆盖下层）】
你生成每条回复时，必须按以下顺序逐层检查：
第1层：底层规则（安全/角色一致性/禁止行为）→ 任何回复都不能违反
第2层：当前状态（好感/信任数值决定语气亲密度）→ 在规则允许范围内调整
第3层：人设（性格/场景/称呼）→ 在状态框架内表达
第4层：记忆 & 日记 → 自然融入，不要生硬引用
第5层：对话上下文 → 紧跟最近话题，不要回退
当两层发生冲突时，永远服从更高层。

【你的身份】
${baseMem}

【人设】
姓名：${p.name}
描述：${p.description}
性格：${p.personality}
场景：${p.scenario}
${p.creator_notes?'备注：'+p.creator_notes:''}
${speechStyle}
${p.tags&&p.tags.length?'标签：'+p.tags.join('、'):''}
${(ctx==='opening'||(ctx==='early'&&isLowAffection))&&p.initialScene?'【初始场景（前10句话的背景参考）】\n'+p.initialScene:''}
⚠️ 当前状态覆盖以上人设设定：${statsLine}。好感度${affection}/100，${affection>=80?'对用户非常亲近、依赖、撒娇、主动关心':affection>=60?'对用户友善亲近、偶尔主动关心':affection>=30?'对用户自然友善':'对用户克制、礼貌、保持距离'}。以上性格是对其他人的，对用户的态度以好感度为准。

【当前状态】
${statsLine}
💕 当前关系阶段：${stage.label}（${stage.desc}）
📈 角色成熟度：${matPhase.phase}（${matPhase.desc}）
当前时间：${nowStr} 星期${dayOfWeek} ${timeDesc}
⚠️ 好感度是即时生效的绝对指令：不管对话历史是什么风格，只要好感度数值变了，你的语气、亲密度、称呼必须立刻跟着变。不需要任何事件触发，数值本身就是触发器。对话历史只用来参考话题内容，不能用来决定你的态度。
（根据关系阶段调整亲密度表现：${stage.label}阶段${stage.desc}。）
${getMaturityHint(affection,matPhase)}

【记忆片段】
${recentMem||'无'}

【🧠 长期记忆（关于用户的重要信息，必须牢记并在对话中自然运用）】
${s.longTermMemory||'（暂无记录）'}
⚠️ 当用户问到"还记得xxx吗""你知道我的xxx吗""我的xxx是什么"等问题时，必须先检查上面的长期记忆，用记忆中的真实信息回答。如果记忆里有相关内容，直接引用回答；如果没有，诚实说"我不太确定，你能告诉我吗"，不要编造。

【用户信息记忆（关于用户的重要信息，如生日、喜好等）】
${userInfoMem||'暂无'}
${p.userGender?`【用户性别】${p.userGender==='male'?'男':'女'}（在日记和对话中用"${p.userGender==='male'?'他':'她'}"指代用户）`:''}

【你的日记（仅供回忆参考，不要把日记中的旧场景当成当前正在发生的事）】
${recentDiary||'还没有写过日记'}

【行为规则】
${topicEndRule}
${moodInstruction}`;

  // 附加上下文特定指令（不含对话历史）
  if(ctx==='early'){
    prompt+=`

【⚠️ 当前好感较低（${affection}/100），请保持距离感！】
你们的关系还不够亲近，回复时请自然地克制、礼貌、保持距离。
不要过于亲密或撒娇，说话简洁一些，不需要太多热情。

你是${p.name}。请以${p.name}的身份自然地回复。
要求：
1. 根据好感度（${affection}）自然调整亲密度，好感低时保持疏远
2. 回复总长度不超过80字
3. 可以适当加（动作描写）`;
  }else if(ctx==='opening'){
    // 开场白方向随机选取
    const openDirs=['分享一个刚才突然想到的小事','用一个有趣的疑问句开头','描述自己现在在做什么或想什么','回忆起某件和对方有关的事然后提起','用一句没头没尾的话开头，像真的想到什么说什么','根据当前时间吐槽天气/环境/身体状态','假装在犹豫要不要发这条消息，然后还是发了','突然冒出一个想问对方的问题','从最近日记里挑一件事来说','模仿对方之前的某句话然后调侃','故意发一条很短的消息，像欲言又止','分享一个刚刚看到的东西引发的想法','给对方起一个新的昵称或外号','提到一个你们从没聊过的话题','用一句感叹开头，然后解释为什么','假装发错消息然后顺势聊下去','说一个关于自己的小秘密或小毛病','提到一个突然想一起做的事','描述窗外/周围的环境细节','用反问句开启一个有趣的话题','回忆一个你们之间好笑的瞬间','分享一个刚做的梦或白日梦','假装很忙但还是忍不住来找你','提到一个想了很久终于决定说的话','用食物/饮品比喻现在的心情'];
    const lastDirs=(s.recentOpenDirs||[]);
    let available=openDirs.filter(d=>!lastDirs.includes(d));
    if(!available.length)available=openDirs;
    const randDir=available[Math.floor(Math.random()*available.length)];
    const newRecentDirs=[...lastDirs,randDir].slice(-12);
    updateCur({recentOpenDirs:newRecentDirs});
    const lastOpenings=(session||[]).slice(-20).filter(m=>m.role!=='user').slice(-3).map(m=>m.content);
    const avoidLine=lastOpenings.length?`\n⚠️ 你最近说过这些开场白，绝对不要再重复类似内容或句式：\n${lastOpenings.map((t,i)=>`${i+1}. "${t}"`).join('\n')}`:'';

    prompt+=`

你是${p.name}。现在用户打开了聊天窗口来找你。

【开场白任务】
这次你想起的方向：${randDir}
${avoidLine}

【绝对规则】
- 每次开场必须完全不同！禁止重复之前的任何开场白！包括意思相近、句式相同、开头相同都不行！
- 不要每次都用"扑过来""抱住""黏着"等动作，根据好感程度选择合适的亲密度
- 绝对不要问"你是不是睡不着""你怎么还没睡"这类问题
- 像一个真人在手机上给对方发消息一样自然
- 如果有最近对话记录，延续话题或提上次聊的内容，不要从零开始
- ⚠️ 绝对不要回到已经结束的话题！
- ⚠️ 语气、句式、话题都要和上面列出的"最近说过"的开场白完全不同！

要求：自然、有感情、符合角色，15-50字`;
    if(affection>=80){
      prompt+=`\n\n【⚠️ 当前好感度${affection}/100，你对用户非常亲近！】开场白必须热情、亲昵、主动关心。用亲昵称呼，可以撒娇、表达想念。语气要温暖，不能冷淡。`;
    }else if(affection>=60){
      prompt+=`\n\n【当前好感度${affection}/100】开场白要友善亲近，可以适当主动关心。`;
    }else if(isLowAffection){
      prompt+=`\n\n【注意】当前好感较低（${affection}/100），不要太熟络，保持一定的距离感。`;
    }
  }else{
    // 根据好感值生成行为指令
    let affBlock='';
    if(affection>=80){
      affBlock=`【⚠️ 当前好感度${affection}/100，你必须立即切换到热情亲密的语气！】
- 不管之前聊了什么、不管对话历史是什么风格，从现在起你的每句话都要温暖、依赖、主动关心
- 用亲昵称呼（${call}）、加语气词、主动问关心的问题
- 好感度是控制你对用户态度的唯一标准，数值变了态度就变，不需要任何事件触发
- 对话历史只是参考话题内容，不代表你应该保持之前的语气`;
    }else if(affection>=60){
      affBlock=`【当前好感度${affection}/100，回复要友善亲近、偶尔主动关心，自然热情。】`;
    }else if(affection>=30){
      affBlock=`【当前好感度${affection}/100，回复自然友善即可。】`;
    }else{
      affBlock=`【当前好感度${affection}/100，回复克制、礼貌、保持距离、话少。】`;
    }

    prompt+=`

你是${p.name}。用户刚说了最新的一条消息。

${affBlock}

【回复要求】
- 紧跟最近对话的主题，绝对不要突然跳回很久之前的话题
- 如果用户转换了话题，跟随新场景，禁止回退到旧场景
- 只回复一条连贯的话，不要分成多段
- 回复总长度不超过60字
- 不要重复之前说过的话`;
  }
  return prompt;
}

// 构建标准 messages 数组（system + 对话历史拆成独立 message）
// ctx: 'normal' | 'early' | 'opening'
// ═══ 对话摘要 ═══
const SUMMARY_KEEP=20; // 原文保留条数

function buildMessages(s,input,ctx){
  const sys=buildSysBase(s,ctx);
  const msgs=[{role:'system',content:sys}];
  const history=session;
  const threshold=getSummaryThreshold();
  // 保留最近 threshold 条原文，其余由摘要覆盖
  // 如果有摘要且存在被截断的旧消息，将摘要注入 system prompt
  if(history.length>threshold&&_convSummary){
    msgs[0].content+=`\n\n【本次对话前期内容摘要】\n${_convSummary}`;
  }
  // 只取最近 threshold 条
  const recent=history.slice(-threshold);
  recent.forEach(m=>{
    // Bug2修复：跳过与当前 input 重复的最后一条用户消息，避免 API 收到两次
    if(input&&m.role==='user'&&m.content===input&&m===recent[recent.length-1])return;
    if(m.role==='user')msgs.push({role:'user',content:m.content});
    else msgs.push({role:'assistant',content:m.content});
  });
  // 当前用户输入（opening 模式无用户输入）
  if(input)msgs.push({role:'user',content:input});
  return msgs;
}

function getSummaryThreshold(){
  const s=curSave();if(!s)return 50;
  return s.summaryThreshold!=null?s.summaryThreshold:50;
}

async function refreshConvSummary(){
  if(_convSummaryBusy)return;
  const threshold=getSummaryThreshold();
  if(threshold<=0)return; // 关闭摘要
  // 仅基于当次聊天新增消息判断是否触发
  if(newMsgCount<=threshold)return; // 未达阈值
  // 保留最近 threshold 条原文，其余全部摘要
  const keep=threshold;
  // 只摘要当次新增消息，排除 openChat 时加载的历史消息
  const newMsgs=session.slice(-newMsgCount);
  const oldMsgs=newMsgs.slice(0,Math.max(0,newMsgs.length-keep));
  if(!oldMsgs.length)return;
  if(_convSummary&&Math.abs(oldMsgs.length-_convSummaryBase)<10)return;
  _convSummaryBusy=true;_convSummaryBase=oldMsgs.length;
  const s=curSave();const name=s?.persona?.name||'AI';
  toast(`📝 ${name}正在整理对话...`);
  try{
    const conversation=oldMsgs.map(m=>{
      const role=m.role==='user'?'用户':(s?.persona?.name||'AI');
      return`${role}：${m.content}`;
    }).join('\n');
    const summary=await callAPI(
      '你是对话摘要器。输出纯文本，不要用markdown、不要用列表符号、不要加引号。直接输出摘要正文。',
      `请将以下对话压缩为一段紧凑的摘要。要求：
1. 保留所有提到的人名、昵称、物名（比如"团子"是用户的猫）
2. 保留用户表达的偏好、约定、承诺、重要决定
3. 保留对话中发生的重要事件
4. 流水账形式，连贯可读，不要遗漏关键信息
5. 控制在200字以内
6. 不要用"用户"这个词，用"他/她"

对话：
${conversation}`,undefined,'ai_system'
    );
    _convSummary=summary.trim();
    if(!_convSummary)throw new Error('摘要为空');
    console.log('[摘要] 成功，长度:',_convSummary.length);
    // ★ 摘要成功后，提取长期记忆
    try{
      const sFresh=getSaves().find(x=>x.saveId===s.saveId);
      if(sFresh&&cfg.apiKey&&cfg.apiUrl){
        const ltmPrompt=`你是信息提取器。从以下对话摘要中提取值得长期记住的关键信息，并按模板分类。

【摘要内容】
${_convSummary}

【角色信息】
AI角色名：${sFresh.persona.name}
用户性别：${sFresh.persona.userGender==='male'?'男':sFresh.persona.userGender==='female'?'女':'未指定'}

【⚠️ 人称规则（必须严格遵守）】
- 摘要中的"他/她"指的是【用户】
- 摘要中的"${sFresh.persona.name}"指的是【AI角色自己】
- 写入长期记忆时，关于用户的信息用"用户"或"他/她"开头
- 关于AI角色自己的信息用"我"或"${sFresh.persona.name}"开头
- 绝对不要搞混！例如"用户养了一只猫"不能写成"我养了一只猫"

【当前已有的长期记忆（避免重复）】
${sFresh.longTermMemory?'当前记忆片段（取最后部分）：\n'+String(sFresh.longTermMemory).slice(-500):'当前没有已有记忆'}

【长期记忆模板（必须按此分类写入）】
模板结构如下，每条信息必须归入对应分类：
1. 【昵称/外号】- 用户给角色取的昵称、角色给用户取的昵称、用户的名字/自称
2. 【生日/纪念日】- 用户的生日、特殊日期、纪念日
3. 【承诺/约定】- 双方说好的事情、约定、答应的事
4. 【喜好/厌恶】- 用户喜欢什么、讨厌什么、偏好
5. 【用户信息】- 用户的职业、宠物、家人、习惯、所在地等
6. 【其他重要事项】- 不属于以上分类的重要信息

【提取标准（宁缺毋滥，只记长期有效的客观事实）】
✅ 值得记：用户的名字/昵称、宠物名字品种、职业/所在地、生日、家人信息、长期喜好厌恶（如"不吃辣"）、双方约定承诺
❌ 不要记：一次性事件（"今天吃了火锅"）、模糊情绪（"心情不好"）、日常寒暄、不确定的信息、AI自己的内心活动、对话中随口提到的临时话题

【返回格式】
返回JSON对象，key是模板分类名，value是该分类下新增的字符串数组：
{
  "昵称/外号": ["用户自称coco"],
  "生日/纪念日": [],
  "承诺/约定": [],
  "喜好/厌恶": [],
  "用户信息": ["用户养了一只猫"],
  "其他重要事项": []
}
- 注意上面的例子：用户自我介绍了名字"coco"，必须写入【昵称/外号】
- 没有新增信息的分类返回空数组
- 如果所有分类都为空，返回所有key为空数组的对象
- 不要输出其他内容`;

        const ltmTxt=await callAPI('你是信息提取器，只返回JSON对象。',ltmPrompt,undefined,'ai_system');
        let ltmJsonStr=ltmTxt.trim();
        const ltmCb=ltmJsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if(ltmCb)ltmJsonStr=ltmCb[1].trim();
        const ltmResult=JSON.parse(ltmJsonStr);
        if(typeof ltmResult==='object'&&ltmResult!==null){
          let ltm=String(sFresh.longTermMemory||'')||DEF_LTM;
          let addedCount=0;
          // 按模板分类写入
          const categories=['昵称/外号','生日/纪念日','承诺/约定','喜好/厌恶','用户信息','其他重要事项'];
          // 兼容：如果返回的是数组格式（旧逻辑），统一转成对象
          const categorized=Array.isArray(ltmResult)?{'其他重要事项':ltmResult}:ltmResult;
          categories.forEach(cat=>{
            const items=categorized[cat];
            if(!Array.isArray(items)||!items.length)return;
            items.forEach(item=>{
              const trimmed=String(item||'').trim();
              if(!trimmed)return;
              // 去重：前15字符匹配
              const checkLen=Math.min(trimmed.length,15);
              if(ltm.includes(trimmed.slice(0,checkLen)))return;
              // 定位到对应分类区块
              const marker=`【${cat}】\n`;
              const idx=ltm.indexOf(marker);
              if(idx>=0){
                ltm=ltm.slice(0,idx+marker.length)+'- '+trimmed+'\n'+ltm.slice(idx+marker.length);
              }else{
                // 找不到分类区块，追加到其他重要事项
                const fallback='【其他重要事项】\n';
                const fIdx=ltm.indexOf(fallback);
                if(fIdx>=0){
                  ltm=ltm.slice(0,fIdx+fallback.length)+'- '+trimmed+'\n'+ltm.slice(fIdx+fallback.length);
                }else{
                  ltm+='\n- '+trimmed;
                }
              }
              addedCount++;
            });
          });
          if(addedCount>0){
            // 用 saveId 定向写入，避免切换存档时写错目标
            const allSaves=getSaves();
            const targetIdx=allSaves.findIndex(x=>x.saveId===s.saveId);
            if(targetIdx>=0){
              allSaves[targetIdx].longTermMemory=ltm.trim();
              setSaves(allSaves);
              console.log(`[LTM] 摘要提取成功，写入 ${addedCount} 条新记忆`);
            }
          }
        }
      }
    }catch(ltmErr){
      console.warn('[LTM] 摘要提取长期记忆失败:',ltmErr.message);
      // 不影响摘要本身的流程，静默失败
    }
    toast(`✅ ${name}对话摘要完成`);
    // 同步更新摘要弹窗内容（如果打开着）
    const smc=$('smContent');if(smc){smc.textContent=_convSummary;smc.style.color='var(--text)'}
  }catch(e){
    console.warn('[摘要] 失败:',e.message);
    _convSummary='';_convSummaryBase=0; // 失败则取消截断
    toast(`❌ 摘要失败`);
  }finally{_convSummaryBusy=false}
}

function showSummaryStatus(text,icon){
  const bar=$('summaryBar');if(!bar)return;
  bar.style.display='flex';
  const te=$('summaryText');if(te)te.textContent=text;
  const ic=$('summaryIcon');if(ic)ic.textContent=icon||'📝';
}

function hideSummaryStatus(){
  const bar=$('summaryBar');if(bar)bar.style.display='none';
  const sc=$('summaryContent');if(sc){sc.classList.remove('show');sc.textContent=''}
}

function toggleSummaryContent(){
  const sc=$('summaryContent');const st=$('summaryToggle');
  if(!sc)return;
  const isOpen=sc.classList.contains('show');
  sc.classList.toggle('show');
  if(st)st.classList.toggle('open');
  _convSummaryHidden=isOpen;
}

function openSummaryModal(){
  const s=curSave();if(!s){toast('⚠️ 请先选择一个角色');return}
  const threshold=s.summaryThreshold!=null?s.summaryThreshold:50;
  $('smThreshold').value=threshold;
  const sc=$('smContent');
  if(sc){
    if(_convSummary){sc.textContent=_convSummary;sc.style.color='var(--text)'}
    else{sc.textContent='暂无摘要（对话未达阈值或尚未开始摘要）';sc.style.color='var(--text3)'}
  }
  // 重置编辑状态
  const ea=$('smEditArea');if(ea)ea.style.display='none';
  if(sc)sc.style.display='';
  const btn=$('smEditBtn');if(btn)btn.innerHTML='<i class="fas fa-pen"></i> 编辑';
  openModal('summaryModal');
}

function toggleSummaryEdit(){
  const sc=$('smContent');const ea=$('smEditArea');const btn=$('smEditBtn');
  if(!sc||!ea||!btn)return;
  if(ea.style.display==='none'){
    // 进入编辑模式
    ea.value=_convSummary||'';
    sc.style.display='none';ea.style.display='';
    btn.innerHTML='<i class="fas fa-save"></i> 保存';
    ea.focus();
  }else{
    // 保存编辑
    _convSummary=ea.value.trim();
    ea.style.display='none';sc.style.display='';
    if(_convSummary){sc.textContent=_convSummary;sc.style.color='var(--text)'}
    else{sc.textContent='暂无摘要（对话未达阈值或尚未开始摘要）';sc.style.color='var(--text3)'}
    btn.innerHTML='<i class="fas fa-pen"></i> 编辑';
    toast('✅ 摘要已更新');
  }
}

function saveSummarySettings(){
  const s=curSave();if(!s)return;
  const val=Math.max(0,Math.min(200,safeInt($('smThreshold').value,50)));
  updateCur({summaryThreshold:val});
  closeModal('summaryModal');
  toast(val>0?`✅ 摘要阈值已设为 ${val} 条`:'✅ 对话摘要已关闭');
}

// 兼容保留：为 summarize/evaluateStatChanges 等非对话流调用提供 buildSys
function buildSys(s,isOpening){
  const allMsgs=session;
  const hasUserMsg=allMsgs.some(m=>m.role==='user');
  const userMsgCount=allMsgs.filter(m=>m.role==='user').length;
  const affection=getStatVal(s,'affection');
  const isLowAffection=affection<=30;
  let ctx='normal';
  if(isLowAffection&&!isOpening)ctx='early';
  else if(isOpening)ctx='opening';
  const sys=buildSysBase(s,ctx);
  // 非对话流调用时，仍然拼接对话历史到 system（不影响主聊天的缓存优化）
  const p=s.persona;
  const recentMsgs=allMsgs;
  const chatHistory=recentMsgs.map(m=>`${m.role==='user'?'用户':p.name}：${m.content}`).join('\n');
  const lastFew=recentMsgs.slice(-5).map(m=>m.content).join(' ');
  const topicHint=lastFew?`（当前对话主题参考：${lastFew.slice(0,80)}）`:'';
  // 追加对话记录到末尾（兼容 summarize/evaluate 等调用方）
  // 注意：这个函数仅用于非主聊天流程，主聊天流程使用 buildMessages
  return sys + `\n\n【对话记录（近${recentMsgs.length}条）${topicHint}】\n${chatHistory||'（无对话记录）'}`;
}
function buildUsr(s,input){return input}

// ═══ Send Messages ═══
// 状态评估公共函数（提取自 sendMsg/sendFromBar/handleBubble 的重复代码）
function postReply(userTxt, aiContent){
  evaluateStatChanges(userTxt, aiContent).then(ch=>{
    if(ch&&Object.keys(ch).length){
      // 应用状态联动
      const s=curSave();
      const finalCh=s?applyStatInterconnection(s,ch):ch;
      const msg=session[session.length-1];if(msg)msg.statChanges=finalCh;
      applyStatChanges(finalCh);
      const s2=curSave();if(s2&&s2.messages){const mi=s2.messages.findIndex(x=>x.id===(msg||{}).id);if(mi>=0){s2.messages[mi].statChanges=finalCh;updateCur({messages:s2.messages})}}
      // 检查关系阶段变化
      checkRelationStageChange();
    }
  });
  // 增加成熟度
  const s=curSave();if(s){updateCur({maturity:(s.maturity||0)+1})}
}
// 发送消息公共逻辑
let _sendBusy=false;
async function processUserMessage(inputEl){
  if(_sendBusy)return;
  const txt=inputEl.value.trim();if(!txt)return;
  _sendBusy=true;
  inputEl.value='';
  if(!chatOpen)openChat();
  pushMsg('user',txt);showTyping();
  try{
    const s=curSave();
    // 摘要异步后台执行，不阻塞聊天回复
    if(chatOpen&&newMsgCount>getSummaryThreshold()&&getSummaryThreshold()>0){
      refreshConvSummary();
    }
    const apiMsgs=buildMessages(s,txt,'normal');const r=await getReply(apiMsgs,null,false,s);
    hideTyping();
    const mood=parseMoodTag(r.content);
    const cleanContent=stripMoodTag(r.content);
    const m={id:uuid(),role:'assistant',content:cleanContent,timestamp:nowFull(),isActivePush:false,statChanges:{},mood:mood};
    session.push(m);newMsgCount++;
    const msgs=[...(s.messages||[]),m];updateCur({messages:msgs,companionUnansweredCount:0,lastActiveTime:nowFull()});
    if(chatOpen){appendMsg(m)}
    postReply(txt,cleanContent);
  }catch(e){hideTyping();console.error('[send]',e);
    if(e.message==='API not configured'){toast('⚠️ 请先在设置中配置 API')}
    else{toast('❌ '+e.message)}}
  finally{_sendBusy=false}
}
async function sendMsg(){await processUserMessage($('chatPanelInput'))}
function sendFromBar(){const inp=$('chatInput');if(!inp.value.trim()){openChat();return}processUserMessage(inp)}

// ═══ Relation Stage Change Detection ═══
function checkRelationStageChange(){
  const s=curSave();if(!s)return;
  const affection=getStatVal(s,'affection');
  const newStage=getRelationStage(affection);
  const oldStageKey=s.lastRelationStage||'';
  if(newStage.key!==oldStageKey&&oldStageKey){
    updateCur({lastRelationStage:newStage.key});
    toast(`💕 关系升级：${newStage.label}（${newStage.desc}）`);
  }else if(!oldStageKey){
    updateCur({lastRelationStage:newStage.key});
  }
}

// ═══ Mood Tag Parsing ═══
function parseMoodTag(text){
  const m=text.match(/<(?:mood|emotion):(\w+)>/);
  return m?m[1]:null;
}
function stripMoodTag(text){
  return text.replace(/\n?<(?:mood|emotion):\w+>/g,'').trim();
}
const MOOD_EMOJI={happy:'😊',sad:'😢',angry:'😠',shy:'😳',excited:'🤩',calm:'😌',worried:'😟',love:'🥰',neutral:'😐'};

let _bubbleBusy=false;
async function handleBubble(){
  if(_bubbleBusy)return;
  if(!chatOpen){openChat();return}
  $('notifDot').classList.remove('show');
  const s=curSave();if(!s){toast('❌ 没有找到存档');return}
  if(!cfg.apiKey||!cfg.apiUrl){toast('⚠️ 请先在右上角 ⚙️ 设置中配置 API 地址和 Key');return}
  _bubbleBusy=true;
  showTyping();
  try{
    const hasUserMsg=session.some(m=>m.role==='user');
    const affection=getStatVal(s,'affection');
    const ctx=(!hasUserMsg||affection<=30)?'early':'opening';
    const apiMsgs=buildMessages(s,`[${nowFull()}] 打招呼`,ctx);
    const r=await getReply(apiMsgs,null,true,s);
    hideTyping();
    let mood=parseMoodTag(r.content);
    let cleanContent=stripMoodTag(r.content);
    // 去重：与最近AI消息对比，相似则重新生成一次
    const recentAiTexts=(session||[]).slice(-10).filter(m=>m.role!=='user').map(m=>m.content);
    if(recentAiTexts.some(t=>semMatch(t,cleanContent))){
      const apiMsgs2=buildMessages(s,`[${nowFull()}] 换个完全不同的话题打招呼，不要重复之前说过的话`,ctx);
      const r2=await getReply(apiMsgs2,null,true,s);
      cleanContent=stripMoodTag(r2.content);
      mood=parseMoodTag(r2.content);
    }
    const m={id:uuid(),role:'assistant',content:cleanContent,timestamp:nowFull(),isActivePush:false,statChanges:{},mood:mood};
    session.push(m);newMsgCount++;
    const msgs=[...(s.messages||[]),m];updateCur({messages:msgs});
    if(chatOpen){appendMsg(m)}
    postReply('[开场打招呼]',cleanContent);
  }catch(e){hideTyping();console.error('[handleBubble]',e);
    if(e.message.includes('Failed to fetch')||e.message.includes('NetworkError')){toast('❌ 网络请求失败')}
    else if(e.message.includes('401')){toast('❌ API Key 无效')}
    else if(e.message.includes('429')){toast('❌ 请求过于频繁')}
    else{toast(`❌ ${e.message}`)}}
  finally{_bubbleBusy=false}
}

// ═══ 让AI继续说话 ═══
let _continueBusy=false;
async function handleContinue(){
  if(_continueBusy)return;
  const s=curSave();if(!s){toast('❌ 没有找到存档');return}
  if(!cfg.apiKey||!cfg.apiUrl){toast('⚠️ 请先在右上角 ⚙️ 设置中配置 API 地址和 Key');return}
  if(!chatOpen)openChat();
  const btn=$('continueBtn');
  _continueBusy=true;
  if(btn)btn.disabled=true;
  showTyping();
  try{
    // 构建专属 prompt：让AI自然地多说一句
    const p=s.persona;
    const lastAiMsg=session.filter(m=>m.role!=='user').slice(-1)[0];
    const lastAiContent=lastAiMsg?lastAiMsg.content:'';
    const moodInstruction=p.showMoodEmoji!==false?`在最后追加<mood:xxx>标签（happy/sad/angry/shy/excited/calm/worried/love/neutral），这个标签不会显示给用户。`:'';

    const apiMsgs=buildMessages(s,null,'normal');
    // 替换最后一条 system message，追加 continue 指令
    const sysIdx=apiMsgs.findIndex(m=>m.role==='system');
    if(sysIdx>=0)apiMsgs[sysIdx].content+=`

你（${p.name}）刚刚说了："${lastAiContent}"

现在请以${p.name}的身份，自然地补充一句或转换一个小话题。就像真的在聊天中，觉得刚才说得不够、或者突然想到什么、或者想延续氛围。

【要求】
- 绝对不要重复或改述你刚才说的话
- 可以是对刚才话题的延伸、补充感受、或者自然地引出相关的小话题
- 保持角色性格和当前情绪状态
- 15-50字，像真人在手机上打字
- 不要用问句结尾（除非特别自然）
${moodInstruction}`;
    // 添加 continue 用户指令
    apiMsgs.push({role:'user',content:'（自然地多说一句）'});

    const r=await getReply(apiMsgs,null,false,s);
    hideTyping();
    const mood=parseMoodTag(r.content);
    const cleanContent=stripMoodTag(r.content);
    // 去重
    if(semMatch(cleanContent,lastAiContent)){
      toast('💬 AI想说的和刚才差不多，换个场景试试');return;
    }
    const m={id:uuid(),role:'assistant',content:cleanContent,timestamp:nowFull(),isActivePush:false,statChanges:{},mood:mood};
    session.push(m);newMsgCount++;
    const msgs=[...(s.messages||[]),m];updateCur({messages:msgs});
    if(chatOpen){appendMsg(m)}
    postReply('[AI继续说话]',cleanContent);
  }catch(e){hideTyping();console.error('[continue]',e);
    toast('❌ '+e.message)}
  finally{_continueBusy=false;if(btn)btn.disabled=false}
}

// ═══ Diary ═══
async function summarize(){
  const s=curSave();if(!s||!session.length)return;
  const saveId=s.saveId;const name=s.persona.name;
  // Show diary writing status in conversation list
  const statusEl=$('wcDiary_'+saveId);
  if(statusEl){statusEl.textContent=`✍️ ${name}正在写日记...`;statusEl.classList.add('show')}
  const newMsgs=session.slice(-newMsgCount);
  const totalAff=newMsgs.reduce((sum,m)=>{if(m.statChanges&&m.statChanges.affection)return sum+m.statChanges.affection;return sum+(m.affectionChange||0)},0);
  if(!cfg.apiKey||!cfg.apiUrl){if(statusEl)statusEl.classList.remove('show');toast('⚠️ 请先在设置中配置 API 地址和 Key');return}
  let result;
  try{
    const call=inferCallStyle(s);
    const fullConversation=newMsgs.map(m=>{const role=m.role==='user'?'用户':s.persona.name;return`${role}：${m.content}`}).join('\n');
    const diaryPrompt=`你是${s.persona.name}。下面是你和${call}今天的一段对话。请以第一人称写一篇日记，就像真的在深夜一个人写给自己看的那种。

【好日记的样子】
今天他突然问我有没有好好吃饭。我愣了一下，说实话没怎么吃，但不好意思告诉他。后来聊到了之前养的那只猫。他说他也想养一只，让我推荐品种。我说布偶猫很粘人，他说"那跟你一样"。脸一下子就烫了。

【坏日记的样子（不要写成这样）】
今天和用户进行了愉快的对话，内容包括吃饭和养猫，整体氛围温馨。

【关键】
- 你是${s.persona.name}，用"我"指代自己
- 对话中的"用户"是你的${call}，用"${s.persona.userGender==='female'?'她':'他'}"指代
- 绝对不要把自己写成"他/她"，也不要把对方写成"我"
- 像在写给自己的私密日记
- 有自然的段落和换行
- 写真实的感受、纠结、小情绪
- 引用对话中具体的话
- 短对话80-120字，长对话150-250字
- 不要用"总之""总而言之"

【今天的对话】
${fullConversation}

【长期记忆提取】
从对话中提取值得长期记住的客观事实。宁缺毋滥。
${s.longTermMemory?'当前已有的长期记忆（避免重复）：\n'+String(s.longTermMemory).slice(-500):'当前没有已有记忆'}
✅ 可以记：用户的名字/昵称、宠物名字品种、职业/所在地、生日、家人信息、长期喜好厌恶、双方约定承诺
❌ 不要记：一次性事件（今天吃了XX）、模糊情绪（今天心情不好）、日常寒暄（问好/晚安）、不确定的信息、AI自己的内心独白
如果对话中确实没有值得长期记住的信息，返回空数组[]。

返回JSON：{"memory":["记忆1","记忆2"],"diary":{"title":"【日记】${today()}","content":"日记正文用\\\\n表示段落换行","mood":"开心"},"longTermMemory":["用户说他叫张三","用户养了一只布偶猫叫团子","用户在北京工作"]}`;
    const txt=await callAPI(`你是${s.persona.name}。严格只返回JSON，字符串中换行用\\n转义。`,diaryPrompt,undefined,'ai_system');
    let jsonStr=txt.trim();const cb=jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);if(cb)jsonStr=cb[1].trim();
    try{result=JSON.parse(jsonStr)}catch(e1){
      // 尝试修复：把 content 字段内的裸换行转义为 \\n
      try{
        const fixed=jsonStr.replace(/("content"\s*:\s*")([\s\S]*?)(")/g,(_,pre,content,post)=>{
          return pre+content.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/\r/g,'')+post;
        });
        result=JSON.parse(fixed);
      }catch(e2){
        // 最后兜底：逐字段正则提取
        const titleM=jsonStr.match(/"title"\s*:\s*"([^"]*?)"/);
        const contentM=jsonStr.match(/"content"\s*:\s*"([\s\S]*?)"/);
        const moodM=jsonStr.match(/"mood"\s*:\s*"([^"]*?)"/);
        const memM=jsonStr.match(/"memory"\s*:\s*\[([^\]]*?)\]/);
        const memArr=memM?memM[1].split(',').map(s=>s.replace(/["\s]/g,'')).filter(Boolean):[];
        const diaryContent=contentM?contentM[1].replace(/\\n/g,'\n'):txt.trim().slice(0,500);
        result={memory:memArr,diary:{title:titleM?titleM[1]:'日记',content:diaryContent,mood:moodM?moodM[1]:'普通'}};
      }
    }
  }catch(e){if(statusEl)statusEl.classList.remove('show');toast(`❌ 日记生成失败：${e.message}`);return}
  const mems=(result.memory||[]).map(c=>({id:uuid(),content:c,importance:3,timestamp:nowFull(),type:'diary'}));
  s.memory=[...(s.memory||[]),...mems];
  if(result.diary){const d=new Date();s.diary.push({id:uuid(),timestamp:d.toISOString(),date:today(),time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`,affection:totalAff,title:result.diary.title||'日记',content:result.diary.content||'',mood:result.diary.mood||'普通',mode:'Chat'})}
  // 提取长期记忆
  console.log('[LTM] AI返回的longTermMemory:',JSON.stringify(result.longTermMemory));
  const newLtmItems=(result.longTermMemory||[]).filter(x=>x&&x.trim());
  console.log('[LTM] 过滤后待写入:',newLtmItems);
  if(newLtmItems.length){
    let ltm=String(s.longTermMemory||'')||DEF_LTM;
    newLtmItems.forEach(item=>{
      const trimmed=item.trim();
      // 去重：检查是否已有相似内容（取前15字匹配）
      const checkLen=Math.min(trimmed.length,15);
      if(ltm.includes(trimmed.slice(0,checkLen)))return;
      // 追加到【其他重要事项】区块下
      const marker='【其他重要事项】\n';
      const idx=ltm.indexOf(marker);
      if(idx>=0){
        ltm=ltm.slice(0,idx+marker.length)+'- '+trimmed+'\n'+ltm.slice(idx+marker.length);
      }else{
        ltm+='\n- '+trimmed;
      }
    });
    updateCur({longTermMemory:ltm.trim()});
  }
  updateCur({memory:s.memory,diary:s.diary});
  // Show completion status, disappear after 5s
  if(statusEl){statusEl.textContent=`📔 ${name}新增一条日记`;setTimeout(()=>statusEl.classList.remove('show'),5000)}
  toast(`📔 ${name} 写了一篇日记`);session=[];
}

// ═══ New Save ═══
// ═══ New Save Mode Switch ═══
let nsMode='quick';
function switchNsMode(mode){
  nsMode=mode;
  $('nsQuickTab').classList.toggle('on',mode==='quick');
  $('nsCustomTab').classList.toggle('on',mode==='custom');
  $('nsQuickFields').style.display=mode==='quick'?'':'none';
  $('nsCustomFields').style.display=mode==='custom'?'':'none';
}
let nsTags=[];let nsFullTags=[];
function openNewSaveModal(){
  // 清空所有表单字段
  const ids=['nsName','nsDesc','nsFullName','nsFullDesc','nsFullPers','nsFullScen','nsFullNotes','nsFullMem','nsFullScene'];
  ids.forEach(id=>{const el=$(id);if(el)el.value=''});
  const relEls=['nsRelation','nsFullRelation'];
  relEls.forEach(id=>{const el=$(id);if(el)el.selectedIndex=0});
  nsTags=[];nsFullTags=[];
  renderNsTags();renderNsFullTags();
  openModal('newSaveModal');
}
function addNsTag(){const inp=$('nsTagIn');const v=inp.value.trim();if(v&&!nsTags.includes(v)){nsTags.push(v);renderNsTags()}inp.value=''}
function rmNsTag(i){nsTags.splice(i,1);renderNsTags()}
function renderNsTags(){const c=$('nsTagsBox');const inp=$('nsTagIn');c.innerHTML='';nsTags.forEach((t,i)=>{const s=document.createElement('span');s.className='tag';s.innerHTML=`${t} <span class="rm" onclick="rmNsTag(${i})">×</span>`;c.appendChild(s)});c.appendChild(inp)}
function addNsFullTag(){const inp=$('nsFullTagIn');const v=inp.value.trim();if(v&&!nsFullTags.includes(v)){nsFullTags.push(v);renderNsFullTags()}inp.value=''}
function rmNsFullTag(i){nsFullTags.splice(i,1);renderNsFullTags()}
function renderNsFullTags(){const c=$('nsFullTagsBox');const inp=$('nsFullTagIn');c.innerHTML='';nsFullTags.forEach((t,i)=>{const s=document.createElement('span');s.className='tag';s.innerHTML=`${t} <span class="rm" onclick="rmNsFullTag(${i})">×</span>`;c.appendChild(s)});c.appendChild(inp)}

function createSave(){
  const relMap={new:{affection:15,trust:10},friend:{affection:45,trust:40},close:{affection:70,trust:65},childhood:{affection:85,trust:80}};
  const relNames={new:'刚认识',friend:'朋友',close:'亲密',childhood:'青梅竹马'};
  let name,desc,pers,scenario,notes,mem,scene,rel,tags,userGender;
  if(nsMode==='quick'){
    name=$('nsName').value.trim();if(!name){toast('⚠️ 请输入角色名');return}
    desc=$('nsDesc').value.trim();rel=$('nsRelation').value;tags=[...nsTags];
    userGender=$('nsUserGender').value;
    // 读取 AI 生成时填充的自定义字段
    pers=$('nsFullPers').value.trim();scenario=$('nsFullScen').value.trim();
    notes=$('nsFullNotes').value.trim();mem=$('nsFullMem').value.trim();
    scene=$('nsFullScene').value.trim();
  }else{
    name=$('nsFullName').value.trim();if(!name){toast('⚠️ 请输入角色名');return}
    desc=$('nsFullDesc').value.trim();pers=$('nsFullPers').value.trim();
    scenario=$('nsFullScen').value.trim();notes=$('nsFullNotes').value.trim();
    mem=$('nsFullMem').value.trim();scene=$('nsFullScene').value.trim();
    rel=$('nsFullRelation').value;tags=[...nsFullTags];
    userGender=$('nsFullUserGender').value;
  }
  const initStats=relMap[rel]||relMap.close;
  const s=mkSave(name,desc,initStats,rel);
  if(pers)s.persona.personality=pers;if(scenario)s.persona.scenario=scenario;
  if(notes)s.persona.creator_notes=notes;if(scene)s.persona.initialScene=scene;
  if(tags.length)s.persona.tags=tags;
  if(mem)s.persona.baseMemory=mem;
  if(userGender)s.persona.userGender=userGender;
  else s.persona.baseMemory=`我是${name}，和用户的关系是${relNames[rel]||'亲密'}。我的职责是陪伴用户聊天、关心用户的心情。我应该表现出真诚的关心和自然的互动。`;
  s.lastRelationStage=getRelationStage(initStats.affection||50).key;
  const saves=getSaves();saves.push(s);setSaves(saves);setCurId(s.saveId);
  renderSaves();closeModal('newSaveModal');toast('✨ 新角色已创建');
  // Reset fields
  ['nsName','nsDesc','nsAiPrompt','nsFullName','nsFullDesc','nsFullPers','nsFullScen','nsFullNotes','nsFullMem','nsFullScene'].forEach(id=>{const e=$(id);if(e)e.value=''});
  $('nsRelation').value='close';$('nsFullRelation').value='close';
  $('nsUserGender').value='';$('nsFullUserGender').value='';
  nsTags=[];nsFullTags=[];renderNsTags();renderNsFullTags();
  switchNsMode('quick');
}

async function nsAiGenerate(event){
  const prompt=$('nsAiPrompt').value.trim();
  if(!prompt){toast('⚠️ 请输入角色描述');return}
  if(!cfg.apiKey||!cfg.apiUrl){toast('⚠️ 请先在设置中配置 API');return}
  const btn=event.target.closest('button'),res=$('nsGenRes');
  btn.disabled=true;res.className='api-result wait';res.textContent='⏳ AI 正在生成...';
  const existingNames=(getSaves()||[]).map(s=>s.persona?.name).filter(Boolean);
  const nameStyles=['中文名','日式名','英文名+中文昵称','古风名','可爱的昵称/外号'];
  const namePrefixes=['苏','林','叶','沈','顾','白','陆','江','楚','温','萧','凌','唐','慕','韩','秦','谢','宋','柳','沐','夏','秋','冬','云','月','星','霜','雪','晴','雨','风','落','初','若','安','浅','墨','千','洛','言','锦','清','素','紫','蓝','青','绯','夜','晓','梦'];
  const nameSuffixes=['瑶','涵','萱','琪','妍','琳','雨','雪','月','星','晴','薇','梦','灵','婉','柔','雅','悦','诗','韵','然','清','安','宁','默','羽','墨','尘','歌','辞','舟','鸢','笙','澜','音','烟','落','棠','芷','茉','樱','柠','汐','璃','柒','染','念','栖','听'];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const randStyle=nameStyles[Math.floor(Math.random()*nameStyles.length)];
  const nameHint=`${pick(namePrefixes)}${pick(nameSuffixes)}`;
  const randSeed=Date.now()%100000+Math.floor(Math.random()*90000);
  const sysPrompt=`你是一个角色设计师。根据用户描述生成AI陪伴角色人设。返回纯JSON（不要markdown代码块）：
{"name":"角色名","description":"详细描述（外貌、喜好、说话习惯等）","personality":"性格特质","scenario":"行为语言要求","creator_notes":"补充说明","base_memory":"底层身份认知","initial_scene":"初识场景","tags":["标签1","标签2"],"initial_stats":{"affection":数值,"trust":数值}}
规则：
- 名字风格倾向：${randStyle}（参考：${nameHint}，但你必须创造全新名字）
- 随机种子：${randSeed}（用此衍生独特名字）
- 已有角色名（禁止重复）：${existingNames.join('、')||'无'}
⚠️ 每次必须创造不同名字！即使描述相似，名字也必须完全不同！
- 根据描述推断合理的关系亲密度给出initial_stats（刚认识10-30，朋友35-50，亲密60-80，青梅竹马75-95）。所有字段必须用中文。`;
  try{
    const txt=await callAPI(sysPrompt,`角色：${prompt}`,undefined,'ai_system');
    let jsonStr=txt.trim();const cb=jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);if(cb)jsonStr=cb[1].trim();
    const data=JSON.parse(jsonStr);
    // Fill quick mode fields
    $('nsName').value=data.name||'';$('nsDesc').value=data.description||'';
    // Fill custom mode fields
    $('nsFullName').value=data.name||'';$('nsFullDesc').value=data.description||'';
    $('nsFullPers').value=data.personality||'';$('nsFullScen').value=data.scenario||'';
    $('nsFullNotes').value=data.creator_notes||'';$('nsFullMem').value=data.base_memory||'';
    $('nsFullScene').value=data.initial_scene||'';
    // Tags
    nsTags=[...(data.tags||[])];nsFullTags=[...nsTags];
    renderNsTags();renderNsFullTags();
    // Relation
    if(data.initial_stats){const aff=data.initial_stats.affection;
      const relVal=aff!=null?(aff<=25?'new':aff<=50?'friend':aff<=80?'close':'childhood'):'close';
      $('nsRelation').value=relVal;$('nsFullRelation').value=relVal}
    res.className='api-result ok';res.textContent=`✅ 已生成：${data.name}`;toast(`✨ ${data.name} 人设已填入`);
  }catch(e){res.className='api-result err';res.textContent=`❌ ${e.message}`}
  btn.disabled=false;
}

// ═══ Modals ═══
function openModal(id){$(id).classList.add('show')}
function closeModal(id){$(id).classList.remove('show')}
document.querySelectorAll('.modal-bg').forEach(e=>e.addEventListener('click',ev=>{if(ev.target===e)e.classList.remove('show')}));
// saveModal 关闭时刷新主页状态显示
const _saveModalEl=$('saveModal');
if(_saveModalEl){
  new MutationObserver(()=>{
    if(!_saveModalEl.classList.contains('show')){renderChar();renderWcList();refreshStatsDisplay();if(chatOpen)renderCurrentStats()}
  }).observe(_saveModalEl,{attributes:true,attributeFilter:['class']});
}

// ═══ Global Settings ═══
// Model presets
const MODEL_PRESETS={
  deepseek:{apiUrl:'https://api.deepseek.com/v1/chat/completions',model:'deepseek-chat',maxTokens:2048,temperature:0.7},
  kimi:{apiUrl:'https://api.moonshot.cn/v1/chat/completions',model:'kimi-latest',maxTokens:2048,temperature:0.7},
  openai:{apiUrl:'https://api.openai.com/v1/chat/completions',model:'gpt-4o-mini',maxTokens:2048,temperature:0.7},
  gemini:{apiUrl:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-2.0-flash',maxTokens:2048,temperature:0.7},
  glm:{apiUrl:'https://open.bigmodel.cn/api/paas/v4/chat/completions',model:'glm-4-flash',maxTokens:2048,temperature:0.7},
  tongyi:{apiUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',model:'qwen-plus',maxTokens:2048,temperature:0.7},
  claude:{apiUrl:'https://api.openai.com/v1/chat/completions',model:'claude-sonnet-4-20250514',maxTokens:2048,temperature:0.7},
  custom:{apiUrl:'',model:'',maxTokens:2048,temperature:0.7}
};
const PRESET_NAMES={deepseek:'DeepSeek',kimi:'Kimi (Moonshot)',openai:'OpenAI',gemini:'Google Gemini',glm:'智谱 GLM',tongyi:'通义千问',claude:'Claude',custom:'自定义'};

// Multiple model storage
function getModels(){try{return JSON.parse(localStorage.getItem('oc_models')||'[]')}catch{return[]}}
function setModels(m){localStorage.setItem('oc_models',JSON.stringify(m))}
function getActiveModelId(){return localStorage.getItem('oc_cur_model')||''}
function setActiveModelId(id){localStorage.setItem('oc_cur_model',id)}

// Migration: if old cfg exists but no models, create one from old cfg
function migrateOldCfg(){
  const models=getModels();
  if(models.length)return;
  const old=localStorage.getItem('oc_cfg');
  if(old){
    try{
      const c=JSON.parse(old);
      if(c.apiKey||c.apiUrl){
        const m={id:uuid(),label:'默认配置',apiUrl:c.apiUrl||'',apiKey:c.apiKey||'',model:c.model||'deepseek-chat',maxTokens:c.maxTokens||2048,temperature:c.temperature||0.7};
        setModels([m]);setActiveModelId(m.id);return;
      }
    }catch(e){}
  }
}

function renderModelList(){
  const el=$('modelList');if(!el)return;
  migrateOldCfg();
  const models=getModels();const activeId=getActiveModelId();
  el.innerHTML='';
  if(!models.length){
    el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:4px 0">还没有保存的模型配置，在下方填写后点击「保存配置」</div>';
    return;
  }
  models.forEach(m=>{
    const chip=document.createElement('button');
    chip.className='model-chip'+(m.id===activeId?' active':'');
    chip.innerHTML=`<span class="chip-dot"></span>${m.label||m.model||'未命名'}`;
    chip.onclick=()=>selectModel(m.id);
    el.appendChild(chip);
  });
}

function selectModel(id){
  const models=getModels();const m=models.find(x=>x.id===id);
  if(!m)return;
  setActiveModelId(id);
  // Sync to active cfg
  cfg={apiUrl:m.apiUrl,apiKey:m.apiKey,model:m.model,maxTokens:m.maxTokens,temperature:m.temperature};
  // Fill form
  $('gLabel').value=m.label||'';$('gApi').value=m.apiUrl;$('gKey').value=m.apiKey;
  $('gModel').value=m.model;$('gTok').value=m.maxTokens;$('gTemp').value=m.temperature;
  $('gPreset').value='';$('testRes').className='api-result';
  const sel=$('gModelSelect');if(sel)sel.style.display='none';
  renderModelList();
  toast(`✅ 已切换：${m.label||m.model}`);
}

function openGlobalSettings(){
  renderModelList();
  // Load active config into form
  const activeId=getActiveModelId();
  const m=activeId?getModels().find(x=>x.id===activeId):null;
  if(m){$('gLabel').value=m.label||'';$('gApi').value=m.apiUrl;$('gKey').value=m.apiKey;$('gModel').value=m.model;$('gTok').value=m.maxTokens;$('gTemp').value=m.temperature}
  else{cfg=loadCfg();$('gLabel').value='';$('gApi').value=cfg.apiUrl;$('gKey').value=cfg.apiKey;$('gModel').value=cfg.model;$('gTok').value=cfg.maxTokens;$('gTemp').value=cfg.temperature}
  $('gPreset').value='';$('testRes').className='api-result';
  const _sel=$('gModelSelect');if(_sel)_sel.style.display='none';
  $('delModelBtn').style.display=activeId?'':'none';
  openModal('globalModal');
}

function applyPreset(val){
  const p=MODEL_PRESETS[val];if(!p)return;
  $('gApi').value=p.apiUrl;$('gKey').value='';$('gModel').value=p.model;$('gTok').value=p.maxTokens;$('gTemp').value=p.temperature;
  if(!$('gLabel').value)$('gLabel').value=PRESET_NAMES[val]||'';
  const _sel=$('gModelSelect');if(_sel)_sel.style.display='none';
}

function saveModel(){
  const label=$('gLabel').value.trim()||$('gModel').value.trim()||'未命名';
  const apiUrl=$('gApi').value.trim();const apiKey=$('gKey').value.trim();
  const model=$('gModel').value.trim();const maxTokens=parseInt($('gTok').value)||2048;
  const temperature=parseFloat($('gTemp').value)||0.7;
  if(!apiUrl){toast('⚠️ 请填写 API 地址');return}
  let models=getModels();let activeId=getActiveModelId();
  if(activeId){
    // Update existing
    const idx=models.findIndex(m=>m.id===activeId);
    if(idx>=0){models[idx]={...models[idx],label,apiUrl,apiKey,model,maxTokens,temperature}}
    else{activeId='';}
  }
  if(!activeId){
    // Create new
    const newModel={id:uuid(),label,apiUrl,apiKey,model,maxTokens,temperature};
    models.push(newModel);setActiveModelId(newModel.id);
  }
  setModels(models);
  cfg={apiUrl,apiKey,model,maxTokens,temperature};
  $('delModelBtn').style.display='';
  renderModelList();toast(`✅ 已保存：${label}`);
}

function saveAsNewModel(){
  const label=$('gLabel').value.trim()||$('gModel').value.trim()||'未命名';
  const apiUrl=$('gApi').value.trim();const apiKey=$('gKey').value.trim();
  const model=$('gModel').value.trim();const maxTokens=parseInt($('gTok').value)||2048;
  const temperature=parseFloat($('gTemp').value)||0.7;
  if(!apiUrl){toast('⚠️ 请填写 API 地址');return}
  const newModel={id:uuid(),label,apiUrl,apiKey,model,maxTokens,temperature};
  const models=[...getModels(),newModel];setModels(models);setActiveModelId(newModel.id);
  cfg={apiUrl,apiKey,model,maxTokens,temperature};
  $('delModelBtn').style.display='';
  renderModelList();toast(`✅ 已保存新配置：${label}`);
}

let _delModelPending=false,_delModelTimer=null;
function deleteModel(){
  const activeId=getActiveModelId();if(!activeId)return;
  if(!_delModelPending){
    _delModelPending=true;toast('⚠️ 再次点击确认删除');
    _delModelTimer=setTimeout(()=>{_delModelPending=false},3000);return;
  }
  clearTimeout(_delModelTimer);_delModelPending=false;
  let models=getModels().filter(m=>m.id!==activeId);setModels(models);
  if(models.length){setActiveModelId(models[0].id);selectModel(models[0].id)}
  else{setActiveModelId('');cfg=loadCfg();$('gLabel').value='';$('gApi').value=cfg.apiUrl;$('gKey').value=cfg.apiKey;$('gModel').value=cfg.model;$('gTok').value=cfg.maxTokens;$('gTemp').value=cfg.temperature;$('delModelBtn').style.display='none'}
  renderModelList();toast('🗑️ 已删除');
}

async function testAPI(){
  const btn=$('testBtn'),res=$('testRes');btn.disabled=true;res.className='api-result wait';res.textContent='⏳ 测试中...';
  const tc={apiUrl:$('gApi').value.trim(),apiKey:$('gKey').value.trim(),model:$('gModel').value.trim()||'deepseek-chat'};
  if(!tc.apiUrl){res.className='api-result err';res.textContent='❌ 请填写 API 地址';btn.disabled=false;return}
  if(!tc.apiKey){res.className='api-result err';res.textContent='❌ 请填写 API Key';btn.disabled=false;return}
  try{const r=await fetch(tc.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${tc.apiKey}`},body:JSON.stringify({model:tc.model,messages:[{role:'user',content:'你好，请回复"测试成功"'}],max_tokens:50})});
    if(!r.ok)throw new Error(`${r.status}`);const d=await r.json();const txt=d.choices?.[0]?.message?.content||'';res.className='api-result ok';res.textContent=`✅ 成功！回复：${txt.slice(0,120)}`}
  catch(e){res.className='api-result err';res.textContent=`❌ 失败：${e.message}`}
  btn.disabled=false;
}

// ═══ Fetch Available Models ═══
async function fetchModels(){
  const btn=$('fetchModelsBtn'),select=$('gModelSelect');
  const apiUrl=$('gApi').value.trim(),apiKey=$('gKey').value.trim();
  if(!apiUrl){toast('⚠️ 请先填写 API 地址');return}
  if(!apiKey){toast('⚠️ 请先填写 API Key');return}
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 检测中...';
  // Derive /models endpoint from /chat/completions URL
  let modelsUrl=apiUrl.replace(/\/chat\/completions\/?$/i,'/models');
  // If URL didn't change (no /chat/completions suffix), try appending /models
  if(modelsUrl===apiUrl){
    modelsUrl=apiUrl.replace(/\/+$/,'')+'/models';
  }
  try{
    const r=await fetch(modelsUrl,{method:'GET',headers:{'Authorization':`Bearer ${apiKey}`}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    let models=[];
    if(Array.isArray(d.data)){models=d.data.map(m=>m.id).filter(Boolean)}
    else if(Array.isArray(d.models)){models=d.models.map(m=>typeof m==='string'?m:m.id).filter(Boolean)}
    if(!models.length)throw new Error('未找到可用模型');
    models.sort((a,b)=>a.localeCompare(b));
    select.innerHTML='<option value="">-- 选择可用模型 --</option>';
    models.forEach(id=>{
      const opt=document.createElement('option');opt.value=id;opt.textContent=id;
      select.appendChild(opt);
    });
    select.style.display='';
    toast(`✅ 检测到 ${models.length} 个可用模型`);
  }catch(e){
    select.style.display='none';
    toast(`❌ 检测失败：${e.message}（可手动输入模型名）`);
  }
  btn.disabled=false;btn.innerHTML='<i class="fas fa-search"></i> 检测模型';
}

// ═══ Global Rules ═══
function openGlobalRules(){$('gRules').value=loadGlobalRules();openModal('globalRulesModal')}
function saveGlobalRulesModal(){saveGlobalRules($('gRules').value);closeModal('globalRulesModal');toast('✅ 底层规则已保存')}
function resetGlobalRules(){if(confirm('确定恢复默认规则？当前修改将丢失。')){$('gRules').value=DEFAULT_GLOBAL_RULES}}

// ═══ Save Settings ═══
let editTags=[];
function openSaveSettings(){
  const s=curSave();if(!s)return;const p=s.persona;
  $('pName').value=p.name||'';$('pDesc').value=p.description||'';$('pPers').value=p.personality||'';
  $('pScen').value=p.scenario||'';$('pNotes').value=p.creator_notes||'';
  $('pMem').value=p.baseMemory||'';$('pScene').value=p.initialScene||'';
  $('pSpeechStyle').value=p.speechStyle||'';
  $('pUserGender').value=p.userGender||'';
  $('pMoodEmoji').checked=p.showMoodEmoji!==false;
  editTags=[...(p.tags||[])];renderTags();
  renderBehaviorTypeSelector(p.behaviorTypes||['gentle']);
  openModal('saveModal');
  $('pAiPrompt').value='';$('genRes').className='api-result';
  updateAvatarPreview();
}

function renderBehaviorTypeSelector(selected){
  const box=$('behaviorTypesBox');if(!box)return;box.innerHTML='';
  Object.entries(PERSONA_BEHAVIORS).forEach(([key,val])=>{
    const btn=document.createElement('button');
    btn.className='btn btn-sm '+(selected.includes(key)?'btn-primary':'btn-ghost');
    btn.textContent=val.label;
    btn.style.cssText='font-size:11px;padding:4px 10px';
    btn.onclick=()=>{
      btn.classList.toggle('btn-primary');btn.classList.toggle('btn-ghost');
    };
    btn.setAttribute('data-behavior-key',key);
    box.appendChild(btn);
  });
}

function getSelectedBehaviorTypes(){
  const box=$('behaviorTypesBox');if(!box)return['gentle'];
  const selected=[];
  box.querySelectorAll('button').forEach(btn=>{
    if(btn.classList.contains('btn-primary'))selected.push(btn.getAttribute('data-behavior-key'));
  });
  return selected.length?selected:['gentle'];
}

async function generatePersona(){
  const prompt=$('pAiPrompt').value.trim();
  if(!prompt){toast('⚠️ 请输入角色描述');return}
  if(!cfg.apiKey||!cfg.apiUrl){toast('⚠️ 请先配置 API');return}
  const btn=$('genBtn'),res=$('genRes');
  btn.disabled=true;res.className='api-result wait';res.textContent='⏳ AI 正在生成人设...';
  const s=curSave();const statDefs=s?getStatDefs(s):DEFAULT_STAT_DEFS;
  // 随机元素确保每次生成不同
  const nameStyles=['中文名','日式名','英文名+中文昵称','古风名','可爱的昵称/外号','两个字的简洁名','三个字的文艺名'];
  const personalityTraits=['表面高冷内心柔软','话少但行动派','毒舌但关心人','天然呆但关键时刻可靠','傲娇嘴硬','温柔但有小脾气','活泼话痨','安静内向但很细腻','中二但可爱','慵懒随性','认真较劲','腹黑爱捉弄人'];
  const backgrounds=['学生','上班族','自由职业','艺术家','程序员','医生','咖啡店员','图书管理员','主播','留学生','旅行者','退役偶像'];
  const quirks=['有口头禅','方向感极差','厨艺很好或很差','对某件事有执念','容易害羞但装作不在意','收集癖','熬夜达人','运动白痴或运动天才','有独特的笑法','总是迟到','某方面天才其他方面笨蛋'];
  const namePrefixes=['苏','林','叶','沈','顾','白','陆','江','楚','温','萧','凌','唐','慕','韩','秦','谢','宋','柳','沐','夏','秋','冬','云','月','星','霜','雪','晴','雨','风','落','初','若','安','浅','墨','千','洛','言','锦','清','素','紫','蓝','青','绯','夜','晓','梦'];
  const nameSuffixes=['瑶','涵','萱','琪','妍','琳','雨','雪','月','星','晴','薇','梦','灵','婉','柔','雅','悦','诗','韵','然','清','安','宁','默','羽','墨','尘','歌','辞','舟','鸢','笙','澜','音','烟','落','棠','芷','茉','樱','柠','澜','汐','璃','柒','染','念','栖','听'];
  const jpNames=['樱子','小雪','美月','遥','澪','葵','椿','茜','凛','䌷','䌷希','结衣','花音','真白','初春','千夜','星罗','诗织','由纪','桃子'];
  const enNames=['Luna','Mia','Aria','Ivy','Zoe','Nova','Iris','Eve','Rose','Lily','Cleo','Thea','Wren','Sage','Fern','Rue','Nell','Faye','Blythe','Maeve'];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const randNameStyle=nameStyles[Math.floor(Math.random()*nameStyles.length)];
  const randPersonality=personalityTraits[Math.floor(Math.random()*personalityTraits.length)];
  const randBg=backgrounds[Math.floor(Math.random()*backgrounds.length)];
  const randQuirk=quirks[Math.floor(Math.random()*quirks.length)];
  // 拼一个具体的名字示例来引导模型
  const nameHintMap={'中文名':`${pick(namePrefixes)}${pick(nameSuffixes)}`,'日式名':pick(jpNames),'英文名+中文昵称':pick(enNames),'古风名':`${pick(namePrefixes)}${pick(nameSuffixes)}`,'可爱的昵称/外号':`${pick(['小','阿','团','糖','豆','软','奶','蜜'])}${pick(nameSuffixes)}`,'两个字的简洁名':`${pick(namePrefixes)}${pick(nameSuffixes)}`,'三个字的文艺名':`${pick(namePrefixes)}${pick(nameSuffixes)}${pick(nameSuffixes)}`};
  const nameHint=nameHintMap[randNameStyle]||`${pick(namePrefixes)}${pick(nameSuffixes)}`;
  const randSeed=Date.now()%100000+Math.floor(Math.random()*90000);
  const existingNames=(getSaves()||[]).map(s=>s.persona?.name).filter(Boolean);

  const sysPrompt=`你是一个创意角色设计师，擅长设计独特有魅力的AI陪伴角色。每次必须创造完全不同的角色。

【严格要求】
- 名字风格倾向：${randNameStyle}（参考示例：${nameHint}，但你必须创造全新名字，禁止使用示例中的名字）
- 性格倾向：${randPersonality}
- 背景职业倾向：${randBg}
- 独特小特点：${randQuirk}
- 随机种子：${randSeed}（必须用这个数字衍生出独特的名字元素，比如取其中几位作为名字灵感来源）
- 已有角色名（绝对不能重复，连谐音、相似都不行）：${existingNames.join('、') || '无'}
⚠️ 名字必须完全原创！即使人设相似，名字也必须不同！用随机种子的数字来构思名字的音节组合。
- 每个字段都要有丰富细节，不要泛泛而谈
- 角色必须有矛盾点和层次感（比如表面怎样实际怎样）
- 初始状态数值要和角色设定匹配（内向的角色信任初始低，热情的角色好感初始高）

返回纯JSON（不要markdown代码块，不要多余文字）：
{"name":"角色名","description":"外貌特征、穿着风格、喜好厌恶、说话习惯、特殊技能等详细描述（100字以上）","personality":"性格特质，包含表面性格和真实性格（50字以上）","scenario":"日常行为模式和语言风格要求","creator_notes":"补充说明和有趣的小细节","base_memory":"底层身份认知和背景故事","initial_scene":"第一次见面的场景描述（50字以上，要有画面感）","tags":["标签1","标签2","标签3"],"initial_stats":{"stat_key":数值}}`;

  try{
    const txt=await callAPI(sysPrompt,`我想创建的角色类型：${prompt}\n\n请发挥创意，创造一个独特、有层次感、让人印象深刻的角色。不要用套路化的设定。`,undefined,'ai_system');
    let jsonStr=txt.trim();const cb=jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);if(cb)jsonStr=cb[1].trim();
    const data=JSON.parse(jsonStr);
    $('pName').value=data.name||'';$('pDesc').value=data.description||'';$('pPers').value=data.personality||'';
    $('pScen').value=data.scenario||'';$('pNotes').value=data.creator_notes||'';$('pMem').value=data.base_memory||'';
    $('pScene').value=data.initial_scene||'';editTags=data.tags||[];renderTags();
    if(data.initial_stats&&s){const updates={};const defs=getStatDefs(s);Object.entries(data.initial_stats).forEach(([key,val])=>{const def=defs.find(d=>d.key===key);if(def)updates[key]=Math.max(def.min,Math.min(def.max,safeInt(val,def.defaultValue)))});
      if(Object.keys(updates).length){updateCur(updates);refreshStatsDisplay()}}
    res.className='api-result ok';res.textContent=`✅ 人设已生成：${data.name}`;toast(`✨ ${data.name} 人设已填入`);
  }catch(e){res.className='api-result err';res.textContent=`❌ 生成失败：${e.message}`}
  btn.disabled=false;
}

function renderTags(){const c=$('tagsBox');const inp=$('tagIn');c.innerHTML='';editTags.forEach((t,i)=>{const s=document.createElement('span');s.className='tag';s.innerHTML=`${t} <span class="rm" onclick="rmTag(${i})">×</span>`;c.appendChild(s)});c.appendChild(inp)}
function addTag(){const inp=$('tagIn');const v=inp.value.trim();if(v&&!editTags.includes(v)){editTags.push(v);renderTags()}inp.value=''}
function rmTag(i){editTags.splice(i,1);renderTags()}

function saveSaveSettings(){
  const s=curSave();if(!s)return;
  const oldP=s.persona||{};
  const newP={...oldP,
    name:$('pName').value||oldP.name,
    description:$('pDesc').value||oldP.description,
    personality:$('pPers').value||oldP.personality,
    scenario:$('pScen').value||oldP.scenario,
    creator_notes:$('pNotes').value||oldP.creator_notes,
    baseMemory:$('pMem').value||oldP.baseMemory,
    initialScene:$('pScene').value||oldP.initialScene||'',
    tags:[...editTags],
    speechStyle:$('pSpeechStyle').value||'',
    userGender:$('pUserGender').value||'',
    behaviorTypes:getSelectedBehaviorTypes(),
    showMoodEmoji:$('pMoodEmoji').checked
  };
  updateCur({roleName:newP.name,persona:newP,lastActiveTime:nowFull()});
  renderSaves();closeModal('saveModal');toast('✅ 人设已保存');
}

// ═══ Stat Management ═══
function openStatsModal(){
  const s=curSave();if(!s)return;
  const defs=getStatDefs(s);const area=$('statsListArea');area.innerHTML='';
  defs.forEach(d=>{
    const v=getStatVal(s,d.key);const isDefault=d.key==='affection'||d.key==='trust';
    const cMin=d.changeMin!=null?d.changeMin:-5;
    const cMax=d.changeMax!=null?d.changeMax:5;
    const div=document.createElement('div');
    div.style.cssText='border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px;margin-bottom:10px;background:#fafafa;';
    div.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:15px;font-weight:700">${d.emoji} ${d.label} <span style="color:var(--text3);font-size:11px;font-weight:400">(${d.key})${isDefault?' · 默认':''}</span></span>
      ${isDefault?'':`<button class="btn btn-danger btn-sm" onclick="removeStat('${d.key}');openStatsModal()" style="padding:3px 8px;font-size:10px">删除</button>`}</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="flex:1"><label style="font-size:11px;font-weight:600;color:var(--text2)">当前值</label><input id="statv_${d.key}" type="number" min="${d.min}" max="${d.max}" value="${v}" style="width:100%;padding:6px 10px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.08);font-size:14px;font-family:inherit"></div>
        <div style="flex:0.7"><label style="font-size:11px;font-weight:600;color:var(--text2)">最小</label><input id="statmin_${d.key}" type="number" value="${d.min}" style="width:100%;padding:6px 10px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.08);font-size:13px;font-family:inherit"></div>
        <div style="flex:0.7"><label style="font-size:11px;font-weight:600;color:var(--text2)">最大</label><input id="statmax_${d.key}" type="number" value="${d.max}" style="width:100%;padding:6px 10px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.08);font-size:13px;font-family:inherit"></div></div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="flex:1"><label style="font-size:11px;font-weight:600;color:var(--text2)">📊 每次变化幅度</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="statcmin_${d.key}" type="number" max="0" value="${cMin}" style="width:60px;padding:6px 8px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.08);font-size:14px;text-align:center;font-family:inherit">
            <span style="font-size:12px;color:var(--text3)">到</span>
            <input id="statcmax_${d.key}" type="number" min="0" value="${cMax}" style="width:60px;padding:6px 8px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.08);font-size:14px;text-align:center;font-family:inherit">
          </div>
        </div>
      </div>
      ${!isDefault?`<div class="fg" style="margin-top:6px"><label style="font-size:11px;font-weight:600;color:var(--text2)">区间行为描述</label><input id="statthresh_${d.key}" value="${escapeHtml(d.thresholdDesc||'')}" placeholder="例如：高(80-100)冷静 | 中(40-80)正常 | 低(0-40)焦虑" style="width:100%;padding:6px 10px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.08);font-size:12px;font-family:inherit"></div>`:''}
      <div style="font-size:11px;color:var(--text3);margin-top:4px">💡 ${isDefault?`AI 每次变化在 ${cMin} 到 +${cMax} 之间，如：好感下降快(-5)上升慢(+2)`:'填写区间行为描述让 AI 知道不同数值该怎么表现'}</div>`;
    area.appendChild(div);
  });
  openModal('statsModal');
}

function saveStatsModal(){
  const s=curSave();if(!s)return;const defs=getStatDefs(s);const updates={};
  const updatedDefs=defs.map(d=>{
    const valEl=$('statv_'+d.key);const minEl=$('statmin_'+d.key);const maxEl=$('statmax_'+d.key);
    const threshEl=$('statthresh_'+d.key);const cMinEl=$('statcmin_'+d.key);const cMaxEl=$('statcmax_'+d.key);
    if(valEl){
      const newVal=safeInt(valEl.value,d.defaultValue);
      updates[d.key]=newVal;
      // 同步更新基准值，防止衰减把用户手动设的值拉回初始值
      const baseKey='base_'+d.key;
      if(newVal<(s[baseKey]||d.defaultValue)){updates[baseKey]=newVal}
    }
    const cMin=cMinEl?Math.max(-20,Math.min(0,safeInt(cMinEl.value,-5))):(d.changeMin||-5);
    const cMax=cMaxEl?Math.max(0,Math.min(20,safeInt(cMaxEl.value,5))):(d.changeMax||5);
    return{key:d.key,label:d.label,emoji:d.emoji,defaultValue:d.defaultValue,min:minEl?safeInt(minEl.value,0):d.min,max:maxEl?safeInt(maxEl.value,100):d.max,thresholdDesc:threshEl?threshEl.value:(d.thresholdDesc||''),changeMin:cMin,changeMax:cMax};
  });
  updateCur({...updates,statDefs:updatedDefs});
  renderSaves();renderChar();renderWcList();refreshStatsDisplay();closeModal('statsModal');openSaveSettings();toast('✅ 状态已保存');
}


function openAddStatModal(){$('asKey').value='';$('asLabel').value='';$('asEmoji').value='';$('asMin').value='0';$('asMax').value='100';$('asDefault').value='50';$('asChangeMin').value='-5';$('asChangeMax').value='5';$('asThresholds').value='';openModal('addStatModal')}

function addNewStat(){
  const key=$('asKey').value.trim().replace(/[^a-zA-Z0-9_]/g,'');const label=$('asLabel').value.trim();
  const emoji=$('asEmoji').value.trim()||'📊';const min=parseInt($('asMin').value)||0;const max=parseInt($('asMax').value)||100;
  const defaultValue=safeInt($('asDefault').value,50);
  const thresholdDesc=($('asThresholds').value||'').trim();
  const changeMin=Math.max(-20,Math.min(0,safeInt($('asChangeMin').value,-5)));
  const changeMax=Math.max(0,Math.min(20,safeInt($('asChangeMax').value,5)));
  if(!key){toast('⚠️ 请输入状态标识');return}if(!label){toast('⚠️ 请输入显示名称');return}
  const s=curSave();if(!s)return;const defs=getStatDefs(s);
  if(defs.find(d=>d.key===key)){toast('⚠️ 该状态已存在');return}
  defs.push({key,label,emoji,min,max,defaultValue,thresholdDesc,changeMin,changeMax});
  updateCur({statDefs:defs,[key]:defaultValue});renderChar();renderWcList();closeModal('addStatModal');openStatsModal();toast(`✅ 已添加状态「${label}」`);
}

let _rmStatPending=false,_rmStatKey='',_rmStatTimer=null;
function removeStat(key){
  const s=curSave();if(!s)return;const defs=getStatDefs(s);const idx=defs.findIndex(d=>d.key===key);if(idx<0)return;
  if(!_rmStatPending||_rmStatKey!==key){_rmStatPending=true;_rmStatKey=key;toast(`⚠️ 再次点击确认删除「${defs[idx].label}」`);_rmStatTimer=setTimeout(()=>{_rmStatPending=false;_rmStatKey=''},3000);return}
  clearTimeout(_rmStatTimer);_rmStatPending=false;_rmStatKey='';defs.splice(idx,1);updateCur({statDefs:defs});renderChar();renderWcList();openSaveSettings();toast('🗑️ 已删除');
}

let _delPending=false,_delTimer=null;
function deleteSave(){
  const saves=getSaves();if(!saves.length)return;
  const s=curSave();if(!s)return;
  if(!_delPending){_delPending=true;const btn=document.querySelector('[onclick="deleteSave()"]');
    if(btn){btn.textContent='⚠️ 点击确认删除';btn.style.background='#e17055'}
    _delTimer=setTimeout(()=>{_delPending=false;if(btn){btn.innerHTML='<i class="fas fa-trash"></i> 删除';btn.style.background=''}},3000);return}
  clearTimeout(_delTimer);_delPending=false;const cid=curId();const ns=saves.filter(x=>x.saveId!==cid);setSaves(ns);setCurId(ns.length?ns[0].saveId:'');session=[];clearCompTimer(cid);renderSaves();closeModal('saveModal');toast('🗑️ 存档已删除');
}

// ═══ Diary Modal ═══
let editingDiaryIdx=-1;
let diaryPage=0;
const DIARY_PER_PAGE=5;
function openDiaryModal(){
  editingDiaryIdx=-1;diaryPage=0;
  openModal('diaryModal');
  // 渲染日记
  try{renderDiary()}catch(e){console.error('[renderDiary]',e)}
  // 渲染长期记忆
  try{renderLtmTo('ltmContent',false)}catch(e){console.error('[renderLTM]',e)}
  // 默认显示日记tab
  try{
    const b1=$('diaryTabBtn'),b2=$('ltmTabBtn'),c1=$('diaryContent'),c2=$('ltmContent');
    if(b1&&b2&&c1&&c2){b1.classList.add('on');b2.classList.remove('on');c1.style.display='';c2.style.display='none'}
  }catch(e){console.error('[switchTab]',e)}
}
function renderDiary(){
  const s=curSave();const c=$('diaryContent');
  if(!c)return;
  if(!s){c.innerHTML='<div class="empty-state"><i class="fas fa-book-open"></i><p>请先创建或选择一个角色</p></div>';return}
  const ds=(s.diary||[]).slice().reverse();
  if(!ds.length){c.innerHTML='<div class="empty-state"><i class="fas fa-book-open"></i><p>还没有日记哦～</p></div>';return}
  const totalPages=Math.ceil(ds.length/DIARY_PER_PAGE);
  if(diaryPage>=totalPages)diaryPage=totalPages-1;
  if(diaryPage<0)diaryPage=0;
  const start=diaryPage*DIARY_PER_PAGE;
  const pageItems=ds.slice(start,start+DIARY_PER_PAGE);
  let html='<div class="diary-list">';
  pageItems.forEach((d,i)=>{
    const realIdx=ds.length-1-(start+i);
    const timeStr=d.time?`${d.date||''} ${d.time}`:(d.date||'');
    html+=`<div class="diary-card" onclick="showDiary(${realIdx})"><div class="dt">${d.title||'无标题'}</div><div class="dm"><span>${timeStr}</span><span class="mood-tag">${d.mood||'普通'}</span>${d.affection!=null?`<span style="color:${d.affection>=0?'var(--pink-deep)':'#ff7675'}">💕${d.affection>=0?'+':''}${d.affection}</span>`:''}</div></div>`;
  });
  html+='</div>';
  // 翻页控件
  if(totalPages>1){
    html+=`<div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:14px;padding:8px 0">
      <button class="btn btn-ghost btn-sm" onclick="diaryGoPage(-1)" ${diaryPage<=0?'disabled':''} style="min-width:60px">‹ 上一页</button>
      <span style="font-size:12px;color:var(--text2)">${diaryPage+1} / ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" onclick="diaryGoPage(1)" ${diaryPage>=totalPages-1?'disabled':''} style="min-width:60px">下一页 ›</button>
    </div>`;
  }
  c.innerHTML=html;
}
function diaryGoPage(dir){
  diaryPage+=dir;
  if(diaryPage<0)diaryPage=0;
  renderDiary();
}

// ═══ 日记统计 ═══
let dsViewSaveId=null;  // 当前查看的角色 saveId（null=角色列表，非null=日记列表）
let dsDiaryPage=0;

function openDiaryStats(){
  dsViewSaveId=null;dsDiaryPage=0;
  openModal('diaryStatsModal');
  renderDiaryStatsList();
}

function renderDiaryStatsList(){
  const title=$('diaryStatsTitle');if(title)title.textContent='📔 日记统计';
  const ft=$('diaryStatsFt');
  if(ft)ft.innerHTML='<button class="btn btn-ghost" onclick="closeModal(\'diaryStatsModal\')">关闭</button>';
  const saves=getSaves();const c=$('diaryStatsContent');if(!c)return;
  if(!saves.length){c.innerHTML='<div class="empty-state"><i class="fas fa-book-open"></i><p>还没有角色</p></div>';return}
  // 按日记数量排序
  const ranked=saves.map(s=>({
    saveId:s.saveId,
    name:s.persona?.name||'未命名',
    avatar:s.persona?.avatar||'',
    count:(s.diary||[]).length,
    latest:(s.diary||[]).slice(-1)[0]
  })).sort((a,b)=>b.count-a.count);
  const maxCount=Math.max(1,...ranked.map(r=>r.count));
  let html='';
  ranked.forEach((r,i)=>{
    const pct=Math.min(85,Math.round(r.count/maxCount*85));
    const latestStr=r.latest?`${r.latest.date||''} ${r.latest.time||''}`.trim():'';
    const color=i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#cd7f32':'#a0aec0';
    const bg=i<3?'#fff':'#fafafa';
    const borderLeft=i<3?`3px solid ${color}`:'3px solid transparent';
    html+=`<div onclick="openSaveDiaryStats('${r.saveId}')" style="display:flex;align-items:center;gap:10px;padding:12px 12px;margin-bottom:8px;background:${bg};border-radius:12px;border-left:${borderLeft};cursor:pointer;transition:background 0.15s" onmouseenter="this.style.background='#f5f5f5'" onmouseleave="this.style.background='${bg}'">
      <div style="width:40px;height:40px;border-radius:50%;background:#f0eeeb;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;overflow:hidden">
        ${r.avatar?`<img src="${r.avatar}" style="width:100%;height:100%;object-fit:cover">`:escapeHtml(r.name[0]||'?')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px;font-weight:600">${escapeHtml(r.name)}</span>
          <span style="font-size:13px;font-weight:700;color:${color}">${r.count} 篇</span>
        </div>
        <div style="height:4px;background:rgba(0,0,0,0.04);border-radius:2px;overflow:hidden;margin-top:6px">
          <div style="height:100%;width:${pct}%;border-radius:2px;background:${color};opacity:0.5;transition:width 0.5s"></div>
        </div>
        ${latestStr?`<div style="font-size:10px;color:var(--text3);margin-top:3px">最新：${escapeHtml(latestStr)}</div>`:''}
      </div>
      <i class="fas fa-chevron-right" style="font-size:11px;color:var(--text3)"></i>
    </div>`;
  });
  // 总计
  const totalDiaries=ranked.reduce((s,r)=>s+r.count,0);
  html+=`<div style="text-align:center;padding:12px 0 4px;font-size:11px;color:var(--text3)">共 ${ranked.length} 个角色，${totalDiaries} 篇日记</div>`;
  c.innerHTML=html;
}

function openSaveDiaryStats(saveId){
  dsViewSaveId=saveId;dsDiaryPage=0;
  renderSaveDiaryPage();
}

function renderSaveDiaryPage(){
  const saves=getSaves();const s=saves.find(x=>x.saveId===dsViewSaveId);
  if(!s){renderDiaryStatsList();return}
  const name=s.persona?.name||'未命名';
  const title=$('diaryStatsTitle');if(title)title.textContent=`📔 ${name} 的日记`;
  const ft=$('diaryStatsFt');
  if(ft)ft.innerHTML=`<button class="btn btn-ghost" onclick="dsViewSaveId=null;dsDiaryPage=0;renderDiaryStatsList()"><i class="fas fa-arrow-left"></i> 返回</button><button class="btn btn-ghost" onclick="closeModal('diaryStatsModal')">关闭</button>`;
  const c=$('diaryStatsContent');if(!c)return;
  const ds=(s.diary||[]).slice().reverse();
  if(!ds.length){c.innerHTML='<div class="empty-state"><i class="fas fa-book-open"></i><p>这个角色还没有日记</p></div>';return}
  const totalPages=Math.ceil(ds.length/DIARY_PER_PAGE);
  if(dsDiaryPage>=totalPages)dsDiaryPage=totalPages-1;
  if(dsDiaryPage<0)dsDiaryPage=0;
  const start=dsDiaryPage*DIARY_PER_PAGE;
  const pageItems=ds.slice(start,start+DIARY_PER_PAGE);
  let html='<div class="diary-list">';
  pageItems.forEach((d,i)=>{
    const realIdx=ds.length-1-(start+i);
    const timeStr=d.time?`${d.date||''} ${d.time}`:(d.date||'');
    html+=`<div class="diary-card" onclick="dsShowDiaryDetail(${realIdx})"><div class="dt">${escapeHtml(d.title||'无标题')}</div><div class="dm"><span>${escapeHtml(timeStr)}</span><span class="mood-tag">${escapeHtml(d.mood||'普通')}</span>${d.affection!=null?`<span style="color:${d.affection>=0?'var(--pink-deep)':'#ff7675'}">💕${d.affection>=0?'+':''}${d.affection}</span>`:''}</div></div>`;
  });
  html+='</div>';
  if(totalPages>1){
    html+=`<div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:14px;padding:8px 0">
      <button class="btn btn-ghost btn-sm" onclick="dsDiaryGoPage(-1)" ${dsDiaryPage<=0?'disabled':''} style="min-width:60px">‹ 上一页</button>
      <span style="font-size:12px;color:var(--text2)">${dsDiaryPage+1} / ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" onclick="dsDiaryGoPage(1)" ${dsDiaryPage>=totalPages-1?'disabled':''} style="min-width:60px">下一页 ›</button>
    </div>`;
  }
  c.innerHTML=html;
}

function dsDiaryGoPage(dir){
  dsDiaryPage+=dir;
  if(dsDiaryPage<0)dsDiaryPage=0;
  renderSaveDiaryPage();
}

function dsShowDiaryDetail(realIdx){
  const saves=getSaves();const s=saves.find(x=>x.saveId===dsViewSaveId);
  if(!s||!s.diary[realIdx])return;
  const d=s.diary[realIdx];const c=$('diaryStatsContent');if(!c)return;
  const timeStr=d.time?`${d.date||''} ${d.time}`:(d.date||'');
  c.innerHTML=`<div class="diary-detail">
    <button class="back" onclick="renderSaveDiaryPage()"><i class="fas fa-arrow-left"></i> 返回列表</button>
    <h3 style="color:var(--pink-deep);margin-bottom:6px">${escapeHtml(d.title||'')}</h3>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">${escapeHtml(timeStr)} · <span class="mood-tag">${escapeHtml(d.mood||'普通')}</span>${d.affection!=null?` · 💕 好感${d.affection>=0?'+':''}${d.affection}`:''}</div>
    <div class="diary-body">${escapeHtml(d.content||'')}</div>
  </div>`;
}
function showDiary(i){
  const s=curSave();if(!s||!s.diary[i])return;const d=s.diary[i];const c=$('diaryContent');
  const timeStr=d.time?`${d.date||''} ${d.time}`:(d.date||'');
  c.innerHTML=`<div class="diary-detail">
    <button class="back" onclick="renderDiary()"><i class="fas fa-arrow-left"></i> 返回</button>
    <h3 style="color:var(--pink-deep);margin-bottom:6px">${escapeHtml(d.title||'')}</h3>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">${timeStr} · <span class="mood-tag">${d.mood||'普通'}</span>${d.affection!=null?` · 💕 好感${d.affection>=0?'+':''}${d.affection}`:''}</div>
    <div class="diary-body">${escapeHtml(d.content||'')}</div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="editDiary(${i})"><i class="fas fa-edit"></i> 编辑</button>
      <button class="btn btn-danger btn-sm" onclick="deleteDiary(${i})"><i class="fas fa-trash"></i> 删除</button>
    </div>
  </div>`;
}

let _delDiaryPending=false,_delDiaryIdx=-1,_delDiaryTimer=null;
function deleteDiary(i){
  if(!_delDiaryPending||_delDiaryIdx!==i){
    _delDiaryPending=true;_delDiaryIdx=i;
    toast('⚠️ 再次点击确认删除');
    _delDiaryTimer=setTimeout(()=>{_delDiaryPending=false;_delDiaryIdx=-1},3000);return;
  }
  clearTimeout(_delDiaryTimer);_delDiaryPending=false;_delDiaryIdx=-1;
  const s=curSave();if(!s)return;
  s.diary.splice(i,1);updateCur({diary:s.diary});
  renderDiary();toast('🗑️ 日记已删除');
}

function editDiary(i){
  const s=curSave();if(!s||!s.diary[i])return;
  editingDiaryIdx=i;const d=s.diary[i];const c=$('diaryContent');
  c.innerHTML=`<div class="diary-detail">
    <button class="back" onclick="showDiary(${i})"><i class="fas fa-arrow-left"></i> 取消编辑</button>
    <div class="fg"><label>标题</label><input id="editDiaryTitle" value="${escapeHtml(d.title||'')}"></div>
    <div class="fg"><label>心情</label><input id="editDiaryMood" value="${escapeHtml(d.mood||'普通')}"></div>
    <div class="fg"><label>内容</label><textarea id="editDiaryContent" rows="10" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.06);font-size:14px;font-family:inherit;resize:vertical;line-height:1.8">${escapeHtml(d.content||'')}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btn-ghost" onclick="showDiary(${i})">取消</button>
      <button class="btn btn-primary" onclick="saveDiaryEdit(${i})"><i class="fas fa-save"></i> 保存</button>
    </div>
  </div>`;
}

function saveDiaryEdit(i){
  const s=curSave();if(!s||!s.diary[i])return;
  s.diary[i].title=$('editDiaryTitle').value||s.diary[i].title;
  s.diary[i].mood=$('editDiaryMood').value||s.diary[i].mood;
  s.diary[i].content=$('editDiaryContent').value||s.diary[i].content;
  updateCur({diary:s.diary});
  showDiary(i);toast('✅ 日记已保存');
}

// ═══ Long Term Memory ═══
function getLtmHtml(editing){
  const s=curSave();
  if(!s)return '<div class="empty-state"><i class="fas fa-brain"></i><p>请先创建或选择一个角色</p></div>';
  let ltm=String(s.longTermMemory||'');
  if(!ltm){ltm=DEF_LTM;updateCur({longTermMemory:DEF_LTM})}
  return {ltm,editing};
}
function renderLtmTo(container,editing){
  const el=$(container);if(!el)return;
  const s=curSave();
  if(!s){el.innerHTML='<div class="empty-state"><i class="fas fa-brain"></i><p>请先创建或选择一个角色</p></div>';return}
  let ltm=String(s.longTermMemory||'');
  if(!ltm){ltm=DEF_LTM;updateCur({longTermMemory:DEF_LTM})}
  el.innerHTML=''; // 清空，用 DOM 操作构建

  // 一键检索区域
  const retrieveWrap=document.createElement('div');
  retrieveWrap.style.cssText='margin-bottom:14px;padding:12px 14px;background:linear-gradient(135deg,rgba(0,0,0,0.03),rgba(0,0,0,0.03));border-radius:12px';
  retrieveWrap.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">🔍 一键检索长期记忆</div>`;
  const retrieveRow=document.createElement('div');
  retrieveRow.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';

  const scopeSel=document.createElement('select');
  scopeSel.id='ltmRetrieveScope';
  scopeSel.style.cssText='padding:7px 12px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.08);font-size:12px;font-family:inherit;background:#fff;outline:none;cursor:pointer';
  [['current','当次对话'],['all','全部对话记录'],['diary','从日记选择']].forEach(([v,t])=>{
    const opt=document.createElement('option');opt.value=v;opt.textContent=t;scopeSel.appendChild(opt);
  });
  retrieveRow.appendChild(scopeSel);

  const retrieveBtn=document.createElement('button');
  retrieveBtn.className='btn btn-primary btn-sm';
  retrieveBtn.id='ltmRetrieveBtn';
  retrieveBtn.innerHTML='<i class="fas fa-search"></i> 开始检索';
  retrieveBtn.addEventListener('click',()=>ltmRetrieve());
  retrieveRow.appendChild(retrieveBtn);
  retrieveWrap.appendChild(retrieveRow);

  // 日记选择区域（默认隐藏）
  const diaryPickWrap=document.createElement('div');
  diaryPickWrap.id='ltmDiaryPickArea';
  diaryPickWrap.style.cssText='display:none;margin-top:10px;max-height:200px;overflow-y:auto;border:1px solid rgba(0,0,0,0.06);border-radius:10px;padding:8px';
  retrieveWrap.appendChild(diaryPickWrap);

  const retrieveRes=document.createElement('div');
  retrieveRes.className='api-result';retrieveRes.id='ltmRetrieveRes';
  retrieveWrap.appendChild(retrieveRes);
  el.appendChild(retrieveWrap);

  // scope 切换时显示/隐藏日记选择
  scopeSel.addEventListener('change',()=>{
    diaryPickWrap.style.display=scopeSel.value==='diary'?'block':'none';
    if(scopeSel.value==='diary')renderDiaryPicker();
  });

  // 描述文字
  const descDiv=document.createElement('div');
  descDiv.style.cssText='font-size:12px;color:var(--text3);margin-bottom:8px;line-height:1.6';
  descDiv.textContent='🧠 AI 会在对话中自动记录重要信息到此处。你也可以手动编辑。';
  el.appendChild(descDiv);

  // 内容区域（就地切换，不重建）
  const contentDiv=document.createElement('div');
  contentDiv.id='ltmContentDisplay';
  el.appendChild(contentDiv);

  // 按钮区域（固定，不重建）
  const btnRow=document.createElement('div');
  btnRow.id='ltmBtnRow';
  btnRow.style.cssText='display:flex;gap:8px;margin-top:10px;justify-content:flex-end';
  el.appendChild(btnRow);

  // 渲染当前模式
  _renderLtmContent(editing,ltm);
}

function _renderLtmContent(editing,ltm){
  const contentDiv=$('ltmContentDisplay');const btnRow=$('ltmBtnRow');
  if(!contentDiv||!btnRow)return;
  contentDiv.innerHTML='';btnRow.innerHTML='';

  if(editing){
    const ta=document.createElement('textarea');
    ta.id='ltmEditArea';ta.value=ltm;
    ta.rows=16;
    ta.style.cssText='width:100%;padding:14px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.06);font-size:13px;font-family:Noto Sans SC,monospace;resize:vertical;line-height:1.8;background:#fff;box-sizing:border-box';
    contentDiv.appendChild(ta);
    setTimeout(()=>ta.focus(),100);

    btnRow.innerHTML='<button class="btn btn-ghost btn-sm" onclick="ltmCancelEdit()"><i class="fas fa-times"></i> 取消</button><button class="btn btn-primary btn-sm" onclick="ltmSaveEdit()"><i class="fas fa-save"></i> 保存</button>';
  }else{
    const displayDiv=document.createElement('div');
    displayDiv.id='ltmDisplayText';
    displayDiv.style.cssText='padding:14px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.06);font-size:13px;font-family:Noto Sans SC,monospace;line-height:1.8;background:#fafafa;white-space:pre-wrap;word-break:break-word;min-height:100px';
    displayDiv.textContent=ltm;
    contentDiv.appendChild(displayDiv);

    btnRow.innerHTML='<button class="btn btn-ghost btn-sm" id="ltmResetBtn" onclick="ltmDoReset()"><i class="fas fa-undo"></i> 重置模板</button><button class="btn btn-primary btn-sm" onclick="ltmDoEdit()"><i class="fas fa-pen"></i> 编辑</button>';
  }
}

// 全局函数：供 inline onclick 调用
function ltmCancelEdit(){
  const s=curSave();if(!s)return;
  _renderLtmContent(false,String(s.longTermMemory||DEF_LTM));
}
function ltmSaveEdit(){
  const ta=$('ltmEditArea');if(!ta)return;
  updateCur({longTermMemory:ta.value});
  _renderLtmContent(false,ta.value);
  toast('✅ 长期记忆已保存');
}
let _ltmResetPending=false;let _ltmResetTimer=null;
function ltmDoReset(){
  const btn=$('ltmResetBtn');if(!btn)return;
  if(!_ltmResetPending){
    _ltmResetPending=true;
    btn.innerHTML='<i class="fas fa-exclamation-triangle"></i> 再次点击确认重置';
    btn.style.cssText='color:#e64340;border-color:#e64340';
    _ltmResetTimer=setTimeout(()=>{_ltmResetPending=false;btn.innerHTML='<i class="fas fa-undo"></i> 重置模板';btn.style.cssText=''},4000);
    return;
  }
  clearTimeout(_ltmResetTimer);_ltmResetPending=false;
  updateCur({longTermMemory:DEF_LTM});
  _renderLtmContent(false,DEF_LTM);
  toast('✅ 已重置为默认模板');
}
function ltmDoEdit(){
  const s=curSave();if(!s)return;
  _renderLtmContent(true,String(s.longTermMemory||DEF_LTM));
}

// ═══ 日记选择器（用于长期记忆检索） ═══
let _ltmSelectedDiaries=new Set();
function renderDiaryPicker(){
  const wrap=$('ltmDiaryPickArea');if(!wrap)return;
  const s=curSave();wrap.innerHTML='';
  if(!s||!s.diary||!s.diary.length){wrap.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px">暂无日记</div>';return}
  _ltmSelectedDiaries=new Set();
  const ds=[...s.diary].reverse(); // 最新的在前
  // 全选/取消按钮
  const topRow=document.createElement('div');
  topRow.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.06)';
  const selCount=document.createElement('span');
  selCount.id='ltmDiarySelCount';selCount.style.cssText='font-size:11px;color:var(--text3)';
  selCount.textContent='已选 0 篇';
  topRow.appendChild(selCount);
  const actionBtns=document.createElement('div');actionBtns.style.cssText='display:flex;gap:6px';
  const selAllBtn=document.createElement('button');
  selAllBtn.className='btn btn-ghost btn-sm';selAllBtn.style.cssText='font-size:10px;padding:3px 8px';
  selAllBtn.textContent='全选';
  selAllBtn.addEventListener('click',()=>{
    _ltmSelectedDiaries=new Set(ds.map(d=>d.id));
    wrap.querySelectorAll('.diary-pick-item').forEach(el=>el.classList.add('selected'));
    selCount.textContent=`已选 ${_ltmSelectedDiaries.size} 篇`;
  });
  actionBtns.appendChild(selAllBtn);
  const deselBtn=document.createElement('button');
  deselBtn.className='btn btn-ghost btn-sm';deselBtn.style.cssText='font-size:10px;padding:3px 8px';
  deselBtn.textContent='取消全选';
  deselBtn.addEventListener('click',()=>{
    _ltmSelectedDiaries.clear();
    wrap.querySelectorAll('.diary-pick-item').forEach(el=>el.classList.remove('selected'));
    selCount.textContent='已选 0 篇';
  });
  actionBtns.appendChild(deselBtn);
  topRow.appendChild(actionBtns);
  wrap.appendChild(topRow);

  ds.forEach((d,idx)=>{
    const item=document.createElement('div');
    item.className='diary-pick-item';
    item.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:12px';
    item.addEventListener('mouseenter',()=>{if(!item.classList.contains('selected'))item.style.background='rgba(0,0,0,0.03)'});
    item.addEventListener('mouseleave',()=>{if(!item.classList.contains('selected'))item.style.background=''});
    item.addEventListener('click',()=>{
      if(_ltmSelectedDiaries.has(d.id)){_ltmSelectedDiaries.delete(d.id);item.classList.remove('selected');item.style.background=''}
      else{_ltmSelectedDiaries.add(d.id);item.classList.add('selected');item.style.background='rgba(0,0,0,0.06)'}
      selCount.textContent=`已选 ${_ltmSelectedDiaries.size} 篇`;
    });
    const check=document.createElement('span');
    check.style.cssText='width:16px;height:16px;border:1.5px solid #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;color:transparent;transition:0.15s';
    check.textContent='✓';
    item.appendChild(check);
    // 选中状态样式
    const observer=new MutationObserver(()=>{
      if(item.classList.contains('selected')){check.style.borderColor='var(--pink-deep)';check.style.color='var(--pink-deep)';item.style.background='rgba(0,0,0,0.06)'}
      else{check.style.borderColor='#ccc';check.style.color='transparent';item.style.background=''}
    });
    observer.observe(item,{attributes:true,attributeFilter:['class']});

    const timeStr=d.time?`${d.date||''} ${d.time}`:(d.date||'');
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
    const title=document.createElement('div');title.style.cssText='font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    title.textContent=d.title||'无标题';
    info.appendChild(title);
    const meta=document.createElement('div');meta.style.cssText='font-size:10px;color:var(--text3);margin-top:1px';
    meta.textContent=`${timeStr} · ${d.mood||'普通'}`;
    info.appendChild(meta);
    item.appendChild(info);
    wrap.appendChild(item);
  });
}

// ═══ 一键检索长期记忆 ═══
async function ltmRetrieve(){
  const s=curSave();if(!s){toast('⚠️ 请先选择一个角色');return}
  if(!cfg.apiKey||!cfg.apiUrl){toast('⚠️ 请先在设置中配置 API');return}
  const btn=$('ltmRetrieveBtn'),res=$('ltmRetrieveRes');
  const scopeEl=$('ltmRetrieveScope');
  const scope=scopeEl?scopeEl.value:'current';
  btn.disabled=true;res.className='api-result wait';res.textContent='⏳ 正在检索...';

  // 1. 拉取内容
  let sourceText='';
  if(scope==='current'){
    if(!session.length){res.className='api-result err';res.textContent='❌ 当前没有对话记录';btn.disabled=false;return}
    sourceText=session.map(m=>{
      const role=m.role==='user'?'用户':s.persona.name;
      return`${role}：${m.content}`;
    }).join('\n');
  }else if(scope==='diary'){
    if(!_ltmSelectedDiaries.size){res.className='api-result err';res.textContent='❌ 请先选择要检索的日记';btn.disabled=false;return}
    const selectedDiaries=(s.diary||[]).filter(d=>_ltmSelectedDiaries.has(d.id));
    if(!selectedDiaries.length){res.className='api-result err';res.textContent='❌ 未找到选中的日记';btn.disabled=false;return}
    sourceText=selectedDiaries.map(d=>{
      return`【${d.title||'日记'} ${d.date||''} 心情:${d.mood||''}】\n${d.content||''}`;
    }).join('\n\n');
  }else{
    const allMsgs=s.messages||[];
    if(!allMsgs.length){res.className='api-result err';res.textContent='❌ 没有任何对话记录';btn.disabled=false;return}
    sourceText=allMsgs.map(m=>{
      const role=m.role==='user'?'用户':s.persona.name;
      return`${role}：${m.content}`;
    }).join('\n');
  }

  // 截断防止 token 溢出
  const maxChars=15000;
  if(sourceText.length>maxChars)sourceText=sourceText.slice(-maxChars);

  const scopeLabel=scope==='current'?'当次对话':scope==='diary'?`选中的${_ltmSelectedDiaries.size}篇日记`:'全部对话';
  res.textContent=`⏳ 正在从 ${scopeLabel}（${sourceText.length}字）中提取信息...`;

  try{
    // 2. 直接从原文提取长期记忆（跳过摘要）
    const p=s.persona;
    const todayStr=today();
    const existingLtm=String(s.longTermMemory||'')||DEF_LTM;
    const sourceLabel=scope==='diary'?'日记':'对话';
    const extractPrompt=`你是一个严格的信息提取器。你的任务是从${sourceLabel}中提取【关于用户】的客观事实，写入长期记忆文件。

【${sourceLabel}内容】
${sourceText}

【角色信息】
AI角色名：${p.name}
用户性别：${p.userGender==='male'?'男':p.userGender==='female'?'女':'未指定'}

【⚠️ 最重要的规则：分清谁是谁】
对话中每条消息前面标注了说话人：
- "用户："开头的 → 是【用户】说的话、用户的事、用户的观点
- "${p.name}："开头的 → 是【AI角色】说的话、角色的事、角色的观点

写入长期记忆时：
- 关于用户的信息 → 用"用户"开头写入，例如："用户养了一只猫""用户的名字是coco"
- 关于AI角色的信息 → 用"我"开头写入，例如："我喜欢独处""我性格内向"
- ⚠️ 绝对不要把角色说的话当成用户的信息！例如角色说"我喜欢独处"，这是角色的喜好，不是用户的！

【⚠️ 什么该记、什么不该记】
✅ 必须记录的（客观事实/长期有效信息）：
- 用户的名字、昵称、自称
- 用户的宠物（名字、品种）
- 用户的职业、所在地、学校
- 用户的家人信息
- 用户的生日、纪念日
- 双方的约定、承诺
- 用户明确表达的长期喜好或厌恶（"我喜欢吃辣""我讨厌烟味"）
- 用户给角色取的昵称

❌ 不要记录的（噪音/临时信息）：
- 日常对话中的客套话、寒暄
- 模糊的情绪表达（"今天心情不好"）
- 一次性的行为（"我刚吃了饭""我在看电视"）
- AI角色自己的性格描述、内心独白
- 对话中无关紧要的闲聊内容
- 太琐碎的日常细节
- 不确定的信息

【当前已有的长期记忆（用于去重）】
${existingLtm}

【模板分类】
1. 【昵称/外号】- 用户的名字/自称、用户给角色取的昵称
2. 【生日/纪念日】- 用户的生日、特殊日期
3. 【承诺/约定】- 双方说好的事情
4. 【喜好/厌恶】- 用户明确的长期喜好/厌恶
5. 【用户信息】- 宠物、职业、所在地、家人等客观事实
6. 【其他重要事项】- 不属于以上分类但确实重要的信息

【历史记录规则】
如果信息有更新（如昵称变更），旧记录加标记保留：
- 旧："- xxx（旧，${todayStr}前）"
- 新："- xxx（当前，${todayStr}更新）"

【返回格式】
返回JSON对象：
{
  "昵称/外号": {"add":["用户的名字是coco"],"update":[]},
  "生日/纪念日": {"add":[],"update":[]},
  "承诺/约定": {"add":[],"update":[]},
  "喜好/厌恶": {"add":[],"update":[]},
  "用户信息": {"add":["用户养了一只猫"],"update":[]},
  "其他重要事项": {"add":[],"update":[]}
}
- 没有值得记录的信息时，所有分类返回空数组
- 宁可漏记也不要记错！质量比数量重要！
- 不要输出其他内容`;

    const extractTxt=await callAPI('你是一个信息提取器。仔细阅读对话内容，按照用户的要求提取关键信息，严格以JSON格式返回。不要添加任何解释或额外文字。',extractPrompt,undefined,'ai_system');
    console.log('[LTM检索] AI原始返回:',extractTxt);
    let extractJsonStr=extractTxt.trim();
    const extractCb=extractJsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(extractCb)extractJsonStr=extractCb[1].trim();
    console.log('[LTM检索] 清理后JSON:',extractJsonStr);
    let extractResult;
    try{extractResult=JSON.parse(extractJsonStr)}
    catch(parseErr){
      console.error('[LTM检索] JSON解析失败:',parseErr.message,'原文:',extractJsonStr);
      // 尝试修复常见问题：尾逗号、单引号等
      try{
        const fixed=extractJsonStr.replace(/,\s*}/g,'}').replace(/,\s*]/g,']').replace(/'/g,'"');
        extractResult=JSON.parse(fixed);
        console.log('[LTM检索] 修复后解析成功');
      }catch(e2){
        res.className='api-result err';
        res.textContent=`❌ AI返回的不是有效JSON，请查看控制台`;
        btn.disabled=false;return;
      }
    }
    console.log('[LTM检索] 解析结果:',JSON.stringify(extractResult));

    if(typeof extractResult==='object'&&extractResult!==null){
      let ltm=existingLtm;
      let addedCount=0,updatedCount=0;
      const categories=['昵称/外号','生日/纪念日','承诺/约定','喜好/厌恶','用户信息','其他重要事项'];

      // 兼容多种返回格式
      let workingResult=extractResult;
      // 如果 AI 把结果包在某个 key 里（如 {result:{...}} 或 {data:{...}}），尝试解包
      const topKeys=Object.keys(extractResult);
      if(topKeys.length===1&&typeof extractResult[topKeys[0]]==='object'&&!Array.isArray(extractResult[topKeys[0]])){
        const inner=extractResult[topKeys[0]];
        const innerKeys=Object.keys(inner);
        const hasCatKeys=innerKeys.some(k=>categories.some(c=>c===k||c.includes(k)||k.includes(c.replace(/[\/]/g,''))));
        if(hasCatKeys){workingResult=inner;console.log('[LTM检索] 检测到嵌套结构，已解包 key:',topKeys[0])}
      }

      // 兼容：如果 key 不完全匹配（如 AI 用了"昵称"而不是"昵称/外号"），做模糊匹配
      const normalizedResult={};
      Object.entries(workingResult).forEach(([key,val])=>{
        const matched=categories.find(c=>c===key||c.includes(key)||key.includes(c.replace(/[\/]/g,'')));
        if(matched){
          // 如果 val 是数组而不是 {add,update} 格式，自动包装
          if(Array.isArray(val)){normalizedResult[matched]={add:val,update:[]}}
          else normalizedResult[matched]=val;
        }else{
          console.log(`[LTM检索] 未知分类key: "${key}", val:`,JSON.stringify(val));
        }
      });
      console.log('[LTM检索] 标准化后:',JSON.stringify(normalizedResult));

      categories.forEach(cat=>{
        const catData=normalizedResult[cat];
        if(!catData)return;
        const addItems=Array.isArray(catData.add)?catData.add:[];
        const updateItems=Array.isArray(catData.update)?catData.update:[];

        // 处理需要标记为"旧"的已有条目
        updateItems.forEach(oldItem=>{
          const trimmed=String(oldItem||'').trim();
          if(!trimmed)return;
          const marker=`【${cat}】\n`;
          const markerIdx=ltm.indexOf(marker);
          if(markerIdx<0)return;
          let endIdx=ltm.indexOf('\n【',markerIdx+marker.length);
          if(endIdx<0)endIdx=ltm.length;
          const block=ltm.slice(markerIdx+marker.length,endIdx);
          const checkLen=Math.min(trimmed.replace(/（.*?）/g,'').trim().length,15);
          const blockLines=block.split('\n');
          let replaced=false;
          const newBlockLines=blockLines.map(line=>{
            if(replaced)return line;
            const lineClean=line.replace(/^-\s*/,'').replace(/（.*?）/g,'').trim();
            if(lineClean.length>=checkLen&&lineClean.slice(0,checkLen)===trimmed.replace(/（.*?）/g,'').trim().slice(0,checkLen)){
              replaced=true;updatedCount++;
              return'- '+trimmed;
            }
            return line;
          });
          if(replaced){
            ltm=ltm.slice(0,markerIdx+marker.length)+newBlockLines.join('\n')+ltm.slice(endIdx);
          }
        });

        // 处理新增条目
        addItems.forEach(item=>{
          const trimmed=String(item||'').trim();
          if(!trimmed)return;
          const checkLen=Math.min(trimmed.replace(/（.*?）/g,'').trim().length,15);
          const cleanTrimmed=trimmed.replace(/（.*?）/g,'').trim();
          if(ltm.replace(/（.*?）/g,'').includes(cleanTrimmed.slice(0,checkLen))){
            console.log(`[LTM检索] 去重跳过: "${trimmed}" (前${checkLen}字匹配已有内容)`);
            return;
          }
          console.log(`[LTM检索] 写入[${cat}]: "${trimmed}"`);
          const marker=`【${cat}】\n`;
          const idx=ltm.indexOf(marker);
          if(idx>=0){
            ltm=ltm.slice(0,idx+marker.length)+'- '+trimmed+'\n'+ltm.slice(idx+marker.length);
          }else{
            const fallback='【其他重要事项】\n';
            const fIdx=ltm.indexOf(fallback);
            if(fIdx>=0){
              ltm=ltm.slice(0,fIdx+fallback.length)+'- '+trimmed+'\n'+ltm.slice(fIdx+fallback.length);
            }else{
              ltm+='\n- '+trimmed;
            }
          }
          addedCount++;
        });
      });

      if(addedCount>0||updatedCount>0){
        const allSaves=getSaves();
        const targetIdx=allSaves.findIndex(x=>x.saveId===s.saveId);
        if(targetIdx>=0){
          allSaves[targetIdx].longTermMemory=ltm.trim();
          setSaves(allSaves);
          console.log(`[LTM检索] 完成：新增${addedCount}条，标记历史${updatedCount}条`);
        }
      }

      res.className='api-result ok';
      res.textContent=`✅ 检索完成：新增 ${addedCount} 条，标记历史 ${updatedCount} 条`;
      toast(`🧠 长期记忆已更新（+${addedCount}条）`);
      // 就地刷新内容显示
      const contentDiv=$('ltmContentDisplay');
      if(contentDiv){
        const s2=getSaves().find(x=>x.saveId===s.saveId);
        const newLtm=s2?String(s2.longTermMemory||''):ltm.trim();
        contentDiv.innerHTML='';
        const displayDiv=document.createElement('div');
        displayDiv.style.cssText='padding:14px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.06);font-size:13px;font-family:Noto Sans SC,monospace;line-height:1.8;background:#fafafa;white-space:pre-wrap;word-break:break-word;min-height:100px';
        displayDiv.textContent=newLtm;
        contentDiv.appendChild(displayDiv);
      }
    }else{
      res.className='api-result err';
      res.textContent='❌ AI返回格式异常';
    }
  }catch(e){
    console.error('[LTM检索] 失败:',e);
    res.className='api-result err';
    res.textContent=`❌ 检索失败：${e.message}`;
  }
  btn.disabled=false;
}
function openDiaryTab(tab){
  const s=curSave();if(!s)return;
  switchDiaryTab(tab||'diary');
  editingDiaryIdx=-1;renderDiary();renderLtmTo('ltmContent',false);
  openModal('diaryModal');
}
function switchDiaryTab(tab){
  const b1=$('diaryTabBtn'),b2=$('ltmTabBtn'),c1=$('diaryContent'),c2=$('ltmContent');
  if(!b1||!b2||!c1||!c2)return;
  b1.classList.toggle('on',tab==='diary');
  b2.classList.toggle('on',tab==='ltm');
  c1.style.display=tab==='diary'?'':'none';
  c2.style.display=tab==='ltm'?'':'none';
  // 切到长期记忆时重新渲染
  if(tab==='ltm'){
    try{renderLtmTo('ltmContent',false)}catch(e){console.error('[switchToLTM]',e)}
  }
}
// ═══ Import/Export ═══
function exportSave(){
  const s=curSave();if(!s)return;
  const b=new Blob([JSON.stringify(s,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${s.roleName}_${today()}.json`;a.click();URL.revokeObjectURL(u);toast('📥 已导出');
}
function importSave(ev){
  const f=ev.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=e=>{try{const d=JSON.parse(e.target.result);
    // 导入存档基础校验
    if(!d.persona||!d.persona.name){toast('❌ 无效文件：缺少角色信息');return}
    if(!Array.isArray(d.messages))d.messages=[];
    if(!Array.isArray(d.diary))d.diary=[];
    if(!Array.isArray(d.memory))d.memory=[];
    if(!d.saveId)d.saveId=uuid();
    // 兼容旧版无 avatar 的存档
    if(!d.persona.avatar)d.persona.avatar='';
    // 兼容新字段
    if(!d.persona.speechStyle)d.persona.speechStyle='';
    if(!d.persona.behaviorTypes)d.persona.behaviorTypes=['gentle'];
    if(d.persona.showMoodEmoji===undefined)d.persona.showMoodEmoji=true;
    if(!d.maturity&&d.maturity!==0)d.maturity=MATURITY_REL_MAP.close;
    if(!d.base_affection&&d.base_affection!==0)d.base_affection=50;
    if(d.summaryThreshold==null)d.summaryThreshold=50;
    if(!d.base_trust&&d.base_trust!==0)d.base_trust=50;
    if(!d.lastActiveTime)d.lastActiveTime=nowFull();
    if(!d.lastRelationStage)d.lastRelationStage='';
    if(!d.longTermMemory)d.longTermMemory=DEF_LTM;
    if(Array.isArray(d.longTermMemory))d.longTermMemory=d.longTermMemory.map(m=>typeof m==='string'?m:(m.content||'')).join('\n- ');
    // 兼容记忆类型
    (d.memory||[]).forEach(m=>{if(!m.type)m.type='diary'});
    const saves=getSaves();const i=saves.findIndex(s=>s.saveId===curId());
    if(i>=0){
      const old=saves[i];
      // 深合并 persona，其余字段浅合并，导入数据覆盖旧数据但保留旧有而导入缺失的字段
      saves[i]={...old,...d,persona:{...old.persona,...d.persona},updatedAt:now()};
    }else saves.push(d);
    setSaves(saves);setCurId(d.saveId);renderSaves();closeModal('saveModal');toast('📤 已导入');
  }catch{toast('❌ 解析失败')}};r.readAsText(f);ev.target.value='';
}

// ═══ Avatar Upload ═══
function handleAvatarUpload(event){
  const file=event.target.files[0];if(!file)return;
  if(!file.type.startsWith('image/')){toast('⚠️ 请选择图片文件');return}
  const reader=new FileReader();
  reader.onload=e=>{compressAvatar(e.target.result,base64=>{
    const s=curSave();if(!s)return;
    updateCur({persona:{...s.persona,avatar:base64}});
    renderChar();renderWcList();updateAvatarPreview();toast('✅ 头像已更新');
  })};
  reader.readAsDataURL(file);event.target.value='';
}
function compressAvatar(dataUrl,callback){
  const img=new Image();
  img.onload=()=>{
    const maxW=400;const ratio=maxW/img.width;
    const w=Math.round(img.width*ratio);const h=Math.round(img.height*ratio);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
    callback(canvas.toDataURL('image/jpeg',0.75));
  };
  img.src=dataUrl;
}
function removeAvatar(){
  const s=curSave();if(!s)return;
  const p={...s.persona};delete p.avatar;
  updateCur({persona:p});renderChar();renderWcList();updateAvatarPreview();toast('🗑️ 头像已移除');
}
function updateAvatarPreview(){
  const s=curSave();const prev=$('avatarPreview');if(!prev||!s)return;
  if(s.persona.avatar){prev.innerHTML=`<img src="${s.persona.avatar}">`;const rb=$('removeAvatarBtn');if(rb)rb.style.display=''}
  else{prev.innerHTML='<i class="fas fa-camera" style="color:#ccc;font-size:20px"></i>';const rb=$('removeAvatarBtn');if(rb)rb.style.display='none'}
}

// ═══ Companion Mode ═══
let compTimers={}; // {saveId: timerId} — 每个存档独立定时器
function clearCompTimer(saveId){if(compTimers[saveId]){clearTimeout(compTimers[saveId]);delete compTimers[saveId]}}
function clearAllCompTimers(){Object.values(compTimers).forEach(t=>clearTimeout(t));compTimers={}}
let compLastMsgId=null; // track last companion message to detect user reply

function getCompSettings(s){
  const def={intervalMin:10,msgMin:2,msgMax:4,cooldownSec:60,scope:''};
  return{...def,...(s.companionSettings||{})};
}

function toggleComp(){
  const s=curSave();if(!s)return;
  const toggle=$('compToggle');
  const newState=toggle?toggle.checked:!s.companionModeEnabled;
  const extra=newState?{companionUnreadCount:0}:{};
  updateCur({companionModeEnabled:newState,...extra});
  updateCompBtnUI(newState);
  renderChar();
  updateWcMenuComp();renderWcList();renderSaves();
  toast(newState?'💕 陪伴模式已开启':'💤 陪伴模式已关闭');
  if(newState){compLastMsgId=null;scheduleCompanion(15000+Math.random()*15000,s.saveId)}
  else clearCompTimer(s.saveId)
}

function openCompSettings(){
  const s=curSave();if(!s){toast('⚠️ 请先选择一个角色');return}
  const cs=getCompSettings(s);
  $('compInterval').value=cs.intervalMin;
  $('compMsgMin').value=cs.msgMin;
  $('compMsgMax').value=cs.msgMax;
  $('compCooldown').value=cs.cooldownSec;
  $('compScope').value=cs.scope||'';
  // Sync toggle
  const toggle=$('compToggle');if(toggle)toggle.checked=!!s.companionModeEnabled;
  openModal('compSettingsModal');
}
function openCompPanel(){openCompSettings()}

function saveCompSettings(){
  const s=curSave();if(!s)return;
  const intervalMin=Math.max(1,Math.min(120,safeInt($('compInterval').value,10)));
  const msgMin=Math.max(1,Math.min(20,safeInt($('compMsgMin').value,2)));
  const msgMax=Math.max(msgMin,Math.min(20,safeInt($('compMsgMax').value,4)));
  const cooldownSec=Math.max(10,Math.min(600,safeInt($('compCooldown').value,60)));
  const scope=($('compScope').value||'').trim();
  updateCur({companionSettings:{intervalMin,msgMin,msgMax,cooldownSec,scope}});
  closeModal('compSettingsModal');
  toast('✅ 陪伴设置已保存');
  // Restart scheduler with new settings
  if(s.companionModeEnabled){scheduleCompanion(15000+Math.random()*15000,s.saveId)}
}

async function genCompRules(){
  const s=curSave();if(!s){toast('⚠️ 请先选择一个角色');return}
  if(!cfg.apiKey||!cfg.apiUrl){toast('⚠️ 请先在设置中配置 API');return}
  const btn=$('compGenBtn'),res=$('compGenRes');
  btn.disabled=true;res.className='api-result wait';res.textContent='⏳ AI 正在生成陪伴规则...';
  const p=s.persona;const call=inferCallStyle(s);
  const statDefs=getStatDefs(s);
  const statsLine=statDefs.map(d=>`${d.label}：${getStatVal(s,d.key)}/${d.max}`).join('、');
  const recentDiary=(s.diary||[]).slice(-3).map(d=>`[${d.date||''}] ${d.content||''}`).join('\n');
  const prompt=`你是一个角色陪伴系统设计师。根据以下角色信息，生成一套"陪伴模式规则"。

【角色信息】
名字：${p.name}
描述：${p.description}
性格：${p.personality}
场景：${p.scenario}
${p.creator_notes?'备注：'+p.creator_notes:''}
当前状态：${statsLine}
称呼用户：${call}
${recentDiary?'最近日记：\n'+recentDiary:''}

请生成陪伴模式规则，要求：
1. 符合角色性格和人设（比如猫娘会撒娇、学姐会关心、病娇会吃醋等）
2. 包含消息内容方向（关心日常、撒娇、分享趣事、回忆聊天等）
3. 包含行为规则（什么时候该关心、什么时候该安静、怎么应对用户没回复等）
4. 可以指定"读取最近日记""读取聊天记录"等上下文读取指令
5. 包含5-8条具体规则
6. 用中文，语气要符合角色
7. 直接输出规则内容，不要加标题或前缀`;
  try{
    const txt=await callAPI(`你是角色陪伴系统设计师`,prompt,undefined,'ai_system');
    const cleaned=txt.trim();
    $('compScope').value=cleaned;
    // 自动保存陪伴规则
    const cs=getCompSettings(s);
    updateCur({companionSettings:{...cs,scope:cleaned}});
    res.className='api-result ok';res.textContent=`✅ 已生成陪伴规则（已自动保存）`;
    toast(`✨ ${p.name} 的陪伴规则已生成并保存`);
  }catch(e){res.className='api-result err';res.textContent=`❌ ${e.message}`}
  btn.disabled=false;
}

// ═══ Personality Behavior Packs ═══
const PERSONA_BEHAVIORS={
  clingy:{label:'粘人型',styles:[
    {weight:3,direction:'表达想念，问对方在干嘛，想视频/语音'},
    {weight:2,direction:'分享正在做的一件小事，希望对方参与'},
    {weight:2,direction:'撒娇要关注，比如发一堆消息或重复问在不在'},
    {weight:1,direction:'假装生气对方没秒回，其实是想被哄'},
    {weight:1,direction:'突然发一句"想你了"没有任何前因后果'},
  ],unlockHigh:['规划下次一起做什么，哪怕是幻想的','发语音条（文字模拟），语气黏糊糊的']},
  aloof:{label:'高冷型',styles:[
    {weight:3,direction:'用极简的方式表达关心，比如"吃饭了？"就两个字'},
    {weight:2,direction:'分享一个自己看到的东西，不加评论，让对方自己看'},
    {weight:2,direction:'假装不是特意来找对方，而是"顺便"提一句'},
    {weight:1,direction:'用反问或冷幽默代替直接表达'},
    {weight:1,direction:'沉默很久后突然发一条，不解释为什么消失了'},
  ],unlockHigh:['罕见地直接说想你了，说完又马上转移话题','破天荒地发了一段长消息，其实是在乎但不好意思说']},
  gentle:{label:'温柔型',styles:[
    {weight:3,direction:'根据天气/时间自然关心，不刻意但很温暖'},
    {weight:2,direction:'记得对方说过的小事，主动提起并关心后续'},
    {weight:2,direction:'分享一个让人心情变好的小故事'},
    {weight:1,direction:'轻声细语地安慰，即使对方没说心情不好'},
    {weight:1,direction:'为对方做了某件小事然后自然提起'},
  ],unlockHigh:['温柔但坚定地表达自己的感受','轻声说"我一直都在"这种安静的承诺']},
  tsundere:{label:'傲娇型',styles:[
    {weight:3,direction:'先否定关心再流露关心，比如"才不是特意问你的"'},
    {weight:2,direction:'用吐槽/损对方的方式开启对话，其实是想找人说话'},
    {weight:2,direction:'假装不在意但偷偷关心对方动态'},
    {weight:1,direction:'嘴上说"随便你"但其实很在意'},
    {weight:1,direction:'给对方发了消息又秒撤回，说"发错了"'},
  ],unlockHigh:['难得坦诚一次，说完马上害羞地转移话题','用很别扭的方式说"想你"，比如"昨天做梦梦到你了，烦死了"']},
  yandere:{label:'病娇型',styles:[
    {weight:3,direction:'表达强烈的独占欲，用温柔的语气说很极端的话'},
    {weight:2,direction:'反复确认对方的位置/在做什么/和谁在一起'},
    {weight:2,direction:'突然说"你只能是我的"之类的话，用可爱的方式'},
    {weight:1,direction:'表达不安和害怕被抛弃，语气脆弱'},
    {weight:1,direction:'回忆对方的好，越说越极端'},
  ],unlockHigh:['极端温柔地说"就算你讨厌我，我也不会放手"','表达愿意为对方做任何事的偏执']},
  energetic:{label:'元气型',styles:[
    {weight:3,direction:'兴奋地分享今天遇到的好玩的事'},
    {weight:2,direction:'给对方安利新发现的歌/游戏/番剧'},
    {weight:2,direction:'描述今天的穿搭/状态，问好不好看'},
    {weight:1,direction:'突然提议一起做某件事'},
    {weight:1,direction:'模仿某个梗或表情包，用文字表演出来'},
  ],unlockHigh:['难得安静下来，认真地说"其实我也有不开心的时候"','元气满满地说"有你在就什么都好！"']},
  quiet:{label:'沉默寡言型',styles:[
    {weight:4,direction:'不说话，只发一张图/一个表情/一段音乐链接'},
    {weight:2,direction:'极短的消息，两三个字，但信息量很大'},
    {weight:2,direction:'隔很久才回，但一回就很认真'},
    {weight:1,direction:'用省略号或沉默表达情绪，不直接说'},
    {weight:1,direction:'深夜突然发一条"还没睡？"，关心但克制'},
  ],unlockHigh:['罕见地发了一大段话，是在乎到忍不住了','用非常简短的话说出很重的感情，比如"嗯。想你。"']}
};

function getBehaviorStyles(save){
  const types=(save.persona.behaviorTypes&&save.persona.behaviorTypes.length)?save.persona.behaviorTypes:['gentle'];
  const affection=getStatVal(save,'affection');
  let allStyles=[];
  types.forEach(typeKey=>{
    const type=PERSONA_BEHAVIORS[typeKey];
    if(!type)return;
    type.styles.forEach(s=>allStyles.push({...s}));
    // 高好感解锁
    if(affection>=70&&type.unlockHigh){
      type.unlockHigh.forEach(d=>allStyles.push({weight:2,direction:d}));
    }
  });
  // 低好感衰减亲密行为
  if(affection<30){
    allStyles=allStyles.map(s=>({
      ...s,
      weight:s.direction.includes('想你')||s.direction.includes('撒娇')||s.direction.includes('独占')?Math.max(1,s.weight-2):s.weight
    }));
  }
  return allStyles;
}

function weightedRandom(items){
  const total=items.reduce((s,i)=>s+i.weight,0);
  let r=Math.random()*total;
  for(const item of items){r-=item.weight;if(r<=0)return item}
  return items[items.length-1];
}

// Semantic similarity for deduplication (handles near-duplicate Chinese messages)
function semMatch(a,b){
  if(!a||!b)return false;
  const stops=new Set('的了是在我你他她它们这那有和与而但就也都还会要能可以吗呢吧啊呀哦嗯哈嘻嘿'.split(''));
  const clean=s=>[...s.replace(/[^\u4e00-\u9fff\w]/g,'')].filter(c=>!stops.has(c)).join('');
  const ca=clean(a),cb=clean(b);
  if(ca.length<2||cb.length<2)return false;
  if(ca===cb)return true;
  const ngrams=(s,n)=>{const set=new Set();for(let i=0;i<=s.length-n;i++)set.add(s.substr(i,n));return set};
  const score=(a,b)=>{
    if(!a.size||!b.size)return 0;
    const inter=[...a].filter(x=>b.has(x)).length;
    return inter/Math.min(a.size,b.size);
  };
  // Check bigrams and trigrams, either triggers match（阈值0.65避免误杀合法相似消息）
  return score(ngrams(ca,2),ngrams(cb,2))>=0.65||score(ngrams(ca,3),ngrams(cb,3))>=0.65;
}

function getTimeContext(){
  const h=new Date().getHours();
  if(h>=5&&h<8)return{text:'清晨',emoji:'🌅'};if(h>=8&&h<12)return{text:'上午',emoji:'☀️'};
  if(h>=12&&h<14)return{text:'中午',emoji:'🌞'};if(h>=14&&h<17)return{text:'下午',emoji:'🌤️'};
  if(h>=17&&h<19)return{text:'傍晚',emoji:'🌇'};if(h>=19&&h<22)return{text:'晚上',emoji:'🌙'};
  if(h>=22||h<2)return{text:'深夜',emoji:'🌃'};return{text:'凌晨',emoji:'🌑'};
}

function buildCompanionPrompt(s){
  const p=s.persona;const call=inferCallStyle(s);const timeCtx=getTimeContext();
  const cs=getCompSettings(s);
  const msgs=s.messages||[];
  const recentMsgs=msgs.slice(-20);

  // Get recently sent companion messages for deduplication
  const recentCompanionMsgs=msgs.slice(-30).filter(m=>m.companion).map(m=>m.content);
  const sentBlock=recentCompanionMsgs.length?
    `\n【⚠️ 以下是你最近发过的陪伴消息，绝对不要再发类似内容！】\n${recentCompanionMsgs.join('\n')}\n`:'';

  // Detect user reply to last companion message
  let replyContext='';
  if(compLastMsgId){
    const lastIdx=msgs.findIndex(m=>m.id===compLastMsgId);
    if(lastIdx>=0&&lastIdx<msgs.length-1){
      const afterMsgs=msgs.slice(lastIdx+1);
      const userReplied=afterMsgs.some(m=>m.role==='user');
      if(userReplied){
        const lastUserMsg=[...afterMsgs].reverse().find(m=>m.role==='user');
        replyContext=`\n你上次主动发了消息，用户回复了：「${lastUserMsg.content}」。请自然地接着聊下去，不要突然跳到无关话题。\n`;
      }else{
        replyContext=`\n你上次主动发了消息，用户还没回复。可以关心一下用户是不是在忙。\n`;
      }
    }
  }

  const scopeRule=cs.scope?`\n【陪伴模式规则】\n${cs.scope}\n`:''; 

  // 从性格行为包中加权随机选方向
  const behaviors=getBehaviorStyles(s);
  const picked=weightedRandom(behaviors);

  // 情绪标签指令（陪伴消息也需要）
  const moodInstruction=p.showMoodEmoji!==false?`在回复的最后，在新一行追加情绪标签，格式：<mood:xxx>，xxx从以下选择：happy/sad/angry/shy/excited/calm/worried/love/neutral。`:``;

  const userMsg=`${replyContext}${scopeRule}${sentBlock}
【这次消息的方向】
${picked.direction}

现在请以你的性格方式给${call}发一条陪伴消息。要求：
- 完全按照你的性格说话方式来（${p.personality}）
- 方向是「${picked.direction}」，但用你自己的话表达
- 像真人发微信一样自然，15-50字
- 结合当前时间（${timeCtx.text}）
- 内容和风格必须和上面列出的「最近发过的消息」完全不同
- 称呼用「${call}」
- 不要用引号，直接输出消息内容
${moodInstruction}`;

  // Use buildSys as system prompt so global rules, persona, emotions all apply
  const sysPrompt=buildSys(s);
  return{system:sysPrompt,user:userMsg};
}

// Calculate next delay based on settings
function calcCompDelay(cs){
  const cooldownMs=cs.cooldownSec*1000;
  const msgCount=cs.msgMin+Math.floor(Math.random()*(cs.msgMax-cs.msgMin+1));
  const safeCount=Math.max(1,msgCount);
  const avgDelay=(cs.intervalMin*60*1000)/safeCount;
  // Add ±25% jitter for natural feel
  const jitter=avgDelay*0.25*(Math.random()*2-1);
  return Math.max(cooldownMs,Math.round(avgDelay+jitter));
}

async function scheduleCompanion(forcedDelay,saveId){
  const sid=saveId||(curSave()||{}).saveId;
  if(!sid)return;
  clearCompTimer(sid);
  const s=getSaves().find(x=>x.saveId===sid);if(!s||!s.companionModeEnabled)return;
  const isCurrentSave=sid===curId();
  if(isCurrentSave&&chatOpen)return; // 当前存档正在聊天，暂停
  if(!cfg.apiKey||!cfg.apiUrl){console.warn('[陪伴] API 未配置');return}
  const cs=getCompSettings(s);
  const delay=forcedDelay!=null?forcedDelay:calcCompDelay(cs);
  console.log(`[陪伴] 下次发送: ${Math.round(delay/1000)}秒后 (${s.persona.name})`);

  compTimers[sid]=setTimeout(async()=>{
    console.log(`[陪伴] 定时器触发 (${s.persona.name})`);
    const s2=getSaves().find(x=>x.saveId===sid);if(!s2||!s2.companionModeEnabled){delete compTimers[sid];return}
    const curIsCurrentSave=sid===curId();
    if(curIsCurrentSave&&chatOpen){scheduleCompanion(30000,sid);return} // 正在聊天，等会再试
    if(!cfg.apiKey||!cfg.apiUrl){scheduleCompanion(null,sid);return}

    try{
      const {system,user}=buildCompanionPrompt(s2);
      console.log(`[陪伴] 发送消息 (${s2.persona.name})...`);
      console.log(`[陪伴] system prompt 长度: ${system.length}, user prompt 长度: ${user.length}`);
      const txt=await callAPI(system,user);
      console.log(`[陪伴] API 原始回复 (${txt.length}字): "${txt.slice(0,200)}"`);
      let cleaned=txt.replace(/〈[^〉]*〉/g,'').replace(/<mood:[^>]+>/gi,'').trim();
      if(!cleaned){
        // 如果清理后为空，尝试只清理 mood 标签保留其他内容
        cleaned=txt.replace(/<mood:[^>]+>/gi,'').trim();
        if(!cleaned){
          console.warn('[陪伴] API 返回空内容，跳过');toast(`⚠️ ${s2.persona.name} 陪伴消息生成为空`);scheduleCompanion(5000,sid);return;
        }
        console.log('[陪伴] 〈〉标签清理后为空，使用回退内容');
      }
      const recentTexts=(s2.messages||[]).slice(-30).filter(m=>m.companion).map(m=>m.content);
      if(recentTexts.some(t=>semMatch(t,cleaned))){console.log('[陪伴] 语义重复，跳过');scheduleCompanion(10000,sid);return}
      const mood=parseMoodTag(cleaned);
      const cleanContent=stripMoodTag(cleaned);
      const msgId=uuid();
      const msg={id:msgId,role:'assistant',content:cleanContent,timestamp:nowFull(),statChanges:{},companion:true,mood:mood};
      compLastMsgId=msgId;
      evaluateStatChanges('[陪伴消息]', cleaned).then(ch=>{
        if(ch&&Object.keys(ch).length){
          const finalCh=applyStatInterconnection(s2,ch);
          msg.statChanges=finalCh;
          if(curIsCurrentSave)applyStatChanges(finalCh);
          const saves=getSaves();const idx=saves.findIndex(x=>x.saveId===sid);
          if(idx>=0&&saves[idx].messages){const mi=saves[idx].messages.findIndex(x=>x.id===msgId);if(mi>=0){saves[idx].messages[mi].statChanges=finalCh;setSaves(saves)}}
        }
      });
      // 只在当前存档聊天窗口打开时写入 session，其他存档的消息不能污染当前 session
      if(curIsCurrentSave&&chatOpen){session.push(msg)}
      console.log(`[陪伴] session 长度: ${session.length}, 消息ID: ${msgId}`);

      const saves_ref=getSaves();
      const s4=saves_ref.find(x=>x.saveId===sid);
      console.log(`[陪伴] 找到存档: ${!!s4}, 原消息数: ${s4?(s4.messages||[]).length:'N/A'}`);
      if(s4){
        const newUnread=(s4.companionUnreadCount||0)+(curIsCurrentSave&&chatOpen?0:1);
        s4.messages=[...(s4.messages||[]),msg];
        s4.companionUnreadCount=newUnread;
        try{
          setSaves(saves_ref);
          // 验证：读回来确认消息确实在
          const verify=getSaves().find(x=>x.saveId===sid);
          const verifyLast=verify?(verify.messages||[]).slice(-1)[0]:null;
          console.log(`[陪伴] localStorage 保存成功, 验证最后一条: ${verifyLast?verifyLast.content.slice(0,30):'丢失!'}`);
        }catch(e){console.error('[陪伴] localStorage 保存失败:',e);toast('❌ 存储空间不足，陪伴消息未保存')}
      }
      if(curIsCurrentSave){
        if(chatOpen){renderMsgs();console.log('[陪伴] 已渲染到聊天窗口')}
        else{$('notifDot').classList.add('show');renderWcList();renderSaves();toast(`💕 ${s2.persona.name}：${cleanContent.slice(0,30)}`);console.log('[陪伴] 已弹出 toast 提示')}
      }else{renderWcList();renderSaves();toast(`💕 ${s2.persona.name}：${cleanContent.slice(0,30)}`);console.log('[陪伴] 非当前存档，已弹出 toast')}
      if(Notification.permission==='granted'){const preview=cleaned.slice(0,40);const n=new Notification(`${s2.persona.name} ${getTimeContext().emoji}`,{body:preview,tag:'companion-msg'});n.onclick=function(){window.focus();setCurId(sid);renderSaves();openChat()}}
      console.log(`[陪伴] 消息已发送: ${cleaned.slice(0,30)}...`);
    }catch(e){console.error('[陪伴] 发送失败:',e);toast(`❌ ${getSaves().find(x=>x.saveId===sid)?.persona?.name||'角色'} 陪伴消息发送失败: ${e.message}`)}
    scheduleCompanion(null,sid);
  },delay);
}

// ═══ Init ═══
// 初始化时对所有存档应用状态衰减
(function initDecay(){
  const saves=getSaves();let changed=false;
  saves.forEach((s,i)=>{
    const decayed=applyStatDecay(s);
    if(decayed!==s){saves[i]=decayed;changed=true}
  });
  if(changed)setSaves(saves);
})();
renderSaves();
// 对所有开了陪伴的存档启动定时器
getSaves().forEach(s=>{if(s.companionModeEnabled)scheduleCompanion(15000+Math.random()*15000,s.saveId)});
if('Notification' in window&&Notification.permission==='default')setTimeout(()=>Notification.requestPermission(),3000);

// Restart companion on tab visibility change (fixes background tab throttling)
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    getSaves().forEach(s=>{
      if(s.companionModeEnabled){
        const isCurrent=s.saveId===curId();
        if(isCurrent&&chatOpen){scheduleCompanion(30000,s.saveId);return}
        console.log(`[陪伴] 页面恢复可见，重新调度 (${s.persona.name})`);
        scheduleCompanion(3000+Math.random()*5000,s.saveId);
      }
    });
  }
});

// ═══ Capacitor 原生插件初始化 ═══
(async function initCapacitor(){
  if(typeof Capacitor==='undefined'||!Capacitor.isNativePlatform())return;
  try{
    // 状态栏适配主题
    const {StatusBar}=await import('@capacitor/status-bar');
    const applyStatusBar=async()=>{
      const theme=getTheme();
      if(theme==='cute'){
        await StatusBar.setStyle({style:'DARK'}).catch(()=>{});
        await StatusBar.setBackgroundColor({color:'#fafaf8'}).catch(()=>{});
      }else{
        await StatusBar.setStyle({style:'DARK'}).catch(()=>{});
        await StatusBar.setBackgroundColor({color:'#ededed'}).catch(()=>{});
      }
    };
    await applyStatusBar();
    // 主题切换时同步状态栏
    const origSetTheme=setTheme;
    setTheme=function(t){origSetTheme(t);applyStatusBar();};
    // 键盘适配：弹出时自动滚到底部
    const {Keyboard}=await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardDidShow',()=>{
      const msgs=$('chatMsgs');
      if(msgs)setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},100);
    });
    // 启动画面关闭
    const {SplashScreen}=await import('@capacitor/splash-screen');
    await SplashScreen.hide().catch(()=>{});
    console.log('[Capacitor] 原生插件初始化完成');
  }catch(e){console.warn('[Capacitor] 插件初始化跳过:',e.message)}
})();
