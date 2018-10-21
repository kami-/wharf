import { Action, AnyAction } from "redux";
import { TrackingInfo } from "basic-ftp";

export type ActionType
    = "load-config"
    | "stop-download"
    | "download-progress"
    | "download-finished";

export function loadConfig(localRootPath: string, serverConfigUrl: string): AnyAction {
    return {
        type: "load-config",
        localRootPath: localRootPath,
        serverConfigUrl: serverConfigUrl
    };
}

export function stopDownload(): Action<ActionType> {
    return {
        type: "stop-download"
    };
}

export function downloadProgress(info: TrackingInfo): AnyAction {
    return {
        ...info,
        type: "download-progress"
    };
}

export function downloadFinished(): Action<ActionType> {
    return {
        type: "download-finished"
    };
}