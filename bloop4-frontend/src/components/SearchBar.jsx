export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** Camp de cerca del catàleg. Qui el fa servir decideix quan s'envia la cerca. */
export default function SearchBar({ value, onChange, onClear }) {
  const tooShort = value.trim().length > 0 && value.trim().length < SEARCH_MIN_LENGTH;

  return (
    <div className="search">
      <form className="search__field" role="search" onSubmit={(event) => event.preventDefault()}>
        <span className="search__icon" aria-hidden="true">⌕</span>
        <input
          className="search__input"
          type="search"
          aria-label="Buscar productos"
          placeholder="Busca altavoces, carpas, sillas…"
          autoComplete="off"
          maxLength={SEARCH_MAX_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <button type="button" className="search__clear" onClick={onClear} aria-label="Borrar búsqueda">
            ✕
          </button>
        )}
      </form>
      {tooShort && <p className="search__hint">Escribe al menos {SEARCH_MIN_LENGTH} caracteres.</p>}
    </div>
  );
}
