import { App } from './app';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (root) new App(root).showSetup();
