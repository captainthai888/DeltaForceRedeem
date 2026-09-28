// MD5 for the public request-signing protocol used by the redemption website.
export function md5(text) {
  const input = new TextEncoder().encode(text);
  const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input); bytes[input.length] = 128;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 8, input.length * 8, true);
  view.setUint32(bytes.length - 4, Math.floor(input.length / 536870912), true);
  let state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const shifts = [[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    let [a,b,c,d] = state;
    for (let i = 0; i < 64; i++) {
      const round = i >> 4;
      const f = round === 0 ? (b & c) | (~b & d) : round === 1 ? (d & b) | (~d & c) : round === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const g = round === 0 ? i : round === 1 ? (5*i+1)%16 : round === 2 ? (3*i+5)%16 : (7*i)%16;
      const sum = (a + f + Math.floor(Math.abs(Math.sin(i+1))*4294967296) + view.getUint32(offset+g*4,true)) | 0;
      const shift = shifts[round][i%4];
      [a,b,c,d] = [d, (b + ((sum << shift) | (sum >>> (32-shift)))) | 0, b, c];
    }
    state = state.map((v,i) => (v + [a,b,c,d][i]) | 0);
  }
  return state.map(v => [0,8,16,24].map(s => ((v >>> s)&255).toString(16).padStart(2,'0')).join('')).join('');
}
export function parseCodes(text) {
  // Gift-code lists often contain a visual marker such as "(*)" after a code.
  // Remove that marker before splitting/validating so it never becomes a code
  // token and never causes the character validation to fail.
  const cleaned = String(text || '').replace(/\(\*\)/g, ' ');
  const all = cleaned.trim().split(/\s+/).filter(Boolean);
  if (all.length > 2000) throw new Error('Tối đa 2.000 mã mỗi lượt.');
  if (all.some(code => !/^[A-Za-z0-9_-]{1,128}$/.test(code))) throw new Error('Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới; ngăn cách bằng khoảng trắng.');
  return [...new Set(all)];
}
export function buildRequest(code, user, uuid = crypto.randomUUID(), ts = Math.round(Date.now()/1000)) {
  const params = new URLSearchParams({cdkey:code,channel:'10',game_id:'30150',gameid:'30150',openid:String(user.openid),token:user.token,account_type:'1',lang_type:'vi',u:uuid,a:'10005',ts:String(ts)});
  const path = '/api/proxy/present/CdkV2/RedeemCDKey?' + params;
  return {url:'https://sg-act.playerinfinite.com' + path + '&s=' + md5(decodeURI(path) + '&appkey=intel#!2022$act'), body:{lang_type:'vi',role_info:{game_id:'30150'},cdkey:code}};
}
export function describe(result) {
  if (result.code === 0) return 'Kích hoạt thành công';
  if (result.code === 400068) return 'Mã đã đạt giới hạn lượt đổi';
  if (result.code === 300001) return 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.';
  return String(result.msg || 'API trả về lỗi').slice(0,400);
}
