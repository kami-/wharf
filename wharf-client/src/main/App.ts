import * as path from "path";

import { BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as fs from "fs-extra";

import { Config } from "wharf-common";
import { isError } from "../common/Error";
import * as WharfClient from "./WharfClient";
import { Settings, readSettings, writeSettings } from "./Settings";
import { MainIpcEvents, RendererIpcEvents } from "../common/IpcEvents";
import { TrackingInfo } from "basic-ftp";

let LOCAL_CONFIG: Config | null = null;
let SERVER_CONFIG: Config | null = null;
let settings: Settings;
let trackProgressHandler: ((info: TrackingInfo) => void) | null = null;

export function registerIpcHandlers() {
    ipcMain.on(MainIpcEvents.BOOTSTRAP_CONFIG, async (event: any, localRootPath: string, serverConfigUrl: string) => {
        try {
            await bootstrapConfig(localRootPath, serverConfigUrl);
            log.debug(`Bootstrap succeeded for root '${localRootPath}' and server config URL '${serverConfigUrl}'!`);
            synchronizeConfigs(event.sender);
        } catch (e) {
            log.error(`Bootstrap failed for root '${localRootPath}' and server config URL '${serverConfigUrl}'!`);
            log.error(e);
            log.debug(`Sending IPC event '${RendererIpcEvents.BOOTSTRAP_FAILED}' to renderer.`);
            event.sender.send(RendererIpcEvents.BOOTSTRAP_FAILED);
        }
    });
}

export async function initialize(window: BrowserWindow) {
    trackProgressHandler = createTrackProgressHandler(window);
    settings = readSettings();
    log.debug(`Read settings '${settings}'.`);
    if (settings.lastConfigPath) {
        try {
            await loadExistingConfig(settings.lastConfigPath);
            synchronizeConfigs(window.webContents);
        } catch(e) {
            if (isError(e, "failed-to-get-server-config")) {
                serverConfigNeeded(window);
            } else {
                bootstrapNeeded(window);
            }
            log.error(`Failed to load existing config from '${settings.lastConfigPath}'!`);
            log.error(e);
        }
    } else {
        bootstrapNeeded(window);
    }
}

export function shutdown() {
    if (LOCAL_CONFIG) {
        settings.lastConfigPath = getLocalWharfConfigPath(LOCAL_CONFIG);;
        writeSettings(settings);
        log.info(`Writing local config to '${LOCAL_CONFIG.root}'.`);
        writeLocalConfig(LOCAL_CONFIG);
    }
}

function getLocalWharfConfigPath(localConfig: Config) {
    return path.join(localConfig.root, "wharf-config.json");
}

function writeLocalConfig(localConfig: Config) {
    fs.ensureDirSync(localConfig.root);
    fs.writeJsonSync(getLocalWharfConfigPath(localConfig), localConfig);
}

async function loadExistingConfig(configPath: string) {
    LOCAL_CONFIG = WharfClient.loadConfig(configPath);
    log.debug(`Loaded local config from '${configPath}'.`);
    console.log(LOCAL_CONFIG);
    SERVER_CONFIG = await WharfClient.getServerConfig(LOCAL_CONFIG.serverConfigUrl);
    log.debug(`Loaded server config from '${LOCAL_CONFIG.serverConfigUrl}'.`);
}

async function bootstrapConfig(localRootPath: string, serverConfigUrl: string) {
    SERVER_CONFIG = await WharfClient.getServerConfig(serverConfigUrl);
    log.debug(`Loaded server config from '${serverConfigUrl}'.`);
    LOCAL_CONFIG = await WharfClient.bootstrapConfig(serverConfigUrl, SERVER_CONFIG, localRootPath);
    log.debug(`Bootstraped locals config for '${localRootPath}'.`);
}

async function synchronizeConfigs(target: any) {
    if (!SERVER_CONFIG || !LOCAL_CONFIG || !trackProgressHandler) {
        log.error(`Unable to synchronize, missing configs or track progress handler!`);
        return;
    }
    const localConfigWithoutHashes = await WharfClient.regenerateConfigWithoutHashes(LOCAL_CONFIG);
    const needsSyncBySize = WharfClient.needsSyncBySize(localConfigWithoutHashes, SERVER_CONFIG);
    log.debug(`Client needs sync by size comparison '${needsSyncBySize}'.`);
    if (!needsSyncBySize) {
        const needsSyncByHashes = WharfClient.needsSyncByHashes(LOCAL_CONFIG, SERVER_CONFIG);
        log.debug(`Client needs sync by hash comparison '${needsSyncByHashes}'.`);
        if (!needsSyncByHashes) {
            log.debug(`Sending IPC event '${RendererIpcEvents.POSSIBLE_FULL_VERIFICATION_NEEDED}' to renderer.`);
            target.send(RendererIpcEvents.POSSIBLE_FULL_VERIFICATION_NEEDED);
            return;
        }
    }
    WharfClient.synchronizeConfigs(SERVER_CONFIG, LOCAL_CONFIG, trackProgressHandler);
    log.debug(`Sending IPC event '${RendererIpcEvents.START_SYNCHRONIZATION}' to renderer.`);
    target.send(RendererIpcEvents.START_SYNCHRONIZATION);
}

function bootstrapNeeded(window: BrowserWindow) {
    log.debug(`Sending IPC event '${RendererIpcEvents.BOOTSTRAP_NEEDED}' to renderer.`);
    window.webContents.send(RendererIpcEvents.BOOTSTRAP_NEEDED);
}

function serverConfigNeeded(window: BrowserWindow) {
    log.debug(`Sending IPC event '${RendererIpcEvents.SERVER_CONFIG_NEEDED}' to renderer.`);
    window.webContents.send(RendererIpcEvents.SERVER_CONFIG_NEEDED);
}

function createTrackProgressHandler(window: BrowserWindow) {
    return function trackProgress(info: TrackingInfo) {
        log.debug(`Sending IPC event '${RendererIpcEvents.DOWNLOAD_PROGRESS}' to renderer with args '${JSON.stringify(info)}'.`);
        window.webContents.send(RendererIpcEvents.DOWNLOAD_PROGRESS, info);
    }
}