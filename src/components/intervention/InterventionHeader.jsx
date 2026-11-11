import { CalendarIcon, ChevronLeftIcon, ClockIcon, MapPinIcon, PhoneIcon, UsersIcon } from '../SharedUI';
import { statusPresentation } from '../../utils/statusPresentation';
import './InterventionHeader.css';

const appointmentDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function InterventionHeader({ intervention, status, team, duration, urgentCount, onBack }) {
  const { client, service, date, time, address, client_phone: phone } = intervention;
  const day = date ? new Date(`${String(date).slice(0, 10)}T00:00:00`) : null;
  const dateLabel = day && !Number.isNaN(day.getTime()) ? appointmentDate.format(day) : 'Date à confirmer';
  const isUrgent = urgentCount > 0 || intervention.additional_needs?.some(need => need.isUrgent);
  const directions = address && `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  const presentation = statusPresentation(status);

  return (
    <header className="intervention-hero">
      <button type="button" className="intervention-back" onClick={onBack}>
        <ChevronLeftIcon /> Planning
      </button>
      <div className="intervention-hero-badges">
        <span className="intervention-status" data-tone={presentation.tone}>{presentation.label}</span>
        {isUrgent && <span className="intervention-priority">Urgent</span>}
        {intervention.follow_up_required && <span className="intervention-priority">SAV</span>}
      </div>

      <div className="intervention-hero-main">
        <h1>{client || 'Intervention'}</h1>
        {service && <p>{service}</p>}
      </div>

      <div className="intervention-meta-line">
        <dl className="intervention-meta">
          <div><dt><CalendarIcon /><span>Rendez-vous</span></dt><dd>{dateLabel}{time && ` · ${String(time).slice(0, 5)}`}</dd></div>
          <div><dt><MapPinIcon /><span>Adresse</span></dt><dd>{address || 'Adresse à renseigner'}</dd></div>
          <div><dt><UsersIcon /><span>Équipe</span></dt><dd>{team}</dd></div>
          {duration && <div><dt><ClockIcon /><span>Temps sur place</span></dt><dd>{duration}</dd></div>}
        </dl>
        {(phone || directions) && <div className="intervention-hero-actions">
          {phone && <a className="intervention-contact" href={`tel:${phone}`}><PhoneIcon /> Appeler</a>}
          {directions && <a className="intervention-contact" href={directions} target="_blank" rel="noopener noreferrer"><MapPinIcon /> Itinéraire</a>}
        </div>}
      </div>
    </header>
  );
}
