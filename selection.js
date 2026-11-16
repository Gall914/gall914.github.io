// RetroMesh — Выделение и удаление сообщений
// ════════════════════════════════════════
//  ВЫДЕЛЕНИЕ И УДАЛЕНИЕ СООБЩЕНИЙ
// ════════════════════════════════════════
let selectedMsgs = new Set(); // Set of message IDs
let selectMode   = false;

function enterSelectMode(){
  selectMode = true;
  $('del-toolbar').classList.add('show');
  updateDelCount();
}

function cancelSelect(){
  selectMode = false;
  selectedMsgs.clear();
  $('del-toolbar').classList.remove('show');
  // Снять выделение со всех
  document.querySelectorAll('.mg.selected').forEach(el=>el.classList.remove('selected'));
}

function updateDelCount(){
  $('del-count').textContent = selectedMsgs.size+' выбрано';
}

function toggleMsgSelect(msgId, el){
  if(!selectMode) enterSelectMode();
  if(selectedMsgs.has(msgId)){
    selectedMsgs.delete(msgId);
    el.classList.remove('selected');
  } else {
    selectedMsgs.add(msgId);
    el.classList.add('selected');
  }
  updateDelCount();
  // Если всё снято — выходим из режима выделения
  if(selectedMsgs.size===0) cancelSelect();
}

function deleteSelected(){
  if(selectedMsgs.size===0) return;
  const ch=CUR_CH;
  const ids=[...selectedMsgs];
  cancelSelect();
  // Удаляем из DOM и кеша
  msgCache[ch]=(msgCache[ch]||[]).filter(m=>!ids.includes(m.id));
  ids.forEach(id=>{
    const el=document.querySelector(`.mg[data-id="${id}"]`);
    if(el) el.remove();
    db.ref('chats/'+ch+'/msgs/'+id).remove().catch(()=>{});
  });
  toast('🗑 Удалено: '+ids.length, 1500);
}

