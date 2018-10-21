import React from "react";
import { SynchronizationState } from "../Store";

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
    return <div>
        <div>
            <div>
                <span>{toMib(downloaded)}</span>
                <span>/</span>
                <span>{toMib(toBeDownloaded)}</span>
            </div>
            <div>Downloading <span>{fileBeingDownloaded}</span></div>
        </div>
        <button disabled={isStopping} onClick={stopHandler}>Stop</button>
    </div>;
};

function toMib(sizeInBytes: number) {
    return sizeInBytes / 1024 / 1024;
}

export default SyncStatusReporter;
