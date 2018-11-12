import { connect } from "react-redux";
import { Dispatch } from "redux";

import store, { StoreState, history } from "../Store";
import { addExtraMod, removeExtraMod, addExtraStartupParam, removeExtraStartupParam } from "../Actions";
import SettingsPage from "./SettingsPage";
import * as IpcHandler from "../IpcHandler";


const ConnectedSettingsPage = connect(
    mapStateToProps,
    mapDispatchToProps
)(SettingsPage);

function mapStateToProps({ bootstrapForm, synchronization, settings }: StoreState) {
    return {
        ...settings
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        addExtraMod: (mod: string) => dispatch(addExtraMod(mod)),
        removeExtraMod: (mod: string) => dispatch(removeExtraMod(mod)),
        addExtraStartupParam: (param: string) => dispatch(addExtraStartupParam(param)),
        removeExtraStartupParam: (param: string) => dispatch(removeExtraStartupParam(param)),
        back: () => {
            history.push("/launcher");
            IpcHandler.updateSettings(store.getState().settings);
        }
    };
}

export default ConnectedSettingsPage;
