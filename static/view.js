function fromB64u(value){const b=value.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b+'='.repeat((4-b.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
const $=id=>document.getElementById(id);
$('unlockBtn').addEventListener('click',async()=>{
 const mid=document.body.dataset.messageId, token=$('accessTokenInput').value.trim(), password=$('passwordInput').value, keyText=$('secretKeyInput').value.trim();
 $('messageBox').classList.add('hidden');$('fileDownload').classList.add('hidden');
 if(!token||!keyText){$('status').textContent='Access token and secret key are required.';return;}
 $('unlockBtn').disabled=true;$('status').textContent='Verifying access and retrieving encrypted content…';
 try{
  const response=await fetch(`/api/messages/${encodeURIComponent(mid)}/open`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password}) ,cache:'no-store'});
  const data=await response.json();if(!response.ok)throw new Error(data.error==='PASSWORD_REQUIRED'?'This message requires the additional password.':data.error||'Access denied.');
  $('status').textContent='Decrypting locally in your browser…';
  const key=await crypto.subtle.importKey('raw',fromB64u(keyText),{name:'AES-GCM'},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(data.iv)},key,fromB64u(data.ciphertext));
  const payload=JSON.parse(new TextDecoder().decode(plain));
  $('decryptedMessage').textContent=payload.text||'';
  if(payload.file){const bytes=fromB64u(payload.file.data);const blob=new Blob([bytes],{type:payload.file.type||'application/octet-stream'});const url=URL.createObjectURL(blob);$('downloadFile').href=url;$('downloadFile').download=payload.file.name||'secureburn-download';$('fileName').textContent=`File ready: ${payload.file.name} (${(bytes.length/1024).toFixed(1)} KB)`;$('fileDownload').classList.remove('hidden');}
  $('messageBox').classList.remove('hidden');$('status').textContent='Unlocked. Content was decrypted on this device.';
 }catch(e){$('status').textContent=e.message||'Unable to unlock. Check your credentials and try again.';}
 finally{$('unlockBtn').disabled=false;}
});
