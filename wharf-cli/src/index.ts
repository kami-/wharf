import * as fs from "fs";
import * as path from "path";

import * as program from "commander";

import { ServerConfig, generateModFolders, createCancelToken } from "wharf-common";

async function generateConfig(config: ServerConfig) {
    config.mods = await generateModFolders(config.root, createCancelToken());
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
    const config: ServerConfig = {
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
    try {
        generateConfig(config)
            .then(() => fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4)));
    } catch (e) {
        console.error("There was an error: ", e);
    }
}
