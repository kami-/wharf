import React from "react";
import { render } from "react-dom";
import { Switch, Route } from "react-router";
import { Provider } from "react-redux";
import { ConnectedRouter } from "connected-react-router";

import App from "./components/App";
import BootstrapForm from "./components/BootstrapForm";
import ConnectedSyncStatusReporter from "./components/ConnectedSyncStatusReporter";
import Store, { history } from "./Store";
import { registerIpcHandlers } from "./IpcHandler";
import Launcher from "./components/Launcher";

registerIpcHandlers();

render(
    <Provider store={Store}>
        <ConnectedRouter history={history}>
            <Switch>
                <Route exact path="/" component={App} />
                <Route path="/bootstrap" component={BootstrapForm} />
                <Route path="/synchronize" component={ConnectedSyncStatusReporter} />
                <Route path="/launcher" component={Launcher} />
            </Switch>
        </ConnectedRouter>
    </Provider>,
    document.getElementById("app")
);
