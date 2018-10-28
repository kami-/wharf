import { ModFolder, ModFile, Config, subtract } from "wharf-common";

type FileDiffState = "sync" | "delete";
type ModDiffState = "sync" | "delete";

export interface ModDiff {
    mod: string;
    state: ModDiffState;
}

export interface FileDiff {
    file: string;
    mod: string;
    state: FileDiffState;
}

export interface ConfigDiff {
    mods: ModDiff[];
    files: FileDiff[];
}

export type ModComparator = (one: ModFolder, other: ModFolder) => boolean;
export type FileComparator = (one: ModFile, other: ModFile) => boolean;

export const compareModsByHash = (one: ModFolder, other: ModFolder) => one.hash == other.hash;
export const compareFilesByHash = (one: ModFile, other: ModFile) => one.hash == other.hash;
export const compareModsBySize = (one: ModFolder, other: ModFolder) => one.size == other.size;
export const compareFilesBySize = (one: ModFile, other: ModFile) => one.size == other.size;

export function diffConfigs(sourceConfig: Config, targetConfig: Config,
    modComparator: ModComparator = compareModsByHash, fileComparator: FileComparator = compareFilesByHash): ConfigDiff
{
    const modDiffs: ModDiff[] = [];
    const fileDiffs: FileDiff[] = [];
    Object.values(sourceConfig.mods)
        .forEach(sourceMod => {
            const targetMod = targetConfig.mods[sourceMod.name];
            if (!targetMod) {
                modDiffs.push({ mod: sourceMod.name, state: "delete" });
                const sourceFileDiffs = sourceMod.modFiles
                    .map(file => ({ file: file.relativePath, mod: sourceMod.name, state: <FileDiffState>"delete" }));
                fileDiffs.push(...sourceFileDiffs);
            }
            if (!modComparator(targetMod, sourceMod)) {
                modDiffs.push({ mod: sourceMod.name, state: "sync" });
                const deleteSourceFileDiffs = filesToDelete(sourceMod, targetMod)
                    .map(file => ({ file: file, mod: sourceMod.name, state: <FileDiffState>"delete" }));
                fileDiffs.push(...deleteSourceFileDiffs);
                const syncSourceFileDiffs = filesToSync(sourceMod, targetMod, fileComparator)
                    .map(file => ({ file: file, mod: sourceMod.name, state: <FileDiffState>"sync" }));
                fileDiffs.push(...syncSourceFileDiffs);
                return;
            }
        });
    const targetModNames = Object.keys(targetConfig.mods);
    const sourceNames = Object.keys(sourceConfig.mods);
    subtract(targetModNames, sourceNames)
        .forEach(modName => {
            modDiffs.push({ mod: modName, state: "sync" });
            const sourceFileDiffs = sourceConfig.mods[modName].modFiles
                .map(file => ({ file: file.relativePath, mod: modName, state: <FileDiffState>"sync" }));
            fileDiffs.push(...sourceFileDiffs);
        });
    return {
        mods: modDiffs,
        files: fileDiffs
    };
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
    return targetModFiles
        .filter(file => sourceFile.relativePath == file.relativePath)
        .filter(file => fileComparator(file, sourceFile))
        .length == 0;
}
