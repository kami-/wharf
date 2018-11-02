import React from "react";
import { connect } from "react-redux";

import * as IpcHandler from "../IpcHandler";
import Frame from "./Frame";

const Launcher = () => {
    function onClick() {
        IpcHandler.launchGame();
    }

    return <Frame>
        <div className="control">
            <button id="launch-button" className="button is-primary" onClick={onClick}>Launch</button>
        </div>
    </Frame>;
};

export default connect()(Launcher);
