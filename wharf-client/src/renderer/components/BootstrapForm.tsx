import React from "react";
import { connect } from "react-redux";

import * as IpcHandler from "../IpcHandler";
import Frame from "./Frame";

const BootstrapForm = () => {
    let localRepoRoot: any;
    let serverConfigUrl: HTMLInputElement | null;

    function onClick() {
        if (!localRepoRoot || !localRepoRoot.value) {
            return;
        }
        if (!serverConfigUrl || !serverConfigUrl.value) {
            return;
        }
        IpcHandler.bootrapConfig(localRepoRoot.files[0].path.trim(), serverConfigUrl.value.trim());
    }

    return <Frame>
        <div className="field">
            <label className="label" htmlFor="local-repo-root">Repo folder</label>
            <input id="local-repo-root" name="local-repo-root" className="input" type="file" webkitdirectory="true"
                ref={node => { localRepoRoot = node; }} />
        </div>
        <div className="field">
            <label className="label" htmlFor="server-config-url">Repo URL</label>
            <input id="server-config-url" name="server-config-url" className="input" type="text"
                defaultValue="https://ark-group.org/wharf/config.json"
                ref={node => { serverConfigUrl = node; }} />
        </div>

        <div className="control">
            <button id="bootstrap-button" className="button is-primary" onClick={onClick}>Setup</button>
        </div>
    </Frame>;
};

export default connect()(BootstrapForm);
