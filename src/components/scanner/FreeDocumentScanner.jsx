import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fullPageCorners, detectScanCorners, prepareScanPhoto, renderScanPage, makeScanPdf, SCAN_LIMITS } from '../../utils/freeScanner';
import './FreeDocumentScanner.css';

const categories={autre:'Autre',facture:'Facture',contrat:'Contrat',rapport:'Rapport',personnel:'Personnel',administratif:'Administratif'};
const cornerNames=['haut gauche','haut droit','bas droit','bas gauche'];

export default function FreeDocumentScanner({onSave,onClose}) {
    const profile=useAuthStore(s=>s.profile),scope=`${profile?.organization_id}:${profile?.id}`;
    const [selected,setSelected]=useState([]),[series,setSeries]=useState(true);
    const [pages,setPages]=useState([]),[draft,setDraft]=useState(null),[corners,setCorners]=useState(fullPageCorners);
    const [filter,setFilter]=useState('color'),[rotation,setRotation]=useState(0),[busy,setBusy]=useState(''),[error,setError]=useState(''),[hint,setHint]=useState('');
    const [title,setTitle]=useState('Document scanné'),[category,setCategory]=useState('autre'),[pdf,setPdf]=useState(null),[camera,setCamera]=useState(false),[ready,setReady]=useState(false);
    const fileInput=useRef(null),photoInput=useRef(null),video=useRef(null),stream=useRef(null),mounted=useRef(true),lock=useRef(false),urls=useRef(new Set()),initialScope=useRef(scope);
    const active=()=>mounted.current && initialScope.current===`${useAuthStore.getState().profile?.organization_id}:${useAuthStore.getState().profile?.id}`;
    function urlFor(blob){const url=URL.createObjectURL(blob);urls.current.add(url);return url;}
    function release(url){if(url && urls.current.delete(url))URL.revokeObjectURL(url);}
    function stopCamera(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false);setReady(false);}
    function clearPdf(){if(pdf)release(pdf.url);setPdf(null);}
    useEffect(()=>{
        mounted.current=true;
        return()=>{mounted.current=false;stream.current?.getTracks().forEach(t=>t.stop());urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();};
    },[]);
    useEffect(()=>{if(initialScope.current!==scope){stream.current?.getTracks().forEach(t=>t.stop());onClose();}},[scope,onClose]);
    useEffect(()=>{if(camera && video.current && stream.current){video.current.srcObject=stream.current;video.current.play().catch(()=>setError('Utilisez « Prendre une photo » si la caméra ne démarre pas.'));}},[camera]);

    async function run(label,fn){if(lock.current)return;lock.current=true;setBusy(label);setError('');try{await fn();}catch(e){if(active())setError(e.message || 'Le traitement a échoué. Vos pages sont conservées.');}finally{lock.current=false;if(active())setBusy('');}}
    async function detect(canvas) {
        const small=document.createElement('canvas'),scale=Math.min(1,800/Math.max(canvas.width,canvas.height));small.width=Math.round(canvas.width*scale);small.height=Math.round(canvas.height*scale);
        const ctx=small.getContext('2d');ctx.drawImage(canvas,0,0,small.width,small.height);
        return detectScanCorners(ctx.getImageData(0,0,small.width,small.height));
    }
    async function importPhoto(file){
        if(pages.length>=SCAN_LIMITS.pages)throw new Error('Limite de 15 pages atteinte. Enregistrez ce document avant de continuer.');
        const {blob,canvas}=await prepareScanPhoto(file);
        let found=null;try{found=await detect(canvas);}catch{/* Preserve the whole image when detection fails. */}
        if(!active())return;
        setDraft({url:urlFor(blob)});setCorners(found || fullPageCorners());setFilter('color');setRotation(0);clearPdf();
        setHint(found?'Bords détectés : vérifiez les quatre coins avant de valider.':'Aucun bord fiable détecté : la photo entière est conservée. Ajustez les coins si nécessaire.');
    }
    async function appendPhoto(file){
        const {blob,canvas}=await prepareScanPhoto(file);let found=null;try{found=await detect(canvas);}catch{}
        const source=urlFor(blob);
        try{const rendered=found?await renderScanPage(source,found,'color',0):blob;if(!active())return;
            setPages(items=>[...items,{id:crypto.randomUUID(),blob:rendered,url:urlFor(rendered)}]);clearPdf();
            setHint(found?'Page ajoutée et recadrée. Vérifiez les miniatures.':'Page ajoutée entière : vérifiez le recadrage.');
        }finally{release(source);}
    }
    function readFile(event){const files=Array.from(event.target.files || []);event.target.value='';if(!files.length)return;
        if(files.length===1)return run('Analyse de la photo…',()=>importPhoto(files[0]));
        run('Import des photos…',async()=>{if(pages.length+files.length>SCAN_LIMITS.pages)throw new Error('15 pages maximum. Sélectionnez moins de photos.');
            for(let i=0;i<files.length;i++){if(!active())return;setBusy(`Import de la photo ${i+1}/${files.length}…`);await appendPhoto(files[i]);}
        });
    }
    async function startCamera(){await run('Ouverture de la caméra…',async()=>{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Caméra indisponible ici. Utilisez « Prendre une photo » ou importez une image.');
        let media;try{media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2400},height:{ideal:1800}},audio:false});}catch{throw new Error('Accès à la caméra refusé ou indisponible. Utilisez « Prendre une photo » ou importez une image.');}
        if(!active()){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;setCamera(true);
    });}
    async function capture(){await run('Analyse de la photo…',async()=>{
        if(pages.length>=SCAN_LIMITS.pages)throw new Error('Limite de 15 pages atteinte. Terminez ce document.');
        const v=video.current;if(!v?.videoWidth)throw new Error('La caméra n’est pas encore prête.');
        const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);if(!series)stopCamera();
        const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',0.95));if(!blob)throw new Error('Photo non capturée. Réessayez.');
        const file=new File([blob],'photo.jpg',{type:'image/jpeg'});if(series)await appendPhoto(file);else await importPhoto(file);
    });}
    function moveCorner(index,point){setCorners(values=>values.map((v,i)=>i===index?{...v,...point}:v));}
    function dragCorner(event,index){if(!event.buttons && event.pointerType==='mouse')return;const rect=event.currentTarget.parentElement.getBoundingClientRect();moveCorner(index,{x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))});}
    async function addPage(){await run('Redressement de la page…',async()=>{
        const blob=await renderScanPage(draft.url,corners,filter,rotation);if(!active())return;
        const page={id:draft.id || crypto.randomUUID(),blob,url:urlFor(blob)};setPages(items=>draft.id?items.map(item=>item.id===draft.id?page:item):[...items,page]);release(draft.url);setDraft(null);setHint('Page ajoutée. Prenez la suivante ou vérifiez le PDF.');
    });}
    function removePage(id){clearPdf();release(pages.find(p=>p.id===id)?.url);setPages(items=>items.filter(p=>p.id!==id));}
    function removeSelected(){clearPdf();pages.filter(p=>selected.includes(p.id)).forEach(p=>release(p.url));setPages(items=>items.filter(p=>!selected.includes(p.id)));setSelected([]);}
    function editPage(page){stopCamera();clearPdf();setDraft({id:page.id,url:urlFor(page.blob)});setCorners(fullPageCorners());setRotation(0);setFilter('color');}
    function reorder(index,offset){clearPdf();setPages(items=>{const copy=[...items];[copy[index],copy[index+offset]]=[copy[index+offset],copy[index]];return copy;});}
    async function previewPdf(){stopCamera();await run('Création du PDF…',async()=>{const blob=await makeScanPdf(pages,title.trim() || 'Document scanné');if(active()){clearPdf();setPdf({blob,url:urlFor(blob)});}});}
    async function save(){await run('Enregistrement dans Mes documents…',async()=>{
        if(!title.trim())throw new Error('Donnez un nom au document.');
        if(!active())throw new Error('La session a changé. Rouvrez le scanner.');
        const result=await onSave([{blob:pdf.blob,timestamp:new Date().toISOString(),pageCount:pages.length}],{title:title.trim(),category});
        if(result?.error)throw result.error;
    });}
    function download(){const link=document.createElement('a');link.href=pdf.url;link.download=`${title.replace(/[\\/:*?"<>|]/g,'_').trim() || 'scan'}.pdf`;link.click();}
    function close(){if(!busy && (!pages.length && !draft || window.confirm('Quitter le scanner ? Les pages non enregistrées seront perdues.'))){stopCamera();onClose();}}
    return <section className="free-scanner" aria-label="Scanner de documents">
        <header><div><small>MES DOCUMENTS</small><h2>Scanner un document</h2><p>Photo → recadrage → PDF → enregistrement</p></div><button type="button" disabled={!!busy} onClick={close}>Retour aux documents</button></header>
        <p className="free-scan-privacy">Traitement sur votre appareil, sans service de scan payant. Le PDF est envoyé à votre espace uniquement lors de l’enregistrement.</p>
        {error && <p className="free-scan-error" role="alert">{error}</p>}{busy && <p role="status" aria-live="polite">{busy}</p>}
        <fieldset disabled={!!busy}>
            {!draft && !pdf && !camera && <div className="free-scan-capture"><h3>{pages.length?'Ajouter une page':'1. Photographier ou importer'}</h3><p>Posez la feuille à plat sur un fond contrasté, avec un bon éclairage.</p><div className="free-scan-actions">
                <button type="button" onClick={()=>photoInput.current.click()} disabled={pages.length>=15}>Prendre une photo</button>
                <button type="button" onClick={()=>fileInput.current.click()} disabled={pages.length>=15}>Importer des photos</button>
                <button type="button" onClick={startCamera} disabled={pages.length>=15}>Caméra en direct</button>
            </div><p>JPEG, PNG ou WebP · 20 Mo par photo · 15 pages maximum · PDF limité à 10 Mo</p></div>}
            <input ref={photoInput} aria-label="Photo du document" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={readFile}/>
            <input ref={fileInput} aria-label="Importer les photos du document" type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={readFile}/>
            {camera && <div className="free-scan-camera"><label><input type="checkbox" checked={series} onChange={e=>setSeries(e.target.checked)}/> Mode série : ajouter les pages sans fermer la caméra</label><p>{pages.length}/15 pages capturées</p><video ref={video} autoPlay playsInline muted onLoadedData={()=>setReady(true)} aria-label="Caméra du document"/><div className="free-scan-actions"><button type="button" disabled={!ready || pages.length>=15} onClick={capture}>Photographier la page</button><button type="button" onClick={stopCamera}>Terminer les prises de vue</button></div></div>}
            {draft && <div><h3>2. Vérifier et recadrer</h3><p role="status">{hint}</p><div className="free-scan-editor"><img src={draft.url} alt="Photo à recadrer" draggable="false"/><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={corners.map(c=>`${c.x*100},${c.y*100}`).join(' ')}/></svg>
                {corners.map((c,i)=><button className="free-scan-corner" type="button" key={i} aria-label={`Déplacer le coin ${cornerNames[i]}`} style={{left:`${c.x*100}%`,top:`${c.y*100}%`}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);dragCorner(e,i);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))dragCorner(e,i);}} onKeyDown={e=>{const delta={ArrowLeft:{x:c.x-0.01},ArrowRight:{x:c.x+0.01},ArrowUp:{y:c.y-0.01},ArrowDown:{y:c.y+0.01}}[e.key];if(delta){e.preventDefault();moveCorner(i,Object.fromEntries(Object.entries(delta).map(([k,v])=>[k,Math.max(0,Math.min(1,v))])));}}}>{i+1}</button>)}
            </div><details><summary>Ajuster les coins avec précision</summary><div className="free-scan-sliders">{corners.map((c,i)=><div key={i}><strong>Coin {cornerNames[i]}</strong>{['x','y'].map(axis=><label key={axis}>{axis==='x'?'Horizontal':'Vertical'}<input aria-label={`Coin ${cornerNames[i]} ${axis}`} type="range" min="0" max="100" step="0.5" value={c[axis]*100} onChange={e=>moveCorner(i,{[axis]:Number(e.target.value)/100})}/></label>)}</div>)}</div></details>
                <div className="free-scan-actions"><button type="button" onClick={()=>setCorners(fullPageCorners())}>Garder toute la photo</button><label>Rendu<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="color">Couleur originale</option><option value="gray">Niveaux de gris</option><option value="document">Document contrasté</option></select></label><button type="button" onClick={()=>setRotation(r=>(r+90)%360)}>Rotation : {rotation}°</button><button type="button" onClick={addPage}>Valider et ajouter la page</button><button type="button" onClick={()=>{release(draft.url);setDraft(null);}}>Reprendre la photo</button></div><p>Le rendu et la rotation s’affichent après validation. Les flèches du clavier déplacent aussi les coins.</p></div>}
            {!draft && pages.length>0 && <div><h3>{pages.length} page{pages.length>1?'s':''} dans le document</h3><div className="free-scan-actions"><button type="button" onClick={()=>setSelected(pages.map(p=>p.id))}>Tout sélectionner</button><button type="button" onClick={()=>setSelected([])}>Désélectionner</button><button type="button" disabled={!selected.length} onClick={removeSelected}>Retirer la sélection ({selected.length})</button></div><ol className="free-scan-pages">{pages.map((page,i)=><li key={page.id}><img src={page.url} alt={`Page ${i+1}`}/><label><input type="checkbox" aria-label={`Sélectionner la page ${i+1}`} checked={selected.includes(page.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,page.id]:ids.filter(id=>id!==page.id))}/> Page {i+1}</label><button type="button" onClick={()=>editPage(page)}>Recadrer / pivoter</button><div><button type="button" disabled={i===0} aria-label={`Avancer la page ${i+1}`} onClick={()=>reorder(i,-1)}>←</button><button type="button" disabled={i===pages.length-1} aria-label={`Reculer la page ${i+1}`} onClick={()=>reorder(i,1)}>→</button><button type="button" onClick={()=>removePage(page.id)} aria-label={`Retirer la page ${i+1}`}>Retirer</button></div></li>)}</ol>
                <div className="free-scan-fields"><label>Nom du document<input required maxLength={180} value={title} onChange={e=>{setTitle(e.target.value);clearPdf();}}/></label><label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label></div>
                {!pdf && <button type="button" onClick={previewPdf}>Terminer et créer le PDF</button>}
                {pdf && <div><h3>3. Aperçu du PDF</h3><p>{pages.length} page(s) · {(pdf.blob.size/1024/1024).toFixed(2)} Mo · destination : Mes documents / {categories[category]}</p><iframe src={pdf.url} title="Aperçu du document PDF"/><p>Si l’aperçu n’est pas disponible sur votre téléphone, téléchargez le PDF pour le vérifier.</p><div className="free-scan-actions"><button type="button" onClick={download}>Télécharger le PDF</button><button type="button" onClick={clearPdf}>Ajouter une autre page</button><button type="button" onClick={save}>Enregistrer dans Mes documents</button></div></div>}
            </div>}
        </fieldset>
    </section>;
}
