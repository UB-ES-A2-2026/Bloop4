import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import PhotoUploader from '../components/PhotoUploader';
import StatusPanel from '../components/StatusPanel';
import { createProduct, fetchMyProduct, publishProduct, updateProduct } from '../api/sellerApi';
import { useCategories } from '../hooks/useCategories';
import { buildCategoryTree } from '../lib/catalog';

const EMPTY = {
  name: '',
  categoryId: '',
  dailyPrice: '',
  depositAmount: '0',
  insurance: '',
  description: '',
  units: '1',
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  specs: [{ name: '', value: '' }],
};

// Noms dels camps que pot retornar l'API a `details.missing` en publicar.
const MISSING_LABEL = {
  name: 'nombre',
  categoryId: 'categoría',
  images: 'al menos una foto',
  dailyPrice: 'precio por día mayor que 0',
  units: 'al menos una unidad',
  weightKg: 'peso',
  lengthCm: 'largo',
  widthCm: 'ancho',
  heightCm: 'alto',
};

function toForm(product) {
  const specs = Object.entries(product.specs ?? {}).map(([name, value]) => ({ name, value }));
  return {
    name: product.name,
    categoryId: product.category.id,
    dailyPrice: product.dailyPrice,
    depositAmount: product.depositAmount,
    insurance: product.insurance ?? '',
    description: product.description ?? '',
    units: String(product.units),
    weightKg: product.weightKg ?? '',
    lengthCm: product.lengthCm ?? '',
    widthCm: product.widthCm ?? '',
    heightCm: product.heightCm ?? '',
    specs: specs.length ? specs : [{ name: '', value: '' }],
  };
}

/** Cos per a l'API: els números com a text (l'API els valida) i les mides buides com a null. */
function toPayload(form) {
  const measure = (value) => (String(value).trim() === '' ? null : String(value).trim().replace(',', '.'));
  return {
    name: form.name,
    categoryId: form.categoryId,
    dailyPrice: String(form.dailyPrice).trim().replace(',', '.'),
    depositAmount: String(form.depositAmount || '0').trim().replace(',', '.'),
    insurance: form.insurance,
    description: form.description,
    units: Number.parseInt(form.units, 10) || 0,
    weightKg: measure(form.weightKg),
    lengthCm: measure(form.lengthCm),
    widthCm: measure(form.widthCm),
    heightCm: measure(form.heightCm),
    specs: Object.fromEntries(form.specs.filter((s) => s.name.trim() && s.value.trim()).map((s) => [s.name.trim(), s.value.trim()])),
  };
}

function Field({ label, children }) {
  return (
    <label className="form__field">
      <span className="form__label">{label}</span>
      {children}
    </label>
  );
}

