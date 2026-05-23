// ─── STATE ───────────────────────────────────────────────
var state = {
  xp: 0,
  streak: 0,
  history: [],
  tasks: [],
  schedule: {}, // keyed by "day-slotIndex"
  loggedSlots: {}, // keyed by "day-slotIndex"
  taskNextId: 1,
  selectedTaskCat: '🎯',
  selectedDay: 0,
  editingSlot: null,
};

var DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var TODAY_IDX = (new Date().getDay() + 6) % 7;

// 30-min slots 6am–10pm
var TIME_SLOTS = [];
for (var h = 6; h < 22; h++) {
  TIME_SLOTS.push(fmt2(h) + ':00');
  TIME_SLOTS.push(fmt2(h) + ':30');
}
function fmt2(n){ return n < 10 ? '0'+n : ''+n; }

var LEVELS = [
  {name:'Seedling 🌱', xp:0},
  {name:'Sprout 🌿', xp:100},
  {name:'Builder 🔨', xp:250},
  {name:'Mover ⚡', xp:500},
  {name:'Grinder 💪', xp:850},
  {name:'Champion 🏆', xp:1300},
  {name:'Legend 🌟', xp:2000},
];

var QUOTES = [
  "Every task you log is a vote for the person you're becoming.",
  "Small steps taken daily become giant leaps.",
  "You don't need motivation — you need a schedule.",
  "Done badly beats not started at all.",
  "Your free time is your biggest asset. Use it.",
  "Progress feels good. Keep the chain going.",
  "Show up for yourself like you show up for others.",
];

var ACHIEVEMENTS = [
  {id:'first',icon:'🌱',name:'First Step',desc:'Complete your first task',req:function(){return state.history.length>=1;}},
  {id:'streak3',icon:'🔥',name:'On Fire',desc:'3-task streak',req:function(){return state.streak>=3;}},
  {id:'xp100',icon:'⭐',name:'XP Hunter',desc:'Earn 100 XP',req:function(){return state.xp>=100;}},
  {id:'xp500',icon:'🏆',name:'Grinder',desc:'Earn 500 XP',req:function(){return state.xp>=500;}},
  {id:'sched5',icon:'📅',name:'Planner',desc:'Log 5 schedule slots',req:function(){return Object.keys(state.loggedSlots).length>=5;}},
  {id:'tasks10',icon:'✅',name:'Task Master',desc:'Complete 10 tasks',req:function(){return state.tasks.filter(function(t){return t.done;}).length>=10;}},
];

// ─── STORAGE ─────────────────────────────────────────────
function saveState(){
  try{ localStorage.setItem('dayflow_v2', JSON.stringify(state)); }catch(e){}
}
function loadState(){
  try{
    var raw = localStorage.getItem('dayflow_v2');
    if(raw){ var s = JSON.parse(raw); Object.assign(state, s); }
  }catch(e){}
}

// ─── LEVEL CALC ──────────────────────────────────────────
function getLevel(){
  var lv=0;
  for(var i=0;i<LEVELS.length;i++){ if(state.xp>=LEVELS[i].xp) lv=i; }
  return lv;
}
function getLevelProgress(){
  var lv=getLevel();
  var cur=LEVELS[lv].xp;
  var next=lv+1<LEVELS.length?LEVELS[lv+1].xp:LEVELS[lv].xp+500;
  var pct=Math.min(100,Math.round((state.xp-cur)/(next-cur)*100));
  return {lv:lv+1,name:LEVELS[lv].name,pct:pct,toNext:next-state.xp};
}

// ─── NAVIGATION ──────────────────────────────────────────
function goTo(page){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+page).classList.add('active');
  document.querySelector('[data-page="'+page+'"]').classList.add('active');
  if(page==='schedule') renderSchedule();
  if(page==='points') renderPoints();
  if(page==='home') renderHome();
  if(page==='tasks') renderTasks();
}

