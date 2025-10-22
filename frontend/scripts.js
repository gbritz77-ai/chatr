// ---- Sample data (matches your expected screenshot) ----
const contacts = [
  { id: 1, name: 'Sarah Johnson', status: 'online', avatar: 'SJ', color: 'bg-purple-500', lastMessage: 'Hey! How are you doing?', time: '2 min ago', unread: 2 },
  { id: 2, name: 'Mike Chen',    status: 'away',   avatar: 'MC', color: 'bg-blue-500',   lastMessage: "Let's schedule that meeting", time: '15 min ago', unread: 0 },
  { id: 3, name: 'Emily Davis',  status: 'online', avatar: 'ED', color: 'bg-green-500',  lastMessage: 'Thanks for the help!', time: '1 hour ago', unread: 1 },
];

const groups = [
  { id: 101, name: 'Design Team',  members: ['Sarah Johnson','Emily Davis','You'], avatar: '🎨', color: 'bg-pink-500',   lastMessage: 'New mockups are ready!', time: '5 min ago',  unread: 3 },
  { id: 102, name: 'Project Alpha',members: ['Mike','Alex','Lisa','You'],          avatar: '🚀', color: 'bg-indigo-500', lastMessage: 'Meeting at 3 PM',       time: '30 min ago', unread: 1 },
];

const thread = {
  1: [{id:1, sender:'Sarah Johnson', content:'Hey! How are you doing?', time:'10:30', date:'Today', isOwn:false}],
  101:[{id:1, sender:'Sarah Johnson', content:'I’ve uploaded the new mockups', time:'14:15', date:'Today', isOwn:false}],
};

let activeId = null;
let activeIsGroup = false;

// ---- Helpers ----
const $ = sel => document.querySelector(sel);
const el = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstChild;
};

// ---- Render sidebar lists ----
function renderGroups() {
  const wrap = $('#groupsList');
  wrap.innerHTML = groups.map(g => {
    const badge = g.unread ? `<div class="w-5 h-5 bg-blue-600 text-white text-xs rounded-full grid place-items-center">${g.unread}</div>` : '';
    return `
      <div class="item ${activeId===g.id ? 'item-selected' : ''}" data-id="${g.id}" data-type="group">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 ${g.color} rounded-full grid place-items-center text-white text-lg">${g.avatar}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <p class="font-medium truncate">${g.name}</p>
              <span class="text-xs text-slate-500">${g.time}</span>
            </div>
            <p class="text-sm text-slate-600 truncate">${g.lastMessage}</p>
            <p class="text-[11px] text-slate-500">${g.members.length} members</p>
          </div>
          ${badge}
        </div>
      </div>
    `;
  }).join('');
}

function renderRecent() {
  const wrap = $('#recentList');
  wrap.innerHTML = contacts.map(c => {
    const status = c.status==='online' ? 'bg-emerald-400' : c.status==='away' ? 'bg-amber-400' : 'bg-slate-400';
    const badge  = c.unread ? `<div class="w-5 h-5 bg-blue-600 text-white text-xs rounded-full grid place-items-center">${c.unread}</div>` : '';
    return `
      <div class="item ${activeId===c.id ? 'item-selected' : ''}" data-id="${c.id}" data-type="contact">
        <div class="flex items-center gap-3">
          <div class="relative">
            <div class="w-12 h-12 ${c.color} rounded-full grid place-items-center text-white font-semibold">${c.avatar}</div>
            <span class="status-dot ${status}"></span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <p class="font-medium truncate">${c.name}</p>
              <span class="text-xs text-slate-500">${c.time}</span>
            </div>
            <p class="text-sm text-slate-600 truncate">${c.lastMessage}</p>
          </div>
          ${badge}
        </div>
      </div>
    `;
  }).join('');
}

function renderConnections() {
  const wrap = $('#allConnections');
  wrap.innerHTML = contacts.map(c => {
    const status = c.status==='online' ? 'bg-emerald-400' : c.status==='away' ? 'bg-amber-400' : 'bg-slate-400';
    return `
      <div class="item" data-id="${c.id}" data-type="contact">
        <div class="flex items-center gap-3">
          <div class="relative">
            <div class="w-10 h-10 ${c.color} rounded-full grid place-items-center text-white font-semibold">${c.avatar}</div>
            <span class="status-dot ${status}"></span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <p class="font-medium truncate">${c.name}</p>
              <span class="text-xs text-slate-500 capitalize">${c.status}</span>
            </div>
            <p class="text-sm text-slate-500">Available for chat</p>
          </div>
          <button class="px-3 py-1 text-xs rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  data-action="start-chat" data-id="${c.id}">Chat</button>
        </div>
      </div>
    `;
  }).join('');
}

