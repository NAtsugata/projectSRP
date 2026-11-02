import { useEffect,useRef,useState } from 'react';
import { requestOdoo } from '../services/odooService';
import './WorkInstructions.css';

const quantity=value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(value);

export default function WorkInstructions({interventionId,fallback}){
    const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),alive=useRef(true);
    useEffect(()=>{alive.current=true;setBusy(true);setError('');requestOdoo({action:'work_instructions',interventionId:Number(interventionId)})
        .then(result=>{if(alive.current)setData(result);}).catch(e=>{if(alive.current)setError(e.message);}).finally(()=>{if(alive.current)setBusy(false);});
        return()=>{alive.current=false;};},[interventionId]);
    return <section className="work-instructions" aria-labelledby="work-instructions-title">
        <header><div><small>DEVIS SYNCHRONISÉ</small><h2 id="work-instructions-title">Travaux à réaliser</h2></div>{busy&&<span>Actualisation…</span>}</header>
        {error&&<p role="alert">Les désignations Odoo ne sont pas disponibles : {error}</p>}
        {!busy&&!error&&!data?.orders?.length&&<><p>Aucune désignation de devis trouvée automatiquement pour ce client.</p>{fallback&&<p><strong>Mission indiquée :</strong> {fallback}</p>}</>}
        {data?.orders?.map(order=><article key={order.reference}><h3>{order.reference}</h3><ol>{order.lines.map((line,index)=><li key={`${order.reference}:${index}`}><span>{line.designation}</span><strong>{quantity(line.quantity)} {line.unit}</strong></li>)}</ol></article>)}
        {!!data?.orders?.length&&<p className="work-instructions-note">Informations techniques uniquement. Les tarifs, remises, taxes et totaux ne sont jamais transmis.</p>}
    </section>;
}
