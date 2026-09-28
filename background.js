import {parseCodes, buildRequest, describe} from './core.js';
const SITE = 'https://redeem.df.garena.sg/';
let state, history, working = false;
let serial = Promise.resolve();
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const saved = await chrome.storage.local.get(['state','history']);
  history = saved.history || {};
  state = saved.state || {status:'idle', queue:[], results:[], logs:[], delay:1500, account:'', draft:''};
  if (state.status === 'running' || state.inflight) {
    state.status = 'paused';
    if (state.inflight) {
      state.results.push({code:state.inflight,kind:'unknown',message:'Bị gián đoạn; chưa xác định kết quả. Không gửi lại.'});
      state.inflight = null;
    }
    log('Trình chạy đã khởi động lại. Kiểm tra rồi nhấn Tiếp tục.');
    await save();
  }
})();
function log(message, kind='info') { state.logs.push({time:Date.now(),message,kind}); state.logs = state.logs.slice(-500); }
function save() { return chrome.storage.local.set({state,history}); }
async function session() {
  const tabs = await chrome.tabs.query({url:SITE+'*'});
  const tab = tabs.find(t => t.active) || tabs[0];
  if (!tab) throw new Error('Mở trang đổi quà và đăng nhập Garena trước.');
  const cookie = await chrome.cookies.get({url:tab.url,name:'user_info'});
  let user;
  try { user = JSON.parse(decodeURIComponent(cookie?.value || '')); } catch { throw new Error('Chưa có phiên Garena hợp lệ. Hãy đăng nhập trên trang đổi quà.'); }
  if (!user.openid || !user.token) throw new Error('Phiên đăng nhập không hợp lệ.');
  return {tab,user};
}
async function redeemInPage(url, body) {
  if (location.origin !== 'https://redeem.df.garena.sg') return {transport:true};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body),signal:controller.signal});
    if (!res.ok) return {transport:true,http:res.status};
    const data = await res.json();
    if (typeof data.code !== 'number') return {transport:true};
    return {code:data.code,msg:String(data.msg || '').slice(0,400)};
  } catch { return {transport:true}; } finally { clearTimeout(timer); }
}
async function run() {
  if (working) return;
  working = true;
  try {
    while (state.status === 'running' && state.queue.length) {
      const {tab,user} = await session();
      if (String(user.openid) !== state.account) throw new Error('Tài khoản đã thay đổi. Hãy dừng và tạo lượt mới.');
      if (state.status !== 'running') break;
      const code = state.queue.shift();
      const key = state.account + ':' + code;
      if (Object.hasOwn(history,key)) continue;
      history[key] = {time:Date.now(),kind:'unknown'};
      state.inflight = code;
      log('Đang đổi: ' + code);
      // Persist before sending: never replay an ambiguous request after a crash.
      await save();
      let result;
      try {
        const request = buildRequest(code,user);
        const replies = await chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:redeemInPage,args:[request.url,request.body]});
        result = replies[0]?.result || {transport:true};
      } catch { result = {transport:true}; }
      const kind = result.transport ? 'unknown' : result.code === 0 ? 'success' : 'error';
      const message = result.transport ? 'Chưa xác định kết quả (mạng/tab/HTTP). Không tự gửi lại.' : describe(result);
      state.results.push({code,kind,message,apiCode:result.code});
      history[key] = {time:Date.now(),kind,apiCode:result.code};
      state.inflight = null;
      log(code + ': ' + message + (result.code === undefined ? '' : ` [${result.code}]`),kind);
      if (result.transport || result.code === 300001) {
        if (state.status === 'running') state.status = 'paused';
        log('Đã tạm dừng để kiểm tra kết nối hoặc đăng nhập.','error');
      }
      await save();
      if (state.status === 'running' && state.queue.length) await new Promise(resolve => setTimeout(resolve,state.delay));
    }
    if (state.status === 'running') { state.status = 'done'; log('Đã xử lý hết danh sách.'); }
  } catch (error) { state.status = 'paused'; log(error.message,'error'); }
  finally { working = false; await save(); }
}
async function handle(msg) {
  await ready;
  if (msg.type === 'state') {
    let connected = false, account = '';
    try { const s = await session(); connected = true; account = String(s.user.openid); } catch {}
    return {state,connected,account};
  }
  if (msg.type === 'open') { await chrome.tabs.create({url:SITE}); return {}; }
  if (msg.type === 'draft') { state.draft = String(msg.text || '').slice(0,260000); await save(); return {}; }
  if (msg.type === 'start') {
    if (working || state.status === 'paused') throw new Error('Dừng lượt hiện tại trước khi tạo lượt mới.');
    const codes = parseCodes(msg.text);
    if (!codes.length) throw new Error('Hãy nhập ít nhất một gift code.');
    const {user} = await session();
    const account = String(user.openid);
    const queue = codes.filter(c => !Object.hasOwn(history,account+':'+c));
    state = {...state,status:'running',account,queue,results:[],inflight:null,total:queue.length,skipped:codes.length-queue.length,delay:Math.min(10000,Math.max(1000,Number(msg.delay)||1500)),draft:msg.text};
    log(`Bắt đầu ${queue.length} mã; bỏ qua ${state.skipped} mã đã gửi.`);
    await save(); void run(); return {};
  }
  if (msg.type === 'pause' && state.status === 'running') state.status = 'paused';
  if (msg.type === 'stop') { state.status = 'stopped'; state.queue = []; log('Đã dừng. Yêu cầu đang gửi (nếu có) vẫn được ghi nhận.'); }
  if (msg.type === 'resume' && state.status === 'paused') {
    if (working) throw new Error('Đợi yêu cầu đang gửi hoàn tất rồi tiếp tục.');
    state.status = 'running'; await save(); void run(); return {};
  }
  if (msg.type === 'clearLog') state.logs = [];
  await save(); return {};
}
chrome.runtime.onMessage.addListener((msg,sender,respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  serial = serial.then(() => handle(msg)).then(data => respond({ok:true,...data}),error => respond({ok:false,error:error.message}));
  return true;
});
