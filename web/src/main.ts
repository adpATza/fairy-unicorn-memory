import { App } from './app';
import { Library } from './library';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  void Library.create().then((library) => {
    const app = new App(root, library);
    app.showSetup();
    app.pwa.start();
  });
}
