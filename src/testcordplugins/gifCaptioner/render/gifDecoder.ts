/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

type Color = [number, number, number];

interface FrameDims {
    height: number;
    left: number;
    top: number;
    width: number;
}

interface GifControl {
    delay: number;
    disposalType: number;
    transparentIndex?: number;
}

interface CompressedFrame extends GifControl {
    colorTable: Color[];
    dims: FrameDims;
    imageData: Uint8Array;
    interlaced: boolean;
    lzwMinCodeSize: number;
}

export interface ParsedGif {
    frames: CompressedFrame[];
    lsd: {
        height: number;
        width: number;
    };
}

export interface ParsedFrame extends GifControl {
    dims: FrameDims;
    patch: Uint8ClampedArray;
}

class GifReader {
    private offset = 0;

    constructor(private readonly data: Uint8Array) { }

    get hasMore() {
        return this.offset < this.data.length;
    }

    readByte() {
        if (!this.hasMore) throw new Error("Unexpected end of GIF data.");

        return this.data[this.offset++];
    }

    readBytes(length: number) {
        if (this.offset + length > this.data.length) throw new Error("Unexpected end of GIF data.");

        const bytes = this.data.subarray(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }

    readColorTable(length: number) {
        const colors: Color[] = [];

        for (let i = 0; i < length; i++) {
            colors.push([this.readByte(), this.readByte(), this.readByte()]);
        }

        return colors;
    }

    readSubBlocks() {
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        while (true) {
            const length = this.readByte();
            if (length === 0) break;

            const chunk = this.readBytes(length);
            chunks.push(chunk);
            totalLength += chunk.length;
        }

        const data = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            data.set(chunk, offset);
            offset += chunk.length;
        }

        return data;
    }

    readUint16() {
        return this.readByte() | (this.readByte() << 8);
    }
}

function defaultControl(): GifControl {
    return {
        delay: 0,
        disposalType: 0
    };
}

function readGraphicControlExtension(reader: GifReader): GifControl {
    const blockSize = reader.readByte();
    if (blockSize !== 4) {
        reader.readBytes(blockSize);
        reader.readSubBlocks();
        return defaultControl();
    }

    const packed = reader.readByte();
    const delay = reader.readUint16() * 10;
    const transparentIndex = reader.readByte();
    reader.readByte();

    return {
        delay,
        disposalType: (packed >> 2) & 0x07,
        ...(packed & 0x01 ? { transparentIndex } : {})
    };
}

function readImage(reader: GifReader, globalColorTable: Color[], control: GifControl): CompressedFrame {
    const dims = {
        left: reader.readUint16(),
        top: reader.readUint16(),
        width: reader.readUint16(),
        height: reader.readUint16()
    };
    const packed = reader.readByte();
    const hasLocalColorTable = Boolean(packed & 0x80);
    const colorTableLength = 2 ** ((packed & 0x07) + 1);
    const colorTable = hasLocalColorTable ? reader.readColorTable(colorTableLength) : globalColorTable;

    if (colorTable.length === 0) throw new Error("GIF frame is missing a color table.");

    const lzwMinCodeSize = reader.readByte();

    return {
        ...control,
        colorTable,
        dims,
        imageData: reader.readSubBlocks(),
        interlaced: Boolean(packed & 0x40),
        lzwMinCodeSize
    };
}

