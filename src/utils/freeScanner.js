// Local image processing only. No document is sent to a scanning service.
export const SCAN_LIMITS = { pages: 15, inputBytes: 20 * 1024 * 1024, pdfBytes: 10 * 1024 * 1024, longEdge: 2200 };
export const fullPageCorners = () => [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];

// Conservative paper detection on a contrasting background. If uncertain, keep
// the complete photo; never silently cut content based on a weak detection.
export function detectScanCorners({data,width,height}) {
    const count=width*height,gray=new Uint8Array(count),hist=new Uint32Array(256);
    let total=0;
    for(let i=0;i<count;i++){const value=Math.round(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114);gray[i]=value;hist[value]++;total+=value;}
    let low=0,sum=0,best=0,threshold=0;
    for(let t=0;t<255;t++){low+=hist[t];sum+=hist[t]*t;if(!low || low===count)continue;const delta=sum/low-(total-sum)/(count-low),variance=low*(count-low)*delta*delta;if(variance>best){best=variance;threshold=t;}}
    if(best/(count*count)<100)return null;
    const seen=new Uint8Array(count),queue=new Int32Array(count);let largest=null;
    for(let start=0;start<count;start++) {
        if(seen[start] || gray[start]<=threshold)continue;
        let head=0,tail=1,brightness=0;queue[0]=start;seen[start]=1;
        let tl=start,tr=start,br=start,bl=start,minSum=Infinity,maxSum=-Infinity,minDiff=Infinity,maxDiff=-Infinity;
        while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);brightness+=gray[index];
            if(x+y<minSum){minSum=x+y;tl=index;}if(x+y>maxSum){maxSum=x+y;br=index;}if(x-y>maxDiff){maxDiff=x-y;tr=index;}if(x-y<minDiff){minDiff=x-y;bl=index;}
            const visit=n=>{if(!seen[n] && gray[n]>threshold){seen[n]=1;queue[tail++]=n;}};
            if(x>0)visit(index-1);if(x<width-1)visit(index+1);if(y>0)visit(index-width);if(y<height-1)visit(index+width);
        }
        if(tail>count*.15 && tail<count*.95 && brightness/tail>150 && (!largest || tail>largest.area))largest={area:tail,points:[tl,tr,br,bl].map(i=>({x:(i%width)/(width-1),y:Math.floor(i/width)/(height-1)}))};
    }
    return largest && validScanCorners(largest.points)?largest.points:null;
}

export function validScanCorners(points) {
    if (!Array.isArray(points) || points.length !== 4 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.x>1 || p.y<0 || p.y>1)) return false;
    const cross=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});
    const area=Math.abs(points.reduce((a,p,i)=>{const q=points[(i+1)%4];return a+p.x*q.y-q.x*p.y;},0))/2;
    return area>0.02 && cross.every(v=>v>0.0001);
}

// Homography maps a unit square into the four source corners, clockwise.
export function scanProjection(points) {
    if (!validScanCorners(points)) throw new Error('Les coins doivent entourer la page sans se croiser.');
    const [p,q,r,s]=points,dx=q.x-r.x,dy=q.y-r.y,ex=s.x-r.x,ey=s.y-r.y;
    const ax=p.x-q.x+r.x-s.x,ay=p.y-q.y+r.y-s.y,det=dx*ey-ex*dy;
    let g=0,h=0;
    if (Math.abs(ax)+Math.abs(ay)>1e-10) {g=(ax*ey-ex*ay)/det;h=(dx*ay-ax*dy)/det;}
    return [q.x-p.x+g*q.x,s.x-p.x+h*s.x,p.x,q.y-p.y+g*q.y,s.y-p.y+h*s.y,p.y,g,h];
}

export function projectScanPoint(matrix,u,v) {
    const [a,b,c,d,e,f,g,h]=matrix,z=g*u+h*v+1;
    return {x:(a*u+b*v+c)/z,y:(d*u+e*v+f)/z};
}

export function loadScanImage(url) {
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Image illisible. Utilisez une photo JPEG, PNG ou WebP.'));image.src=url;});
}
export const canvasScanBlob = canvas => new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('La conversion de la page a échoué.')),'image/jpeg',0.9));

