import React from "react";
import { connect } from "react-redux";

import * as IpcHandler from "../IpcHandler";
import Frame from "./Frame";
import { history } from "../Store";

const Launcher = () => {
    function onClick() {
        IpcHandler.launchGame();
    }

    function toSettings() {
        history.push("/settings");
    }

    return <Frame>
        <div className="control">
            <button className="button is-text" onClick={toSettings}>Settings</button>
        </div>
        <div className="control">
            <button id="launch-button" className="button is-primary" onClick={onClick}>Launch</button>
        </div>
    </Frame>;
};

export default connect()(Launcher);
