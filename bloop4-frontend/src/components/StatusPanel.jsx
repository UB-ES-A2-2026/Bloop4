/** Panell per a estats buits i d'error, amb una acció opcional. */
export default function StatusPanel({ title, text, actionLabel, onAction, role = 'status' }) {
  return (
    <div className="empty-state" role={role}>
      <h2 className="empty-state__title">{title}</h2>
      {text && <p className="empty-state__text">{text}</p>}
      {actionLabel && (
        <button type="button" className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
