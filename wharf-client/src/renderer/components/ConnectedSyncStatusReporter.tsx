import { connect } from "react-redux";
import { Dispatch } from "redux";

import { StoreState } from "../Store";
import { stopDownload } from "../Actions";
import SyncStatusReporter from "./SyncStatusReporter";


const ConnectedSyncStatusReporter = connect(
    mapStateToProps,
    mapDispatchToProps
)(SyncStatusReporter);

function mapStateToProps({ bootstrapForm, synchronization }: StoreState) {
    return {
        ...synchronization
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        stopHandler: () => dispatch(stopDownload())
    };
}

export default ConnectedSyncStatusReporter;
