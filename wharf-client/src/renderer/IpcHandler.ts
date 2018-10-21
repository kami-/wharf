import { ipcRenderer } from "electron";
import * as log from "electron-log";

import { MainIpcEvents, RendererIpcEvents } from "../common/IpcEvents";
import Store, { history } from "./Store";
import { downloadProgress, downloadFinished } from "./Actions";
import { TrackingInfo } from "basic-ftp";

export function registerIpcHandlers() {
    ipcRenderer.on(RendererIpcEvents.BOOTSTRAP_NEEDED, () => {
        log.debug(`Renderer received IPC event '${RendererIpcEvents.BOOTSTRAP_NEEDED}'.`);
        history.push("/bootstrap");
    });

    ipcRenderer.on(RendererIpcEvents.BOOTSTRAP_SUCCEEDED, () => {
        log.debug(`Renderer received IPC event '${RendererIpcEvents.BOOTSTRAP_SUCCEEDED}'.`);
        history.push("/synchronize");
    });

    ipcRenderer.on(RendererIpcEvents.DOWNLOAD_PROGRESS, (event: any, info: TrackingInfo) => {
        log.debug(`Renderer received IPC event '${RendererIpcEvents.DOWNLOAD_PROGRESS}'.`);
        Store.dispatch(downloadProgress(info));
    });

    ipcRenderer.on(RendererIpcEvents.DOWNLOAD_FINISHED, () => {
        log.debug(`Renderer received IPC event '${RendererIpcEvents.DOWNLOAD_FINISHED}'.`);
        Store.dispatch(downloadFinished());
    });
}

export function bootrapConfig(localRootPath: string, serverConfigUrl: string) {
    ipcRenderer.send(MainIpcEvents.BOOTSTRAP_CONFIG, localRootPath, serverConfigUrl);
}
