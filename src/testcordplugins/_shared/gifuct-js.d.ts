declare module "gifuct-js" {
    export interface ParsedGif {
        lsd: {
            width: number;
            height: number;
        };
    }

    export interface ParsedFrame {
        delay: number;
        disposalType: number;
        dims: {
            left: number;
            top: number;
            width: number;
            height: number;
        };
        patch: Uint8ClampedArray;
    }

    export function parseGIF(buffer: ArrayBuffer | Uint8Array): ParsedGif;
    export function decompressFrames(gif: ParsedGif, buildImagePatches?: boolean): ParsedFrame[];
}
