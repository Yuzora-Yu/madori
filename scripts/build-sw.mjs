import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [];
async function collect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await collect(path);
    else if (!path.endsWith(".map") && entry.name !== "sw.js")
      files.push(path.slice(5));
  }
}
await collect("dist");
files.sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(`dist/${file}`));
const cache = `madori-${hash.digest("hex").slice(0, 16)}`;
const source = `const CACHE=${JSON.stringify(cache)};
const FILES=${JSON.stringify(files)};
const absolute=(path)=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(absolute)))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('madori-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(absolute('index.html')))));
  }else if(FILES.some(file=>absolute(file)===url.href)){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(request).then(hit=>hit||fetch(request))));
  }
});
`;
await writeFile("dist/sw.js", source);
console.log(`Offline shell: ${files.length} files in ${cache}`);
