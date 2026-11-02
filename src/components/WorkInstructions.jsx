import { useEffect,useRef,useState } from 'react';
import { requestOdoo } from '../services/odooService';
import './WorkInstructions.css';

const quantity=value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(value);

export default function WorkInstructions({interventionId,fallback,isAdmin=false}){
    const [orderReference,setOrderReference]=useState('');
    const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),alive=useRef(true);
    useEffect(()=>{alive.current=true;setBusy(true);setError('');let active=true;requestOdoo({action:'work_instructions',interventionId:Number(interventionId),...(orderReference?{orderReference}:{})})
        .then(result=>{if(active)setData(result);}).catch(e=>{if(active){setData(null);setError(e.message);}}).finally(()=>{if(active)setBusy(false);});
        return()=>{active=false;alive.current=false;};},[interventionId,orderReference]);
    return <section className="work-instructions" aria-labelledby="work-instructions-title">
        <header><div><small>DEVIS SYNCHRONISÉ</small><h2 id="work-instructions-title">Travaux à réaliser</h2></div>{busy&&<span>Actualisation…</span>}</header>
        {isAdmin&&data?.choices?.length>0&&<label>Devis validé à consulter<select disabled={busy} value={orderReference} onChange={e=>setOrderReference(e.target.value)}><option value="">Dernier devis validé (automatique)</option>{data.choices.map(order=><option key={order.reference} value={order.reference}>{order.reference}{order.date?` · ${String(order.date).slice(0,10)}`:''}</option>)}</select><small>Ce choix change votre consultation. Les employés voient automatiquement le dernier devis validé.</small></label>}
        {error&&<p role="alert">Les désignations Odoo ne sont pas disponibles : {error}</p>}
        {!busy&&!error&&!data?.orders?.length&&<><p>Aucune désignation de devis trouvée automatiquement pour ce client.</p>{fallback&&<p><strong>Mission indiquée :</strong> {fallback}</p>}</>}
        {data?.orders?.map(order=><article key={order.reference}><h3>{order.reference}</h3><ol>{order.lines.map((line,index)=><li key={`${order.reference}:${index}`}><span>{line.designation}</span><strong>{quantity(line.quantity)} {line.unit}</strong></li>)}</ol></article>)}
        {!!data?.orders?.length&&<p className="work-instructions-note">Informations techniques uniquement. Les tarifs, remises, taxes et totaux ne sont jamais transmis.</p>}
    </section>;
}
