import { useAuth } from '../auth/AuthContext';

/** Inici del panell del venedor. El llistat i el formulari de productes arriben amb US-10. */
export default function SellerHome() {
  const { user } = useAuth();
  return (
    <section className="detail-page" aria-labelledby="seller-title">
      <div className="eyebrow">Panel del vendedor</div>
      <h1 id="seller-title" className="catalog__title">{user.seller?.legalName ?? user.fullName}</h1>
      <p className="auth-page__text">Desde aquí podrás publicar y gestionar tus productos.</p>
    </section>
  );
}
