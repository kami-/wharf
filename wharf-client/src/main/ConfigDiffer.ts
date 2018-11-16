import { ModFolder, ModFile, Config, subtract, File } from "wharf-common";

type FileDiffState = "sync" | "delete";
type ModDiffState = "sync" | "delete";

export interface ModDiff {
    mod: string;
    state: ModDiffState;
}

export interface FileDiff extends File {
    state: FileDiffState;
}

export interface ConfigDiff {
    mods: ModDiff[];
    files: FileDiff[];
}

export type FileComparator = (one: ModFile, other: ModFile) => boolean;
export const compareFilesByHash = (one: ModFile, other: ModFile) => one.hash == other.hash;
export const compareFilesBySize = (one: ModFile, other: ModFile) => one.size == other.size;

export function diffConfigs(sourceConfig: Config, targetConfig: Config, fileComparator: FileComparator = compareFilesByHash): ConfigDiff
{
    const modDiffs: ModDiff[] = [];
    const fileDiffs: FileDiff[] = [];
    Object.values(sourceConfig.mods)
        .forEach(sourceMod => {
            const targetMod = targetConfig.mods[sourceMod.name];
            if (!targetMod) {
                modDiffs.push({ mod: sourceMod.name, state: "delete" });
                const sourceFileDiffs = sourceMod.modFiles
                    .map(file => ({ path: file.relativePath, mod: sourceMod.name, state: <FileDiffState>"delete" }));
                fileDiffs.push(...sourceFileDiffs);
                return;
            }
            const deleteSourceFileDiffs = filesToDelete(sourceMod, targetMod)
                .map(file => ({ path: file, mod: sourceMod.name, state: <FileDiffState>"delete" }));
            fileDiffs.push(...deleteSourceFileDiffs);
            const syncSourceFileDiffs = filesToSync(sourceMod, targetMod, fileComparator)
                .map(file => ({ path: file, mod: sourceMod.name, state: <FileDiffState>"sync" }));
            fileDiffs.push(...syncSourceFileDiffs);
            if (deleteSourceFileDiffs.length > 0 || syncSourceFileDiffs.length > 0) {
                modDiffs.push({ mod: sourceMod.name, state: "sync" });
            }
        });
    const targetModNames = Object.keys(targetConfig.mods);
    const sourceNames = Object.keys(sourceConfig.mods);
    subtract(targetModNames, sourceNames)
        .forEach(modName => {
            modDiffs.push({ mod: modName, state: "sync" });
            const sourceFileDiffs = targetConfig.mods[modName].modFiles
                .map(file => ({ path: file.relativePath, mod: modName, state: <FileDiffState>"sync" }));
            fileDiffs.push(...sourceFileDiffs);
        });
    return {
        mods: modDiffs,
        files: fileDiffs
    };
}

export function diffConfigsBySize(sourceConfig: Config, targetConfig: Config) {
    return diffConfigs(sourceConfig, targetConfig, compareFilesBySize);
}

function filesToSync(sourceMod: ModFolder, targetMod: ModFolder, fileComparator: FileComparator) {
    const modifiedFiles = sourceMod.modFiles
        .filter(file => shouldDownloadFile(file, targetMod.modFiles, fileComparator))
        .map(file => file.relativePath);
    const targetFiles = targetMod.modFiles.map(file => file.relativePath);
    const sourceFiles = sourceMod.modFiles.map(file => file.relativePath);
    return modifiedFiles.concat(subtract(targetFiles, sourceFiles));
}

function filesToDelete(sourceMod: ModFolder, targetMod: ModFolder) {
    const targetFiles = targetMod.modFiles.map(file => file.relativePath);
    const sourceFiles = sourceMod.modFiles.map(file => file.relativePath);
    return subtract(sourceFiles, targetFiles);
}

function shouldDownloadFile(sourceFile: ModFile, targetModFiles: ModFile[], fileComparator: FileComparator) {
    const targetFile = targetModFiles.find(file => sourceFile.relativePath == file.relativePath);
    return targetFile && !fileComparator(targetFile, sourceFile);
}
