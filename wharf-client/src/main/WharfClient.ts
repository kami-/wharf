/// <reference path="../@types/basic-ftp.d.ts" />

import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";

import { Client, TrackingInfo } from "basic-ftp";

import { Config, ModFolder, ModFile, Map, getModFolderFiles, getModFileStats, generateModFolders, hashMod, syncronizePromises, subtract } from "wharf-common";
import { WharfError } from "../common/Error";

interface ModState {
    state: SyncState;
    fileStates: Map<SyncState>;
}

type SyncState = "ok" | "delete" | "sync" | "add";

type ModComparator = (one: ModFolder, other: ModFolder) => boolean;
type FileComparator = (one: ModFile, other: ModFile) => boolean;

const compareModsByHash = (one: ModFolder, other: ModFolder) => one.hash == other.hash;
const compareFilesByHash = (one: ModFile, other: ModFile) => one.hash == other.hash;
const compareModsBySize = (one: ModFolder, other: ModFolder) => one.size == other.size;
const compareFilesBySize = (one: ModFile, other: ModFile) => one.size == other.size;

function getModStates(localConfig: Config, serverConfig: Config,
    modComparator: ModComparator = compareModsByHash, fileComparator: FileComparator = compareFilesByHash)
{
    const modStates: Map<ModState> = {};
    Object
        .keys(localConfig.mods)
        .map(key => localConfig.mods[key])
        .forEach(localMod => {
            const serverMod = serverConfig.mods[localMod.name];
            if (!serverMod) {
                modStates[localMod.name] = { state: "delete", fileStates: {} };
                return;
            }
            if (modComparator(serverMod, localMod)) {
                const fileStates: Map<SyncState> = {};
                filesToSync(serverMod, localMod, fileComparator)
                    .reduce((fsts, file) => {
                        fsts[file] = "sync";
                        return fsts;
                    }, fileStates);
                filesToDelete(serverMod, localMod)
                    .reduce((fsts, file) => {
                        fsts[file] = "delete";
                        return fsts;
                    }, fileStates);
                modStates[localMod.name] = {
                    state: "sync",
                    fileStates: fileStates
                };
                return;
            }
            modStates[localMod.name] = { state: "ok", fileStates: {} };
        });
    const serverModNames = Object.keys(serverConfig.mods);
    const localModNames = Object.keys(localConfig.mods);
    subtract(serverModNames, localModNames)
        .forEach(modName => {
            modStates[modName] = { state: "add", fileStates: {} };
        });
    return modStates;
}

function filesToSync(serverMod: ModFolder, localMod: ModFolder, fileComparator: FileComparator) {
    const modifiedFiles = localMod.modFiles
        .filter(file => shouldDownloadFile(file, serverMod.modFiles, fileComparator))
        .map(file => file.relativePath);
    const serverFiles = serverMod.modFiles.map(file => file.relativePath);
    const localFiles = localMod.modFiles.map(file => file.relativePath);
    return modifiedFiles.concat(subtract(serverFiles, localFiles));
}

function filesToDelete(serverMod: ModFolder, localMod: ModFolder) {
    const serverFiles = serverMod.modFiles.map(file => file.relativePath);
    const localFiles = localMod.modFiles.map(file => file.relativePath);
    return subtract(localFiles, serverFiles);
}


function shouldDownloadFile(localFile: ModFile, serverModFiles: ModFile[], fileComparator: FileComparator) {
    return serverModFiles
        .filter(file => fileComparator(file, localFile))
        .length == 0;
}

export async function synchronizeConfigs(serverConfig: Config, localConfig: Config, trackProgressHandler: (info: TrackingInfo) => void = () => {}) {
    const modStates = getModStates(localConfig, serverConfig);
    const newLocalConfig: Config = {
        root: localConfig.root,

        serverConfigUrl: serverConfig.serverConfigUrl,
        ftp: serverConfig.ftp,
        mods: {}
    };
    const ftp = new Client();
    ftp.trackProgress(trackProgressHandler);
    //ftp.ftp.verbose = true;
    try {
        await ftp.access({
            host: serverConfig.ftp.host,
            user: serverConfig.ftp.user,
            password: serverConfig.ftp.password,
        });
        const synchronizeModFactories = Object.keys(modStates)
            .map(modName => () => synchronizeMod(serverConfig, newLocalConfig, ftp, modName, modStates[modName]));
        await syncronizePromises(synchronizeModFactories);
        return newLocalConfig;
    } catch (e) {
        throw e;
    } finally {
        console.log("Closing FTP connection!");
        await ftp.close();
        console.log("Closed FTP connection.");
    }
}

