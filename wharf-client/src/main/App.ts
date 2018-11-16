import * as path from "path";

import { BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as fs from "fs-extra";

import { ServerConfig } from "wharf-common";
import { LocalConfig } from "./Config";
import { isError } from "../common/Error";
import * as Synchronizer from "./Synchronizer";
import { readSettings, writeSettings } from "./Settings";
import { MainIpcEvents, RendererIpcEvents } from "../common/IpcEvents";
import { TrackingInfo } from "basic-ftp";
import { diffConfigs, diffConfigsBySize, ConfigDiff } from "./ConfigDiffer";
import { launchArma3 } from "./Launcher";
import { Settings } from "../common/Settings";
import { createCancelToken } from "./CancelToken";

let LOCAL_CONFIG: LocalConfig | null = null;
let SERVER_CONFIG: ServerConfig | null = null;
let SETTINGS: Settings;
let TRACK_PROGRESS_HANDLER: ((info: TrackingInfo) => void) | null = null;

export function registerIpcHandlers() {
    ipcMain.on(MainIpcEvents.BOOTSTRAP_CONFIG, async (event: any, localRootPath: string, serverConfigUrl: string) => {
        try {
            await bootstrapConfig(localRootPath, serverConfigUrl);
            log.debug(`Bootstrap succeeded for root '${localRootPath}' and server config URL '${serverConfigUrl}'!`);
            synchronizeLocalConfig(event.sender);
        } catch (e) {
            log.error(`Bootstrap failed for root '${localRootPath}' and server config URL '${serverConfigUrl}'!`);
            log.error(e);
            log.debug(`Sending IPC event '${RendererIpcEvents.BOOTSTRAP_FAILED}' to renderer.`);
            event.sender.send(RendererIpcEvents.BOOTSTRAP_FAILED);
        }
    });

    ipcMain.on(MainIpcEvents.LAUNCH_GAME, async () => {
        if (!LOCAL_CONFIG) { return; }
        try {
            const defaultArgs = ["-world=empty", "-noSplash", "-noFilePatching"];
            const args = defaultArgs.concat(SETTINGS.extraStartupParams);
            log.debug(`Launching A3 with arguments '${args}' from root '${LOCAL_CONFIG.root}' using mods '${Object.keys(LOCAL_CONFIG.mods)}' and extra mods '${SETTINGS.extraMods}!`);
            launchArma3(args, LOCAL_CONFIG.root, Object.values(LOCAL_CONFIG.mods), SETTINGS.extraMods);
        } catch (e) {
            log.error(`Launching A3 failed!`);
            log.error(e);
        }
    });

    ipcMain.on(MainIpcEvents.UPDATE_SETTINGS, async (event: any, settings: Settings) => {
        SETTINGS = settings;
        log.debug(`Updating settings from renderer with '${JSON.stringify(settings)}!`);
    });
}

export async function initialize(window: BrowserWindow) {
    TRACK_PROGRESS_HANDLER = createTrackProgressHandler(window);
    SETTINGS = readSettings();
    log.debug(`Read settings '${JSON.stringify(SETTINGS)}'.`);
    settingsLoaded(window);
    if (SETTINGS.lastConfigPath) {
        try {
            await loadExistingConfig(SETTINGS.lastConfigPath);
            synchronizeLocalConfig(window.webContents);
        } catch(e) {
            if (isError(e, "failed-to-get-server-config")) {
                serverConfigNeeded(window);
            } else {
                bootstrapNeeded(window);
            }
            log.error(`Failed to load existing config from '${SETTINGS.lastConfigPath}'!`);
            log.error(e);
        }
    } else {
        bootstrapNeeded(window);
    }
}

export function shutdown() {
    if (LOCAL_CONFIG) {
        SETTINGS.lastConfigPath = getLocalWharfConfigPath(LOCAL_CONFIG);;
        writeSettings(SETTINGS);
        log.info(`Writing local config to '${LOCAL_CONFIG.root}'.`);
        writeLocalConfig(LOCAL_CONFIG);
    }
}

function getLocalWharfConfigPath(localConfig: LocalConfig) {
    return path.join(localConfig.root, "wharf-config.json");
}

function writeLocalConfig(localConfig: LocalConfig) {
    fs.ensureDirSync(localConfig.root);
    fs.writeJsonSync(getLocalWharfConfigPath(localConfig), localConfig);
}

function loadConfig(configPath: string): LocalConfig {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

async function loadExistingConfig(configPath: string) {
    LOCAL_CONFIG = loadConfig(configPath);
    log.debug(`Loaded local config from '${configPath}'.`);
    SERVER_CONFIG = await Synchronizer.getServerConfig(LOCAL_CONFIG.serverConfigUrl);
    log.debug(`Loaded server config from '${LOCAL_CONFIG.serverConfigUrl}'.`);
}

async function bootstrapConfig(localRootPath: string, serverConfigUrl: string) {
    SERVER_CONFIG = await Synchronizer.getServerConfig(serverConfigUrl);
    log.debug(`Loaded server config from '${serverConfigUrl}'.`);
    LOCAL_CONFIG = await Synchronizer.bootstrapLocalConfig(serverConfigUrl, SERVER_CONFIG, localRootPath);
    log.debug(`Bootstraped locals config for '${localRootPath}'.`);
}

async function synchronizeLocalConfig(target: any) {
    if (!SERVER_CONFIG || !LOCAL_CONFIG || !TRACK_PROGRESS_HANDLER) {
        log.error(`Unable to synchronize, missing configs or track progress handler!`);
        return;
    }
    const localConfigWithoutHashes = await Synchronizer.generateLocalConfigWithoutHashes(LOCAL_CONFIG);
    const configDiffWithoutHashes = diffConfigsBySize(localConfigWithoutHashes, SERVER_CONFIG);
    const needsSyncBySize = Synchronizer.needsSync(configDiffWithoutHashes);
    log.debug(`Client needs sync by size comparison '${needsSyncBySize}'.`);
    if (needsSyncBySize) {
        startSynchronization(target, configDiffWithoutHashes, LOCAL_CONFIG, SERVER_CONFIG, TRACK_PROGRESS_HANDLER);
        return;
    }
    const configDiffWithHashes = diffConfigs(LOCAL_CONFIG, SERVER_CONFIG);
    const needsSyncByHashes = Synchronizer.needsSync(configDiffWithHashes);
    log.debug(`Client needs sync by hash comparison '${needsSyncByHashes}'.`);
    if (needsSyncByHashes) {
        startSynchronization(target, configDiffWithHashes, LOCAL_CONFIG, SERVER_CONFIG, TRACK_PROGRESS_HANDLER);
        return;
    }
    downloadFinished(target);
}

async function startSynchronization(target: any, configDiff: ConfigDiff, localConfig: LocalConfig, serverConfig: ServerConfig,
    trackProgressHandler: (info: TrackingInfo) => void)
{
    const bytesToBeDownloaded = Synchronizer.bytesToBeDownloaded(configDiff, serverConfig);
    log.debug(`Sending IPC event '${RendererIpcEvents.START_SYNCHRONIZATION}' to renderer with args '${bytesToBeDownloaded}'.`);
    target.send(RendererIpcEvents.START_SYNCHRONIZATION, bytesToBeDownloaded);
    const cancelToken = createCancelToken();
    setTimeout(() => {
        cancelToken.cancel();
    }, 100);
    LOCAL_CONFIG = await Synchronizer.synchronizeLocalConfig(configDiff, localConfig, serverConfig, cancelToken, trackProgressHandler);
    downloadFinished(target);
}

function settingsLoaded(window: BrowserWindow) {
    log.debug(`Sending IPC event '${RendererIpcEvents.SETTINGS_LOADED}' to renderer with args '${JSON.stringify(SETTINGS)}'.`);
    window.webContents.send(RendererIpcEvents.SETTINGS_LOADED, SETTINGS);
}

function downloadFinished(target: any) {
    log.debug(`Sending IPC event '${RendererIpcEvents.DOWNLOAD_FINISHED}' to renderer.`);
    target.send(RendererIpcEvents.DOWNLOAD_FINISHED);
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
