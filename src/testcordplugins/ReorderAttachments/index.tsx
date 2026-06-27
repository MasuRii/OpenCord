/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { classNameFactory } from "@api/Styles";
import { TestcordDevs } from "@utils/constants";
import { classes } from "@utils/misc";
import { useForceUpdater } from "@utils/react";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { React, useDrag, useDrop, useRef } from "@webpack/common";

const AttachmentItem = findComponentByCodeLazy(/channelId:\i,draftType:\i,upload:\i,/);
const ItemType = "DND_ATTACHMENT";
const cl = classNameFactory("vc-drag-att-");

interface DragItem {
    index: number;
}

const DraggableItem = ({ uploadItem, index, moveItem, children }) => {
    const [{ isDragging }, drag] = useDrag({
        type: ItemType,
        item: { index },
        collect: monitor => ({ isDragging: monitor.isDragging() })
    });

    const isComingFromRight = useRef(false);
    const isComingFromLeft = useRef(false);

    const [{ isOver }, drop] = useDrop({
        accept: ItemType,
        collect: monitor => ({
            isOver: monitor.isOver()
        }),
        hover: (draggedItem: DragItem) => {
            isComingFromRight.current = index < draggedItem.index;
            isComingFromLeft.current = index > draggedItem.index;
        },
        drop: (draggedItem: DragItem) => {
            moveItem(draggedItem.index, index);
        }
    });

    return (
        <div
            key={uploadItem.id}
            ref={node => {
                drag(drop(node));
            }}
            className={
                classes(
                    cl("item"),
                    isDragging && cl("dragging"),
                    isOver && cl("drop-target"),
                    isOver && isComingFromRight.current && cl("drop-from-right"),
                    isOver && isComingFromLeft.current && cl("drop-from-left")
                )
            }
        >
            {children}
        </div>
    );
};

const DraggableList = ({ channelId, draftType, keyboardModeEnabled, size, attachments, ignoredFilename }) => {
    const forceUpdate = useForceUpdater();

    const items = attachments.filter(a => a.filename !== ignoredFilename);

    const moveItem = (from, to) => {
        if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
        const next = [...items];
        next.splice(to, 0, ...next.splice(from, 1));
        // Commit the new order back to the draft array Discord reads on send.
        attachments.splice(0, attachments.length, ...next);
        forceUpdate();
    };

    return items.map((uploadItem, index) => (
        <DraggableItem
            key={uploadItem.id}
            uploadItem={uploadItem}
            index={index}
            moveItem={moveItem}
        >
            <AttachmentItem
                channelId={channelId}
                upload={uploadItem}
                draftType={draftType}
                keyboardModeEnabled={keyboardModeEnabled}
                clip={uploadItem.clip}
                size={size}
            />
        </DraggableItem>
    ));
};

export default definePlugin({
    name: "ReorderAttachments",
    description: "Allows you to reorder attachments before sending them",
    authors: [{ name: "Suffocate", id: 772601756776923187n }, TestcordDevs.sirphantom89],
    patches: [
        {
            find: ')("attachments",',
            replacement: [
                {
                    match: /:(\i).map\(\i=>.{0,100}?(channelId:\i,.{0,150}?\i\.\i\.MEDIUM)},\i\.id\)\)(?<=\1=(\i).filter\(\i=>\i.filename!==(\i)\).{0,200})/,
                    replace: ":$self.DraggableList({$2,attachments:$3,ignoredFilename:$4})"
                }
            ]
        },
        {
            find: '"video/quicktime","video/mp4"];',
            replacement: [
                {
                    match: /"img",{src:\i,/,
                    replace: "$&draggable:false,"
                }
            ]
        }
    ],
    DraggableList
});