// ---- Main thread view ----
function openThread(id, isGroup=false) {
  activeId = id; activeIsGroup = isGroup;

  // header
  $('#welcome').classList.add('hidden');
  $('#chatArea').classList.remove('hidden');
  $('#chatHeader').classList.remove('hidden');

  let item = isGroup ? groups.find(g=>g.id===id) : contacts.find(c=>c.id===id);
  $('#activeAvatar').className = `w-10 h-10 ${item.color} rounded-full grid place-items-center text-white font-semibold`;
  $('#activeAvatar').textContent = item.avatar;
  $('#activeName').textContent = item.name;
  if(isGroup){
    $('#activeSub').textContent = `${item.members.length} members`;
    $('#activeStatus').className = 'status-dot bg-blue-400 border-white';
  }else{
    const s = item.status==='online' ? 'bg-emerald-400' : item.status==='away' ? 'bg-amber-400' : 'bg-slate-400';
    $('#activeSub').textContent = item.status[0].toUpperCase()+item.status.slice(1);
    $('#activeStatus').className = `status-dot ${s} border-white`;
  }

  // lists refresh (selection highlight)
  renderGroups(); renderRecent(); renderConnections();

  // messages
  const wrap = $('#messages');
  const list = thread[id] || [];
  wrap.innerHTML = list.map(m => {
    const mine = m.isOwn ? 'justify-end' : 'justify-start';
    const bubble = m.isOwn
      ? 'bg-blue-600 text-white'
      : 'bg-white border border-slate-200';
    return `
      <div class="flex ${mine}">
        <div class="${bubble} max-w-[36rem] px-4 py-2 rounded-lg">
          <p class="text-sm">${m.content}</p>
          <div class="mt-1 text-[11px] ${m.isOwn?'text-blue-100':'text-slate-500'} flex justify-between">
            <span>${m.date||''}</span><span>${m.time}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

// ---- Events ----
function wireEvents() {
  // Tab switching
  $('#tab-chats').addEventListener('click', () => {
    $('#tab-chats').className='tab-active';
    $('#tab-connections').className='tab-idle';
    $('#chatsList').classList.remove('hidden');
    $('#connectionsList').classList.add('hidden');
    $('#searchInput').placeholder = 'Search chats...';
  });
  $('#tab-connections').addEventListener('click', () => {
    $('#tab-chats').className='tab-idle';
    $('#tab-connections').className='tab-active';
    $('#chatsList').classList.add('hidden');
    $('#connectionsList').classList.remove('hidden');
    $('#searchInput').placeholder = 'Search connections...';
  });

  // Sidebar clicks
  document.addEventListener('click', (e) => {
    const startBtn = e.target.closest('[data-action="start-chat"]');
    if (startBtn) {
      openThread(parseInt(startBtn.dataset.id), false);
      $('#tab-chats').click();
      return;
    }
    const item = e.target.closest('.item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    const isGroup = item.dataset.type === 'group';
    openThread(id, isGroup);
  });

  // Send message
  $('#messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('#messageInput');
    const text = t.value.trim();
    if (!text || !activeId) return;

    if (!thread[activeId]) thread[activeId] = [];
    thread[activeId].push({
      id: Date.now(),
      sender:'You',
      content: text,
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      date:'Today', isOwn:true
    });
    t.value=''; t.style.height='auto';
    openThread(activeId, activeIsGroup); // re-render
  });

  // Autosize textarea
  $('#messageInput').addEventListener('input', (e)=>{
    e.target.style.height='auto';
    e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';
  });

  // Search filter
  $('#searchInput').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#groupsList .item, #recentList .item, #allConnections .item')
      .forEach(n=>{
        const name = n.querySelector('.font-medium').textContent.toLowerCase();
        n.style.display = name.includes(q) ? '' : 'none';
      });
  });
}

// ---- Bootstrap ----
function init() {
  renderGroups(); renderRecent(); renderConnections();
  wireEvents();
}
init();