function getInputData(buffer: ArrayBuffer | Uint8Array) {
    return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

export function parseGIF(buffer: ArrayBuffer | Uint8Array): ParsedGif {
    const reader = new GifReader(getInputData(buffer));
    const header = String.fromCharCode(...reader.readBytes(6));

    if (header !== "GIF87a" && header !== "GIF89a") {
        throw new Error("Invalid GIF header.");
    }

    const lsd = {
        width: reader.readUint16(),
        height: reader.readUint16()
    };
    const packed = reader.readByte();
    const hasGlobalColorTable = Boolean(packed & 0x80);
    const globalColorTableLength = 2 ** ((packed & 0x07) + 1);

    reader.readByte();
    reader.readByte();

    const globalColorTable = hasGlobalColorTable ? reader.readColorTable(globalColorTableLength) : [];
    const frames: CompressedFrame[] = [];
    let control = defaultControl();

    while (reader.hasMore) {
        const block = reader.readByte();

        if (block === 0x3b) break;

        if (block === 0x21) {
            const extensionLabel = reader.readByte();

            if (extensionLabel === 0xf9) control = readGraphicControlExtension(reader);
            else reader.readSubBlocks();

            continue;
        }

        if (block === 0x2c) {
            frames.push(readImage(reader, globalColorTable, control));
            control = defaultControl();
            continue;
        }

        throw new Error(`Unsupported GIF block 0x${block.toString(16)}.`);
    }

    return { frames, lsd };
}

function decodeLzw(data: Uint8Array, minCodeSize: number, expectedSize: number) {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    const output = new Uint8Array(expectedSize);
    let bitOffset = 0;
    let codeSize = minCodeSize + 1;
    let dictionary: number[][] = [];
    let nextCode = endCode + 1;
    let outputOffset = 0;
    let previous: number[] | undefined;

    const resetDictionary = () => {
        dictionary = new Array(4096);

        for (let i = 0; i < clearCode; i++) {
            dictionary[i] = [i];
        }

        codeSize = minCodeSize + 1;
        nextCode = endCode + 1;
    };

    const readCode = () => {
        if (bitOffset + codeSize > data.length * 8) return null;

        let code = 0;

        for (let i = 0; i < codeSize; i++) {
            const bit = (data[bitOffset >> 3] >> (bitOffset & 0x07)) & 0x01;
            code |= bit << i;
            bitOffset++;
        }

        return code;
    };

    resetDictionary();

    while (outputOffset < expectedSize) {
        const code = readCode();
        if (code == null) break;

        if (code === clearCode) {
            resetDictionary();
            previous = undefined;
            continue;
        }

        if (code === endCode) break;

        let entry = dictionary[code];

        if (!entry) {
            if (code !== nextCode || !previous) throw new Error("Invalid GIF LZW code.");

            entry = [...previous, previous[0]];
        }

        for (const pixel of entry) {
            if (outputOffset >= expectedSize) break;
            output[outputOffset++] = pixel;
        }

        if (previous && nextCode < 4096) {
            dictionary[nextCode] = [...previous, entry[0]];
            nextCode++;

            if (nextCode === 1 << codeSize && codeSize < 12) codeSize++;
        }

        previous = entry;
    }

    return output;
}

function deinterlace(pixels: Uint8Array, width: number, height: number) {
    const result = new Uint8Array(pixels.length);
    const offsets = [0, 4, 2, 1];
    const steps = [8, 8, 4, 2];
    let sourceRow = 0;

    for (let pass = 0; pass < offsets.length; pass++) {
        for (let row = offsets[pass]; row < height; row += steps[pass]) {
            const sourceOffset = sourceRow * width;
            result.set(pixels.subarray(sourceOffset, sourceOffset + width), row * width);
            sourceRow++;
        }
    }

    return result;
}

function buildPatch(frame: CompressedFrame) {
    const { height, width } = frame.dims;
    const expectedPixels = width * height;
    const decodedPixels = decodeLzw(frame.imageData, frame.lzwMinCodeSize, expectedPixels);
    const pixels = frame.interlaced ? deinterlace(decodedPixels, width, height) : decodedPixels;
    const patch = new Uint8ClampedArray(expectedPixels * 4);

    for (let i = 0; i < expectedPixels; i++) {
        const colorIndex = pixels[i];
        if (colorIndex === frame.transparentIndex) continue;

        const color = frame.colorTable[colorIndex];
        if (!color) continue;

        const offset = i * 4;
        patch[offset] = color[0];
        patch[offset + 1] = color[1];
        patch[offset + 2] = color[2];
        patch[offset + 3] = 255;
    }

    return patch;
}

export function decompressFrames(gif: ParsedGif, buildImagePatches = false): ParsedFrame[] {
    return gif.frames.map(frame => ({
        delay: frame.delay,
        dims: { ...frame.dims },
        disposalType: frame.disposalType,
        patch: buildImagePatches ? buildPatch(frame) : new Uint8ClampedArray()
    }));
}
