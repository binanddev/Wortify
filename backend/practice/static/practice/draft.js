const form=document.querySelector('form');
if(form){
 const key='deutschraum-draft:'+location.pathname;
 const fields=[...form.querySelectorAll('input:not([type=hidden]),select,textarea')];
 const status=document.querySelector('#save-status');
 try{const saved=JSON.parse(sessionStorage.getItem(key)||'{}');fields.forEach(f=>{if(Object.hasOwn(saved,f.name)){if(f.type==='checkbox')f.checked=saved[f.name].includes(f.value);else f.value=saved[f.name];}});if(Object.keys(saved).length)status.textContent='Đã khôi phục bản nháp trong tab này.';}catch{}
 form.addEventListener('input',()=>{const data={};fields.forEach(f=>{if(f.type==='checkbox'){data[f.name]??=[];if(f.checked)data[f.name].push(f.value);}else data[f.name]=f.value;});try{sessionStorage.setItem(key,JSON.stringify(data));status.textContent='Đã lưu bản nháp trong tab này.';}catch{status.textContent='Trình duyệt không cho lưu bản nháp.';}});
}