// ─── HOME ─────────────────────────────────────────────────
function renderHome(){
  var lp=getLevelProgress();
  document.getElementById('h-level').textContent=lp.lv;
  document.getElementById('h-rank').textContent=lp.name;
  document.getElementById('h-xp').textContent=state.xp;
  document.getElementById('h-xp-fill').style.width=lp.pct+'%';
  document.getElementById('h-streak').textContent=state.streak;

  var todayTasks=state.tasks.filter(function(t){return !t.done;});
  document.getElementById('h-tasks').textContent=todayTasks.length;

  var todayKey=TODAY_IDX;
  var todaySlots=Object.keys(state.schedule).filter(function(k){return k.startsWith(todayKey+'-');});
  var doneTodaySlots=todaySlots.filter(function(k){return state.loggedSlots[k];});
  document.getElementById('h-done').textContent=doneTodaySlots.length;

  // ring
  var total=todaySlots.length+todayTasks.length+(state.tasks.filter(function(t){return t.done;}).length);
  var done2=doneTodaySlots.length+(state.tasks.filter(function(t){return t.done;}).length);
  var pct2=total===0?0:Math.round(done2/total*100);
  document.getElementById('ring-pct').textContent=pct2+'%';
  var circ=314;
  document.getElementById('ring-arc').setAttribute('stroke-dashoffset',circ-(circ*pct2/100));

  // quote
  var qi=state.history.length%QUOTES.length;
  document.getElementById('home-quote').textContent=QUOTES[qi];

  // schedule preview
  var list=document.getElementById('home-schedule-list');
  list.innerHTML='';
  var shown=0;
  var now=new Date();
  var nowMins=now.getHours()*60+now.getMinutes();

  for(var si=0;si<TIME_SLOTS.length && shown<6;si++){
    var key=todayKey+'-'+si;
    if(!state.schedule[key]) continue;
    shown++;
    var slot=state.schedule[key];
    var logged=state.loggedSlots[key];
    var slotMins=parseInt(TIME_SLOTS[si].split(':')[0])*60+parseInt(TIME_SLOTS[si].split(':')[1]);
    var isActive=!logged && Math.abs(slotMins-nowMins)<30;
    var div=document.createElement('div');
    div.className='schedule-slot-mini'+(logged?' done-slot':'')+(isActive?' active-slot':'');
    div.innerHTML='<span class="slot-time">'+TIME_SLOTS[si]+'</span>'+
      '<span class="slot-name">'+escHtml(slot.name)+'</span>'+
      '<span class="slot-pts">+'+slot.pts+'xp</span>'+
      (!logged?'<span class="slot-check" onclick="quickLogHome(\''+key+'\')">⬜</span>':'<span style="font-size:16px;">✅</span>');
    list.appendChild(div);
  }
  if(shown===0){
    list.innerHTML='<div class="empty-state" style="padding:16px;"><div class="ei" style="font-size:28px;">📅</div><p style="font-size:13px;">No slots scheduled today. Go add some!</p></div>';
  }

  // notif bar
  if(Notification && Notification.permission==='default'){
    document.getElementById('notif-bar').style.display='flex';
  }
}

function quickLogHome(key){
  logSlot(key);
  renderHome();
}

// ─── SCHEDULE ────────────────────────────────────────────
function renderSchedule(){
  // day tabs
  var tabs=document.getElementById('day-tabs');
  tabs.innerHTML='';
  DAYS.forEach(function(d,i){
    var btn=document.createElement('button');
    btn.className='day-tab'+(i===state.selectedDay?' active':'');
    btn.textContent=d+(i===TODAY_IDX?' (today)':'');
    btn.onclick=function(){state.selectedDay=i;renderSchedule();};
    tabs.appendChild(btn);
  });

  var list=document.getElementById('schedule-list');
  list.innerHTML='';
  var day=state.selectedDay;

  TIME_SLOTS.forEach(function(time,si){
    var key=day+'-'+si;
    var slot=state.schedule[key];
    var logged=state.loggedSlots[key];

    var wrap=document.createElement('div');
    wrap.className='schedule-block';

    var timeCol=document.createElement('div');
    timeCol.className='time-col';
    timeCol.textContent=time;
    wrap.appendChild(timeCol);

    var card=document.createElement('div');
    card.className='slot-card'+(slot?' filled':'')+(logged?' done-card':'');

    if(slot){
      var catClass='badge-'+slot.cat;
      card.innerHTML='<div class="slot-card-name">'+escHtml(slot.name)+'</div>'+
        '<div class="slot-card-meta">'+
          '<span class="slot-cat-badge '+catClass+'">'+slot.cat+'</span>'+
          '<span class="slot-pts-badge">+'+slot.pts+' XP</span>'+
        '</div>';
      if(!logged){
        var logBtn=document.createElement('button');
        logBtn.className='slot-log-btn';
        logBtn.textContent='Log it ✓';
        logBtn.onclick=function(e){e.stopPropagation();logSlot(key);renderSchedule();renderHome();};
        card.appendChild(logBtn);
      } else {
        var badge=document.createElement('span');
        badge.className='slot-done-badge';
        badge.textContent='✅';
        card.appendChild(badge);
      }
      card.onclick=function(){ if(!logged) openModal(key,time); };
    } else {
      card.innerHTML='<div class="slot-empty-text">+ Add task</div>';
      card.onclick=function(){ openModal(key,time); };
    }

    wrap.appendChild(card);
    list.appendChild(wrap);
  });
}

