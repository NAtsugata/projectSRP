import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildDashboardSummary } from '../../utils/dashboardSummary';

export default function ActivitySummary({ interventions = [], expenses = [], contracts = [], cerfaCount = 0 }) {
  const summary = useMemo(() => buildDashboardSummary({ interventions, expenses, contracts, cerfaCount }), [interventions, expenses, contracts, cerfaCount]);
  return (
    <section className="chart-card summary-card" aria-labelledby="activity-summary-title">
      <h3 className="chart-title" id="activity-summary-title">Résumé de l’activité</h3>
      <div className="summary-grid">
        {summary.map(item => (
          <Link key={item.id} to={item.to} className={`summary-item summary-link summary-${item.id}`}>
            <span className="summary-icon" aria-hidden="true">{item.icon}</span>
            <div className="summary-data">
              <span className="summary-value">{item.value}{item.unit && <span className="summary-unit"> {item.unit}</span>}</span>
              <span className="summary-label">{item.label}</span>
              {item.period && <span className="summary-period">{item.period}</span>}
            </div>
            {item.secondaryValue && <div className="summary-amount"><span>{item.secondaryLabel}</span><strong>{item.secondaryValue}</strong></div>}
            <span className="summary-action">{item.action}<span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
