import React from "react";

import { SynchronizationState } from "../Store";
import Frame from "./Frame";

interface SyncStatusReporterProps extends SynchronizationState {
    stopHandler: () => void;
}

const SyncStatusReporter = ({
    downloaded,
    toBeDownloaded,
    fileBeingDownloaded,
    isStopping,
    stopHandler
}: SyncStatusReporterProps) => {
    return <Frame>
        <div>
            <div>
                <span>{`${formatSize(downloaded)}`}</span>
                <span> / </span>
                <span>{`${formatSize(toBeDownloaded)}`}</span>
            </div>
            <div>{fileBeingDownloaded}</div>
        </div>
        <button className="button is-danger is-invisible" disabled={isStopping} onClick={stopHandler}>Stop</button>
    </Frame>;
};

function formatSize(sizeInBytes: number) {
    let unit = "MiB";
    let divider = 1024 * 1024;
    if (sizeInBytes < 1024 * 1024) {
        unit = "KiB";
        divider = 1024;
    }
    return Math.round(sizeInBytes / divider * 100) / 100 + " " + unit;
}

export default SyncStatusReporter;