function logSlot(key){
  if(state.loggedSlots[key]) return;
  var slot=state.schedule[key];
  if(!slot) return;
  state.loggedSlots[key]=true;
  state.xp+=slot.pts;
  state.streak++;
  state.history.unshift({type:'slot',text:'Logged: '+slot.name,pts:slot.pts,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(state.history.length>50) state.history.pop();
  saveState();
  showToast('🌿 +'+slot.pts+' XP logged!');
}

// ─── MODAL ───────────────────────────────────────────────
function openModal(key,time){
  state.editingSlot=key;
  var existing=state.schedule[key];
  document.getElementById('modal-title').textContent='Schedule ' + time;
  document.getElementById('modal-task-name').value=existing?existing.name:'';
  document.getElementById('modal-cat').value=existing?existing.cat:'work';
  document.getElementById('modal-pts').value=existing?existing.pts:'20';
  document.getElementById('slot-modal').classList.add('open');
  setTimeout(function(){document.getElementById('modal-task-name').focus();},400);
}

function closeModal(){
  document.getElementById('slot-modal').classList.remove('open');
  state.editingSlot=null;
}

function saveSlot(){
  var name=document.getElementById('modal-task-name').value.trim();
  if(!name) return;
  var key=state.editingSlot;
  state.schedule[key]={
    name:name,
    cat:document.getElementById('modal-cat').value,
    pts:parseInt(document.getElementById('modal-pts').value)
  };
  saveState();
  closeModal();
  renderSchedule();
  renderHome();
  showToast('📅 Slot saved!');
}

document.getElementById('slot-modal').addEventListener('click',function(e){
  if(e.target===this) closeModal();
});
document.getElementById('modal-task-name').addEventListener('keydown',function(e){
  if(e.key==='Enter') saveSlot();
});

// ─── TASKS ───────────────────────────────────────────────
function renderTasks(){
  var active=state.tasks.filter(function(t){return !t.done;});
  var done=state.tasks.filter(function(t){return t.done;});
  var list=document.getElementById('task-list');
  var empty=document.getElementById('task-empty');
  list.innerHTML='';

  if(active.length===0){
    empty.style.display='block';
  } else {
    empty.style.display='none';
    active.forEach(function(t){ list.appendChild(makeTaskEl(t,false)); });
  }

  document.getElementById('comp-count').textContent=done.length;
  var compList=document.getElementById('comp-list');
  compList.innerHTML='';
  done.slice().reverse().forEach(function(t){ compList.appendChild(makeTaskEl(t,true)); });
}

function makeTaskEl(t,isDone){
  var div=document.createElement('div');
  div.className='task-item'+(isDone?' done-task':'');
  div.innerHTML=
    '<div class="task-check" onclick="completeTask('+t.id+')">' +
      '<svg viewBox="0 0 12 12" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>' +
    '</div>'+
    '<span class="task-cat">'+t.cat+'</span>'+
    '<span class="task-text">'+escHtml(t.text)+'</span>'+
    '<span class="task-pts">+20 XP</span>'+
    '<button class="task-del" onclick="deleteTask('+t.id+')">✕</button>';
  return div;
}

function addTask(){
  var input=document.getElementById('task-input');
  var text=input.value.trim();
  if(!text) return;
  state.tasks.push({id:state.taskNextId++,text:text,cat:state.selectedTaskCat,done:false});
  input.value='';
  saveState();
  renderTasks();
  renderHome();
  input.focus();
}

function completeTask(id){
  var t=state.tasks.find(function(x){return x.id===id;});
  if(!t||t.done) return;
  var els=document.querySelectorAll('.task-item:not(.done-task)');
  els.forEach(function(el){
    if(el.innerHTML.indexOf('completeTask('+id+')')>-1) el.classList.add('completing');
  });
  state.xp+=20;
  state.streak++;
  t.done=true;
  state.history.unshift({type:'task',text:'Task: '+t.text,pts:20,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(state.history.length>50) state.history.pop();
  saveState();
  showToast('✅ +20 XP!');
  setTimeout(function(){ renderTasks(); renderHome(); },350);
}

function deleteTask(id){
  state.tasks=state.tasks.filter(function(t){return t.id!==id;});
  saveState();
  renderTasks();
  renderHome();
}

document.getElementById('task-add-btn').addEventListener('click',addTask);
document.getElementById('task-input').addEventListener('keydown',function(e){if(e.key==='Enter')addTask();});
document.querySelectorAll('.cat-pill').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.cat-pill').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    state.selectedTaskCat=btn.dataset.cat;
    document.getElementById('task-input').focus();
  });
});
document.getElementById('comp-toggle').addEventListener('click',function(){
  this.classList.toggle('open');
  document.getElementById('comp-list').classList.toggle('open');
});

