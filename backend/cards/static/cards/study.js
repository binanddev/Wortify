'use strict';
(() => {
  class UserError extends Error {}
  const errorText = error => error instanceof UserError ? error.message : 'Không thực hiện được thao tác. Vui lòng tải lại trang và thử lại.';
  const $ = id => document.getElementById(id);
  const config = JSON.parse($('study-config').textContent);
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'flash';
  const names = {flash: 'Thẻ ghi nhớ', quiz: 'Trắc nghiệm', spell: 'Nghe chép', speak: 'Luyện nói', learn: 'Học hôm nay', write: 'Nhớ và viết', order: 'Sắp xếp câu'};
  let orderSelected = [];
  let displayedIndex = 0;
  let current, index = 0, busy = false, answered = false, lastCorrect = false, player, recorder, stream, chunks = [], blob, blobURL, timer, started, recordingId;
  const storageKey = `wort-study:${location.search}`;
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch { saved = null; }
  const sessionStart = saved?.started || Date.now();
  const seed = saved?.seed || String(Math.random());
  index = saved?.index || 0;
  const save = () => { try { sessionStorage.setItem(storageKey, JSON.stringify({token: current.token, index, total: current.total, started: sessionStart, seed, filter: $('filter').value, target: $('target').value, shuffle: $('shuffle').checked})); } catch {} };
  if (saved) { $('filter').value = saved.filter || 'all'; $('target').value = saved.target || 'term'; $('shuffle').checked = Boolean(saved.shuffle); }
  else if (params.get('filter')) $('filter').value = params.get('filter');
  $('mode-title').textContent = names[mode] || 'Học từ vựng';
  const status = text => { $('status').textContent = text; };
  async function post(url, values, method = 'POST') {
    const body = values instanceof FormData ? values : new URLSearchParams(values);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 95000);
    try {
      const response = await fetch(url, {method, body: method === 'GET' ? undefined : body, headers: {'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value}, signal: controller.signal});
      if (response.redirected) throw new UserError('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.');
      let data;
      try { data = await response.json(); } catch { throw new UserError('Không xử lý được yêu cầu. Vui lòng thử lại.'); }
      if (!response.ok) throw new UserError(data.error || 'Không xử lý được yêu cầu.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new UserError('Yêu cầu quá lâu. Hãy thử lại; âm thanh không được lưu.');
      if (error instanceof TypeError) throw new UserError('Mất kết nối. Vui lòng kiểm tra mạng và thử lại.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function stopAudio() { if (player) { player.pause(); player = null; } window.speechSynthesis?.cancel(); }
  async function listen(slow = false, type) {
    if (!current) return;
    stopAudio();
    $('audio-status').textContent = 'Đang chuẩn bị âm thanh…';
    try {
      const data = await post(current.audio_url, {slow: slow ? '1' : '0', type: type || current.target_type});
      if (data.fallback) {
        const synth = window.speechSynthesis;
        if (!synth) throw new UserError('Trình duyệt chưa hỗ trợ giọng đọc. Hãy cấu hình TTS hoặc dùng trình duyệt khác.');
        let voices = synth.getVoices();
        if (!voices.length) {
          await new Promise(resolve => { const done = () => { synth.removeEventListener('voiceschanged', done); resolve(); }; synth.addEventListener('voiceschanged', done); setTimeout(done, 1000); });
          voices = synth.getVoices();
        }
        const voice = voices.find(v => v.lang.toLowerCase().startsWith('de'));
        if (!voice) throw new UserError('Thiết bị chưa có giọng tiếng Đức. Cài giọng Deutsch trong cài đặt giọng nói của thiết bị hoặc cấu hình TTS.');
        const utterance = new SpeechSynthesisUtterance(data.text);
        utterance.lang = 'de-DE'; utterance.voice = voice; utterance.rate = data.speed;
        utterance.onerror = () => { $('audio-status').textContent = 'Chưa phát được giọng đọc. Hãy bấm Nghe mẫu để thử lại.'; };
        synth.speak(utterance);
        $('audio-status').textContent = data.message;
      } else {
        player = new Audio(data.url); await player.play();
        $('audio-status').textContent = 'Đang phát giọng đọc máy.';
      }
    } catch (error) { $('audio-status').textContent = error instanceof UserError ? error.message : 'Hãy bấm Nghe mẫu để cho phép phát âm thanh.'; }
  }
  function resetRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(t => t.stop()); clearInterval(timer);
    if (blobURL) URL.revokeObjectURL(blobURL);
    blob = null; chunks = []; blobURL = null; recordingId = null; recorder = null;
    $('playback').hidden = true; $('playback').removeAttribute('src');
    $('record-status').textContent = 'Chưa thu · Tối đa 60 giây';
    $('record').disabled = false; $('stop-record').disabled = true; $('clear-record').disabled = true; $('check-speaking').disabled = true;
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['previous', 'next', 'filter', 'target', 'shuffle']) $(id).disabled = value;
    for (const id of ['flashcard', 'listen', 'slow', 'example-listen', 'answer']) $(id).disabled = value;
    document.querySelectorAll('#choices button, #flash-actions button, #write-form button, #order-bank button, #order-answer button, #order-submit').forEach(b => b.disabled = value || answered);
  }
  async function load(resume = false) {
    if (busy) return;
    if (Date.now() - sessionStart >= config.session_minutes * 60000) {
      status('Đã hết thời lượng buổi học. Nghỉ một chút rồi mở buổi học mới nhé.'); $('exercise').hidden = true;
      $('restart').hidden = false; return;
    }
    const panel = $('exercise');
    const wasVisible = !panel.hidden && Boolean(current);
    if (wasVisible) {
      panel.style.minHeight = `${panel.getBoundingClientRect().height}px`;
      if (!$('flashcard').hidden) $('flashcard').style.minHeight = `${$('flashcard').getBoundingClientRect().height}px`;
    }
    panel.setAttribute('aria-busy', 'true');
    setBusy(true); stopAudio(); status('Đang tải thẻ…');
    try {
      const requestQuestion = () => post('/api/next/', {mode, deck: params.get('deck') || '', filter: $('filter').value, target: $('target').value, shuffle: $('shuffle').checked ? '1' : '0', seed, index});
      if (resume && saved?.token) {
        try { current = await post(`/api/question/${saved.token}/`, {}, 'GET'); current.total = saved.total; }
        catch { current = await requestQuestion(); }
      } else current = await requestQuestion();
      if (current.done) { save(); panel.hidden = true; $('counter').textContent = ''; status(current.message); $('restart').hidden = false; return; }
      resetRecording();
      displayedIndex = index;
      save();
      answered = Boolean(current.completed);
      $('result').hidden = true; $('result').replaceChildren(); $('choices').replaceChildren(); $('answer').value = '';
      $('front').hidden = false; $('back').hidden = true; $('audio-status').textContent = '';
      $('flashcard').hidden = current.mode !== 'flash'; $('prompt').hidden = !['quiz', 'speak', 'write', 'order'].includes(current.mode);
      $('write-form').hidden = !['spell', 'write'].includes(current.mode); $('flash-actions').hidden = current.mode !== 'flash';
      $('answer-label').textContent = current.mode === 'write' ? 'Viết từ tiếng Đức tương ứng' : 'Nội dung bạn nghe được';
      $('audio-tools').hidden = ['write', 'order'].includes(current.mode) && !answered;
      $('order-exercise').hidden = current.mode !== 'order'; orderSelected=[];
      $('speaking').hidden = current.mode !== 'speak'; $('example-listen').hidden = current.mode === 'spell' || !current.card?.example_german;
      $('stt-notice').hidden = config.stt_ready;
      $('previous').hidden = mode === 'learn';
      $('filter-control').hidden = mode === 'learn';
      $('shuffle-control').hidden = mode === 'learn';
      $('target-control').hidden = ['flash', 'quiz', 'write', 'order'].includes(mode);
      $('keyboard-hint').textContent = {flash:'Space để lật thẻ', quiz:'Phím 1–4 để chọn', spell:'Enter để nộp bài', speak:'Âm thanh chỉ dùng tạm để kiểm tra', write:'Enter để nộp bài', order:'Chọn các từ theo thứ tự'}[current.mode];
      $('instruction').textContent = {flash: 'Chạm vào thẻ hoặc nhấn Space để lật', quiz: 'Chọn nghĩa tiếng Việt đúng · phím 1–4', spell: 'Nghe mẫu, sau đó viết lại bằng tiếng Đức', speak: 'Nghe mẫu và nói lại nội dung tiếng Đức', write:'Nhìn nghĩa tiếng Việt và nhớ lại từ tiếng Đức', order:'Sắp xếp các từ thành câu đúng. Chạm lại một từ để bỏ chọn.'}[current.mode];
      $('counter').textContent = mode === 'learn' ? `${current.total} thẻ trong lịch hôm nay` : `${index % current.total + 1} / ${current.total} thẻ`;
      if (current.card) {
        $('front').textContent = current.card.german_text;
        $('back').textContent = [current.card.vietnamese_meaning, current.card.example_german, current.card.example_vietnamese, [current.card.article, current.card.part_of_speech, current.card.plural_form].filter(Boolean).join(' · '), current.card.notes, current.card.usage ? `Cách dùng: ${current.card.usage}` : ''].filter(Boolean).join('\n');
        $('prompt').textContent = current.mode === 'quiz' ? current.card.german_text : current.target;
      }
      if (['write','order'].includes(current.mode)) $('prompt').textContent=current.prompt || 'Sắp xếp các từ tiếng Đức';
      if (current.mode === 'order') renderOrder();
      current.options.forEach((option, i) => { const button = document.createElement('button'); button.textContent = `${i+1}. ${option}`; button.onclick = () => submit(option); $('choices').append(button); });
      $('exercise').hidden = false; status(names[current.mode]);
      if (current.completed && current.result && Object.keys(current.result).length) result(current.result);
      if (current.processing) $('record-status').textContent='Lượt trước đang xử lý. Âm thanh không được lưu để nghe lại.';
      if (current.completed && current.mode==='speak') { recordingId=true; $('clear-record').disabled=false; }
      if (['spell','write'].includes(current.mode)) $('answer').focus({preventScroll:true});
      if (wasVisible && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        $('study-content').animate?.([{opacity:0.45, transform:'translateY(4px)'}, {opacity:1, transform:'translateY(0)'}], {duration:160, easing:'ease-out'});
      }
      if (current.mode === 'spell' || (config.autoplay && !['write','order'].includes(current.mode))) listen();
    } catch (error) { index = displayedIndex; status(errorText(error)); } finally { panel.removeAttribute('aria-busy'); setBusy(false); }
  }
  function result(data) {
    lastCorrect = data.is_correct;
    $('result').hidden = false; $('result').replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = data.uncertain ? 'Nhận dạng chưa chắc chắn · Chưa cập nhật lịch ôn' : data.is_correct ? '✓ Nội dung đúng' : '↻ Cần ôn thêm';
    $('result').append(heading);
    const add = text => { const p = document.createElement('p'); p.textContent = text; $('result').append(p); };
    if (data.ephemeral) { add('Đã ghi nhận đúng/sai vào lịch ôn. Âm thanh và nội dung nhận dạng không được lưu.'); return; }
    if (current.mode === 'speak') {
      add(`Mức độ khớp nội dung${data.uncertain ? ' (tham khảo)' : ''}: ${data.score}%`);
      add(`Hệ thống nghe được: ${data.transcript}`);
      add(data.uncertain ? 'Hãy thu lại và nói rõ hơn.' : 'Kiểm tra các từ được đánh dấu và nghe lại câu mẫu.');
    }
    add(`Đáp án: ${data.target || data.card?.german_text || ''}`);
    if (data.card) {
      add([data.card.vietnamese_meaning, data.card.example_german, data.card.example_vietnamese].filter(Boolean).join(' — '));
      if (data.card.part_of_speech) add(`Loại từ: ${data.card.part_of_speech}`);
      if (data.card.notes) add(`Ghi chú: ${data.card.notes}`);
      if (data.card.usage) add(`Cách dùng: ${data.card.usage}`);
      $('audio-tools').hidden=false; $('example-listen').hidden=!data.card.example_german;
    }
    if (data.words) {
      const diff = document.createElement('div'); diff.className = 'word-diff';
      data.words.forEach(word => { const span = document.createElement('span'); span.className = word.kind;
        span.textContent = word.kind === 'correct' ? `✓ ${word.actual}` : word.kind === 'missing' ? `Thiếu: ${word.expected}` : word.kind === 'extra' ? `Thừa: ${word.actual}` : `${word.actual} → ${word.expected}`;
        diff.append(span);
      }); $('result').append(diff);
    }
  }
  async function submit(answer) {
    if (busy || answered) return;
    setBusy(true);
    try { const data = await post(`/api/submit/${current.token}/`, {answer}); answered = true; result(data); status('Đã lưu kết quả và lịch ôn.'); }
    catch (error) { status(errorText(error)); } finally { setBusy(false); }
  }
  async function record() {
    if (busy) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { $('record-status').textContent = 'Thu âm cần HTTPS (hoặc localhost) và trình duyệt hỗ trợ micro. Hãy thử Chrome, Edge hoặc Safari mới.'; return; }
    resetRecording(); setBusy(true); $('record').disabled = true; stopAudio();
    $('record-status').textContent = 'Đang mở micro…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
      if (!mime) throw new UserError('unsupported');
      recorder = new MediaRecorder(stream, {mimeType: mime}); chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        clearInterval(timer); stream.getTracks().forEach(t => t.stop());
        blob = new Blob(chunks, {type: recorder.mimeType});
        setBusy(false); $('stop-record').disabled = true; $('record').disabled = false;
        if (blob.size > config.max_bytes || blob.size === 0) { $('record-status').textContent = 'Bản thu trống hoặc vượt quá 10 MB. Hãy thu lại.'; blob = null; return; }
        blobURL = URL.createObjectURL(blob); $('playback').src = blobURL; $('playback').hidden = false;
        $('clear-record').disabled = false; $('check-speaking').disabled = false;
        $('record-status').textContent = 'Đã thu xong · Nghe lại trước khi kiểm tra';
      };
      recorder.onerror = () => { stream?.getTracks().forEach(t => t.stop()); clearInterval(timer); setBusy(false); $('record').disabled = false; $('record-status').textContent = 'Thu âm bị gián đoạn. Vui lòng thử lại.'; };
      recorder.start(); started = Date.now(); $('stop-record').disabled = false;
      timer = setInterval(() => { const seconds = Math.floor((Date.now()-started)/1000); $('record-status').textContent = `Đang thu · ${seconds} / ${config.max_seconds} giây`; if (seconds >= config.max_seconds) recorder.stop(); }, 250);
    } catch { stream?.getTracks().forEach(t => t.stop()); setBusy(false); $('record').disabled = false; $('record-status').textContent = 'Không mở được micro. Kiểm tra quyền micro, thiết bị và định dạng thu âm của trình duyệt.'; }
  }
  async function checkSpeaking() {
    if (busy || !blob) return;
    if (!$('consent').checked) { $('record-status').textContent = 'Hãy đồng ý gửi bản thu đến dịch vụ nhận dạng trước khi kiểm tra.'; return; }
    setBusy(true); $('check-speaking').disabled = true; $('record').disabled = true; $('clear-record').disabled = true;
    $('record-status').textContent = 'Đang xử lý…';
    const body = new FormData(); body.append('audio', blob, 'recording'); body.append('consent', 'yes');
    try {
      const data = await post(`/api/speaking/${current.token}/`, body);
      if (data.status === 'error') throw new UserError(data.error);
      result(data.result); answered = !data.result.uncertain;
      $('record-status').textContent = 'Đã kiểm tra · Âm thanh đã được giải phóng';
    } catch (error) { $('record-status').textContent = errorText(error); }
    finally {
      const message=$('record-status').textContent; resetRecording(); recordingId=true;
      $('record-status').textContent=message; setBusy(false); $('clear-record').disabled=false;
    }
  }
  async function retryRecording() {
    if (busy) return;
    // Create a fresh token without retaining audio or transcript from the last try.
    if (recordingId || answered) {
      try { await post(`/api/retry/${current.token}/`, {}); } catch (error) { status(errorText(error)); return; }
      await load();
    } else resetRecording();
  }
  $('listen').onclick = () => listen(); $('slow').onclick = () => listen(true); $('example-listen').onclick = () => listen(false, 'example'); $('stop-audio').onclick = stopAudio;
  $('flashcard').onclick = () => { $('front').hidden = !$('front').hidden; $('back').hidden = !$('back').hidden; if (!$('front').hidden && config.autoplay) listen(); };
  document.querySelectorAll('[data-answer]').forEach(b => b.onclick = () => submit(b.dataset.answer));
  $('write-form').onsubmit = event => { event.preventDefault(); submit($('answer').value); };
  function renderOrder() {
    $('order-bank').replaceChildren(); $('order-answer').replaceChildren();
    const add = (item, chosen) => {
      const button=document.createElement('button'); button.type='button'; button.textContent=item.text; button.disabled=answered || busy;
      button.onclick=() => { if (chosen) orderSelected=orderSelected.filter(id=>id!==item.id); else orderSelected.push(item.id); renderOrder(); };
      $(chosen?'order-answer':'order-bank').append(button);
    };
    for (const id of orderSelected) add(current.items.find(item=>item.id===id),true);
    for (const item of current.items) if (!orderSelected.includes(item.id)) add(item,false);
  }
  $('order-submit').onclick = () => submit(JSON.stringify(orderSelected));
  $('next').onclick = () => {
    if (busy) return;
    const filter = $('filter').value;
    const removed = answered && (['new', 'due'].includes(filter) || (['weak', 'review'].includes(filter) && lastCorrect));
    if (!removed) index++;
    load();
  };
  $('previous').onclick = () => { if (busy) return; index = Math.max(0, index-1); load(); };
  for (const id of ['filter', 'target', 'shuffle']) $(id).onchange = () => { index = 0; load(); };
  $('record').onclick = () => recordingId || answered ? retryRecording() : record();
  $('stop-record').onclick = () => { if (recorder?.state === 'recording') recorder.stop(); };
  $('clear-record').onclick = retryRecording; $('check-speaking').onclick = checkSpeaking;
  document.addEventListener('keydown', event => {
    if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName) || busy) return;
    if (event.code === 'Space' && current?.mode === 'flash') { event.preventDefault(); $('flashcard').click(); }
    if (/^[1-4]$/.test(event.key) && current?.mode === 'quiz') $('choices').children[Number(event.key)-1]?.click();
  });
  window.addEventListener('pagehide', () => { stopAudio(); stream?.getTracks().forEach(t => t.stop()); if(blobURL) URL.revokeObjectURL(blobURL); blob=null; chunks=[]; });
  $('restart').onclick = () => { try { sessionStorage.removeItem(storageKey); } catch {} location.reload(); };
  load(true);
})();