async function synchronizeMod(serverConfig: Config, newLocalConfig: Config, ftp: Client, modName: string, modState: ModState) {
    const absoluteFolder = path.join(newLocalConfig.root, modName);
    const files = Object.keys(modState.fileStates);
    if (modState.state == "ok") {
        newLocalConfig.mods[modName] = serverConfig.mods[modName];
        console.log(`Mod '${modName}' is OK. Nothing to do.`);
        return;
    }
    if (modState.state == "delete") {
        const pathToRemove = path.join(newLocalConfig.root, modName);
        await fs.remove(pathToRemove);
        console.log(`Mod '${modName}' has been deleted at '${pathToRemove}'.`);
        return;
    }
    if (modState.state == "add") {
        fs.ensureDirSync(absoluteFolder);
        console.log(`Ensuring folder '${absoluteFolder}'.`)
        await ftp.cd(path.posix.join(serverConfig.ftp.root, modName));
        console.log(`Change FTP folder to '${modName}'.`);
        await ftp.downloadDir(toPosix(absoluteFolder));
        console.log(`Downloaded mod folder '${modName}'.`);
        await ftp.cd("/");
        console.log(`Change FTP folder to root.`);
        const modFiles = await getModFolderFiles(newLocalConfig.root, modName);
        newLocalConfig.mods[modName] = {
            name: modName,
            size: modFiles.reduce((sum, f) => sum + f.size, 0),
            hash: hashMod(modName, modFiles),
            modFiles: modFiles
        }
        console.log(`Mod '${modName}' has been downloaded.`);
        return;
    }
    if (modState.state == "sync") {
        const filesToDelete = files.filter(file => modState.fileStates[file] == "delete");
        const filesToSync = files.filter(file => modState.fileStates[file] == "sync");
        await Promise.all(filesToDelete.map(file => fs.remove(path.join(newLocalConfig.root, file))));
        console.log(`Deleted files '${filesToDelete}' in mod '${modName}'.`);
        const downloadFileFactories = filesToSync
        .map(file => () => downloadFile(ftp, newLocalConfig.root, serverConfig.ftp.root, file));
        await syncronizePromises(downloadFileFactories);
        const modFiles = serverConfig.mods[modName].modFiles
            .filter(modFile => !modState.fileStates.hasOwnProperty(modFile.relativePath));
        const syncedModFiles = await Promise.all(filesToSync.map(file => getModFileStats(newLocalConfig.root, file)));
        modFiles.push(...syncedModFiles);
        newLocalConfig.mods[modName] = {
            name: modName,
            size: modFiles.reduce((sum, f) => sum + f.size, 0),
            hash: hashMod(modName, modFiles),
            modFiles: modFiles
        };
        console.log(`Synced files '${filesToSync}' in mod '${modName}'.`);
        console.log(`Mod '${modName}' has been synced.`);
        return;
    }
    console.log(`Unkown state '${modState.state}' for mod '${modName}!`);
}

async function downloadFile(ftp: Client, root: string, ftpRoot: string, file: string) {
    const ftpFilePath = toPosix(path.join(ftpRoot, file));
    console.log(`Downloading '${ftpFilePath}' to '${path.join(root, file)}'.`);
    const filePath = path.join(root, file);
    await fs.ensureDir(path.parse(filePath).dir);
    return await ftp.download(fs.createWriteStream(filePath), ftpFilePath);
}

function toPosix(p: string) {
    return p.replace(/\\/g, path.posix.sep);
}

function needsSync(localConfig: Config, serverConfig: Config, modComparator: ModComparator, fileComparator: FileComparator) {
    const modStates = getModStates(localConfig, serverConfig, modComparator, fileComparator);
    return Object.keys(modStates)
        .findIndex(mod => needsDownload(modStates[mod].state)) != -1;
}

function needsDownload(state: SyncState) {
    return state == "sync" || state == "add";
}

export function needsSyncBySize(localConfig: Config, serverConfig: Config) {
    return needsSync(localConfig, serverConfig, compareModsBySize, compareFilesBySize);
}

export function needsSyncByHashes(localConfig: Config, serverConfig: Config) {
    return needsSync(localConfig, serverConfig, compareModsByHash, compareFilesByHash);
}

export async function regenerateConfigWithoutHashes(localConfig: Config): Promise<Config> {
    return {
        ...localConfig,
        mods: await generateModFolders(localConfig.root, () => "", () => Promise.resolve(""))
    };
}

export function bytesToBeDownloaded(modStates: Map<ModState>, serverConfig: Config) {
    return Object.keys(modStates)
        .filter(mod => needsDownload(modStates[mod].state))
        .reduce((sum, mod) => {
            const modState = modStates[mod];
            if (modState.state == "sync") {
                return sum + serverConfig.mods[mod].modFiles
                    .filter(file => modState.fileStates[file.relativePath] && needsDownload(modState.fileStates[file.relativePath]))
                    .map(file => file.size)
                    .reduce((fileSum, size) => fileSum + size, 0);
            }
            return sum + serverConfig.mods[mod].size;
        }, 0);
}

export async function bootstrapConfig(serverConfigUrl: string, serverConfig: Config, root: string): Promise<Config> {
    return {
        root: root,
        serverConfigUrl: serverConfigUrl,
        ftp: serverConfig.ftp,
        mods: await generateModFolders(root)
    };
}

export function getServerConfig(serverConfigUrl: string): Promise<Config> {
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

export function loadConfig(configPath: string): Config {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}