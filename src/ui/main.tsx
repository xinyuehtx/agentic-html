import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/layout.css';
import './styles/toolbar.css';
import './styles/version-graph.css';
import './styles/sidebar.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
