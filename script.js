const todayKey = () => new Date().toISOString().slice(0,10);
const fmt = (iso) => new Date(iso).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const dayFmt = (key) => new Date(key+'T00:00:00').toLocaleDateString(undefined,{dateStyle:'full'});

let data = JSON.parse(localStorage.getItem('taskflowDiaryData')) || { tasks: [], diaries: {}, moods: {}, theme: 'light' };
let currentView = 'today', activeFilter = 'all', deleteId = null;
const $ = id => document.getElementById(id);

const els = {
  navBtns: document.querySelectorAll('.nav-btn'), filterBtns: document.querySelectorAll('.filter-btn'),
  pageTitle:$('pageTitle'), currentDateText:$('currentDateText'), taskForm:$('taskForm'), taskList:$('taskList'), emptyTasks:$('emptyTasks'),
  searchInput:$('searchInput'), historySearch:$('historySearch'), diaryText:$('diaryText'), diarySaveStatus:$('diarySaveStatus'), moodSelect:$('moodSelect'),
  tasksSection:$('tasksSection'), diarySection:$('diarySection'), historySection:$('historySection'), toast:$('toast'),
  totalCount:$('totalCount'), completedCount:$('completedCount'), pendingCount:$('pendingCount'), progressPercent:$('progressPercent'), progressLabel:$('progressLabel'), progressBar:$('progressBar')
};

function save(){ localStorage.setItem('taskflowDiaryData', JSON.stringify(data)); }
function toast(msg){ els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),1800); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }

function init(){
  document.body.classList.toggle('dark', data.theme==='dark');
  $('themeToggle').textContent = data.theme==='dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  els.currentDateText.textContent = dayFmt(todayKey());
  data.diaries[todayKey()] ??= '';
  data.moods[todayKey()] ??= '😊 Productive';
  els.diaryText.value = data.diaries[todayKey()];
  els.moodSelect.value = data.moods[todayKey()];
  render();
}

function tasksForView(){
  const q = els.searchInput.value.toLowerCase().trim();
  let tasks = [...data.tasks];
  if(currentView==='today') tasks = tasks.filter(t=>t.date===todayKey());
  if(activeFilter==='pending') tasks = tasks.filter(t=>!t.completed);
  if(activeFilter==='completed') tasks = tasks.filter(t=>t.completed);
  if(activeFilter==='high') tasks = tasks.filter(t=>t.priority==='High');
  if(q) tasks = tasks.filter(t=>`${t.title} ${t.note} ${t.category} ${t.priority}`.toLowerCase().includes(q));
  return tasks.sort((a,b)=>(a.completed-b.completed) || (a.time||'99:99').localeCompare(b.time||'99:99') || b.createdAt.localeCompare(a.createdAt));
}

function renderStats(){
  const todayTasks = data.tasks.filter(t=>t.date===todayKey());
  const completed = todayTasks.filter(t=>t.completed).length;
  const total = todayTasks.length;
  const pct = total ? Math.round((completed/total)*100) : 0;
  els.totalCount.textContent = total;
  els.completedCount.textContent = completed;
  els.pendingCount.textContent = total-completed;
  els.progressPercent.textContent = pct+'%';
  els.progressLabel.textContent = pct+'%';
  els.progressBar.style.width = pct+'%';
}

function renderTasks(){
  const tasks = tasksForView();
  els.taskList.innerHTML = '';
  els.emptyTasks.classList.toggle('hidden', tasks.length>0);
  tasks.forEach(t=>{
    const card = document.createElement('article');
    card.className = 'task-card '+(t.completed?'completed':'');
    card.innerHTML = `
      <div class="task-top">
        <div class="task-title">
          <input type="checkbox" ${t.completed?'checked':''} data-action="toggle" data-id="${t.id}">
          <div>
            <h4>${escapeHtml(t.title)}</h4>
            ${t.note ? `<p class="task-note">${escapeHtml(t.note)}</p>` : ''}
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="icon-btn" data-action="delete" data-id="${t.id}">Delete</button>
        </div>
      </div>
      <div class="meta">
        <span class="badge">${escapeHtml(t.category)}</span>
        <span class="badge ${t.priority.toLowerCase()}">${t.priority}</span>
        ${t.time?`<span class="badge">⏰ ${t.time}</span>`:''}
        <span class="badge">Created: ${fmt(t.createdAt)}</span>
        ${t.updatedAt?`<span class="badge">Updated: ${fmt(t.updatedAt)}</span>`:''}
        ${t.completedAt?`<span class="badge">Completed: ${fmt(t.completedAt)}</span>`:''}
      </div>`;
    els.taskList.appendChild(card);
  });
}

