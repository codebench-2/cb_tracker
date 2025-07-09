import React from 'react';
import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILauncher } from '@jupyterlab/launcher';
import { ReactWidget } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
import { MyDashboard } from './widgets/MyDashboard/widgetMD';

// Create a custom dashboard icon using SVG
const dashboardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="7" height="9"></rect>
  <rect x="14" y="3" width="7" height="5"></rect>
  <rect x="14" y="12" width="7" height="9"></rect>
  <rect x="3" y="16" width="7" height="5"></rect>
</svg>
`;

// Create LabIcon instance
const dashboardIcon = new LabIcon({
  name: 'my-dashboard:icon',
  svgstr: dashboardSvg
});

/**
 * Plugin to add MyDashboard under Launcher
 */
const myDashboardPlugin: JupyterFrontEndPlugin<void> = {
  id: 'my-dashboard:plugin',
  autoStart: true,
  requires: [ILauncher],
  activate: (app: JupyterFrontEnd, launcher: ILauncher) => {
    console.log('✅ MyDashboard plugin activated, adding to Launcher');

    // Add command with icon
    app.commands.addCommand('my-dashboard:open', {
      label: 'My Dashboard',
      icon: dashboardIcon,  // Set icon for the command
      execute: () => {
        const widget = ReactWidget.create(<MyDashboard />);
        widget.id = 'my-dashboard-widget';
        widget.title.label = 'My Dashboard';
        widget.title.icon = dashboardIcon;  // Set icon for tab
        widget.title.closable = true;
        app.shell.add(widget, 'main');
      }
    });

    // Add to launcher - it will automatically use the command's icon
    launcher.add({
      category: 'Other',
      rank: 1,
      command: 'my-dashboard:open'
    });
  }
};

export default myDashboardPlugin;