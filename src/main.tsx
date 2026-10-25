import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { registerPwa } from './pwa';

void registerPwa();
createRoot(document.getElementById('root')!).render(<App />);
