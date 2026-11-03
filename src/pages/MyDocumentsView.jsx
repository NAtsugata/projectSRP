import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { CameraIcon, SearchIcon, DownloadIcon, TrashIcon, EyeIcon, FolderIcon, FileTextIcon } from '../components/SharedUI';
import { useDownload } from '../hooks/useDownload';
import { storageService } from '../lib/supabase';
import { documentLibrary } from '../utils/documentLibrary';
import './MyDocumentsView.css';

const Scanner=lazyWithRetry(()=>import('../components/scanner/FreeDocumentScanner'));
const categories={facture:'Facture',contrat:'Contrat',rapport:'Rapport',personnel:'Personnel',administratif:'Administratif',autre:'Autre'};
const sizeLabel=bytes=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} Mo`:`${Math.ceil(bytes/1024)} Ko`;

export default function MyDocumentsView({scannedDocuments=[],profile,users=[],onSaveDocuments,onDeleteDocument}){
 const [params,setParams]=useSearchParams();
 const [scanner,setScanner]=useState(null),[search,setSearch]=useState(''),[category,setCategory]=useState('all'),[owner,setOwner]=useState('all'),[sort,setSort]=useState('recent');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[working,setWorking]=useState(null);
 const {downloadFile}=useDownload(),isAdmin=profile?.is_admin===true;
 const library=useMemo(()=>documentLibrary(scannedDocuments,profile,{search,category,owner,sort}),[scannedDocuments,profile,search,category,owner,sort]);
 const openScanner=mode=>{setError('');setNotice('');setScanner(mode);};
 useEffect(()=>{
  const mode=params.get('scan');
  if(!profile?.id || !['photo','import'].includes(mode))return;
  setScanner(mode);
  const next=new URLSearchParams(params);next.delete('scan');setParams(next,{replace:true});
 },[params,setParams,profile?.id]);
 async function save(docs,metadata={}){
  if(!profile?.id || !profile?.organization_id || !onSaveDocuments)throw new Error('Session indisponible. Reconnectez-vous.');
  const result=await onSaveDocuments(docs,{title:metadata.title || 'Document scanné',category:metadata.category || 'autre',user_id:profile.id});
  if(result?.error)throw result.error;
  if(!result?.data?.length)throw new Error('Enregistrement impossible. Vos pages sont conservées.');
  setScanner(null);setNotice('Votre PDF est enregistré. Retrouvez-le dans les documents ci-dessous.');setCategory('all');setSearch('');setOwner('all');setSort('recent');return result;
 }
 async function documentAction(doc,action){
  setError('');setNotice('');
  if(action==='delete' && !window.confirm(`Supprimer « ${doc.title} » ?`))return;
  setWorking(doc.id);
  try{
   if(action==='delete'){const result=await onDeleteDocument(doc.id);if(result?.error)throw result.error;setNotice('Document supprimé.');}
   else{const path=storageService.extractFilePath(doc.file_url,'vault-files');const url=path?await storageService.refreshSignedUrl(path,'vault-files'):doc.file_url;
    if(!url)throw new Error('Ce document est indisponible.');
    if(action==='download')await downloadFile(url,doc.file_name || doc.title || 'document.pdf');else window.open(url,'_blank','noopener,noreferrer');}
  }catch(e){setError(e.message || 'Impossible de réaliser cette action. Réessayez.');}finally{setWorking(null);}
 }
 if(scanner)return <Suspense fallback={<div className="loading-container" role="status">Ouverture du scanner…</div>}><Scanner key={`${profile?.organization_id}:${profile?.id}`} initialMode={scanner} onSave={save} onClose={()=>setScanner(null)}/></Suspense>;
 return <div className="document-library">
  <header className="document-library-heading"><div><span className="document-eyebrow">VOTRE BUREAU NUMÉRIQUE</span><h1>{isAdmin?'Les documents de l’équipe':'Mes documents'}</h1><p>Capturez vos pages, créez un PDF et retrouvez-le au même endroit.</p></div><span className="document-scope"><span aria-hidden="true">●</span> {isAdmin?'Votre entité':'Votre espace personnel'}</span></header>
  <section className="document-scan-hero" aria-labelledby="document-scan-title"><div className="document-hero-copy"><span className="document-hero-icon"><CameraIcon/></span><span className="document-eyebrow">SCAN GRATUIT · JUSQU’À 15 PAGES</span><h2 id="document-scan-title">Du papier au PDF,<br/>en quelques gestes.</h2><p>Photographiez ou importez vos pages. Recadrez, mettez dans l’ordre, puis enregistrez votre document.</p><div className="document-hero-actions"><button type="button" onClick={()=>openScanner('photo')} disabled={!profile?.id}><CameraIcon/> Scanner un document</button><button type="button" onClick={()=>openScanner('import')} disabled={!profile?.id}><FolderIcon/> Importer des photos</button></div><small>Les images sont traitées sur votre appareil. L’envoi se fait à l’enregistrement.</small></div><div className="document-paper-scene" aria-hidden="true"><div className="document-paper"><span>SRP / DOCUMENT</span><strong>Tout est<br/>à sa place.</strong><i/><i/><i/><div>PDF <b>✓</b></div></div><span className="document-paper-label">Photographier → Vérifier → Ranger</span></div></section>
  {error&&<p className="document-feedback" role="alert">{error}</p>}{notice&&<p className="document-feedback" role="status">{notice}</p>}
  <section className="document-library-toolbar" aria-label="Rechercher et classer les documents"><div><h2>Votre bibliothèque <span>{library.total}</span></h2><p>{library.thisMonth} ce mois-ci · {sizeLabel(library.totalBytes)} sur les documents chargés</p></div><label className="document-search"><SearchIcon/><span className="workspace-sr-only">Rechercher un document</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, description, mot-clé…"/></label><label><span className="workspace-sr-only">Trier les documents</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Plus récents</option><option value="name">Nom du document</option><option value="oldest">Plus anciens</option></select></label>{isAdmin&&<label><span className="workspace-sr-only">Filtrer par personne</span><select value={owner} onChange={e=>setOwner(e.target.value)}><option value="all">Toute l’équipe</option>{users.map(user=><option key={user.id} value={user.id}>{user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()}</option>)}</select></label>}</section>
  <nav className="document-category-tabs" aria-label="Catégories de documents">{[['all','Tous'],...Object.entries(categories)].map(([value,label])=><button key={value} type="button" aria-pressed={category===value} onClick={()=>setCategory(value)}>{label}<span>{library.counts[value] || 0}</span></button>)}</nav>
  <p className="document-result-count">{library.documents.length} document{library.documents.length>1?'s':''} affiché{library.documents.length>1?'s':''}</p>
  {!library.documents.length?<section className="document-empty"><FolderIcon/><h3>{library.total?'Aucun résultat pour ces filtres':'Votre premier document commence ici'}</h3><p>{library.total?'Essayez un autre mot ou une autre catégorie.':'Un justificatif, un rapport ou un courrier : quelques photos suffisent.'}</p>{library.total?<button type="button" onClick={()=>{setSearch('');setCategory('all');setOwner('all');}}>Effacer les filtres</button>:<button type="button" onClick={()=>openScanner('photo')} disabled={!profile?.id}>Scanner mon premier document</button>}</section>:<div className="document-library-grid">{library.documents.map(doc=><article key={doc.id} className="document-library-card"><div className={`document-card-preview ${doc.thumbnail_url?'has-image':''}`}>{doc.thumbnail_url?<img loading="lazy" src={doc.thumbnail_url} alt={`Aperçu de ${doc.title}`}/>:<FileTextIcon/>}<span>{doc.file_type==='application/pdf'?'PDF':'DOCUMENT'}</span></div><div className="document-card-body"><span className="document-kind">{categories[doc.category] || 'Autre'}</span><h3>{doc.title}</h3><p>{doc.created_at?new Date(doc.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'Date non précisée'}{doc.file_size?` · ${sizeLabel(doc.file_size)}`:''}</p>{isAdmin&&<p>{users.find(user=>user.id===doc.user_id)?.full_name || 'Document de l’équipe'}</p>}{doc.tags?.length>0&&<p>{doc.tags.map(tag=>`#${tag}`).join(' ')}</p>}<div className="document-card-actions"><button type="button" disabled={!!working} aria-label={`Ouvrir ${doc.title}`} onClick={()=>documentAction(doc,'view')}><EyeIcon/> Ouvrir</button><button type="button" disabled={!!working} aria-label={`Télécharger ${doc.title}`} onClick={()=>documentAction(doc,'download')}><DownloadIcon/></button><button type="button" disabled={!!working} aria-label={`Supprimer ${doc.title}`} onClick={()=>documentAction(doc,'delete')}><TrashIcon/></button></div></div></article>)}</div>}
 </div>;
}
