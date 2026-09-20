(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.addEventListener('htmx:configRequest',e=>{const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='));if(csrf)e.detail.headers['X-CSRFToken']=decodeURIComponent(csrf.split('=')[1]);});
 document.addEventListener('htmx:beforeTransition',e=>{if(reduced.matches)e.preventDefault();});
 const initialize=()=>{
  document.querySelectorAll('[data-submitted-exercise]').forEach(x=>{try{sessionStorage.removeItem('deutschraum-draft:'+x.dataset.submittedExercise);}catch{}});
  document.querySelectorAll('form[data-exercise-id]').forEach(form=>{
   if(form.dataset.draftReady)return;form.dataset.draftReady='1';
   const key='deutschraum-draft:'+form.dataset.exerciseId;
   const fields=[...form.querySelectorAll('input:not([type=hidden]),select,textarea')];
   const status=form.querySelector('.save-note');
   if(form.dataset.isBound!=='true')try{const saved=JSON.parse(sessionStorage.getItem(key)||'{}');fields.forEach(f=>{if(Object.hasOwn(saved,f.name)){if(f.type==='checkbox')f.checked=saved[f.name].includes(f.value);else f.value=saved[f.name];}});if(Object.keys(saved).length)status.textContent='Đã khôi phục bản nháp trong tab này.';}catch{}
   form.addEventListener('input',()=>{const data={};fields.forEach(f=>{if(f.type==='checkbox'){data[f.name]??=[];if(f.checked)data[f.name].push(f.value);}else data[f.name]=f.value;});try{sessionStorage.setItem(key,JSON.stringify(data));status.textContent='Đã lưu bản nháp trong tab này.';}catch{status.textContent='Không thể lưu bản nháp trong tab này.';}});
  });
 };
 document.addEventListener('DOMContentLoaded',initialize);document.addEventListener('htmx:load',initialize);
 for(const name of ['htmx:responseError','htmx:sendError'])document.addEventListener(name,()=>{const box=document.getElementById('network-message');box.textContent='Không tải được dữ liệu. Bản nháp vẫn được giữ; hãy thử lại.';box.hidden=false;});
 document.addEventListener('htmx:afterRequest',e=>{if(e.detail.successful)document.getElementById('network-message').hidden=true;});
 document.addEventListener('htmx:afterSwap',e=>{if(e.detail.target.id==='main'){const heading=document.querySelector('#main h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}}});
})();