function renderHistory(){
  const q = els.historySearch.value.toLowerCase().trim();
  const dates = [...new Set([...data.tasks.map(t=>t.date), ...Object.keys(data.diaries)])].sort().reverse();
  els.historyList.innerHTML='';
  dates.forEach(date=>{
    const tasks = data.tasks.filter(t=>t.date===date);
    const diary = data.diaries[date] || '';
    const mood = data.moods[date] || 'No mood';
    const hay = `${date} ${diary} ${mood} ${tasks.map(t=>t.title+' '+t.note).join(' ')}`.toLowerCase();
    if(q && !hay.includes(q)) return;
    const done = tasks.filter(t=>t.completed).length;
    const card = document.createElement('div');
    card.className='history-card';
    card.innerHTML=`<h4>${dayFmt(date)}</h4><p><b>Mood:</b> ${mood}</p><p><b>Diary:</b> ${escapeHtml(diary || 'No diary written.')}</p><p><b>Tasks:</b> ${done}/${tasks.length} completed</p><ul class="history-tasks">${tasks.map(t=>`<li>${t.completed?'✅':'⬜'} ${escapeHtml(t.title)}</li>`).join('') || '<li>No tasks</li>'}</ul>`;
    els.historyList.appendChild(card);
  });
  if(!els.historyList.children.length) els.historyList.innerHTML='<div class="empty-state">No history found.</div>';
}

function render(){
  els.pageTitle.textContent = currentView==='today'?'Today\'s Plan':currentView==='all'?'All Tasks':currentView==='diary'?'Daily Diary':'History';
  els.tasksSection.classList.toggle('hidden', !['today','all'].includes(currentView));
  els.diarySection.classList.toggle('hidden', currentView!=='diary');
  els.historySection.classList.toggle('hidden', currentView!=='history');
  renderStats(); renderTasks(); renderHistory(); save();
}

els.taskForm.addEventListener('submit', e=>{
  e.preventDefault();
  const title=$('taskTitle').value.trim(); if(!title) return;
  data.tasks.push({id:uid(),title,time:$('taskTime').value,category:$('taskCategory').value,priority:$('taskPriority').value,note:$('taskNote').value.trim(),completed:false,date:todayKey(),createdAt:new Date().toISOString(),updatedAt:null,completedAt:null});
  els.taskForm.reset(); $('taskCategory').value='Work'; $('taskPriority').value='Low';
  toast('Task added'); render();
});

els.taskList.addEventListener('click', e=>{
  const action=e.target.dataset.action, id=e.target.dataset.id; if(!action) return;
  const task=data.tasks.find(t=>t.id===id); if(!task) return;
  if(action==='toggle') { task.completed=e.target.checked; task.completedAt=task.completed?new Date().toISOString():null; task.updatedAt=new Date().toISOString(); toast(task.completed?'Task completed 🎉':'Task reopened'); render(); }
  if(action==='edit') editTask(task);
  if(action==='delete') { deleteId=id; $('confirmModal').classList.remove('hidden'); }
});

function editTask(task){
  const title=prompt('Edit task title:', task.title); if(title===null) return;
  const note=prompt('Edit task note:', task.note || '');
  task.title=title.trim() || task.title; task.note=(note ?? task.note).trim(); task.updatedAt=new Date().toISOString(); toast('Task updated'); render();
}

$('confirmDelete').onclick=()=>{ data.tasks=data.tasks.filter(t=>t.id!==deleteId); deleteId=null; $('confirmModal').classList.add('hidden'); toast('Task deleted'); render(); };
$('cancelDelete').onclick=()=> $('confirmModal').classList.add('hidden');

els.navBtns.forEach(btn=>btn.onclick=()=>{ els.navBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); currentView=btn.dataset.view; render(); });
els.filterBtns.forEach(btn=>btn.onclick=()=>{ els.filterBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); activeFilter=btn.dataset.filter; render(); });
els.searchInput.oninput=render; els.historySearch.oninput=render;
els.diaryText.addEventListener('input',()=>{ data.diaries[todayKey()]=els.diaryText.value; els.diarySaveStatus.textContent='Saving...'; save(); setTimeout(()=>els.diarySaveStatus.textContent='Saved',500); renderHistory(); });
els.moodSelect.onchange=()=>{ data.moods[todayKey()]=els.moodSelect.value; toast('Mood saved'); render(); };
$('themeToggle').onclick=()=>{ data.theme=data.theme==='dark'?'light':'dark'; init(); save(); };
$('newDayBtn').onclick=()=>{ const pending=data.tasks.filter(t=>t.date!==todayKey()&&!t.completed); pending.forEach(t=>{t.date=todayKey(); t.updatedAt=new Date().toISOString();}); toast(pending.length?`${pending.length} old pending tasks moved to today`:'You are already up to date'); render(); };

function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
init();
