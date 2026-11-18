// node tools/gift-guide/print.js <gift-guide.html> <out.pdf> [png-dir]
const {chromium}=require('playwright');
(async()=>{const [src,out,pngs]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:816,height:1056}});
await p.goto('file://'+src,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:out,width:'8.5in',height:'11in',printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
if(pngs){const n=await p.evaluate(()=>document.querySelectorAll('.pg').length);for(let i=0;i<n;i++){const el=(await p.$$('.pg'))[i];await el.screenshot({path:`${pngs}/page-${String(i+1).padStart(2,'0')}.png`});}}
await b.close();})();
