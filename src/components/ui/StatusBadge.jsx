import { statusPresentation } from '../../utils/statusPresentation';
import './StatusBadge.css';
export default function StatusBadge({status,label,className=''}){const presentation=statusPresentation(status);return <span className={`srp-status ${className}`} data-tone={presentation.tone}><span aria-hidden="true" className="srp-status-dot"/>{label || presentation.label}</span>;}
