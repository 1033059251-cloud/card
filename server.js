#!/usr/bin/env node
/* 塔罗牌极简代理：托管 card_phone.html + 代理 DeepSeek 解牌
   用法：DEEPSEEK_API_KEY=sk-xxx node server.js   （默认端口 3000）
   GET  /            → card_phone.html
   POST /api/read    → { question, cards } → { content }   */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const zlib  = require('zlib');

const PORT  = process.env.PORT || 3000;
const KEY   = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const HTML = fs.readFileSync(path.join(__dirname, 'card_phone.html'));

/* —— 预压缩 HTML，命中 Accept-Encoding 时直接返回，省去逐次压缩 —— */
const HTML_GZIP   = zlib.gzipSync(HTML);
const HTML_BROTLI = zlib.brotliCompressSync(HTML);

/* —— 静态资源（牌面 atlas + 全息纹理）—— */
const STATIC_TYPES = {
  '.webp': 'image/webp',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8'
};

function serveStatic(req, res, urlPath){
  const rel = decodeURIComponent(urlPath.replace(/^\/+/, ''));
  const file = path.join(__dirname, rel);
  if (!file.startsWith(__dirname)) return false;   // 防目录穿越
  let stat;
  try { stat = fs.statSync(file); } catch(e){ return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const type = STATIC_TYPES[ext] || 'application/octet-stream';
  const cache = (ext === '.webp' || ext === '.png' || ext === '.jpg')
    ? 'public, max-age=31536000, immutable'   // 图片文件名固定，可长期缓存
    : 'no-cache';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': cache
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

function buildPrompt(b){
  const q = (b.question || '').trim();
  const lines = (b.cards || []).map(c => `${c.pos}：${c.zh}（${c.en}）—— ${c.meaning}`);
  return '用户的问题：' + (q || '未说明') + '\n'
    + '抽到的三张牌（过去 · 现在 · 未来）：\n' + lines.join('\n') + '\n'
    + '请以资深塔罗师的身份，结合用户的问题，对这三张牌做整体解读：'
    + '点出牌与问题的关联、牌与牌之间的呼应，并给出一条温和的行动建议。'
    + '使用简体中文，控制在 200 字以内。';
}

function callDeepSeek(b){
  return new Promise((resolve, reject)=>{
    const payload = JSON.stringify({
      model: MODEL,
      messages: [
        { role:'system', content:'你是一位温柔、有洞察力的塔罗解读师。' },
        { role:'user',   content: buildPrompt(b) }
      ],
      temperature: 0.9,
      stream: false
    });
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res=>{
      let data = '';
      res.on('data', c => data += c);
      res.on('end', ()=>{
        try{
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'DeepSeek API error'));
          const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (!content) return reject(new Error('empty completion'));
          resolve(content);
        }catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer((req,res)=>{
  const cors = {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type'
  };
  if (req.method === 'OPTIONS'){ res.writeHead(204, cors); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/read'){
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async ()=>{
      try{
        if (!KEY) throw new Error('服务端未配置 DEEPSEEK_API_KEY');
        const b = JSON.parse(body || '{}');
        const content = await callDeepSeek(b);
        res.writeHead(200, Object.assign({'Content-Type':'application/json; charset=utf-8'}, cors));
        res.end(JSON.stringify({ content }));
      }catch(e){
        res.writeHead(500, Object.assign({'Content-Type':'application/json; charset=utf-8'}, cors));
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET'){
    const urlPath = (req.url || '/').split('?')[0];

    // 静态资源：assets/ 与 textures/ 下的牌面 atlas、全息纹理等
    if (urlPath.startsWith('/assets/') || urlPath.startsWith('/textures/')){
      if (serveStatic(req, res, urlPath)) return;
    }

    if (urlPath === '/' || urlPath === '/card_phone.html' || urlPath === '/index.html'){
      const accept = (req.headers['accept-encoding'] || '').toLowerCase();
      let body = HTML, enc = '';
      if (accept.includes('br'))      { body = HTML_BROTLI; enc = 'br'; }
      else if (accept.includes('gzip')){ body = HTML_GZIP;   enc = 'gzip'; }
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      };
      if (enc) headers['Content-Encoding'] = enc;
      res.writeHead(200, headers);
      res.end(body);
      return;
    }
  }

  res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
  res.end('Not Found');
});

server.listen(PORT, ()=>{
  console.log('✅ 塔罗牌服务已启动：http://localhost:' + PORT);
  if (!KEY){
    console.log('⚠  未检测到 DEEPSEEK_API_KEY —— 解牌会退回本地静态解读。');
    console.log('   请用：DEEPSEEK_API_KEY=sk-xxx node server.js');
  }
});
