const platform: string = process.platform;
void platform;
// @ts-expect-error Node-compatible presets declare no DOM libraries.
document.title;
export {};
