const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('dist/scenarios.js','utf8'),ctx);const cases=ctx.window.SCENARIOS;
assert.equal(cases.length,12);assert.equal(new Set(cases.map(x=>x.id)).size,12);
let paths=0;
for(const c of cases){assert(c.country&&c.region&&c.role&&c.question);assert(c.facts.length>=2);assert(c.sources.length);for(const s of c.sources){assert(new URL(s.url).protocol==='https:');assert(s.date);}assert.equal(c.scenes.length,3);for(const s of c.scenes){assert(s.story&&s.barrier);assert.equal(s.options.length,2);assert.notEqual(s.options[0].result,s.options[1].result);for(const o of s.options)assert(o.text&&o.result);}for(let mask=0;mask<8;mask++){const results=c.scenes.map((s,i)=>s.options[(mask>>i)&1].result);assert.equal(results.length,3);paths++;}}
new vm.Script(fs.readFileSync('dist/app.js','utf8'));
console.log(`PASS: ${cases.length} unique scenarios, 36 scenes, 72 choices, ${paths} complete choice paths; sources and JavaScript syntax valid.`);
