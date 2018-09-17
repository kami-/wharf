import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";

import * as recursive from "recursive-readdir";

const HASH_ALGORITHM = "md5";

export interface Config {
    root: string;
    ftp: FtpConfig;
    mods: Map<ModFolder>;
}

export interface FtpConfig {
    root: string;
    host: string;
    user: string;
    password: string;
}

export interface ModFolder {
    name: string;
    size: number;
    hash: string;
    modFiles: ModFile[];
}

export interface ModFile {
    relativePath: string;
    size: number;
    hash: string;
}

export interface Map<T> {
    [key: string]: T;
}

export type FileHasher = (file: string) => Promise<string>;
export type ModHasher = (mod: string, modFiles: ModFile[]) => string;

async function getModFileStatsAbsolute(root: string, absoluteFile: string, fileHasher: FileHasher) {
    const stat = fs.statSync(absoluteFile);
    const hash = await fileHasher(absoluteFile);
    return {
        relativePath: path.relative(root, absoluteFile),
        size: stat.size,
        hash: hash
    };
}

export async function getModFolderFiles(root: string, folder: string, fileHasher: FileHasher) {
    const files = await recursive(path.join(root, folder));
    return await Promise.all(files.map(file => getModFileStatsAbsolute(root, file, fileHasher)));
}

export async function getModFileStats(root: string, file: string) {
    const absoluteFile = path.join(root, file);
    const stat = fs.statSync(absoluteFile);
    const hash = await hashFile(absoluteFile);
    return {
        relativePath: file,
        size: stat.size,
        hash: hash
    };
}

export function hashFile(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(HASH_ALGORITHM);
        try {
            let stream = fs.createReadStream(file);
            stream.on("data", data => {
                hash.update(data);
            });
            stream.on("end", () => {
                return resolve(hash.digest("hex"));
            });
        } catch (error) {
            return reject(error);
        }
    });
}

export function hashMod(modName: string, modFiles: ModFile[]): string {
    const hash = crypto.createHash(HASH_ALGORITHM);
    hash.update(modName);
    sort(modFiles, (a, b) => a.relativePath.localeCompare(b.relativePath))
        .forEach(f => hash.update(f.hash));
    return hash.digest("hex");
}

export function subtract<T>(from: T[], what: T[]) {
    return from.filter(e => what.indexOf(e) == -1)
}

export function syncronizePromises(promiseFactories: (() => Promise<any>)[]) {
    return promiseFactories
        .reduce((acc, factory) => acc.then(factory), Promise.resolve());
}

export function generateModFolders(root: string, modHasher: ModHasher = hashMod, fileHasher: FileHasher = hashFile): Promise<Map<ModFolder>> {
    return new Promise((resolve, reject) => {
        fs.readdir(root, async (err, files) => {
            if (err) { reject(err); }
            const modFolders = await Promise.all(files
                .filter(isModFolder)
                .map(modFolder => getModFolderStats(root, modFolder, modHasher, fileHasher)));
            resolve(modFolders.reduce((map, modFolder) => {
                map[modFolder.name] = modFolder;
                return map;
            }, <Map<ModFolder>>{}));
        });
    });
}

function isModFolder(name: string): boolean {
    return name.charAt(0) == "@";
}

async function getModFolderStats(root: string, folder: string, modHasher: ModHasher, fileHasher: FileHasher): Promise<ModFolder> {
    const modFiles = await getModFolderFiles(root, folder, fileHasher);
    return {
        name: folder,
        size: modFiles.reduce((sum, f) => sum + f.size, 0),
        hash: modHasher(folder, modFiles),
        modFiles: modFiles
    };
}

function sort<T>(array: T[], compare: (a: T, b: T) => number): T[] {
    return array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
        .map(({item}) => item)
}
