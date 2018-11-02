import React, { createRef } from "react";
import { connect } from "react-redux";

import * as IpcHandler from "../IpcHandler";
import Frame from "./Frame";

class BootstrapForm extends React.Component<{}, {}> {
    private localRepoRoot = createRef<HTMLInputElement>();
    private serverConfigUrl = createRef<HTMLInputElement>();

    componentDidMount() {
        (this.localRepoRoot.current as any).webkitdirectory = true;
    }

    bootstrapOnLick() {
        const localRepoRoot: any = this.localRepoRoot.current;
        const serverConfigUrl = this.serverConfigUrl.current;
        if (!localRepoRoot || !localRepoRoot.value) {
            return;
        }
        if (!serverConfigUrl || !serverConfigUrl.value) {
            return;
        }
        IpcHandler.bootrapConfig(localRepoRoot.files[0].path.trim(), serverConfigUrl.value.trim());
    }

    render() {
        return <Frame>
            <div className="field">
                <label className="label" htmlFor="local-repo-root">Repo folder</label>
                <input id="local-repo-root" name="local-repo-root" className="input" type="file"
                    ref={this.localRepoRoot} />
            </div>
            <div className="field">
                <label className="label" htmlFor="server-config-url">Repo URL</label>
                <input id="server-config-url" name="server-config-url" className="input" type="text"
                    defaultValue="https://ark-group.org/wharf/config.json"
                    ref={this.serverConfigUrl} />
            </div>

            <div className="control">
                <button id="bootstrap-button" className="button is-primary" onClick={() => this.bootstrapOnLick()}>Setup</button>
            </div>
        </Frame>;
    }
}

export default connect()(BootstrapForm);
