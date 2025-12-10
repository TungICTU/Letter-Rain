// dictWorker.js
// Worker: builds a Trie from ./wordlist.txt and answers contains/isPrefix queries.

class TrieNode {
  constructor(){ this.children = Object.create(null); this.isWord = false; }
}
class Trie {
  constructor(){ this.root = new TrieNode(); }
  insert(word){
    let node = this.root;
    for (let i = 0; i < word.length; i++){
      const ch = word[i];
      if (!node.children[ch]) node.children[ch] = new TrieNode();
      node = node.children[ch];
    }
    node.isWord = true;
  }
  contains(word){
    let node = this.root;
    for (let i = 0; i < word.length; i++){
      node = node.children[word[i]];
      if (!node) return false;
    }
    return !!node && node.isWord;
  }
  isPrefix(pref){
    let node = this.root;
    for (let i = 0; i < pref.length; i++){
      node = node.children[pref[i]];
      if (!node) return false;
    }
    return true;
  }
}

const trie = new Trie();

self.addEventListener('message', async (ev) => {
  const data = ev.data;
  try {
    if (data.type === 'loadUrl') {
      // streaming fetch for memory friendliness
      const url = data.url || './wordlist.txt';
      const res = await fetch(url);
      if (!res.ok) {
        self.postMessage({ type: 'error', message: `Fetch failed ${res.status}` });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', count = 0, lastProgressSent = 0;
      while(true){
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || '';
        for (const line of lines){
          const w = line.trim().toLowerCase();
          if (!w) continue;
          // keep only [a-z] characters for safety
          const clean = w.replace(/[^a-z]/g,'');
          if (clean.length) trie.insert(clean);
          count++;
          // occasional progress post
          if (count % 5000 === 0){
            const pct = Math.min(99, Math.round((count / (data.estimated || 200000)) * 100));
            if (pct !== lastProgressSent){
              lastProgressSent = pct;
              self.postMessage({ type: 'progress', loaded: count, pct });
            }
          }
        }
      }
      // leftover chunk
      if (buf.trim()){
        const w = buf.trim().toLowerCase().replace(/[^a-z]/g,'');
        if (w.length) trie.insert(w);
        count++;
      }
      self.postMessage({ type: 'loaded', count });
    } else if (data.type === 'contains'){
      const w = (data.word || '').toLowerCase().replace(/[^a-z]/g,'');
      const ok = trie.contains(w);
      self.postMessage({ type: 'contains', id: data.id, result: ok });
    } else if (data.type === 'isPrefix'){
      const p = (data.pref || '').toLowerCase().replace(/[^a-z]/g,'');
      const ok = trie.isPrefix(p);
      self.postMessage({ type: 'isPrefix', id: data.id, result: ok });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
});
