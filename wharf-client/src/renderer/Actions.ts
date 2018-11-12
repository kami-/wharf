import { Action, AnyAction } from "redux";
import { TrackingInfo } from "basic-ftp";
import { Settings } from "../common/Settings";

export type ActionType
    = "settings-loaded"
    | "load-config"
    | "start-synchronization"
    | "stop-download"
    | "download-progress"
    | "download-finished"
    | "update-last-config-path"
    | "add-extra-mod"
    | "remove-extra-mod"
    | "add-extra-startup-param"
    | "remove-extra-startup-param";

export function settingsLoaded(settings: Settings): AnyAction {
    return {
        type: "settings-loaded",
        settings: settings
    };
}

export function loadConfig(localRootPath: string, serverConfigUrl: string): AnyAction {
    return {
        type: "load-config",
        localRootPath: localRootPath,
        serverConfigUrl: serverConfigUrl
    };
}

export function startSynchronization(toBeDownloaded: number): AnyAction {
    return {
        type: "start-synchronization",
        toBeDownloaded: toBeDownloaded
    }
}

export function stopDownload(): Action<ActionType> {
    return {
        type: "stop-download"
    };
}

export function downloadProgress(info: TrackingInfo): AnyAction {
    return {
        type: "download-progress",
        downloaded: info.bytesOverall,
        file: info.name
    };
}

export function downloadFinished(): Action<ActionType> {
    return {
        type: "download-finished"
    };
}

export function updateLastConfigPath(lastConfigPath: string): AnyAction {
    return {
        type: "update-last-config-path",
        lastConfigPath: lastConfigPath
    };
}


export function addExtraMod(mod: string): AnyAction {
    return {
        type: "add-extra-mod",
        mod: mod
    };
}

export function removeExtraMod(mod: string): AnyAction {
    return {
        type: "remove-extra-mod",
        mod: mod
    };
}

export function addExtraStartupParam(param: string): AnyAction {
    return {
        type: "add-extra-startup-param",
        param: param
    };
}

export function removeExtraStartupParam(param: string): AnyAction {
    return {
        type: "remove-extra-startup-param",
        param: param
    };
}
