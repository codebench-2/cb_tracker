import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { MyDashboard } from './widgetMD';

export class MyDashboardWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('my-dashboard-widget');
  }

  render() {
    return <MyDashboard />;
  }
}