// ─── POINTS ──────────────────────────────────────────────
function renderPoints(){
  var lp=getLevelProgress();
  document.getElementById('p-level-num').textContent=lp.lv;
  document.getElementById('p-rank-name').textContent=lp.name;
  document.getElementById('p-xp').textContent=state.xp;
  document.getElementById('p-lv-fill').style.width=lp.pct+'%';
  document.getElementById('p-xp-next').textContent=lp.toNext;

  // achievements
  var grid=document.getElementById('achieve-grid');
  grid.innerHTML='';
  ACHIEVEMENTS.forEach(function(a){
    var unlocked=a.req();
    var div=document.createElement('div');
    div.className='achieve'+(unlocked?'':' locked');
    div.innerHTML='<div class="achieve-icon">'+a.icon+'</div><div><div class="achieve-name">'+a.name+'</div><div class="achieve-desc">'+a.desc+'</div></div>';
    grid.appendChild(div);
  });

  // history
  var histList=document.getElementById('history-list');
  var histEmpty=document.getElementById('history-empty');
  histList.innerHTML='';
  if(state.history.length===0){
    histEmpty.style.display='block';
  } else {
    histEmpty.style.display='none';
    state.history.slice(0,15).forEach(function(h){
      var div=document.createElement('div');
      div.className='history-item';
      div.innerHTML='<span class="hist-icon">'+(h.type==='slot'?'📅':'✅')+'</span>'+
        '<span class="hist-text">'+escHtml(h.text)+'</span>'+
        '<span class="hist-time">'+h.time+'</span>'+
        '<span class="hist-pts">+'+h.pts+' XP</span>';
      histList.appendChild(div);
    });
  }
}

// ─── NOTIFICATIONS ───────────────────────────────────────
function requestNotifications(){
  if(!('Notification' in window)) return;
  Notification.requestPermission().then(function(perm){
    if(perm==='granted'){
      document.getElementById('notif-bar').style.display='none';
      scheduleNotifications();
      showToast('🔔 Notifications enabled!');
    }
  });
}

function scheduleNotifications(){
  if(Notification.permission!=='granted') return;
  var now=new Date();
  var todayDay=TODAY_IDX;
  TIME_SLOTS.forEach(function(time,si){
    var key=todayDay+'-'+si;
    var slot=state.schedule[key];
    if(!slot||state.loggedSlots[key]) return;
    var parts=time.split(':');
    var slotDate=new Date();
    slotDate.setHours(parseInt(parts[0]),parseInt(parts[1]),0,0);
    var ms=slotDate-now;
    if(ms>0 && ms<86400000){
      setTimeout(function(){
        new Notification('DayFlow ⏰',{body:'Time for: '+slot.name+' — log it for +'+slot.pts+' XP!',icon:'',tag:key});
      },ms);
    }
  });
}

// ─── TOAST ───────────────────────────────────────────────
var toastTimer;
function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove('show');},2500);
}

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── GREETING ────────────────────────────────────────────
function setGreeting(){
  var h=new Date().getHours();
  var g=h<12?'Good morning ☀️':h<17?'Good afternoon 🌤':h<21?'Good evening 🌙':'Hey night owl 🦉';
  document.querySelector('#page-home .page-eyebrow').textContent=g;
}

// ─── INIT ─────────────────────────────────────────────────
loadState();
state.selectedDay=TODAY_IDX;
setGreeting();
renderHome();
renderTasks();

// Seed sample schedule if empty
var hasSched=Object.keys(state.schedule).length>0;
if(!hasSched){
  var seedSlots=[
    [TODAY_IDX,4,'Morning workout','health',20],
    [TODAY_IDX,6,'Check emails','work',10],
    [TODAY_IDX,8,'3D print research','personal',35],
    [TODAY_IDX,12,'Lunch break walk','health',15],
    [TODAY_IDX,16,'Product design work','work',35],
  ];
  seedSlots.forEach(function(s){
    var key=s[0]+'-'+s[1];
    state.schedule[key]={name:s[2],cat:s[3],pts:s[4]};
  });
  saveState();
}

// Seed tasks if none
if(state.tasks.length===0){
  state.tasks=[
    {id:state.taskNextId++,text:'Review 3D print business ideas',cat:'💼',done:false},
    {id:state.taskNextId++,text:'Research a new product design',cat:'🎯',done:false},
    {id:state.taskNextId++,text:'Get outside for 20 minutes',cat:'🌿',done:false},
  ];
  saveState();
}

// Schedule notifications if already allowed
if(Notification && Notification.permission==='granted') scheduleNotifications();
