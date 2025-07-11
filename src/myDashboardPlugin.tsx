import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILauncher } from '@jupyterlab/launcher';

/**
 * Plugin to add MyDashboard under Launcher
 */
const myDashboardPlugin: JupyterFrontEndPlugin<void> = {
  id: 'my-dashboard:plugin',
  autoStart: true,
  requires: [ILauncher],
  activate: (app: JupyterFrontEnd, launcher: ILauncher) => {
    console.log('✅ MyDashboard plugin activated, adding to Launcher');

    // Add to launcher - the command will be created by the main plugin
    launcher.add({
      category: 'Tools',
      rank: 1,
      command: 'my-dashboard:open'
    });
  }
};

export default myDashboardPlugin;