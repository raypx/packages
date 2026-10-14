const title: string = document.title;
void title;
// @ts-expect-error Browser presets declare no Node ambient types.
process.platform;
export {};