/** Formulari de producte del venedor: /vendedor/productos/nuevo i /vendedor/productos/:id */
export default function SellerProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const categories = useCategories();
  const tree = useMemo(() => buildCategoryTree(categories.categories), [categories.categories]);

  const [form, setForm] = useState(EMPTY);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState(id ? 'loading' : 'ready');
  const [productStatus, setProductStatus] = useState('draft');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // En crear l'esborrany es navega a la seva URL i el missatge hi arriba per l'estat. El
  // component no es torna a muntar (és la mateixa posició de l'arbre), per això és un efecte.
  useEffect(() => {
    if (location.state?.message) setMessage(location.state.message);
  }, [location.state]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchMyProduct(id, { signal: controller.signal })
      .then((product) => {
        setForm(toForm(product));
        setImages(product.images);
        setProductStatus(product.status);
        setStatus('ready');
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [id]);

  const change = (event) => setForm((f) => ({ ...f, [event.target.name]: event.target.value }));
  const changeSpec = (index, key, value) =>
    setForm((f) => ({ ...f, specs: f.specs.map((s, i) => (i === index ? { ...s, [key]: value } : s)) }));

  /** Desa el formulari. @returns el producte desat o null si hi ha hagut un error */
  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const product = id ? await updateProduct(id, toPayload(form)) : await createProduct(toPayload(form));
      if (!id) {
        navigate(`/vendedor/productos/${product.id}`, {
          replace: true,
          state: { message: 'Borrador guardado. Ahora puedes añadir las fotos.' },
        });
      }
      setProductStatus(product.status);
      return product;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(event) {
    event.preventDefault();
    if ((await save()) && id) setMessage('Cambios guardados.');
  }

  async function publish() {
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const product = await publishProduct(saved.id);
      setProductStatus(product.status);
      setMessage('Producto publicado: ya aparece en el catálogo.');
    } catch (err) {
      const missing = err.details?.missing?.map((field) => MISSING_LABEL[field] ?? field);
      setError(missing?.length ? `Para publicar falta: ${missing.join(', ')}.` : err.message);
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando producto" />;
  if (status === 'error') return <StatusPanel role="alert" title="No se pudo cargar el producto" text={error} />;

  return (
    <section className="detail-page" aria-labelledby="product-form-title">
      <Link className="detail__back" to="/vendedor">← Mis productos</Link>
      <h1 id="product-form-title" className="detail__title">
        {id ? form.name || 'Producto' : 'Nuevo producto'}{' '}
        <span className={`badge badge--${productStatus}`}>{productStatus === 'published' ? 'Publicado' : 'Borrador'}</span>
      </h1>

      <form className="form seller-form" onSubmit={saveDraft} noValidate>
        <Field label="Nombre">
          <input className="form__input" name="name" value={form.name} onChange={change} maxLength={120} />
        </Field>
        <Field label="Categoría">
          <select className="form__input" name="categoryId" value={form.categoryId} onChange={change}>
            <option value="">Elige una categoría</option>
            {tree.map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                {parent.children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="form__row">
          <Field label="Precio por día (€)">
            <input className="form__input" name="dailyPrice" inputMode="decimal" value={form.dailyPrice} onChange={change} />
          </Field>
          <Field label="Fianza (€)">
            <input className="form__input" name="depositAmount" inputMode="decimal" value={form.depositAmount} onChange={change} />
          </Field>
          <Field label="Unidades">
            <input className="form__input" name="units" type="number" min="0" max="500" value={form.units} onChange={change} />
          </Field>
        </div>
        <div className="form__row">
          <Field label="Peso (kg)">
            <input className="form__input" name="weightKg" inputMode="decimal" value={form.weightKg} onChange={change} />
          </Field>
          <Field label="Largo (cm)">
            <input className="form__input" name="lengthCm" inputMode="decimal" value={form.lengthCm} onChange={change} />
          </Field>
          <Field label="Ancho (cm)">
            <input className="form__input" name="widthCm" inputMode="decimal" value={form.widthCm} onChange={change} />
          </Field>
          <Field label="Alto (cm)">
            <input className="form__input" name="heightCm" inputMode="decimal" value={form.heightCm} onChange={change} />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea className="form__input" name="description" rows="4" value={form.description} onChange={change} maxLength={2000} />
        </Field>
        <Field label="Condiciones del seguro (vacío = sin seguro)">
          <textarea className="form__input" name="insurance" rows="2" value={form.insurance} onChange={change} maxLength={2000} />
        </Field>

        <fieldset className="form__roles">
          <legend className="form__label">Especificaciones</legend>
          {form.specs.map((spec, index) => (
            <div key={index} className="form__row">
              <input className="form__input" aria-label={`Nombre de la especificación ${index + 1}`} placeholder="Potencia" value={spec.name} onChange={(e) => changeSpec(index, 'name', e.target.value)} />
              <input className="form__input" aria-label={`Valor de la especificación ${index + 1}`} placeholder="1300 W" value={spec.value} onChange={(e) => changeSpec(index, 'value', e.target.value)} />
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => setForm((f) => ({ ...f, specs: [...f.specs, { name: '', value: '' }] }))}>
            Añadir especificación
          </button>
        </fieldset>

        {id ? (
          <fieldset className="form__roles">
            <legend className="form__label">Fotos</legend>
            <PhotoUploader productId={id} images={images} onChange={setImages} />
          </fieldset>
        ) : (
          <p className="form__hint">Guarda el borrador para poder añadir las fotos.</p>
        )}

        {error && <p className="form__error" role="alert">{error}</p>}
        {message && <p className="auth-page__text" role="status">{message}</p>}
        <div className="form__actions">
          <button type="submit" className="btn-outline" disabled={saving}>Guardar borrador</button>
          {id && (
            <button type="button" className="btn-primary" onClick={publish} disabled={saving}>
              {productStatus === 'published' ? 'Guardar y mantener publicado' : 'Publicar'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
