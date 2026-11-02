import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CalendarIcon, ListIcon, MapPinIcon, ClockIcon, CheckCircleIcon, ChevronRightIcon as ArrowRightIcon, FileTextIcon, DollarSignIcon, SunIcon } from '../components/SharedUI';
import { InterventionList, PlanningGanttView } from '../components/planning';
import { QuickAlertButton } from '../components/employee';
import { LoadingSpinner } from '../components/ui';
import { employeeOverview, employeeTimeLabel } from '../utils/employeeOverview';
import { getDayTeamNames } from '../utils/teamForDate';
import './EmployeePlanningView.css';

const dayLabel=(day,options={weekday:'long',day:'numeric',month:'long'})=>new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris',...options});
const shortcuts=[{href:'/agenda',title:'Mon agenda',text:'Voir mes rendez-vous',icon:CalendarIcon},{href:'/expenses',title:'Mes dépenses',text:'Ajouter un justificatif',icon:DollarSignIcon},{href:'/leaves',title:'Mes congés',text:'Consulter mes demandes',icon:SunIcon},{href:'/documents',title:'Mes documents',text:'Retrouver mes fichiers',icon:FileTextIcon}];
function Appointment({row,usersMap,featured=false}) {
    const {item,date}=row,team=getDayTeamNames(item,date,usersMap),done=item.status==='Terminée';
    return <article className={`field-appointment ${featured?'is-featured':''} ${done?'is-complete':''}`}>
        <div className="field-appointment-top"><span className="field-time"><ClockIcon/>{employeeTimeLabel(item)}</span><span className={`field-status ${done?'complete':item.status==='En cours'?'running':'planned'}`}>{item.status || 'À venir'}</span></div>
        <h3><Link to={`/planning/${encodeURIComponent(item.id)}`}>{item.client || 'Intervention'}</Link></h3>
        <p className="field-service">{item.service || 'Consignes à consulter dans la fiche'}</p>
        {item.address && <p className="field-address"><MapPinIcon/><span>{item.address}</span></p>}
        {team.length>0 && <p className="field-team">Équipe du jour : {team.join(', ')}</p>}
        <div className="field-appointment-actions"><Link className="field-primary-link" to={`/planning/${encodeURIComponent(item.id)}`}>{done?'Consulter le compte rendu':featured?'Ouvrir mon intervention':'Voir les détails'}<ArrowRightIcon/></Link>
            {item.address && <a className="field-map-link" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer">Itinéraire<span className="workspace-sr-only"> — ouvre Google Maps</span></a>}
        </div>
    </article>;
}
export default function EmployeeFieldWorkspace({interventions=[],loading=false,error=null,userId,userName='Collaborateur',users=[],allowedLinks=[]}) {
    const navigate=useNavigate(),[now,setNow]=useState(()=>new Date()),[period,setPeriod]=useState('today');
    const [viewMode,setViewMode]=useState(()=>{try{const saved=localStorage.getItem('employeePlanningViewMode');return ['day','list','gantt'].includes(saved)?saved:'day';}catch{return 'day';}});
    useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
    const overview=useMemo(()=>employeeOverview(interventions,userId,now),[interventions,userId,now]);
    const usersMap=useMemo(()=>Object.fromEntries(users.map(u=>[u.id,u])),[users]);
    const rows=overview.occurrences.filter(row=>period==='today'?row.date===overview.today:period==='tomorrow'?row.date===overview.tomorrow:overview.week.some(d=>d.date===row.date));
    const changeView=mode=>{setViewMode(mode);try{localStorage.setItem('employeePlanningViewMode',mode);}catch{/* Browsing remains available with storage disabled. */}};
    const handleView=useCallback(item=>navigate(`/planning/${encodeURIComponent(item.id)}`),[navigate]);
    const progress=overview.todayRows.length?Math.round(overview.todayCompleted/overview.todayRows.length*100):0,maxDay=Math.max(1,...overview.week.map(d=>d.total));
    const links=shortcuts.filter(link=>allowedLinks.includes(link.href));
    return <div className="employee-planning-view field-workspace">
        <header className="field-heading"><div><span className="field-eyebrow">MON ESPACE TERRAIN</span><h1>Bonjour, {userName.split(' ')[0]}<span className="field-heading-dot">.</span></h1><p>{dayLabel(overview.today)} · Votre journée, en un coup d’œil.</p></div><QuickAlertButton userId={userId} userName={userName} currentIntervention={overview.next?.item}/></header>
        {error && <p role="alert" className="field-error">Le planning n’a pas pu être actualisé. Réessayez en rechargeant la page. {error.message}</p>}
        {loading?<LoadingSpinner text="Chargement de votre planning…"/>:<>
            <section className="field-summary" aria-label="Résumé de mon planning">
                <button type="button" onClick={()=>{setPeriod('today');changeView('day');}}><span className="field-stat-icon"><CalendarIcon/></span><span><small>Aujourd’hui</small><strong>{overview.todayRows.length}<em>rendez-vous</em></strong></span><ArrowRightIcon/></button>
                <button type="button" onClick={()=>{setPeriod('week');changeView('day');}}><span className="field-stat-icon is-copper"><ListIcon/></span><span><small>Cette semaine</small><strong>{overview.weekTotal}<em>rendez-vous</em></strong></span><ArrowRightIcon/></button>
                <button type="button" onClick={()=>{setPeriod('today');changeView('day');}}><span className="field-stat-icon"><CheckCircleIcon/></span><span><small>Terminés aujourd’hui</small><strong>{overview.todayCompleted}<em>sur {overview.todayRows.length}</em></strong></span><ArrowRightIcon/></button>
            </section>
            <div className="field-overview-grid"><section className="field-next"><div className="field-section-title"><span className="field-eyebrow">{overview.next?.item.status==='En cours'?'EN COURS':'MON PROCHAIN RENDEZ-VOUS'}</span>{overview.next && <span>{overview.next.date===overview.today?'Aujourd’hui':dayLabel(overview.next.date,{day:'numeric',month:'short'})}</span>}</div>
                {overview.next?<Appointment row={overview.next} usersMap={usersMap} featured/>:<div className="field-empty"><CheckCircleIcon/><h3>Aucun rendez-vous à venir</h3><p>Votre planning se mettra à jour dès qu’une intervention vous sera attribuée.</p></div>}
            </section><aside className="field-week"><div className="field-section-title"><h2>Ma semaine</h2><span>{overview.weekTotal} RDV</span></div><p>Du {dayLabel(overview.week[0].date,{day:'numeric',month:'short'})} au {dayLabel(overview.week[6].date,{day:'numeric',month:'short'})}</p>
                <div className="field-week-chart" aria-label="Rendez-vous par jour de la semaine">{overview.week.map(day=><button type="button" key={day.date} className={day.date===overview.today?'is-today':''} aria-label={`${dayLabel(day.date)} : ${day.total} rendez-vous, ${day.completed} terminés`} onClick={()=>{setPeriod('week');changeView('day');}}><strong>{day.total}</strong><span className="field-bar-track"><span className="field-bar-total" style={{height:`${day.total/maxDay*100}%`}}><span className="field-bar-complete" style={{height:`${day.total?day.completed/day.total*100:0}%`}}/></span></span><span>{dayLabel(day.date,{weekday:'short'}).replace('.','')}</span></button>)}</div>
                <div className="field-chart-legend"><span>Planifiés</span><span>Terminés</span></div><p className="field-chart-note">Selon les statuts enregistrés dans vos interventions.</p>
            </aside></div>
            {links.length>0 && <nav className="field-shortcuts" aria-label="Mes accès rapides">{links.map(link=><Link to={link.href} key={link.href}><link.icon/><span><strong>{link.title}</strong><small>{link.text}</small></span><ArrowRightIcon/></Link>)}</nav>}
            <section className="field-planning-section"><div className="field-section-title field-planning-title"><div><span className="field-eyebrow">MES INTERVENTIONS</span><h2>Mon planning</h2></div><div className="field-view-tabs" role="group" aria-label="Affichage du planning">{[['day','Mon parcours'],['gantt','Planning'],['list','Liste']].map(([value,label])=><button type="button" key={value} aria-pressed={viewMode===value} onClick={()=>changeView(value)}>{label}</button>)}</div></div>
                {viewMode==='day' && <><div className="field-period-tabs" role="group" aria-label="Période du planning">{[['today','Aujourd’hui'],['tomorrow','Demain'],['week','Cette semaine']].map(([value,label])=><button type="button" aria-pressed={period===value} key={value} onClick={()=>setPeriod(value)}>{label}</button>)}</div>
                    {period==='today' && overview.todayRows.length>0 && <div className="field-day-progress"><span>{overview.todayCompleted} sur {overview.todayRows.length} rendez-vous terminés</span><progress value={progress} max="100" aria-label="Avancement des rendez-vous du jour"/></div>}
                    {rows.length?<ol className="field-timeline">{rows.map((row,index)=><li key={row.key}><div className="field-timeline-marker"><span>{String(index+1).padStart(2,'0')}</span><time dateTime={row.date}>{dayLabel(row.date,{day:'numeric',month:'short'})}</time></div><Appointment row={row} usersMap={usersMap}/></li>)}</ol>:<div className="field-empty"><CalendarIcon/><h3>Aucun rendez-vous sur cette période</h3><p>Consultez les autres jours ou votre planning complet.</p><button type="button" onClick={()=>changeView('gantt')}>Ouvrir le planning complet</button></div>}
                </>}
                {viewMode==='gantt' && <div className="field-legacy-view"><PlanningGanttView interventions={interventions} users={users} onInterventionClick={handleView}/></div>}
                {viewMode==='list' && <div className="field-legacy-view"><InterventionList interventions={interventions} onView={handleView} showFilters showSort showActions={false}/></div>}
            </section>
        </>}
    </div>;
}
