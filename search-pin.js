// RetroMesh — Поиск по чату и закреп
// ════════════════════════════════════════
//  SEARCH IN CHAT
// ════════════════════════════════════════
let searchResults=[], searchIdx=0;

function toggleSearchBar(){
  const bar=$('search-bar');
  if(bar.classList.contains('show')){ closeSearchBar(); return; }
  bar.classList.add('show');
  setTimeout(()=>$('search-inp').focus(),100);
}

function closeSearchBar(){
  $('search-bar').classList.remove('show');
  $('search-inp').value='';
  clearSearchHighlight();
  searchResults=[]; searchIdx=0;
  $('search-count').textContent='';
}

function doSearch(q){
  clearSearchHighlight();
  searchResults=[]; searchIdx=0;
  if(!q.trim()){ $('search-count').textContent=''; return; }
  const lq=q.toLowerCase();
  document.querySelectorAll('.mg').forEach(el=>{
    const bub=el.querySelector('.bub');
    if(bub&&bub.textContent.toLowerCase().includes(lq)){
      el.classList.add('msg-highlight');
      searchResults.push(el);
    }
  });
  $('search-count').textContent=searchResults.length?`${searchResults.length} совп.`:'Не найдено';
  if(searchResults.length){ scrollToSearchResult(0); }
}

function scrollToSearchResult(idx){
  if(!searchResults.length) return;
  searchIdx=((idx%searchResults.length)+searchResults.length)%searchResults.length;
  searchResults[searchIdx].scrollIntoView({behavior:'smooth',block:'center'});
  $('search-count').textContent=`${searchIdx+1}/${searchResults.length}`;
}

function clearSearchHighlight(){
  document.querySelectorAll('.msg-highlight').forEach(el=>el.classList.remove('msg-highlight'));
}

$('search-inp').addEventListener('keydown',e=>{
  if(e.key==='Enter'){ e.shiftKey?scrollToSearchResult(searchIdx-1):scrollToSearchResult(searchIdx+1); }
});

// ════════════════════════════════════════
//  PIN MESSAGE (только в группах)
// ════════════════════════════════════════
let pinnedMsgId='', pinnedListenerGid='';

function pinMessage(msgId){
  if(!CUR_GRP) return;
  const msg=(msgCache[CUR_GRP]||[]).find(m=>m.id===msgId);
  if(!msg) return;
  db.ref('groups/'+CUR_GRP+'/pinned').set({id:msgId, text:msg.text||'[медиа]', from:msg.from});
  toast('📌 Сообщение закреплено',1500);
}

function listenPinned(gid){
  if(pinnedListenerGid && pinnedListenerGid!==gid){
    db.ref('groups/'+pinnedListenerGid+'/pinned').off();
  }
  pinnedListenerGid=gid;
  hidePinnedBar();
  db.ref('groups/'+gid+'/pinned').on('value', snap=>{
    const d=snap.val();
    if(d){ showPinnedBar(d); pinnedMsgId=d.id; }
    else { hidePinnedBar(); pinnedMsgId=''; }
  });
}

function showPinnedBar(d){
  $('pin-text').textContent=`@${d.from}: ${d.text}`;
  $('pinned-bar').classList.add('show');
}
function hidePinnedBar(){ $('pinned-bar').classList.remove('show'); }
function dismissPinned(){
  if(!CUR_GRP) return;
  db.ref('groups/'+CUR_GRP+'/pinned').remove();
}
function scrollToPinned(){
  if(pinnedMsgId) scrollToMsg(pinnedMsgId);
}

