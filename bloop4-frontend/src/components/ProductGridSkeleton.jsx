// Placeholder de càrrega del disseny original (animació bloopPulse).
export default function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="product-grid" aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="skeleton skeleton--media" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}
