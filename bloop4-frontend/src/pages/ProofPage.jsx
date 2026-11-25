import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProofView from '../components/ProofView';
import StatusPanel from '../components/StatusPanel';
import { fetchProof } from '../api/proofApi';

/** Pàgina /pruebas/:id: prova d'un servei per al client, el venedor o l'administrador. */
export default function ProofPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', proof: null, error: null });

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchProof(id, { signal: controller.signal })
      .then((proof) => setState({ status: 'success', proof, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: error.status === 404 ? 'notFound' : 'error', proof: null, error });
      });
    return () => controller.abort();
  }, [id]);
  useEffect(load, [load]);

  return (
    <section className="detail-page">
      <button type="button" className="detail__back link-button" onClick={() => navigate(-1)}>
        ← Volver
      </button>
      {state.status === 'loading' && <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando la prueba" />}
      {state.status === 'notFound' && <StatusPanel title="Prueba no encontrada" text="No existe o no tienes acceso a ella." />}
      {state.status === 'error' && <StatusPanel role="alert" title="No se pudo cargar la prueba" text={state.error?.message} actionLabel="Reintentar" onAction={load} />}
      {state.status === 'success' && <ProofView proof={state.proof} />}
    </section>
  );
}
