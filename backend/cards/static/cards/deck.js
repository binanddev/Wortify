'use strict';
(() => {
  let cleanup = () => {};
  function init() {
  cleanup();
  const status = document.getElementById('deck-audio-status');
  if (!status) return;
  let player, version = 0;
  function stop() { version++; player?.pause(); window.speechSynthesis?.cancel(); }
  document.getElementById('deck-stop-audio').onclick = stop;
  document.querySelectorAll('.card-listen').forEach(button => {
    button.onclick = async () => {
      stop(); const requestVersion = version;
      status.textContent = 'Đang chuẩn bị âm thanh…';
      try {
        const response = await fetch(`/api/cards/${button.dataset.card}/audio/`, {method:'POST', headers:{'X-CSRFToken':document.querySelector('[name=csrfmiddlewaretoken]').value}, body:new URLSearchParams({type:button.dataset.type})});
        if (!response.ok || response.redirected) throw new Error();
        const data = await response.json();
        if (requestVersion !== version) return;
        if (data.url) { player = new Audio(data.url); await player.play(); status.textContent = 'Đang phát giọng đọc máy.'; }
        else {
          const synth = window.speechSynthesis;
          if (!synth) { status.textContent='Trình duyệt chưa hỗ trợ giọng đọc.'; return; }
          if (!synth.getVoices().length) await new Promise(resolve => setTimeout(resolve, 600));
          if (requestVersion !== version) return;
          const voice = synth.getVoices().find(v => v.lang.toLowerCase().startsWith('de'));
          if (!voice) { status.textContent='Hãy cài giọng Deutsch trên thiết bị hoặc cấu hình dịch vụ giọng đọc.'; return; }
          const utterance = new SpeechSynthesisUtterance(data.text); utterance.lang='de-DE'; utterance.voice=voice;
          utterance.onerror = () => { status.textContent='Chưa phát được âm thanh. Hãy thử lại.'; };
          synth.speak(utterance); status.textContent=data.message;
        }
      } catch { status.textContent='Không phát được âm thanh. Kiểm tra kết nối hoặc đăng nhập lại.'; }
    };
  });
  cleanup = stop;
  }
  init();
  document.addEventListener('htmx:afterSwap', init);
  document.addEventListener('htmx:historyRestore', init);
  document.addEventListener('htmx:beforeSwap', () => cleanup());
  window.addEventListener('pagehide', () => cleanup());
})();

