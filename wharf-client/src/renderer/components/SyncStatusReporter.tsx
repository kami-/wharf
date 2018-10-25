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
                <span>{`${toMib(downloaded)} MiB`}</span>
                <span> / </span>
                <span>{`${toMib(toBeDownloaded)} MiB`}</span>
            </div>
            <div>Downloading: <span>{fileBeingDownloaded}</span></div>
        </div>
        <button className="button is-danger" disabled={isStopping} onClick={stopHandler}>Stop</button>
    </Frame>;
};

function toMib(sizeInBytes: number) {
    return Math.round(sizeInBytes / 1024 / 1024 * 100) / 100;
}

export default SyncStatusReporter;
