const $ = id => document.getElementById(id);
const createBtn=$('createBtn'), statusBox=$('status'), resultBox=$('result'), messageBox=$('message');
const oneTimeToggle=$('oneTime'), accessHint=$('accessHint'), fileInput=$('fileInput');
const expirySelect=$('expiry'), customExpiryWrap=$('customExpiryWrap'), customExpiry=$('customExpiry');
expirySelect.addEventListener('change',()=>{customExpiryWrap.classList.toggle('hidden',expirySelect.value!=='custom');if(expirySelect.value==='custom')customExpiry.focus();});
function b64u(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function copyValue(id){navigator.clipboard.writeText($(id).value).then(()=>statusBox.textContent='Copied. Share this value only through a trusted separate channel.').catch(()=>{$(id).select();statusBox.textContent='Select and copy manually.';});}
oneTimeToggle.addEventListener('change',()=>accessHint.textContent=oneTimeToggle.checked?'ON — the message/file can be opened once only.':'OFF — it can be opened repeatedly until expiry.');
messageBox.addEventListener('input',()=> $('charCount').textContent=`${messageBox.value.length} / 10000`);
fileInput.addEventListener('change',()=>{const f=fileInput.files[0];$('fileInfo').textContent=f?`${f.name} · ${(f.size/1024/1024).toFixed(2)} MiB`:'PDF, DOCX, XLSX, TXT, PNG, JPG or WEBP · Maximum 8 MiB';});
async function readFileAsBase64(file){const bytes=new Uint8Array(await file.arrayBuffer());return b64u(bytes);}
createBtn.addEventListener('click',async()=>{
 const message=messageBox.value, file=fileInput.files[0], password=$('messagePassword').value;
 const minutes=expirySelect.value==='custom'?Number(customExpiry.value):Number(expirySelect.value); resultBox.classList.add('hidden');
 if(!Number.isInteger(minutes)||minutes<1||minutes>1440){statusBox.textContent='Choose or enter a time between 1 and 1440 minutes.';return;}
 if(!message.trim()&&!file){statusBox.textContent='Enter a message or attach a file.';return;}
 if(message.length>10000){statusBox.textContent='Message is too long.';return;}
 if(file&&file.size>8*1024*1024){statusBox.textContent='File exceeds the 8 MiB limit.';return;}
 if(!crypto?.subtle){statusBox.textContent='Web Crypto requires HTTPS or localhost.';return;}
 createBtn.disabled=true;statusBox.textContent='Encrypting message/file in this browser…';
 try{
  const content={text:message,file:file?{name:file.name,type:file.type||'application/octet-stream',data:await readFileAsBase64(file)}:null};
  const plaintext=new TextEncoder().encode(JSON.stringify(content));
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const rawKey=new Uint8Array(await crypto.subtle.exportKey('raw',key));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext));
  const token=b64u(crypto.getRandomValues(new Uint8Array(32)));
  const response=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ciphertext:b64u(encrypted),iv:b64u(iv),token,expires_minutes:minutes,one_time:oneTimeToggle.checked,password})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not create secure item.');
  $('shareLink').value=`${location.origin}/m/${data.message_id}`;
  $('secretKey').value=b64u(rawKey);$('accessToken').value=token;
  resultBox.classList.remove('hidden');statusBox.textContent='Encrypted successfully. Share each credential separately.';
  messageBox.value='';fileInput.value='';$('messagePassword').value='';$('charCount').textContent='0 / 10000';$('fileInfo').textContent='PDF, DOCX, XLSX, TXT, PNG, JPG or WEBP · Maximum 8 MiB';
 }catch(e){statusBox.textContent=e.message||'Something went wrong.';}finally{createBtn.disabled=false;}
});
$('copyBtn').addEventListener('click',()=>copyValue('shareLink'));
$('copyKeyBtn').addEventListener('click',()=>copyValue('secretKey'));
$('copyTokenBtn').addEventListener('click',()=>copyValue('accessToken'));