export async function prepareScanPhoto(file) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('Choisissez une photo JPEG, PNG ou WebP. Sur iPhone, prenez une photo avec le bouton prévu.');
    if (!file.size || file.size>SCAN_LIMITS.inputBytes) throw new Error('Chaque photo doit peser moins de 20 Mo.');
    const url=URL.createObjectURL(file);
    try {
        const image=await loadScanImage(url),scale=Math.min(1,SCAN_LIMITS.longEdge/Math.max(image.width,image.height));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
        return {blob:await canvasScanBlob(canvas),canvas};
    } finally {URL.revokeObjectURL(url);}
}

export async function renderScanPage(sourceUrl,corners,filter='color',rotation=0) {
    const matrix=scanProjection(corners),image=await loadScanImage(sourceUrl),src=document.createElement('canvas');
    src.width=image.width;src.height=image.height;const srcCtx=src.getContext('2d');srcCtx.drawImage(image,0,0);
    const distance=(a,b)=>Math.hypot((a.x-b.x)*src.width,(a.y-b.y)*src.height);
    const width=Math.max(1,Math.round(Math.max(distance(corners[0],corners[1]),distance(corners[3],corners[2]))));
    const height=Math.max(1,Math.round(Math.max(distance(corners[0],corners[3]),distance(corners[1],corners[2]))));
    const input=srcCtx.getImageData(0,0,src.width,src.height),out=document.createElement('canvas');out.width=width;out.height=height;
    const ctx=out.getContext('2d'),pixels=ctx.createImageData(width,height),m=matrix;
    for (let y=0;y<height;y++) {
        const v=(y+0.5)/height;
        for(let x=0;x<width;x++) {
            const u=(x+0.5)/width,z=m[6]*u+m[7]*v+1;
            const sx=Math.max(0,Math.min(src.width-1,((m[0]*u+m[1]*v+m[2])/z)*src.width-0.5));
            const sy=Math.max(0,Math.min(src.height-1,((m[3]*u+m[4]*v+m[5])/z)*src.height-0.5));
            const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,src.width-1),y1=Math.min(y0+1,src.height-1),fx=sx-x0,fy=sy-y0,i=(y*width+x)*4;
            for(let c=0;c<3;c++) pixels.data[i+c]=(1-fy)*((1-fx)*input.data[(y0*src.width+x0)*4+c]+fx*input.data[(y0*src.width+x1)*4+c])+fy*((1-fx)*input.data[(y1*src.width+x0)*4+c]+fx*input.data[(y1*src.width+x1)*4+c]);
            if(filter!=='color') {let gray=pixels.data[i]*0.299+pixels.data[i+1]*0.587+pixels.data[i+2]*0.114;if(filter==='document')gray=Math.max(0,Math.min(255,(gray-110)*1.6+130));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;}
            pixels.data[i+3]=255;
        }
        // Keep the mobile interface responsive during perspective correction.
        if(y%120===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    ctx.putImageData(pixels,0,0);
    if(rotation%360===0)return canvasScanBlob(out);
    const rotated=document.createElement('canvas'),swap=rotation%180!==0;rotated.width=swap?height:width;rotated.height=swap?width:height;
    const rc=rotated.getContext('2d');rc.translate(rotated.width/2,rotated.height/2);rc.rotate(rotation*Math.PI/180);rc.drawImage(out,-width/2,-height/2);
    return canvasScanBlob(rotated);
}

export async function makeScanPdf(pages,title) {
    if(!pages?.length || pages.length>SCAN_LIMITS.pages)throw new Error('Ajoutez entre 1 et 15 pages.');
    const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create();pdf.setTitle(title);pdf.setCreator('Portail SRP');
    for(const page of pages) {
        if(!(page.blob instanceof Blob) || page.blob.type!=='image/jpeg')throw new Error('Une page est illisible. Reprenez-la avant de créer le PDF.');
        const image=await pdf.embedJpg(await page.blob.arrayBuffer()),landscape=image.width>image.height;
        const sheet=pdf.addPage(landscape?[841.89,595.28]:[595.28,841.89]),{width,height}=sheet.getSize();
        const scale=Math.min((width-28)/image.width,(height-28)/image.height),w=image.width*scale,h=image.height*scale;
        sheet.drawImage(image,{x:(width-w)/2,y:(height-h)/2,width:w,height:h});
    }
    const blob=new Blob([await pdf.save()],{type:'application/pdf'});
    if(blob.size>SCAN_LIMITS.pdfBytes)throw new Error('Le PDF dépasse 10 Mo. Répartissez les pages dans plusieurs documents.');
    return blob;
}
