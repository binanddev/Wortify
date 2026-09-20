'use strict';
(() => {
  const $ = id => document.getElementById(id), deck = $('match-app').dataset.deck;
  let round, selected = null, mapping = {}, busy = false, start = Date.now();
  const key = `wort-match:${deck}`;
  const status = message => { $('match-status').textContent = message; };
  async function post(url, body) {
    const response = await fetch(url, {method:'POST',headers:{'X-CSRFToken':document.querySelector('[name=csrfmiddlewaretoken]').value},body:new URLSearchParams(body)});
    if (response.redirected) throw new Error('Vui lòng đăng nhập lại.');
    let data; try { data=await response.json(); } catch { throw new Error('Không xử lý được yêu cầu.'); }
    if (!response.ok) throw new Error(data.error || 'Không xử lý được yêu cầu.');
    return data;
  }
  function render() {
    $('match-left').replaceChildren(); $('match-right').replaceChildren();
    for (const side of ['left','right']) for (const item of round[side]) {
      const button=document.createElement('button');
      const leftID=side==='left' ? item.id : Object.keys(mapping).find(id => mapping[id]===item.id);
      const number=leftID && mapping[leftID] !== undefined ? round.left.findIndex(i => i.id===leftID)+1 : null;
      button.textContent=(number ? `${number}. ` : '') + item.text;
      button.className=selected===item.id && side==='left' ? 'selected' : number ? 'paired' : '';
      button.disabled=busy || round.completed;
      button.setAttribute('aria-pressed', String(selected===item.id && side==='left'));
      button.onclick=() => {
        if (side==='left') { selected=item.id; delete mapping[item.id]; status('Chọn nghĩa tiếng Việt cho từ vừa chọn.'); }
        else if (selected) {
          for (const id of Object.keys(mapping)) if (mapping[id]===item.id) delete mapping[id];
          mapping[selected]=item.id; selected=null; status(`Đã ghép ${Object.keys(mapping).length}/${round.left.length} cặp.`);
        } else status('Hãy chọn từ tiếng Đức trước.');
        render();
      };
      $(`match-${side}`).append(button);
    }
    $('match-submit').disabled=busy || round.completed || Object.keys(mapping).length !== round.left.length;
  }
  function showResult(data) {
    $('match-result').replaceChildren();
    const heading=document.createElement('h2'); heading.textContent=`Đúng ${data.correct}/${data.total} cặp`; $('match-result').append(heading);
    for (const row of data.rows) { const p=document.createElement('p'); p.textContent=`${row.is_correct ? '✓ Đúng' : '↻ Cần ôn'} · ${row.term} — ${row.meaning}`; $('match-result').append(p); }
    status('Đã cập nhật lịch ôn cho từng thẻ. Các cặp sai sẽ được ôn lại sớm hơn.');
  }
  async function load(resume=false) {
    if (busy) return;
    busy=true; $('match-new').disabled=true; $('match-submit').disabled=true;
    try {
      let token; try { token=resume ? sessionStorage.getItem(key) : null; } catch {}
      round=await post(`/api/match/${deck}/new/`, token ? {resume:token} : {weak:$('match-weak').checked?'1':'0'});
      try { sessionStorage.setItem(key,round.token); } catch {}
      mapping={}; selected=null; start=Date.now(); $('match-result').replaceChildren();
      status('Chọn từ và nghĩa để tạo cặp.');
      if (round.completed) showResult(round.result);
    } catch(error) { status(error instanceof TypeError ? 'Mất kết nối. Hãy thử lại.' : error.message); }
    finally { busy=false; $('match-new').disabled=false; if (round) render(); }
  }
  $('match-submit').onclick=async () => {
    if (busy || round.completed) return;
    busy=true; render();
    try { const result=await post(`/api/match/${round.token}/submit/`, {pairs:JSON.stringify(mapping)}); round.completed=true; showResult(result); }
    catch(error) { status(error instanceof TypeError ? 'Mất kết nối. Hãy thử lại.' : error.message); }
    finally { busy=false; render(); }
  };
  $('match-new').onclick=() => load(); $('match-weak').onchange=() => load();
  const timer=setInterval(() => { if (round && !round.completed) $('match-time').textContent=`${Math.floor((Date.now()-start)/1000)} giây`; },1000);
  window.addEventListener('pagehide',()=>clearInterval(timer)); load(true);
})();
