/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { ModalAPI as DiscordModalAPI, RenderModalProps as DiscordRenderModalProps } from "@vencord/discord-types";
import { filters, findComponentByCodeLazy, mapMangledModuleLazy } from "@webpack";
import { closeAllModals, closeModal, openMediaModal, openModal, openModalLazy } from "@webpack/common";
import type { ComponentType, PropsWithChildren } from "react";

import { LazyComponent } from "./react";

/** @deprecated Migrate to new Modals */
export const enum ModalSize {
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    DYNAMIC = "dynamic",
}

/** @deprecated Migrate to new Modals */
export type RenderModalProps = DiscordRenderModalProps;
export type ModalProps = PropsWithChildren<Record<string, unknown>> & Partial<RenderModalProps> & { onClose(): void; };

type LegacyModalProps = PropsWithChildren<Record<string, unknown>> & Partial<RenderModalProps>;
type ModalComponent = ComponentType<LegacyModalProps>;
interface LegacyModals {
    ModalRoot: ModalComponent;
    ModalHeader: ModalComponent;
    ModalContent: ModalComponent;
    ModalFooter: ModalComponent;
    ModalCloseButton: ModalComponent;
}

export const Modals = mapMangledModuleLazy(".MODAL_ROOT_LEGACY,", {
    ModalRoot: filters.componentByCode('.MODAL,"aria-labelledby":'),
    ModalHeader: filters.componentByCode(",id:"),
    ModalContent: filters.componentByCode("scrollbarType:"),
    ModalFooter: filters.componentByCode(".HORIZONTAL_REVERSE,"),
    ModalCloseButton: filters.componentByCode(".withCircleBackground")
}) as LegacyModals;

/** @deprecated Migrate to new Modals */
export const ModalRoot = LazyComponent<LegacyModalProps>(() => Modals.ModalRoot);
/** @deprecated Migrate to new Modals */
export const ModalHeader = LazyComponent<LegacyModalProps>(() => Modals.ModalHeader);
/** @deprecated Migrate to new Modals */
export const ModalContent = LazyComponent<LegacyModalProps>(() => Modals.ModalContent);
/** @deprecated Migrate to new Modals */
export const ModalFooter = LazyComponent<LegacyModalProps>(() => Modals.ModalFooter);
/** @deprecated Migrate to new Modals */
export const ModalCloseButton = LazyComponent<LegacyModalProps>(() => Modals.ModalCloseButton);
export const CloseButton = findComponentByCodeLazy("CLOSE_BUTTON_LABEL");

/** @deprecated Migrate to new Modals */
export const ModalAPI = {
    openModal,
    openModalLazy,
    closeModal,
    closeAllModals
} as DiscordModalAPI;

export {
    /** @deprecated Migrate to new Modals */
    closeAllModals,
    /** @deprecated Migrate to new Modals */
    closeModal,
    /** @deprecated Migrate to new Modals */
    openMediaModal,
    /** @deprecated Migrate to new Modals */
    openModal,
    /** @deprecated Migrate to new Modals */
    openModalLazy
};
