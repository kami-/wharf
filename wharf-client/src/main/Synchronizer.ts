/// <reference path="../@types/basic-ftp.d.ts" />

import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";
import * as log from "electron-log";

import { TrackingInfo } from "basic-ftp";

import { generateModFolders, executePromisesSequentially, ServerConfig, File, subtract, Config, createModFolder, modFolderMap } from "wharf-common";
import { WharfError } from "../common/Error";
import { LocalConfig } from "./Config";
import { ConfigDiff } from "./ConfigDiffer";
import { downloadFiles, FileDownloadResult } from "./FileDownloader";
import { CancelToken } from "./CancelToken";

export function needsSync(configDiff: ConfigDiff) {
    return configDiff.files.length != 0;
}

export async function generateLocalConfigWithoutHashes(localConfig: LocalConfig): Promise<LocalConfig> {
    return {
        ...localConfig,
        mods: await generateModFolders(localConfig.root, () => "", () => Promise.resolve(""))
    };
}

export function bytesToBeDownloaded(configDiff: ConfigDiff, serverConfig: ServerConfig) {
    return configDiff.files
        .filter(diff => diff.state == "sync")
        .reduce((sum, diff) => {
            const modFile = serverConfig.mods[diff.mod].modFiles.find(file => file.relativePath == diff.path);
            return sum + (modFile ? modFile.size : 0);
        }, 0);
}

export async function bootstrapLocalConfig(serverConfigUrl: string, serverConfig: ServerConfig, root: string): Promise<LocalConfig> {
    return {
        root: root,
        serverConfigUrl: serverConfigUrl,
        ftp: serverConfig.ftp,
        mods: await generateModFolders(root)
    };
}

export function getServerConfig(serverConfigUrl: string): Promise<ServerConfig> {
    return new Promise((resolve, reject) => {
        https.get(serverConfigUrl, resp => {
            let data = "";
            resp.on("data", chunk => { data += chunk; });
            resp.on("end", () => { resolve(JSON.parse(data)); });
        }).on("error", err => {
            reject(new WharfError("failed-to-get-server-config", err));
        });
    });
}

export async function synchronizeLocalConfig(configDiff: ConfigDiff, localConfig: LocalConfig, serverConfig: ServerConfig, cancelToken: CancelToken,
    trackProgressHandler: (info: TrackingInfo) => void = () => {})
{
    log.info(`Deleting mods and ensuring folders.`);
    const deletedMods = await synchronizeMods(localConfig, configDiff, cancelToken);
    log.info(`Deleting files.`);
    const deletedFiles = await deleteFiles(localConfig, configDiff, deletedMods, cancelToken);
    const filesToDownload = configDiff.files
        .filter(diff => diff.state == "sync")
        .map(diff => ({ mod: diff.mod, path: diff.path }));
    log.info(`Downloading files.`);
    const successfullyDownloadedFiles = (await downloadFiles(localConfig, serverConfig, cancelToken, filesToDownload, trackProgressHandler))
        .filter(result => result.state == "ok");
    log.info(`Creating new local config.`);
    return getNewLocalConfig(localConfig, serverConfig, configDiff, deletedMods, deletedFiles, successfullyDownloadedFiles);
}

async function synchronizeMods(localConfig: LocalConfig, configDiff: ConfigDiff, cancelToken: CancelToken) {
    await executePromisesSequentially(configDiff.mods
        .filter(diff => diff.state == "sync")
        .map(diff => () => {
            if (cancelToken.isCancelled()) {
                log.info(`Ensuring folder cancelled for mod '${diff.mod}'.`);
                return Promise.resolve();
            }
            const modAbsolutePath = path.join(localConfig.root, diff.mod);
            log.info(`Ensuring folder '${modAbsolutePath}'.`)
            return fs.ensureDir(modAbsolutePath)
                .catch(e => {
                    log.error(`There was an error ensuring folder for mod '${diff.mod}'`);
                    log.error(JSON.stringify(e));
                });
        }));

    const deletedMods = await executePromisesSequentially(configDiff.mods
        .filter(diff => diff.state == "delete")
        .map(diff => () => {
            if (cancelToken.isCancelled()) {
                log.info(`Deleting cancelled for mod '${diff.mod}'.`);
                return Promise.resolve(null);
            }
            const modAbsolutePath = path.join(localConfig.root, diff.mod);
            log.info(`Deleting mod at '${modAbsolutePath}'.`);
            return fs.remove(modAbsolutePath)
                .then(() => diff.mod)
                .catch(e => {
                    log.error(`There was an error deleting mod '${diff.mod}'`);
                    log.error(JSON.stringify(e));
                    return null;
                });
        }));
    return deletedMods.filter(notNull);
}

async function deleteFiles(localConfig: LocalConfig, configDiff: ConfigDiff, deletedMods: string[], cancelToken: CancelToken) {
    const deletedFiles =  await executePromisesSequentially(configDiff.files
        .filter(diff => diff.state == "delete")
        .filter(diff => deletedMods.indexOf(diff.mod) == -1)
        .map(diff => () => {
            if (cancelToken.isCancelled()) {
                log.info(`Deleting cancelled for file '${diff.path}'.`);
                return Promise.resolve(null);
            }
            const fileAbsolutePath = path.join(localConfig.root, diff.path);
            log.info(`Deleting file at '${fileAbsolutePath}'.`);
            return fs.remove(fileAbsolutePath)
                .then(() => ({ mod: diff.mod, path: diff.path }))
                .catch(e => {
                    log.error(`There was an error deleting file '${fileAbsolutePath}'`);
                    log.error(JSON.stringify(e));
                    return null;
                });
        }));
    return deletedFiles.filter(notNull);
}

function getNewLocalConfig(localConfig: LocalConfig, serverConfig: ServerConfig, configDiff: ConfigDiff, deletedMods: string[],
    deletedFiles: File[], downloadedFiles: FileDownloadResult[])
{
    const modFolders = subtract(Object.keys(localConfig.mods), deletedMods)
        .map(mod => {
            const modFiles = localConfig.mods[mod].modFiles
                .filter(modFile => deletedFiles.findIndex(file => file.path == modFile.relativePath) == -1)
                //.filter(modFile => configDiff.files)
                .map(modFile => {
                    const wasDownloaded = downloadedFiles.findIndex(file => file.path == modFile.relativePath) > -1;
                    if (!wasDownloaded) { return modFile; }
                    const serverModFile = findModFile(mod, modFile.relativePath, serverConfig);
                    return serverModFile || modFile;
                });
            return createModFolder(mod, modFiles);
        });
console.log(modFolders, configDiff, "==============================================");
    return {
        root: localConfig.root,
        serverConfigUrl: localConfig.serverConfigUrl,
        ftp: serverConfig.ftp,
        mods: modFolderMap(modFolders)
    };
}

function findModFile(mod: string, path: string, config: Config) {
    const modFolder = config.mods[mod];
    if (!modFolder) { return undefined; }
    return modFolder.modFiles
        .find(file => file.relativePath == path);
}

function notNull<T>(item: T | null): item is T {
    return item != null;
}