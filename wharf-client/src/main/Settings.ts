import * as path from "path";
import * as os from "os";

import * as fs from "fs-extra";
import * as log from "electron-log";

export interface Settings {
    lastConfigPath: string | null;
}

export function readSettings(): Settings {
    const settings: Settings | null = fs.readJSONSync(getSettingsFilePath(), { throws: false });
    return settings || { lastConfigPath: null };
}

export function writeSettings(settings: Settings) {
    fs.ensureDirSync(getSettingsFolder());
    fs.writeJsonSync(getSettingsFilePath(), settings);
}

export function configureLogging() {
    fs.ensureDirSync(getSettingsFolder());
    log.transports.file.level = "debug";
    log.transports.console.level = "debug";
    log.transports.file.maxSize = 5 * 1024 * 1024;
    log.transports.file.file = path.join(getSettingsFolder(), getLogFileName());
}

function getLogFileName() {
    const formattedDate = new Date().toISOString()
        .replace(/T/, "_")
        .replace(/\..+/, "")
        .replace(/:/g, "-");
    return `wharf-log_${formattedDate}.log`;
}

function getSettingsFolder() {
    if (process.platform == "win32") {
        const folder = path.resolve(process.env.LOCALAPPDATA || os.homedir());
        return path.join(folder, "Wharf");
    }
    return path.join(path.resolve(os.homedir()), ".wharf");
}

function getSettingsFilePath() {
    return path.join(getSettingsFolder(), "settings.json");
}
