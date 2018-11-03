/// <reference path="../@types/basic-ftp.d.ts" />

import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";

import { Client, TrackingInfo } from "basic-ftp";

import { generateModFolders, syncronizePromises, ServerConfig, toPosix } from "wharf-common";
import { WharfError } from "../common/Error";
import { LocalConfig } from "./Config";
import { ConfigDiff } from "./ConfigDiffer";

export async function synchronizeLocalConfig(configDiff: ConfigDiff, localConfig: LocalConfig, serverConfig: ServerConfig,
    trackProgressHandler: (info: TrackingInfo) => void = () => {})
{
    const newLocalConfig: LocalConfig = {
        root: localConfig.root,
        serverConfigUrl: localConfig.serverConfigUrl,
        ftp: serverConfig.ftp,
        mods: {}
    };
    const ftp = new Client();
    ftp.trackProgress(trackProgressHandler);
    try {
        await ftp.access({
            host: serverConfig.ftp.host,
            user: serverConfig.ftp.user,
            password: serverConfig.ftp.password,
        });
        const deletedMods = await synchronizeMods(localConfig, configDiff);
        await synchronizeFiles(localConfig, configDiff, deletedMods, ftp);
        newLocalConfig.mods = serverConfig.mods;
        return newLocalConfig;
    } catch (e) {
        throw e;
    } finally {
        console.log("Closing FTP connection!");
        await ftp.close();
        console.log("Closed FTP connection.");
    }
}

async function synchronizeMods(localConfig: LocalConfig, configDiff: ConfigDiff) {
    const modsToBeDeleted: string[] = [];
    await syncronizePromises(configDiff.mods.map(diff => () => {
        const mod = diff.mod;
        const modAbsolutePath = path.join(localConfig.root, mod);
        if (diff.state == "delete") {
            console.log(`Deleting mod '${mod}' at '${modAbsolutePath}'.`);
            modsToBeDeleted.push(mod);
            return fs.remove(modAbsolutePath);
        }
        console.log(`Ensuring folder '${modAbsolutePath}'.`)
        return fs.ensureDir(modAbsolutePath);
    }));
    return modsToBeDeleted;
}

async function synchronizeFiles(localConfig: LocalConfig, configDiff: ConfigDiff, deletedMods: string[], ftp: Client) {
    await syncronizePromises(configDiff.files.map(diff => () => {
        const file = diff.file;
        const fileAbsolutePath = path.join(localConfig.root, file);
        if (diff.state == "delete" && deletedMods.indexOf(diff.mod) == -1) {
            console.log(`Deleting file '${file}' at '${fileAbsolutePath}'.`);
            return fs.remove(fileAbsolutePath);
        }
        if (diff.state == "sync") {
            return downloadFile(ftp, localConfig.root, localConfig.ftp.root, file);
        }
        return Promise.resolve();
    }));
}

async function downloadFile(ftp: Client, root: string, ftpRoot: string, file: string) {
    const ftpFilePath = toPosix(path.join(ftpRoot, file));
    console.log(`Downloading '${ftpFilePath}' to '${path.join(root, file)}'.`);
    const filePath = path.join(root, file);
    await fs.ensureDir(path.parse(filePath).dir);
    return await ftp.download(fs.createWriteStream(filePath), ftpFilePath);
}

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
            const modFile = serverConfig.mods[diff.mod].modFiles.find(file => file.relativePath == diff.file);
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
