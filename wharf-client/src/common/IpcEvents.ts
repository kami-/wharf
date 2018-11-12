export enum MainIpcEvents {
    LOAD_CONFIG = "load-config",
    BOOTSTRAP_CONFIG = "bootstrap-config",
    LAUNCH_GAME = "launch-game",
    UPDATE_SETTINGS = "update-settings"
}

export enum RendererIpcEvents {
    SETTINGS_LOADED = "settings-loaded",
    BOOTSTRAP_NEEDED = "bootstrap-needed",
    BOOTSTRAP_SUCCEEDED = "bootstrap-succeeded",
    BOOTSTRAP_FAILED = "bootstrap-failed",
    SERVER_CONFIG_NEEDED = "server-config-needed",
    START_SYNCHRONIZATION = "start-synchronization",
    DOWNLOAD_PROGRESS = "download-progress",
    DOWNLOAD_FINISHED = "download-finished"
};
