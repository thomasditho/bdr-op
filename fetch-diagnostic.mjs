async function run() {
  const apiKey = 'Dithosolucoes324911@';
  try {
    const chatRes = await fetch('https://dithosolucoestech.up.railway.app/chat/findChats/Comercial1', {
      headers: { 'apikey': apiKey }
    });
    const chats = await chatRes.json();
    let jid = '';
    if (Array.isArray(chats)) jid = chats[0].remoteJid || chats[0].id;
    else if (chats.data) jid = chats.data[0].remoteJid || chats.data[0].id;
    
    console.log('JID found:', jid);
    if (!jid) return;

    const res = await fetch('https://dithosolucoestech.up.railway.app/chat/findMessages/Comercial1', {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remoteJid: jid, where: { remoteJid: jid }, limit: 5 })
    });
    
    const textData = await res.text();
    console.log('--- POST RESPONSE ---');
    console.log(textData.slice(0, 800));

    const resGet = await fetch(`https://dithosolucoestech.up.railway.app/chat/findMessages/Comercial1?remoteJid=${jid}&limit=5`, {
      method: 'GET',
      headers: { 'apikey': apiKey }
    });
    const getTextData = await resGet.text();
    console.log('--- GET RESPONSE ---');
    console.log(getTextData.slice(0, 800));

  } catch (e) {
    console.error(e);
  }
}
run();
