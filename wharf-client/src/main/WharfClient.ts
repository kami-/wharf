/// <reference path="../@types/basic-ftp.d.ts" />

import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";

import { Client, TrackingInfo } from "basic-ftp";

import { Map, getModFolderFiles, getModFileStats, generateModFolders, hashMod, syncronizePromises, ServerConfig } from "wharf-common";
import { WharfError } from "../common/Error";
import { LocalConfig } from "./Config";
import { diffConfigs, ModComparator, FileComparator, compareModsBySize, compareFilesBySize, compareFilesByHash, compareModsByHash, ModDiff } from "./ConfigDiffer";

export async function synchronizeConfigs(serverConfig: ServerConfig, localConfig: LocalConfig, trackProgressHandler: (info: TrackingInfo) => void = () => {}) {
    const configDiff = diffConfigs(localConfig, serverConfig);
    const newLocalConfig: LocalConfig = {
        root: localConfig.root,
        serverConfigUrl: localConfig.serverConfigUrl,
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
        const synchronizeModFactories = configDiff.mods
            .map(modDiff => () => synchronizeMod(serverConfig, newLocalConfig, ftp, modDiff));
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

async function synchronizeMod(serverConfig: ServerConfig, localConfig: LocalConfig, ftp: Client, modDiff: ModDiff) {
    const modName = modDiff.mod;
    const modAbsolutePath = path.join(localConfig.root, modName);
    const files = Object.keys(modState.fileStates);
    if (modDiff.state == "delete") {
        await fs.remove(modAbsolutePath);
        console.log(`Mod '${modName}' has been deleted at '${modAbsolutePath}'.`);
        return;
    }
    if (modDiff.state == "sync") {
        fs.ensureDirSync(modAbsolutePath);
        console.log(`Ensuring folder '${modAbsolutePath}'.`)
        await ftp.cd(path.posix.join(serverConfig.ftp.root, modName));
        console.log(`Change FTP folder to '${modName}'.`);
        await ftp.downloadDir(toPosix(absoluteFolder));
        console.log(`Downloaded mod folder '${modName}'.`);
        await ftp.cd("/");
        console.log(`Change FTP folder to root.`);
        const modFiles = await getModFolderFiles(localConfig.root, modName);
        localConfig.mods[modName] = {
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
        await Promise.all(filesToDelete.map(file => fs.remove(path.join(localConfig.root, file))));
        console.log(`Deleted files '${filesToDelete}' in mod '${modName}'.`);
        const downloadFileFactories = filesToSync
        .map(file => () => downloadFile(ftp, localConfig.root, serverConfig.ftp.root, file));
        await syncronizePromises(downloadFileFactories);
        const modFiles = serverConfig.mods[modName].modFiles
            .filter(modFile => !modState.fileStates.hasOwnProperty(modFile.relativePath));
        const syncedModFiles = await Promise.all(filesToSync.map(file => getModFileStats(localConfig.root, file)));
        modFiles.push(...syncedModFiles);
        localConfig.mods[modName] = {
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

function needsSync(localConfig: LocalConfig, serverConfig: ServerConfig, modComparator: ModComparator, fileComparator: FileComparator) {
    const configDiff = diffConfigs(localConfig, serverConfig, modComparator, fileComparator);
    return configDiff.files.length == 0;
}

export function needsSyncBySize(localConfig: LocalConfig, serverConfig: ServerConfig) {
    return needsSync(localConfig, serverConfig, compareModsBySize, compareFilesBySize);
}

export function needsSyncByHashes(localConfig: LocalConfig, serverConfig: ServerConfig) {
    return needsSync(localConfig, serverConfig, compareModsByHash, compareFilesByHash);
}

export async function regenerateLocalConfigWithoutHashes(localConfig: LocalConfig): Promise<LocalConfig> {
    return {
        ...localConfig,
        mods: await generateModFolders(localConfig.root, () => "", () => Promise.resolve(""))
    };
}

export function bytesToBeDownloaded(modStates: Map<ModState>, serverConfig: ServerConfig) {
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
