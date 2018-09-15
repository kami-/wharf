import * as fs from "fs";
import * as path from "path";

import * as program from "commander";

import { Config, ModFolder, getModFolderFiles, hashMod } from "wharf-common";

function generateConfig(config: Config) {
    return new Promise((resolve, reject) => {
        fs.readdir(config.root, async (err, files) => {
            try {
                const mods = await Promise.all(files
                    .filter(isModFolder)
                    .map(modFolder => getModFolderStats(config.root, modFolder)));
                mods.forEach(mod => {
                    config.mods[mod.name] = mod;
                });
                resolve();
            } catch (e) {
                console.error("There was an error: ", e);
                reject(e);
            }
        });
    });
}

function isModFolder(name: string): boolean {
    return name.charAt(0) == "@";
}

async function getModFolderStats(root: string, folder: string): Promise<ModFolder> {
    const modFiles = await getModFolderFiles(root, folder);
    return {
        name: folder,
        size: modFiles.reduce((sum, f) => sum + f.size, 0),
        hash: hashMod(folder, modFiles),
        modFiles: modFiles
    };
}

program
    .version("-v, --version", "0.0.1")
    .option("-r, --root [root]", "Mod folder root, default is current directory")
    .option("-c, --config [config]", "Config file path, default is ./config.json")
    .option("-R, --ftp-root <ftpRoot>", "FTP root path")
    .option("-H, --ftp-host <ftpHost>", "FTP host")
    .option("-U, --ftp-user <ftpUser>", "FTP username")
    .option("-P, --ftp-password <ftpPassword>", "FTP password")
    .parse(process.argv);

if (!program.ftpHost || !program.ftpUser || !program.ftpPassword) {
    console.error("All FTP options must be provided!");
} else {
    const configFilePath = path.normalize(program.config || "./config.json");
    const config: Config = {
        root: path.normalize(program.root || "."),
        ftp: {
            root: program.ftpRoot || "",
            host: program.ftpHost,
            user: program.ftpUser,
            password: program.ftpPassword
        },
        mods: {}
    };

    console.log("Root:", config.root);
    console.log("Config:", configFilePath);
    generateConfig(config)
        .then(() => fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4)));
}
