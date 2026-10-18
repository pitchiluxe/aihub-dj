// Render the real skin CSS in Chromium; no audio engine or user preferences are loaded.
const electron = require('electron');
if (typeof electron === 'string') {
  // Run with: node scripts/check-palettes.cjs. Avoid Windows GUI-shell wait semantics.
  const { spawn } = require('node:child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [__filename], { env, stdio: 'ignore', windowsHide: true });
  child.on('error', error => { console.error(error); process.exit(1); });
  child.on('exit', code => {
    const fs = require('node:fs'); const path = require('node:path');
    try { const result = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/palette-check.json'), 'utf8')); console.log(JSON.stringify({ ...result, failureCount: result.failures.length }, null, 2)); }
    catch (error) { console.error(error); process.exit(1); }
    process.exit(code ?? 1);
  });
} else {
const {app,BrowserWindow}=electron;
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../src/renderer/src/components/dj');
const page=fs.readFileSync(path.join(dir,'DjPage.tsx'),'utf8');
const ids=(start,end)=>[...page.slice(page.indexOf(start),page.indexOf(end,page.indexOf(start))).matchAll(/id: '([a-z-]+)'/g)].map(m=>m[1]);
const looks=ids('export const DJ_LOOKS','const REFERENCE_LOOKS');
const themes=ids('export const DJ_THEMES','/** Looks');
const files=[...page.matchAll(/import '\.\/(dj[^']*\.css)'/g)].map(m=>m[1]);
const css=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
app.setPath('userData', path.join(__dirname, '../out/palette-profile-' + process.pid));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<style>'+css+'\n*{transition:none!important;animation:none!important}</style><main class="aihub-dj" data-dj-layout="classic"><section class="dj-panel dj-tt"><span class="dj-section-title">Deck</span><button class="dj-tbtn">Play</button><button class="dj-tbtn dj-on dj-on-green">Active</button></section><section class="dj-panel dj-mixer"></section><section class="dj-panel dj-pads"></section><section class="dj-library"><div class="dj-tree"><div class="dj-node">Folder</div></div><div class="dj-browser">Songs</div></section></main>'));
 const result=await win.webContents.executeJavaScript('('+((looks,themes)=>{
  const root=document.querySelector('main');
  const sample=()=>Array.from(root.querySelectorAll('.dj-panel,.dj-section-title,.dj-tbtn:not(.dj-on),.dj-tree,.dj-node,.dj-browser')).map(el=>{const s=getComputedStyle(el);return [s.backgroundImage,s.backgroundColor,s.color].join('|')}).join(';');
  const failures=[];let combinations=0;
  const expected=new Map(); const activeExpected=new Map();
  root.dataset.djLook='classic';
  for(const theme of themes.filter(t=>t!=='original')){root.dataset.djTheme=theme;expected.set(theme,sample());activeExpected.set(theme,getComputedStyle(root.querySelector('.dj-on')).backgroundImage)}
  if(new Set(expected.values()).size !== themes.filter(t=>t!=='original').length) failures.push('palette choices do not produce distinct colours');
  for(const look of looks){
   root.dataset.djLook=look;
   for(const theme of themes.filter(t=>t!=='original')){
    root.dataset.djTheme=theme;combinations++;
    if(sample()!==expected.get(theme))failures.push(look+'/'+theme);
    const s=getComputedStyle(root.querySelector('.dj-on'));if(s.backgroundImage!==activeExpected.get(theme))failures.push('active state '+look+'/'+theme+' expected '+activeExpected.get(theme)+' got '+s.backgroundImage);
   }
  }
  root.dataset.djTheme='original'; root.dataset.djLook='silver-classic';const silver=sample();root.dataset.djLook='ember-vinyl';
  if(sample()===silver)failures.push('original skin colours lost');
  
  let layoutChecks=0;
  root.innerHTML='<div class="dj-top"><button class="dj-top-automix">AUTOMIX OFF</button></div><div class="dj-row-clocks"><div class="dj-clock"><span class="dj-deck-letter">A</span><button class="dj-time"><span class="dj-lcd-labels">ELAPSED REMAIN</span><span class="dj-lcd-big">0:00.0</span></button></div></div><div class="dj-row-info"></div><div class="dj-row-decks"><div class="dj-mixer dj-panel dj-video-up"><div class="dj-mixer-video">Video</div></div></div>';
  root.style.width='1466px';root.dataset.djReference='1';
  for(const look of ['ember-vinyl','silver-wave','silver-classic','battle-art']){
    root.dataset.djLook=look;
    for(const zoom of ['0.75','0.95','1']){
      root.style.zoom=zoom;layoutChecks++;
      const mixer=root.querySelector('.dj-mixer').getBoundingClientRect();
      const row=root.querySelector('.dj-row-decks').getBoundingClientRect();
      if(mixer.top<row.top-1)failures.push('video overlaps displays '+look+'/'+zoom);
      for(const [child,parent] of [['.dj-top-automix','.dj-top'],['.dj-lcd-big','.dj-row-clocks']]){
        const a=root.querySelector(child).getBoundingClientRect();const b=root.querySelector(parent).getBoundingClientRect();
        if(a.top<b.top-1 || a.bottom>b.bottom+1)failures.push('clipped '+child+' '+look+'/'+zoom);
      }
    }
  }
  return {combinations,layoutChecks,failures};
 }).toString()+')('+JSON.stringify(looks)+','+JSON.stringify(themes)+')');
 fs.writeFileSync(path.join(__dirname,'../out/palette-check.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,failures:result.failures.slice(0,15),failureCount:result.failures.length},null,2));
 win.destroy(); app.exit(result.failures.length?1:0);
}).catch(error=>{console.error(error);app.exit(1)});

}
