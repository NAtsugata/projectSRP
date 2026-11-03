import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url),pdfUrl=pathToFileURL(require.resolve('pdf-lib')).href;
const { PDFDocument,PDFName }=await import(pdfUrl);
const source=(await readFile(new URL('../src/utils/freeScanner.js',import.meta.url),'utf8')).replace("import('pdf-lib')",`import('${pdfUrl}')`);
const { makeScanPdf }=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
// One valid JPEG pixel: no filesystem fixture or network needed.
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCVACl//9k=','base64');
test('the generated PDF reopens with every scanned page and an embedded image on each page',async()=>{
 const blob=new Blob([jpeg],{type:'image/jpeg'}),result=await makeScanPdf([{blob},{blob}],'Test scan');
 assert.equal(result.type,'application/pdf');const pdf=await PDFDocument.load(await result.arrayBuffer());
 assert.equal(pdf.getPageCount(),2);assert.equal(pdf.getTitle(),'Test scan');
 for(const page of pdf.getPages())assert.ok(page.node.Resources().get(PDFName.of('XObject')));
});
test('a broken page blocks the PDF rather than creating a blank or incomplete document',async()=>{
 await assert.rejects(()=>makeScanPdf([],'Empty'));
 await assert.rejects(()=>makeScanPdf([{blob:new Blob(['bad'],{type:'image/jpeg'})}],'Broken'));
 await assert.rejects(()=>makeScanPdf([{blob:new Blob(['bad'],{type:'application/pdf'})}],'Wrong type'));
});
