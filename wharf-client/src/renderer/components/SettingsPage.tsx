import React from "react";

import Frame from "./Frame";
import { SettingsState } from "../Store";
import EditableList from "./editable-list/EditableList";

interface SettingsPageProps extends SettingsState {
    addExtraMod: (mod: string) => void;
    removeExtraMod: (mod: string) => void;
    addExtraStartupParam: (param: string) => void;
    removeExtraStartupParam: (param: string) => void;
    back: () => void;
}

const SettingsPage = ({
    lastConfigPath,
    extraMods,
    extraStartupParams,
    addExtraMod,
    removeExtraMod,
    addExtraStartupParam,
    removeExtraStartupParam,
    back
}: SettingsPageProps) => {
    return <Frame>
        <div className="field">
            <label className="label" htmlFor="lastConfigPath">Wharf config path</label>
            <span>{lastConfigPath}</span>
            <input id="lastConfigPath" name="lastConfigPath" className="input" type="file"/>
        </div>
        <div className="field">
            <label className="label" htmlFor="extraMods">Extra mods</label>
            <EditableList items={extraMods}
                type="file"
                webkitdirectory={true}
                addItem={addExtraMod}
                removeItem={removeExtraMod}
            />
        </div>
        <div className="field">
            <label className="label" htmlFor="extraStartupParams">Extra startup parameters</label>
            <EditableList items={extraStartupParams}
                type="text"
                addItem={addExtraStartupParam}
                removeItem={removeExtraStartupParam}
            />
        </div>
        <div className="field is-grouped">
            <div className="control">
                <button className="button is-text" onClick={back}>Back</button>
            </div>
        </div>
    </Frame>;
}

export default SettingsPage;
