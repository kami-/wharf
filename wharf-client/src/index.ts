/// <reference path="@types/basic-ftp.d.ts" />

import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";

import * as program from "commander";
import { Client } from "basic-ftp";

import { Config, ModFolder, ModFile, Map, getModFolderFiles, getModFileStats, generateModFolders, hashMod, syncronizePromises, subtract } from "wharf-common";

interface ModState {
    state: SyncState;
    fileStates: Map<SyncState>;
}

type SyncState = "ok" | "delete" | "sync" | "add";

function getModStates(serverConfig: Config, localConfig: Config) {
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
            if (serverMod.hash != localMod.hash) {
                const fileStates: Map<SyncState> = {};
                filesToSync(serverMod, localMod)
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

function filesToSync(serverMod: ModFolder, localMod: ModFolder) {
    const modifiedFiles = localMod.modFiles
        .filter(file => shouldDownloadFile(file, serverMod.modFiles))
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


function shouldDownloadFile(localFile: ModFile, serverModFiles: ModFile[]) {
    return serverModFiles
        .filter(file => file.hash == localFile.hash)
        .length == 0;
}

async function synchronizeConfigs(serverConfig: Config, localConfig: Config) {
    const modStates = getModStates(serverConfig, localConfig);
    const newLocalConfig: Config = {
        root: localConfig.root,
        ftp: serverConfig.ftp,
        mods: {}
    };
    const ftp = new Client();
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

function downloadFile(ftp: Client, root: string, ftpRoot: string, file: string) {
    const ftpFilePath = toPosix(path.join(ftpRoot, file));
    console.log(`Downloading '${ftpFilePath}' to '${path.join(root, file)}'.`);
    return ftp.download(fs.createWriteStream(path.join(root, file)), ftpFilePath);
}

function toPosix(p: string) {
    return p.replace(/\\/g, path.posix.sep);
}

async function fullVerify(localConfig: Config): Promise<Config> {
    return {
        ...localConfig,
        mods: await generateModFolders(localConfig.root)
    };
}

function getServerConfig(serverConfigUrl: string): Promise<Config> {
    return new Promise((resolve, reject) => {
        https.get(serverConfigUrl, resp => {
            let data = "";
            resp.on("data", chunk => { data += chunk; });
            resp.on("end", () => { resolve(JSON.parse(data)); });
        }).on("error", err => {
            reject(err);
        });
    });
}

program
    .version("-v, --version", "0.0.1")
    .option("-c, --config [config]", "Config file path, default is ./config.json")
    .option("-s, --server-config-url [serverConfigUrl]", "URL where the server config is located")
    .parse(process.argv);

if (!program.config || !program.serverConfigUrl) {
    console.error("Config file and server config URL options must be provided!");
} else {
    try {
        getServerConfig(program.serverConfigUrl).then(async serverConfig => {
            const localConfig: Config = JSON.parse(fs.readFileSync(program.config, "utf-8"));
            const verifiedLocalConfig = await fullVerify(localConfig);
            synchronizeConfigs(serverConfig, verifiedLocalConfig)
                .then(newLocalConfig => fs.writeFileSync(program.config, JSON.stringify(newLocalConfig, null, 4)));
        });
    } catch (e) {
        console.error("Something went wrong!", e);
    }
}