/// <reference path="../@types/basic-ftp.d.ts" />

import * as fs from "fs-extra";
import * as path from "path";
import * as log from "electron-log";

import { Client, TrackingInfo } from "basic-ftp";

import { executePromisesSequentially, ServerConfig, toPosix, File } from "wharf-common";
import { LocalConfig } from "./Config";
import { CancelToken } from "./CancelToken";

export type DownloadState
    = "ok"
    | "cancelled"
    | "error";

export interface FileDownloadResult {
    mod: string;
    path: string;
    state: DownloadState;
    error?: any;
}

export async function downloadFiles(localConfig: LocalConfig, serverConfig: ServerConfig, cancelToken: CancelToken, files: File[],
    trackProgressHandler: (info: TrackingInfo) => void)
{
    const ftp = new Client();
    ftp.trackProgress(trackProgressHandler);
    try {
        log.info(`Connecting to '${serverConfig.ftp.user}@${serverConfig.ftp.host}'.`);
        await ftp.access({
            host: serverConfig.ftp.host,
            user: serverConfig.ftp.user,
            password: serverConfig.ftp.password,
        });
        cancelToken.promise()
            .then(() => {
                log.info(`Downloading have been cancelled! Closing FTP connection.`);
                return ftp.close();
            });
        log.info(`Preparing to download '${files.length}' files.`);
        return await prepareFileDownload(ftp, localConfig.root, serverConfig.root, files, cancelToken);
    } catch (e) {
        throw e;
    } finally {
        log.info(`Closing FTP connection.`);
        await ftp.close();
        log.info(`Closed FTP connection.`);
    }
}

function prepareFileDownload(ftp: Client, localRoot: string, ftpRoot: string, files: File[],
    cancelToken: CancelToken): Promise<FileDownloadResult[]>
{
    const resultPromiseFactories = files.map(file => async () => {
        if (cancelToken.isCancelled()) {
            log.info(`Downloading cancelled for file '${file.path}'.`);
            return Promise.resolve({ ...file, state: <DownloadState>"cancelled" });
        }
        try {
            await downloadFile(ftp, localRoot, ftpRoot, file.path);
            return Promise.resolve({ ...file, state: <DownloadState>"ok" })
        }
        catch (e) {
            log.error(`There was an error downloading file '${file.path}'.`);
            log.error(JSON.stringify(e));
            return Promise.resolve({ ...file, state: <DownloadState>"error" , error: e });
        }
    });
    return executePromisesSequentially(resultPromiseFactories);
}

async function downloadFile(ftp: Client, localRoot: string, ftpRoot: string, file: string) {
    const ftpFilePath = toPosix(path.join(ftpRoot, file));
    const localFilePath = path.join(localRoot, file);
    log.info(`Downloading remote '${ftpFilePath}' to local '${path.join(localRoot, file)}'.`);
    await fs.ensureDir(path.parse(localFilePath).dir);
    return await ftp.download(fs.createWriteStream(localFilePath), ftpFilePath);
}
