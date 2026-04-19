async function check() {
  const apiKey = 'Dithosolucoes324911@';
  try {
    const res = await fetch('https://dithosolucoestech.up.railway.app/chat/findChats/Comercial1', {
      headers: { 'apikey': apiKey }
    });
    const data = await res.json();
    console.log('Chats data structure:');
    console.log(JSON.stringify(Array.isArray(data) ? data.slice(0, 1) : data, null, 2));
    
    // Attempt findMessages if there is a chat
    let remoteJid = '';
    if (Array.isArray(data) && data.length > 0) {
      remoteJid = data[0].remoteJid || data[0].id;
    } else if (data && Array.isArray(data.data) && data.data.length > 0) {
      remoteJid = data.data[0].remoteJid || data.data[0].id;
    } else if (data && Array.isArray(data.chats) && data.chats.length > 0) {
       remoteJid = data.chats[0].remoteJid || data.chats[0].id;
    }

    if (remoteJid) {
       console.log('\nFetching messages for:', remoteJid);
       const msgRes = await fetch('https://dithosolucoestech.up.railway.app/chat/findMessages/Comercial1', {
          method: 'POST',
          headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ where: { remoteJid }, remoteJid }) 
       });
       const msgData = await msgRes.json();
       console.log('Messages POST data structure:');
       console.log(JSON.stringify(Array.isArray(msgData) ? msgData.slice(0, 1) : msgData, null, 2));

       // Try GET too
       const msgResGet = await fetch(`https://dithosolucoestech.up.railway.app/chat/findMessages/Comercial1?remoteJid=${remoteJid}`, {
          method: 'GET',
          headers: { 'apikey': apiKey }
       });
       const msgDataGet = await msgResGet.json();
       console.log('\nMessages GET data structure:');
       console.log(JSON.stringify(Array.isArray(msgDataGet) ? msgDataGet.slice(0, 1) : msgDataGet, null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}

check();
