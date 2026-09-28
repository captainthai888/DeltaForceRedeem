const $ = id => document.getElementById(id);
let snapshot, initialized = false, logSignature = '';
async function send(type,fields={}) {
  const reply = await chrome.runtime.sendMessage({type,...fields});
  if (!reply?.ok) throw new Error(reply?.error || 'Không kết nối được trình chạy.');
  return reply;
}
async function refresh() {
  try {
    const data = await send('state'); snapshot = data.state;
    const s = snapshot;
    if (!initialized) { $('codes').value = s.draft; $('delay').value = s.delay; initialized = true; }
    $('connection').textContent = data.connected ? '● CÓ PHIÊN' : 'CHƯA KẾT NỐI';
    $('connection').classList.toggle('online',data.connected);
    $('account').textContent = data.connected ? 'Tài khoản · …' + data.account.slice(-6) : 'Đăng nhập Garena để bắt đầu';
    const busy = s.status === 'running' || s.status === 'paused' || !!s.inflight;
    $('codes').disabled = busy; $('delay').disabled = busy;
    $('start').disabled = busy || !data.connected;
    $('pause').disabled = !['running','paused'].includes(s.status) || (s.status === 'paused' && !!s.inflight);
    $('pause').textContent = s.status === 'paused' ? '▶ Tiếp tục' : 'Ⅱ Tạm dừng';
    $('stop').disabled = !busy;
    $('total').textContent = s.total || 0; $('processed').textContent = s.results.length;
    $('success').textContent = s.results.filter(r => r.kind === 'success').length;
    $('failed').textContent = s.results.filter(r => r.kind === 'error').length;
    const percent = s.total ? Math.round(s.results.length/s.total*100) : 0;
    $('percent').textContent = percent + '%'; $('progress').value = percent;
    $('status').textContent = {idle:'Sẵn sàng',running:'Đang chạy',paused:'Tạm dừng',stopped:'Đã dừng',done:'Hoàn tất'}[s.status];
    const unknown = s.results.filter(r => r.kind === 'unknown').length;
    $('details').textContent = `Bỏ qua: ${s.skipped || 0} · Chưa rõ kết quả: ${unknown} · Còn chờ: ${s.queue.length}`;
    const signature = JSON.stringify(s.logs);
    if (signature !== logSignature) {
      logSignature = signature; $('logs').replaceChildren();
      for (const item of s.logs) {
        const row = document.createElement('div'); row.className = 'entry ' + item.kind;
        const time = document.createElement('span'); time.className = 'time'; time.textContent = '[' + new Date(item.time).toLocaleTimeString('vi-VN') + '] ';
        row.append(time,document.createTextNode(item.message)); $('logs').append(row);
      }
      if (!s.logs.length) $('logs').textContent = 'Chưa có hoạt động. Nhập danh sách mã để bắt đầu.';
      $('logs').scrollTop = $('logs').scrollHeight;
    }
  } catch(e) { $('error').textContent = e.message; }
}
for (const id of ['start','pause','stop','open','clearLog']) $(id).addEventListener('click',async () => {
  $('error').textContent = '';
  try { await send(id === 'pause' && snapshot?.status === 'paused' ? 'resume' : id,{text:$('codes').value,delay:Number($('delay').value)}); await refresh(); }
  catch(e) { $('error').textContent = e.message; }
});
$('delay').addEventListener('input',() => $('delayValue').textContent = Number($('delay').value)/1000 + 's');
$('codes').addEventListener('input',() => { send('draft',{text:$('codes').value}).catch(e => $('error').textContent = e.message); });
await refresh(); $('delayValue').textContent = Number($('delay').value)/1000 + 's';
setInterval(refresh,1000);
