import test from 'node:test';
import assert from 'node:assert/strict';
import { fullPageCorners, detectScanCorners, validScanCorners, scanProjection, projectScanPoint, prepareScanPhoto } from '../src/utils/freeScanner.js';

test('perspective correction preserves the entire page and maps each trapezoid corner exactly',()=>{
    for(const corners of [fullPageCorners(),[{x:.1,y:.15},{x:.9,y:.05},{x:.8,y:.95},{x:.2,y:.8}]]){
        const matrix=scanProjection(corners);
        fullPageCorners().forEach((p,i)=>{const mapped=projectScanPoint(matrix,p.x,p.y);assert.ok(Math.abs(mapped.x-corners[i].x)<1e-8);assert.ok(Math.abs(mapped.y-corners[i].y)<1e-8);});
    }
    assert.deepEqual(projectScanPoint(scanProjection(fullPageCorners()),.5,.5),{x:.5,y:.5});
});
test('crossed, degenerate, tiny or out-of-bounds crop areas cannot discard or corrupt a page silently',()=>{
    const p=fullPageCorners();
    for(const corners of [[p[0],p[2],p[1],p[3]],[p[0],p[0],p[0],p[0]],[{x:-.1,y:0},...p.slice(1)],p.map(v=>({x:v.x*.01,y:v.y*.01})),null]){
        assert.equal(validScanCorners(corners),false);assert.throws(()=>scanProjection(corners));
    }
});
test('unsupported or oversized phone files are rejected before image decoding or network work',async()=>{
    for(const file of [{type:'application/pdf',size:100},{type:'image/heic',size:100},{type:'image/jpeg',size:25*1024*1024},{type:'image/png',size:0}])await assert.rejects(()=>prepareScanPhoto(file));
});

test('a white sheet on a dark background is detected locally; low contrast retains the full photo',()=>{
 const width=100,height=140,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,v=x>=15&&x<=85&&y>=15&&y<=125?245:40;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 const found=detectScanCorners({data,width,height});assert.equal(found.length,4);assert.ok(Math.abs(found[0].x-15/99)<.01);assert.ok(Math.abs(found[2].y-125/139)<.01);
 data.fill(240);assert.equal(detectScanCorners({data,width,height}),null);
});
