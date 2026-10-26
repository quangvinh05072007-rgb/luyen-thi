import { createRoot } from 'react-dom/client';
import './styles.css';
import './theme.css';
import './workspace.css';
import './class-management.css';
import './feature-decor.css';
import './density.css';
import './flows.css';
import { App } from './App';
import { registerPwa } from './pwa';

void registerPwa();
createRoot(document.getElementById('root')!).render(<App />);
