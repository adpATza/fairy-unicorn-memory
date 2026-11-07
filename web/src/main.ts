import { App } from './app';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  const app = new App(root);
  app.showSetup();
  app.pwa.start();
}
