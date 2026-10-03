import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Planner from './Planner';
import './planner.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Planner /></StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      window.dispatchEvent(new CustomEvent('madori-offline-error'));
    });
  });
}
