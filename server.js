#!/usr/bin/env node
/* 塔罗牌极简代理：托管 card_phone.html + 代理 DeepSeek 解牌
   用法：DEEPSEEK_API_KEY=sk-xxx node server.js   （默认端口 3000）
   GET  /            → card_phone.html
   POST /api/read    → { question, cards } → { content }   */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT  = process.env.PORT || 3000;
const KEY   = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const HTML = fs.readFileSync(path.join(__dirname, 'card_phone.html'));

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

  if (req.method === 'GET' && (req.url === '/' || req.url === '/card_phone.html' || req.url === '/index.html')){
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(HTML);
    return;
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
