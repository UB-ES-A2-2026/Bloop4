import { useState } from 'react';
import ProductVisual from './ProductVisual';

/**
 * Galeria de la fitxa. Si el producte no té imatges o la que es mostra no carrega,
 * es mostra la il·lustració per defecte de la categoria.
 */
export default function ProductGallery({ product }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(() => new Set());
  const images = product.images.filter((image) => !failed.has(image.path));
  const current = images[Math.min(selected, images.length - 1)];

  if (!current) {
    return (
      <div className="gallery">
        <ProductVisual product={product} className="card__media gallery__main" />
      </div>
    );
  }

  return (
    <div className="gallery">
      <img
        className="gallery__main gallery__image"
        src={current.path}
        alt={current.altText}
        width="800"
        height="640"
        loading="lazy"
        onError={() => setFailed((set) => new Set(set).add(current.path))}
      />
      {images.length > 1 && (
        <div className="gallery__thumbs">
          {images.map((image, index) => (
            <button
              key={image.path}
              type="button"
              className="gallery__thumb"
              aria-label={`Ver imagen ${index + 1}`}
              aria-pressed={image === current}
              onClick={() => setSelected(index)}
            >
              <img src={image.path} alt="" width="96" height="77" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
