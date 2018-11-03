import * as path from "path";
import * as os from "os";

import * as fs from "fs-extra";

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

export function getSettingsFolder() {
    if (process.platform == "win32") {
        const folder = path.resolve(process.env.LOCALAPPDATA || os.homedir());
        return path.join(folder, "Wharf");
    }
    return path.join(path.resolve(os.homedir()), ".wharf");
}

function getSettingsFilePath() {
    return path.join(getSettingsFolder(), "settings.json");
}
