import Navbar from './components/Navbar';
import Catalog from './components/Catalog';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Catalog />
      </main>
    </div>
  );
}
