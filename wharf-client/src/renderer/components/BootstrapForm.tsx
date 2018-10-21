import React from "react";
import { connect } from "react-redux";

import * as IpcHandler from "../IpcHandler";

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

    return <div>
        <fieldset>
            <label htmlFor="local-repo-root">Repo folder</label>
            <input id="local-repo-root" name="local-repo-root" type="file" webkitdirectory="true"
                ref={node => { localRepoRoot = node; }} />
        </fieldset>
        <fieldset>
            <label htmlFor="server-config-url">Repo URL</label>
            <input id="server-config-url" name="server-config-url" type="text"
                ref={node => { serverConfigUrl = node; }} />
        </fieldset>
        <button id="bootstrap-button" onClick={onClick}>Setup</button>
    </div>;
};

export default connect()(BootstrapForm);
